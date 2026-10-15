-- Après 006_apave.sql. Conclusions explicites proposées dans l’aperçu, validation du lot conservée.
-- Aucune fiche existante ni aucun contrôle n’est modifié par ce script.
begin;
alter table public.controls drop constraint if exists controls_result_check;
alter table public.controls add constraint controls_result_check check(result in ('Bon état','Mauvais état — réparable','Mauvais état — à jeter','Introuvable','Réalisé — observations à traiter'));
create or replace function public.guard_tracking_state() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_e jsonb; new_e jsonb; old_o jsonb; new_o jsonb; c jsonb; new_equipment_map jsonb; old_control_map jsonb; new_obligation_map jsonb; current_control_map jsonb;begin
if coalesce((old.payload->>'trackingVersion')::integer,1)>=2 and coalesce((new.payload->>'trackingVersion')::integer,1)<2 then raise exception 'Version du site périmée : recharger avant d’enregistrer';end if;
if coalesce((new.payload->>'trackingVersion')::integer,1)<2 then return new;end if;
select coalesce(jsonb_object_agg(e.value->>'id',e.value),'{}') into new_equipment_map from jsonb_array_elements(new.payload->'equipment') e;
select coalesce(jsonb_object_agg(c.value->>'id',c.value),'{}') into old_control_map from jsonb_array_elements(old.payload->'equipment') e cross join lateral jsonb_array_elements(e.value->'controls') c;
for old_e in select value from jsonb_array_elements(old.payload->'equipment') loop
new_e:=new_equipment_map->(old_e->>'id');
if new_e is null then raise exception 'Suppression d’équipement interdite';end if;
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
if jsonb_typeof(new_e->'obligations') is distinct from 'array' or jsonb_typeof(new_e->'periodicityValidation'->'validated') is distinct from 'boolean' then raise exception 'Version du site périmée : métadonnées métier manquantes';end if;
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

revoke all on function public.guard_tracking_state() from public,anon,authenticated;

