-- Import APAVE additif. Après 001, 003 et 004. À installer via SQL Editor.
-- Aucun rapport ou contrôle métier n'est importé par ce script.
begin;
create table if not exists public.apave_reports(
 workspace_id uuid not null references public.workspaces(id),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 report_number text not null check(length(report_number) between 1 and 100),
 storage_path text not null,
 page_count integer not null check(page_count between 1 and 1200),
 byte_size bigint not null check(byte_size between 5 and 104857600),
 file_name text not null,
 imported_at timestamptz not null default now(),
 imported_by uuid not null references auth.users(id),
 primary key(workspace_id,sha256),unique(workspace_id,report_number),
 check(storage_path=workspace_id::text||'/'||sha256||'.pdf')
);
create table if not exists public.apave_checks(
 workspace_id uuid not null,
 report_hash text not null,
 source_key text not null check(length(source_key) between 1 and 100),
 equipment_id text not null,
 control_id text,
 details jsonb not null,
 primary key(workspace_id,report_hash,source_key),
 foreign key(workspace_id,report_hash) references public.apave_reports(workspace_id,sha256),
 foreign key(workspace_id,equipment_id) references public.equipment(workspace_id,id),
 unique(workspace_id,control_id)
);
create unique index if not exists apave_one_performed_check_per_equipment on public.apave_checks(workspace_id,report_hash,equipment_id) where control_id is not null;
alter table public.apave_reports enable row level security;
alter table public.apave_checks enable row level security;
drop policy if exists member_read on public.apave_reports;
create policy member_read on public.apave_reports for select to authenticated using(public.workspace_role(workspace_id) is not null);
drop policy if exists member_read on public.apave_checks;
create policy member_read on public.apave_checks for select to authenticated using(public.workspace_role(workspace_id) is not null);
revoke all on public.apave_reports,public.apave_checks from public,anon,authenticated;
grant select on public.apave_reports,public.apave_checks to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('apave-reports','apave-reports',false,104857600,array['application/pdf']) on conflict(id) do nothing;
do $$begin if exists(select 1 from storage.buckets where id='apave-reports' and public) then raise exception 'Le bucket apave-reports doit être privé';end if;end$$;
create or replace function public.apave_storage_access(object_name text, writing boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare wid uuid;r text;
begin
if auth.uid() is null or object_name !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{64}\.pdf$' then return false;end if;
wid:=split_part(object_name,'/',1)::uuid;r:=public.workspace_role(wid);
return coalesce(case when writing then r in ('admin','editor') else r in ('admin','editor','reader') end,false);
end$$;
revoke all on function public.apave_storage_access(text,boolean) from public;
grant execute on function public.apave_storage_access(text,boolean) to anon,authenticated;
drop policy if exists apave_read on storage.objects;
create policy apave_read on storage.objects for select to authenticated using(bucket_id='apave-reports' and public.apave_storage_access(name,false));
drop policy if exists apave_upload on storage.objects;
create policy apave_upload on storage.objects for insert to authenticated with check(bucket_id='apave-reports' and public.apave_storage_access(name,true));
-- Restrict this bucket even if another pre-existing permissive storage policy is broad.
drop policy if exists apave_member_boundary on storage.objects;
create policy apave_member_boundary on storage.objects as restrictive for select to public using(bucket_id<>'apave-reports' or public.apave_storage_access(name,false));
drop policy if exists apave_upload_boundary on storage.objects;
create policy apave_upload_boundary on storage.objects as restrictive for insert to public with check(bucket_id<>'apave-reports' or public.apave_storage_access(name,true));
drop policy if exists apave_no_update on storage.objects;
create policy apave_no_update on storage.objects as restrictive for update to public using(bucket_id<>'apave-reports') with check(bucket_id<>'apave-reports');
drop policy if exists apave_no_delete on storage.objects;
create policy apave_no_delete on storage.objects as restrictive for delete to public using(bucket_id<>'apave-reports');

-- Protect APAVE snapshots against old clients and ordinary write_state calls.
create or replace function public.guard_apave_state() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_e jsonb;e jsonb;a jsonb;c jsonb;r jsonb;equipment_map jsonb;begin
select coalesce(jsonb_object_agg(x.value->>'id',x.value),'{}') into equipment_map from jsonb_array_elements(new.payload->'equipment') x;
if not coalesce(new.payload->'apaveReports','[]') @> coalesce(old.payload->'apaveReports','[]') then raise exception 'Historique APAVE immuable : recharger le site';end if;
for old_e in select value from jsonb_array_elements(old.payload->'equipment') loop
e:=equipment_map->(old_e->>'id');
if not coalesce(e->'apaveChecks','[]') @> coalesce(old_e->'apaveChecks','[]') then raise exception 'Constats APAVE immuables';end if;
end loop;
for r in select value from jsonb_array_elements(coalesce(new.payload->'apaveReports','[]')) loop
if not exists(select 1 from public.apave_reports p where p.workspace_id=new.workspace_id and p.sha256=r->>'sha256' and p.report_number=r->>'reportNumber' and p.storage_path=r->>'path' and p.page_count=(r->>'pageCount')::integer and p.byte_size=(r->>'size')::bigint) then raise exception 'Rapport APAVE non enregistré';end if;
end loop;
if (select count(*)<>count(distinct (a.value->>'reportHash',a.value->>'sourceKey')) from jsonb_array_elements(new.payload->'equipment') e cross join lateral jsonb_array_elements(coalesce(e.value->'apaveChecks','[]')) a) then raise exception 'Constat APAVE dupliqué';end if;
for e in select value from jsonb_array_elements(new.payload->'equipment') loop
for a in select value from jsonb_array_elements(coalesce(e->'apaveChecks','[]')) loop
if not exists(select 1 from public.apave_checks p where p.workspace_id=new.workspace_id and p.equipment_id=e->>'id' and p.report_hash=a->>'reportHash' and p.source_key=a->>'sourceKey' and p.details=a) then raise exception 'Constat APAVE non enregistré ou modifié';end if;
if not exists(select 1 from jsonb_array_elements(coalesce(new.payload->'apaveReports','[]')) r where r.value->>'sha256'=a->>'reportHash') then raise exception 'Référence APAVE manquante';end if;
if a->>'controlId' is not null and not exists(select 1 from jsonb_array_elements(e->'controls') c where c.value->>'id'=a->>'controlId' and c.value->'apave'->>'sourceKey'=a->>'sourceKey' and c.value->'apave'->>'reportHash'=a->>'reportHash') then raise exception 'Contrôle APAVE manquant';end if;
end loop;
for c in select value from jsonb_array_elements(e->'controls') where value->'apave' is not null loop
if not exists(select 1 from public.apave_checks p where p.workspace_id=new.workspace_id and p.equipment_id=e->>'id' and p.control_id=c->>'id' and p.report_hash=c->'apave'->>'reportHash' and p.source_key=c->'apave'->>'sourceKey' and p.details->>'state'='verified' and p.details->>'normalizedResult'=c->>'result' and p.details->>'date'=c->>'date' and p.details->>'verifier'=c->>'intervenant' and p.details->>'observations'=c->>'observations' and c->'apave'=jsonb_build_object('reportHash',p.report_hash,'reportNumber',p.details->'reportNumber','sourceKey',p.source_key,'pages',p.details->'pages')) then raise exception 'Un constat non vérifié ou partiel ne valide pas un contrôle complet';end if;
end loop;
end loop;
return new;end$$;
revoke all on function public.guard_apave_state() from public,anon,authenticated;
drop trigger if exists apave_state_guard on public.workspace_state;
create trigger apave_state_guard before update on public.workspace_state for each row execute function public.guard_apave_state();

create or replace function public.import_apave(w uuid,expected_revision bigint,document jsonb,report jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.workspace_state;p public.apave_reports;e jsonb;a jsonb;previous jsonb;c jsonb;total integer:=0;n integer;result jsonb;hash text:=report->>'sha256';begin
if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Import APAVE refusé';end if;
select * into s from public.workspace_state where workspace_id=w for update;
if not found or s.revision is distinct from expected_revision then raise exception 'REVISION_CONFLICT : rechargez avant de réessayer';end if;
if hash is null or hash !~ '^[a-f0-9]{64}$' or report->>'path' is distinct from w::text||'/'||hash||'.pdf' then raise exception 'Référence PDF invalide';end if;
if not exists(select 1 from storage.objects o where o.bucket_id='apave-reports' and o.name=report->>'path' and (o.metadata->>'size')::bigint=(report->>'size')::bigint and o.metadata->>'mimetype'='application/pdf') then raise exception 'Le PDF original doit exister dans le stockage privé';end if;
insert into public.apave_reports(workspace_id,sha256,report_number,storage_path,page_count,byte_size,file_name,imported_by)
values(w,hash,report->>'reportNumber',report->>'path',(report->>'pageCount')::integer,(report->>'size')::bigint,left(report->>'fileName',300),auth.uid()) on conflict(workspace_id,sha256) do nothing;
select * into p from public.apave_reports where workspace_id=w and sha256=hash;
if p.report_number is distinct from report->>'reportNumber' or p.page_count is distinct from (report->>'pageCount')::integer or p.byte_size is distinct from (report->>'size')::bigint then raise exception 'Rapport déjà enregistré avec d’autres métadonnées';end if;
for e in select value from jsonb_array_elements(document->'equipment') loop
for a in select value from jsonb_array_elements(coalesce(e->'apaveChecks','[]')) where value->>'reportHash'=hash loop
select details into previous from public.apave_checks where workspace_id=w and report_hash=hash and source_key=a->>'sourceKey';
if found then if previous is distinct from a then raise exception 'Constat déjà importé';end if;continue;end if;
if a->>'reportNumber' is distinct from p.report_number or a->>'reviewedById' is distinct from auth.uid()::text or nullif(trim(a->>'reviewedBy'),'') is null or a->>'reviewedAt' is null or a->>'state' is null or a->>'state' not in ('verified','partial','not_verified','unknown') then raise exception 'Validation humaine APAVE manquante';end if;
perform (a->>'reviewedAt')::timestamptz;
if jsonb_typeof(a->'pages') is distinct from 'array' or jsonb_array_length(a->'pages')<1 or exists(select 1 from jsonb_array_elements_text(a->'pages') pg where pg.value !~ '^\d+$' or pg.value::integer not between 1 and p.page_count) then raise exception 'Pages APAVE invalides';end if;
if a->>'state'='not_verified' and (a->>'date' is not null or a->>'controlId' is not null or a->>'normalizedResult' is not null) then raise exception 'Un équipement non vérifié ne compte pas comme contrôlé';end if;
if a->>'controlId' is not null then
if a->>'state'<>'verified' or nullif(trim(a->>'verifier'),'') is null or a->>'date' is null or jsonb_typeof(a->'issues') is distinct from 'array' or jsonb_array_length(a->'issues')<>0 or coalesce((e->>'archived')::boolean,false) or coalesce((e->>'needsReverification')::boolean,false) then raise exception 'Vérification APAVE incomplète : constat uniquement';end if;
if a->>'normalizedResult' is null or a->>'normalizedResult' not in ('Bon état','Mauvais état — réparable','Mauvais état — à jeter') then raise exception 'Choisissez explicitement le résultat métier';end if;
if exists(select 1 from public.controls c where c.workspace_id=w and c.equipment_id=e->>'id' and c.performed_on=(a->>'date')::date and lower(trim(c.verifier))=lower(trim(a->>'verifier'))) then raise exception 'Un contrôle de ce vérificateur existe déjà à cette date pour ce matériel';end if;
end if;
insert into public.apave_checks values(w,hash,a->>'sourceKey',e->>'id',a->>'controlId',a);total:=total+1;
end loop;end loop;
if total=0 then raise exception 'Aucun nouveau constat APAVE : import déjà effectué';end if;
result:=public.write_state(w,expected_revision,document,null);
return result||jsonb_build_object('apave_checks',total);
end$$;
revoke all on function public.import_apave(uuid,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.import_apave(uuid,bigint,jsonb,jsonb) to authenticated;
create or replace function public.apave_ready(w uuid) returns boolean
language sql stable security definer set search_path='' as $$
select auth.uid() is not null and public.workspace_role(w) is not null
and exists(select 1 from storage.buckets where id='apave-reports' and not public)
and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.workspace_state'::regclass and tgname='apave_state_guard' and tgenabled in ('O','A'))
and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.workspace_state'::regclass and tgname='tracking_state_guard' and tgenabled in ('O','A'));
$$;
revoke all on function public.apave_ready(uuid) from public,anon;
grant execute on function public.apave_ready(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
