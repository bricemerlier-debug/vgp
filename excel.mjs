import {suggestEquipmentNaming} from './nomenclature.mjs';
// Import d'ajouts seulement : aucun remplacement silencieux d'une fiche existante.
const norm=v=>String(v??'').trim().toLocaleLowerCase('fr');
const heading=v=>norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const headers={repere:'equipmentMark',repereequipement:'equipmentMark',numerointerne:'identifier',ninterne:'identifier',nom:'designation',numerodeserie:'serialNumber',ndeserie:'serialNumber',secteur:'sector',zone:'zone',equipe:'team',proprietaire:'owner',email:'email',localisation:'location',periodicitemois:'months',derniercontrole:'lastDate',verificateur:'verifier',resultat:'result',prochaincontrole:'nextDate',commentaire:'comments'};
export function excelDate(value){if(value==null||value==='')return null;if(value instanceof Date&&!isNaN(value))return `${value.getUTCFullYear()}-${String(value.getUTCMonth()+1).padStart(2,'0')}-${String(value.getUTCDate()).padStart(2,'0')}`;const text=String(value).trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||isNaN(Date.parse(text))||new Date(text).toISOString().slice(0,10)!==text)throw Error('Date invalide : utilisez une cellule date Excel ou AAAA-MM-JJ.');return text;}
export function analyzeRows(rows,data,today){const items=analyzeSourceRows(rows,data,today);for(const item of items)if(item.status==='ready')item.naming=suggestEquipmentNaming({...item.row,id:'preview-'+item.line},data);return items;}
function analyzeSourceRows(rows,data,today){
 if(isMemoryFlow(rows))return analyzeMemoryFlow(rows,data);
 if(!Array.isArray(rows)||rows.length<2||rows.length>5001)throw Error('Le fichier doit contenir un en-tête et 1 à 5 000 lignes.');
 const fields=rows[0].map(heading).map(h=>headers[h]||null);
 if(!fields.includes('identifier')||!fields.includes('designation'))throw Error('Colonnes obligatoires : Numéro interne et Nom.');
 if(new Set(fields.filter(Boolean)).size!==fields.filter(Boolean).length)throw Error('Colonnes en double.');
 const emails=new Map((data.ownerContacts||[]).filter(c=>c.email).map(c=>[norm(c.owner),norm(c.email)]));
 const identifiers=new Set(data.equipment.map(e=>norm(e.identifier))),serials=new Set(data.equipment.map(e=>norm(e.serialNumber)).filter(Boolean));
 return rows.slice(1).map((cells,i)=>{if(cells.every(v=>v==null||String(v).trim()===''))return null;let row={};fields.forEach((f,k)=>{if(f)row[f]=cells[k]??''});const item={line:i+2,row,status:'ready',message:''};try{
 for(const k of Object.keys(row))if(!['lastDate','nextDate'].includes(k))row[k]=String(row[k]).trim();
 if(!row.identifier||!row.designation)throw Error('Numéro interne et nom obligatoires.');
 if(row.equipmentMark&&(row.equipmentMark.length>120||/[\r\n]/.test(row.equipmentMark)))throw Error('Repère équipement invalide (120 caractères maximum).');
 row.months=Number(row.months||12);if(![3,6,9,12].includes(row.months))throw Error('Périodicité : 3, 6, 9 ou 12 mois.');
 row.lastDate=excelDate(row.lastDate);row.nextDate=excelDate(row.nextDate);
 if(row.lastDate>today)throw Error('Le dernier contrôle ne peut pas être futur.');
 if(row.lastDate&&(!row.verifier||!['Bon état','Mauvais état — réparable','Mauvais état — à jeter','Introuvable'].includes(row.result)))throw Error('Un dernier contrôle exige un vérificateur et un résultat reconnu.');
 if(!row.lastDate&&(row.verifier||row.result))throw Error('Renseignez aussi la date du dernier contrôle.');
 if(heading(row.sector)==='pasdesecteur')row.sector='Pas de secteur';if(heading(row.team)==='pasdequipe')row.team='Pas d’équipe';
 if(row.sector&&!['A1','A2','B1','B2','B3','Pas de secteur'].includes(row.sector))throw Error('Secteur inconnu.');
 if(row.zone&&(!['DMCR','Yuzer'].includes(row.zone)||row.sector!=='B2'))throw Error('DMCR et Yuzer sont des zones du secteur B2.');
 if(row.team&&!['A','B','C','D','E','Jour','Pas d’équipe'].includes(row.team))throw Error('Équipe inconnue.');
 if(row.email&&(!row.owner||!/^\S+@\S+\.\S+$/.test(row.email)))throw Error('Adresse e-mail ou propriétaire invalide.');
 if(row.email&&emails.has(norm(row.owner))&&emails.get(norm(row.owner))!==norm(row.email))throw Error('Adresse différente du propriétaire existant : modifiez sa fiche séparément.');
 if(identifiers.has(norm(row.identifier))||(row.serialNumber&&serials.has(norm(row.serialNumber)))){item.status='duplicate';item.message='Doublon : numéro interne ou série déjà présent (archives comprises).';}
 else {if(row.email)emails.set(norm(row.owner),norm(row.email));identifiers.add(norm(row.identifier));if(row.serialNumber)serials.add(norm(row.serialNumber));}
 }catch(error){item.status='error';item.message=error.message;}return item;}).filter(Boolean);
}
export function isMemoryFlow(rows){const h=(rows?.[0]||[]).map(heading);return ['id','ninterne','nom','type','frequence','echeance'].every(k=>h.includes(k));}
function analyzeMemoryFlow(rows,data){
 if(rows.length>5001)throw Error('Maximum 5 000 lignes source par import.');
 const headings=rows[0].map(heading),at=k=>headings.indexOf(k),get=(r,k)=>at(k)<0?'':r[at(k)],text=v=>String(v??'').trim(),dateValue=v=>v instanceof Date?excelDate(v):v;
 const groups=new Map();rows.slice(1).forEach((cells,i)=>{if(cells.every(v=>v==null||text(v)===''))return;const externalId=text(get(cells,'id'));const key=externalId||'missing-line-'+(i+2);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({cells,line:i+2});});
 const items=[];
 for(const [externalId,sourceRows] of groups){
 const unique=k=>[...new Set(sourceRows.map(r=>text(get(r.cells,k))).filter(Boolean))];
 const reg=sourceRows.filter(r=>heading(get(r.cells,'type'))==='reglementaire');
 const identifiers=unique('ninterne'),names=unique('nom'),serials=unique('ndeserie');
 const latestDate=k=>reg.map(r=>excelDate(get(r.cells,k))).filter(Boolean).sort().at(-1)||null;
 const frequencies=[...new Set(reg.map(r=>text(get(r.cells,'frequence'))).filter(Boolean))];
 const monthsFor=v=>({'1annee':12,'1an':12,'12mois':12,'6mois':6,'3mois':3,'9mois':9})[heading(v)];
 const row={equipmentMark:unique('repereequipement')[0]||unique('repere')[0]||'',identifier:identifiers[0]||'',designation:names[0]||'',serialNumber:serials[0]||'',sector:'',zone:'',team:'',owner:'',email:'',location:unique('service')[0]||unique('site')[0]||'',months:monthsFor(frequencies[0])||12,lastDate:null,nextDate:null,comments:'Import de fiches depuis un export MemoryFlow. Les informations de suivi d’origine sont conservées ; aucun contrôle réalisé n’est inventé.',family:''};
 const warnings=['Responsable / propriétaire et adresse mail non renseignés','Dates et périodicité source à valider ; aucun contrôle réalisé ajouté'];
 const category=unique('categorie')[0]||'',sector=/(?:secteur\s+)(A1|A2|B1|B2|B3)\b/i.exec(category);if(sector)row.sector=sector[1].toUpperCase();else if(category)row.family=category;
 if(!row.location)warnings.push('Localisation manquante');else warnings.push('Localisation reprise de Service ou Site, à confirmer');
 if(sourceRows.some(r=>typeof get(r.cells,'ndeserie')==='number'))warnings.push('Numéro de série numérique dans Excel : vérifier les éventuels zéros initiaux');
 const item={line:sourceRows[0].line,row,status:'ready',message:'',warnings,sourceLines:sourceRows.length,externalId};
 try{
 if(row.equipmentMark&&(row.equipmentMark.length>120||/[\r\n]/.test(row.equipmentMark)))throw Error('Repère équipement invalide (120 caractères maximum).');
 if(externalId.startsWith('missing-line-'))throw Error('ID source manquant : regroupement impossible.');
 if(!row.identifier||!row.designation)throw Error('Numéro interne ou nom manquant : compléter le fichier, aucun numéro inventé.');
 if(identifiers.length>1||names.length>1||serials.length>1)throw Error('Informations contradictoires pour le même ID source : vérifier les lignes avant import.');
 if(!reg.length)throw Error('Aucune ligne réglementaire pour cet équipement : les autres niveaux ne définissent pas sa VGP.');
 if(frequencies.length!==1||!monthsFor(frequencies[0]))throw Error('Fréquence réglementaire absente, contradictoire ou non prise en charge (3/6/9/12 mois).');
 row.lastDate=latestDate('dateduderniercontrole');row.nextDate=latestDate('echeance');
 row.sourceImport={format:'MemoryFlow',externalId,importedAt:null,sourceLines:sourceRows.map(r=>({line:r.line,fields:Object.fromEntries(rows[0].map((h,i)=>[String(h),dateValue(r.cells[i])]).filter(([h,v])=>v!=null&&v!==''))})),warnings:[...warnings]};
 }catch(error){item.status='error';item.message=error.message;}
 items.push(item);
 }
 const counts=key=>{const m=new Map();for(const i of items){const v=norm(i.row[key]);if(v)m.set(v,(m.get(v)||0)+1);}return m;},identifiers=counts('identifier'),serials=counts('serialNumber');
 for(const item of items){if(item.status==='error')continue;const row=item.row;
 if(identifiers.get(norm(row.identifier))>1||row.serialNumber&&serials.get(norm(row.serialNumber))>1){item.status='error';item.message='Numéro interne ou série partagé entre plusieurs ID source : aucune fusion automatique.';continue;}
 const match=data.equipment.find(e=>norm(e.identifier)===norm(row.identifier)||row.serialNumber&&norm(e.serialNumber)===norm(row.serialNumber)||e.sourceImport?.format==='MemoryFlow'&&e.sourceImport.externalId===item.externalId);
 if(match){const differences=['identifier','designation','serialNumber','location','sector','months'].filter(k=>norm(match[k])!==norm(row[k]));item.status='duplicate';item.message=differences.length?'Fiche existante avec différences : '+differences.map(k=>({identifier:'numéro interne',designation:'nom',serialNumber:'série',location:'localisation',sector:'secteur',months:'périodicité'})[k]).join(', ')+'. Aucune modification automatique.':'Fiche déjà présente : ignorée, historique et documents conservés.';}
 }
 return items;
}
