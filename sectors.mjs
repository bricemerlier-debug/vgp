// Sous-secteurs proposés explicitement, sans déduction depuis les noms.
export function sectorChoices({includeNoSector=false,includeUnassigned=false}={}){
 const choices=[
  {value:'A1',label:'A1 - Mélange'},
  {value:'A2',label:'A2 - Préparation'},
  {value:'B1',label:'B1 - Confection'},
  {value:'B2',label:'B2 - Cuisson'},
  {value:'B3',label:'B3 - Finition'}
 ];
 if(includeNoSector)choices.push({value:'Pas de secteur',label:'Pas de secteur'});
 if(includeUnassigned)choices.push({value:'unassigned',label:'Non renseigné'});
 return choices;
}
export function sectorZones(sector){return sector==='B1'?['Setup']:sector==='B2'?['DMCR','Yuzer','Démontage membrane']:[];}
export function sectorLabel(sector){return ({A1:'A1 - Mélange',A2:'A2 - Préparation',B1:'B1 - Confection',B2:'B2 - Cuisson',B3:'B3 - Finition'})[sector]||sector||'';}
