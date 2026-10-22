const controllerKey=value=>String(value??'').trim().toLocaleLowerCase('fr');
const controllerParts=value=>String(value??'').split('/').map(part=>part.trim()).filter(Boolean);

export function activeControllers(profiles=[]){
  const active=profiles.filter(p=>!p.deletedAt&&!p.mergedInto);
  const hasFriedlander=active.some(p=>controllerKey(p.name)==='friedlander');
  return active.filter(profile=>{
    if(hasFriedlander&&controllerKey(profile.name)==='autre')return false;
    const parts=controllerParts(profile.name);
    if(parts.length<2)return true;
    return !parts.every(part=>{
      const component=componentController(profiles,part);
      return component&&component.id!==profile.id;
    });
  });
}

export function resolvedControllerId(profiles,id){const seen=new Set();let p=profiles.find(p=>p.id===id);while(p?.mergedInto){if(seen.has(p.id))return null;seen.add(p.id);p=profiles.find(row=>row.id===p.mergedInto);}return p?.id||null;}
export function controllerForName(profiles,name,resolve=true){const profile=profiles.find(p=>[p.name,...(p.aliases||[])].some(n=>controllerKey(n)===controllerKey(name)));return profile&&resolve?profiles.find(p=>p.id===resolvedControllerId(profiles,profile.id)):profile;}

function componentController(profiles,name){
  let profile;
  if(controllerKey(name)==='autre')profile=profiles.find(p=>!p.deletedAt&&!p.mergedInto&&controllerKey(p.name)==='friedlander');
  profile??=controllerForName(profiles,name);
  const id=profile&&resolvedControllerId(profiles,profile.id);
  return id?profiles.find(p=>p.id===id):null;
}

function controllerNameMatches(profile,name){
  const key=controllerKey(name);
  if(controllerKey(profile.name)==='friedlander'&&key==='autre')return true;
  return [profile.name,...(profile.aliases||[])].some(value=>controllerKey(value)===key);
}

export function controlBelongsToController(control,profile,profiles=[]){
  if(!profiles.length){
    if(control.verifierId)return control.verifierId===profile.id;
    return [control.intervenant].flatMap(controllerParts).some(name=>controllerNameMatches(profile,name));
  }
  const targetId=resolvedControllerId(profiles,profile.id);
  if(!targetId)return false;
  if(control.verifierId&&resolvedControllerId(profiles,control.verifierId)===targetId)return true;
  const source=control.verifierId&&profiles.find(p=>p.id===control.verifierId);
  const labels=[control.intervenant,source?.name,...(source?.aliases||[])];
  return labels.flatMap(controllerParts).some(name=>componentController(profiles,name)?.id===targetId);
}

export function controllerReportEntries(state,profile){
 const profiles=state.controllerProfiles||[],entries=[];
 const targetId=resolvedControllerId(profiles,profile.id);
 const belongs=control=>{
  const origin=state.controllerOrigins?.[control.id];
  if(origin&&resolvedControllerId(profiles,origin)===targetId)return true;
  return controlBelongsToController({...control,intervenant:control.intervenant||control.verifierSnapshot?.name||control.controller||''},profile,profiles);
 };
 for(const equipment of state.equipment||[]){
  for(const control of equipment.controls||[]){
   if(!belongs(control))continue;
   entries.push({equipment,record:control,kind:'control',label:control.result==='Introuvable'?'Déclaration d’introuvable':control.result==='Mauvais état — à jeter'?'Contrôle · mise au rebut':control.result});
  }
  for(const event of equipment.archiveHistory||[]){
   if(!event.reportId&&!event.signedAttachment&&!event.apave?.reportHash&&!event.apave?.reportNumber)continue;
   const linked=(equipment.controls||[]).find(control=>control.id===(event.controlId||event.originalControlId));
   if(event.verifierId){if(resolvedControllerId(profiles,event.verifierId)!==targetId)continue;}
   else if(!controlBelongsToController({intervenant:event.requester||''},profile,profiles)&&!(linked&&belongs(linked)))continue;
   entries.push({equipment,record:event,kind:'event',label:event.reason==='Mis au rebut'?'Destruction / mise au rebut':event.reason==='Équipement perdu'?'Déclaration d’introuvable':event.reason||'Rapport d’archivage'});
  }
 }
 return entries.sort((a,b)=>b.record.date.localeCompare(a.record.date)||(b.record.time||'').localeCompare(a.record.time||'')||(b.record.created||0)-(a.record.created||0));
}

export function upgradeControllers(state,newId){
  state.controllerProfiles??=[];
  const controls=(state.equipment||[]).flatMap(e=>e.controls||[]);
  const names=[...(state.verifiers||[]),...controls.map(c=>c.intervenant)].filter(name=>typeof name==='string'&&name.trim());
  const ensure=name=>{
    const value=String(name??'').trim();
    if(value&&!controllerForName(state.controllerProfiles,value))state.controllerProfiles.push({id:newId(),name:value,email:'',signature:null});
  };
  for(const name of names){
    ensure(name);
    for(const part of controllerParts(name))ensure(controllerKey(part)==='autre'?'Friedlander':part);
  }
  state.verifiers=activeControllers(state.controllerProfiles).map(p=>p.name);
  return state;
}

export function controllersValid(state){if(state.controllerProfiles===undefined)return true;if(!Array.isArray(state.controllerProfiles))return false;const ids=new Set(),names=new Map();for(const p of state.controllerProfiles){if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>160||typeof p.email!=='string'||p.email.length>254||p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))return false;ids.add(p.id);if(p.deletedAt!==undefined&&(typeof p.deletedAt!=='string'||!Number.isFinite(Date.parse(p.deletedAt))))return false;if(p.mergedInto!==undefined&&(typeof p.mergedInto!=='string'||!p.deletedAt||p.mergedInto===p.id||!resolvedControllerId(state.controllerProfiles,p.id)))return false;if(p.aliases!==undefined&&(!Array.isArray(p.aliases)||p.aliases.some(n=>typeof n!=='string'||!n.trim()||n.length>160)))return false;for(const name of [p.name,...(p.aliases||[])]){const key=controllerKey(name);const resolved=resolvedControllerId(state.controllerProfiles,p.id);if(names.has(key)&&names.get(key)!==resolved)return false;names.set(key,resolved);}const s=p.signature;if(s!=null&&(!s||typeof s.name!=='string'||s.name.length>255||!['image/png','image/jpeg','image/webp'].includes(s.type)||typeof s.url!=='string'||s.url.length>1400000||!s.url.startsWith('data:'+s.type+';base64,')||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s.url)))return false;}if(state.controllerOrigins!==undefined){if(!state.controllerOrigins||typeof state.controllerOrigins!=='object'||Array.isArray(state.controllerOrigins))return false;for(const [id,origin] of Object.entries(state.controllerOrigins)){const c=state.equipment.flatMap(e=>e.controls).find(c=>c.id===id);if(!c||c.verifierId||typeof origin!=='string'||!ids.has(origin)||resolvedControllerId(state.controllerProfiles,origin)!==controllerForName(state.controllerProfiles,c.intervenant)?.id)return false;}}return state.equipment.every(e=>e.controls.every(c=>c.verifierId===undefined||typeof c.verifierId==='string'&&ids.has(c.verifierId)));}
