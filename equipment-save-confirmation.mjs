import {canonical} from './cloud.mjs';

// Après une réponse réseau perdue, une révision plus récente et la fiche exacte
// confirment l'écriture. La seule présence du numéro ne suffit pas.
export function equipmentSaveConfirmed(requested,actual,equipmentId,previousRevision,currentRevision){
 if(!Number.isSafeInteger(previousRevision)||!Number.isSafeInteger(currentRevision)||currentRevision<=previousRevision)return false;
 const expected=requested?.equipment?.find(item=>item.id===equipmentId);
 const saved=actual?.equipment?.find(item=>item.id===equipmentId);
 return !!expected&&!!saved&&canonical(expected)===canonical(saved);
}
