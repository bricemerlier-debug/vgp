-- Écriture ciblée des contenants avec fusion traçable des fiches étoilées.
-- À exécuter après 015_container_fast_writes.sql (et 016 si installé).
begin;
do $$begin
 if to_regprocedure('public.write_containers(uuid,bigint,jsonb)') is null then
  raise exception 'Installer 015_container_fast_writes.sql avant 021';
 end if;
end$$;

create or replace function public.write_containers(w uuid, expected_revision bigint, containers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.workspace_state; role_name text; next_payload jsonb; new_map jsonb;
 old_container jsonb; new_container jsonb; source_record jsonb; old_intervention jsonb;
 match_count integer;
begin
 role_name:=public.workspace_role(w);
 if auth.uid() is null or role_name is null or role_name not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 select * into s from public.workspace_state where workspace_id=w for update;
 if not found then raise exception 'Espace non initialisé';end if;
 if s.revision is distinct from expected_revision then raise exception 'REVISION_CONFLICT : rechargez les données avant de réessayer';end if;
 if exists(select 1 from public.migration_receipts where workspace_id=w and validated_at is null) then
  raise exception 'Validez la migration avant de modifier les données';end if;
 if containers is null or jsonb_typeof(containers)<>'array' then raise exception 'Liste de contenants invalide';end if;
 if exists(select 1 from jsonb_array_elements(containers) c where jsonb_typeof(c.value)<>'object'
  or nullif(btrim(c.value->>'id'),'') is null or nullif(btrim(c.value->>'number'),'') is null
  or position('*' in c.value->>'number')>0
  or jsonb_typeof(c.value->'type') is distinct from 'string'
  or jsonb_typeof(c.value->'subtype') is distinct from 'string'
  or jsonb_typeof(c.value->'interventions') is distinct from 'array') then
  raise exception 'Fiche contenant invalide ou numéro avec étoile';end if;
 if (select count(*)<>count(distinct c.value->>'id') from jsonb_array_elements(containers) c) then
  raise exception 'Identifiant contenant dupliqué';end if;
 if (select count(*)<>count(distinct lower(btrim(c.value->>'number'))) from jsonb_array_elements(containers) c) then
  raise exception 'Numéro de contenant dupliqué';end if;
 select coalesce(jsonb_object_agg(c.value->>'id',c.value),'{}'::jsonb) into new_map
 from jsonb_array_elements(containers) c;
 for old_container in select value from jsonb_array_elements(coalesce(s.payload->'containers','[]'::jsonb)) loop
  new_container:=new_map->(old_container->>'id');
  if new_container is not null then
   if not coalesce(new_container->'interventions','[]'::jsonb) @> coalesce(old_container->'interventions','[]'::jsonb) then
    raise exception 'Historique d’intervention incomplet pour %',old_container->>'number';end if;
   continue;
  end if;
  select count(*) into match_count
  from jsonb_array_elements(containers) c
  cross join lateral jsonb_array_elements(coalesce(c.value->'numberMergeHistory','[]'::jsonb)) m
  where m.value->>'sourceId'=old_container->>'id' and m.value->'sourceSnapshot'=old_container;
  if match_count<>1 then raise exception 'Fusion non traçable pour %',old_container->>'number';end if;
  select c.value into new_container from jsonb_array_elements(containers) c
  cross join lateral jsonb_array_elements(coalesce(c.value->'numberMergeHistory','[]'::jsonb)) m
  where m.value->>'sourceId'=old_container->>'id' and m.value->'sourceSnapshot'=old_container limit 1;
  if upper(regexp_replace(new_container->>'number','[[:space:]*-]+','','g'))
     <>upper(regexp_replace(old_container->>'number','[[:space:]*-]+','','g')) then
   raise exception 'Fusion de numéros différents interdite : %',old_container->>'number';end if;
  for old_intervention in select value from jsonb_array_elements(coalesce(old_container->'interventions','[]'::jsonb)) loop
   if not exists(select 1 from jsonb_array_elements(coalesce(new_container->'interventions','[]'::jsonb)) i
      where i.value-'number'=old_intervention-'number') then
    raise exception 'Intervention perdue lors de la fusion de %',old_container->>'number';end if;
  end loop;
 end loop;
 next_payload:=jsonb_set(s.payload,'{containers}',containers,true);
 if octet_length(next_payload::text)>20000000 then raise exception 'Limite de 20 Mo par instantané';end if;
 insert into public.state_history values(w,s.revision,s.payload,now(),auth.uid());
 update public.workspace_state set payload=next_payload,revision=s.revision+1,updated_at=now(),updated_by=auth.uid()
 where workspace_id=w;
 return jsonb_build_object('revision',s.revision+1);
end$$;
alter function public.write_containers(uuid,bigint,jsonb) set statement_timeout = '90s';
alter function public.write_containers(uuid,bigint,jsonb) set lock_timeout = '5s';
revoke all on function public.write_containers(uuid,bigint,jsonb) from public,anon;
grant execute on function public.write_containers(uuid,bigint,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
