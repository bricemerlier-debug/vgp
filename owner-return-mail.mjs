import {equipmentHasOwner} from './ownership.mjs';
import {due,status,equipmentName} from './domain.mjs';
import {sectorLabel} from './sectors.mjs';

export function ownerReturnMail(state,owner,date){
 const clean=value=>String(value??'').replace(/[\r\n]+/g,' ').trim();
 const contact=state.ownerContacts.find(c=>c.owner.trim().toLowerCase()===owner.trim().toLowerCase());
 const email=contact?.email?.trim()||'';
 const items=state.equipment.filter(e=>equipmentHasOwner(e,owner)&&!e.archived&&['En retard','À faire'].includes(status(e,date))).sort((a,b)=>due(a).localeCompare(due(b))||a.identifier.localeCompare(b.identifier,'fr',{numeric:true}));
 const format=value=>value.split('-').reverse().join('/');
 const subject=`Retour du matériel au service Métrologie — ${clean(owner)}`;
 const body=`Bonjour ${clean(owner)},\n\nMerci de retourner au service Métrologie les équipements suivants pour leur contrôle VGP :\n\n${items.map(e=>`• ${clean(e.identifier)} — ${clean(equipmentName(e))}\n  Échéance : ${format(due(e))} — ${status(e,date)}${e.sector?' — '+clean(sectorLabel(e.sector)):''}${e.zone?' / '+clean(e.zone):''}`).join('\n\n')}\n\nMerci de nous indiquer vos disponibilités pour organiser le retour du matériel.\n\nCordialement,\nService Métrologie`;
 const issue=!items.length?'Aucun équipement en retard ou à faire pour cette personne.':!email?'Adresse e-mail manquante : complétez et enregistrez la fiche propriétaire.':email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/[\r\n]/.test(email)?'Adresse e-mail invalide : corrigez et enregistrez la fiche propriétaire.':'';
 const uri=issue?'':`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
 return {email,subject,body,count:items.length,issue,uri};
}

export function installOwnerReturnMail({getState,getDate,refreshState=async()=>{},onClose=()=>{}}){
 const dialog=document.createElement('dialog');dialog.id='ownerReturnMail';dialog.setAttribute('aria-labelledby','ownerReturnMailTitle');
 dialog.innerHTML='<div class="toolbar"><h2 id="ownerReturnMailTitle">Demander le retour du matériel</h2><button type="button" class="secondary" aria-label="Fermer">×</button></div><p>Préparation manuelle : aucun e-mail n’est envoyé par le site. Relisez le message avant de l’envoyer depuis votre messagerie.</p><p data-mail-count></p><label>Destinataire enregistré<input data-mail-recipient readonly></label><label>Objet<input data-mail-subject readonly></label><label>Message<textarea data-mail-body rows="12" readonly></textarea></label><p data-mail-status role="status"></p><div class="actions"><button type="button" data-mail-open>Ouvrir dans ma messagerie</button><button type="button" class="secondary" data-mail-copy>Copier le mail</button></div>';
 document.body.append(dialog);dialog.addEventListener('close',onClose);
 const q=s=>dialog.querySelector(s);let owner='',snapshot;
 q('[aria-label="Fermer"]').onclick=()=>dialog.close();
 function refresh(){snapshot=ownerReturnMail(getState(),owner,getDate());q('[data-mail-count]').textContent=`${snapshot.count} équipement(s) en retard ou à faire · archives exclues.`;q('[data-mail-recipient]').value=snapshot.email;q('[data-mail-subject]').value=snapshot.subject;q('[data-mail-body]').value=snapshot.body;q('[data-mail-status]').textContent=snapshot.issue||(snapshot.uri.length>1800?'Liste longue : copiez le mail dans votre messagerie pour conserver tous les équipements.':'');q('[data-mail-open]').disabled=!!snapshot.issue||snapshot.uri.length>1800;q('[data-mail-copy]').disabled=!!snapshot.issue;}
 async function current(){try{await refreshState();}catch(error){q('[data-mail-status]').textContent=error.message;return false;}const next=ownerReturnMail(getState(),owner,getDate());if(JSON.stringify(next)!==JSON.stringify(snapshot)){refresh();q('[data-mail-status]').textContent='La situation ou le destinataire a changé. Le message a été actualisé : relisez-le avant de continuer. '+snapshot.issue;return false;}return !snapshot.issue;}
 q('[data-mail-open]').onclick=async()=>{if(!await current())return;window.location.href=snapshot.uri;q('[data-mail-status]').textContent='Ouverture demandée à votre messagerie. Aucun envoi effectué par le site.';};
 q('[data-mail-copy]').onclick=async()=>{if(!await current())return;try{await navigator.clipboard.writeText(`À : ${snapshot.email}\nObjet : ${snapshot.subject}\n\n${snapshot.body}`);q('[data-mail-status]').textContent='Mail copié. Collez-le dans votre messagerie pour l’envoyer manuellement.';}catch{q('[data-mail-body]').select();q('[data-mail-status]').textContent='Copie automatique indisponible. Copiez le message sélectionné, puis le destinataire et l’objet.';}};
 return {async open(name){owner=name;refresh();dialog.showModal();try{await refreshState();refresh();}catch(error){q('[data-mail-status]').textContent=error.message;q('[data-mail-open]').disabled=true;q('[data-mail-copy]').disabled=true;}}};
}
