-- À examiner puis exécuter AVANT une mise en service de la version métier 2.
-- Additif : aucun équipement, contrôle, document ou commentaire n'est réécrit.
-- Compatible avec la version 1 tant qu'aucun état version 2 n'a été enregistré.
begin;
create or replace function public.guard_tracking_state() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_e jsonb; new_e jsonb; old_o jsonb; new_o jsonb; c jsonb;begin
if coalesce((old.payload->>'trackingVersion')::integer,1)>=2 and coalesce((new.payload->>'trackingVersion')::integer,1)<2 then raise exception 'Version du site périmée : recharger avant d’enregistrer';end if;
if coalesce((new.payload->>'trackingVersion')::integer,1)<2 then return new;end if;
for old_e in select value from jsonb_array_elements(old.payload->'equipment') loop
select value into new_e from jsonb_array_elements(new.payload->'equipment') where value->>'id'=old_e->>'id';
if new_e is null then raise exception 'Suppression d’équipement interdite';end if;
for old_o in select value from jsonb_array_elements(coalesce(old_e->'obligations','[]')) loop
select value into new_o from jsonb_array_elements(coalesce(new_e->'obligations','[]')) where value->>'id'=old_o->>'id';
if new_o is null then raise exception 'Échéance historique manquante : recharger le site';end if;
if (old_o - array['done','controlId','controlDate','excludedAt','excludedReason','excludedBy']) is distinct from (new_o - array['done','controlId','controlDate','excludedAt','excludedReason','excludedBy']) then raise exception 'Échéance historique immuable';end if;
if coalesce((old_o->>'done')::boolean,false) and (new_o->'done' is distinct from old_o->'done' or new_o->'controlId' is distinct from old_o->'controlId' or new_o->'controlDate' is distinct from old_o->'controlDate') then raise exception 'Réalisation historique immuable';end if;
if old_o->>'excludedAt' is not null and (new_o->'excludedAt' is distinct from old_o->'excludedAt' or new_o->'excludedReason' is distinct from old_o->'excludedReason') then raise exception 'Exclusion historique immuable';end if;
end loop;
if old_e->>'cycleControlId' is not null and old_e->>'cycleControlId'=new_e->>'cycleControlId' and old_e->'cycleDeadline' is distinct from new_e->'cycleDeadline' then raise exception 'Échéance du cycle actuel immuable';end if;
if not coalesce(new_e->'dateHistory','[]') @> coalesce(old_e->'dateHistory','[]') then raise exception 'Historique des dates incomplet';end if;
if not coalesce(new_e->'archiveHistory','[]') @> coalesce(old_e->'archiveHistory','[]') then raise exception 'Historique des archivages incomplet';end if;
end loop;
for new_e in select value from jsonb_array_elements(new.payload->'equipment') loop
if jsonb_typeof(new_e->'obligations') is distinct from 'array' or jsonb_typeof(new_e->'periodicityValidation'->'validated') is distinct from 'boolean' then raise exception 'Version du site périmée : métadonnées métier manquantes';end if;
for c in select value from jsonb_array_elements(new_e->'controls') loop
if not exists(select 1 from jsonb_array_elements(old.payload->'equipment') e cross join lateral jsonb_array_elements(e.value->'controls') x where x.value->>'id'=c->>'id') then
if c->>'result'='Introuvable' and not(old.revision=0 and public.workspace_role(new.workspace_id)='admin') then raise exception 'Introuvable doit être un événement d’archivage, pas un nouveau contrôle';end if;
if c->>'enteredById' is not null and c->>'enteredById'<>auth.uid()::text then raise exception 'Compte de saisie incorrect';end if;
if c->>'plannedDate' is not null and c->>'result'<>'Introuvable' and not exists(select 1 from jsonb_array_elements(coalesce(new_e->'obligations','[]')) o where o.value->>'date'=c->>'plannedDate' and o.value->>'controlId'=c->>'id' and (o.value->>'done')::boolean) then raise exception 'Contrôle non rattaché à son échéance';end if;
end if;
end loop;
for new_o in select value from jsonb_array_elements(coalesce(new_e->'obligations','[]')) loop
perform (new_o->>'date')::date;
if coalesce((new_o->>'done')::boolean,false) and not exists(select 1 from jsonb_array_elements(new_e->'controls') c where c.value->>'id'=new_o->>'controlId' and c.value->>'result' in ('Bon état','Mauvais état — réparable','Mauvais état — à jeter') and c.value->>'date'=new_o->>'controlDate' and c.value->>'plannedDate'=new_o->>'date' and btrim(coalesce(c.value->>'intervenant',''))<>'') then raise exception 'Réalisation d’échéance sans contrôle exploitable';end if;
end loop;
end loop;
return new;
end$$;
revoke all on function public.guard_tracking_state() from public,anon,authenticated;
drop trigger if exists tracking_state_guard on public.workspace_state;
create trigger tracking_state_guard before update of payload on public.workspace_state for each row execute function public.guard_tracking_state();
-- Le navigateur peut consulter les données avant l'installation, mais n'écrit
-- le format 2 qu'après confirmation de cette protection serveur.
create or replace function public.tracking_ready(w uuid) returns boolean
language sql stable security definer set search_path='' as $$
select auth.uid() is not null and public.workspace_role(w) is not null
and exists(select 1 from pg_catalog.pg_trigger t
where t.tgrelid='public.workspace_state'::regclass
and t.tgname='tracking_state_guard' and t.tgenabled in ('O','A')
and t.tgfoid='public.guard_tracking_state()'::regprocedure);
$$;
revoke all on function public.tracking_ready(uuid) from public,anon;
grant execute on function public.tracking_ready(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
