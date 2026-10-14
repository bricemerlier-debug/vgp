import {latestInspection,obligationEntries} from './domain.mjs';
const trackingKey=v=>String(v??'').trim().toLocaleLowerCase('fr');
export function parseTrackingCsv(text){
 text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0],delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else cell+=c;}
 else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('CSV incomplet : guillemet non fermé.');if(cell||row.length){row.push(cell);if(row.some(v=>v.trim()))rows.push(row);}return rows;
}
export function trackingDate(value){if(value instanceof Date)return value.toISOString().slice(0,10);let s=String(value??'').trim();if(!s)return null;const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);if(m)s=`${m[3]}-${m[2]}-${m[1]}`;if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||isNaN(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Date invalide : '+String(value));return s;}
export function memoryFlowIds(e){const ids=[e.memoryFlowId,e.sourceImport?.format==='MemoryFlow'?e.sourceImport.externalId:null,...[...(e.comments||'').matchAll(/^Origine\s*:.*?\bID(?:\s+MemoryFlow)?\s+(\d+)(?:\.|\b)/gmi)].map(m=>m[1])];return [...new Set(ids.filter(v=>v!=null&&String(v).trim()).map(v=>String(v).trim()))];}
export function analyzeTrackingRows(rows,data,today){
 if(!Array.isArray(rows)||rows.length<2||rows.length>10001)throw Error('Le fichier doit contenir entre 1 et 10 000 lignes.');
 const headers=rows[0].map(v=>String(v??'').trim()),get=(r,k)=>r[headers.indexOf(k)];
 if(!['ID','N° interne','N° de série','Type','Fréquence','Date du dernier contrôle','Echéance'].every(h=>headers.includes(h)))throw Error('Colonnes attendues : ID, N° interne, N° de série, Type, Fréquence, Date du dernier contrôle, Echéance.');
 const groups=new Map();let ignored=0;rows.slice(1).forEach((r,i)=>{if(trackingKey(get(r,'Type'))!=='réglementaire'){ignored++;return;}const id=String(get(r,'ID')??'').trim();if(!groups.has(id))groups.set(id,[]);groups.get(id).push({r,line:i+2});});
 const items=[];for(const [sourceId,entries] of groups){const item={sourceId,status:'ready',message:'',equipmentId:null,lastDate:null,nextDate:null,months:null,identifier:'',serial:'',sourceRows:[],line:entries[0].line};
 try{if(!sourceId)throw Error('ID équipement MemoryFlow manquant.');
 const parsed=entries.map(x=>({...x,date:trackingDate(get(x.r,'Date du dernier contrôle'))}));if(parsed.some(x=>!x.date))throw Error('Dernière date de contrôle manquante.');item.lastDate=parsed.map(x=>x.date).sort().at(-1);const newest=parsed.filter(x=>x.date===item.lastDate),unique=k=>[...new Set(newest.map(x=>k==='Echéance'?trackingDate(get(x.r,k)):String(get(x.r,k)??'').trim()))];
 if(['N° interne','N° de série','Fréquence','Echéance'].some(k=>unique(k).length>1))throw Error('Informations contradictoires pour la dernière date : vérifier les lignes source.');
 item.identifier=unique('N° interne')[0];item.serial=unique('N° de série')[0];item.nextDate=trackingDate(unique('Echéance')[0]);item.months=({'1 année':12,'1 an':12,'12 mois':12,'6 mois':6,'3 mois':3,'9 mois':9})[trackingKey(unique('Fréquence')[0])];
 if(item.lastDate>today)throw Error('Dernier contrôle daté dans le futur : ne peut pas être repris comme déjà effectué.');
 if(!item.nextDate||item.nextDate<=item.lastDate)throw Error('Échéance absente ou incohérente avec la dernière date.');if(!item.months)throw Error('Fréquence non prise en charge : 3/6/9/12 mois.');
 const byId=data.equipment.filter(e=>memoryFlowIds(e).includes(sourceId)),byNumber=data.equipment.filter(e=>item.identifier&&trackingKey(e.identifier)===trackingKey(item.identifier)),bySerial=data.equipment.filter(e=>item.serial&&trackingKey(e.serialNumber)===trackingKey(item.serial));
 const candidates=byId.length?byId:byNumber.length?byNumber:bySerial;if(candidates.length!==1)throw Error(candidates.length?'Plusieurs fiches correspondent : association ambiguë.':'Équipement absent du site : aucune fiche créée automatiquement.');const e=candidates[0];
 if(e.archived)throw Error('Équipement archivé : reprise bloquée, historique conservé.');
 if(byNumber.some(x=>x.id!==e.id)||bySerial.some(x=>x.id!==e.id)||item.identifier&&e.identifier&&trackingKey(item.identifier)!==trackingKey(e.identifier)||item.serial&&e.serialNumber&&trackingKey(item.serial)!==trackingKey(e.serialNumber)||memoryFlowIds(e).some(id=>id!==sourceId))throw Error('Identifiants contradictoires entre MemoryFlow et la fiche : vérifier avant association.');
 if(e.memoryFlowTracking?.lastDate>item.lastDate)throw Error('Une date MemoryFlow plus récente est déjà associée : ancienne reprise ignorée.');if(obligationEntries(e).some(o=>!o.done&&!o.excludedAt&&o.date<today&&o.date!==item.nextDate))throw Error('Échéance historique non clôturée : vérifier sa réalisation avant de remplacer le suivi.');
 const actual=latestInspection(e);if(actual&&actual.date>=item.lastDate)throw Error('Un contrôle exploitable de même date ou plus récent existe : fiche non modifiée.');if(e.needsReverification)throw Error('Matériel retrouvé nécessitant un nouveau contrôle : aucune validité rétablie par import.');
 item.equipmentId=e.id;item.match=byId.length?'ID MemoryFlow':byNumber.length?'Numéro interne':'Numéro de série';item.previousDate=e.manualNextControlDate||null;
 item.signature=JSON.stringify([sourceId,item.identifier,item.serial,item.lastDate,item.nextDate,item.months]);
 if(e.memoryFlowTracking?.signature===item.signature){item.status='duplicate';item.message='Dernières dates déjà associées : aucune modification.';}
 item.sourceRows=newest.map(x=>({line:x.line,fields:Object.fromEntries(headers.map((h,i)=>[h,x.r[i] instanceof Date?x.r[i].toISOString():x.r[i]]).filter(([h,v])=>v!=null&&v!==''))}));
 }catch(error){item.status='error';item.message=error.message;}items.push(item);}
 return {items,ignored,sourceLines:rows.length-1};
}
export function applyTrackingImport(data,items,{today,author,fileName}){
 if(!author?.trim())throw Error('Compte de saisie requis.');const next=structuredClone(data);
 for(const item of items.filter(i=>i.status==='ready')){const e=next.equipment.find(e=>e.id===item.equipmentId);if(!e||e.archived||e.needsReverification)throw Error('La fiche a changé : refaire l’analyse.');
 e.memoryFlowId=item.sourceId;e.memoryFlowTracking={signature:item.signature,sourceId:item.sourceId,lastDate:item.lastDate,nextDate:item.nextDate,months:item.months,sourceRows:item.sourceRows,fileName,importedAt:new Date().toISOString(),by:author,result:null,verifier:null};
 e.memoryFlowTrackingHistory=[...(e.memoryFlowTrackingHistory||[]),structuredClone(e.memoryFlowTracking)];
 e.dateHistory=[...(e.dateHistory||[]),{kind:'deadline',date:today,by:author,previousDate:e.manualNextControlDate||null,dateValue:item.nextDate,source:`MemoryFlow : ${fileName}, équipement ${item.sourceId}`,reason:'Échéance source et périodicité confirmées pour le suivi lors de l’import'},{kind:'periodicity',date:today,by:author,previousMonths:e.months,months:item.months,reason:'Périodicité MemoryFlow confirmée lors de la reprise'}];
 e.manualNextControlDate=item.nextDate;e.manualControlId=latestInspection(e)?.id||null;e.months=item.months;
 e.dateValidation={validated:true,source:`MemoryFlow : ${fileName}, équipement ${item.sourceId}`,reason:'Reprise explicitement confirmée de l’échéance source, sans certification du résultat',by:author,at:new Date().toISOString()};
 e.periodicityValidation={validated:true,months:item.months,reason:'Périodicité de suivi MemoryFlow confirmée lors de l’import',by:author,at:new Date().toISOString()};
 }
 return next;
}
