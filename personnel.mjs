import {controllerForName,controlBelongsToController,activeControllers} from './controllers.mjs';
import {equipmentOwners,equipmentHasOwner,removeEquipmentOwner} from './ownership.mjs';
const personKey=v=>String(v??'').trim().toLocaleLowerCase('fr');
export function personnelChoices(state,kind){return kind==='controller'?activeControllers(state.controllerProfiles).map(p=>({id:p.id,name:p.name})): [...new Map([...(state.owners||[]),...(state.ownerContacts||[]).map(c=>c.owner),...state.equipment.flatMap(equipmentOwners)].filter(Boolean).map(name=>[personKey(name),{id:name,name}])).values()];}
export function personnelOperationPreview(state,kind,sourceId,targetId=null){
 if(!['controller','owner'].includes(kind))throw Error('Type de fiche invalide.');const choices=personnelChoices(state,kind),source=choices.find(p=>kind==='owner'?personKey(p.id)===personKey(sourceId):p.id===sourceId),target=targetId?choices.find(p=>kind==='owner'?personKey(p.id)===personKey(targetId):p.id===targetId):null;
 if(!source)throw Error('La fiche source n’est plus disponible.');if(targetId&&(!target||target.id===source.id))throw Error('Choisissez une autre fiche existante comme destination.');
 const profile=kind==='controller'?state.controllerProfiles.find(p=>p.id===source.id):null;
 const controls=profile?state.equipment.flatMap(e=>e.controls.filter(c=>controlBelongsToController(c,profile,state.controllerProfiles))):[];
 const equipment=state.equipment.filter(e=>kind==='owner'?equipmentHasOwner(e,source.name):e.controls.some(c=>controls.includes(c)));
 const sourceContact=kind==='controller'?profile:(state.ownerContacts||[]).find(c=>personKey(c.owner)===personKey(source.name))||{};
 const targetContact=target?(kind==='controller'?state.controllerProfiles.find(p=>p.id===target.id):(state.ownerContacts||[]).find(c=>personKey(c.owner)===personKey(target.name))||{}):{};
 const fields=kind==='controller'?['email','signature']:['email','team','service','sector','zone'],copied=[],conflicts=[];
 for(const field of fields){if(!sourceContact[field])continue;if(field==='zone'&&(targetContact.sector||sourceContact.sector)!=='B2')continue;if(!targetContact[field])copied.push(field);else if(JSON.stringify(targetContact[field])!==JSON.stringify(sourceContact[field]))conflicts.push(field);}
 return {kind,source,target,equipment:equipment.map(e=>({id:e.id,identifier:e.identifier})),controls:controls.length,copied,conflicts,sourceContact,targetContact};
}
export function applyPersonnelOperation(document,{kind,sourceId,targetId=null,operation,confirmed=false,by,at=new Date().toISOString()}){
 if(!confirmed||!by?.trim()||!['merge','delete'].includes(operation)||operation==='merge'&&!targetId)throw Error('Confirmez explicitement l’opération.');
 const state=structuredClone(document),p=personnelOperationPreview(state,kind,sourceId,operation==='merge'?targetId:null);
 const event={kind,operation,by,at,sourceId:p.source.id,sourceName:p.source.name,targetId:p.target?.id||null,targetName:p.target?.name||null,equipmentIds:p.equipment.map(e=>e.id),controls:p.controls,copied:operation==='merge'?p.copied:[],conflicts:operation==='merge'?p.conflicts:[]};
 if(kind==='controller'){
  const source=state.controllerProfiles.find(c=>c.id===p.source.id);state.controllerOrigins??={};for(const e of state.equipment)for(const c of e.controls)if(!c.verifierId&&controlBelongsToController(c,source,state.controllerProfiles)&&!state.controllerOrigins[c.id])state.controllerOrigins[c.id]=controllerForName(state.controllerProfiles,c.intervenant,false)?.id||source.id;source.deletedAt=at;source.deletedBy=by;
  if(operation==='merge'){const target=state.controllerProfiles.find(c=>c.id===p.target.id);source.mergedInto=target.id;for(const field of p.copied)target[field]=structuredClone(source[field]);}
  // Les anciens identifiants, noms et signatures sont conservés pour les rapports immuables.
  state.verifiers=activeControllers(state.controllerProfiles).map(c=>c.name);
 }else{
  state.owners=(state.owners||[]).filter(n=>personKey(n)!==personKey(p.source.name));state.ownerContacts=(state.ownerContacts||[]).filter(c=>personKey(c.owner)!==personKey(p.source.name));event.sourceContact=structuredClone(p.sourceContact);
  if(operation==='merge'){
   if(!state.owners.some(n=>personKey(n)===personKey(p.target.name)))state.owners.push(p.target.name);
   let contact=state.ownerContacts.find(c=>personKey(c.owner)===personKey(p.target.name));if(!contact){contact={owner:p.target.name,email:''};state.ownerContacts.push(contact);}event.targetBefore=structuredClone(contact);for(const field of p.copied)contact[field]=structuredClone(p.sourceContact[field]);
   for(const e of state.equipment)if(equipmentHasOwner(e,p.source.name)){const names=[...new Map(equipmentOwners(e).map(n=>personKey(n)===personKey(p.source.name)?p.target.name:n).map(n=>[personKey(n),n])).values()];e.owner=names[0]||'';e.additionalOwners=names.slice(1);}
  }else for(const e of state.equipment)if(equipmentHasOwner(e,p.source.name))removeEquipmentOwner(e,p.source.name);
 }
 state.personnelHistory=[...(state.personnelHistory||[]),event];return state;
}
// Recherche des anciens noms uniquement après une fusion explicitement validée.
export function ownerMergeSearch(state,name){const history=(state.personnelHistory||[]).filter(h=>h.kind==='owner'),terms=[];for(let i=0;i<history.length;i++){const h=history[i];if(h.operation!=='merge')continue;let current=h.targetName;for(const next of history.slice(i+1))if(current&&personKey(next.sourceName)===personKey(current))current=next.operation==='merge'?next.targetName:null;if(current&&personKey(current)===personKey(name))terms.push(h.sourceName,h.sourceContact?.email||'');}return terms.join(' ');}
