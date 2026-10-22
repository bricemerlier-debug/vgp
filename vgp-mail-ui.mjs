import {vgpMailKinds,vgpMailTemplateIssue,vgpMailAddressValid,buildVgpEquipmentMail,buildVgpMailDraft} from './vgp-mail.mjs?v=102';
import {createVgpGmail} from './vgp-mail-gmail.mjs?v=102';
import {equipmentName} from './domain.mjs';
import {equipmentMailRecipients} from './ownership.mjs';

export function installVgpMail({read,save,canEdit,loadEquipmentPhoto=async()=>undefined,accountEmail=()=>'',refresh=async()=>{},cleanForm=()=>{},gmailClientId='',createLossLink=null}){
 const host=document.querySelector('#vgpMailWorkspace'),safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const gmail=createVgpGmail({clientId:gmailClientId}),drafts=new Map(),lossLinks=new Map();let kind='month',busy=false,lastSent='',uncertain=false,photo=undefined,photoEquipmentId='',photoLoading=false,photoError='',previewSerial=0,previewSignature='';
 host.innerHTML=`<section class="mail-model-section"><div class="mail-section-heading"><div><span class="mail-kicker">01 · MESSAGES ENREGISTRÉS</span><h2>Choisir un modèle</h2></div><span class="mail-small-note">Le destinataire vient de la fiche propriétaire.</span></div><div id="mailModelCards" class="mail-model-cards"></div><details class="mail-edit-model"><summary>Modifier le modèle sélectionné</summary><form id="mailTemplateForm"><label>Objet<input id="mailSubject" required maxlength="300"></label><label>Message<textarea id="mailBody" rows="7" required maxlength="10000"></textarea></label><p class="foot">Champs disponibles : {{nom_proprietaire}}, {{nom_equipement}}, {{numero_interne}}, {{id_vgp}}, {{date_controle}}, {{secteur}}, {{zone}}.</p><button id="mailSaveTemplate" type="submit">Enregistrer le modèle</button><p id="mailTemplateSaved" role="status"></p><p id="mailTemplateError" class="error" role="alert"></p></form></details></section>
 <div class="mail-workspace-grid"><section class="mail-compose-card"><div class="mail-section-heading"><div><span class="mail-kicker">02 · PRÉPARER UN ENVOI</span><h2>Matériel et destinataire</h2><p>Un seul équipement, un seul destinataire.</p></div></div><form id="mailSendForm"><label>Rechercher un équipement<input id="mailEquipmentSearch" type="search" placeholder="Numéro interne ou nom du matériel…"></label><label>Équipement concerné<select id="mailSampleEquipment" data-native-select required></select></label><div id="mailEquipmentOwner" class="mail-owner-hint" role="status"></div><label>Depuis mon compte Gmail<input id="mailSender" type="email" required maxlength="254" autocomplete="email" placeholder="ton.adresse@gmail.com"></label><label>Destinataire · adresse du propriétaire<input id="mailRecipient" type="email" required maxlength="254" readonly placeholder="Sélectionne un matériel avec une adresse associée"></label><p id="mailRecipientNote" class="foot">L’adresse est reprise de la fiche du propriétaire et ne peut pas être remplacée ici.</p><p class="mail-send-notice">Le message sera envoyé réellement. Si le destinataire signe une déclaration de perte ou de mise au rebut, la fiche sera archivée et un rapport sera créé. Aucun rappel automatique n’est activé.</p><div class="mail-send-actions"><button type="button" id="mailConnectGmail" class="secondary">Connecter Gmail</button><button type="submit" id="mailSend">Envoyer le rappel</button></div><p id="mailGmailStatus" class="foot" role="status"></p><p id="mailSendStatus" role="status"></p><p id="mailSendError" class="error" role="alert"></p><details class="mail-export-options"><summary>Autres options</summary><button type="button" id="mailCopy" class="secondary">Copier le mail mis en forme</button><button type="button" id="mailDownloadDraft" class="secondary">Télécharger le message (.eml)</button><p class="foot">Le fichier .eml contient le logo et la photo. Son ouverture en brouillon dépend de ta messagerie.</p></details></form></section>
 <section class="mail-preview-card"><div class="mail-section-heading"><div><span class="mail-kicker">03 · APERÇU DU MAIL</span><h2>Ce que recevra le destinataire</h2></div><span class="mail-live-tag">ENVOI RÉEL</span></div><div class="mail-envelope"><p><span>À</span><strong id="mailPreviewRecipient">—</strong></p><p><span>Objet</span><strong id="mailPreviewSubject">—</strong></p></div><div id="mailPreviewEmpty" class="mail-preview-empty"><span aria-hidden="true">✉</span><h3>Ton mail prend forme ici</h3><p>Choisis un équipement pour afficher son rappel avec ses informations et sa photo.</p></div><iframe id="mailSettingsPreview" title="Aperçu du mail de rappel VGP" sandbox="allow-same-origin" hidden></iframe></section></div>`;
 const q=selector=>host.querySelector(selector),form=q('#mailTemplateForm'),sendForm=q('#mailSendForm');
 q('#mailSender').value=accountEmail();
 for(const event of ['input','change'])sendForm.addEventListener(event,e=>e.stopPropagation());
 function model(){return {kind,subject:q('#mailSubject').value,body:q('#mailBody').value};}
 function options(){return {equipmentId:q('#mailSampleEquipment').value,kind,recipient:q('#mailRecipient').value.trim(),sender:q('#mailSender').value.trim(),test:false,template:model(),siteUrl:location.origin+location.pathname};}
 function message(lossUrl='',scrapUrl=''){return buildVgpEquipmentMail(read(),{...options(),lossUrl,scrapUrl,equipmentPhoto:photoEquipmentId===q('#mailSampleEquipment').value?photo:undefined});}
 async function preparedMessage(){
  const id=q('#mailSampleEquipment').value;if(!id)return message();
  const loaded=await loadEquipmentPhoto(id);if(id!==q('#mailSampleEquipment').value)throw Error('Le matériel sélectionné a changé.');
  photo=loaded;photoEquipmentId=id;photoError='';return message();
 }
 async function withLossLink(base,required=false){
  if(!createLossLink){if(required)throw Error('Le formulaire de déclaration nécessite Supabase et les scripts 024 et 025.');return base;}
  const key=JSON.stringify(base);let link=lossLinks.get(key);
  if(!link||Date.parse(link.expiresAt)<=Date.now()+60000){link=await createLossLink({equipmentId:base.equipmentId,recipient:base.recipient,test:base.test});lossLinks.set(key,link);}
  if(JSON.stringify(await preparedMessage())!==key)throw Error('Le message a changé. Relis le nouvel aperçu avant de continuer.');
  return message(link.url,link.scrapUrl);
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
  q('#mailGmailStatus').textContent=current?`Compte connecté : ${current.email}${createLossLink?'':' · Activez Supabase pour envoyer les déclarations avec ce rappel.'}`:gmail.configured()?'Connecte ton compte Gmail pour envoyer le message depuis cette adresse.':'L’envoi direct nécessite de configurer la connexion Gmail du site. L’aperçu et le téléchargement du message sont disponibles.';
  const equipment=read().equipment.find(row=>row.id===q('#mailSampleEquipment').value),ownerRecipients=equipmentMailRecipients(equipment||{},read().ownerContacts||[]).filter(row=>vgpMailAddressValid(row.email));
  const ownerEmail=ownerRecipients[0]?.email||'';
  if(q('#mailRecipient').value!==ownerEmail)q('#mailRecipient').value=ownerEmail;
  q('#mailSend').disabled=busy||photoLoading||!!photoError||!current||!createLossLink||!q('#mailSampleEquipment').value||!ownerEmail||uncertain;
 }
 function preview(){
  connection();q('#mailPreviewRecipient').textContent=q('#mailRecipient').value.trim()||'Aucune adresse valide sur la fiche propriétaire';
  const id=q('#mailSampleEquipment').value;
  if(id&&photoEquipmentId!==id&&!photoLoading){
   const serial=++previewSerial;photoLoading=true;photoError='';previewSignature='';connection();q('#mailSettingsPreview').hidden=true;q('#mailPreviewEmpty').hidden=false;q('#mailPreviewEmpty').querySelector('p').textContent='Chargement de la photo du matériel…';
   Promise.resolve(loadEquipmentPhoto(id)).then(loaded=>{if(serial!==previewSerial||id!==q('#mailSampleEquipment').value)return;photo=loaded;photoEquipmentId=id;photoLoading=false;preview();}).catch(error=>{if(serial!==previewSerial)return;photoLoading=false;photoError=error.message;q('#mailPreviewEmpty').querySelector('p').textContent='Photo indisponible : '+error.message;connection();});
   return;
  }
  if(photoLoading||photoError)return;
  try{
   const mail=message();previewSignature=JSON.stringify(mail);q('#mailSettingsPreview').hidden=false;q('#mailPreviewEmpty').hidden=true;q('#mailSettingsPreview').style.height='1px';q('#mailSettingsPreview').srcdoc=mail.previewHtml;
   q('#mailPreviewSubject').textContent=mail.subject;q('#mailCopy').disabled=false;q('#mailDownloadDraft').disabled=false;
   const equipment=read().equipment.find(e=>e.id===mail.equipmentId);
   if(equipment)q('#mailEquipmentOwner').textContent='Propriétaire : '+(equipment.owner||'Non renseigné');
  }catch(error){previewSignature='';q('#mailSettingsPreview').hidden=true;q('#mailPreviewEmpty').hidden=false;q('#mailPreviewSubject').textContent='—';q('#mailCopy').disabled=true;q('#mailDownloadDraft').disabled=true;}
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
  previewSerial++;photoLoading=false;photoError='';photoEquipmentId='';
  const equipment=read().equipment.find(e=>e.id===q('#mailSampleEquipment').value);
  q('#mailRecipient').value=equipment?equipmentMailRecipients(equipment,read().ownerContacts||[]).find(row=>vgpMailAddressValid(row.email))?.email||'':'';
  q('#mailSendError').textContent='';q('#mailSendStatus').textContent='';preview();
 };
 q('#mailSender').oninput=()=>{gmail.disconnect();preview();};
 q('#mailSubject').oninput=q('#mailBody').oninput=()=>{drafts.set(kind,model());q('#mailTemplateSaved').textContent='Modifications non enregistrées.';preview();};
 form.onsubmit=async event=>{
  event.preventDefault();if(!canEdit()||busy)return;
  const template=model(),issue=vgpMailTemplateIssue(template);q('#mailTemplateError').textContent=issue;if(issue)return;
  const next=structuredClone(read()),index=next.mailTemplates.findIndex(row=>row.kind===kind);next.mailTemplates[index]=template;
  busy=true;q('#mailSaveTemplate').disabled=true;
  try{if(!await save(next))throw Error('Le modèle n’a pas pu être enregistré.');drafts.delete(kind);cleanForm(form);q('#mailTemplateSaved').textContent='Modèle enregistré.';preview();}catch(error){q('#mailTemplateError').textContent=error.message;}finally{busy=false;q('#mailSaveTemplate').disabled=!canEdit();connection();}
 };
 q('#mailConnectGmail').onclick=async()=>{
  if(busy)return;busy=true;connection();q('#mailSendError').textContent='';
  try{await gmail.connect(q('#mailSender').value.trim());}catch(error){q('#mailSendError').textContent=error.message;}finally{busy=false;connection();}
 };
 sendForm.onsubmit=async event=>{
  event.preventDefault();if(busy||uncertain)return;
  q('#mailSendError').textContent='';q('#mailSendStatus').textContent='';
  try{
   const initial=await preparedMessage();if(!initial.recipient)throw Error('Aucune adresse e-mail valide n’est enregistrée pour le propriétaire de cet équipement.');
   if(!confirm(`Envoyer ce rappel à ${initial.recipient} pour l’équipement ${read().equipment.find(e=>e.id===initial.equipmentId)?.identifier||''} ?\n\nIl s’agit d’un vrai mail. Il contiendra les formulaires de perte et de mise au rebut. Toute déclaration signée modifiera la fiche et créera un rapport.`))return;
   if(JSON.stringify(initial)!==previewSignature){preview();throw Error('La photo ou la fiche a changé. Relis le nouvel aperçu avant d’envoyer.');}
   const signature=JSON.stringify(initial);if(signature===lastSent)throw Error('Ce message a déjà été envoyé. Modifie le message ou le matériel pour préparer un nouvel envoi.');
   busy=true;connection();q('#mailSendStatus').textContent='Vérification du matériel avant l’envoi…';await refresh(form);
   const current=await preparedMessage();if(JSON.stringify(current)!==signature){preview();throw Error('La fiche ou le destinataire a changé. L’aperçu est actualisé : relis-le avant d’envoyer.');}
   const ready=await withLossLink(current,true);q('#mailSendStatus').textContent='Envoi du rappel réel via Gmail…';const result=await gmail.sendMail(ready);lastSent=signature;q('#mailSendStatus').textContent=`Rappel envoyé à ${result.recipient} depuis ${current.sender}.`;
  }catch(error){uncertain=!!error.uncertain;q('#mailSendStatus').textContent='';q('#mailSendError').textContent=error.message;}finally{busy=false;connection();}
 };
 q('#mailDownloadDraft').onclick=async()=>{
  try{const mail=await withLossLink(await preparedMessage()),draft=buildVgpMailDraft(mail),url=URL.createObjectURL(new Blob([draft],{type:'message/rfc822'})),link=document.createElement('a');link.href=url;link.download='rappel-vgp.eml';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);q('#mailSendStatus').textContent='Brouillon téléchargé avec ses images. Aucun envoi effectué.';}catch(error){q('#mailSendError').textContent=error.message;}
 };
 q('#mailCopy').onclick=async()=>{
  try{const mail=await withLossLink(await preparedMessage());await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([mail.previewHtml],{type:'text/html'}),'text/plain':new Blob([mail.text],{type:'text/plain'})})]);q('#mailSendStatus').textContent='Mail copié. Vérifie son contenu avant de l’envoyer depuis ta messagerie.';}catch{q('#mailSendError').textContent='La copie mise en forme est indisponible dans ce navigateur. Télécharge le message avec ses images.';}
 };
 loadModel();
 return {render(){equipmentOptions();photoEquipmentId='';photoLoading=false;photoError='';previewSerial++;q('#mailSaveTemplate').disabled=!canEdit();if(!q('#mailSender').value)q('#mailSender').value=accountEmail();preview();}};
}
