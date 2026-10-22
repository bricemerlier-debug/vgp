-- 031 : les ajouts simples écrivent une fiche à la fois.
-- Les imports groupés et les modifications composées gardent write_state.
begin;

do $$begin
 if to_regprocedure('public.write_state(uuid,bigint,jsonb,text)') is null
    or to_regprocedure('public.read_state(uuid)') is null
    or to_regprocedure('public.submit_recipient_declaration(text,text,text,text,jsonb,boolean)') is null
    or to_regclass('public.equipment_loss_links') is null
    or to_regclass('public.equipment_scrap_links') is null
    or not exists(select 1 from pg_trigger where tgrelid='public.workspace_state'::regclass
      and tgname='tracking_state_guard' and tgenabled in ('O','A')) then
  raise exception 'Installer d’abord les scripts 003, 024, 025, 026 et 027.';
 end if;
 if to_regprocedure('public.write_state_snapshot(uuid,bigint,jsonb,text)') is not null then
  raise exception 'Le script 031 est déjà installé.';
 end if;
end$$;

create table if not exists public.equipment_write_history(
 workspace_id uuid not null references public.workspaces(id),
 revision bigint not null,
 equipment_id text not null,
 previous_details jsonb,
 new_details jsonb not null,
 saved_at timestamptz not null default now(),
 saved_by uuid references auth.users(id),
 primary key(workspace_id,revision)
);
alter table public.equipment_write_history enable row level security;
revoke all on public.equipment_write_history from public,anon,authenticated;
drop policy if exists member_read on public.equipment_write_history;
create policy member_read on public.equipment_write_history for select to authenticated
 using(public.workspace_role(workspace_id) is not null);
grant select on public.equipment_write_history to authenticated;

create or replace function public.current_equipment_payload(w uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(e.details order by e.site_id,e.id),'[]'::jsonb)
 from public.equipment e where e.workspace_id=w
$$;
revoke all on function public.current_equipment_payload(uuid) from public,anon,authenticated;

