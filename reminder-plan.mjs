// Contrat pour un futur worker serveur. Aucun accès réseau et aucun envoi.
import {due} from './domain.mjs';
export function planReminders(document,workspaceId){
 const jobs=[];
 for(const e of document.equipment){if(e.archived)continue;const deadline=due(e);if(!deadline)continue;const contact=document.ownerContacts?.find(c=>c.owner.trim().toLowerCase()===e.owner?.trim().toLowerCase());if(!contact?.email)continue;
 for(const stage of [30,14,7,0]){const date=new Date(deadline+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-stage);jobs.push({workspace_id:workspaceId,equipment_id:e.id,due_on:deadline,stage,run_on:date.toISOString().slice(0,10),recipient:contact.email,status:'queued'});}
 }return jobs;
}
