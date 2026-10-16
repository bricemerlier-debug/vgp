import {equipmentOwners,addEquipmentOwner} from './ownership.mjs';

// Correspondance exacte avec les fiches existantes, jamais avec le nom d'un équipement.
export function processTeamForSector(state,sector){
 if(!['A1','A2','B1','B2','B3'].includes(sector))return '';
 const key=value=>String(value??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr');
 const candidates=[...new Set([...(state.owners||[]),...(state.ownerContacts||[]).map(c=>c.owner)])].filter(name=>key(name)===`process team ${sector.toLowerCase()}`);
 return candidates.length===1?candidates[0]:'';
}
export function assignMissingProcessTeams(state){
 const assigned=[],unresolved=[];
 const equipment=state.equipment.map(e=>{
  if(equipmentOwners(e).length)return e;
  const owner=processTeamForSector(state,e.sector);
  if(!owner){unresolved.push({id:e.id,sector:e.sector||'',reason:['A1','A2','B1','B2','B3'].includes(e.sector)?'Fiche Process Team absente ou ambiguë':'Secteur non renseigné ou non reconnu'});return e;}
  const next={...e};addEquipmentOwner(next,owner);assigned.push({id:e.id,sector:e.sector,owner});return next;
 });
 return {state:assigned.length?{...state,equipment}:state,assigned,unresolved};
}
