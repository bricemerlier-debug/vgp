-- Après 015 : laisser davantage de temps à l'écriture ciblée des contenants.
-- Les verrous concurrents échouent rapidement pour être distingués des calculs lents.
-- Aucune donnée ni règle d'accès n'est modifiée.
begin;
do $$begin
 if to_regprocedure('public.write_containers(uuid,bigint,jsonb)') is null then
  raise exception 'Installer supabase/015_container_fast_writes.sql avant ce script.';
 end if;
end$$;
alter function public.write_containers(uuid,bigint,jsonb) set statement_timeout = '90s';
alter function public.write_containers(uuid,bigint,jsonb) set lock_timeout = '5s';
commit;
