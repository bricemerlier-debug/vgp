import {reminderPlan,reminderMessage} from './reminder-plan.mjs';
import {reminderCivilDate} from './reminder-dates.mjs';
const pendingReminderStates=new Set(['queued','failed','processing','uncertain']);
const reminderEvent=(job,status,at,detail='')=>{job.status=status;job.updatedAt=at;job.history.push({at,status,mode:'simulation',detail});};
export function reconcileReminderQueue(state,document,workspaceId,at){
 const plan=reminderPlan(document,workspaceId,reminderCivilDate(at)),current=new Map(plan.jobs.map(j=>[j.key,j]));state.jobs??=[];state.issues=plan.issues;
 for(const job of state.jobs.filter(j=>j.workspace_id===workspaceId)){const next=current.get(job.key);if(pendingReminderStates.has(job.status)&&(!next||next.fingerprint!==job.fingerprint))reminderEvent(job,'cancelled',at,'Contrôle, archivage, échéance ou destinataire modifié.');}
 for(const job of plan.jobs){const existing=state.jobs.find(j=>j.key===job.key);if(!existing)state.jobs.push({...job,attempts:0,createdAt:at,updatedAt:at,history:[{at,status:'queued',mode:'simulation',detail:'File locale de simulation ; aucune file de production activée.'}]});
  else if(existing.status==='cancelled'&&existing.attempts===0&&existing.fingerprint!==job.fingerprint&&job.run_on>=reminderCivilDate(at)){Object.assign(existing,job);reminderEvent(existing,'queued',at,'Nouvelle affectation explicitement confirmée ; ancien rappel annulé conservé dans l’historique.');}
 }
 return state;
}
// store.transaction(fn) doit sérialiser lecture-modification-écriture, y compris entre workers.
// Le transport est injecté et simulé. Aucun transport réseau n'est accepté dans cette version.
export async function runReminderWorker({store,readDocument,workspaceId,now=()=>new Date(),transport,limit=100,mode='simulation',timeoutMs=5000}){
 if(mode!=='simulation'||transport?.mode!=='simulation')throw Error('Envoi réel désactivé : cette version accepte uniquement la messagerie simulée.');
 const at=new Date(now()).toISOString(),date=reminderCivilDate(at);const initial=await readDocument();
 await store.transaction(state=>{reconcileReminderQueue(state,initial,workspaceId,at);for(const j of state.jobs)if(j.workspace_id===workspaceId&&j.status==='processing'&&j.leaseUntil<=at)reminderEvent(j,'uncertain',at,'Traitement interrompu. Pas de reprise automatique : résultat fournisseur inconnu.');});
 for(let n=0;n<limit;n++){
  const document=await readDocument();const job=await store.transaction(state=>{reconcileReminderQueue(state,document,workspaceId,new Date(now()).toISOString());const j=state.jobs.find(j=>j.workspace_id===workspaceId&&['queued','failed'].includes(j.status)&&j.run_on===date&&j.attempts<3&&(!j.retryAt||j.retryAt<=new Date(now()).toISOString()));
   // Pas de rattrapage silencieux des étapes manquées ; elles restent visibles dans l'historique.
   for(const old of state.jobs)if(old.workspace_id===workspaceId&&['queued','failed'].includes(old.status)&&old.run_on<date)reminderEvent(old,'cancelled',at,'Étape passée : pas d’envoi tardif automatique.');
   if(!j)return null;j.attempts++;j.leaseUntil=new Date(new Date(now()).getTime()+timeoutMs+60000).toISOString();reminderEvent(j,'processing',at,'Tentative simulée '+j.attempts);return structuredClone(j);});if(!job)break;
  // Relire après réservation, juste avant le transport ; jamais le document de l'aperçu.
  const fresh=await readDocument();const valid=reminderPlan(fresh,workspaceId,date).jobs.find(j=>j.key===job.key&&j.fingerprint===job.fingerprint);
  if(!valid){await store.transaction(state=>{const j=state.jobs.find(j=>j.key===job.key);if(j.status==='processing')reminderEvent(j,'cancelled',new Date(now()).toISOString(),'Situation devenue obsolète avant envoi simulé.');});continue;}
  let result='simulated',detail='Message simulé ; aucun e-mail envoyé.',retry=false,timer;
  try{const message=reminderMessage(fresh,job);const controller=new AbortController();await Promise.race([transport.send({job,message,signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('Délai fournisseur dépassé ; résultat inconnu.'),{uncertain:true}));},timeoutMs);})]);}
  catch(error){result=error.uncertain?'uncertain':'failed';detail=error.uncertain?'Délai ou résultat ambigu : vérifier le journal simulé, aucune relance automatique.':String(error.message||'Échec simulé');retry=error.retryable===true&&!error.uncertain;}
  finally{clearTimeout(timer);}
  await store.transaction(state=>{const j=state.jobs.find(j=>j.key===job.key);if(j.status!=='processing')return;reminderEvent(j,result,new Date(now()).toISOString(),detail);j.retryAt=retry&&j.attempts<3?new Date(new Date(now()).getTime()+60000*2**(j.attempts-1)).toISOString():null;if(result==='failed'&&!retry)j.attempts=3;});
 }
 return store.transaction(state=>structuredClone(state));
}
export function simulatedReminderTransport(scenario='success'){return {mode:'simulation',async send(){if(scenario==='network')throw Object.assign(Error('Réseau simulé indisponible avant acceptation.'),{retryable:true});if(scenario==='timeout')throw Object.assign(Error('Réponse simulée perdue.'),{uncertain:true});return {simulated:true};}};}
