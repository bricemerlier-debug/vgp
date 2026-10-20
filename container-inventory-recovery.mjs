import {containerArchiveInfo,containerRecordsValid} from './containers.mjs';
import {inventoryKey} from './inventory-reconciliation.mjs';
import {containerNumberCleanupPlan,applyContainerNumberCleanup} from './container-number-cleanup.mjs';

// Numéros retranscrits des deux captures de l'inventaire terrain du 20/10/2026.
// CA201 est présent sur les deux captures : une seule fiche est retenue.
export const october2026Inventory=[
 'CA120','CA009','CA203','CA215','CA056','CA170','CA087','CA184','CA241','CA242',
 'CA110','CA014','CA222','CA036','CA092','CA210','CA012','CA060','CA141','CA047',
 'CA035','CA224','CA265','CA201','CA272','CA159','CA010','CA143','CA133','CA015',
 'CA147','CA061','CA030','CA158','CA282','CA196','CA065','CA204','CA146','CA127',
 'CA043','CA154',
 'CA033','CA277','CA128','CA213','CA199','CA191','CA007','CA039','CA025','CA104',
 'CA019','CA177','CA283','CA173','CA163','CA182','CA137','CA278','CA022',
 'CA023','CA032','CA121','CA157','CA239','CA078','CA189','CA076','CA211','CA041',
 'CA176','CA038','CA281','CA080','CA100','CA139','CA001','CA270','CA248','CA161',
 'CA111','CA005','CA251','CA124','CA267','CA280','CA132','CA247','CA233','CA225'
];
export const cleanInventoryIdentifier=value=>String(value??'').replace(/\*/g,'').trim();
const recoveryKey=value=>inventoryKey(cleanInventoryIdentifier(value));
export function inventoryRecoveryPlan(document,numbers){
 const cleanup=containerNumberCleanupPlan(document),merged=cleanup.ready?applyContainerNumberCleanup(document,cleanup):document;
 const containers=merged.containers||[];
 const captured=[...new Set(numbers.map(recoveryKey).filter(Boolean))];
 const byNumber=new Map();for(const item of containers){const number=recoveryKey(item.number);if(!byNumber.has(number))byNumber.set(number,[]);byNumber.get(number).push(item);}
 const found=[],reactivate=[],unknown=[],ambiguous=[];
 for(const number of captured){const matches=byNumber.get(number)||[];if(matches.length>1)ambiguous.push({number,ids:matches.map(item=>item.id)});else if(!matches.length)unknown.push(number);else{found.push({number,id:matches[0].id});if(containerArchiveInfo(matches[0]))reactivate.push({number,id:matches[0].id});}}
 const scrap=containers.filter(item=>recoveryKey(item.number).startsWith('CA')&&!captured.includes(recoveryKey(item.number))&&!containerArchiveInfo(item)).map(item=>({number:item.number,id:item.id}));
 const changes=[],collisions=[],invalid=[];
 for(const [kind,items,field] of [['contenant',document.containers||[],'number']]){
  const cleaned=new Map();for(const item of items){const before=String(item[field]??''),after=cleanInventoryIdentifier(before),cleanKey=after.toLocaleLowerCase('fr');if(before!==after)changes.push({kind,id:item.id,before,after});if(!after)invalid.push({kind,id:item.id,before});if(cleaned.has(cleanKey))collisions.push({kind,number:after,ids:[cleaned.get(cleanKey),item.id]});else cleaned.set(cleanKey,item.id);}
 }
 return {captured,found,reactivate,scrap,unknown,ambiguous,changes,collisions,invalid,merges:cleanup.merges,ready:cleanup.ready&&!ambiguous.length&&!invalid.length&&!!captured.length};
}
export function applyInventoryRecovery(document,plan,{date='2026-10-20',by='',at=new Date().toISOString()}={}){
 if(!plan.ready||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!by.trim())throw Error('Lot non applicable : vérifiez les collisions, la date et le compte.');
 const next=applyContainerNumberCleanup(document,containerNumberCleanupPlan(document)),observed=new Set(plan.captured);
 for(const item of next.containers||[]){
  const number=recoveryKey(item.number);if(!number.startsWith('CA'))continue;
  const found=observed.has(number),archived=containerArchiveInfo(item);
  const history=item.inventoryHistory??[];
  if(found){
   if(archived){history.push({date,comment:`Inventaire fait le ${date.split('-').reverse().join('/')}. Contenant retrouvé et remis en circulation.`,by,at,previousArchive:item.manualArchive||null});delete item.manualArchive;item.inventoryReactivatedAt={date,at,interventionCount:item.interventions.length};}
   else if(!history.some(entry=>entry.date===date&&entry.source==='ca-inventory-found'))history.push({date,comment:`Inventaire fait le ${date.split('-').reverse().join('/')}. Contenant présent.`,by,at,source:'ca-inventory-found'});
  }else{
   if(!archived){const comment=`Absent de l’inventaire CA du ${date.split('-').reverse().join('/')}. Mis au rebut.`;item.manualArchive={date,comment,by,at};history.push({date,comment,by,at,source:'ca-inventory-scrap'});}
  }
  item.inventoryHistory=history;
 }
 if(!containerRecordsValid(next))throw Error('Lot invalide : aucune modification enregistrée.');
 return next;
}
