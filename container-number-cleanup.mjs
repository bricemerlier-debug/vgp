import {containerArchiveInfo,containerRecordsValid} from './containers.mjs';

export const cleanContainerNumber=value=>String(value??'').replace(/\*/g,'').trim();
const key=value=>cleanContainerNumber(value).toLocaleUpperCase('fr');
const useful=value=>value!==undefined&&value!==null&&value!=='';

export function containerNumberCleanupPlan(document){
 const groups=new Map(),renamed=[],invalid=[];
 for(const item of document.containers||[]){
  const number=cleanContainerNumber(item.number);
  if(number!==item.number)renamed.push({id:item.id,before:item.number,after:number});
  if(!number){invalid.push(item.id);continue;}
  const group=groups.get(key(number))||[];group.push(item);groups.set(key(number),group);
 }
 const merges=[...groups.values()].filter(group=>group.length>1).map(group=>({number:cleanContainerNumber(group[0].number),ids:group.map(item=>item.id),interventions:group.map(item=>item.interventions.length)}));
 return {renamed,merges,invalid,ready:invalid.length===0};
}

export function applyContainerNumberCleanup(document,plan){
 if(!plan.ready)throw Error('Numéro de contenant vide après nettoyage.');
 const next=structuredClone(document),groups=new Map(),result=[],originalSources=new Map((document.containers||[]).map(item=>[item.id,item]));
 for(const item of next.containers||[]){
  item.number=cleanContainerNumber(item.number);
  if(!item.number)throw Error('Numéro de contenant vide après nettoyage.');
  const group=groups.get(key(item.number));
  if(group)group.push(item);else groups.set(key(item.number),[item]);
 }
 for(const group of groups.values()){
  // Une fiche active devient la fiche principale si le groupe en contient une.
  const primary=group.find(item=>!containerArchiveInfo(item))||group[0];
  primary.number=group.find(item=>item.number===key(item.number))?.number||primary.number;
  const signature=item=>JSON.stringify(item);
  const seenEntries=new Set(primary.interventions.map(signature));
  const usedNumbers=new Set(primary.interventions.map(item=>item.number.toLocaleLowerCase('fr')));
  for(const source of group){if(source===primary)continue;
   for(const entry of source.interventions){
    if(seenEntries.has(signature(entry)))continue;
    seenEntries.add(signature(entry));
    const base=entry.number;let candidate=base,serial=2;
    while(usedNumbers.has(candidate.toLocaleLowerCase('fr')))candidate=`${base}-fusion-${serial++}`;
    entry.number=candidate;usedNumbers.add(candidate.toLocaleLowerCase('fr'));primary.interventions.push(entry);
   }
   for(const field of ['type','subtype','photoPath','categoryMonths','categoryChecks'])if(!useful(primary[field])&&useful(source[field]))primary[field]=source[field];
   for(const field of ['inventoryHistory','numberMergeHistory'])if(Array.isArray(source[field]))primary[field]=[...(primary[field]||[]),...source[field]];
   primary.numberMergeHistory=[...(primary.numberMergeHistory||[]),{sourceId:source.id,sourceNumber:originalSources.get(source.id).number,sourceSnapshot:originalSources.get(source.id)}];
  }
  if(group.length>1&&group.some(item=>!containerArchiveInfo(item))){
   delete primary.manualArchive;
   // Les mises au rebut historiques des fiches absorbées restent dans l'historique.
   primary.inventoryReactivatedAt={date:new Date().toISOString().slice(0,10),at:new Date().toISOString(),interventionCount:primary.interventions.length};
  }
  result.push(primary);
 }
 next.containers=result;
 if(!containerRecordsValid(next))throw Error('Fusion invalide : aucune fiche modifiée.');
 return next;
}
