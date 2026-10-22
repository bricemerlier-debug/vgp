-- Photo facultative de la fiche VGP, séparée de l'instantané du parc.
-- Après 001 ; stockage privé Supabase. Aucune fiche existante n'est modifiée.
begin;
create table if not exists public.equipment_photos(
 workspace_id uuid not null,
 equipment_id text not null,
 photo_path text not null,
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 primary key(workspace_id,equipment_id),
 foreign key(workspace_id,equipment_id) references public.equipment(workspace_id,id),
 check(photo_path ~ ('^'||workspace_id::text||'/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_[a-f0-9]{64}\.jpg$'))
);
alter table public.equipment_photos enable row level security;
revoke all on public.equipment_photos from public,anon,authenticated;
grant select on public.equipment_photos to authenticated;
drop policy if exists equipment_photo_read on public.equipment_photos;
create policy equipment_photo_read on public.equipment_photos for select to authenticated
 using(public.workspace_role(workspace_id) is not null);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('equipment-photos','equipment-photos',false,204800,array['image/jpeg']) on conflict(id) do nothing;
do $$begin
 if exists(select 1 from storage.buckets where id='equipment-photos' and (public is distinct from false or file_size_limit is distinct from 204800 or allowed_mime_types is distinct from array['image/jpeg'])) then
  raise exception 'Le bucket equipment-photos doit être privé et limité aux JPEG de 200 Ko';
 end if;
end$$;

create or replace function public.equipment_photo_storage_access(object_name text,writing boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare wid uuid;r text;
begin
 if auth.uid() is null or object_name !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_[a-f0-9]{64}\.jpg$' then return false;end if;
 wid:=split_part(object_name,'/',1)::uuid;r:=public.workspace_role(wid);
 if writing then return coalesce(r in ('admin','editor'),false);end if;
 return r is not null and exists(select 1 from public.equipment_photos p where p.workspace_id=wid and p.photo_path=object_name);
end$$;
revoke all on function public.equipment_photo_storage_access(text,boolean) from public,anon;
grant execute on function public.equipment_photo_storage_access(text,boolean) to authenticated;
drop policy if exists equipment_photo_object_read on storage.objects;
create policy equipment_photo_object_read on storage.objects for select to authenticated
 using(bucket_id='equipment-photos' and public.equipment_photo_storage_access(name,false));
drop policy if exists equipment_photo_object_upload on storage.objects;
create policy equipment_photo_object_upload on storage.objects for insert to authenticated
 with check(bucket_id='equipment-photos' and public.equipment_photo_storage_access(name,true));
drop policy if exists equipment_photo_object_delete on storage.objects;
create policy equipment_photo_object_delete on storage.objects for delete to authenticated
 using(bucket_id='equipment-photos' and public.equipment_photo_storage_access(name,true)
   and not exists(select 1 from public.equipment_photos p where p.photo_path=name));
-- Une autre politique permissive ne doit pas contourner les limites du bucket.
drop policy if exists equipment_photo_read_boundary on storage.objects;
create policy equipment_photo_read_boundary on storage.objects as restrictive for select to public
 using(bucket_id<>'equipment-photos' or public.equipment_photo_storage_access(name,false));
drop policy if exists equipment_photo_upload_boundary on storage.objects;
create policy equipment_photo_upload_boundary on storage.objects as restrictive for insert to public
 with check(bucket_id<>'equipment-photos' or public.equipment_photo_storage_access(name,true));
drop policy if exists equipment_photo_no_update on storage.objects;
create policy equipment_photo_no_update on storage.objects as restrictive for update to public
 using(bucket_id<>'equipment-photos') with check(bucket_id<>'equipment-photos');
drop policy if exists equipment_photo_delete_boundary on storage.objects;
create policy equipment_photo_delete_boundary on storage.objects as restrictive for delete to public
 using(bucket_id<>'equipment-photos' or (public.equipment_photo_storage_access(name,true)
   and not exists(select 1 from public.equipment_photos p where p.photo_path=name)));

create or replace function public.set_equipment_photo(w uuid, equipment_id text, photo_path text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous_path text;
begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Modification de photo refusée';end if;
 if not exists(select 1 from public.equipment e where e.workspace_id=w and e.id=equipment_id) then raise exception 'Équipement inconnu';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||equipment_id,0));
 select p.photo_path into previous_path from public.equipment_photos p where p.workspace_id=w and p.equipment_id=$2;
 if photo_path is null then
  delete from public.equipment_photos p where p.workspace_id=w and p.equipment_id=$2;
 else
  if photo_path !~ ('^'||w::text||'/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_[a-f0-9]{64}\.jpg$')
   or not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id
    where o.bucket_id='equipment-photos' and o.name=photo_path and not b.public
    and (o.metadata->>'size')::bigint between 1 and 204800 and o.metadata->>'mimetype'='image/jpeg')
  then raise exception 'La photo doit exister dans le stockage privé';end if;
  insert into public.equipment_photos(workspace_id,equipment_id,photo_path,updated_by)
   values(w,$2,photo_path,auth.uid()) on conflict on constraint equipment_photos_pkey
   do update set photo_path=excluded.photo_path,updated_at=now(),updated_by=excluded.updated_by;
 end if;
 return jsonb_build_object('path',photo_path,'previousPath',previous_path);
end$$;
revoke all on function public.set_equipment_photo(uuid,text,text) from public,anon;
grant execute on function public.set_equipment_photo(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
