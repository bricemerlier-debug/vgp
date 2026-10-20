// Rapprochement local d'un inventaire terrain avec les fiches VGP, sans écriture.
export const inventoryKey=value=>String(value??'').normalize('NFKC').trim().toLocaleUpperCase('fr').replace(/[\s\u00a0-]+/g,'');
export function inventoryNumbers(text){return String(text??'').split(/[\s,;]+/).map(inventoryKey).filter(Boolean);}
export function reconcileInventory(equipment,observedText,prefix='CA'){
 const scope=inventoryKey(prefix);if(!scope)throw Error('Indiquez le préfixe des équipements inventoriés.');
 const observations=inventoryNumbers(observedText),seen=new Set(),duplicates=[];
 for(const number of observations){if(seen.has(number))duplicates.push(number);seen.add(number);}
 const scoped=equipment.filter(item=>inventoryKey(item.identifier).startsWith(scope));
 const byNumber=new Map();for(const item of equipment){const key=inventoryKey(item.identifier);if(!byNumber.has(key))byNumber.set(key,[]);byNumber.get(key).push(item);}
 const found=[],archived=[],unknown=[],ambiguous=[],outside=[];
 for(const number of seen){const matches=byNumber.get(number)||[];if(matches.length>1)ambiguous.push({number,matches});else if(!matches.length)unknown.push(number);else if(!inventoryKey(matches[0].identifier).startsWith(scope))outside.push({number,item:matches[0]});else if(matches[0].archived)archived.push({number,item:matches[0]});else found.push({number,item:matches[0]});}
 const missing=scoped.filter(item=>!item.archived&&!seen.has(inventoryKey(item.identifier)));
 return {scope,observed:seen.size,scoped:scoped.length,found,archived,unknown,ambiguous,outside,duplicates:[...new Set(duplicates)],missing};
}
