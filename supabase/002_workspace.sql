-- Après invitation et création du compte dans Authentication > Users.
-- Remplacer l'UUID utilisateur ci-dessous ; ne pas mettre de mot de passe ici.
begin;
with w as (insert into public.workspaces(name) values('Métrologie') returning id)
insert into public.workspace_members(workspace_id,user_id,role)
select id,'REMPLACER_PAR_UUID_UTILISATEUR'::uuid,'admin' from w;
insert into public.workspace_state(workspace_id) select id from public.workspaces where id not in(select workspace_id from public.workspace_state);
insert into public.reminder_settings(workspace_id) select id from public.workspaces where id not in(select workspace_id from public.reminder_settings);
commit;
select id,name from public.workspaces; -- Cet ID public va dans cloud-config.js.
-- Autre utilisateur invité (PC/téléphone avec le même compte : aucune ligne supplémentaire) :
-- insert into public.workspace_members values('UUID_ESPACE','UUID_UTILISATEUR','editor');
-- Rôles possibles : admin, editor, reader. L'inscription seule ne donne aucun accès.
