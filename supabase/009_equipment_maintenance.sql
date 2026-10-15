-- Carnet de maintenance et photos privées. Après 001 et 004.
-- Additif : ne modifie aucun équipement, contrôle, statut ou échéance existant.
begin;
create table if not exists public.equipment_maintenance(
 workspace_id uuid not null references public.workspaces(id),
 id uuid not null,
 equipment_id text not null,
 date date not null,
 kind text not null check(kind in ('Réparation','Entretien','Observation')),
 comment text not null check(length(btrim(comment)) between 1 and 5000),
 author text not null check(length(btrim(author)) between 1 and 160),
 photo_path text,
 created_at timestamptz not null default now(),
 entered_by uuid not null references auth.users(id),
 primary key(workspace_id,id),
 foreign key(workspace_id,equipment_id) references public.equipment(workspace_id,id),
 check(photo_path is null or photo_path ~ ('^'||workspace_id::text||'/'||id::text||'_[a-f0-9]{64}\.jpg$'))
);
create index if not exists maintenance_equipment_date on public.equipment_maintenance(workspace_id,equipment_id,date desc,created_at desc);
alter table public.equipment_maintenance enable row level security;
revoke all on public.equipment_maintenance from public,anon,authenticated;
grant select on public.equipment_maintenance to authenticated;
drop policy if exists maintenance_read on public.equipment_maintenance;
create policy maintenance_read on public.equipment_maintenance for select to authenticated using(public.workspace_role(workspace_id) is not null);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('equipment-maintenance','equipment-maintenance',false,2097152,array['image/jpeg']) on conflict(id) do nothing;
do $$begin if exists(select 1 from storage.buckets where id='equipment-maintenance' and public) then raise exception 'Le bucket de maintenance doit être privé';end if;end$$;
create or replace function public.maintenance_storage_access(object_name text,writing boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare wid uuid; r text;
begin
if auth.uid() is null or object_name !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_[a-f0-9]{64}\.jpg$' then return false;end if;
wid:=split_part(object_name,'/',1)::uuid;r:=public.workspace_role(wid);
if writing then return coalesce(r in ('admin','editor'),false);end if;
return r is not null and exists(select 1 from public.equipment_maintenance m where m.workspace_id=wid and m.photo_path=object_name);
end$$;
revoke all on function public.maintenance_storage_access(text,boolean) from public;
grant execute on function public.maintenance_storage_access(text,boolean) to anon,authenticated;
drop policy if exists maintenance_photo_read on storage.objects;
create policy maintenance_photo_read on storage.objects for select to authenticated using(bucket_id='equipment-maintenance' and public.maintenance_storage_access(name,false));
drop policy if exists maintenance_photo_upload on storage.objects;
create policy maintenance_photo_upload on storage.objects for insert to authenticated with check(bucket_id='equipment-maintenance' and public.maintenance_storage_access(name,true));
-- Ces limites restent effectives même en présence d’une autre politique permissive.
drop policy if exists maintenance_read_boundary on storage.objects;
create policy maintenance_read_boundary on storage.objects as restrictive for select to public using(bucket_id<>'equipment-maintenance' or public.maintenance_storage_access(name,false));
drop policy if exists maintenance_upload_boundary on storage.objects;
create policy maintenance_upload_boundary on storage.objects as restrictive for insert to public with check(bucket_id<>'equipment-maintenance' or public.maintenance_storage_access(name,true));
drop policy if exists maintenance_no_update on storage.objects;
create policy maintenance_no_update on storage.objects as restrictive for update to public using(bucket_id<>'equipment-maintenance') with check(bucket_id<>'equipment-maintenance');
drop policy if exists maintenance_no_delete on storage.objects;
create policy maintenance_no_delete on storage.objects as restrictive for delete to public using(bucket_id<>'equipment-maintenance');

create or replace function public.read_equipment_maintenance(w uuid,equipment_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
if auth.uid() is null or public.workspace_role(w) is null then raise exception 'Lecture du carnet refusée';end if;
return (select coalesce(jsonb_agg(to_jsonb(m) order by m.date desc,m.created_at desc),'[]') from public.equipment_maintenance m where m.workspace_id=w and m.equipment_id=$2);
end$$;
create or replace function public.add_equipment_maintenance(w uuid,entry jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare eid uuid;previous public.equipment_maintenance; saved public.equipment_maintenance; path text; d date;
begin
if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Écriture du carnet refusée';end if;
if jsonb_typeof(entry) is distinct from 'object' or entry->>'id' is null or entry->>'date' is null or entry->>'kind' is null or entry->>'author' is null or entry->>'comment' is null or entry->>'equipment_id' is null then raise exception 'Intervention incomplète';end if;
eid:=(entry->>'id')::uuid;d:=(entry->>'date')::date;path:=nullif(entry->>'photo_path','');
if entry->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or d>(now() at time zone 'Europe/Paris')::date or d<'1900-01-01'::date then raise exception 'Date d’intervention invalide';end if;
if not exists(select 1 from public.equipment e where e.workspace_id=w and e.id=entry->>'equipment_id') then raise exception 'Équipement inconnu';end if;
-- Sérialiser aussi deux tentatives simultanées de la même intervention.
perform pg_advisory_xact_lock(hashtextextended(w::text||eid::text,0));
select * into previous from public.equipment_maintenance m where m.workspace_id=w and m.id=eid;
if found then
 if previous.equipment_id=entry->>'equipment_id' and previous.date=d and previous.kind=entry->>'kind' and previous.comment=entry->>'comment' and previous.author=entry->>'author' and previous.photo_path is not distinct from path then return to_jsonb(previous);end if;
 raise exception 'Cette intervention est déjà enregistrée avec un autre contenu';
end if;
if path is not null and (path !~ ('^'||w::text||'/'||eid::text||'_[a-f0-9]{64}\.jpg$') or not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id='equipment-maintenance' and o.name=path and not b.public and (o.metadata->>'size')::bigint between 1 and 2097152 and o.metadata->>'mimetype'='image/jpeg')) then raise exception 'La photo doit exister dans le stockage privé';end if;
insert into public.equipment_maintenance(workspace_id,id,equipment_id,date,kind,comment,author,photo_path,entered_by)
values(w,eid,entry->>'equipment_id',d,entry->>'kind',entry->>'comment',entry->>'author',path,auth.uid()) returning * into saved;
return to_jsonb(saved);
end$$;
revoke all on function public.read_equipment_maintenance(uuid,text),public.add_equipment_maintenance(uuid,jsonb) from public,anon;
grant execute on function public.read_equipment_maintenance(uuid,text),public.add_equipment_maintenance(uuid,jsonb) to authenticated;
commit;
