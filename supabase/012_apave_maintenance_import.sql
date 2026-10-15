-- Import manuel confirmé de l’extraction Excel APAVE. Après 010 et 011.
begin;
create table if not exists public.maintenance_action_imports(
 workspace_id uuid not null,source_key text not null check(source_key ~ '^[a-f0-9]{64}$'),
 action_id uuid not null,source jsonb not null,created_at timestamptz not null default now(),entered_by uuid not null references auth.users(id),
 primary key(workspace_id,source_key),foreign key(workspace_id,action_id) references public.maintenance_actions(workspace_id,id)
);
alter table public.maintenance_action_imports enable row level security;
revoke all on public.maintenance_action_imports from public,anon,authenticated;
grant select on public.maintenance_action_imports to authenticated;
drop policy if exists maintenance_imports_read on public.maintenance_action_imports;
create policy maintenance_imports_read on public.maintenance_action_imports for select to authenticated using(public.workspace_role(workspace_id) is not null);
create or replace function public.read_maintenance_action_imports(w uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null or public.workspace_role(w) is null then raise exception 'Lecture refusée';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('source_key',source_key,'action_id',action_id)),'[]') from public.maintenance_action_imports where workspace_id=w);
end$$;
create or replace function public.import_apave_maintenance_actions(w uuid,items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; saved jsonb; prior public.maintenance_action_imports; added integer:=0;skipped integer:=0;begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 if jsonb_typeof(items) is distinct from 'array' then raise exception 'Lot invalide';end if;
 if jsonb_array_length(items) not between 1 and 1000 then raise exception 'Lot limité à 1 000 actions';end if;
 -- Ordre stable des verrous pour les imports simultanés.
 for item in select value from jsonb_array_elements(items) order by value->>'source_key' loop
  if item->>'source_key' is null or item->>'source_key' !~ '^[a-f0-9]{64}$' or nullif(btrim(item->>'source_identifier'),'') is null or item->>'source_observation' is distinct from item->>'plan' or nullif(btrim(item->>'plan'),'') is null or item->>'source' is distinct from 'APAVE' or item->>'status' is distinct from 'todo' then raise exception 'Ligne APAVE invalide';end if;
  perform pg_advisory_xact_lock(hashtextextended(w::text||(item->>'source_key'),0));
  select * into prior from public.maintenance_action_imports where workspace_id=w and source_key=item->>'source_key';
  if found then
   if prior.source->>'source_identifier' is distinct from item->>'source_identifier' or prior.source->>'source_observation' is distinct from item->>'source_observation' or prior.source->>'source_report' is distinct from item->>'source_report' or prior.source->>'action_date' is distinct from item->>'action_date' or not exists(select 1 from public.maintenance_actions a where a.workspace_id=w and a.id=prior.action_id and a.equipment_id=item->>'equipment_id') then raise exception 'Cette observation a déjà été associée à une autre fiche ou un autre contenu';end if;
   skipped:=skipped+1;continue;
  end if;
  saved:=public.save_maintenance_action_v2(w,item,0);
  insert into public.maintenance_action_imports(workspace_id,source_key,action_id,source,entered_by) values(w,item->>'source_key',(saved->>'id')::uuid,item,auth.uid());
  added:=added+1;
 end loop;
 return jsonb_build_object('added',added,'skipped',skipped);
end$$;
revoke all on function public.read_maintenance_action_imports(uuid),public.import_apave_maintenance_actions(uuid,jsonb) from public,anon;
grant execute on function public.read_maintenance_action_imports(uuid),public.import_apave_maintenance_actions(uuid,jsonb) to authenticated;
commit;
