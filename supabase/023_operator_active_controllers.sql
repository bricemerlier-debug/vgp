-- À exécuter après 022_operator_controllers.sql.
-- Seuls les trois contrôleurs actifs peuvent être choisis depuis le portail opérateur.
begin;
create or replace function public.operator_container_controllers(payload jsonb) returns jsonb
language sql stable set search_path='' as $$
 select '["Stéphane G.","Laurent B.","Friedlander"]'::jsonb
$$;
revoke all on function public.operator_container_controllers(jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
