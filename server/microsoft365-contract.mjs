// Contrat de branchement à faire valider par l'IT. Aucun appel réseau / lecture de secret.
export function microsoft365Message({recipient,subject,text,correlationId}){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw Error('Adresse destinataire invalide.');
 return {message:{subject,body:{contentType:'Text',content:text},toRecipients:[{emailAddress:{address:recipient}}],internetMessageHeaders:[{name:'x-vgp-reminder-id',value:correlationId}]},saveToSentItems:true};
}
export function microsoft365Transport(){throw Error('Connecteur Microsoft 365 non activable dans cette version de développement. Accord IT, implémentation serveur et recette isolée requis.');}
