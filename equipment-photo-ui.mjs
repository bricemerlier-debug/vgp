import {equipmentMailPhoto,prepareEquipmentPhoto,readLocalEquipmentPhoto,removeLocalEquipmentPhoto,saveLocalEquipmentPhoto} from './equipment-photo.mjs';

export function installEquipmentPhoto({cloud,read,save,canEdit}){
 let active=0,busy=false,localUrl=null;const mailCache=new Map();
 const release=()=>{if(localUrl){URL.revokeObjectURL(localUrl);localUrl=null;}};
 const visible=(root,serial)=>root?.isConnected&&serial===active;
 async function open(e,root){
  const serial=++active;release();if(!root)return;
  root.innerHTML=`<div class="equipment-photo-frame"><img id="equipmentPhotoImage" alt="Photo de l’équipement" hidden><div id="equipmentPhotoPlaceholder"><span aria-hidden="true">＋</span><small>Photo de l’équipement</small></div></div><input id="equipmentPhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="equipment-photo-actions"><button type="button" id="equipmentPhotoPick" class="secondary">Ajouter une photo</button><button type="button" id="equipmentPhotoRemove" class="secondary" hidden>Retirer</button></div><p id="equipmentPhotoStatus" class="foot" role="status"></p><p id="equipmentPhotoError" class="error" role="alert"></p>`;
  const q=selector=>root.querySelector(selector),input=q('#equipmentPhotoInput'),pick=q('#equipmentPhotoPick'),remove=q('#equipmentPhotoRemove'),status=q('#equipmentPhotoStatus'),error=q('#equipmentPhotoError'),image=q('#equipmentPhotoImage'),placeholder=q('#equipmentPhotoPlaceholder');
  const setBusy=value=>{busy=value;pick.disabled=remove.disabled=value||!canEdit();};
  pick.disabled=!canEdit();pick.onclick=()=>input.click();
  let path=null;
  try{
   status.textContent='Chargement de la photo…';
   path=cloud?await cloud.equipmentPhotoPath(e.id):null;
   const blob=cloud?null:await readLocalEquipmentPhoto(e.id);
   if(!visible(root,serial))return;
   if(path){image.src=await cloud.equipmentPhotoUrl(path);if(!visible(root,serial))return;}
   else if(blob){localUrl=URL.createObjectURL(blob);image.src=localUrl;}
   else if(e.mailPhoto?.data&&e.mailPhoto?.width&&e.mailPhoto?.height){image.src='data:image/jpeg;base64,'+e.mailPhoto.data;}
   if(image.src){image.hidden=false;placeholder.hidden=true;remove.hidden=false;pick.textContent='Changer la photo';status.textContent='Photo de l’équipement.';}
   else status.textContent='Aucune photo enregistrée.';
  }catch(cause){if(visible(root,serial)){status.textContent='Photo indisponible.';error.textContent=cause.message;}}
  input.onchange=async()=>{
   const file=input.files?.[0];input.value='';if(!file||busy)return;
   setBusy(true);error.textContent='';status.textContent='Préparation de la photo…';let uploaded=null,cleanupWarning='';
   try{
    const blob=await prepareEquipmentPhoto(file);status.textContent='Enregistrement de la photo…';
    if(cloud){uploaded=await cloud.equipmentPhotoUpload(blob);const result=await cloud.equipmentPhotoSet(e.id,uploaded);uploaded=null;const previous=result.previousPath;if(previous&&previous!==result.path){try{await cloud.equipmentPhotoRemove(previous);}catch{cleanupWarning=' Ancienne copie à nettoyer.';}}}
    else await saveLocalEquipmentPhoto(e.id,blob);
    mailCache.delete(e.id);if(visible(root,serial)){await open(e,root);root.querySelector('#equipmentPhotoStatus').textContent='Photo enregistrée.'+cleanupWarning;}
   }catch(cause){if(uploaded)try{await cloud.equipmentPhotoRemove(uploaded);}catch{}if(visible(root,serial)){error.textContent=cause.message+(cloud?' Vérifiez que supabase/029_equipment_photos.sql est installé.':'');status.textContent='La photo n’a pas été enregistrée.';}}
   finally{if(visible(root,serial))setBusy(false);else busy=false;}
  };
  remove.onclick=async()=>{
   if(busy||!canEdit())return;setBusy(true);error.textContent='';status.textContent='Retrait de la photo…';
   try{
    let cleanupWarning='';
    if(path){await cloud.equipmentPhotoSet(e.id,null);try{await cloud.equipmentPhotoRemove(path);}catch{cleanupWarning=' Ancienne copie à nettoyer.';}}
    else if(!cloud&&await readLocalEquipmentPhoto(e.id))await removeLocalEquipmentPhoto(e.id);
    else if(e.mailPhoto){const next=structuredClone(read()),target=next.equipment.find(row=>row.id===e.id);delete target.mailPhoto;if(!await save(next,false,{timeoutMs:60000}))throw Error('La photo n’a pas été retirée.');}
    mailCache.delete(e.id);if(visible(root,serial)){await open(read().equipment.find(row=>row.id===e.id)||e,root);root.querySelector('#equipmentPhotoStatus').textContent='Photo retirée.'+cleanupWarning;}
   }catch(cause){if(visible(root,serial)){error.textContent=cause.message;status.textContent='La photo n’a pas été retirée.';}}
   finally{if(visible(root,serial))setBusy(false);else busy=false;}
  };
 }
 async function mailPhoto(id){
  if(cloud){let path;try{path=await cloud.equipmentPhotoPath(id);}catch(error){if(/equipment_photos|PGRST205|schema cache|not find the table/i.test(error.message))return undefined;throw error;}if(!path){mailCache.delete(id);return undefined;}const cached=mailCache.get(id);if(cached?.path===path)return cached.photo;const photo=await equipmentMailPhoto(await cloud.equipmentPhotoBlob(path));mailCache.clear();mailCache.set(id,{path,photo});return photo;}
  const blob=await readLocalEquipmentPhoto(id);return blob?equipmentMailPhoto(blob):undefined;
 }
 return {open,mailPhoto,release,get busy(){return busy;}};
}
