const ownerKey=value=>String(value??'').trim().toLocaleLowerCase('fr');
export function equipmentOwners(e){return [...new Map([e.owner,...(e.additionalOwners||[])].filter(Boolean).map(name=>[ownerKey(name),name])).values()];}
export function equipmentHasOwner(e,name){return name?equipmentOwners(e).some(n=>ownerKey(n)===ownerKey(name)):equipmentOwners(e).length===0;}
export function addEquipmentOwner(e,name){name=String(name??'').trim();if(!name||name.length>160)throw Error('Choisissez un propriétaire valide.');if(equipmentHasOwner(e,name))throw Error('Ce propriétaire est déjà associé.');if(e.ownerReviewRequired)e.ownerReviewRequired=false;if(!e.owner)e.owner=name;else e.additionalOwners=[...(e.additionalOwners||[]),name];return e;}
export function removeEquipmentOwner(e,name){const remaining=equipmentOwners(e).filter(n=>ownerKey(n)!==ownerKey(name));e.owner=remaining[0]||'';e.additionalOwners=remaining.slice(1);return e;}
export function equipmentOwnershipValid(e){if(!e)return false;if(e.additionalOwners===undefined)return true;if(!Array.isArray(e.additionalOwners)||e.additionalOwners.some(n=>typeof n!=='string'||!n.trim()||n.length>160))return false;const names=[e.owner,...e.additionalOwners].filter(Boolean).map(ownerKey);return new Set(names).size===names.length;}
export function equipmentMailRecipients(e,contacts){const addresses=new Set();return equipmentOwners(e).map(owner=>({owner,email:contacts.find(c=>ownerKey(c.owner)===ownerKey(owner))?.email||''})).filter(r=>{if(!r.email)return true;const key=ownerKey(r.email);if(addresses.has(key))return false;addresses.add(key);return true;});}

// Vérification à la saisie uniquement : les anciennes fiches restent consultables.
export function ownerDetailsIssue(state,name,email,exceptOwner=null){
 const key=value=>String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLocaleLowerCase('fr'),except=exceptOwner===null?null:key(exceptOwner);
 if(!name?.trim()||name.trim().length>160||key(name)!==except&&name.trim().split(/\s+/).length<2)return 'Renseignez le prénom puis le nom du propriétaire (160 caractères maximum).';
 if(!email?.trim()||email.trim().length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return 'L’adresse e-mail du propriétaire est obligatoire et doit être valide.';
 const names=[...(state.owners||[]),...(state.ownerContacts||[]).map(c=>c.owner),...(state.equipment||[]).flatMap(equipmentOwners)];
 if(names.some(n=>key(n)!==except&&key(n)===key(name)))return 'Ce propriétaire existe déjà : sélectionnez sa fiche existante.';
 const duplicate=(state.ownerContacts||[]).find(c=>key(c.owner)!==except&&c.email?.trim().toLowerCase()===email.trim().toLowerCase());
 return duplicate?'Cette adresse e-mail est déjà utilisée par « '+duplicate.owner+' ». Utilisez sa fiche existante.':'';
}
