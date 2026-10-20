-- Photos facultatives sur les fiches contenant, dans le stockage privé existant.
-- Après supabase/009_equipment_maintenance.sql et supabase/015_container_fast_writes.sql.
begin;
do $$begin
 if to_regprocedure('public.maintenance_storage_access(text,boolean)') is null then raise exception 'Installer supabase/009_equipment_maintenance.sql avant ce script.';end if;
 if to_regprocedure('public.write_containers(uuid,bigint,jsonb)') is null then raise exception 'Installer supabase/015_container_fast_writes.sql avant ce script.';end if;
 if not exists(select 1 from storage.buckets where id='equipment-maintenance' and not public) then raise exception 'Le bucket privé equipment-maintenance est absent.';end if;
end$$;

-- Une photo de contenant est lisible uniquement si son chemin est référencé par sa fiche.
-- Les photos du carnet de maintenance gardent leur règle d’accès actuelle.
create or replace function public.maintenance_storage_access(object_name text,writing boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare wid uuid;r text;
begin
 if auth.uid() is null or object_name !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_[a-f0-9]{64}\.jpg$' then return false;end if;
 wid:=split_part(object_name,'/',1)::uuid;r:=public.workspace_role(wid);
 if writing then return coalesce(r in ('admin','editor'),false);end if;
 return r is not null and (
  exists(select 1 from public.equipment_maintenance m where m.workspace_id=wid and m.photo_path=object_name)
  or exists(
   select 1 from public.workspace_state s
   cross join lateral jsonb_array_elements(case when jsonb_typeof(s.payload->'containers')='array' then s.payload->'containers' else '[]'::jsonb end) c
   where s.workspace_id=wid and c.value->>'photoPath'=object_name
  )
 );
end$$;
revoke all on function public.maintenance_storage_access(text,boolean) from public;
grant execute on function public.maintenance_storage_access(text,boolean) to anon,authenticated;

-- Après retrait ou remplacement, les éditeurs peuvent effacer l’ancien objet de leur espace.
-- Un chemin encore utilisé par une intervention ou une fiche reste protégé.
create or replace function public.container_photo_delete_access(object_name text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare wid uuid;
begin
 if auth.uid() is null or object_name !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_[a-f0-9]{64}\.jpg$' then return false;end if;
 wid:=split_part(object_name,'/',1)::uuid;
 return coalesce(public.workspace_role(wid) in ('admin','editor'),false)
  and not exists(select 1 from public.equipment_maintenance m where m.workspace_id=wid and m.photo_path=object_name)
  and not exists(
   select 1 from public.workspace_state s
   cross join lateral jsonb_array_elements(case when jsonb_typeof(s.payload->'containers')='array' then s.payload->'containers' else '[]'::jsonb end) c
   where s.workspace_id=wid and c.value->>'photoPath'=object_name
  );
end$$;
revoke all on function public.container_photo_delete_access(text) from public;
grant execute on function public.container_photo_delete_access(text) to anon,authenticated;

drop policy if exists maintenance_container_photo_delete on storage.objects;
create policy maintenance_container_photo_delete on storage.objects for delete to authenticated
 using(bucket_id='equipment-maintenance' and public.container_photo_delete_access(name));
drop policy if exists maintenance_no_delete on storage.objects;
create policy maintenance_no_delete on storage.objects as restrictive for delete to public
 using(bucket_id<>'equipment-maintenance' or public.container_photo_delete_access(name));
notify pgrst, 'reload schema';
commit;
