-- Après 012 : reports justifiés, date initiale conservée, lecture globale du carnet.
begin;
alter table public.maintenance_actions add column if not exists initial_due_date date;
alter table public.maintenance_actions add column if not exists deferrals jsonb not null default '[]'::jsonb check(jsonb_typeof(deferrals)='array');
update public.maintenance_actions set initial_due_date=due_date where initial_due_date is null and due_date is not null;
alter table public.maintenance_actions add column if not exists annual_cap_previous_due_date date;
alter table public.maintenance_actions add column if not exists annual_cap_applied_at timestamptz;
-- Nouvelle consigne annuelle : plafonner uniquement les actions ouvertes sans report justifié.
-- La date antérieure reste dans initial_due_date et annual_cap_previous_due_date.
update public.maintenance_actions set annual_cap_previous_due_date=due_date,annual_cap_applied_at=now(),due_date=make_date(extract(year from created_at at time zone 'Europe/Paris')::int,12,31),revision=revision+1,updated_at=now()
where status<>'done' and level between 1 and 3 and deferrals='[]'::jsonb and due_date>make_date(extract(year from created_at at time zone 'Europe/Paris')::int,12,31);
create or replace function public.maintenance_action_baseline() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='UPDATE' and old.initial_due_date is not null then new.initial_due_date:=old.initial_due_date;
 elsif new.initial_due_date is null then new.initial_due_date:=new.due_date;end if;
 return new;
end$$;
revoke all on function public.maintenance_action_baseline() from public,anon,authenticated;
drop trigger if exists maintenance_action_baseline on public.maintenance_actions;
create trigger maintenance_action_baseline before insert or update on public.maintenance_actions for each row execute function public.maintenance_action_baseline();
create or replace function public.save_maintenance_action(w uuid,action jsonb,expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.maintenance_actions; old public.maintenance_actions; aid uuid; action_level integer; start_date date; deadline date;begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 if expected_revision is null or expected_revision<0 then raise exception 'Révision requise';end if;
 action_level:=(action->>'level')::integer; start_date:=(action->>'action_date')::date;
 if action_level is null or action_level not between 1 and 3 or start_date is null or start_date<'1900-01-01'::date or start_date>(now() at time zone 'Europe/Paris')::date then raise exception 'Niveau et date du constat requis';end if;
 aid:=(action->>'id')::uuid; perform pg_advisory_xact_lock(hashtextextended(w::text||aid::text,0));
 select * into old from public.maintenance_actions where workspace_id=w and id=aid for update;
 if action_level=1 then deadline:=start_date;elsif action_level=2 then deadline:=least((start_date+interval '6 months')::date,make_date(extract(year from (coalesce(old.created_at,now()) at time zone 'Europe/Paris'))::int,12,31));else deadline:=make_date(extract(year from (coalesce(old.created_at,now()) at time zone 'Europe/Paris'))::integer,12,31);end if;
 if found and (old.revision<>expected_revision or old.status='done' or old.equipment_id<>action->>'equipment_id') then raise exception 'Action modifiée entre-temps ou déjà réalisée : actualisez le carnet';end if;
 if old.id is not null and old.level is not null then
  if old.level is distinct from action_level or old.action_date is distinct from start_date then raise exception 'La date du constat et le niveau sont conservés. Utilisez un report justifié pour modifier l’échéance';end if;
  deadline:=old.due_date;
 end if;
 if old.id is null and expected_revision<>0 then raise exception 'Action inconnue';end if;
 if action->>'status' not in ('todo','in_progress') or action->>'status' is null then raise exception 'État invalide';end if;
 insert into public.maintenance_actions(workspace_id,id,equipment_id,title,plan,source,reference,responsible,priority,status,due_date,level,action_date)
 values(w,aid,action->>'equipment_id',action->>'title',action->>'plan',action->>'source',coalesce(action->>'reference',''),coalesce(action->>'responsible',''),case action_level when 1 then 'high' when 2 then 'normal' else 'low' end,action->>'status',deadline,action_level,start_date)
 on conflict(workspace_id,id) do update set title=excluded.title,plan=excluded.plan,source=excluded.source,reference=excluded.reference,responsible=excluded.responsible,priority=excluded.priority,status=excluded.status,due_date=excluded.due_date,level=excluded.level,action_date=excluded.action_date,revision=maintenance_actions.revision+1,updated_at=now()
 returning * into a;
 insert into public.maintenance_action_events(workspace_id,action_id,revision,snapshot,actor) values(w,aid,a.revision,to_jsonb(a),auth.uid());
 return to_jsonb(a);
end$$;

create or replace function public.postpone_maintenance_action(w uuid,action_id uuid,expected_revision integer,request_id uuid,new_due_date date,justification text,declared_by text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.maintenance_actions; prior jsonb; event jsonb;begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 if request_id is null or new_due_date is null or justification is null or length(btrim(justification)) not between 1 and 5000 or declared_by is null or length(btrim(declared_by)) not between 1 and 160 then raise exception 'Nouvelle date et justification obligatoires';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||action_id::text,0));
 select * into a from public.maintenance_actions where workspace_id=w and id=action_id for update;
 if not found then raise exception 'Action inconnue';end if;
 select value into prior from jsonb_array_elements(a.deferrals) where value->>'id'=request_id::text;
 if found then
  if prior->>'new_due_date' is distinct from new_due_date::text or prior->>'justification' is distinct from btrim(justification) or prior->>'declared_by' is distinct from btrim(declared_by) then raise exception 'Cette demande a déjà un autre contenu';end if;
  return to_jsonb(a);
 end if;
 if expected_revision is null or a.revision<>expected_revision then raise exception 'Action modifiée entre-temps : actualisez le carnet';end if;
 if a.status='done' then raise exception 'Une action réalisée ne peut pas être reportée';end if;
 if new_due_date<(now() at time zone 'Europe/Paris')::date or (a.due_date is not null and new_due_date<=a.due_date) then raise exception 'La nouvelle date doit être à venir et postérieure à l’échéance actuelle';end if;
 event:=jsonb_build_object('id',request_id,'previous_due_date',a.due_date,'new_due_date',new_due_date,'justification',btrim(justification),'declared_by',btrim(declared_by),'actor',auth.uid(),'at',now());
 update public.maintenance_actions set due_date=new_due_date,deferrals=deferrals||jsonb_build_array(event),revision=revision+1,updated_at=now() where workspace_id=w and id=action_id returning * into a;
 insert into public.maintenance_action_events(workspace_id,action_id,revision,snapshot,actor) values(w,action_id,a.revision,to_jsonb(a),auth.uid());
 return to_jsonb(a);
