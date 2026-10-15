-- Plans d’action de maintenance. Exécuter après 009_equipment_maintenance.sql.
-- Aucun changement des contrôles VGP ou des échéances réglementaires.
begin;
create table if not exists public.maintenance_actions (
 workspace_id uuid not null references public.workspaces(id), id uuid not null,
 equipment_id text not null, title text not null check(length(btrim(title)) between 1 and 200),
 plan text not null check(length(btrim(plan)) between 1 and 5000),
 source text not null check(source in ('Manuel','APAVE')), reference text not null default '' check(length(reference)<=500),
 responsible text not null default '' check(length(responsible)<=160),
 priority text not null check(priority in ('low','normal','high')),
 status text not null default 'todo' check(status in ('todo','in_progress','done')),
 due_date date check(due_date>='1900-01-01'), revision integer not null default 1,
 completed_entry_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(workspace_id,id), foreign key(workspace_id,equipment_id) references public.equipment(workspace_id,id),
 foreign key(workspace_id,completed_entry_id) references public.equipment_maintenance(workspace_id,id),
 check((status='done')=(completed_entry_id is not null)), unique(workspace_id,completed_entry_id)
);
create table if not exists public.maintenance_action_events (
 workspace_id uuid not null, action_id uuid not null, revision integer not null,
 snapshot jsonb not null, actor uuid not null references auth.users(id), created_at timestamptz not null default now(),
 primary key(workspace_id,action_id,revision), foreign key(workspace_id,action_id) references public.maintenance_actions(workspace_id,id)
);
alter table public.maintenance_actions enable row level security;
alter table public.maintenance_action_events enable row level security;
revoke all on public.maintenance_actions,public.maintenance_action_events from public,anon,authenticated;
grant select on public.maintenance_actions,public.maintenance_action_events to authenticated;
drop policy if exists maintenance_actions_read on public.maintenance_actions;
create policy maintenance_actions_read on public.maintenance_actions for select to authenticated using(public.workspace_role(workspace_id) is not null);
drop policy if exists maintenance_events_read on public.maintenance_action_events;
create policy maintenance_events_read on public.maintenance_action_events for select to authenticated using(public.workspace_role(workspace_id) is not null);
create or replace function public.read_maintenance_actions(w uuid,equipment_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null or public.workspace_role(w) is null then raise exception 'Lecture refusée';end if;
 return (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]') from public.maintenance_actions a where a.workspace_id=w and a.equipment_id=$2);
end$$;
create or replace function public.save_maintenance_action(w uuid,action jsonb,expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.maintenance_actions; old public.maintenance_actions; aid uuid;begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 if expected_revision is null or expected_revision<0 then raise exception 'Révision requise';end if;
 aid:=(action->>'id')::uuid; perform pg_advisory_xact_lock(hashtextextended(w::text||aid::text,0));
 select * into old from public.maintenance_actions where workspace_id=w and id=aid for update;
 if found and (old.revision<>expected_revision or old.status='done' or old.equipment_id<>action->>'equipment_id') then raise exception 'Action modifiée entre-temps ou déjà réalisée : actualisez le carnet';end if;
 if old.id is null and expected_revision<>0 then raise exception 'Action inconnue';end if;
 if action->>'status' not in ('todo','in_progress') or action->>'status' is null then raise exception 'État invalide';end if;
 insert into public.maintenance_actions(workspace_id,id,equipment_id,title,plan,source,reference,responsible,priority,status,due_date)
 values(w,aid,action->>'equipment_id',action->>'title',action->>'plan',action->>'source',coalesce(action->>'reference',''),coalesce(action->>'responsible',''),action->>'priority',action->>'status',nullif(action->>'due_date','')::date)
 on conflict(workspace_id,id) do update set title=excluded.title,plan=excluded.plan,source=excluded.source,reference=excluded.reference,responsible=excluded.responsible,priority=excluded.priority,status=excluded.status,due_date=excluded.due_date,revision=maintenance_actions.revision+1,updated_at=now()
 returning * into a;
 insert into public.maintenance_action_events(workspace_id,action_id,revision,snapshot,actor) values(w,aid,a.revision,to_jsonb(a),auth.uid());
 return to_jsonb(a);
end$$;
create or replace function public.complete_maintenance_action(w uuid,action_id uuid,expected_revision integer,entry jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.maintenance_actions; saved jsonb;begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 if expected_revision is null or expected_revision<1 then raise exception 'Révision requise';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||action_id::text,0));
 select * into a from public.maintenance_actions where workspace_id=w and id=action_id for update;
 if not found then raise exception 'Action inconnue';end if;
 if entry->>'equipment_id' is distinct from a.equipment_id or entry->>'kind' is distinct from 'Réparation' then raise exception 'Intervention incompatible';end if;
 if a.status='done' then
  if a.completed_entry_id is distinct from (entry->>'id')::uuid then raise exception 'Action déjà réalisée';end if;
  saved:=public.add_equipment_maintenance(w,entry);return to_jsonb(a);
 end if;
 if a.revision<>expected_revision then raise exception 'Action modifiée entre-temps : actualisez le carnet';end if;
 if exists(select 1 from public.equipment_maintenance m where m.workspace_id=w and m.id=(entry->>'id')::uuid) then raise exception 'Intervention déjà utilisée';end if;
 saved:=public.add_equipment_maintenance(w,entry);
 update public.maintenance_actions set status='done',completed_entry_id=(entry->>'id')::uuid,revision=revision+1,updated_at=now() where workspace_id=w and id=action_id returning * into a;
 insert into public.maintenance_action_events(workspace_id,action_id,revision,snapshot,actor) values(w,action_id,a.revision,to_jsonb(a),auth.uid());
 return to_jsonb(a);
end$$;
revoke all on function public.read_maintenance_actions(uuid,text),public.save_maintenance_action(uuid,jsonb,integer),public.complete_maintenance_action(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.read_maintenance_actions(uuid,text),public.save_maintenance_action(uuid,jsonb,integer),public.complete_maintenance_action(uuid,uuid,integer,jsonb) to authenticated;
commit;
