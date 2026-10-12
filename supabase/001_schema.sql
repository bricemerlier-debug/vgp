-- Phase 1 : instantané compatible + projections relationnelles transactionnelles.
-- Exécuter une seule fois, dans le SQL Editor du projet Supabase neuf.
begin;
create table public.workspaces(id uuid primary key default gen_random_uuid(), name text not null);
create table public.workspace_members(workspace_id uuid references public.workspaces on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('admin','editor','reader')), primary key(workspace_id,user_id));
create table public.workspace_state(workspace_id uuid primary key references public.workspaces, revision bigint not null default 0, payload jsonb not null default '{"equipment":[],"owners":[],"anticipation":30}', updated_at timestamptz not null default now(), updated_by uuid references auth.users);
create table public.state_history(workspace_id uuid references public.workspaces, revision bigint, payload jsonb not null, saved_at timestamptz not null default now(), saved_by uuid references auth.users, primary key(workspace_id,revision));
create table public.equipment(workspace_id uuid references public.workspaces, id text, site_id bigint not null check(site_id>0), identifier text not null check(length(trim(identifier))>0), serial_number text, name text not null check(length(trim(name))>0), owner_name text, months integer not null check(months in (3,6,9,12)), archived boolean not null, details jsonb not null, primary key(workspace_id,id), unique(workspace_id,site_id));
create unique index equipment_internal_unique on public.equipment(workspace_id,lower(trim(identifier)));
create unique index equipment_serial_unique on public.equipment(workspace_id,lower(trim(serial_number))) where nullif(trim(serial_number),'') is not null;
create table public.controls(workspace_id uuid, id text, equipment_id text not null, report_id text not null check(length(trim(report_id))>0), performed_on date not null, verifier text not null check(length(trim(verifier))>0), result text not null check(result in ('Bon état','Mauvais état — réparable','Mauvais état — à jeter','Introuvable')), planned_on date, details jsonb not null, primary key(workspace_id,id), foreign key(workspace_id,equipment_id) references public.equipment on delete cascade, unique(workspace_id,report_id));
create table public.migration_receipts(id uuid primary key default gen_random_uuid(),workspace_id uuid references public.workspaces, revision bigint not null, source text not null, imported_at timestamptz default now(), imported_by uuid references auth.users, validated_at timestamptz, equipment_count integer not null, control_count integer not null);
-- Aucun expéditeur n'est installé ; une future fonction serveur utilisera ces tables.
create table public.reminder_settings(workspace_id uuid primary key references public.workspaces, enabled boolean not null default false check(enabled=false), timezone text not null default 'Europe/Paris');
create table public.reminder_jobs(id uuid primary key default gen_random_uuid(),workspace_id uuid references public.workspaces,equipment_id text not null,due_on date not null,stage integer not null check(stage in (30,14,7,0)),run_on date not null,recipient text,status text not null default 'queued' check(status in ('queued','sent','cancelled','failed')),sent_at timestamptz,provider_reference text,unique(workspace_id,equipment_id,due_on,stage),foreign key(workspace_id,equipment_id) references public.equipment);
create table public.reminder_attempts(id uuid primary key default gen_random_uuid(),job_id uuid references public.reminder_jobs,workspace_id uuid references public.workspaces,attempted_at timestamptz default now(),outcome text not null,details text);

create function public.workspace_role(w uuid) returns text language sql stable security definer set search_path='' as $$select role from public.workspace_members where workspace_id=w and user_id=auth.uid()$$;
revoke all on function public.workspace_role(uuid) from public,anon;
grant execute on function public.workspace_role(uuid) to authenticated;
-- Adhésion et rôles : administrés exclusivement dans SQL Editor, jamais par le navigateur.
do $$declare t text; begin
foreach t in array array['workspaces','workspace_members','workspace_state','state_history','equipment','controls','migration_receipts','reminder_settings','reminder_jobs','reminder_attempts'] loop
execute format('alter table public.%I enable row level security',t);
execute format('revoke all on public.%I from anon, authenticated',t);
execute format('grant select on public.%I to authenticated',t);
if t='workspaces' then
execute format('create policy member_read on public.%I for select to authenticated using(public.workspace_role(id) is not null)',t);
else
execute format('create policy member_read on public.%I for select to authenticated using(public.workspace_role(workspace_id) is not null)',t);
end if;
end loop; end$$;
-- Les vues n'utilisent pas les privilèges de leur créateur (PostgreSQL 15+).
create view public.owners with (security_invoker=true) as select s.workspace_id, o.value #>> '{}' as name, coalesce((select c.value->>'email' from jsonb_array_elements(coalesce(s.payload->'ownerContacts','[]')) c where lower(c.value->>'owner')=lower(o.value #>> '{}') limit 1),'') as email from public.workspace_state s cross join lateral jsonb_array_elements(coalesce(s.payload->'owners','[]')) o;
create view public.verifiers with (security_invoker=true) as select s.workspace_id,o.value #>> '{}' as name from public.workspace_state s cross join lateral jsonb_array_elements(coalesce(s.payload->'verifiers','[]')) o;
create view public.mail_templates with (security_invoker=true) as select s.workspace_id,o.value->>'kind' as kind,o.value->>'subject' as subject,o.value->>'body' as body from public.workspace_state s cross join lateral jsonb_array_elements(coalesce(s.payload->'mailTemplates','[]')) o;
revoke all on public.owners,public.verifiers,public.mail_templates from anon;
grant select on public.owners,public.verifiers,public.mail_templates to authenticated;

