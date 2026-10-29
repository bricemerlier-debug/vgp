import {generatePdf} from './domain.mjs';

// Liste de travail de la semaine affichée ; les contrôles déjà traités sont exclus.
export function buildVgpAgendaPdf(days,equipment,{preparedOn}={}){
 const byId=new Map(equipment.map(item=>[item.id,item]));
 const pending=days.flatMap(day=>day.entries.filter(entry=>!entry.done&&entry.state!=='lost'&&entry.state!=='scrapped').map(entry=>({date:day.date,entry,item:byId.get(entry.equipmentId)})));
 const fr=value=>value?value.split('-').reverse().join('/'):'—';
 const lines=[
  'GOODYEAR AMIENS · ENGINEERING PLANT FLOOR',
  'AGENDA VGP · CONTRÔLES À FAIRE',
  `Semaine du ${fr(days[0]?.date)} au ${fr(days[6]?.date)}`,
  `${pending.length} contrôle${pending.length===1?'':'s'} à faire${preparedOn?` · Édité le ${fr(preparedOn)}`:''}`,
  'Technicien : ________________________________    Date : ______________',
  '',
 ];
 for(const {date,entry,item} of pending){
  lines.push(`[ ] ${fr(date)} · ${entry.identifier} · ${entry.name}`);
  lines.push(`    N° de série : ${item?.serialNumber||'Non renseigné'} · Secteur : ${item?.sector||'Non renseigné'}`);
  lines.push(`    Propriétaire : ${item?.owner||'Non renseigné'} · Localisation : ${item?.location||'Non renseignée'}`);
  lines.push('    Observation : ________________________________________________________','');
 }
 if(!pending.length)lines.push('Aucun contrôle restant à faire cette semaine.');
 return generatePdf(lines);
}
