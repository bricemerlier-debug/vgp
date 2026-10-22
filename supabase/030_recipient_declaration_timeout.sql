-- 030 : donner un délai dédié aux déclarations signées depuis les liens de mail.
-- Les protections métier contrôlent l'instantané VGP complet lors de son archivage.
-- Ce script ne modifie aucune fiche, aucun lien et aucun droit.
begin;
do $$begin
 if to_regprocedure('public.submit_recipient_declaration(text,text,text,text,jsonb,boolean)') is null
    or to_regprocedure('public.submit_equipment_loss(text,text,text,jsonb,boolean)') is null
    or to_regprocedure('public.submit_equipment_scrap(text,text,text,jsonb,boolean)') is null then
  raise exception 'Installer d’abord les scripts 024, 025 et 026 de déclaration destinataire.';
 end if;
end$$;

alter function public.submit_recipient_declaration(text,text,text,text,jsonb,boolean) set statement_timeout = '90s';
alter function public.submit_recipient_declaration(text,text,text,text,jsonb,boolean) set lock_timeout = '5s';
alter function public.submit_equipment_loss(text,text,text,jsonb,boolean) set statement_timeout = '90s';
alter function public.submit_equipment_loss(text,text,text,jsonb,boolean) set lock_timeout = '5s';
alter function public.submit_equipment_scrap(text,text,text,jsonb,boolean) set statement_timeout = '90s';
alter function public.submit_equipment_scrap(text,text,text,jsonb,boolean) set lock_timeout = '5s';
commit;

-- Vérifier que les trois fonctions portent bien le délai dédié.
select p.oid::regprocedure as fonction, p.proconfig
from pg_proc p
where p.oid in (
 'public.submit_recipient_declaration(text,text,text,text,jsonb,boolean)'::regprocedure,
 'public.submit_equipment_loss(text,text,text,jsonb,boolean)'::regprocedure,
 'public.submit_equipment_scrap(text,text,text,jsonb,boolean)'::regprocedure
)
order by 1::text;
