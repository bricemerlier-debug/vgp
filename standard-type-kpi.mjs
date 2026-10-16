import {due} from './domain.mjs';

// Même périmètre que « VGP à jour » : équipements actifs, échéances validées non échues.
export function standardTypeProgress(equipment,types,date){
 const groups=new Map(types.map(type=>[type.id,{typeId:type.id,name:type.name,total:0,done:0,ids:[]} ]));
 for(const e of equipment){if(e.archived)continue;const typeId=groups.has(e.typeId)?e.typeId:null;if(!groups.has(typeId))groups.set(typeId,{typeId,name:'Sans nom standardisé',total:0,done:0,ids:[]});const row=groups.get(typeId);row.total++;row.ids.push(e.id);const deadline=due(e);if(deadline&&deadline>=date)row.done++;}
 return [...groups.values()].map(row=>{const complete=row.done===row.total,percent=row.total?(complete?100:Math.min(99,Math.round(row.done*100/row.total))):null;return {...row,percent,tone:!row.total||complete?'complete':percent>=75?'warning':'low'};}).sort((a,b)=>a.typeId===null?1:b.typeId===null?-1:a.name.localeCompare(b.name,'fr',{numeric:true,sensitivity:'base'}));
}
