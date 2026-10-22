export function professionalDeclarationIdentity(value){
 const email=String(value??'').trim().toLowerCase();
 if(email.length>254||!/^[a-z]+(?:-[a-z]+)*_[a-z]+(?:[-_][a-z]+)*@goodyear\.com$/.test(email))throw Error('Renseignez votre adresse professionnelle personnelle : prenom_nom@goodyear.com.');
 const name=email.split('@')[0].split('_').map(part=>part.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join('-')).join(' ');
 if(name.length>160)throw Error('Adresse professionnelle trop longue.');
 return {email,name};
}