end$$;
create or replace function public.read_maintenance_dashboard(w uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null or public.workspace_role(w) is null then raise exception 'Lecture refusée';end if;
 return jsonb_build_object('actions',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.maintenance_actions a where a.workspace_id=w),'entries',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'equipment_id',m.equipment_id,'date',m.date,'kind',m.kind,'author',m.author)),'[]') from public.equipment_maintenance m where m.workspace_id=w));
end$$;
revoke all on function public.postpone_maintenance_action(uuid,uuid,integer,uuid,date,text,text),public.read_maintenance_dashboard(uuid) from public,anon;
grant execute on function public.postpone_maintenance_action(uuid,uuid,integer,uuid,date,text,text),public.read_maintenance_dashboard(uuid) to authenticated;
create or replace function public.save_maintenance_action_v3(w uuid,action jsonb,expected_revision integer) returns jsonb
language sql security invoker set search_path='' as $$select public.save_maintenance_action(w,action,expected_revision)$$;
create or replace function public.import_apave_maintenance_actions_v2(w uuid,items jsonb) returns jsonb
language sql security invoker set search_path='' as $$select public.import_apave_maintenance_actions(w,items)$$;
revoke all on function public.save_maintenance_action_v3(uuid,jsonb,integer),public.import_apave_maintenance_actions_v2(uuid,jsonb) from public,anon;
grant execute on function public.save_maintenance_action_v3(uuid,jsonb,integer),public.import_apave_maintenance_actions_v2(uuid,jsonb) to authenticated;
commit;
