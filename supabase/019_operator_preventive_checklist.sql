-- À exécuter après 018_operator_portal.sql.
-- La checklist du préventif suit les paramètres des catégories existantes.
begin;
create or replace function public.operator_container_checks(c jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare configured jsonb; code text;
begin
 configured:=c->'categoryChecks';
 if jsonb_typeof(configured)='array' and configured is distinct from to_jsonb(array['Relâche','Élastique','Pompe','Frein','Inter','Roues','Carter','Bâti','Visserie','Rivets','Poignée','Palier','Timon','Pignon','Chaîne','Sabot','Sangle','Tambour','Verrou','Protection ressort','Ressort','Coupelle','Bâche','Bavette','Manchon','Excentrique','Bague','Galet','Enroulement / déroulement','Pédale','Amortisseur','Verrouillage','Levier','Rétroviseur','Vérin']::text[]) then return configured;end if;
 code:=btrim(regexp_replace(upper(coalesce(c->>'subtype','')),'[^A-Z0-9]+',' ','g'));
 if code ~ '(^| )(R2|PLT2)( |$)' or code in ('PLI','PLI AMIENS') then return to_jsonb(array['Bâti','Galet','Butée','Flasque','Inter','Palier','Carter','Roue','Frein','Volant','Tambour','Enroulage','Rouleaux','Visserie']::text[]);end if;
 if code in ('PC','GDC','GDC PC') then return to_jsonb(array['Bâti','Sangle','Flasque','Inter enroulage','Rouleaux','Carter','Sabot','Volant','Tambour','Palier','Prise chariot','Visserie']::text[]);end if;
 return '[]'::jsonb;
end$$;
revoke all on function public.operator_container_checks(jsonb) from public,anon,authenticated;

create or replace function public.operator_portal_data(w uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.workspace_state; boxes jsonb; mine jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.workspace_members m where m.workspace_id=w and m.user_id=auth.uid() and m.role='operateur') then
  raise exception 'Accès opérateur refusé';
 end if;
 select * into s from public.workspace_state where workspace_id=w;
 if not found then raise exception 'Espace introuvable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.value->>'id','number',c.value->>'number','category',c.value->>'subtype','checks',public.operator_container_checks(c.value)) order by c.value->>'number'),'[]'::jsonb)
 into boxes from jsonb_array_elements(coalesce(s.payload->'containers','[]'::jsonb)) c
 where c.value->'manualArchive' is null and not exists(
  select 1 from jsonb_array_elements(coalesce(c.value->'interventions','[]'::jsonb)) i
  where i.value->>'type' in ('mise au rebut','rebut') or coalesce(i.value->>'comment','') ~* '(mis(e)? au rebut|mis(e)? en benne|destruction)'
 );
 select coalesce(jsonb_agg(jsonb_build_object('id',i.value->>'operatorEntryId','containerId',c.value->>'id',
  'containerNumber',c.value->>'number','category',c.value->>'subtype','number',i.value->>'number','date',i.value->>'date',
  'recordedAt',i.value->>'recordedAt','type',i.value->>'type','comment',i.value->>'comment',
  'corrections',coalesce(i.value->'operatorCorrections','[]'::jsonb),'parts',coalesce(i.value->'parts','{}'::jsonb),'checks',public.operator_container_checks(c.value),'checklistRecorded',coalesce((i.value->>'operatorChecklistRecorded')::boolean,false))
  order by coalesce(i.value->>'recordedAt',i.value->>'date') desc),'[]'::jsonb)
 into mine from jsonb_array_elements(coalesce(s.payload->'containers','[]'::jsonb)) c
 cross join lateral jsonb_array_elements(coalesce(c.value->'interventions','[]'::jsonb)) i
 where i.value->>'operatorId'=auth.uid()::text;
 return jsonb_build_object('containers',boxes,'interventions',mine,'operator',auth.uid()::text);
end$$;


create or replace function public.operator_save_intervention_v2(w uuid, request_id uuid, container_id text, kind text, comment text, intervention_id uuid, checked_parts jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.workspace_state; boxes jsonb; box jsonb; item jsonb; current_item jsonb; updated_item jsonb;
 box_index integer; item_index integer; next_number numeric; actor text; saved_at timestamptz:=now(); entry_id uuid; allowed_checks jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.workspace_members m where m.workspace_id=w and m.user_id=auth.uid() and m.role='operateur') then
  raise exception 'Écriture opérateur refusée';
 end if;
 if request_id is null or nullif(btrim(container_id),'') is null or kind not in ('préventif','curatif','sécurité')
    or comment is null or nullif(btrim(comment),'') is null or length(comment)>5000 then
  raise exception 'Renseignez un contenant, un type et un commentaire (5 000 caractères maximum)';
 end if;
 select * into s from public.workspace_state where workspace_id=w for update;
 if not found then raise exception 'Espace introuvable';end if;
 if exists(select 1 from public.migration_receipts where workspace_id=w and validated_at is null) then
  raise exception 'Migration en attente : enregistrement indisponible';
 end if;
 boxes:=coalesce(s.payload->'containers','[]'::jsonb);
 -- La même requête renvoie la même intervention, y compris après une réponse réseau perdue.
 for box in select value from jsonb_array_elements(boxes) loop
  for item in select value from jsonb_array_elements(coalesce(box->'interventions','[]'::jsonb)) loop
   if item->>'operatorLastRequestId'=request_id::text then
    if item->>'operatorId'<>auth.uid()::text then raise exception 'Intervention inaccessible';end if;
    return jsonb_build_object('id',item->>'operatorEntryId','number',item->>'number','revision',s.revision);
   end if;
  end loop;
 end loop;
 select c.value,c.ordinality::integer-1 into box,box_index
 from jsonb_array_elements(boxes) with ordinality c(value,ordinality)
 where c.value->>'id'=container_id;
 if box is null then raise exception 'Contenant introuvable';end if;
 allowed_checks:=public.operator_container_checks(box);
 if checked_parts is null or jsonb_typeof(checked_parts)<>'object' then raise exception 'Checklist invalide';end if;
 if kind<>'préventif' and checked_parts<>'{}'::jsonb then raise exception 'Checklist réservée au préventif';end if;
 if exists(select 1 from jsonb_each_text(checked_parts) p where p.value is distinct from 'Vérifié' or not allowed_checks ? p.key) then raise exception 'Point de contrôle inconnu';end if;
 actor:=coalesce((select u.email from auth.users u where u.id=auth.uid()),auth.uid()::text);
 if intervention_id is null then
  if box->'manualArchive' is not null or exists(select 1 from jsonb_array_elements(coalesce(box->'interventions','[]'::jsonb)) i where i.value->>'type' in ('mise au rebut','rebut') or coalesce(i.value->>'comment','') ~* '(mis(e)? au rebut|mis(e)? en benne|destruction)') then
   raise exception 'Ce contenant est archivé';
  end if;
  select coalesce(max((i.value->>'number')::numeric),0)+1 into next_number
  from jsonb_array_elements(boxes) c cross join lateral jsonb_array_elements(coalesce(c.value->'interventions','[]'::jsonb)) i
  where i.value->>'number' ~ '^[0-9]{1,20}$';
  if next_number>99999999999999999999 then raise exception 'Numérotation épuisée';end if;
  entry_id:=gen_random_uuid();
  updated_item:=jsonb_build_object('number',next_number::text,'date',(saved_at at time zone 'Europe/Paris')::date::text,
   'controller',actor,'type',kind,'generalState','','comment',btrim(comment),'parts',checked_parts,
   'operatorId',auth.uid()::text,'operatorEntryId',entry_id::text,
   'operatorLastRequestId',request_id::text,'operatorChecklistRecorded',true,'recordedAt',saved_at);
  box:=jsonb_set(box,'{interventions}',coalesce(box->'interventions','[]'::jsonb)||jsonb_build_array(updated_item));
 else
  select i.value,i.ordinality::integer-1 into current_item,item_index
  from jsonb_array_elements(coalesce(box->'interventions','[]'::jsonb)) with ordinality i(value,ordinality)
  where i.value->>'operatorEntryId'=intervention_id::text;
  if current_item is null or current_item->>'operatorId' is distinct from auth.uid()::text then
   raise exception 'Vous pouvez modifier uniquement vos propres interventions';
  end if;
  updated_item:=current_item||jsonb_build_object('type',kind,'comment',btrim(comment),'operatorLastRequestId',request_id::text,
   'parts',checked_parts,'operatorChecklistRecorded',true,'operatorCorrections',coalesce(current_item->'operatorCorrections','[]'::jsonb)||jsonb_build_array(
    jsonb_build_object('at',saved_at,'by',auth.uid()::text,'previousType',current_item->>'type','previousComment',current_item->>'comment','previousParts',coalesce(current_item->'parts','{}'::jsonb))));
  box:=jsonb_set(box,array['interventions',item_index::text],updated_item);
  entry_id:=intervention_id;
 end if;
 boxes:=jsonb_set(boxes,array[box_index::text],box);
 if octet_length((jsonb_set(s.payload,'{containers}',boxes,true))::text)>20000000 then
  raise exception 'Capacité de stockage atteinte';
 end if;
 insert into public.state_history values(w,s.revision,s.payload,now(),auth.uid());
 update public.workspace_state set payload=jsonb_set(s.payload,'{containers}',boxes,true),revision=s.revision+1,
  updated_at=now(),updated_by=auth.uid() where workspace_id=w;
 return jsonb_build_object('id',entry_id::text,'number',updated_item->>'number','revision',s.revision+1);
end$$;

revoke all on function public.operator_save_intervention(uuid,uuid,text,text,text,uuid) from authenticated;
revoke all on function public.operator_save_intervention_v2(uuid,uuid,text,text,text,uuid,jsonb) from public,anon;
grant execute on function public.operator_save_intervention_v2(uuid,uuid,text,text,text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
