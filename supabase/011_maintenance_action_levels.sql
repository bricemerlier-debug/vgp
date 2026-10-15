-- Après 010 : numéro permanent par parc, niveaux et délais calculés côté serveur.
begin;
create table if not exists public.maintenance_action_counters(workspace_id uuid primary key references public.workspaces(id),last_number bigint not null);
alter table public.maintenance_action_counters enable row level security;
revoke all on public.maintenance_action_counters from public,anon,authenticated;
alter table public.maintenance_actions add column if not exists action_number bigint;
alter table public.maintenance_actions add column if not exists level integer check(level between 1 and 3);
alter table public.maintenance_actions add column if not exists action_date date;
-- Numéroter aussi les actions déjà présentes, dans l’ordre de création.
with numbered as(select workspace_id,id,row_number() over(partition by workspace_id order by created_at,id) n from public.maintenance_actions)
update public.maintenance_actions a set action_number=n.n from numbered n where a.workspace_id=n.workspace_id and a.id=n.id and a.action_number is null;
insert into public.maintenance_action_counters select workspace_id,max(action_number) from public.maintenance_actions group by workspace_id
on conflict(workspace_id) do update set last_number=greatest(maintenance_action_counters.last_number,excluded.last_number);
alter table public.maintenance_actions alter column action_number set not null;
create unique index if not exists maintenance_action_number_unique on public.maintenance_actions(workspace_id,action_number);
create or replace function public.assign_maintenance_action_number() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' then
 insert into public.maintenance_action_counters values(new.workspace_id,1) on conflict(workspace_id) do update set last_number=maintenance_action_counters.last_number+1 returning last_number into new.action_number;
 else new.action_number:=old.action_number;end if;
 return new;
end$$;
revoke all on function public.assign_maintenance_action_number() from public,anon,authenticated;
drop trigger if exists maintenance_action_number on public.maintenance_actions;
create trigger maintenance_action_number before insert or update on public.maintenance_actions for each row execute function public.assign_maintenance_action_number();
create or replace function public.save_maintenance_action(w uuid,action jsonb,expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.maintenance_actions; old public.maintenance_actions; aid uuid; action_level integer; start_date date; deadline date;begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 if expected_revision is null or expected_revision<0 then raise exception 'Révision requise';end if;
 action_level:=(action->>'level')::integer; start_date:=(action->>'action_date')::date;
 if action_level is null or action_level not between 1 and 3 or start_date is null or start_date<'1900-01-01'::date or start_date>(now() at time zone 'Europe/Paris')::date then raise exception 'Niveau et date du constat requis';end if;
 aid:=(action->>'id')::uuid; perform pg_advisory_xact_lock(hashtextextended(w::text||aid::text,0));
 select * into old from public.maintenance_actions where workspace_id=w and id=aid for update;
 if action_level=1 then deadline:=start_date;elsif action_level=2 then deadline:=(start_date+interval '6 months')::date;else deadline:=make_date(extract(year from (coalesce(old.created_at,now()) at time zone 'Europe/Paris'))::integer,12,31);end if;
 if found and (old.revision<>expected_revision or old.status='done' or old.equipment_id<>action->>'equipment_id') then raise exception 'Action modifiée entre-temps ou déjà réalisée : actualisez le carnet';end if;
 if old.id is null and expected_revision<>0 then raise exception 'Action inconnue';end if;
 if action->>'status' not in ('todo','in_progress') or action->>'status' is null then raise exception 'État invalide';end if;
 insert into public.maintenance_actions(workspace_id,id,equipment_id,title,plan,source,reference,responsible,priority,status,due_date,level,action_date)
 values(w,aid,action->>'equipment_id',action->>'title',action->>'plan',action->>'source',coalesce(action->>'reference',''),coalesce(action->>'responsible',''),case action_level when 1 then 'high' when 2 then 'normal' else 'low' end,action->>'status',deadline,action_level,start_date)
 on conflict(workspace_id,id) do update set title=excluded.title,plan=excluded.plan,source=excluded.source,reference=excluded.reference,responsible=excluded.responsible,priority=excluded.priority,status=excluded.status,due_date=excluded.due_date,level=excluded.level,action_date=excluded.action_date,revision=maintenance_actions.revision+1,updated_at=now()
 returning * into a;
 insert into public.maintenance_action_events(workspace_id,action_id,revision,snapshot,actor) values(w,aid,a.revision,to_jsonb(a),auth.uid());
 return to_jsonb(a);
end$$;
-- Point d’entrée versionné : un ancien serveur ne peut pas confirmer ces nouvelles règles.
create or replace function public.save_maintenance_action_v2(w uuid,action jsonb,expected_revision integer) returns jsonb
language sql security invoker set search_path='' as $$select public.save_maintenance_action(w,action,expected_revision)$$;
revoke all on function public.save_maintenance_action_v2(uuid,jsonb,integer) from public,anon;
grant execute on function public.save_maintenance_action_v2(uuid,jsonb,integer) to authenticated;
commit;
