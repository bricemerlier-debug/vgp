// Sous-secteurs proposés explicitement, sans déduction depuis les noms.
export function sectorZones(sector){return sector==='B1'?['Setup']:sector==='B2'?['DMCR','Yuzer','Démontage membrane']:[];}
export function sectorLabel(sector){return ({A1:'A1 - Mélange',A2:'A2 - Préparation',B1:'B1 - Confection',B2:'B2 - Cuisson',B3:'B3 - Finition'})[sector]||sector||'';}
