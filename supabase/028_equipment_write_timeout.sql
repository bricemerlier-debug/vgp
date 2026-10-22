-- Après 027 : donner à l'enregistrement VGP le même délai maîtrisé
-- que celui déjà configuré pour les écritures des contenants.
-- Ne modifie aucune fiche, aucun contrôle et aucun droit.
begin;
do $$begin
 if to_regprocedure('public.write_state(uuid,bigint,jsonb,text)') is null
    or position('old_equipment_map' in pg_get_functiondef('public.write_state(uuid,bigint,jsonb,text)'::regprocedure)) = 0 then
  raise exception 'Installer supabase/027_equipment_fast_save.sql avant ce script.';
 end if;
end$$;
alter function public.write_state(uuid,bigint,jsonb,text) set statement_timeout = '45s';
alter function public.write_state(uuid,bigint,jsonb,text) set lock_timeout = '5s';
commit;

-- Le résultat doit contenir statement_timeout=45s et lock_timeout=5s.
select proconfig from pg_proc
where oid = 'public.write_state(uuid,bigint,jsonb,text)'::regprocedure;
