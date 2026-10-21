import {vgpMailKinds,vgpMailTemplateIssue,vgpMailAddressValid,buildVgpEquipmentMail,buildVgpMailDraft} from './vgp-mail.mjs?v=090';
import {createVgpGmail} from './vgp-mail-gmail.mjs?v=090';
import {equipmentName} from './domain.mjs';
import {equipmentMailRecipients} from './ownership.mjs';

export function installVgpMail({read,save,canEdit,accountEmail=()=>'',refresh=async()=>{},cleanForm=()=>{},gmailClientId='',defaults={},createLossLink=null}){
 const host=document.querySelector('#vgpMailWorkspace'),safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const gmail=createVgpGmail({clientId:gmailClientId}),drafts=new Map(),lossLinks=new Map();let kind='month',busy=false,lastSent='',uncertain=false;
 host.innerHTML=`<section class="mail-model-section"><div class="mail-section-heading"><div><span class="mail-kicker">01 · MESSAGES ENREGISTRÉS</span><h2>Choisir un modèle</h2></div><span class="mail-small-note">Le destinataire vient de la fiche propriétaire.</span></div><div id="mailModelCards" class="mail-model-cards"></div><details class="mail-edit-model"><summary>Modifier le modèle sélectionné</summary><form id="mailTemplateForm"><label>Objet<input id="mailSubject" required maxlength="300"></label><label>Message<textarea id="mailBody" rows="7" required maxlength="10000"></textarea></label><p class="foot">Champs disponibles : {{nom_proprietaire}}, {{nom_equipement}}, {{numero_interne}}, {{id_vgp}}, {{date_controle}}, {{secteur}}, {{zone}}.</p><button id="mailSaveTemplate" type="submit">Enregistrer le modèle</button><p id="mailTemplateSaved" role="status"></p><p id="mailTemplateError" class="error" role="alert"></p></form></details></section>
 <div class="mail-workspace-grid"><section class="mail-compose-card"><div class="mail-section-heading"><div><span class="mail-kicker">02 · PRÉPARER UN ENVOI</span><h2>Matériel et destinataire</h2><p>Un seul équipement, un seul destinataire.</p></div></div><form id="mailTestForm"><label>Rechercher un équipement<input id="mailEquipmentSearch" type="search" placeholder="Numéro interne ou nom du matériel…"></label><label>Équipement utilisé pour l’envoi<select id="mailSampleEquipment" data-native-select required></select></label><div id="mailEquipmentOwner" class="mail-owner-hint" role="status"></div><label>Depuis mon compte Gmail<input id="mailTestSender" type="email" required maxlength="254" autocomplete="email" placeholder="ton.adresse@gmail.com"></label><label>Destinataire<input id="mailTestRecipient" type="email" required maxlength="254" placeholder="Adresse du destinataire"></label><p class="foot">Tu peux remplacer cette adresse pour le test. La fiche propriétaire ne change pas.</p><div class="mail-photo-tools"><label>Photo du matériel<input id="mailPhotoFile" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="foot">La photo est conservée avec l’équipement et intégrée au mail.</p><p id="mailPhotoStatus" role="status"></p></div><label class="mail-mode-choice"><input id="mailIsTest" type="checkbox" checked><span>Mode test · aucune fiche modifiée</span></label><p class="mail-test-notice">Le mail porte la mention <strong>TEST</strong>. Aucun contrôle ni rappel automatique n’est créé.</p><div class="mail-send-actions"><button type="button" id="mailConnectGmail" class="secondary">Connecter Gmail</button><button type="submit" id="mailSendTest">Envoyer le test</button></div><p id="mailGmailStatus" class="foot" role="status"></p><p id="mailTestStatus" role="status"></p><p id="mailTestError" class="error" role="alert"></p><details class="mail-export-options"><summary>Autres options</summary><button type="button" id="mailCopy" class="secondary">Copier le mail mis en forme</button><button type="button" id="mailDownloadDraft" class="secondary">Télécharger le message (.eml)</button><p class="foot">Le fichier .eml contient le logo et la photo. Son ouverture en brouillon dépend de ta messagerie.</p></details></form></section>
 <section class="mail-preview-card"><div class="mail-section-heading"><div><span class="mail-kicker">03 · APERÇU DU MAIL</span><h2>Ce que recevra le destinataire</h2></div><span class="mail-test-tag">TEST</span></div><div class="mail-envelope"><p><span>À</span><strong id="mailPreviewRecipient">—</strong></p><p><span>Objet</span><strong id="mailPreviewSubject">—</strong></p></div><div id="mailPreviewEmpty" class="mail-preview-empty"><span aria-hidden="true">✉</span><h3>Ton mail prend forme ici</h3><p>Choisis un équipement pour afficher son rappel avec ses informations et sa photo.</p></div><iframe id="mailSettingsPreview" title="Aperçu du mail de rappel VGP" sandbox="allow-same-origin" hidden></iframe></section></div>`;
 const q=selector=>host.querySelector(selector),form=q('#mailTemplateForm'),testForm=q('#mailTestForm');
 q('#mailTestSender').value=defaults.sender||accountEmail();q('#mailTestRecipient').value=defaults.recipient||'';
 let recipientOverridden=!!defaults.recipient;
 // Les champs du test sont temporaires, contrairement aux modèles enregistrés.
 for(const event of ['input','change'])testForm.addEventListener(event,e=>e.stopPropagation());
 function model(){return {kind,subject:q('#mailSubject').value,body:q('#mailBody').value};}
 function options(){return {equipmentId:q('#mailSampleEquipment').value,kind,recipient:q('#mailTestRecipient').value.trim(),sender:q('#mailTestSender').value.trim(),test:q('#mailIsTest').checked,template:model(),siteUrl:location.origin+location.pathname};}
 function message(lossUrl=''){return buildVgpEquipmentMail(read(),{...options(),lossUrl});}
 async function withLossLink(base,required=false){
  if(!createLossLink){if(required||!base.test)throw Error('Le formulaire de perte nécessite Supabase et le script 024.');return base;}
  const key=JSON.stringify(base);let link=lossLinks.get(key);
  if(!link||Date.parse(link.expiresAt)<=Date.now()+60000){link=await createLossLink({equipmentId:base.equipmentId,recipient:base.recipient,test:base.test});lossLinks.set(key,link);}
  if(JSON.stringify(message())!==key)throw Error('Le message a changé. Relis le nouvel aperçu avant de continuer.');
  return message(link.url);
 }
 function markCards(){q('#mailModelCards').innerHTML=vgpMailKinds.map(row=>`<button type="button" class="mail-model-card" data-mail-kind="${row.kind}" aria-pressed="${row.kind===kind}"><span class="mail-model-stage">${row.label}</span><strong>${row.title}</strong><small>${row.description}</small></button>`).join('');q('#mailModelCards').querySelectorAll('button').forEach(button=>button.onclick=()=>{drafts.set(kind,model());kind=button.dataset.mailKind;loadModel();preview();});}
 function loadModel(){
  const template=drafts.get(kind)||(read().mailTemplates||[]).find(row=>row.kind===kind)||{subject:'',body:''};
  q('#mailSubject').value=template.subject;q('#mailBody').value=template.body;
  q('#mailTemplateSaved').textContent='';q('#mailTemplateError').textContent='';markCards();
 }
 function connection(){
  const current=gmail.active();q('#mailConnectGmail').disabled=busy||!gmail.configured();
  q('#mailConnectGmail').textContent=current?'Changer de compte Gmail':'Connecter Gmail';
  q('#mailGmailStatus').textContent=current?`Compte connecté : ${current.email}`:gmail.configured()?'Connecte ton compte Gmail pour envoyer le message depuis cette adresse.':'L’envoi direct nécessite de configurer la connexion Gmail du site. L’aperçu et le téléchargement du message sont disponibles.';
  q('#mailSendTest').textContent=q('#mailIsTest').checked?'Envoyer le test':'Envoyer le rappel';
  q('.mail-test-tag').textContent=q('#mailIsTest').checked?'TEST':'RAPPEL';
  q('#mailSendTest').disabled=busy||!current||!q('#mailSampleEquipment').value||uncertain;
 }
 function preview(){
  connection();q('#mailPreviewRecipient').textContent=q('#mailTestRecipient').value.trim()||'Choisis le matériel ou saisis une adresse';
  try{
   const mail=message();q('#mailSettingsPreview').hidden=false;q('#mailPreviewEmpty').hidden=true;q('#mailSettingsPreview').style.height='1px';q('#mailSettingsPreview').srcdoc=mail.previewHtml;
   q('#mailPreviewSubject').textContent=mail.subject;q('#mailCopy').disabled=false;q('#mailDownloadDraft').disabled=false;
   const equipment=read().equipment.find(e=>e.id===mail.equipmentId);q('#mailPhotoStatus').textContent=mail.hasPhoto?'Photo du matériel intégrée au mail.':'Ajoute une photo pour la voir dans le mail.';
   if(equipment)q('#mailEquipmentOwner').textContent='Propriétaire : '+(equipment.owner||'Non renseigné');
  }catch(error){q('#mailSettingsPreview').hidden=true;q('#mailPreviewEmpty').hidden=false;q('#mailPreviewSubject').textContent='—';q('#mailCopy').disabled=true;q('#mailDownloadDraft').disabled=true;}
 }
 q('#mailSettingsPreview').onload=()=>{const height=q('#mailSettingsPreview').contentDocument?.documentElement.scrollHeight;if(height)q('#mailSettingsPreview').style.height=height+'px';};
 function equipmentOptions(){
  const previous=q('#mailSampleEquipment').value,query=q('#mailEquipmentSearch').value.trim().toLocaleLowerCase('fr');
  const equipment=read().equipment.filter(e=>!e.archived&&(`${e.identifier} ${equipmentName(e)}`.toLocaleLowerCase('fr').includes(query)||e.id===previous));
  q('#mailSampleEquipment').innerHTML='<option value="">Choisir un équipement</option>'+equipment.map(e=>`<option value="${safe(e.id)}">${safe(e.identifier)} · ${safe(equipmentName(e))}</option>`).join('');
  if(equipment.some(e=>e.id===previous))q('#mailSampleEquipment').value=previous;
 }
 q('#mailEquipmentSearch').oninput=equipmentOptions;
 q('#mailSampleEquipment').onchange=()=>{
  const equipment=read().equipment.find(e=>e.id===q('#mailSampleEquipment').value);
  if(!recipientOverridden)q('#mailTestRecipient').value=equipment?equipmentMailRecipients(equipment,read().ownerContacts||[]).find(row=>vgpMailAddressValid(row.email))?.email||'':'';
  q('#mailTestError').textContent='';q('#mailTestStatus').textContent='';preview();
 };
 q('#mailTestRecipient').oninput=()=>{recipientOverridden=true;preview();};
 q('#mailTestSender').oninput=()=>{gmail.disconnect();preview();};
 let testRecipient=q('#mailTestRecipient').value;
 q('#mailIsTest').onchange=()=>{
  const test=q('#mailIsTest').checked,equipment=read().equipment.find(e=>e.id===q('#mailSampleEquipment').value);
  if(!test){testRecipient=q('#mailTestRecipient').value;recipientOverridden=false;q('#mailTestRecipient').value=equipment?equipmentMailRecipients(equipment,read().ownerContacts||[]).find(row=>vgpMailAddressValid(row.email))?.email||'':'';}
  else{q('#mailTestRecipient').value=testRecipient;recipientOverridden=!!testRecipient;}
  q('#mailTestRecipient').readOnly=!test;
  q('.mail-test-notice').textContent=test?'Le mail porte la mention TEST. Le formulaire de perte ne modifiera aucune fiche.':'Ce rappel est destiné au propriétaire associé. Une déclaration signée depuis son lien passera directement le matériel en perdu.';
  q('#mailTestStatus').textContent='';q('#mailTestError').textContent='';preview();
 };
 q('#mailSubject').oninput=q('#mailBody').oninput=()=>{drafts.set(kind,model());q('#mailTemplateSaved').textContent='Modifications non enregistrées.';preview();};
 form.onsubmit=async event=>{
  event.preventDefault();if(!canEdit()||busy)return;
  const template=model(),issue=vgpMailTemplateIssue(template);q('#mailTemplateError').textContent=issue;if(issue)return;
  const next=structuredClone(read()),index=next.mailTemplates.findIndex(row=>row.kind===kind);next.mailTemplates[index]=template;
  busy=true;q('#mailSaveTemplate').disabled=true;
  try{if(!await save(next))throw Error('Le modèle n’a pas pu être enregistré.');drafts.delete(kind);cleanForm(form);q('#mailTemplateSaved').textContent='Modèle enregistré.';preview();}catch(error){q('#mailTemplateError').textContent=error.message;}finally{busy=false;q('#mailSaveTemplate').disabled=!canEdit();connection();}
 };
 q('#mailPhotoFile').onchange=async event=>{
  const file=event.target.files[0],equipmentId=q('#mailSampleEquipment').value;
  if(!file)return;
  try{
   if(!canEdit())throw Error('Un accès en modification est nécessaire pour ajouter une photo.');
   if(!equipmentId)throw Error('Choisis d’abord l’équipement à photographier.');
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Utilise une photo JPG, PNG ou WebP de 8 Mo maximum.');
   busy=true;connection();q('#mailPhotoStatus').textContent='Préparation de la photo…';
   const url=URL.createObjectURL(file),image=new Image();let photo;
   try{
    image.src=url;await image.decode();const scale=Math.min(1,1000/image.width,1000/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    let quality=.86,data=canvas.toDataURL('image/jpeg',quality).split(',')[1];while(data.length>450000&&quality>.3){quality-=.1;data=canvas.toDataURL('image/jpeg',quality).split(',')[1];}
    if(data.length>450000)throw Error('La photo reste trop volumineuse. Utilise une image plus petite.');photo={width:canvas.width,height:canvas.height,data};
   }finally{URL.revokeObjectURL(url);}
   const next=structuredClone(read()),equipment=next.equipment.find(e=>e.id===equipmentId&&!e.archived);if(!equipment)throw Error('Cet équipement n’est plus disponible.');equipment.mailPhoto=photo;
   if(!await save(next))throw Error('La photo n’a pas pu être enregistrée.');q('#mailTestError').textContent='';preview();
  }catch(error){q('#mailTestError').textContent=error.message;}finally{event.target.value='';busy=false;connection();}
 };
 q('#mailConnectGmail').onclick=async()=>{
  if(busy)return;busy=true;connection();q('#mailTestError').textContent='';
  try{await gmail.connect(q('#mailTestSender').value.trim());}catch(error){q('#mailTestError').textContent=error.message;}finally{busy=false;connection();}
 };
 testForm.onsubmit=async event=>{
  event.preventDefault();if(busy||uncertain)return;
  q('#mailTestError').textContent='';q('#mailTestStatus').textContent='';
  try{
   const initial=message();if(!initial.recipient)throw Error('Renseigne le destinataire du message.');
   const signature=JSON.stringify(initial);if(signature===lastSent)throw Error('Ce message a déjà été envoyé. Modifie le message ou le matériel pour préparer un nouvel envoi.');
   busy=true;connection();q('#mailTestStatus').textContent='Vérification du matériel avant l’envoi…';await refresh(form);
   const current=message();if(JSON.stringify(current)!==signature){preview();throw Error('La fiche ou le destinataire a changé. L’aperçu est actualisé : relis-le avant d’envoyer.');}
   const ready=await withLossLink(current,true);q('#mailTestStatus').textContent='Envoi du message via Gmail…';const result=await gmail.sendMail(ready);lastSent=signature;q('#mailTestStatus').textContent=`${current.test?'Test':'Rappel'} envoyé à ${result.recipient} depuis ${current.sender}.`;
  }catch(error){uncertain=!!error.uncertain;q('#mailTestStatus').textContent='';q('#mailTestError').textContent=error.message;}finally{busy=false;connection();}
 };
 q('#mailDownloadDraft').onclick=async()=>{
  try{const mail=await withLossLink(message()),draft=buildVgpMailDraft(mail),url=URL.createObjectURL(new Blob([draft],{type:'message/rfc822'})),link=document.createElement('a');link.href=url;link.download=mail.test?'test-rappel-vgp.eml':'rappel-vgp.eml';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);q('#mailTestStatus').textContent='Message téléchargé avec ses images. Aucun envoi effectué.';}catch(error){q('#mailTestError').textContent=error.message;}
 };
 q('#mailCopy').onclick=async()=>{
  try{const mail=await withLossLink(message());await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([mail.previewHtml],{type:'text/html'}),'text/plain':new Blob([mail.text],{type:'text/plain'})})]);q('#mailTestStatus').textContent='Mail copié. Colle-le dans ta messagerie et vérifie la photo avant l’envoi.';}catch{q('#mailTestError').textContent='La copie mise en forme est indisponible dans ce navigateur. Télécharge le message avec ses images.';}
 };
 loadModel();
 return {render(){equipmentOptions();q('#mailSaveTemplate').disabled=!canEdit();q('#mailPhotoFile').disabled=!canEdit();if(!q('#mailTestSender').value)q('#mailTestSender').value=accountEmail();preview();}};
}
