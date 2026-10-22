export function validateConfig(config){
 if(!config?.enabled)return null;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url))throw Error('URL Supabase invalide (https://PROJET.supabase.co).');
 if(!/^[0-9a-f-]{36}$/i.test(config.workspaceId))throw Error('Identifiant d’espace invalide.');
 const key=config.publicKey||'';let role='';
 if(key.startsWith('eyJ')){try{role=JSON.parse(atob(key.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).role}catch{throw Error('Clé publique invalide.')}}
 if(!(key.startsWith('sb_publishable_')||role==='anon'))throw Error('Utilisez exclusivement la clé publishable ou anon, jamais une clé secrète.');
 return {...config,url:config.url.replace(/\/$/,'')};
}
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value)}
export class CloudStore{
 constructor(config,{fetcher=(...args)=>globalThis.fetch(...args),storage=undefined,persistentStorage=undefined}={}){
  this.config=validateConfig(config);this.fetcher=fetcher;
  try{this.storage=storage??globalThis.sessionStorage}catch{this.storage=null;}
  try{this.persistentStorage=persistentStorage??globalThis.localStorage}catch{this.persistentStorage=null;}
  this.key='vgp-auth:'+this.config.url;this.session=null;this.revision=null;this.busy=false;this.remember=false;this.persistenceWarning='';
  for(const [place,remember] of [[this.persistentStorage,true],[this.storage,false]]){try{const session=JSON.parse(place?.getItem(this.key)||'null');if(session?.access_token&&session?.refresh_token){this.session=session;this.remember=remember;break}}catch{}}
 }

 async request(path,body,token,method='POST',timeoutMs=15000){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);let response,result;
  try{response=await this.fetcher(this.config.url+path,{method,headers:{apikey:this.config.publicKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:controller.signal});result=await response.json().catch(()=>({}));}
  catch(error){throw Error(error?.name==='AbortError'?'Délai de réponse dépassé : enregistrement non confirmé. Actualisez et vérifiez les données avant de réessayer.':'Enregistrement non confirmé : vérifiez le réseau, puis actualisez avant de réessayer.');}
  finally{clearTimeout(timeout);}
  if(!response.ok&&/statement timeout/i.test(result.message||''))throw Error('Supabase a interrompu l’enregistrement : délai serveur dépassé. Vérifiez que supabase/028_equipment_write_timeout.sql est installé, puis actualisez la page avant de réessayer.');
  if(!response.ok&&/lock timeout/i.test(result.message||''))throw Error('Un autre enregistrement bloque temporairement la base. Actualisez la page et réessayez après la fin de cette écriture.');
  if(!response.ok)throw Error(response.status===401?'Session expirée : reconnectez-vous.':result.message||result.msg||result.error_description||'Opération Supabase refusée.');return result;
 }

 retain(session){
  session={access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at,expires_in:session.expires_in,token_type:session.token_type,user:session.user?{id:session.user.id,email:session.user.email}:null};
  this.session=session;this.persistenceWarning='';const destination=this.remember?this.persistentStorage:this.storage,other=this.remember?this.storage:this.persistentStorage;
  try{other?.removeItem(this.key)}catch{}
  try{if(!destination)throw Error('Stockage indisponible');destination.setItem(this.key,JSON.stringify(session));}
  catch{if(this.remember){this.remember=false;this.persistenceWarning='La connexion persistante est indisponible dans ce navigateur. Vous restez connecté pour cette session uniquement.';try{this.storage?.setItem(this.key,JSON.stringify(session))}catch{}}}
 }
 async login(email,password,remember=false){const session=await this.request('/auth/v1/token?grant_type=password',{email,password});session.expires_at=Math.floor(Date.now()/1000)+session.expires_in;this.remember=!!remember;this.retain(session);}

