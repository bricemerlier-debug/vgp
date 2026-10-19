-- Écriture ciblée des contenants après 001, 003 et 004.
-- Ne modifie ni les fiches VGP, ni leurs contrôles, ni les données déjà enregistrées.
-- À exécuter une seule fois dans le SQL Editor du projet Supabase du site.
begin;
do $$begin
 if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.workspace_state'::regclass and tgname='tracking_state_guard' and tgenabled in ('O','A')) then
  raise exception 'Installer supabase/003_tracking_guard.sql avant ce script.';
 end if;
 if position('equipment_map' in pg_get_functiondef('public.write_state(uuid,bigint,jsonb,text)'::regprocedure))=0 then
  raise exception 'Installer supabase/004_fast_writes.sql avant ce script.';
 end if;
end$$;

-- La protection VGP reste active pour toute modification autre que les contenants.
-- Une écriture limitée à payload.containers ne touche aucun champ qu'elle protège.
drop trigger tracking_state_guard on public.workspace_state;
create trigger tracking_state_guard before update of payload on public.workspace_state
for each row when ((old.payload - 'containers') is distinct from (new.payload - 'containers'))
execute function public.guard_tracking_state();

create or replace function public.write_containers(w uuid, expected_revision bigint, containers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.workspace_state; role_name text; next_payload jsonb; new_map jsonb; old_container jsonb; new_container jsonb;
begin
 role_name:=public.workspace_role(w);
 if auth.uid() is null or role_name is null or role_name not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 select * into s from public.workspace_state where workspace_id=w for update;
 if not found then raise exception 'Espace non initialisé';end if;
 if s.revision is distinct from expected_revision then raise exception 'REVISION_CONFLICT : rechargez les données avant de réessayer';end if;
 if exists(select 1 from public.migration_receipts where workspace_id=w and validated_at is null) then raise exception 'Validez la migration avant de modifier les données';end if;
 if containers is null or jsonb_typeof(containers)<>'array' then raise exception 'Liste de contenants invalide';end if;
 if exists(select 1 from jsonb_array_elements(containers) c where jsonb_typeof(c.value)<>'object' or nullif(btrim(c.value->>'id'),'') is null or nullif(btrim(c.value->>'number'),'') is null or jsonb_typeof(c.value->'type') is distinct from 'string' or jsonb_typeof(c.value->'subtype') is distinct from 'string' or jsonb_typeof(c.value->'interventions') is distinct from 'array') then raise exception 'Fiche contenant invalide';end if;
 if (select count(*)<>count(distinct c.value->>'id') from jsonb_array_elements(containers) c) then raise exception 'Identifiant contenant dupliqué';end if;
 if (select count(*)<>count(distinct lower(btrim(c.value->>'number'))) from jsonb_array_elements(containers) c) then raise exception 'Numéro de contenant dupliqué';end if;
 select coalesce(jsonb_object_agg(c.value->>'id',c.value),'{}'::jsonb) into new_map from jsonb_array_elements(containers) c;
 for old_container in select value from jsonb_array_elements(coalesce(s.payload->'containers','[]'::jsonb)) loop
  new_container:=new_map->(old_container->>'id');
  if new_container is null then raise exception 'Suppression de contenant interdite';end if;
  if not coalesce(new_container->'interventions','[]'::jsonb) @> coalesce(old_container->'interventions','[]'::jsonb) then raise exception 'Historique d’intervention incomplet';end if;
 end loop;
 next_payload:=jsonb_set(s.payload,'{containers}',containers,true);
 if octet_length(next_payload::text)>20000000 then raise exception 'Limite de 20 Mo par instantané';end if;
 insert into public.state_history values(w,s.revision,s.payload,now(),auth.uid());
 update public.workspace_state set payload=next_payload,revision=s.revision+1,updated_at=now(),updated_by=auth.uid() where workspace_id=w;
 return jsonb_build_object('revision',s.revision+1);
end$$;
revoke all on function public.write_containers(uuid,bigint,jsonb) from public,anon;
grant execute on function public.write_containers(uuid,bigint,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
