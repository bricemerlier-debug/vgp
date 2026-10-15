-- Après 013 : toutes les actions du carnet appartiennent au même répertoire PA.
begin;
-- Les anciennes entrées restent intactes ; chaque entrée non liée reçoit une fiche PA réalisée.
insert into public.maintenance_actions(workspace_id,id,equipment_id,title,plan,source,reference,responsible,priority,status,completed_entry_id,action_date,created_at,updated_at)
select m.workspace_id,gen_random_uuid(),m.equipment_id,m.kind||' · '||m.date::text,m.comment,'Manuel','Historique du carnet de maintenance',m.author,'normal','done',m.id,m.date,m.created_at,m.created_at
from public.equipment_maintenance m where not exists(select 1 from public.maintenance_actions a where a.workspace_id=m.workspace_id and a.completed_entry_id=m.id)
order by m.created_at,m.id
on conflict(workspace_id,completed_entry_id) do nothing;
create or replace function public.add_completed_maintenance_action(w uuid,entry jsonb,action jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare aid uuid; a public.maintenance_actions; saved jsonb; grade integer;begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Écriture refusée';end if;
 aid:=(action->>'id')::uuid;grade:=nullif(action->>'level','')::integer;
 if aid is null or nullif(btrim(action->>'title'),'') is null or length(action->>'title')>200 or (grade is not null and grade not between 1 and 3) then raise exception 'Action de maintenance invalide';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||aid::text,0));
 select * into a from public.maintenance_actions where workspace_id=w and id=aid for update;
 if found then
  if a.status is distinct from 'done' or a.completed_entry_id is distinct from (entry->>'id')::uuid or a.equipment_id is distinct from entry->>'equipment_id' or a.title is distinct from action->>'title' or a.level is distinct from grade then raise exception 'Cette action est déjà enregistrée avec un autre contenu';end if;
  saved:=public.add_equipment_maintenance(w,entry);return to_jsonb(a);
 end if;
 if exists(select 1 from public.equipment_maintenance m where m.workspace_id=w and m.id=(entry->>'id')::uuid) then raise exception 'Cette entrée de maintenance est déjà enregistrée';end if;
 saved:=public.add_equipment_maintenance(w,entry);
 insert into public.maintenance_actions(workspace_id,id,equipment_id,title,plan,source,reference,responsible,priority,status,completed_entry_id,level,action_date)
 values(w,aid,entry->>'equipment_id',action->>'title',entry->>'comment','Manuel','',entry->>'author',case grade when 1 then 'high' when 2 then 'normal' when 3 then 'low' else 'normal' end,'done',(entry->>'id')::uuid,grade,(entry->>'date')::date) returning * into a;
 insert into public.maintenance_action_events(workspace_id,action_id,revision,snapshot,actor) values(w,aid,a.revision,to_jsonb(a),auth.uid());
 return to_jsonb(a);
end$$;
revoke all on function public.add_completed_maintenance_action(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.add_completed_maintenance_action(uuid,jsonb,jsonb) to authenticated;
commit;
