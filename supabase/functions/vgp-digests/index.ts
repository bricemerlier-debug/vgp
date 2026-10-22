// Secrets serveur uniquement. Déploiement volontairement inactif par défaut.
import {buildDigest,digestSchedule} from '../../../digest.mjs';
Deno.serve(async request=>{
 const secret=Deno.env.get('DIGEST_CRON_SECRET');
 if(!secret||request.headers.get('Authorization')!==`Bearer ${secret}`)return new Response('Accès refusé',{status:401});
 if(request.method!=='POST')return new Response('POST requis',{status:405});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),workspace=Deno.env.get('DIGEST_WORKSPACE_ID');
 if(!url||!key||!workspace)return new Response('Configuration serveur incomplète',{status:503});
 const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
 const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).format(new Date());
 const date=local.slice(0,10),hour=Number(local.slice(11,13));if(hour!==7)return Response.json({status:'hors horaire'});
 try{
 const [stateResponse,equipmentResponse]=await Promise.all([
  fetch(`${url}/rest/v1/workspace_state?workspace_id=eq.${encodeURIComponent(workspace)}&select=payload`,{headers}),
  fetch(`${url}/rest/v1/equipment?workspace_id=eq.${encodeURIComponent(workspace)}&select=details&order=site_id.asc`,{headers})
 ]);if(!stateResponse.ok||!equipmentResponse.ok)throw Error('Lecture des données refusée');
 const rows=await stateResponse.json(),equipmentRows=await equipmentResponse.json(),data=rows[0]?.payload;if(!data)throw Error('Espace introuvable');data.equipment=equipmentRows.map(row=>row.details);const settings=data.digestSettings||{};
 if(!settings.recipient||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.recipient))return Response.json({status:'destinataire absent'});
 const schedule=digestSchedule(date),reports=['week','month'].filter(kind=>schedule[kind]&&settings[kind]===true).map(kind=>buildDigest(data,kind,date));
 if(Deno.env.get('DIGEST_SEND_ENABLED')!=='true')return Response.json({status:'simulation — aucun envoi',reports});
 const tenant=Deno.env.get('MS_TENANT_ID'),client=Deno.env.get('MS_CLIENT_ID'),credential=Deno.env.get('MS_CLIENT_SECRET'),sender=Deno.env.get('MS_SENDER');if(!tenant||!client||!credential||!sender)throw Error('Configuration Microsoft 365 incomplète');
 if(!reports.length)return Response.json({status:'aucun bilan prévu'});
 const auth=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,{method:'POST',body:new URLSearchParams({client_id:client,client_secret:credential,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'})});if(!auth.ok)throw Error('Authentification Microsoft refusée');const token=(await auth.json()).access_token;
 const outcomes=[];
 for(const report of reports){
 // Réservation atomique : une seule tentative automatique par période, même avec appels concurrents.
 const job={workspace_id:workspace,kind:report.kind,period_start:report.start,recipient:settings.recipient,status:'processing'};
 const lock=await fetch(`${url}/rest/v1/digest_deliveries`,{method:'POST',headers,body:JSON.stringify(job)});if(lock.status===409){outcomes.push({kind:report.kind,status:'déjà réservé'});continue;}if(!lock.ok)throw Error('Réservation du bilan refusée');
 const filter=`workspace_id=eq.${encodeURIComponent(workspace)}&kind=eq.${report.kind}&period_start=eq.${report.start}`;
 let status='uncertain';try{const sent=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{subject:report.subject,body:{contentType:'Text',content:report.text},toRecipients:[{emailAddress:{address:settings.recipient}}]},saveToSentItems:true})});if(sent.status===202)status='accepted';}catch{/* Pas de réessai aveugle : une réponse perdue peut masquer un envoi accepté. */}
 const logged=await fetch(`${url}/rest/v1/digest_deliveries?${filter}`,{method:'PATCH',headers,body:JSON.stringify({status,updated_at:new Date().toISOString()})});if(!logged.ok)throw Error('Journal non mis à jour — vérifier la réservation avant toute relance');outcomes.push({kind:report.kind,status});
 }
 return Response.json({outcomes});
 }catch{return new Response('Traitement interrompu : vérifier les journaux serveur, aucun réessai automatique des bilans réservés.',{status:503});}
});
