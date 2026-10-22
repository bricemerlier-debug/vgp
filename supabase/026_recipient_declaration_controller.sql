-- Installer après les scripts 024 et 025. Aucun mail envoyé.
begin;
create or replace function public.submit_recipient_declaration(declaration_kind text,token text,signer_name text,search_details text,signature jsonb,accepted boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link record;s public.workspace_state;e jsonb;idx integer;event jsonb;document jsonb;
 report_number numeric;saved_at timestamptz:=now();civil_date text:=(now() at time zone 'Europe/Paris')::date::text;
 statement text:='Je certifie avoir recherché ce matériel et le déclarer perdu. Je confirme l’exactitude des informations renseignées et signe personnellement cette déclaration.';
 snapshot jsonb;result_receipt jsonb;signature_bytes bytea;signer_email text;profiles jsonb;profile jsonb;profile_id text;display_name text;archive_reason text;begin
 if declaration_kind not in ('loss','scrap') or declaration_kind is null then raise exception 'Déclaration invalide';end if;
 archive_reason:=case when declaration_kind='loss' then 'Équipement perdu' else 'Mis au rebut' end;
 if declaration_kind='scrap' then statement:='Je déclare la mise au rebut de ce matériel et en précise les circonstances. Je confirme l’exactitude des informations renseignées et signe personnellement cette déclaration.';end if;
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Lien invalide ou expiré';end if;
 if declaration_kind='loss' then
  select * into link from public.equipment_loss_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 else
  select * into link from public.equipment_scrap_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 end if;
 if not found then raise exception 'Lien invalide ou expiré';end if;
 -- Une réponse réseau perdue ne doit jamais créer une deuxième déclaration.
 if link.used_at is not null then return link.receipt;end if;
 if link.expires_at<=saved_at then raise exception 'Lien invalide ou expiré';end if;
 signer_email:=lower(btrim(coalesce(signer_name,'')));
 if length(signer_email)>254 or signer_email !~ '^[a-z]+(-[a-z]+)*_[a-z]+([-_][a-z]+)*@goodyear\.com$' then raise exception 'Renseignez votre adresse professionnelle personnelle : prenom_nom@goodyear.com';end if;
 signer_name:=initcap(replace(split_part(signer_email,'@',1),'_',' '));
 if accepted is distinct from true or signer_name is null or length(btrim(signer_name))<3 or length(signer_name)>160
 or search_details is null or length(btrim(search_details))<10 or length(search_details)>5000 then raise exception 'Renseignez votre nom, les recherches effectuées et votre attestation';end if;
 if signature is null or jsonb_typeof(signature)<>'object' or coalesce(signature->>'width','') !~ '^[0-9]{1,3}$' or coalesce(signature->>'height','') !~ '^[0-9]{1,3}$' then raise exception 'Signature requise';end if;
 if (signature->>'width')::integer not between 1 and 720 or (signature->>'height')::integer not between 1 and 240
 or length(coalesce(signature->>'data','')) not between 100 and 250000 or coalesce(signature->>'data','') !~ '^/9j/[A-Za-z0-9+/=]+$' then raise exception 'Signature invalide';end if;
 begin signature_bytes:=decode(signature->>'data','base64');exception when others then raise exception 'Signature invalide';end;
 if substring(signature_bytes from 1 for 3)<>decode('ffd8ff','hex') or substring(signature_bytes from octet_length(signature_bytes)-1 for 2)<>decode('ffd9','hex') then raise exception 'Signature invalide';end if;
 select * into s from public.workspace_state where workspace_id=link.workspace_id for update;
 if exists(select 1 from public.migration_receipts where workspace_id=link.workspace_id and validated_at is null) then raise exception 'Enregistrement indisponible pendant la migration';end if;
 select c.value,c.ordinality::integer-1 into e,idx from jsonb_array_elements(s.payload->'equipment') with ordinality c(value,ordinality) where c.value->>'id'=link.equipment_id;
 if e is null or coalesce((e->>'archived')::boolean,false) or public.loss_equipment_fingerprint(e) is distinct from link.equipment_fingerprint
 or (not link.is_test and not public.loss_recipient_is_owner(s.payload,e,link.recipient)) then raise exception 'Ce lien n’est plus valable pour la situation actuelle du matériel';end if;
 result_receipt:=jsonb_build_object('id',link.id,'number',e->>'identifier','signer',btrim(signer_name),'recipient',link.recipient,'date',civil_date,'at',saved_at,'test',link.is_test,'signerEmail',signer_email);
 if not link.is_test then
  profiles:=coalesce(s.payload->'controllerProfiles','[]'::jsonb);
  select value into profile from jsonb_array_elements(profiles)
   where value->>'deletedAt' is null and value->>'mergedInto' is null
    and lower(btrim(value->>'email'))=signer_email limit 1;
  if profile is null then
   select value into profile from jsonb_array_elements(profiles)
    where value->>'deletedAt' is null and value->>'mergedInto' is null
     and coalesce(btrim(value->>'email'),'')=''
     and public.loss_owner_key(value->>'name')=public.loss_owner_key(signer_name) limit 1;
   if profile is not null then
    profile:=profile||jsonb_build_object('email',signer_email);
    select jsonb_agg(case when value->>'id'=profile->>'id' then profile else value end order by ordinality)
     into profiles from jsonb_array_elements(profiles) with ordinality;
   end if;
  end if;
  if profile is null then
   display_name:=signer_name;
   if exists(select 1 from jsonb_array_elements(profiles) p
    cross join lateral jsonb_array_elements_text(jsonb_build_array(p.value->>'name')||coalesce(p.value->'aliases','[]'::jsonb)) n
    where public.loss_owner_key(n.value)=public.loss_owner_key(display_name)) then
    display_name:=left(signer_name,80)||' ('||signer_email||')';
    if length(display_name)>160 then raise exception 'Identité ambiguë : contactez Métrologie';end if;
   end if;
   profile:=jsonb_build_object('id',gen_random_uuid()::text,'name',display_name,'email',signer_email,'signature',null);
   profiles:=profiles||jsonb_build_array(profile);
  end if;
  profile_id:=profile->>'id';
  select coalesce(max((c.value->>'reportId')::numeric),0)+1 into report_number
  from jsonb_array_elements(s.payload->'equipment') eq
  cross join lateral jsonb_array_elements(coalesce(eq.value->'controls','[]'::jsonb)||coalesce(eq.value->'archiveHistory','[]'::jsonb)) c
  where c.value->>'reportId' ~ '^[0-9]{1,16}$';
  snapshot:=jsonb_build_object('identifier',coalesce(e->>'identifier',''),'serialNumber',coalesce(e->>'serialNumber',''),
   'designation',coalesce(nullif(e->>'standardName',''),e->>'designation',''),'category',coalesce(e->>'category',''),'location',coalesce(e->>'location',''),
   'sector',coalesce(e->>'sector',''),'zone',coalesce(e->>'zone',''),'team',coalesce(e->>'team',''),'owner',coalesce(e->>'owner',''),'assignment',coalesce(e->>'assignment',''),'siteId',e->'siteId');
  event:=jsonb_build_object('id',link.id::text,'type','archive','workflow',declaration_kind||'-declaration','reason',archive_reason,'verifierId',profile_id,'verifierSnapshot',profile,
   'date',civil_date,'time',to_char(saved_at at time zone 'Europe/Paris','HH24:MI'),'timeZone','Europe/Paris',
   'requester',btrim(signer_name),'observations',btrim(search_details)||E'\n\n'||statement,
   'account','Lien envoyé à '||link.recipient,'created',floor(extract(epoch from saved_at)*1000),'generated',false,
   'reportId',report_number::text,'snapshot',snapshot,'equipmentSnapshot',snapshot,'reportSignature',signature,'previousRequest',e->'pendingArchive',
   'recipientDeclaration',jsonb_build_object('linkId',link.id,'recipient',link.recipient,'signerName',btrim(signer_name),'signerEmail',signer_email,'emailVerified',false,
    'statement',statement,'accepted',true,'signedAt',saved_at,'issuedAt',link.created_at));
  e:=e||jsonb_build_object('archived',true,'pendingArchive',null,'archiveHistory',coalesce(e->'archiveHistory','[]'::jsonb)||jsonb_build_array(event));
  if jsonb_typeof(e->'obligations')='array' then
   e:=jsonb_set(e,'{obligations}',(select coalesce(jsonb_agg(case when not coalesce((o.value->>'done')::boolean,false) and o.value->>'excludedAt' is null
    then o.value||jsonb_build_object('excludedAt',civil_date,'excludedReason',archive_reason,'excludedBy',btrim(signer_name)) else o.value end order by o.ordinality),'[]'::jsonb)
    from jsonb_array_elements(e->'obligations') with ordinality o(value,ordinality)));
  end if;
  document:=jsonb_set(jsonb_set(s.payload,array['equipment',idx::text],e),'{controllerProfiles}',profiles);
  if octet_length(document::text)>20000000 then raise exception 'Capacité de stockage atteinte';end if;
  insert into public.state_history(workspace_id,revision,payload,saved_at,saved_by) values(link.workspace_id,s.revision,s.payload,saved_at,null);
  update public.workspace_state set payload=document,revision=s.revision+1,updated_at=saved_at,updated_by=null where workspace_id=link.workspace_id;
  insert into public.equipment(workspace_id,id,site_id,identifier,serial_number,name,owner_name,months,archived,details)
   values(link.workspace_id,e->>'id',(e->>'siteId')::bigint,e->>'identifier',e->>'serialNumber',e->>'designation',e->>'owner',(e->>'months')::integer,true,e)
   on conflict(workspace_id,id) do update set archived=true,details=excluded.details;
  update public.reminder_jobs set status='cancelled' where workspace_id=link.workspace_id and equipment_id=link.equipment_id and status in ('queued','failed');
  result_receipt:=result_receipt||jsonb_build_object('reportId',report_number::text,'verifierId',profile_id);
 end if;
 if declaration_kind='loss' then
  update public.equipment_loss_links set used_at=saved_at,receipt=result_receipt where id=link.id;
 else
  update public.equipment_scrap_links set used_at=saved_at,receipt=result_receipt where id=link.id;
 end if;
 return result_receipt;
end$$;

revoke all on function public.submit_recipient_declaration(text,text,text,text,jsonb,boolean) from public,anon,authenticated;
create or replace function public.submit_equipment_loss(token text,signer_name text,search_details text,signature jsonb,accepted boolean) returns jsonb
language sql security definer set search_path='' as $$
 select public.submit_recipient_declaration('loss',token,signer_name,search_details,signature,accepted)
$$;
create or replace function public.submit_equipment_scrap(token text,signer_name text,search_details text,signature jsonb,accepted boolean) returns jsonb
language sql security definer set search_path='' as $$
 select public.submit_recipient_declaration('scrap',token,signer_name,search_details,signature,accepted)
$$;
revoke all on function public.submit_equipment_loss(text,text,text,jsonb,boolean),public.submit_equipment_scrap(text,text,text,jsonb,boolean) from public;
grant execute on function public.submit_equipment_loss(text,text,text,jsonb,boolean),public.submit_equipment_scrap(text,text,text,jsonb,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
