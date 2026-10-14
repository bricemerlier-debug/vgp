// Conversion locale : aucune connexion, aucun contrôle ni numéro inventé.
const conversionText=v=>v==null?'':v instanceof Date?v.toISOString():String(v).trim();
export function prepareEquipmentWorkbook(rows,fileName='Export MemoryFlow'){
 if(!Array.isArray(rows)||rows.length<2||rows.length>5001)throw Error('Le fichier doit contenir entre 1 et 5 000 équipements.');
 const headings=rows[0].map(conversionText),get=(r,k)=>r[headings.indexOf(k)];
 if(!['Nom','Numéro interne','N° de série','ID','Date de mise en service'].every(h=>headings.includes(h)))throw Error('Choisissez l’export des équipements MemoryFlow, avec Nom, Numéro interne, N° de série, ID et Date de mise en service.');
 const records=rows.slice(1).map((r,i)=>({r,line:i+2})).filter(x=>x.r.some(v=>conversionText(v)));
 const counts=key=>{const m=new Map();for(const {r} of records){const v=conversionText(get(r,key)).toLocaleLowerCase('fr');if(v)m.set(v,(m.get(v)||0)+1);}return m;};
 const internals=counts('Numéro interne'),serials=counts('N° de série');
 const headers=['Numéro interne','Nom','Numéro de série','Secteur','Zone','Équipe','Propriétaire','Email','Localisation','Périodicité mois','Dernier contrôle','Vérificateur','Résultat','Prochain contrôle','Commentaire','ID MemoryFlow'];
 const ready=[headers],corrections=[[...headers,'Ligne source','À corriger']];
 for(const {r,line} of records){const text=k=>conversionText(get(r,k)),identifier=text('Numéro interne'),serial=text('N° de série'),name=text('Nom'),reasons=[];
 if(!identifier)reasons.push('Numéro interne manquant : renseigner le numéro réel, sans utiliser automatiquement l’ID MemoryFlow.');
 else if(internals.get(identifier.toLocaleLowerCase('fr'))>1)reasons.push('Numéro interne partagé entre plusieurs lignes : vérifier les équipements, aucune fusion automatique.');
 if(serial&&serials.get(serial.toLocaleLowerCase('fr'))>1)reasons.push('Numéro de série partagé entre plusieurs lignes : vérifier la valeur, sans l’effacer arbitrairement.');
 if(!name)reasons.push('Nom manquant.');
 const sector=/\bSecteur\s+(A1|A2|B1|B2|B3)\b/i.exec(text('Catégorie'))?.[1].toUpperCase()||'';
 const comments=[text('Commentaire'),`Origine : ${fileName}, ID MemoryFlow ${text('ID')}. Nom d’origine conservé, aucune classification automatique.`].filter(Boolean);
 for(const key of ['Site/Service','Catégorie','Famille de contrôle','Interne','Marque','Modèle','Capacité','Date de mise en service'])if(text(key))comments.push(`${key} (source) : ${text(key)}`);
 comments.push('Aucun contrôle réalisé ni échéance validée déduit de cet export. Périodicité non fournie, à valider. La mise en service n’est pas une date de contrôle.');
 const row=[identifier,name,serial,sector,'','',text('Propriétaire'),'', [text('Localisation'),text('Précisions emplacement')].filter(Boolean).join(' — '),'','','','','',comments.join('\n'),text('ID')];
 if(reasons.length)corrections.push([...row,line,reasons.join('\n')]);else ready.push(row);
 }
 const importable=ready.length-1,toCorrect=corrections.length-1;
 const notes=[['Import VGP — conversion locale','Consignes'],['Équipements source',records.length],['Fiches importables',importable],['Fiches à corriger',toCorrect],['Import','⚙ > Données > Ajouter depuis Excel. Le site lit uniquement la première feuille A importer. Les doublons avec le site sont signalés au moment de l’import.'],['Corrections','Les fiches bloquées restent dans A corriger. Vérifier les numéros manquants ou partagés, puis préparer un nouveau fichier dont la première feuille contient uniquement les fiches corrigées et les mêmes colonnes.'],['Original','Export original conserve les lignes et colonnes source. Les numéros sont écrits comme texte. Aucun numéro, nom standard ou contrôle n’est inventé.'],['Dates','Dernier contrôle, résultat, vérificateur et prochaine échéance restent vides. La mise en service est conservée comme information source dans Commentaire, sans créer de VGP.'],['Périodicité','La colonne reste vide car l’export n’en fournit pas. Le site propose actuellement 12 mois par défaut, non validés : corriger et valider la règle avec l’entreprise.'],['Informations','Marque, modèle, capacité, catégorie, famille de contrôle et ID source sont conservés dans Commentaire et Export original. Le secteur n’est repris que s’il figure explicitement dans Catégorie.'],['Localisation','Localisation et Précisions emplacement sont réunies. Zone, équipe et email restent vides, aucune information manquante n’est devinée.'],['Numéros numériques','Les zéros initiaux déjà absents des cellules numériques de l’export ne peuvent pas être reconstitués automatiquement.'],['Données','La conversion et le téléchargement se font dans le navigateur. Aucun fichier n’est envoyé au site, à Supabase ou à GitHub. Aucune fiche existante n’est modifiée.']];
 return {total:records.length,importable,toCorrect,sheets:[{name:'A importer',rows:ready},{name:'A corriger',rows:corrections},{name:'Export original',rows:rows.map(r=>r.map(v=>v instanceof Date?v.toISOString():v))},{name:'Lire avant import',rows:notes}]};
}