 async acceptLink(hash){const params=new URLSearchParams(hash.replace(/^#/,''));if(!params.has('access_token'))return null;const token=params.get('access_token');const user=await this.request('/auth/v1/user',undefined,token,'GET');this.retain({user,access_token:token,refresh_token:params.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(params.get('expires_in')||3600)});return params.get('type');}
 async setPassword(password){await this.request('/auth/v1/user',{password},await this.token(),'PUT');}
 async resetPassword(email,redirect){await this.request('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{email});}
 async token(){if(!this.session?.access_token)throw Error('Connexion requise.');if((this.session.expires_at||0)<Date.now()/1000+60){const session=await this.request('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token});session.expires_at=Math.floor(Date.now()/1000)+session.expires_in;this.retain(session);}return this.session.access_token;}
 async rpc(name,body,timeoutMs=15000){return this.request('/rest/v1/rpc/'+name,{w:this.config.workspaceId,...body},await this.token(),'POST',timeoutMs);}
 async checkTrackingGuard(){if(!this.config.requireTrackingGuard)return true;try{this.trackingReady=await this.rpc('tracking_ready',{})===true;}catch{this.trackingReady=false;}return this.trackingReady;}
 async read(adoptRevision=true,timeoutMs=15000){const state=await this.rpc('read_state',{},timeoutMs);if(!Number.isSafeInteger(state?.revision)||!state.payload||typeof state.payload!=='object')throw Error('Réponse Supabase invalide : aucune donnée affichée n’a été remplacée.');if(['admin','editor','reader'].includes(state.role))this.role=state.role;if(adoptRevision)this.revision=state.revision;await this.checkTrackingGuard();return state;}
 async readRevision(){const rows=await this.request(`/rest/v1/workspace_state?workspace_id=eq.${encodeURIComponent(this.config.workspaceId)}&select=revision`,undefined,await this.token(),'GET');const revision=Array.isArray(rows)&&rows.length===1?Number(rows[0].revision):NaN;if(!Number.isSafeInteger(revision)||revision<0)throw Error('Révision Supabase invalide.');return revision;}
 async write(document,source=null,timeoutMs=15000){if(this.busy)throw Error('Un enregistrement est déjà en cours. Patientez.');this.busy=true;try{if(!await this.checkTrackingGuard())throw Error('Lecture seule : la protection Supabase doit être activée. Exécutez supabase/003_tracking_guard.sql dans le SQL Editor de Supabase, puis actualisez le site. Aucun changement enregistré.');const result=await this.rpc('write_state',{expected_revision:this.revision,document,source},timeoutMs);if(!Number.isSafeInteger(result?.revision)||result.revision!==this.revision+1)throw Error('Enregistrement non confirmé : réponse Supabase invalide. Actualisez avant de réessayer.');this.revision=result.revision;return result;}finally{this.busy=false;}}
 async writeEquipmentRecord(equipment,timeoutMs=60000){if(this.busy)throw Error('Un enregistrement est déjà en cours. Patientez.');this.busy=true;try{if(!await this.checkTrackingGuard())throw Error('Protection métier Supabase requise.');const result=await this.rpc('write_equipment_record',{expected_revision:this.revision,equipment_record:equipment},timeoutMs);if(!Number.isSafeInteger(result?.revision)||result.revision!==this.revision+1)throw Error('Enregistrement non confirmé : réponse Supabase invalide. Actualisez avant de réessayer.');this.revision=result.revision;return result;}finally{this.busy=false;}}
 async writeContainers(containers,timeoutMs=120000){
  if(this.busy)throw Error('Un enregistrement est déjà en cours. Patientez.');
  this.busy=true;
  try{
   if(!await this.checkTrackingGuard())throw Error('Protection Supabase indisponible. Actualisez la page.');
   let result;
   try{result=await this.rpc('write_containers',{expected_revision:this.revision,containers},timeoutMs);}
   catch(error){if(/délai serveur dépassé/i.test(error.message))throw Error('Import des contenants annulé par Supabase : la fonction dédiée write_containers a dépassé le délai serveur. Vérifiez les journaux Supabase avant de réessayer.');if(/lock timeout/i.test(error.message))throw Error('Import des contenants annulé : une autre écriture bloque temporairement les données. Actualisez la page et réessayez après la fin de cette écriture.');throw error;}
   if(!Number.isSafeInteger(result?.revision)||result.revision!==this.revision+1)throw Error('Enregistrement non confirmé : réponse Supabase invalide. Actualisez avant de réessayer.');
   this.revision=result.revision;
   return result;
  }finally{this.busy=false;}
 }
 async migrate(document,source){if(this.revision!==0)throw Error('Migration initiale autorisée uniquement dans un espace vierge.');const result=await this.write(document,source);const readback=await this.read();if(canonical(document)!==canonical(readback.payload))throw Error('Les données relues ne correspondent pas. Conservez votre sauvegarde et contactez l’administrateur.');return {...result,payload:readback.payload};}
 async validate(receipt,document){await this.rpc('validate_migration',{receipt,expected_document:document});}
 async apaveReady(){try{return await this.rpc('apave_automation_ready',{})===true;}catch{return false;}}
 async apaveUpload(file,sha256){
  if(!/^[a-f0-9]{64}$/.test(sha256)||file.size>100*1024*1024)throw Error('PDF invalide ou supérieur à 100 Mo.');
  const path=this.config.workspaceId+'/'+sha256+'.pdf',controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);
  try{const response=await this.fetcher(this.config.url+'/storage/v1/object/apave-reports/'+path,{method:'POST',headers:{apikey:this.config.publicKey,Authorization:'Bearer '+await this.token(),'Content-Type':'application/pdf','x-upsert':'false'},body:file,signal:controller.signal});
   const result=await response.json().catch(()=>({}));
   if(!response.ok&&!(response.status===409||String(result.statusCode)==='409'||result.error==='Duplicate'))throw Error(result.message||'Stockage privé indisponible : installer supabase/006_apave.sql.');
   return path;
  }finally{clearTimeout(timer);}
 }
 async importApave(document,report){
  if(this.busy)throw Error('Un enregistrement est déjà en cours.');this.busy=true;
  try{if(!await this.checkTrackingGuard())throw Error('Protection métier Supabase requise.');const result=await this.rpc('import_apave',{expected_revision:this.revision,document,report});
   if(result?.revision!==this.revision+1)throw Error('Réponse d’import non confirmée. Actualisez avant de réessayer.');this.revision=result.revision;return result;
  }finally{this.busy=false;}
 }
 async apaveUrl(hash,page){
  if(!/^[a-f0-9]{64}$/.test(hash)||!Number.isInteger(page)||page<1||page>1200)throw Error('Référence PDF invalide.');
  const path=this.config.workspaceId+'/'+hash+'.pdf',result=await this.request('/storage/v1/object/sign/apave-reports/'+path,{expiresIn:120},await this.token());
  const raw=result.signedURL||result.signedUrl;if(typeof raw!=='string')throw Error('Lien de consultation indisponible.');
  const url=new URL(raw.startsWith('/object/')?'/storage/v1'+raw:raw,this.config.url);
  if(url.origin!==new URL(this.config.url).origin||url.pathname!=='/storage/v1/object/sign/apave-reports/'+path)throw Error('Adresse de rapport refusée.');
  url.hash='page='+page;return url.href;
 }
 async maintenanceUpload(blob,id){
  if(!/^[a-f0-9-]{36}$/.test(id)||blob.type!=='image/jpeg'||blob.size>2*1024*1024)throw Error('Photo invalide.');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const path=this.config.workspaceId+'/'+id+'_'+hash+'.jpg',controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{const response=await this.fetcher(this.config.url+'/storage/v1/object/equipment-maintenance/'+path,{method:'POST',headers:{apikey:this.config.publicKey,Authorization:'Bearer '+await this.token(),'Content-Type':'image/jpeg','x-upsert':'false'},body:blob,signal:controller.signal});
  const result=await response.json().catch(()=>({}));
  if(!response.ok&&response.status!==409&&String(result.statusCode)!=='409'&&result.error!=='Duplicate')throw Error(result.message||'Stockage privé des photos indisponible.');
  return path;
  }finally{clearTimeout(timer);}
 }
 async maintenancePhotoUrl(path){
  if(typeof path!=='string'||!path.startsWith(this.config.workspaceId+'/')||!(/^[a-f0-9-]{36}\/[a-f0-9-]{36}_[a-f0-9]{64}\.jpg$/).test(path))throw Error('Référence photo invalide.');
  const result=await this.request('/storage/v1/object/sign/equipment-maintenance/'+path,{expiresIn:120},await this.token()),raw=result.signedURL||result.signedUrl;
  if(typeof raw!=='string')throw Error('Lien photo indisponible.');
  const url=new URL(raw.startsWith('/object/')?'/storage/v1'+raw:raw,this.config.url);
  if(url.origin!==new URL(this.config.url).origin||url.pathname!=='/storage/v1/object/sign/equipment-maintenance/'+path)throw Error('Adresse photo refusée.');return url.href;
 }
 async removeContainerPhoto(path){
  if(typeof path!=='string'||!path.startsWith(this.config.workspaceId+'/')||!(/^[a-f0-9-]{36}\/[a-f0-9-]{36}_[a-f0-9]{64}\.jpg$/).test(path))throw Error('Référence photo invalide.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{
   const response=await this.fetcher(this.config.url+'/storage/v1/object/equipment-maintenance/'+path,{method:'DELETE',headers:{apikey:this.config.publicKey,Authorization:'Bearer '+await this.token()},cache:'no-store',signal:controller.signal});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.message||'Suppression de la photo du stockage privé refusée.');
  }catch(error){if(error?.name==='AbortError')throw Error('Délai dépassé pendant le nettoyage de l’ancienne photo.');throw error;}
  finally{clearTimeout(timer);}
 }
 equipmentPhotoPathValid(path){return typeof path==='string'&&path.startsWith(this.config.workspaceId+'/')&&/^[a-f0-9-]{36}\/[a-f0-9-]{36}_[a-f0-9]{64}\.jpg$/.test(path);}
 async equipmentPhotoPath(id){
  if(typeof id!=='string'||!id||id.length>300)throw Error('Équipement invalide.');
  const rows=await this.request(`/rest/v1/equipment_photos?workspace_id=eq.${this.config.workspaceId}&equipment_id=eq.${encodeURIComponent(id)}&select=photo_path`,undefined,await this.token(),'GET');
  if(!Array.isArray(rows)||rows.length>1)throw Error('Réponse photo invalide.');
  const path=rows[0]?.photo_path||null;if(path&&!this.equipmentPhotoPathValid(path))throw Error('Référence photo invalide.');return path;
 }
 async equipmentPhotoUpload(blob){
  if(blob?.type!=='image/jpeg'||!blob.size||blob.size>200*1024)throw Error('Photo JPEG invalide (200 Ko maximum).');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const path=`${this.config.workspaceId}/${crypto.randomUUID()}_${hash}.jpg`,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{const response=await this.fetcher(this.config.url+'/storage/v1/object/equipment-photos/'+path,{method:'POST',headers:{apikey:this.config.publicKey,Authorization:'Bearer '+await this.token(),'Content-Type':'image/jpeg','x-upsert':'false'},body:blob,signal:controller.signal});const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.message||'Stockage privé des photos indisponible.');return path;}
  catch(error){if(error?.name==='AbortError')throw Error('Délai dépassé pendant l’envoi de la photo.');throw error;}
  finally{clearTimeout(timer);}
 }
 async equipmentPhotoSet(id,path){if(path!==null&&!this.equipmentPhotoPathValid(path))throw Error('Référence photo invalide.');return this.rpc('set_equipment_photo',{equipment_id:id,photo_path:path},60000);}
 async equipmentPhotoUrl(path){
  if(!this.equipmentPhotoPathValid(path))throw Error('Référence photo invalide.');
  const result=await this.request('/storage/v1/object/sign/equipment-photos/'+path,{expiresIn:120},await this.token()),raw=result.signedURL||result.signedUrl;
  if(typeof raw!=='string')throw Error('Lien photo indisponible.');
  const url=new URL(raw.startsWith('/object/')?'/storage/v1'+raw:raw,this.config.url);
  if(url.origin!==new URL(this.config.url).origin||url.pathname!=='/storage/v1/object/sign/equipment-photos/'+path)throw Error('Adresse photo refusée.');return url.href;
 }
 async equipmentPhotoBlob(path){
  const url=await this.equipmentPhotoUrl(path),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{const response=await this.fetcher(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Lecture de la photo impossible.');const blob=await response.blob();if(!blob.size||blob.size>200*1024)throw Error('Photo du matériel invalide.');return new Blob([blob],{type:'image/jpeg'});}
  finally{clearTimeout(timer);}
 }
 async equipmentPhotoRemove(path){
  if(!this.equipmentPhotoPathValid(path))throw Error('Référence photo invalide.');
  const response=await this.fetcher(this.config.url+'/storage/v1/object/equipment-photos/'+path,{method:'DELETE',headers:{apikey:this.config.publicKey,Authorization:'Bearer '+await this.token()},cache:'no-store'});if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.message||'Suppression de l’ancienne photo refusée.');}
 }
 async logout(){try{await this.request('/auth/v1/logout?scope=local',{},await this.token())}finally{this.session=null;this.remember=false;for(const place of [this.storage,this.persistentStorage]){try{place?.removeItem(this.key)}catch{}}}}
}
