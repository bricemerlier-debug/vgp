import {createLossLinkClient} from './loss-link-api.mjs';
const $=selector=>document.querySelector(selector),token=new URLSearchParams(location.hash.slice(1)).get('token');
let api,info,busy=false,signed=false,lastPoint=null;
const canvas=$('#lossSignature'),context=canvas.getContext('2d');
function clearSignature(){context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.strokeStyle='#073467';context.lineWidth=2.4;context.lineCap='round';signed=false;lastPoint=null;}
function point(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}
canvas.onpointerdown=event=>{if(busy)return;event.preventDefault();lastPoint=point(event);canvas.setPointerCapture(event.pointerId);};
canvas.onpointermove=event=>{if(!lastPoint||busy)return;const next=point(event);context.beginPath();context.moveTo(lastPoint.x,lastPoint.y);context.lineTo(next.x,next.y);context.stroke();if(Math.hypot(next.x-lastPoint.x,next.y-lastPoint.y)>1)signed=true;lastPoint=next;};
canvas.onpointerup=canvas.onpointercancel=()=>{lastPoint=null;};
$('#lossClearSignature').onclick=()=>{if(!busy)clearSignature();};
$('#lossSigner').oninput=()=>{if(signed)clearSignature();};
$('#lossSignWithName').onclick=()=>{if(busy)return;const name=$('#lossSigner').value.trim();if(name.length<3){$('#lossSubmitError').textContent='Renseignez votre prénom et votre nom avant de signer.';$('#lossSigner').focus();return;}clearSignature();context.fillStyle='#073467';context.font='italic 36px Georgia, serif';context.fillText(name,25,115,670);signed=true;$('#lossSubmitError').textContent='';};
function success(receipt){
 $('#lossPanel').hidden=true;$('#lossSuccess').hidden=false;
 $('#lossSuccessText').textContent=receipt.test?`Test terminé pour ${receipt.number}. Aucun matériel n’a été marqué perdu.`:`Le matériel ${receipt.number} a été déclaré perdu. Déclaration signée par ${receipt.signer} le ${receipt.date.split('-').reverse().join('/')}${receipt.reportId?' · Rapport n° '+receipt.reportId:''}.`;
}
async function start(){
 try{
  api=createLossLinkClient(window.VGP_CLOUD);info=await api.read(token);
  if(info.status==='submitted'){success(info.receipt);return;}
  if(info.status!=='ready'||!info.equipment||!info.recipient)throw Error('Ce lien n’est plus utilisable. Contactez le service Métrologie.');
  $('#lossEquipmentNumber').textContent=info.equipment.number;$('#lossEquipmentName').textContent=info.equipment.name;
  $('#lossEquipmentSerial').textContent=info.equipment.serialNumber?'N° de série : '+info.equipment.serialNumber:'';$('#lossRecipient').textContent=info.recipient;
  const photo=info.equipment.photo;if(photo&&/^\/9j\/[A-Za-z0-9+/=]+$/.test(photo.data||'')){$('#lossEquipmentPhoto').src='data:image/jpeg;base64,'+photo.data;$('#lossEquipmentPhoto').hidden=false;}
  $('#lossTestNotice').hidden=!info.test;
  if(info.test){$('#lossSubmit').textContent='Signer et valider le test';$('.loss-effect').textContent='Ce formulaire est un test : la signature sera reçue sans modifier la fiche du matériel.';}
  clearSignature();$('#lossPanel').hidden=false;
 }catch(error){$('#lossError').textContent=error.message;}finally{$('#lossLoading').hidden=true;}
}
$('#lossForm').onsubmit=async event=>{
 event.preventDefault();if(busy)return;$('#lossSubmitError').textContent='';
 if(!signed){$('#lossSubmitError').textContent='Ajoutez votre signature avant de valider.';return;}
 busy=true;$('#lossSubmit').disabled=true;$('#lossClearSignature').disabled=true;$('#lossSignWithName').disabled=true;$('#lossSubmitStatus').textContent='Enregistrement de la déclaration…';
 try{const signature={width:canvas.width,height:canvas.height,data:canvas.toDataURL('image/jpeg',.88).split(',')[1]};
  const receipt=await api.submit(token,{name:$('#lossSigner').value.trim(),details:$('#lossDetails').value.trim(),signature,accepted:$('#lossAccepted').checked});
  if(!receipt?.id||!receipt.number)throw Error('Enregistrement non confirmé. Rouvrez ce même lien pour vérifier.');success(receipt);
 }catch(error){
  try{const state=await api.read(token);if(state.status==='submitted'){success(state.receipt);return;}}catch{}
  $('#lossSubmitError').textContent=error.message;
 }finally{busy=false;$('#lossSubmit').disabled=false;$('#lossClearSignature').disabled=false;$('#lossSignWithName').disabled=false;$('#lossSubmitStatus').textContent='';}
};
start();
