const maxUploadBytes=12*1024*1024;
const maxStoredBytes=200*1024;

export async function prepareEquipmentPhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file?.type)||file.size>maxUploadBytes)throw Error('Choisissez une image JPEG, PNG ou WebP de 12 Mo maximum.');
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width*bitmap.height>40000000)throw Error('Image trop grande : 40 mégapixels maximum.');
  for(const [side,quality] of [[1200,.8],[1000,.72],[800,.64],[640,.54],[520,.44]]){
   const scale=Math.min(1,side/bitmap.width,side/bitmap.height),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const context=canvas.getContext('2d');if(!context)throw Error('Préparation de la photo indisponible.');
   context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
   if(blob?.size&&blob.size<=maxStoredBytes)return blob;
  }
  throw Error('La photo reste trop volumineuse après compression (200 Ko maximum).');
 }finally{bitmap.close();}
}

export async function equipmentMailPhoto(blob){
 if(!blob||blob.type!=='image/jpeg'||blob.size>maxStoredBytes)throw Error('Photo du matériel invalide.');
 const bitmap=await createImageBitmap(blob);
 try{
  if(bitmap.width>1200||bitmap.height>1200)throw Error('Dimensions de la photo invalides.');
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
  for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));
  return {width:bitmap.width,height:bitmap.height,data:btoa(binary)};
 }finally{bitmap.close();}
}

async function localDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open('vgp-equipment-photos-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Stockage local des photos indisponible.'));});}
async function localOperation(mode,operation){const db=await localDatabase();try{return await new Promise((resolve,reject)=>{const transaction=db.transaction('photos',mode),request=operation(transaction.objectStore('photos'));let result;request.onsuccess=()=>result=request.result;transaction.oncomplete=()=>resolve(result);transaction.onerror=transaction.onabort=()=>reject(transaction.error||Error('Écriture locale de la photo annulée.'));});}finally{db.close();}}
export const readLocalEquipmentPhoto=id=>localOperation('readonly',store=>store.get(id));
export const saveLocalEquipmentPhoto=(id,blob)=>localOperation('readwrite',store=>store.put(blob,id));
export const removeLocalEquipmentPhoto=id=>localOperation('readwrite',store=>store.delete(id));
