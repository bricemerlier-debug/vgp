// Contrat commun aperçu/file/worker. Aucun accès réseau et aucun envoi.
import {due,calculatedDeadline,latestInspection,equipmentName,fillEmailTemplate} from './domain.mjs';
import {reminderDates,overdueReminderDate} from './reminder-dates.mjs';
import {resolveReminderRecipients,reminderContactsValid} from './reminder-contacts.mjs';
export function reminderCycle(e){const c=latestInspection(e);return JSON.stringify([due(e),c?.id||null,c?.date||null,e.controls.filter(x=>x.result!=='Introuvable').map(c=>[c.id,c.date,c.result]).sort()]);}
export function reminderPlan(document,workspaceId,onDate=null){
 if(!reminderContactsValid(document))throw Error('Référentiel de contacts invalide : aucune mise en file.');
 const jobs=[],issues=[];
 for(const e of document.equipment){if(e.archived)continue;const deadline=due(e);const resolved=resolveReminderRecipients(document,e);issues.push(...resolved.issues);
 if(!deadline){issues.push({equipmentId:e.id,identifier:e.identifier,reason:'Échéance inconnue : aucun rappel calculable.'});continue;}
 if(latestInspection(e)&&deadline!==calculatedDeadline(e)){issues.push({equipmentId:e.id,identifier:e.identifier,reason:'Contrôle enregistré avec une ancienne échéance encore ouverte : cycle à vérifier avant rappel.'});continue;}
 const cycle=reminderCycle(e);
 const overdue=onDate?overdueReminderDate(deadline,onDate):null;
 for(const r of resolved.recipients)for(const step of [...reminderDates(deadline),...(overdue?[overdue]:[])]){
  // L'escalade est explicite et réservée à J0.
  if(r.role==='escalation'&&step.stage!==0)continue;
  const key=JSON.stringify([workspaceId,e.id,cycle,r.email.toLowerCase(),step.stage]);
  jobs.push({key,workspace_id:workspaceId,equipment_id:e.id,identifier:e.identifier,cycle,due_on:deadline,stage:step.stage,kind:step.kind,run_on:step.date,contact_id:r.contactId,recipient:r.email,recipient_name:r.name,fingerprint:JSON.stringify([cycle,deadline,r,resolved.recipients]),status:'queued',mode:'simulation'});
 }
 }return {jobs,issues};
}
export function planReminders(document,workspaceId){return reminderPlan(document,workspaceId).jobs;}
export function reminderMessage(document,job){const e=document.equipment.find(e=>e.id===job.equipment_id),template=document.mailTemplates?.find(t=>t.kind===job.kind);if(!e||!template)throw Error('Équipement ou modèle de rappel absent.');const values={nom_equipement:equipmentName(e),numero_interne:e.identifier,id_vgp:e.siteId||'',nom_proprietaire:job.recipient_name,date_controle:job.due_on.split('-').reverse().join('/'),secteur:e.sector||'Non renseigné',zone:e.zone||'Non renseignée'};return {subject:fillEmailTemplate(template.subject,values),text:fillEmailTemplate(template.body,values)+'\n\nRetour du matériel au service Métrologie pour vérification.\n\nSIMULATION — aucun e-mail envoyé.'};}
