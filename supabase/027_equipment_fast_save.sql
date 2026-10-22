-- 027 : enregistrement VGP ciblé dans les validations du parc.
-- Installer après 003 ; reprend 004 et accélère les protections APAVE 006 et 007.
-- Ne modifie aucune fiche existante et ne désactive aucun déclencheur.
begin;
do $$begin
 if not exists(select 1 from pg_trigger where tgname='tracking_state_guard' and tgrelid='public.workspace_state'::regclass and tgenabled in ('O','A')) then
  raise exception 'Installer d’abord le script 003_tracking_guard.sql';
 end if;
end$$;

create or replace function public.write_state(w uuid, expected_revision bigint, document jsonb, source text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.workspace_state; r text; receipt uuid; e jsonb; old_e jsonb; old_c jsonb; equipment_map jsonb; old_equipment_map jsonb; control_map jsonb;
begin
r:=public.workspace_role(w);
if auth.uid() is null or r is null or r not in ('admin','editor') then raise exception 'Écriture refusée';end if;
select * into s from public.workspace_state where workspace_id=w for update;
if not found then raise exception 'Espace non initialisé';end if;
if s.revision is distinct from expected_revision then raise exception 'REVISION_CONFLICT : rechargez les données avant de réessayer';end if;
if exists(select 1 from public.migration_receipts where workspace_id=w and validated_at is null) then raise exception 'Validez la migration avant de modifier les données';end if;
if source is not null and (r<>'admin' or s.revision<>0) then raise exception 'Migration réservée à l’administrateur et à un espace vierge';end if;
if document is null or jsonb_typeof(document)<>'object' or jsonb_typeof(document->'equipment') is distinct from 'array' or jsonb_typeof(document->'owners') is distinct from 'array' then raise exception 'Document invalide';end if;
if octet_length(document::text)>20000000 then raise exception 'Limite de 20 Mo par instantané';end if;
if exists(select 1 from jsonb_array_elements(document->'equipment') x where nullif(trim(x.value->>'id'),'') is null or jsonb_typeof(x.value->'controls') is distinct from 'array') then raise exception 'Équipement invalide';end if;
if (select count(*)<>count(distinct x.value->>'id') from jsonb_array_elements(document->'equipment') x) then raise exception 'Identifiant matériel dupliqué';end if;
if exists(select 1 from jsonb_array_elements(document->'equipment') x cross join lateral jsonb_array_elements(x.value->'controls') c where nullif(trim(c.value->>'id'),'') is null) then raise exception 'Contrôle invalide';end if;
if (select count(*)<>count(distinct c.value->>'id') from jsonb_array_elements(document->'equipment') x cross join lateral jsonb_array_elements(x.value->'controls') c) then raise exception 'Identifiant contrôle dupliqué';end if;

-- Indexer le JSON une fois, plutôt que rescanner le parc pour chaque fiche.
select coalesce(jsonb_object_agg(x.value->>'id',x.value),'{}'::jsonb) into equipment_map from jsonb_array_elements(document->'equipment') x;
select coalesce(jsonb_object_agg(x.value->>'id',x.value),'{}'::jsonb) into old_equipment_map from jsonb_array_elements(s.payload->'equipment') x;
for old_e in select value from jsonb_array_elements(s.payload->'equipment') loop
e:=equipment_map->(old_e->>'id');
if e is null then raise exception 'Suppression interdite : archivez l’équipement';end if;
if e is not distinct from old_e then continue;end if;
select coalesce(jsonb_object_agg(c.value->>'id',c.value),'{}') into control_map from jsonb_array_elements(e->'controls') c;
for old_c in select value from jsonb_array_elements(old_e->'controls') loop
if control_map->(old_c->>'id') is distinct from old_c then raise exception 'Historique de contrôle immuable';end if;
end loop;
end loop;
for e in select value from jsonb_array_elements(document->'equipment') loop
if e is not distinct from old_equipment_map->(e->>'id') then continue;end if;
perform (e->>'firstControlDate')::date,(e->>'manualNextControlDate')::date,(e->>'createdDate')::date;
end loop;

-- Une seule écriture ensembliste ; ne pas réécrire les fiches inchangées.
insert into public.equipment(workspace_id,id,site_id,identifier,serial_number,name,owner_name,months,archived,details)
select w,e.value->>'id',(e.value->>'siteId')::bigint,e.value->>'identifier',e.value->>'serialNumber',e.value->>'designation',e.value->>'owner',(e.value->>'months')::integer,coalesce((e.value->>'archived')::boolean,false),e.value
from jsonb_array_elements(document->'equipment') e
where e.value is distinct from old_equipment_map->(e.value->>'id')
on conflict(workspace_id,id) do update set site_id=excluded.site_id,identifier=excluded.identifier,serial_number=excluded.serial_number,name=excluded.name,owner_name=excluded.owner_name,months=excluded.months,archived=excluded.archived,details=excluded.details
where public.equipment.details is distinct from excluded.details;

-- Les contrôles existants ont été vérifiés immuables ; insérer seulement les nouveaux.
insert into public.controls(workspace_id,id,equipment_id,report_id,performed_on,verifier,result,planned_on,details)
select w,c.value->>'id',e.value->>'id',c.value->>'reportId',(c.value->>'date')::date,c.value->>'intervenant',c.value->>'result',(c.value->>'plannedDate')::date,c.value
from jsonb_array_elements(document->'equipment') e cross join lateral jsonb_array_elements(e.value->'controls') c
where e.value is distinct from old_equipment_map->(e.value->>'id')
on conflict(workspace_id,id) do nothing;

insert into public.state_history values(w,s.revision,s.payload,now(),auth.uid());
update public.workspace_state set payload=document,revision=s.revision+1,updated_at=now(),updated_by=auth.uid() where workspace_id=w;
if source is not null then
insert into public.migration_receipts(workspace_id,revision,source,imported_by,equipment_count,control_count)
values(w,s.revision+1,left(source,300),auth.uid(),jsonb_array_length(document->'equipment'),(select count(*) from public.controls where workspace_id=w)) returning id into receipt;
end if;
return jsonb_build_object('revision',s.revision+1,'receipt',receipt);
end$$;

create or replace function public.guard_tracking_state() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_e jsonb; new_e jsonb; old_o jsonb; new_o jsonb; c jsonb; new_equipment_map jsonb; old_equipment_map jsonb; old_control_map jsonb; new_obligation_map jsonb; current_control_map jsonb;begin
if coalesce((old.payload->>'trackingVersion')::integer,1)>=2 and coalesce((new.payload->>'trackingVersion')::integer,1)<2 then raise exception 'Version du site périmée : recharger avant d’enregistrer';end if;
if coalesce((new.payload->>'trackingVersion')::integer,1)<2 then return new;end if;
select coalesce(jsonb_object_agg(e.value->>'id',e.value),'{}') into new_equipment_map from jsonb_array_elements(new.payload->'equipment') e;
select coalesce(jsonb_object_agg(e.value->>'id',e.value),'{}'::jsonb) into old_equipment_map from jsonb_array_elements(old.payload->'equipment') e;
for old_e in select value from jsonb_array_elements(old.payload->'equipment') loop
new_e:=new_equipment_map->(old_e->>'id');
if new_e is null then raise exception 'Suppression d’équipement interdite';end if;
if new_e is not distinct from old_e then continue;end if;
select coalesce(jsonb_object_agg(o.value->>'id',o.value),'{}') into new_obligation_map from jsonb_array_elements(coalesce(new_e->'obligations','[]')) o;
for old_o in select value from jsonb_array_elements(coalesce(old_e->'obligations','[]')) loop
new_o:=new_obligation_map->(old_o->>'id');
if new_o is null then raise exception 'Échéance historique manquante : recharger le site';end if;
if (old_o - array['done','controlId','controlDate','excludedAt','excludedReason','excludedBy']) is distinct from (new_o - array['done','controlId','controlDate','excludedAt','excludedReason','excludedBy']) then raise exception 'Échéance historique immuable';end if;
if coalesce((old_o->>'done')::boolean,false) and (new_o->'done' is distinct from old_o->'done' or new_o->'controlId' is distinct from old_o->'controlId' or new_o->'controlDate' is distinct from old_o->'controlDate') then raise exception 'Réalisation historique immuable';end if;
if old_o->>'excludedAt' is not null and (new_o->'excludedAt' is distinct from old_o->'excludedAt' or new_o->'excludedReason' is distinct from old_o->'excludedReason') then raise exception 'Exclusion historique immuable';end if;
end loop;
if old_e->>'cycleControlId' is not null and old_e->>'cycleControlId'=new_e->>'cycleControlId' and old_e->'cycleDeadline' is distinct from new_e->'cycleDeadline' then raise exception 'Échéance du cycle actuel immuable';end if;
if not coalesce(new_e->'dateHistory','[]') @> coalesce(old_e->'dateHistory','[]') then raise exception 'Historique des dates incomplet';end if;
if not coalesce(new_e->'archiveHistory','[]') @> coalesce(old_e->'archiveHistory','[]') then raise exception 'Historique des archivages incomplet';end if;
end loop;
for new_e in select value from jsonb_array_elements(new.payload->'equipment') loop
if new_e is not distinct from old_equipment_map->(new_e->>'id') then continue;end if;
if jsonb_typeof(new_e->'obligations') is distinct from 'array' or jsonb_typeof(new_e->'periodicityValidation'->'validated') is distinct from 'boolean' then raise exception 'Version du site périmée : métadonnées métier manquantes';end if;
select coalesce(jsonb_object_agg(x.value->>'id',x.value),'{}'::jsonb) into old_control_map from jsonb_array_elements(coalesce(old_equipment_map->(new_e->>'id')->'controls','[]'::jsonb)) x;
select coalesce(jsonb_object_agg(x.value->>'id',x.value),'{}') into current_control_map from jsonb_array_elements(new_e->'controls') x;
for c in select value from jsonb_array_elements(new_e->'controls') loop
if not(old_control_map ? (c->>'id')) then
if c->>'result'='Introuvable' and not(old.revision=0 and public.workspace_role(new.workspace_id)='admin') then raise exception 'Introuvable doit être un événement d’archivage, pas un nouveau contrôle';end if;
if c->>'enteredById' is not null and c->>'enteredById'<>auth.uid()::text then raise exception 'Compte de saisie incorrect';end if;
if c->>'plannedDate' is not null and c->>'result'<>'Introuvable' and not exists(select 1 from jsonb_array_elements(coalesce(new_e->'obligations','[]')) o where o.value->>'date'=c->>'plannedDate' and o.value->>'controlId'=c->>'id' and (o.value->>'done')::boolean) then raise exception 'Contrôle non rattaché à son échéance';end if;
end if;
end loop;
for new_o in select value from jsonb_array_elements(coalesce(new_e->'obligations','[]')) loop
perform (new_o->>'date')::date;
if coalesce((new_o->>'done')::boolean,false) then c:=current_control_map->(new_o->>'controlId');if c is null or coalesce(c->>'result','') not in ('Bon état','Mauvais état — réparable','Mauvais état — à jeter','Réalisé — observations à traiter') or c->>'date' is distinct from new_o->>'controlDate' or c->>'plannedDate' is distinct from new_o->>'date' or btrim(coalesce(c->>'intervenant',''))='' then raise exception 'Réalisation d’échéance sans contrôle exploitable';end if;end if;
end loop;
end loop;
return new;
end$$;


create or replace function public.guard_apave_state() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_e jsonb;e jsonb;a jsonb;c jsonb;r jsonb;equipment_map jsonb;old_equipment_map jsonb;begin
select coalesce(jsonb_object_agg(x.value->>'id',x.value),'{}') into equipment_map from jsonb_array_elements(new.payload->'equipment') x;
select coalesce(jsonb_object_agg(x.value->>'id',x.value),'{}'::jsonb) into old_equipment_map from jsonb_array_elements(old.payload->'equipment') x;
if not coalesce(new.payload->'apaveReports','[]') @> coalesce(old.payload->'apaveReports','[]') then raise exception 'Historique APAVE immuable : recharger le site';end if;
for old_e in select value from jsonb_array_elements(old.payload->'equipment') loop
e:=equipment_map->(old_e->>'id');
if e is not distinct from old_e then continue;end if;
if not coalesce(e->'apaveChecks','[]') @> coalesce(old_e->'apaveChecks','[]') then raise exception 'Constats APAVE immuables';end if;
end loop;
for r in select value from jsonb_array_elements(coalesce(new.payload->'apaveReports','[]')) loop
if not exists(select 1 from public.apave_reports p where p.workspace_id=new.workspace_id and p.sha256=r->>'sha256' and p.report_number=r->>'reportNumber' and p.storage_path=r->>'path' and p.page_count=(r->>'pageCount')::integer and p.byte_size=(r->>'size')::bigint) then raise exception 'Rapport APAVE non enregistré';end if;
end loop;
if (select count(*)<>count(distinct (a.value->>'reportHash',a.value->>'sourceKey')) from jsonb_array_elements(new.payload->'equipment') e cross join lateral jsonb_array_elements(coalesce(e.value->'apaveChecks','[]')) a) then raise exception 'Constat APAVE dupliqué';end if;
for e in select value from jsonb_array_elements(new.payload->'equipment') loop
if e is not distinct from old_equipment_map->(e->>'id') then continue;end if;
for a in select value from jsonb_array_elements(coalesce(e->'apaveChecks','[]')) loop
if not exists(select 1 from public.apave_checks p where p.workspace_id=new.workspace_id and p.equipment_id=e->>'id' and p.report_hash=a->>'reportHash' and p.source_key=a->>'sourceKey' and p.details=a) then raise exception 'Constat APAVE non enregistré ou modifié';end if;
if not exists(select 1 from jsonb_array_elements(coalesce(new.payload->'apaveReports','[]')) r where r.value->>'sha256'=a->>'reportHash') then raise exception 'Référence APAVE manquante';end if;
if a->>'controlId' is not null and not exists(select 1 from jsonb_array_elements(e->'controls') c where c.value->>'id'=a->>'controlId' and c.value->'apave'->>'sourceKey'=a->>'sourceKey' and c.value->'apave'->>'reportHash'=a->>'reportHash') then raise exception 'Contrôle APAVE manquant';end if;
end loop;
for c in select value from jsonb_array_elements(e->'controls') where value->'apave' is not null loop
if not exists(select 1 from public.apave_checks p where p.workspace_id=new.workspace_id and p.equipment_id=e->>'id' and p.control_id=c->>'id' and p.report_hash=c->'apave'->>'reportHash' and p.source_key=c->'apave'->>'sourceKey' and p.details->>'state'='verified' and p.details->>'normalizedResult'=c->>'result' and p.details->>'date'=c->>'date' and p.details->>'verifier'=c->>'intervenant' and p.details->>'observations'=c->>'observations' and c->'apave'=jsonb_build_object('reportHash',p.report_hash,'reportNumber',p.details->'reportNumber','sourceKey',p.source_key,'pages',p.details->'pages')) then raise exception 'Un constat non vérifié ou partiel ne valide pas un contrôle complet';end if;
end loop;
end loop;
return new;end$$;

create or replace function public.guard_apave_disposals() returns trigger
language plpgsql security definer set search_path='' as $$
declare e jsonb;a jsonb;c jsonb;old_equipment_map jsonb;begin
select coalesce(jsonb_object_agg(x.value->>'id',x.value),'{}'::jsonb) into old_equipment_map from jsonb_array_elements(old.payload->'equipment') x;
for e in select value from jsonb_array_elements(new.payload->'equipment') loop
if e is not distinct from old_equipment_map->(e->>'id') then continue;end if;
if exists(select 1 from jsonb_array_elements(e->'controls') x where x.value->>'result'='Réalisé — observations à traiter' and (x.value->'apave' is null or x.value->'apave'='null'::jsonb)) then raise exception 'Un résultat APAVE avec observations exige son rapport source';end if;
for a in select value from jsonb_array_elements(coalesce(e->'archiveHistory','[]')) where value->>'workflow'='apave-disposal' loop
select value into c from jsonb_array_elements(e->'controls') where value->>'id'=a->>'controlId';
if c is null or c->>'result'<>'Mauvais état — à jeter' or c->>'date' is distinct from a->>'date' or c->'apave' is distinct from a->'apave' or a->>'type'<>'archive' or a->>'reason'<>'Mis au rebut' or a->>'operatorConfirmed' is distinct from 'true' then raise exception 'Mise au rebut APAVE sans contrôle et confirmation correspondants';end if;
end loop;end loop;
return new;end$$;
revoke all on function public.write_state(uuid,bigint,jsonb,text) from public,anon;
grant execute on function public.write_state(uuid,bigint,jsonb,text) to authenticated;
revoke all on function public.guard_tracking_state(),public.guard_apave_state(),public.guard_apave_disposals() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
