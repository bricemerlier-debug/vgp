import assert from 'node:assert/strict';
import {containerPhotoReferenceValid,containerRecordsValid} from '../containers.mjs';
import {CloudStore} from '../cloud.mjs';

const workspace='10000000-0000-0000-0000-000000000001';
const photo='30000000-0000-0000-0000-000000000001';
const container={id:'40000000-0000-0000-0000-000000000001',number:'CE048',type:'CE',subtype:'R2 - VERTE',interventions:[]};
assert.equal(containerPhotoReferenceValid(container),true);
assert.equal(containerPhotoReferenceValid({...container,photoPath:'local:'+photo}),true);
assert.equal(containerPhotoReferenceValid({...container,photoPath:`${workspace}/${photo}_${'a'.repeat(64)}.jpg`}),true);
for(const photoPath of ['data:image/jpeg;base64,YWJj','https://example.test/photo.jpg',`${workspace}/photo.jpg`,`${workspace}/${photo}_bad.jpg`])
 assert.equal(containerPhotoReferenceValid({...container,photoPath}),false,photoPath);
assert.equal(containerRecordsValid({containers:[{...container,photoPath:`${workspace}/${photo}_${'b'.repeat(64)}.jpg`}]}),true);
assert.equal(containerRecordsValid({containers:[{...container,photoPath:'data:image/jpeg;base64,YWJj'}]}),false);

const requests=[];
const cloud=new CloudStore({enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:workspace},{storage:{getItem:()=>null},persistentStorage:{getItem:()=>null},fetcher:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({})};}});
cloud.session={access_token:'test',expires_at:Date.now()/1000+3600};
const path=`${workspace}/${photo}_${'c'.repeat(64)}.jpg`;
await cloud.removeContainerPhoto(path);
assert.equal(requests[0].url,'https://test.supabase.co/storage/v1/object/equipment-maintenance/'+path);
assert.equal(requests[0].options.method,'DELETE');
await assert.rejects(()=>cloud.removeContainerPhoto(`20000000-0000-0000-0000-000000000001/${photo}_${'c'.repeat(64)}.jpg`),/Référence photo invalide/);
assert.equal(requests.length,1);
console.log('Photos de contenants : références contrôlées, aucun base64 dans les fiches et suppression Supabase limitée à l’espace courant.');
