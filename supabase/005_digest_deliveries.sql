-- Journal serveur dédié aux bilans ; aucun droit d'écriture depuis le navigateur.
begin;
create table if not exists public.digest_deliveries (
 workspace_id uuid not null references public.workspaces(id),
 kind text not null check(kind in ('week','month')),
 period_start date not null,
 recipient text not null,
 status text not null check(status in ('processing','accepted','uncertain')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,kind,period_start)
);
alter table public.digest_deliveries enable row level security;
revoke all on public.digest_deliveries from anon,authenticated;
grant select on public.digest_deliveries to authenticated;
grant all on public.digest_deliveries to service_role;
drop policy if exists member_read on public.digest_deliveries;
create policy member_read on public.digest_deliveries for select to authenticated using(public.workspace_role(workspace_id) is not null);
commit;
