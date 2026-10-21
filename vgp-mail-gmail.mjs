import {buildVgpMailDraft,vgpMailAddressValid} from './vgp-mail.mjs?v=087';

// Le compte est autorisé par Google ; aucun mot de passe ni jeton n'est sauvegardé.
export function createVgpGmail({clientId='',browser=globalThis,fetcher=(...args)=>fetch(...args),now=()=>Date.now()}={}){
 let session=null,script=null;
 const configured=()=>/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId);
 async function load(){
  if(browser.google?.accounts?.oauth2)return;
  if(!script)script=new Promise((resolve,reject)=>{
   const element=browser.document.createElement('script');element.src='https://accounts.google.com/gsi/client';element.async=true;
   element.onload=resolve;element.onerror=()=>{script=null;reject(Error('La connexion Google n’a pas pu être chargée.'));};browser.document.head.append(element);
  });
  await script;
 }
 function active(){return session&&session.expiresAt>now()+30000?{email:session.email}:null;}
 return {
  configured,active,disconnect(){session=null;},
  async connect(email){
   session=null;
   if(!configured())throw Error('La connexion Gmail doit être configurée une fois pour ce site. Aucun mot de passe n’est à saisir ici.');
   if(!vgpMailAddressValid(email))throw Error('Renseigne ton adresse Gmail avant de te connecter.');
   await load();
   const token=await new Promise((resolve,reject)=>{
    const client=browser.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',hint:email,include_granted_scopes:false,callback:result=>result.error?reject(Error('Autorisation Gmail refusée ou annulée.')):resolve(result),error_callback:()=>reject(Error('Connexion Gmail annulée.'))});
    client.requestAccessToken({prompt:'consent'});
   });
   const response=await fetcher('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+token.access_token}});
   if(!response.ok)throw Error('Impossible de vérifier le compte Gmail connecté.');
   const user=await response.json();
   if(user.email_verified!==true||String(user.email||'').toLowerCase()!==email.toLowerCase())throw Error('Connecte le compte Gmail correspondant à l’adresse expéditrice indiquée.');
   session={email:user.email,token:token.access_token,expiresAt:now()+Number(token.expires_in||3600)*1000};return {email:session.email};
  },
  async sendTest(mail){
   if(!mail.test)throw Error('Seuls les messages de test peuvent être envoyés depuis cet écran.');
   return this.sendMail(mail);
  },
  async sendMail(mail){
   if(!mail.test&&!mail.lossUrl)throw Error('Le rappel doit comporter le lien de déclaration destiné au propriétaire.');
   if(!active()||session.email.toLowerCase()!==mail.sender.toLowerCase())throw Error('Connecte le compte Gmail choisi pour envoyer ce message.');
   const mime=buildVgpMailDraft(mail).replace('X-Unsent: 1\r\n','');let raw='';for(const byte of new TextEncoder().encode(mime))raw+=String.fromCharCode(byte);
   const body={raw:btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')},controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),30000);
   try{
    const response=await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    if(response.status===401){session=null;throw Error('La connexion Gmail a expiré. Reconnecte ton compte.');}
    if(!response.ok&&response.status<500)throw Error('Gmail a refusé l’envoi. Vérifie les autorisations du compte connecté.');
    if(!response.ok)throw Object.assign(Error('Envoi non confirmé. Vérifie les messages envoyés dans Gmail avant tout nouvel essai.'),{uncertain:true});
    let result;try{result=await response.json();}catch{throw Object.assign(Error('Réponse Gmail incomplète : vérifie les messages envoyés avant de réessayer.'),{uncertain:true});}
    if(!result.id)throw Object.assign(Error('Réponse Gmail incomplète : vérifie les messages envoyés avant de réessayer.'),{uncertain:true});
    return {id:result.id,recipient:mail.recipient};
   }catch(error){
    if(error.name==='AbortError'||error instanceof TypeError)throw Object.assign(Error('Envoi non confirmé. Vérifie les messages envoyés dans Gmail avant tout nouvel essai.'),{uncertain:true});
    throw error;
   }finally{clearTimeout(timer);}
  }
 };
}
