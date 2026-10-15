-- Planning 5×8 indépendant du parc VGP. Après 001_schema.sql.
-- Additif : aucune fiche, aucun contrôle et aucun workspace_state n'est modifié.
begin;
create table if not exists public.shift_calendar_state(workspace_id uuid primary key references public.workspaces(id),revision bigint not null default 0);
create table if not exists public.shift_calendar_imports(
 workspace_id uuid not null references public.workspaces(id),revision bigint not null,imported_at timestamptz not null default now(),imported_by uuid not null references auth.users(id),source jsonb not null,changes jsonb not null,primary key(workspace_id,revision)
);
create table if not exists public.shift_calendar_days(
 workspace_id uuid not null references public.workspaces(id),shift_date date not null check(shift_date>='2026-10-01' and shift_date<='2100-12-31'),team text not null check(team in ('A','B','C','D','E')),code text check(code in ('M','S','N','R','CP','JF','RTT','F')),starts_at timestamptz,ends_at timestamptz,source_cell text not null,import_revision bigint not null,
 primary key(workspace_id,shift_date,team),foreign key(workspace_id,import_revision) references public.shift_calendar_imports(workspace_id,revision),
 check((code in ('M','S','N') and starts_at is not null and ends_at is not null and ends_at>starts_at) or (coalesce(code,'') not in ('M','S','N') and starts_at is null and ends_at is null))
);
create unique index if not exists shift_calendar_one_team_per_slot on public.shift_calendar_days(workspace_id,shift_date,code) where code in ('M','S','N');
alter table public.shift_calendar_state enable row level security;
alter table public.shift_calendar_imports enable row level security;
alter table public.shift_calendar_days enable row level security;
drop policy if exists member_read on public.shift_calendar_state;
create policy member_read on public.shift_calendar_state for select to authenticated using(public.workspace_role(workspace_id) is not null);
drop policy if exists member_read on public.shift_calendar_imports;
create policy member_read on public.shift_calendar_imports for select to authenticated using(public.workspace_role(workspace_id) is not null);
drop policy if exists member_read on public.shift_calendar_days;
create policy member_read on public.shift_calendar_days for select to authenticated using(public.workspace_role(workspace_id) is not null);
revoke all on public.shift_calendar_state,public.shift_calendar_imports,public.shift_calendar_days from public,anon,authenticated;
grant select on public.shift_calendar_state,public.shift_calendar_imports,public.shift_calendar_days to authenticated;

