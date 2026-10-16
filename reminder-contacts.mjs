import {equipmentOwners} from './ownership.mjs';
export function reminderEmailValid(value){return typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
export function reminderOwnershipStamp(e){return JSON.stringify(equipmentOwners(e).map(n=>n.trim().toLocaleLowerCase('fr')).sort());}
export function createReminderContact({id,name,type,email='',verification='to_verify',updatedAt=new Date().toISOString()}){
 if(typeof id!=='string'||!id||!name?.trim()||name.trim().length>160||!['person','service','company'].includes(type)||!['confirmed','to_verify'].includes(verification)||email&&!reminderEmailValid(email.trim()))throw Error('Contact invalide : vérifiez le nom, le type et l’adresse.');
 return {id,name:name.trim(),type,email:email.trim(),verification,updatedAt};
}
export function assignReminderContact(document,{equipmentId,contactId,role,status='to_verify',at=new Date().toISOString()}){
 const e=document.equipment.find(e=>e.id===equipmentId);if(!e||!document.reminderContacts?.some(c=>c.id===contactId)||!['primary','holder','escalation'].includes(role)||!['confirmed','to_verify'].includes(status))throw Error('Affectation invalide.');
 document.reminderAssignments??=[];
 if(role==='primary'&&status==='confirmed'&&document.reminderAssignments.some(a=>a.equipmentId===equipmentId&&a.contactId!==contactId&&a.role==='primary'&&a.status==='confirmed'))throw Error('Un responsable principal est déjà confirmé. Modifiez son affectation avant de le remplacer.');
 const row={equipmentId,contactId,role,status,ownershipStamp:reminderOwnershipStamp(e),updatedAt:at};const index=document.reminderAssignments.findIndex(a=>a.equipmentId===equipmentId&&a.contactId===contactId);
 if(index<0)document.reminderAssignments.push(row);else document.reminderAssignments[index]=row;return row;
}
export function resolveReminderRecipients(document,e){
 const issues=[],recipients=[],assignments=(document.reminderAssignments||[]).filter(a=>a.equipmentId===e.id),contacts=document.reminderContacts||[],stamp=reminderOwnershipStamp(e);
 const issue=(reason,contactId=null)=>issues.push({equipmentId:e.id,identifier:e.identifier,contactId,reason});
 if(!assignments.length)issue('Aucune affectation de contact confirmée. Les noms historiques ne sont pas utilisés.');
 let primary=0;const addresses=new Set();
 for(const a of assignments){const c=contacts.find(c=>c.id===a.contactId);if(!c){issue('Contact introuvable dans le référentiel.',a.contactId);continue;}
  if(a.status!=='confirmed'||c.verification!=='confirmed'||a.ownershipStamp!==stamp){issue('Affectation ou contact à vérifier (réaffectation comprise).',c.id);continue;}
  if(a.role==='primary')primary++;
  if(!reminderEmailValid(c.email)){issue('Adresse e-mail absente ou invalide.',c.id);continue;}
  const address=c.email.trim().toLowerCase();if(addresses.has(address)){issue('Adresse commune à plusieurs contacts : un seul message prévu, contacts conservés séparément.',c.id);continue;}
  addresses.add(address);recipients.push({contactId:c.id,name:c.name,email:c.email.trim(),role:a.role,assignmentUpdatedAt:a.updatedAt,contactUpdatedAt:c.updatedAt});
 }
 if(primary!==1){issue('Un responsable principal confirmé est requis.');return {recipients:[],issues};}
 return {recipients,issues};
}
export function reminderContactsValid(document){const cs=document.reminderContacts||[],as=document.reminderAssignments||[];if(!Array.isArray(cs)||!Array.isArray(as)||new Set(cs.map(c=>c.id)).size!==cs.length)return false;try{cs.forEach(createReminderContact);}catch{return false;}return as.every(a=>typeof a.equipmentId==='string'&&typeof a.contactId==='string'&&['primary','holder','escalation'].includes(a.role)&&['confirmed','to_verify'].includes(a.status)&&typeof a.ownershipStamp==='string');}
