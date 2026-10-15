const namingKey=value=>String(value??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr');
export function initialEquipmentTypes(){return [{id:'anneau-retournement',name:'Anneau de retournement',months:12,variants:[{id:'anneau-m16',name:'M16'},{id:'anneau-m30',name:'M30'}]},{id:'manille',name:'Manille',months:12,variants:[]}];}
export function standardizedLabel(types,typeId,variantId=''){const type=types.find(t=>t.id===typeId);if(!type)return '';const variant=type.variants.find(v=>v.id===variantId);if(variantId&&!variant)throw Error('La variante ne correspond pas au type choisi.');return type.name+(variant?' · '+variant.name:'');}
export function addEquipmentType(types,id,name){name=String(name??'').trim().replace(/\s+/g,' ');if(!name||name.length>120)throw Error('Le type doit comporter de 1 à 120 caractères.');if(types.some(t=>namingSearchKey(t.name)===namingSearchKey(name)||t.id===id))throw Error('Ce type existe déjà.');types.push({id,name,variants:[]});return id;}
export function addEquipmentVariant(types,typeId,id,name){const issue=technicalVariantIssue(name);if(issue)throw Error(issue);const type=types.find(t=>t.id===typeId);if(!type)throw Error('Choisissez d’abord un type.');name=String(name??'').trim().replace(/\s+/g,' ');if(!name||name.length>80)throw Error('La variante doit comporter de 1 à 80 caractères.');if(type.variants.some(v=>namingSearchKey(v.name)===namingSearchKey(name)||v.id===id))throw Error('Cette variante existe déjà pour ce type.');type.variants.push({id,name});return id;}
export function applyEquipmentNaming(e,types,typeId,variantId,author,date,options={}){
 if(variantId&&!typeId)throw Error('Choisissez un type pour cette variante.');const label=standardizedLabel(types,typeId,variantId);if(typeId&&!label)throw Error('Type inconnu.');if(variantId){const issue=technicalVariantIssue(types.find(t=>t.id===typeId)?.variants.find(v=>v.id===variantId)?.name||'',options.context||{equipment:[e]});if(issue)throw Error(issue);}
 const mark=options.equipmentMark??e.equipmentMark??'',review=options.ownerReviewRequired??e.ownerReviewRequired??false;
 if((e.typeId||'')===(typeId||'')&&(e.variantId||'')===(variantId||'')&&(e.standardName||'')===label&&(!label||e.designation===label)&&(e.equipmentMark||'')===mark&&!!e.ownerReviewRequired===review)return e;
 const originalName=e.designation;
 const previous={typeId:e.typeId||'',variantId:e.variantId||'',standardName:e.standardName||'',equipmentMark:e.equipmentMark||'',ownerReviewRequired:!!e.ownerReviewRequired};
 e.originalDesignation??=historicalEquipmentName(e);e.typeId=typeId||'';e.variantId=variantId||'';e.standardName=label;
 if(mark||Object.hasOwn(e,'equipmentMark')||Object.hasOwn(options,'equipmentMark'))e.equipmentMark=mark;
 if(review||Object.hasOwn(e,'ownerReviewRequired')||Object.hasOwn(options,'ownerReviewRequired'))e.ownerReviewRequired=review;
 if(label)e.designation=label;
 e.namingHistory=[...(e.namingHistory||[]),{date,at:options.at||new Date().toISOString(),by:author,previous,next:{typeId:e.typeId,variantId:e.variantId,standardName:label,equipmentMark:mark,ownerReviewRequired:review},originalName,equipmentMark:mark,source:options.source||'Classification manuelle',...(options.ruleId?{ruleId:options.ruleId}:{})}];return e;
}
export function namingGroups(equipment,{search='',includeNamed=false}={}){const groups=new Map(),query=namingSearchKey(search);for(const e of equipment){if(!includeNamed&&e.typeId)continue;const key=namingKey(e.designation);if(query&&!namingSearchKey(equipmentNamingSearch(e)).includes(query))continue;if(!groups.has(key))groups.set(key,{key,name:e.designation,equipment:[]});groups.get(key).equipment.push(e);}return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));}
export function nomenclatureValid(data){if(!namingExtensionValid(data))return false;const types=data.equipmentTypes;if(types===undefined)return !data.equipment.some(e=>e?.typeId||e?.variantId||e?.standardName);if(!Array.isArray(types)||types.some(t=>!t||(t.months!==undefined&&![3,6,9,12].includes(t.months))||typeof t.id!=='string'||!t.id||typeof t.name!=='string'||!t.name.trim()||t.name.length>120||!Array.isArray(t.variants)||t.variants.some(v=>!v||typeof v.id!=='string'||!v.id||typeof v.name!=='string'||!v.name.trim()||v.name.length>80)||new Set(t.variants.map(v=>v.id)).size!==t.variants.length||new Set(t.variants.map(v=>namingKey(v.name))).size!==t.variants.length)||new Set(types.map(t=>t.id)).size!==types.length||new Set(types.map(t=>namingKey(t.name))).size!==types.length)return false;return data.equipment.every(e=>{if(e.originalDesignation!==undefined&&typeof e.originalDesignation!=='string')return false;if(e.namingHistory!==undefined&&(!Array.isArray(e.namingHistory)||e.namingHistory.some(h=>!h||typeof h.date!=='string'||typeof h.by!=='string'||typeof h.originalName!=='string'||!h.previous||!h.next||['typeId','variantId','standardName'].some(k=>typeof h.previous[k]!=='string'||typeof h.next[k]!=='string'))))return false;if(!e.typeId)return !e.variantId&&!e.standardName;const t=types.find(t=>t.id===e.typeId);return !!t&&(!e.variantId||t.variants.some(v=>v.id===e.variantId))&&e.standardName===standardizedLabel(types,e.typeId,e.variantId);});}
export function renameEquipmentLabel(state,typeId,variantId,name,author,date){
 const type=state.equipmentTypes.find(t=>t.id===typeId);if(!type)throw Error('Choisissez un type existant.');const item=variantId?type.variants.find(v=>v.id===variantId):type;if(!item)throw Error('Choisissez une variante existante.');name=String(name??'').trim().replace(/\s+/g,' ');if(!name||name.length>(variantId?80:120))throw Error('Le libellé est vide ou trop long.');const siblings=variantId?type.variants:state.equipmentTypes;if(siblings.some(x=>x.id!==item.id&&namingSearchKey(x.name)===namingSearchKey(name)))throw Error('Ce nom existe déjà.');const previousName=item.name;if(previousName===name)return 0;item.name=name;item.nameHistory=[...(item.nameHistory||[]),{previousName,name,by:author,date}];let count=0;for(const e of state.equipment)if(e.typeId===typeId&&(!variantId||e.variantId===variantId)){applyEquipmentNaming(e,state.equipmentTypes,e.typeId,e.variantId,author,date,{context:state});count++;}return count;
}

