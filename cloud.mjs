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
 constructor(config,{fetcher=(...args)=>globalThis.fetch(...args),storage=undefined}={}){this.config=validateConfig(config);this.fetcher=fetcher;try{this.storage=storage??globalThis.sessionStorage}catch{this.storage=null;}this.key='vgp-auth:'+this.config.url;this.session=null;this.revision=null;this.busy=false;try{this.session=JSON.parse(this.storage?.getItem(this.key)||'null')}catch{}}
 async request(path,body,token,method='POST'){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);let response,result;
  try{response=await this.fetcher(this.config.url+path,{method,headers:{apikey:this.config.publicKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:controller.signal});result=await response.json().catch(()=>({}));}
  catch{throw Error('Enregistrement non confirmé : vérifiez le réseau, puis actualisez avant de réessayer.');}
  finally{clearTimeout(timeout);}
  if(!response.ok)throw Error(response.status===401?'Session expirée : reconnectez-vous.':result.message||result.msg||result.error_description||'Opération Supabase refusée.');return result;
 }

 retain(session){this.session=session;try{this.storage?.setItem(this.key,JSON.stringify(session))}catch{}}
 async login(email,password){const session=await this.request('/auth/v1/token?grant_type=password',{email,password});session.expires_at=Math.floor(Date.now()/1000)+session.expires_in;this.retain(session);}
 async acceptLink(hash){const params=new URLSearchParams(hash.replace(/^#/,''));if(!params.has('access_token'))return null;const token=params.get('access_token');await this.request('/auth/v1/user',undefined,token,'GET');this.retain({access_token:token,refresh_token:params.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(params.get('expires_in')||3600)});return params.get('type');}
 async setPassword(password){await this.request('/auth/v1/user',{password},await this.token(),'PUT');}
 async resetPassword(email,redirect){await this.request('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{email});}
 async token(){if(!this.session?.access_token)throw Error('Connexion requise.');if((this.session.expires_at||0)<Date.now()/1000+60){const session=await this.request('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token});session.expires_at=Math.floor(Date.now()/1000)+session.expires_in;this.retain(session);}return this.session.access_token;}
 async rpc(name,body){return this.request('/rest/v1/rpc/'+name,{w:this.config.workspaceId,...body},await this.token());}
 async read(adoptRevision=true){const state=await this.rpc('read_state',{});if(!Number.isSafeInteger(state?.revision)||!state.payload||typeof state.payload!=='object')throw Error('Réponse Supabase invalide : aucune donnée affichée n’a été remplacée.');if(adoptRevision)this.revision=state.revision;return state;}
 async write(document,source=null){if(this.busy)throw Error('Un enregistrement est déjà en cours. Patientez.');this.busy=true;try{const result=await this.rpc('write_state',{expected_revision:this.revision,document,source});if(!Number.isSafeInteger(result?.revision)||result.revision!==this.revision+1)throw Error('Enregistrement non confirmé : réponse Supabase invalide. Actualisez avant de réessayer.');this.revision=result.revision;return result;}finally{this.busy=false;}}
 async migrate(document,source){if(this.revision!==0)throw Error('Migration initiale autorisée uniquement dans un espace vierge.');const result=await this.write(document,source);const readback=await this.read();if(canonical(document)!==canonical(readback.payload))throw Error('Les données relues ne correspondent pas. Conservez votre sauvegarde et contactez l’administrateur.');return {...result,payload:readback.payload};}
 async validate(receipt,document){await this.rpc('validate_migration',{receipt,expected_document:document});}
 async logout(){try{await this.request('/auth/v1/logout',{},await this.token())}finally{this.session=null;this.storage?.removeItem(this.key);}}
}