create function public.read_state(w uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare s public.workspace_state;begin
if auth.uid() is null or public.workspace_role(w) is null then raise exception 'Accès refusé';end if;
select * into s from public.workspace_state where workspace_id=w;
if not found then raise exception 'Espace non initialisé';end if;
return jsonb_build_object('revision',s.revision,'payload',s.payload,'migration',(select to_jsonb(m) from public.migration_receipts m where m.workspace_id=w order by imported_at desc limit 1));
end$$;
create function public.write_state(w uuid, expected_revision bigint, document jsonb, source text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.workspace_state; e jsonb; c jsonb; old_e jsonb; old_c jsonb; r text;receipt uuid;begin
r:=public.workspace_role(w);
if auth.uid() is null or r is null or r not in ('admin','editor') then raise exception 'Écriture refusée';end if;
select * into s from public.workspace_state where workspace_id=w for update;
if not found then raise exception 'Espace non initialisé';end if;
if s.revision is distinct from expected_revision then raise exception 'REVISION_CONFLICT : rechargez les données avant de réessayer';end if;
if exists(select 1 from public.migration_receipts where workspace_id=w and validated_at is null) then raise exception 'Validez la migration avant de modifier les données';end if;
if source is not null and (r<>'admin' or s.revision<>0) then raise exception 'Migration réservée à l’administrateur et à un espace vierge';end if;
if document is null or jsonb_typeof(document)<>'object' or jsonb_typeof(document->'equipment') is distinct from 'array' or jsonb_typeof(document->'owners') is distinct from 'array' then raise exception 'Document invalide';end if;
if octet_length(document::text)>20000000 then raise exception 'Limite de 20 Mo par instantané';end if;
-- Pas de suppression implicite ni de réécriture des contrôles déjà enregistrés.
for old_e in select value from jsonb_array_elements(s.payload->'equipment') loop
select value into e from jsonb_array_elements(document->'equipment') where value->>'id'=old_e->>'id';
if e is null then raise exception 'Suppression interdite : archivez l’équipement';end if;
for old_c in select value from jsonb_array_elements(old_e->'controls') loop
if not exists(select 1 from jsonb_array_elements(e->'controls') c where c.value=old_c) then raise exception 'Historique de contrôle immuable';end if;
end loop;
end loop;
-- Projections reconstruites dans la même transaction. Tout échec annule l'ensemble.
delete from public.controls where workspace_id=w;
-- Conserver les équipements référencés par les futurs rappels ; UPSERT puis garde ci-dessus.
for e in select value from jsonb_array_elements(document->'equipment') loop
if jsonb_typeof(e->'controls') is distinct from 'array' or nullif(e->>'id','') is null then raise exception 'Équipement invalide';end if;
-- Les dates présentes doivent être des dates ISO valides.
perform (e->>'firstControlDate')::date,(e->>'manualNextControlDate')::date,(e->>'createdDate')::date;
insert into public.equipment values(w,e->>'id',(e->>'siteId')::bigint,e->>'identifier',e->>'serialNumber',e->>'designation',e->>'owner',(e->>'months')::integer,coalesce((e->>'archived')::boolean,false),e)
on conflict(workspace_id,id) do update set site_id=excluded.site_id,identifier=excluded.identifier,serial_number=excluded.serial_number,name=excluded.name,owner_name=excluded.owner_name,months=excluded.months,archived=excluded.archived,details=excluded.details;
for c in select value from jsonb_array_elements(e->'controls') loop
insert into public.controls values(w,c->>'id',e->>'id',c->>'reportId',(c->>'date')::date,c->>'intervenant',c->>'result',(c->>'plannedDate')::date,c);
end loop;
end loop;
if (select count(*) from public.equipment where workspace_id=w)<>jsonb_array_length(document->'equipment') then raise exception 'Identifiant matériel dupliqué';end if;
insert into public.state_history values(w,s.revision,s.payload,now(),auth.uid());
update public.workspace_state set payload=document,revision=s.revision+1,updated_at=now(),updated_by=auth.uid() where workspace_id=w;
if source is not null then insert into public.migration_receipts(workspace_id,revision,source,imported_by,equipment_count,control_count) values(w,s.revision+1,left(source,300),auth.uid(),jsonb_array_length(document->'equipment'),(select count(*) from public.controls where workspace_id=w)) returning id into receipt;end if;
return jsonb_build_object('revision',s.revision+1,'receipt',receipt);
end$$;
create function public.validate_migration(w uuid, receipt uuid, expected_document jsonb) returns void language plpgsql security definer set search_path='' as $$begin
if public.workspace_role(w) is distinct from 'admin' then raise exception 'Validation refusée';end if;
if not exists(select 1 from public.migration_receipts m join public.workspace_state s using(workspace_id) where m.id=receipt and m.workspace_id=w and m.revision=s.revision and s.payload=expected_document) then raise exception 'Vérification de migration échouée';end if;
update public.migration_receipts set validated_at=now() where id=receipt and workspace_id=w;
end$$;
revoke all on function public.read_state(uuid),public.write_state(uuid,bigint,jsonb,text),public.validate_migration(uuid,uuid,jsonb) from public,anon;
grant execute on function public.read_state(uuid),public.write_state(uuid,bigint,jsonb,text),public.validate_migration(uuid,uuid,jsonb) to authenticated;
commit;