// Reconnaissance locale et prudente : le catalogue reste la seule source des types.
export function namingSearchKey(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
export function historicalEquipmentName(e){
 const source=(e.sourceImport?.sourceLines||[]).map(line=>Object.entries(line.fields||{}).find(([key])=>namingSearchKey(key)==='nom')?.[1]).find(value=>typeof value==='string'&&value.trim());
 return e.originalDesignation||source||e.namingHistory?.[0]?.originalName||e.designation||'';
}
export function equipmentNamingSearch(e){return [e.standardName,e.designation,e.originalDesignation,e.equipmentMark,historicalEquipmentName(e),...(e.sourceImport?.sourceLines||[]).flatMap(line=>Object.entries(line.fields||{}).filter(([key])=>namingSearchKey(key)==='nom').map(([,value])=>value)),...(e.namingHistory||[]).flatMap(h=>[h.originalName,h.newName,h.previous?.standardName,h.next?.standardName,h.previous?.equipmentMark,h.next?.equipmentMark])].filter(Boolean).join(' ');}
export function detectEquipmentMarks(value){const marks=String(value??'').toUpperCase().match(/\b(?:AT|[AB][1-3])\s*[-_.]\s*[A-Z]{2,4}\s*[-_.]\s*\d{1,4}\b/g)||[];return [...new Set(marks.map(mark=>mark.replace(/\s/g,'').replace(/[_.]/g,'-')))];}
export function ownerNeedsNamingReview(e){if(Object.hasOwn(e,'ownerReviewRequired'))return e.ownerReviewRequired;return !e.owner&&!e.additionalOwners?.length&&!!(e.sourceImport||e.originalDesignation)&&/\bharnais\b/.test(namingSearchKey(historicalEquipmentName(e)));}
export function technicalVariantIssue(name,{equipment=[],owners=[]}={}){
 const value=namingSearchKey(name);if(!value)return '';
 if(detectEquipmentMarks(name).length||/\b(?:atelier|secteur|equipe|proprietaire|salarie|monsieur|madame|localisation)\b/.test(value))return 'Une variante décrit une caractéristique technique, pas un repère, un salarié ou une localisation.';
 if([...owners,...equipment.flatMap(e=>[e.identifier,e.serialNumber,e.equipmentMark,e.location,e.sector,e.zone,e.team,e.owner,...(e.additionalOwners||[])])].filter(Boolean).some(candidate=>namingSearchKey(candidate)===value))return 'Ce libellé correspond à un identifiant ou à un propriétaire : utilisez le champ distinct correspondant.';
 if(/^(?:ff|ef)\s*\d{3,}$/i.test(value))return 'Un numéro interne ne peut pas servir de variante technique.';
 return '';
}
function namingLexicon(value){const plurals={ponts:'pont',roulants:'roulant',palans:'palan',elingues:'elingue',chaines:'chaine',textiles:'textile',echelles:'echelle',escabeaux:'escabeau',manilles:'manille',brins:'brin',poutres:'poutre',electriques:'electrique',manuels:'manuel',potences:'potence'};return namingSearchKey(value).split(' ').map(word=>plurals[word]||word).join(' ');}
function namingContains(haystack,needle){return !!needle&&(' '+haystack+' ').includes(' '+needle+' ');}
function namingAliases(name){
 const key=namingLexicon(name),aliases={
  'pont roulant':['pont rlt','pont roul'], 'harnais antichute':['harnais','harnais de securite','harnais anti chute'],
  'elingue chaine':['elingue a chaine','eling chaine','elingue chain'], 'elingue textile':['elingue ronde','elingue sangle','elingue en textile'],
  'palan sur potence':['palan potence'], 'palan sur monorail':['palan monorail'], 'table elevatrice':['table elev'],
 };
 return [key,...(aliases[key]||[])];
}
function technicalVariantRecognizable(name){return /\b(?:monopoutre|bipoutre|electrique|manuel|brin|tonne|tonnes|acier|inox|aluminium|alu|galvanise|m\d+|\d+\s*(?:t|kg|mm|cm|m)|simple|double|triple|quadruple|textile|chaine|hauteur|largeur|capacite)\b/.test(namingLexicon(name));}
export function suggestEquipmentNaming(e,state){
 const originalName=historicalEquipmentName(e),text=namingLexicon(originalName),types=state.equipmentTypes||[],rules=(state.namingRules||[]).filter(rule=>rule.enabled!==false&&rule.key===namingSearchKey(originalName));
 const marks=detectEquipmentMarks(originalName),issues=[];if(marks.length>1&&!e.equipmentMark)issues.push('Plusieurs repères possibles : '+marks.join(', '));
 const proposal={equipmentId:e.id,originalName,currentName:e.designation||'',typeId:'',variantId:'',equipmentMark:e.equipmentMark|| (marks.length===1?marks[0]:''),location:e.location||'',ownerReviewRequired:ownerNeedsNamingReview(e),confidence:'unmatched',reason:'Aucun type du catalogue reconnu.',issues,candidates:[],ruleId:null,selected:false,approved:false};
 if(rules.length===1){const rule=rules[0],type=types.find(t=>t.id===rule.typeId),variant=type?.variants.find(v=>v.id===rule.variantId);if(type&&(!rule.variantId||variant)&&!technicalVariantIssue(variant?.name||'',{equipment:state.equipment,owners:state.owners})){Object.assign(proposal,{typeId:type.id,variantId:rule.variantId||'',ruleId:rule.id,confidence:issues.length?'ambiguous':'rule',reason:'Règle exacte validée : '+rule.sourceName});if(!e.owner&&!e.additionalOwners?.length&&/\bharnais\b/.test(namingLexicon(type.name)))proposal.ownerReviewRequired=true;return proposal;}}
 if(rules.length){proposal.confidence='ambiguous';proposal.reason='Règle contradictoire ou cible indisponible : corrigez la correspondance.';return proposal;}
 let matches=types.map(type=>({type,alias:namingAliases(type.name).find(alias=>namingContains(text,alias))})).filter(match=>match.alias);
 // Écarter un type générique seulement si son libellé est inclus dans un type plus précis reconnu.
 matches=matches.filter(match=>!matches.some(other=>other!==match&&namingContains(namingLexicon(other.type.name),namingLexicon(match.type.name))&&namingLexicon(other.type.name)!==namingLexicon(match.type.name)));
 proposal.candidates=matches.map(match=>match.type.id);
 if(matches.length!==1){proposal.confidence=matches.length?'ambiguous':'unmatched';proposal.reason=matches.length?'Plusieurs types possibles : '+matches.map(match=>match.type.name).join(' / '):proposal.reason;return proposal;}
 const {type,alias}=matches[0];proposal.typeId=type.id;proposal.confidence=alias===namingLexicon(type.name)?'high':'medium';proposal.reason=proposal.confidence==='high'?'Libellé du catalogue explicitement présent.':'Abréviation ou variation d’écriture reconnue : à vérifier.';
 const variants=type.variants.filter(variant=>!technicalVariantIssue(variant.name,{equipment:state.equipment,owners:state.owners})&&technicalVariantRecognizable(variant.name)&&namingContains(text,namingLexicon(variant.name)));
 if(variants.length===1)proposal.variantId=variants[0].id;
 if(variants.length>1){proposal.confidence='ambiguous';issues.push('Plusieurs variantes explicites : '+variants.map(v=>v.name).join(' / '));}
 if(issues.length)proposal.confidence='ambiguous';
 if(!e.owner&&!e.additionalOwners?.length&&/\bharnais\b/.test(namingLexicon(type.name)))proposal.ownerReviewRequired=true;
 return proposal;
}
export function saveNamingRule(state,{id,sourceName,typeId,variantId='',enabled=true},by,at){
 sourceName=String(sourceName??'').trim();if(!sourceName||sourceName.length>1000)throw Error('Le nom historique de la règle doit comporter de 1 à 1 000 caractères.');
 const label=standardizedLabel(state.equipmentTypes,typeId,variantId);if(!label)throw Error('Choisissez un type du catalogue.');
 const type=state.equipmentTypes.find(t=>t.id===typeId),variant=type.variants.find(v=>v.id===variantId),issue=technicalVariantIssue(variant?.name||'',state);if(issue)throw Error(issue);
 const key=namingSearchKey(sourceName);state.namingRules??=[];let rule=state.namingRules.find(r=>r.key===key);
 if(rule){if(rule.typeId===typeId&&(rule.variantId||'')===variantId&&(rule.enabled!==false)===enabled)return rule;rule.history=[...(rule.history||[]),{at,by,typeId:rule.typeId,variantId:rule.variantId||'',enabled:rule.enabled!==false}];Object.assign(rule,{typeId,variantId,enabled,updatedAt:at,updatedBy:by});}
 else{rule={id,key,sourceName,typeId,variantId,enabled,createdAt:at,by,history:[]};state.namingRules.push(rule);}return rule;
}
export function applyNamingReview(state,choices,{confirmed=false,by,at,rememberRules=false,newId=()=>crypto.randomUUID()}={}){
 if(!confirmed)throw Error('Confirmez la standardisation après prévisualisation.');
 const selected=choices.filter(choice=>choice.selected);if(!selected.length)throw Error('Sélectionnez au moins une fiche.');
 const next=structuredClone(state),seen=new Set(),ruleTargets=new Map();
 for(const choice of selected){
  if(!choice.approved)throw Error('Validez chaque proposition sélectionnée avant de l’appliquer.');if(seen.has(choice.equipmentId))throw Error('Une fiche est sélectionnée plusieurs fois.');seen.add(choice.equipmentId);
  const e=next.equipment.find(item=>item.id===choice.equipmentId);if(!e)throw Error('Une fiche a disparu : refaites l’analyse.');if(choice.originalName!==historicalEquipmentName(e))throw Error('Un nom historique a changé : refaites l’analyse.');
  const type=next.equipmentTypes.find(t=>t.id===choice.typeId);if(!type)throw Error('Choisissez un type pour chaque fiche.');const variant=type.variants.find(v=>v.id===choice.variantId);if(choice.variantId&&!variant)throw Error('La variante ne correspond pas au type choisi.');
  const issue=technicalVariantIssue(variant?.name||'',next);if(issue)throw Error(issue);
  const mark=String(choice.equipmentMark??'').trim();if(mark.length>120||/[\r\n]/.test(mark))throw Error('Repère équipement invalide (120 caractères maximum).');
  applyEquipmentNaming(e,next.equipmentTypes,type.id,choice.variantId||'',by,at.slice(0,10),{at,equipmentMark:mark,ownerReviewRequired:!!choice.ownerReviewRequired,source:'Prévisualisation validée',ruleId:choice.ruleId||null,context:next});
  if(rememberRules){const key=namingSearchKey(choice.originalName),target=type.id+'|'+(choice.variantId||'');if(ruleTargets.has(key)&&ruleTargets.get(key)!==target)throw Error('Le même ancien nom possède deux cibles différentes : désactivez la mémorisation ou corrigez les choix.');ruleTargets.set(key,target);saveNamingRule(next,{id:newId(),sourceName:choice.originalName,typeId:type.id,variantId:choice.variantId||''},by,at);}
 }
 if(!nomenclatureValid(next))throw Error('Nomenclature invalide : aucune modification appliquée.');return next;
}

function namingExtensionValid(data){
 if(!data||!Array.isArray(data.equipment))return false;
 if(data.equipment.some(e=>e.equipmentMark!==undefined&&(typeof e.equipmentMark!=='string'||e.equipmentMark.length>120||/[\r\n]/.test(e.equipmentMark))||e.ownerReviewRequired!==undefined&&typeof e.ownerReviewRequired!=='boolean'))return false;
 if(data.namingRules===undefined)return true;if(!Array.isArray(data.namingRules)||data.namingRules.length>5000)return false;
 const keys=new Set(),ids=new Set();return data.namingRules.every(r=>{if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.sourceName!=='string'||!r.sourceName.trim()||r.sourceName.length>1000||r.key!==namingSearchKey(r.sourceName)||keys.has(r.key)||!r.key||typeof r.by!=='string'||!r.by.trim()||typeof r.createdAt!=='string'||isNaN(Date.parse(r.createdAt))||typeof r.enabled!=='boolean'||!Array.isArray(r.history))return false;keys.add(r.key);ids.add(r.id);const t=data.equipmentTypes?.find(t=>t.id===r.typeId);return !!t&&(!r.variantId||t.variants.some(v=>v.id===r.variantId))&&r.history.every(h=>h&&typeof h.by==='string'&&typeof h.at==='string'&&!isNaN(Date.parse(h.at))&&typeof h.typeId==='string'&&typeof h.variantId==='string'&&typeof h.enabled==='boolean');});
}
export function applyImportedNamingRule(e,state,{confirmed=false,by,at}={}){
 if(!confirmed)throw Error('Confirmez les règles de nomenclature dans l’aperçu de l’import.');
 const proposal=suggestEquipmentNaming(e,state);if(proposal.confidence!=='rule'||proposal.issues.length||!proposal.ruleId)return false;
 applyEquipmentNaming(e,state.equipmentTypes,proposal.typeId,proposal.variantId,by,at.slice(0,10),{at,equipmentMark:proposal.equipmentMark,ownerReviewRequired:proposal.ownerReviewRequired,source:'Règle validée réutilisée après aperçu Excel',ruleId:proposal.ruleId,context:state});return true;
}