create or replace function public.import_apave(w uuid,expected_revision bigint,document jsonb,report jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.workspace_state;p public.apave_reports;e jsonb;a jsonb;previous jsonb;c jsonb;total integer:=0;n integer;result jsonb;hash text:=report->>'sha256';begin
if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Import APAVE refusé';end if;
select * into s from public.workspace_state where workspace_id=w for update;
if not found or s.revision is distinct from expected_revision then raise exception 'REVISION_CONFLICT : rechargez avant de réessayer';end if;
if hash is null or hash !~ '^[a-f0-9]{64}$' or report->>'path' is distinct from w::text||'/'||hash||'.pdf' then raise exception 'Référence PDF invalide';end if;
if not exists(select 1 from storage.objects o where o.bucket_id='apave-reports' and o.name=report->>'path' and (o.metadata->>'size')::bigint=(report->>'size')::bigint and o.metadata->>'mimetype'='application/pdf') then raise exception 'Le PDF original doit exister dans le stockage privé';end if;
insert into public.apave_reports(workspace_id,sha256,report_number,storage_path,page_count,byte_size,file_name,imported_by)
values(w,hash,report->>'reportNumber',report->>'path',(report->>'pageCount')::integer,(report->>'size')::bigint,left(report->>'fileName',300),auth.uid()) on conflict(workspace_id,sha256) do nothing;
select * into p from public.apave_reports where workspace_id=w and sha256=hash;
if p.report_number is distinct from report->>'reportNumber' or p.page_count is distinct from (report->>'pageCount')::integer or p.byte_size is distinct from (report->>'size')::bigint then raise exception 'Rapport déjà enregistré avec d’autres métadonnées';end if;
for e in select value from jsonb_array_elements(document->'equipment') loop
for a in select value from jsonb_array_elements(coalesce(e->'apaveChecks','[]')) where value->>'reportHash'=hash loop
select details into previous from public.apave_checks where workspace_id=w and report_hash=hash and source_key=a->>'sourceKey';
if found then if previous is distinct from a then raise exception 'Constat déjà importé';end if;continue;end if;
if a->>'reportNumber' is distinct from p.report_number or a->>'reviewedById' is distinct from auth.uid()::text or nullif(trim(a->>'reviewedBy'),'') is null or a->>'reviewedAt' is null or a->>'state' is null or a->>'state' not in ('verified','partial','not_verified','unknown') then raise exception 'Validation humaine APAVE manquante';end if;
perform (a->>'reviewedAt')::timestamptz;
if jsonb_typeof(a->'pages') is distinct from 'array' or jsonb_array_length(a->'pages')<1 or exists(select 1 from jsonb_array_elements_text(a->'pages') pg where pg.value !~ '^\d+$' or pg.value::integer not between 1 and p.page_count) then raise exception 'Pages APAVE invalides';end if;
if a->>'state'='not_verified' and (a->>'date' is not null or a->>'controlId' is not null or a->>'normalizedResult' is not null) then raise exception 'Un équipement non vérifié ne compte pas comme contrôlé';end if;
if a->>'controlId' is not null then
if a->>'state'<>'verified' or nullif(trim(a->>'verifier'),'') is null or a->>'date' is null or jsonb_typeof(a->'issues') is distinct from 'array' or jsonb_array_length(a->'issues')<>0 or (coalesce((e->>'archived')::boolean,false) and not (a->>'normalizedResult'='Mauvais état — à jeter' and exists(select 1 from jsonb_array_elements(coalesce(e->'archiveHistory','[]')) h where h.value->>'workflow'='apave-disposal' and h.value->>'controlId'=a->>'controlId' and h.value->'apave'->>'reportHash'=hash and h.value->'apave'->>'sourceKey'=a->>'sourceKey'))) or coalesce((e->>'needsReverification')::boolean,false) then raise exception 'Vérification APAVE incomplète : constat uniquement';end if;
if a->>'normalizedResult' is null or a->>'normalizedResult' not in ('Bon état','Mauvais état — réparable','Mauvais état — à jeter','Réalisé — observations à traiter') then raise exception 'Choisissez explicitement le résultat métier';end if;
if exists(select 1 from public.controls c where c.workspace_id=w and c.equipment_id=e->>'id' and c.performed_on=(a->>'date')::date and lower(trim(c.verifier))=lower(trim(a->>'verifier'))) then raise exception 'Un contrôle de ce vérificateur existe déjà à cette date pour ce matériel';end if;
end if;
insert into public.apave_checks values(w,hash,a->>'sourceKey',e->>'id',a->>'controlId',a);total:=total+1;
end loop;end loop;
if total=0 then raise exception 'Aucun nouveau constat APAVE : import déjà effectué';end if;
result:=public.write_state(w,expected_revision,document,null);
return result||jsonb_build_object('apave_checks',total);
end$$;
revoke all on function public.import_apave(uuid,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.import_apave(uuid,bigint,jsonb,jsonb) to authenticated;
create or replace function public.guard_apave_disposals() returns trigger
language plpgsql security definer set search_path='' as $$
declare e jsonb;a jsonb;c jsonb;begin
for e in select value from jsonb_array_elements(new.payload->'equipment') loop
if exists(select 1 from jsonb_array_elements(e->'controls') x where x.value->>'result'='Réalisé — observations à traiter' and (x.value->'apave' is null or x.value->'apave'='null'::jsonb)) then raise exception 'Un résultat APAVE avec observations exige son rapport source';end if;
for a in select value from jsonb_array_elements(coalesce(e->'archiveHistory','[]')) where value->>'workflow'='apave-disposal' loop
select value into c from jsonb_array_elements(e->'controls') where value->>'id'=a->>'controlId';
if c is null or c->>'result'<>'Mauvais état — à jeter' or c->>'date' is distinct from a->>'date' or c->'apave' is distinct from a->'apave' or a->>'type'<>'archive' or a->>'reason'<>'Mis au rebut' or a->>'operatorConfirmed' is distinct from 'true' then raise exception 'Mise au rebut APAVE sans contrôle et confirmation correspondants';end if;
end loop;end loop;
return new;end$$;
revoke all on function public.guard_apave_disposals() from public,anon,authenticated;
drop trigger if exists apave_disposal_guard on public.workspace_state;
create trigger apave_disposal_guard before update on public.workspace_state for each row execute function public.guard_apave_disposals();
create or replace function public.apave_automation_ready(w uuid) returns boolean
language sql stable security definer set search_path='' as $$
select public.apave_ready(w) and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.workspace_state'::regclass and tgname='apave_disposal_guard' and tgenabled in ('O','A'));
$$;
revoke all on function public.apave_automation_ready(uuid) from public,anon;
grant execute on function public.apave_automation_ready(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
