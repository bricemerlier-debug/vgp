export function equipmentLossFormUrl(siteUrl,token){
 if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('Lien de déclaration invalide.');
 const url=new URL('declarer-perte.html',siteUrl);if(!['https:','http:'].includes(url.protocol))throw Error('Adresse du formulaire invalide.');
 url.hash='token='+token;return url.href;
}
export function createLossLinkClient(config,{fetcher=(...args)=>fetch(...args)}={}){
 if(!config?.enabled||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url||'')||!config.publicKey)throw Error('Le formulaire n’est pas activé sur ce site.');
 const endpoint=config.url.replace(/\/$/,'')+'/rest/v1/rpc/';
 async function rpc(name,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetcher(endpoint+name,{method:'POST',headers:{apikey:config.publicKey,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
   const value=await response.json().catch(()=>({}));
   if(!response.ok){if(response.status===404)throw Error('Ce formulaire n’est pas encore activé. Contactez le service Métrologie.');throw Error(value.message||'Ce lien est invalide, expiré ou n’est plus utilisable.');}
   return value;
  }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw Error('Enregistrement non confirmé. Rouvrez ce même lien pour vérifier avant de réessayer.');throw error;}
  finally{clearTimeout(timer);}
 }
 const check=token=>{if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('Ce lien est invalide ou incomplet. Ouvrez le lien reçu par mail.');};
 return {read(token){check(token);return rpc('read_equipment_loss_link',{token});},submit(token,{name,details,signature,accepted}){check(token);return rpc('submit_equipment_loss',{token,signer_name:name,search_details:details,signature,accepted});}};
}
