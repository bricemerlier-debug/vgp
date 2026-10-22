import {equipmentName,due,fillEmailTemplate} from './domain.mjs';
import {equipmentMailRecipients,ownerIdentityKey} from './ownership.mjs';
import {goodyearReportLogo} from './assets/report-logo.mjs';

export const vgpMailKinds=[
 {kind:'month',title:'Un mois avant',label:'J−30',description:'Prévoir le prochain contrôle.'},
 {kind:'twoWeeks',title:'Deux semaines avant',label:'J−14',description:'Organiser le retour du matériel.'},
 {kind:'week',title:'Une semaine avant',label:'J−7',description:'Rappeler le contrôle à venir.'},
 {kind:'deadline',title:'Le jour de l’échéance',label:'Jour J',description:'Signaler que le contrôle arrive à échéance.'},
 {kind:'overdue',title:'Contrôle en retard',label:'Tous les 7 jours',description:'Relancer après l’échéance jusqu’au contrôle ou à la sortie du parc.'}
];
const mailHtmlEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function vgpMailAddressValid(value){return typeof value==='string'&&value.length<=254&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(value);}
export function vgpMailPhotoValid(photo){return photo===undefined||photo===null||Number.isInteger(photo.width)&&photo.width>0&&photo.width<=1200&&Number.isInteger(photo.height)&&photo.height>0&&photo.height<=1200&&typeof photo.data==='string'&&photo.data.length<=450000&&/^\/9j\/[A-Za-z0-9+/=]+$/.test(photo.data);}
export function vgpMailDefaultTemplates(){
 return vgpMailKinds.map(({kind})=>({kind,
  subject:(kind==='overdue'?'Contrôle VGP en retard':kind==='deadline'?'Échéance du contrôle VGP atteinte':kind==='month'?'Contrôle VGP à prévoir':'Rappel de contrôle VGP')+' — {{numero_interne}}',
  body:'Bonjour {{nom_proprietaire}},\n\n'+(kind==='overdue'?'Le contrôle VGP de votre matériel {{nom_equipement}} (n° {{numero_interne}}), prévu le {{date_controle}}, est en retard.':kind==='deadline'?'L’échéance du contrôle VGP de votre matériel {{nom_equipement}} (n° {{numero_interne}}) est atteinte le {{date_controle}}.':'Le prochain contrôle VGP de votre matériel {{nom_equipement}} (n° {{numero_interne}}) est prévu pour le {{date_controle}}.')+'\n\n'+(kind==='month'?'Merci d’organiser son retour au service Métrologie avant cette date.':'Merci de présenter le matériel au service Métrologie pour réaliser son contrôle.')+'\n\nMerci de votre collaboration.\nService Métrologie — Goodyear Amiens'
 }));
}
export function vgpMailTemplateIssue(template){
 if(!template?.subject?.trim()||template.subject.length>300||!template.body?.trim()||template.body.length>10000)return 'Renseigne un objet et un message (300 et 10 000 caractères maximum).';
 const allowed=['nom_equipement','numero_interne','id_vgp','nom_proprietaire','date_controle','secteur','zone'];
 const unknown=[...template.subject.matchAll(/\{\{([^{}]*)\}\}/g),...template.body.matchAll(/\{\{([^{}]*)\}\}/g)].map(match=>match[1].trim()).filter(token=>!allowed.includes(token));
 return unknown.length?'Champs inconnus : '+[...new Set(unknown)].join(', '):'';
}
export function buildVgpEquipmentMail(state,{equipmentId,kind='month',recipient='',sender='',test=true,template=null,lossUrl='',scrapUrl=''}={}){
 const equipment=(state.equipment||[]).find(e=>e.id===equipmentId&&!e.archived);
 if(!equipment)throw Error('Choisis un équipement actif pour préparer le mail.');
 const model=template||(state.mailTemplates||[]).find(row=>row.kind===kind),issue=vgpMailTemplateIssue(model);
 if(issue)throw Error(issue);
 const stage=vgpMailKinds.find(row=>row.kind===kind);if(!stage)throw Error('Choisis un modèle de rappel.');
 const recipients=equipmentMailRecipients(equipment,state.ownerContacts||[]),email=recipient.trim()||recipients.find(row=>vgpMailAddressValid(row.email))?.email||'';
 if(email&&!vgpMailAddressValid(email))throw Error('L’adresse du destinataire n’est pas valide.');
 if(sender&&!vgpMailAddressValid(sender.trim()))throw Error('L’adresse expéditrice n’est pas valide.');
 const contact=(state.ownerContacts||[]).find(row=>ownerIdentityKey(row.email)===ownerIdentityKey(email)),deadline=due(equipment),format=value=>value?value.split('-').reverse().join('/'):'À renseigner';
 const values={nom_equipement:equipmentName(equipment)||'Matériel',numero_interne:equipment.identifier,id_vgp:equipment.siteId||'—',nom_proprietaire:contact?.owner||equipment.owner||'à vous',date_controle:format(deadline),secteur:equipment.sector||'Non renseigné',zone:equipment.zone||'Non renseignée'};
 const subject=(test?'[TEST] ':'')+fillEmailTemplate(model.subject,values),body=fillEmailTemplate(model.body,values);
 const logo=state.reportLogo||goodyearReportLogo,photo=vgpMailPhotoValid(equipment.mailPhoto)?equipment.mailPhoto:null;
 const attachments=[{cid:'goodyear-logo',name:'goodyear.jpg',type:'image/jpeg',data:logo.data}];
 if(photo)attachments.push({cid:'equipment-photo',name:'equipement.jpg',type:'image/jpeg',data:photo.data});
 let declarationUrl='';if(lossUrl){const url=new URL(lossUrl);if(!['https:','http:'].includes(url.protocol)||!url.pathname.endsWith('/declarer-perte.html')||!/^#token=[a-f0-9]{64}$/.test(url.hash))throw Error('Lien de déclaration invalide.');declarationUrl=url.href;}
 let disposalUrl='';if(scrapUrl){const url=new URL(scrapUrl);if(!['https:','http:'].includes(url.protocol)||!url.pathname.endsWith('/declarer-rebut.html')||!/^#token=[a-f0-9]{64}$/.test(url.hash))throw Error('Lien de mise au rebut invalide.');disposalUrl=url.href;}
 const declarationCard=(title,description,label,url,accent)=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="height:100%;background:#f4f8fd;border:1px solid #d6e3f0;border-top:4px solid ${accent};border-radius:9px"><tr><td style="padding:17px;vertical-align:top"><p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#073467">${title}</p><p style="margin:0 0 15px;font-size:12px;line-height:1.6;color:#244c75">${description}${test?' Ce message est un test : aucune fiche ne sera modifiée.':''}</p>${url?`<a href="${mailHtmlEscape(url)}" style="display:inline-block;padding:11px 13px;border-radius:7px;background:#0055a4;font-size:12px;font-weight:700;color:#ffffff;text-decoration:none">${label}</a>`:`<span style="display:inline-block;padding:11px 13px;border-radius:7px;background:#0055a4;font-size:12px;font-weight:700;color:#ffffff">${label}</span><p style="margin:10px 0 0;font-size:11px;color:#59728e">Le lien personnel sera ajouté lors de la préparation de l’envoi.</p>`}</td></tr></table>`;
 const render=(inline=false)=>{
  const img=id=>inline?`data:image/jpeg;base64,${attachments.find(a=>a.cid===id).data}`:`cid:${id}`;
  const row=(label,value)=>`<tr><td style="padding:11px 14px;border-bottom:1px solid #e4ecf4;font-size:13px;color:#59728e;width:36%;vertical-align:top">${mailHtmlEscape(label)}</td><td style="padding:11px 14px;border-bottom:1px solid #e4ecf4;font-size:14px;color:#073467;font-weight:700;vertical-align:top;word-break:break-word">${mailHtmlEscape(value||'Non renseigné')}</td></tr>`;
  const photoWidth=photo?Math.min(540,photo.width,Math.round(photo.width*290/photo.height)):0;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media screen and (max-width:480px){.mail-action-cell{display:block!important;width:100%!important;box-sizing:border-box!important}}</style><title>${mailHtmlEscape(subject)}</title></head><body style="margin:0;padding:0;background:#eef3f9;color:#073467;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f9"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #d6e3f0;border-radius:14px;overflow:hidden">
  <tr><td align="center" style="text-align:center;padding:27px 26px 25px;background:#034982;border-bottom:5px solid #ffda00"><table role="presentation" cellspacing="0" cellpadding="0" style="width:100%"><tr><td align="center" style="text-align:center"><table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:0 auto"><tr><td style="background:#ffffff;padding:12px 15px;border-radius:9px"><img src="${img('goodyear-logo')}" alt="Goodyear" width="180" style="width:180px;max-width:100%;height:auto;display:block;border:0"></td></tr></table><p style="margin:20px 0 8px;color:#ffda00;font-size:10px;font-weight:800;letter-spacing:1.7px">GOODYEAR AMIENS · SUIVI VGP</p><h1 style="margin:0;color:#ffffff;font-size:25px;line-height:1.25">Votre matériel à contrôler</h1><p style="margin:9px 0 0;font-size:13px;line-height:1.5;color:#e1edf9">${mailHtmlEscape(stage.title)} · Échéance du ${mailHtmlEscape(format(deadline))}</p></td></tr></table></td></tr>
  ${test?'<tr><td style="padding:13px 26px;background:#fff8da;color:#705500;font-size:12px;line-height:1.6"><strong>MESSAGE DE TEST</strong> · Cet envoi sert à vérifier la présentation du rappel. Il ne constitue pas une demande réelle de contrôle.</td></tr>':''}
  <tr><td style="padding:26px"><p style="margin:0 0 7px;font-size:10px;letter-spacing:1.3px;font-weight:700;color:#4c76a0">${mailHtmlEscape(stage.label)} · RAPPEL DE CONTRÔLE</p><h2 style="font-size:21px;line-height:1.35;margin:0 0 18px;color:#073467">${mailHtmlEscape(equipmentName(equipment))}</h2><div style="font-size:14px;line-height:1.7;color:#244c75">${body.split(/\n\s*\n/).map(paragraph=>`<p style="margin:0 0 15px">${mailHtmlEscape(paragraph).replace(/\n/g,'<br>')}</p>`).join('')}</div></td></tr>
  ${photo?`<tr><td align="center" style="padding:0 26px 24px"><img src="${img('equipment-photo')}" alt="Photo du matériel ${mailHtmlEscape(equipment.identifier)}" width="${photoWidth}" style="width:${photoWidth}px;max-width:100%;height:auto;display:block;border:1px solid #d6e3f0;border-radius:10px"></td></tr>`:''}
  <tr><td style="padding:0 26px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #d6e3f0;border-radius:9px;background:#f8fafd">${row('N° interne',equipment.identifier)}${row('Matériel',equipmentName(equipment))}${row('Propriétaire',equipment.owner)}${row('Secteur / zone',[equipment.sector,equipment.zone].filter(Boolean).join(' · '))}${row('Prochain contrôle',format(deadline))}</table></td></tr>
  ${declarationUrl||disposalUrl||inline?`<tr><td style="padding:0 21px 26px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${declarationUrl||inline?`<td class="mail-action-cell" width="50%" style="width:50%;padding:0 5px 10px;vertical-align:top">${declarationCard('Vous ne retrouvez plus ce matériel ?','Remplissez et signez le formulaire de perte pour cet équipement.','Déclarer ce matériel perdu',declarationUrl,'#ffda00')}</td>`:''}${disposalUrl||inline?`<td class="mail-action-cell" width="50%" style="width:50%;padding:0 5px 10px;vertical-align:top">${declarationCard('Ce matériel a été mis au rebut ?','Remplissez et signez la déclaration de mise au rebut pour cet équipement.','Déclarer la mise au rebut',disposalUrl,'#0055a4')}</td>`:''}</tr></table></td></tr>`:''}
  <tr><td style="padding:19px 26px;border-top:1px solid #e0e9f3;background:#f7f9fc;font-size:11px;line-height:1.6;color:#67809a">Goodyear Amiens · Vérifications générales périodiques<br>Suivi du matériel et organisation des contrôles.</td></tr></table></td></tr></table></body></html>`;
 };
 const text=(test?'MESSAGE DE TEST — aucune demande réelle de contrôle.\n\n':'')+body+`\n\nMatériel : ${equipmentName(equipment)}\nN° interne : ${equipment.identifier}\nProchain contrôle : ${format(deadline)}`+(declarationUrl?'\n\nPour déclarer ce matériel perdu, remplissez et signez le formulaire : '+declarationUrl:'');
 return {subject,text:text+(disposalUrl?'\n\nPour déclarer la mise au rebut, remplissez et signez le formulaire : '+disposalUrl:''),html:render(),previewHtml:render(true),recipient:email,sender:sender.trim(),attachments,equipmentId:equipment.id,kind,test,lossUrl:declarationUrl,scrapUrl:disposalUrl,hasPhoto:!!photo};
}

export function buildVgpMailDraft(mail,{now=new Date(),id=crypto.randomUUID()}={}){
 if(!vgpMailAddressValid(mail.recipient))throw Error('Renseigne une adresse destinataire valide.');
 if(!vgpMailAddressValid(mail.sender))throw Error('Renseigne l’adresse du compte qui enverra le test.');
 const base64=value=>{let raw='';for(const byte of new TextEncoder().encode(value))raw+=String.fromCharCode(byte);return btoa(raw);};
 const folded=value=>value.match(/.{1,76}/g)?.join('\r\n')||'';
 const boundary='vgp-related-'+id,alternative='vgp-alternative-'+id;
 const encodedSubject=[...mail.subject].reduce((chunks,char)=>{if(!chunks.length||new TextEncoder().encode(chunks.at(-1)+char).length>42)chunks.push(char);else chunks[chunks.length-1]+=char;return chunks;},[]).map(chunk=>'=?UTF-8?B?'+base64(chunk)+'?=').join('\r\n ');
 const parts=[`From: ${mail.sender}`,`To: ${mail.recipient}`,`Subject: ${encodedSubject}`,`Date: ${new Date(now).toUTCString()}`,`Message-ID: <${id}@vgp.local>`,'X-Unsent: 1','MIME-Version: 1.0',`Content-Type: multipart/related; boundary="${boundary}"`,'',`--${boundary}`,`Content-Type: multipart/alternative; boundary="${alternative}"`,'',`--${alternative}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',folded(base64(mail.text)),`--${alternative}`,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',folded(base64(mail.html)),`--${alternative}--`];
 for(const attachment of mail.attachments)parts.push(`--${boundary}`,`Content-Type: ${attachment.type}; name="${attachment.name}"`,'Content-Transfer-Encoding: base64',`Content-ID: <${attachment.cid}>`,`Content-Disposition: inline; filename="${attachment.name}"`,'',folded(attachment.data));
 parts.push(`--${boundary}--`,'');
 return parts.join('\r\n');
}
