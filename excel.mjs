// Import d'ajouts seulement : aucun remplacement silencieux d'une fiche existante.
const norm=v=>String(v??'').trim().toLocaleLowerCase('fr');
const heading=v=>norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const headers={numerointerne:'identifier',nom:'designation',numerodeserie:'serialNumber',secteur:'sector',zone:'zone',equipe:'team',proprietaire:'owner',email:'email',localisation:'location',periodicitemois:'months',derniercontrole:'lastDate',verificateur:'verifier',resultat:'result',prochaincontrole:'nextDate',commentaire:'comments'};
export function excelDate(value){if(value==null||value==='')return null;if(value instanceof Date&&!isNaN(value))return `${value.getUTCFullYear()}-${String(value.getUTCMonth()+1).padStart(2,'0')}-${String(value.getUTCDate()).padStart(2,'0')}`;const text=String(value).trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||isNaN(Date.parse(text))||new Date(text).toISOString().slice(0,10)!==text)throw Error('Date invalide : utilisez une cellule date Excel ou AAAA-MM-JJ.');return text;}
export function analyzeRows(rows,data,today){
 if(!Array.isArray(rows)||rows.length<2||rows.length>5001)throw Error('Le fichier doit contenir un en-tête et 1 à 5 000 lignes.');
 const fields=rows[0].map(heading).map(h=>headers[h]||null);
 if(!fields.includes('identifier')||!fields.includes('designation'))throw Error('Colonnes obligatoires : Numéro interne et Nom.');
 if(new Set(fields.filter(Boolean)).size!==fields.filter(Boolean).length)throw Error('Colonnes en double.');
 const emails=new Map((data.ownerContacts||[]).filter(c=>c.email).map(c=>[norm(c.owner),norm(c.email)]));
 const identifiers=new Set(data.equipment.map(e=>norm(e.identifier))),serials=new Set(data.equipment.map(e=>norm(e.serialNumber)).filter(Boolean));
 return rows.slice(1).map((cells,i)=>{if(cells.every(v=>v==null||String(v).trim()===''))return null;let row={};fields.forEach((f,k)=>{if(f)row[f]=cells[k]??''});const item={line:i+2,row,status:'ready',message:''};try{
 for(const k of Object.keys(row))if(!['lastDate','nextDate'].includes(k))row[k]=String(row[k]).trim();
 if(!row.identifier||!row.designation)throw Error('Numéro interne et nom obligatoires.');
 row.months=Number(row.months||12);if(![3,6,9,12].includes(row.months))throw Error('Périodicité : 3, 6, 9 ou 12 mois.');
 row.lastDate=excelDate(row.lastDate);row.nextDate=excelDate(row.nextDate);
 if(row.lastDate>today)throw Error('Le dernier contrôle ne peut pas être futur.');
 if(row.lastDate&&(!row.verifier||!['Bon état','Mauvais état — réparable','Mauvais état — à jeter','Introuvable'].includes(row.result)))throw Error('Un dernier contrôle exige un vérificateur et un résultat reconnu.');
 if(!row.lastDate&&(row.verifier||row.result))throw Error('Renseignez aussi la date du dernier contrôle.');
 if(row.sector&&!['A1','A2','B1','B2','B3'].includes(row.sector))throw Error('Secteur inconnu.');
 if(row.zone&&(!['DMCR','Yuzer'].includes(row.zone)||row.sector!=='B2'))throw Error('DMCR et Yuzer sont des zones du secteur B2.');
 if(row.team&&!['A','B','C','D','E','Jour'].includes(row.team))throw Error('Équipe inconnue.');
 if(row.email&&(!row.owner||!/^\S+@\S+\.\S+$/.test(row.email)))throw Error('Adresse e-mail ou propriétaire invalide.');
 if(row.email&&emails.has(norm(row.owner))&&emails.get(norm(row.owner))!==norm(row.email))throw Error('Adresse différente du propriétaire existant : modifiez sa fiche séparément.');
 if(identifiers.has(norm(row.identifier))||(row.serialNumber&&serials.has(norm(row.serialNumber)))){item.status='duplicate';item.message='Doublon : numéro interne ou série déjà présent (archives comprises).';}
 else {if(row.email)emails.set(norm(row.owner),norm(row.email));identifiers.add(norm(row.identifier));if(row.serialNumber)serials.add(norm(row.serialNumber));}
 }catch(error){item.status='error';item.message=error.message;}return item;}).filter(Boolean);
}