-- Lecture compatible : la réponse garde le même format, les fiches viennent des lignes équipement.
create or replace function public.read_state(w uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.workspace_state;document jsonb;next_id bigint;
begin
 if auth.uid() is null or public.workspace_role(w) is null then raise exception 'Accès refusé';end if;
 select * into s from public.workspace_state where workspace_id=w;
 if not found then raise exception 'Espace non initialisé';end if;
 document:=s.payload||jsonb_build_object('equipment',public.current_equipment_payload(w));
 select greatest(coalesce((s.payload->>'nextVgpId')::bigint,1),coalesce(max(site_id)+1,1))
 into next_id from public.equipment where workspace_id=w;
 document:=jsonb_set(document,'{nextVgpId}',to_jsonb(next_id),true);
 return jsonb_build_object('revision',s.revision,'payload',document,
  'migration',(select to_jsonb(m) from public.migration_receipts m where m.workspace_id=w order by imported_at desc limit 1));
end$$;

create or replace function public.write_equipment_record(
 w uuid,expected_revision bigint,equipment_record jsonb
) returns jsonb language plpgsql security definer
set search_path='' set statement_timeout='90s' set lock_timeout='5s' as $$
declare s public.workspace_state;old_e jsonb;new_c jsonb;old_c jsonb;old_o jsonb;new_o jsonb;
 added_controls integer:=0;next_revision bigint;profile_role text;equipment_id text;site_id bigint;
begin
 profile_role:=public.workspace_role(w);
 if auth.uid() is null or profile_role not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 if equipment_record is null or jsonb_typeof(equipment_record)<>'object'
    or nullif(btrim(equipment_record->>'id'),'') is null
    or jsonb_typeof(equipment_record->'controls') is distinct from 'array'
    or jsonb_typeof(equipment_record->'obligations') is distinct from 'array'
    or jsonb_typeof(equipment_record->'periodicityValidation'->'validated') is distinct from 'boolean' then
  raise exception 'Fiche équipement invalide';
 end if;
 if octet_length(equipment_record::text)>20000000 then raise exception 'Limite de 20 Mo par fiche';end if;
 equipment_id:=equipment_record->>'id';
 if nullif(btrim(equipment_record->>'identifier'),'') is null
    or nullif(btrim(equipment_record->>'designation'),'') is null
    or (equipment_record->>'siteId') !~ '^[1-9][0-9]{0,17}$'
    or (equipment_record->>'months') !~ '^(3|6|9|12)$' then raise exception 'Fiche équipement invalide';end if;
 site_id:=(equipment_record->>'siteId')::bigint;
 perform (equipment_record->>'firstControlDate')::date,
         (equipment_record->>'manualNextControlDate')::date,
         (equipment_record->>'createdDate')::date;

 select * into s from public.workspace_state where workspace_id=w for update;
 if not found then raise exception 'Espace non initialisé';end if;
 if s.revision is distinct from expected_revision then raise exception 'REVISION_CONFLICT : rechargez les données avant de réessayer';end if;
 if exists(select 1 from public.migration_receipts where workspace_id=w and validated_at is null) then raise exception 'Validez la migration avant de modifier les données';end if;
 select details into old_e from public.equipment where workspace_id=w and id=equipment_id for update;

 if old_e is null then
  -- La création avec un contrôle initial reste sur le chemin historique, qui vérifie tout le lot.
  if jsonb_array_length(equipment_record->'controls')<>0 then raise exception 'Utilisez l’enregistrement complet pour une création avec contrôle initial';end if;
  if jsonb_array_length(coalesce(equipment_record->'apaveChecks','[]'::jsonb))<>0 then raise exception 'Les constats APAVE doivent passer par leur import dédié';end if;
  if coalesce((equipment_record->>'archived')::boolean,false) then raise exception 'Création archivée invalide';end if;
 else
  if site_id is distinct from (old_e->>'siteId')::bigint then raise exception 'L’ID VGP ne peut pas être modifié';end if;
  if equipment_record->'apaveChecks' is distinct from old_e->'apaveChecks' then raise exception 'Les constats APAVE doivent passer par leur import dédié';end if;
  if jsonb_array_length(equipment_record->'controls')<>jsonb_array_length(old_e->'controls')+1 then raise exception 'Cette écriture ciblée accepte uniquement l’ajout d’un contrôle';end if;
  for old_c in select value from jsonb_array_elements(coalesce(old_e->'controls','[]'::jsonb)) loop
   if not equipment_record->'controls' @> jsonb_build_array(old_c) then raise exception 'Historique de contrôle immuable';end if;
  end loop;
  select count(*) into added_controls from jsonb_array_elements(equipment_record->'controls') c
   where not exists(select 1 from jsonb_array_elements(coalesce(old_e->'controls','[]'::jsonb)) o where o.value->>'id'=c.value->>'id');
  if added_controls<>1 then raise exception 'Le contrôle ajouté est invalide';end if;
  if not coalesce(equipment_record->'archiveHistory','[]'::jsonb) @> coalesce(old_e->'archiveHistory','[]'::jsonb)
     or not coalesce(equipment_record->'dateHistory','[]'::jsonb) @> coalesce(old_e->'dateHistory','[]'::jsonb) then raise exception 'Historique équipement incomplet';end if;
  if old_e->>'cycleControlId' is not null and old_e->>'cycleControlId'=equipment_record->>'cycleControlId'
     and old_e->'cycleDeadline' is distinct from equipment_record->'cycleDeadline' then raise exception 'Échéance du cycle actuel immuable';end if;
  for old_o in select value from jsonb_array_elements(coalesce(old_e->'obligations','[]'::jsonb)) loop
   select value into new_o from jsonb_array_elements(equipment_record->'obligations') where value->>'id'=old_o->>'id';
   if new_o is null then raise exception 'Échéance historique manquante : rechargez le site';end if;
   if (old_o-array['done','controlId','controlDate','excludedAt','excludedReason','excludedBy'])
      is distinct from (new_o-array['done','controlId','controlDate','excludedAt','excludedReason','excludedBy']) then raise exception 'Échéance historique immuable';end if;
   if coalesce((old_o->>'done')::boolean,false) and
      (new_o->'done' is distinct from old_o->'done' or new_o->'controlId' is distinct from old_o->'controlId' or new_o->'controlDate' is distinct from old_o->'controlDate') then raise exception 'Réalisation historique immuable';end if;
   if old_o->>'excludedAt' is not null and (new_o->'excludedAt' is distinct from old_o->'excludedAt' or new_o->'excludedReason' is distinct from old_o->'excludedReason') then raise exception 'Exclusion historique immuable';end if;
  end loop;
 end if;

 for new_c in select value from jsonb_array_elements(equipment_record->'controls') c
  where old_e is null or not exists(select 1 from jsonb_array_elements(old_e->'controls') o where o.value->>'id'=c.value->>'id') loop
  if nullif(btrim(new_c->>'id'),'') is null or nullif(btrim(new_c->>'reportId'),'') is null
     or new_c->>'result' not in ('Bon état','Mauvais état — réparable','Mauvais état — à jeter')
     or nullif(btrim(new_c->>'intervenant'),'') is null then raise exception 'Contrôle invalide';end if;
  if new_c->'apave' is not null and new_c->'apave'<>'null'::jsonb then raise exception 'Les contrôles APAVE doivent passer par leur import dédié';end if;
  if new_c->>'enteredById' is not null and new_c->>'enteredById'<>auth.uid()::text then raise exception 'Compte de saisie incorrect';end if;
  perform (new_c->>'date')::date,(new_c->>'plannedDate')::date;
  if new_c->>'plannedDate' is not null and not exists(select 1 from jsonb_array_elements(equipment_record->'obligations') o
    where o.value->>'date'=new_c->>'plannedDate' and o.value->>'controlId'=new_c->>'id' and (o.value->>'done')::boolean) then raise exception 'Contrôle non rattaché à son échéance';end if;
 end loop;
 for new_o in select value from jsonb_array_elements(equipment_record->'obligations') loop
  perform (new_o->>'date')::date;
  if coalesce((new_o->>'done')::boolean,false) then
   select value into new_c from jsonb_array_elements(equipment_record->'controls') where value->>'id'=new_o->>'controlId';
   if new_c is null or coalesce(new_c->>'result','') not in ('Bon état','Mauvais état — réparable','Mauvais état — à jeter','Réalisé — observations à traiter')
      or new_c->>'date' is distinct from new_o->>'controlDate' or new_c->>'plannedDate' is distinct from new_o->>'date'
      or nullif(btrim(new_c->>'intervenant'),'') is null then raise exception 'Réalisation d’échéance sans contrôle exploitable';end if;
  end if;
 end loop;

 next_revision:=s.revision+1;
 insert into public.equipment_write_history(workspace_id,revision,equipment_id,previous_details,new_details,saved_by)
 values(w,next_revision,equipment_id,old_e,equipment_record,auth.uid());
 insert into public.state_history(workspace_id,revision,payload,saved_at,saved_by)
 values(w,s.revision,jsonb_build_object('format','equipment-delta-v1','equipmentId',equipment_id,'previousDetails',old_e),now(),auth.uid());
 insert into public.equipment(workspace_id,id,site_id,identifier,serial_number,name,owner_name,months,archived,details)
 values(w,equipment_id,site_id,equipment_record->>'identifier',equipment_record->>'serialNumber',equipment_record->>'designation',equipment_record->>'owner',(equipment_record->>'months')::integer,coalesce((equipment_record->>'archived')::boolean,false),equipment_record)
 on conflict(workspace_id,id) do update set identifier=excluded.identifier,serial_number=excluded.serial_number,name=excluded.name,owner_name=excluded.owner_name,months=excluded.months,archived=excluded.archived,details=excluded.details;
 insert into public.controls(workspace_id,id,equipment_id,report_id,performed_on,verifier,result,planned_on,details)
 select w,c.value->>'id',equipment_id,c.value->>'reportId',(c.value->>'date')::date,c.value->>'intervenant',c.value->>'result',(c.value->>'plannedDate')::date,c.value
 from jsonb_array_elements(equipment_record->'controls') c
 where not exists(select 1 from jsonb_array_elements(coalesce(old_e->'controls','[]'::jsonb)) o where o.value->>'id'=c.value->>'id');
 update public.workspace_state set revision=next_revision,updated_at=now(),updated_by=auth.uid() where workspace_id=w;
 return jsonb_build_object('revision',next_revision);
end$$;

revoke all on function public.write_equipment_record(uuid,bigint,jsonb) from public,anon;
grant execute on function public.write_equipment_record(uuid,bigint,jsonb) to authenticated;

-- write_state reste le chemin de compatibilité pour les lots. Avant de l'appeler,
-- il réconcilie l'ancien instantané avec les lignes ciblées, pour que ses contrôles
-- d'immuabilité et son journal partent bien des dernières versions.
alter function public.write_state(uuid,bigint,jsonb,text) rename to write_state_snapshot;
revoke all on function public.write_state_snapshot(uuid,bigint,jsonb,text) from public,anon,authenticated;
create function public.write_state(w uuid,expected_revision bigint,document jsonb,source text default null) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='45s' set lock_timeout='5s' as $$
declare s public.workspace_state;r text;current_equipment jsonb;
begin
 r:=public.workspace_role(w);
 if auth.uid() is null or r not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 select * into s from public.workspace_state where workspace_id=w for update;
 if not found then raise exception 'Espace non initialisé';end if;
 if s.revision is distinct from expected_revision then raise exception 'REVISION_CONFLICT : rechargez les données avant de réessayer';end if;
 if exists(select 1 from public.migration_receipts where workspace_id=w and validated_at is null) then raise exception 'Validez la migration avant de modifier les données';end if;
 current_equipment:=public.current_equipment_payload(w);
 if s.payload->'equipment' is distinct from current_equipment then
  update public.workspace_state set payload=s.payload||jsonb_build_object('equipment',current_equipment) where workspace_id=w;
 end if;
 return public.write_state_snapshot(w,expected_revision,document,source);
end$$;
revoke all on function public.write_state(uuid,bigint,jsonb,text) from public,anon;
grant execute on function public.write_state(uuid,bigint,jsonb,text) to authenticated;

-- Les liens de perte/rebut relisent la ligne VGP, qui reste à jour après une écriture ciblée.
create or replace function public.create_equipment_loss_link(w uuid,equipment_id text,recipient text,for_test boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.workspace_state;e jsonb;secret text;link public.equipment_loss_links;
begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Création du lien refusée';end if;
 if recipient is null or length(recipient)>254 or recipient !~ '^[^[:space:]@<>;,]+@[^[:space:]@<>;,]+\.[^[:space:]@<>;,]+$' or for_test is null then raise exception 'Adresse destinataire invalide';end if;
 select * into s from public.workspace_state where workspace_id=w;
 if not found then raise exception 'Espace introuvable';end if;
 if exists(select 1 from public.migration_receipts where workspace_id=w and validated_at is null) then raise exception 'Migration en attente';end if;
 select details into e from public.equipment where workspace_id=w and id=equipment_id;
 if e is null or coalesce((e->>'archived')::boolean,false) then raise exception 'Équipement indisponible';end if;
 if not for_test and not public.loss_recipient_is_owner(s.payload,e,recipient) then raise exception 'Ce destinataire n’est plus associé à l’équipement';end if;
 secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.equipment_loss_links(workspace_id,equipment_id,token_hash,recipient,equipment_fingerprint,is_test,created_by,expires_at)
 values(w,equipment_id,encode(sha256(convert_to(secret,'UTF8')),'hex'),lower(btrim(recipient)),public.loss_equipment_fingerprint(e),for_test,auth.uid(),now()+interval '35 days') returning * into link;
 return jsonb_build_object('token',secret,'expiresAt',link.expires_at,'test',link.is_test);
end$$;

create or replace function public.create_equipment_scrap_link(w uuid,equipment_id text,recipient text,for_test boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.workspace_state;e jsonb;secret text;link public.equipment_scrap_links;
begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Création du lien refusée';end if;
 if recipient is null or length(recipient)>254 or recipient !~ '^[^[:space:]@<>;,]+@[^[:space:]@<>;,]+\.[^[:space:]@<>;,]+$' or for_test is null then raise exception 'Adresse destinataire invalide';end if;
 select * into s from public.workspace_state where workspace_id=w;
 if not found then raise exception 'Espace introuvable';end if;
 if exists(select 1 from public.migration_receipts where workspace_id=w and validated_at is null) then raise exception 'Migration en attente';end if;
 select details into e from public.equipment where workspace_id=w and id=equipment_id;
 if e is null or coalesce((e->>'archived')::boolean,false) then raise exception 'Équipement indisponible';end if;
 if not for_test and not public.scrap_recipient_is_owner(s.payload,e,recipient) then raise exception 'Ce destinataire n’est plus associé à l’équipement';end if;
 secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.equipment_scrap_links(workspace_id,equipment_id,token_hash,recipient,equipment_fingerprint,is_test,created_by,expires_at)
 values(w,equipment_id,encode(sha256(convert_to(secret,'UTF8')),'hex'),lower(btrim(recipient)),public.scrap_equipment_fingerprint(e),for_test,auth.uid(),now()+interval '35 days') returning * into link;
 return jsonb_build_object('token',secret,'expiresAt',link.expires_at,'test',link.is_test);
end$$;

create or replace function public.read_equipment_loss_link(token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare link public.equipment_loss_links;e jsonb;s public.workspace_state;
begin
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Lien invalide ou expiré';end if;
 select * into link from public.equipment_loss_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 if not found then raise exception 'Lien invalide ou expiré';end if;
 if link.used_at is not null then return jsonb_build_object('status','submitted','test',link.is_test,'receipt',link.receipt);end if;
 if link.expires_at<=now() then raise exception 'Lien invalide ou expiré';end if;
 select * into s from public.workspace_state where workspace_id=link.workspace_id;
 select details into e from public.equipment where workspace_id=link.workspace_id and id=link.equipment_id;
 if e is null or coalesce((e->>'archived')::boolean,false) or public.loss_equipment_fingerprint(e) is distinct from link.equipment_fingerprint
    or (not link.is_test and not public.loss_recipient_is_owner(s.payload,e,link.recipient)) then raise exception 'Ce lien n’est plus valable pour la situation actuelle du matériel';end if;
 return jsonb_build_object('status','ready','test',link.is_test,'recipient',link.recipient,'expiresAt',link.expires_at,
  'equipment',jsonb_build_object('number',e->>'identifier','name',coalesce(nullif(e->>'standardName',''),e->>'designation'),
  'serialNumber',e->>'serialNumber','owner',e->>'owner','photo',e->'mailPhoto'));
end$$;

create or replace function public.read_equipment_scrap_link(token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare link public.equipment_scrap_links;e jsonb;s public.workspace_state;
begin
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Lien invalide ou expiré';end if;
 select * into link from public.equipment_scrap_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 if not found then raise exception 'Lien invalide ou expiré';end if;
 if link.used_at is not null then return jsonb_build_object('status','submitted','test',link.is_test,'receipt',link.receipt);end if;
 if link.expires_at<=now() then raise exception 'Lien invalide ou expiré';end if;
 select * into s from public.workspace_state where workspace_id=link.workspace_id;
 select details into e from public.equipment where workspace_id=link.workspace_id and id=link.equipment_id;
 if e is null or coalesce((e->>'archived')::boolean,false) or public.scrap_equipment_fingerprint(e) is distinct from link.equipment_fingerprint
    or (not link.is_test and not public.scrap_recipient_is_owner(s.payload,e,link.recipient)) then raise exception 'Ce lien n’est plus valable pour la situation actuelle du matériel';end if;
 return jsonb_build_object('status','ready','test',link.is_test,'recipient',link.recipient,'expiresAt',link.expires_at,
  'equipment',jsonb_build_object('number',e->>'identifier','name',coalesce(nullif(e->>'standardName',''),e->>'designation'),
  'serialNumber',e->>'serialNumber','owner',e->>'owner','photo',e->'mailPhoto'));
end$$;

-- Les déclarations restent compatibles avec le parcours historique : seule leur soumission
-- matérialise à nouveau l'instantané complet avant d'ajouter le rapport signé.
alter function public.submit_recipient_declaration(text,text,text,text,jsonb,boolean) rename to submit_recipient_declaration_snapshot;
revoke all on function public.submit_recipient_declaration_snapshot(text,text,text,text,jsonb,boolean) from public,anon,authenticated;
create function public.submit_recipient_declaration(declaration_kind text,token text,signer_name text,search_details text,signature jsonb,accepted boolean) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='90s' set lock_timeout='5s' as $$
declare w uuid;s public.workspace_state;current_equipment jsonb;
begin
 if declaration_kind='loss' then select workspace_id into w from public.equipment_loss_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 elsif declaration_kind='scrap' then select workspace_id into w from public.equipment_scrap_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 else raise exception 'Déclaration invalide';end if;
 if w is null then raise exception 'Lien invalide ou expiré';end if;
 select * into s from public.workspace_state where workspace_id=w for update;
 if not found then raise exception 'Espace introuvable';end if;
 current_equipment:=public.current_equipment_payload(w);
 if s.payload->'equipment' is distinct from current_equipment then
  update public.workspace_state set payload=s.payload||jsonb_build_object('equipment',current_equipment) where workspace_id=w;
 end if;
 return public.submit_recipient_declaration_snapshot(declaration_kind,token,signer_name,search_details,signature,accepted);
end$$;
create or replace function public.submit_equipment_loss(token text,signer_name text,search_details text,signature jsonb,accepted boolean) returns jsonb
language sql security definer set search_path='' set statement_timeout='90s' set lock_timeout='5s' as $$select public.submit_recipient_declaration('loss',token,signer_name,search_details,signature,accepted)$$;
create or replace function public.submit_equipment_scrap(token text,signer_name text,search_details text,signature jsonb,accepted boolean) returns jsonb
language sql security definer set search_path='' set statement_timeout='90s' set lock_timeout='5s' as $$select public.submit_recipient_declaration('scrap',token,signer_name,search_details,signature,accepted)$$;
revoke all on function public.submit_equipment_loss(text,text,text,jsonb,boolean),public.submit_equipment_scrap(text,text,text,jsonb,boolean),public.submit_recipient_declaration(text,text,text,text,jsonb,boolean) from public;
grant execute on function public.submit_equipment_loss(text,text,text,jsonb,boolean),public.submit_equipment_scrap(text,text,text,jsonb,boolean) to anon,authenticated;
grant execute on function public.submit_recipient_declaration(text,text,text,text,jsonb,boolean) to anon,authenticated;

notify pgrst,'reload schema';
commit;

-- Après un ajout ciblé, read_state doit montrer la nouvelle révision et le nouvel équipement.
select p.oid::regprocedure as fonction,p.proconfig from pg_proc p
where p.oid in ('public.write_equipment_record(uuid,bigint,jsonb)'::regprocedure,
                'public.write_state(uuid,bigint,jsonb,text)'::regprocedure);