create or replace function public.read_shift_calendar(w uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
if auth.uid() is null or public.workspace_role(w) is null then raise exception 'Lecture du planning refusée';end if;
return jsonb_build_object('revision',coalesce((select revision from public.shift_calendar_state where workspace_id=w),0),
'rows',coalesce((select jsonb_agg(jsonb_build_object('date',shift_date::text,'team',team,'code',code,'sourceCell',source_cell,'start',starts_at,'end',ends_at) order by shift_date,team) from public.shift_calendar_days where workspace_id=w),'[]'::jsonb),
'imports',coalesce((select jsonb_agg(to_jsonb(t) order by revision desc) from (select revision,imported_at,source,jsonb_array_length(changes) as changed from public.shift_calendar_imports where workspace_id=w order by revision desc limit 20) t),'[]'::jsonb));
end$$;
revoke all on function public.read_shift_calendar(uuid) from public,anon;
grant execute on function public.read_shift_calendar(uuid) to authenticated;

create or replace function public.import_shift_calendar(w uuid,expected_revision bigint,entries jsonb,source jsonb,replace_conflicts boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_revision bigint;next_revision bigint;conflicts integer;changes jsonb;begin
if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Import du planning refusé';end if;
if jsonb_typeof(entries) is distinct from 'array' or jsonb_array_length(entries) not between 1 and 20000 or octet_length(entries::text)>4000000 then raise exception 'Planning invalide ou trop volumineux';end if;
if source->>'sheet' is distinct from 'calendrier global' or source->>'sha256' is null or source->>'sha256' !~ '^[a-f0-9]{64}$' or length(coalesce(source->>'fileName','')) not between 1 and 300 or octet_length(source::text)>4000 then raise exception 'Source du planning invalide';end if;
if exists(select 1 from jsonb_array_elements(entries) x where jsonb_typeof(x.value)<>'object' or x.value->>'date' is null or x.value->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or (x.value->>'date')::date not between date '2026-10-01' and date '2100-12-31' or x.value->>'team' is null or x.value->>'team' not in ('A','B','C','D','E') or not (x.value ? 'code') or (x.value->>'code' is not null and x.value->>'code' not in ('M','S','N','R','CP','JF','RTT','F')) or x.value->>'sourceCell' is null or length(x.value->>'sourceCell')>50) then raise exception 'Affectation du planning invalide';end if;
if (select count(*)<>count(distinct (x.value->>'date',x.value->>'team')) from jsonb_array_elements(entries) x) then raise exception 'Date/équipe en double';end if;
if exists(select 1 from jsonb_array_elements(entries) x where x.value->>'code' in ('M','S','N') group by x.value->>'date',x.value->>'code' having count(*)>1) then raise exception 'Plusieurs équipes sur le même poste';end if;
insert into public.shift_calendar_state(workspace_id) values(w) on conflict do nothing;
select revision into current_revision from public.shift_calendar_state where workspace_id=w for update;
if current_revision is distinct from expected_revision then raise exception 'REVISION_CONFLICT : rechargez le planning et refaites l’aperçu';end if;
select count(*) into conflicts from jsonb_array_elements(entries) x join public.shift_calendar_days d on d.workspace_id=w and d.shift_date=(x.value->>'date')::date and d.team=x.value->>'team' where d.code is distinct from x.value->>'code';
if conflicts>0 and not coalesce(replace_conflicts,false) then raise exception 'Confirmez explicitement le remplacement des affectations contradictoires';end if;
select coalesce(jsonb_agg(jsonb_build_object('before',to_jsonb(d),'after',x.value)),'[]'::jsonb) into changes from jsonb_array_elements(entries) x left join public.shift_calendar_days d on d.workspace_id=w and d.shift_date=(x.value->>'date')::date and d.team=x.value->>'team' where d.team is null or d.code is distinct from x.value->>'code';
if jsonb_array_length(changes)=0 then return jsonb_build_object('revision',current_revision,'changed',0,'conflicts',0);end if;
next_revision:=current_revision+1;
insert into public.shift_calendar_imports(workspace_id,revision,imported_by,source,changes) values(w,next_revision,auth.uid(),source,changes);
-- Clear the time slots for changed rows before the bulk update, so a legitimate team swap
-- does not transiently violate the unique slot index. The transaction is atomic.
update public.shift_calendar_days d set code=null,starts_at=null,ends_at=null from jsonb_array_elements(changes) x where d.workspace_id=w and d.shift_date=(x.value->'after'->>'date')::date and d.team=x.value->'after'->>'team';
insert into public.shift_calendar_days(workspace_id,shift_date,team,code,starts_at,ends_at,source_cell,import_revision)
select w,(x.value->'after'->>'date')::date,x.value->'after'->>'team',x.value->'after'->>'code',
case x.value->'after'->>'code' when 'M' then ((x.value->'after'->>'date')::date+time '05:00') at time zone 'Europe/Paris' when 'S' then ((x.value->'after'->>'date')::date+time '13:00') at time zone 'Europe/Paris' when 'N' then ((x.value->'after'->>'date')::date+time '21:00') at time zone 'Europe/Paris' end,
case x.value->'after'->>'code' when 'M' then ((x.value->'after'->>'date')::date+time '13:00') at time zone 'Europe/Paris' when 'S' then ((x.value->'after'->>'date')::date+time '21:00') at time zone 'Europe/Paris' when 'N' then ((x.value->'after'->>'date')::date+1+time '05:00') at time zone 'Europe/Paris' end,
x.value->'after'->>'sourceCell',next_revision from jsonb_array_elements(changes) x
on conflict(workspace_id,shift_date,team) do update set code=excluded.code,starts_at=excluded.starts_at,ends_at=excluded.ends_at,source_cell=excluded.source_cell,import_revision=excluded.import_revision;
update public.shift_calendar_state set revision=next_revision where workspace_id=w;
return jsonb_build_object('revision',next_revision,'changed',jsonb_array_length(changes),'conflicts',conflicts);
end$$;
revoke all on function public.import_shift_calendar(uuid,bigint,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.import_shift_calendar(uuid,bigint,jsonb,jsonb,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
