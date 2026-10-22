-- Déclaration de mise au rebut signée depuis un lien de mail, sans compte sur le portail.
-- Les lectures publiques sont limitées à la fiche désignée par un jeton secret.
begin;
create table if not exists public.equipment_scrap_links(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 equipment_id text not null,
 token_hash text not null unique,
 recipient text not null,
 equipment_fingerprint jsonb not null,
 is_test boolean not null default true,
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id),
 expires_at timestamptz not null,
 used_at timestamptz,
 receipt jsonb
);
alter table public.equipment_scrap_links enable row level security;
revoke all on public.equipment_scrap_links from public,anon,authenticated;

create or replace function public.scrap_equipment_fingerprint(e jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('owner',e->'owner','additionalOwners',e->'additionalOwners','controls',e->'controls',
 'identifier',e->'identifier','serialNumber',e->'serialNumber','archiveCount',jsonb_array_length(coalesce(e->'archiveHistory','[]'::jsonb)),
 'firstControlDate',e->'firstControlDate','manualNextControlDate',e->'manualNextControlDate',
 'dateValidation',e->'dateValidation','periodicityValidation',e->'periodicityValidation','needsReverification',e->'needsReverification')
$$;
create or replace function public.scrap_owner_key(value text) returns text
language sql immutable set search_path='' as $$
 select lower(regexp_replace(normalize(regexp_replace(btrim(coalesce(value,'')),'[[:space:]]+',' ','g'),NFD),U&'[\0300-\036f]','','g'))
$$;
create or replace function public.scrap_recipient_is_owner(payload jsonb,e jsonb,recipient text) returns boolean
language sql stable set search_path='' as $$
 select exists(
  select 1 from jsonb_array_elements(coalesce(payload->'ownerContacts','[]'::jsonb)) c
  cross join lateral jsonb_array_elements_text(jsonb_build_array(e->>'owner')||coalesce(e->'additionalOwners','[]'::jsonb)) o(name)
  where lower(btrim(c.value->>'email'))=lower(btrim(recipient))
  and public.scrap_owner_key(c.value->>'owner')=public.scrap_owner_key(o.name)
 )
$$;
revoke all on function public.scrap_equipment_fingerprint(jsonb),public.scrap_owner_key(text),public.scrap_recipient_is_owner(jsonb,jsonb,text) from public,anon,authenticated;

create or replace function public.create_equipment_scrap_link(w uuid,equipment_id text,recipient text,for_test boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.workspace_state;e jsonb;secret text;link public.equipment_scrap_links;begin
 if auth.uid() is null or coalesce(public.workspace_role(w),'') not in ('admin','editor') then raise exception 'Création du lien refusée';end if;
 if recipient is null or length(recipient)>254 or recipient !~ '^[^[:space:]@<>;,]+@[^[:space:]@<>;,]+\.[^[:space:]@<>;,]+$' or for_test is null then raise exception 'Adresse destinataire invalide';end if;
 select * into s from public.workspace_state where workspace_id=w;
 if not found then raise exception 'Espace introuvable';end if;
 if exists(select 1 from public.migration_receipts where workspace_id=w and validated_at is null) then raise exception 'Migration en attente';end if;
 select value into e from jsonb_array_elements(s.payload->'equipment') where value->>'id'=equipment_id;
 if e is null or coalesce((e->>'archived')::boolean,false) then raise exception 'Équipement indisponible';end if;
 if not for_test and not public.scrap_recipient_is_owner(s.payload,e,recipient) then raise exception 'Ce destinataire n’est plus associé à l’équipement';end if;
 secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.equipment_scrap_links(workspace_id,equipment_id,token_hash,recipient,equipment_fingerprint,is_test,created_by,expires_at)
 values(w,equipment_id,encode(sha256(convert_to(secret,'UTF8')),'hex'),lower(btrim(recipient)),public.scrap_equipment_fingerprint(e),for_test,auth.uid(),now()+interval '35 days') returning * into link;
 return jsonb_build_object('token',secret,'expiresAt',link.expires_at,'test',link.is_test);
end$$;

create or replace function public.read_equipment_scrap_link(token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare link public.equipment_scrap_links;s public.workspace_state;e jsonb;begin
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Lien invalide ou expiré';end if;
 select * into link from public.equipment_scrap_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 if not found then raise exception 'Lien invalide ou expiré';end if;
 if link.used_at is not null then return jsonb_build_object('status','submitted','test',link.is_test,'receipt',link.receipt);end if;
 if link.expires_at<=now() then raise exception 'Lien invalide ou expiré';end if;
 select * into s from public.workspace_state where workspace_id=link.workspace_id;
 select value into e from jsonb_array_elements(s.payload->'equipment') where value->>'id'=link.equipment_id;
 if e is null or coalesce((e->>'archived')::boolean,false) or public.scrap_equipment_fingerprint(e) is distinct from link.equipment_fingerprint
 or (not link.is_test and not public.scrap_recipient_is_owner(s.payload,e,link.recipient)) then raise exception 'Ce lien n’est plus valable pour la situation actuelle du matériel';end if;
 return jsonb_build_object('status','ready','test',link.is_test,'recipient',link.recipient,'expiresAt',link.expires_at,
 'equipment',jsonb_build_object('number',e->>'identifier','name',coalesce(nullif(e->>'standardName',''),e->>'designation'),
 'serialNumber',e->>'serialNumber','owner',e->>'owner','photo',e->'mailPhoto'));
end$$;

create or replace function public.submit_equipment_scrap(token text,signer_name text,search_details text,signature jsonb,accepted boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link public.equipment_scrap_links;s public.workspace_state;e jsonb;idx integer;event jsonb;document jsonb;
 report_number numeric;saved_at timestamptz:=now();civil_date text:=(now() at time zone 'Europe/Paris')::date::text;
 statement text:='Je déclare la mise au rebut de ce matériel et en précise les circonstances. Je confirme l’exactitude des informations renseignées et signe personnellement cette déclaration.';
 snapshot jsonb;result_receipt jsonb;signature_bytes bytea;begin
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Lien invalide ou expiré';end if;
 select * into link from public.equipment_scrap_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 if not found then raise exception 'Lien invalide ou expiré';end if;
 -- Une réponse réseau perdue ne doit jamais créer une deuxième déclaration.
 if link.used_at is not null then return link.receipt;end if;
 if link.expires_at<=saved_at then raise exception 'Lien invalide ou expiré';end if;
 if accepted is distinct from true or signer_name is null or length(btrim(signer_name))<3 or length(signer_name)>160
 or search_details is null or length(btrim(search_details))<10 or length(search_details)>5000 then raise exception 'Renseignez votre nom, les motifs de mise au rebut et votre attestation';end if;
 if signature is null or jsonb_typeof(signature)<>'object' or coalesce(signature->>'width','') !~ '^[0-9]{1,3}$' or coalesce(signature->>'height','') !~ '^[0-9]{1,3}$' then raise exception 'Signature requise';end if;
 if (signature->>'width')::integer not between 1 and 720 or (signature->>'height')::integer not between 1 and 240
 or length(coalesce(signature->>'data','')) not between 100 and 250000 or coalesce(signature->>'data','') !~ '^/9j/[A-Za-z0-9+/=]+$' then raise exception 'Signature invalide';end if;
 begin signature_bytes:=decode(signature->>'data','base64');exception when others then raise exception 'Signature invalide';end;
 if substring(signature_bytes from 1 for 3)<>decode('ffd8ff','hex') or substring(signature_bytes from octet_length(signature_bytes)-1 for 2)<>decode('ffd9','hex') then raise exception 'Signature invalide';end if;
 select * into s from public.workspace_state where workspace_id=link.workspace_id for update;
 if exists(select 1 from public.migration_receipts where workspace_id=link.workspace_id and validated_at is null) then raise exception 'Enregistrement indisponible pendant la migration';end if;
 select c.value,c.ordinality::integer-1 into e,idx from jsonb_array_elements(s.payload->'equipment') with ordinality c(value,ordinality) where c.value->>'id'=link.equipment_id;
 if e is null or coalesce((e->>'archived')::boolean,false) or public.scrap_equipment_fingerprint(e) is distinct from link.equipment_fingerprint
 or (not link.is_test and not public.scrap_recipient_is_owner(s.payload,e,link.recipient)) then raise exception 'Ce lien n’est plus valable pour la situation actuelle du matériel';end if;
 result_receipt:=jsonb_build_object('id',link.id,'number',e->>'identifier','signer',btrim(signer_name),'recipient',link.recipient,'date',civil_date,'at',saved_at,'test',link.is_test);
 if not link.is_test then
  select coalesce(max((c.value->>'reportId')::numeric),0)+1 into report_number
  from jsonb_array_elements(s.payload->'equipment') eq
  cross join lateral jsonb_array_elements(coalesce(eq.value->'controls','[]'::jsonb)||coalesce(eq.value->'archiveHistory','[]'::jsonb)) c
  where c.value->>'reportId' ~ '^[0-9]{1,16}$';
  snapshot:=jsonb_build_object('identifier',coalesce(e->>'identifier',''),'serialNumber',coalesce(e->>'serialNumber',''),
   'designation',coalesce(nullif(e->>'standardName',''),e->>'designation',''),'category',coalesce(e->>'category',''),'location',coalesce(e->>'location',''),
   'sector',coalesce(e->>'sector',''),'zone',coalesce(e->>'zone',''),'team',coalesce(e->>'team',''),'owner',coalesce(e->>'owner',''),'assignment',coalesce(e->>'assignment',''),'siteId',e->'siteId');
  event:=jsonb_build_object('id',link.id::text,'type','archive','workflow','scrap-declaration','reason','Mis au rebut',
   'date',civil_date,'time',to_char(saved_at at time zone 'Europe/Paris','HH24:MI'),'timeZone','Europe/Paris',
   'requester',btrim(signer_name),'observations',btrim(search_details)||E'\n\n'||statement,
   'account','Lien envoyé à '||link.recipient,'created',floor(extract(epoch from saved_at)*1000),'generated',false,
   'reportId',report_number::text,'snapshot',snapshot,'equipmentSnapshot',snapshot,'reportSignature',signature,'previousRequest',e->'pendingArchive',
   'recipientDeclaration',jsonb_build_object('linkId',link.id,'recipient',link.recipient,'signerName',btrim(signer_name),
    'statement',statement,'accepted',true,'signedAt',saved_at,'issuedAt',link.created_at));
  e:=e||jsonb_build_object('archived',true,'pendingArchive',null,'archiveHistory',coalesce(e->'archiveHistory','[]'::jsonb)||jsonb_build_array(event));
  if jsonb_typeof(e->'obligations')='array' then
   e:=jsonb_set(e,'{obligations}',(select coalesce(jsonb_agg(case when not coalesce((o.value->>'done')::boolean,false) and o.value->>'excludedAt' is null
    then o.value||jsonb_build_object('excludedAt',civil_date,'excludedReason','Mis au rebut','excludedBy',btrim(signer_name)) else o.value end order by o.ordinality),'[]'::jsonb)
    from jsonb_array_elements(e->'obligations') with ordinality o(value,ordinality)));
  end if;
  document:=jsonb_set(s.payload,array['equipment',idx::text],e);
  if octet_length(document::text)>20000000 then raise exception 'Capacité de stockage atteinte';end if;
  insert into public.state_history(workspace_id,revision,payload,saved_at,saved_by) values(link.workspace_id,s.revision,s.payload,saved_at,null);
  update public.workspace_state set payload=document,revision=s.revision+1,updated_at=saved_at,updated_by=null where workspace_id=link.workspace_id;
  insert into public.equipment(workspace_id,id,site_id,identifier,serial_number,name,owner_name,months,archived,details)
   values(link.workspace_id,e->>'id',(e->>'siteId')::bigint,e->>'identifier',e->>'serialNumber',e->>'designation',e->>'owner',(e->>'months')::integer,true,e)
   on conflict(workspace_id,id) do update set archived=true,details=excluded.details;
  update public.reminder_jobs set status='cancelled' where workspace_id=link.workspace_id and equipment_id=link.equipment_id and status in ('queued','failed');
  result_receipt:=result_receipt||jsonb_build_object('reportId',report_number::text);
 end if;
 update public.equipment_scrap_links set used_at=saved_at,receipt=result_receipt where id=link.id;
 return result_receipt;
end$$;

revoke all on function public.create_equipment_scrap_link(uuid,text,text,boolean) from public,anon;
grant execute on function public.create_equipment_scrap_link(uuid,text,text,boolean) to authenticated;
revoke all on function public.read_equipment_scrap_link(text),public.submit_equipment_scrap(text,text,text,jsonb,boolean) from public;
grant execute on function public.read_equipment_scrap_link(text),public.submit_equipment_scrap(text,text,text,jsonb,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
