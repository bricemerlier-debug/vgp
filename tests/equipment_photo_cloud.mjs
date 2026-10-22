import assert from 'node:assert/strict';
import {CloudStore} from '../cloud.mjs';

const workspaceId='10000000-0000-0000-0000-000000000001',calls=[];let storedPath=null;
const fetcher=async(url,options={})=>{
 calls.push([url,options.method||'GET']);
 const json=value=>({ok:true,json:async()=>value});
 if(url.includes('/rest/v1/equipment_photos?'))return json(storedPath?[{photo_path:storedPath}]:[]);
 if(url.includes('/storage/v1/object/equipment-photos/')){
  if(options.method==='POST'){assert.equal(options.body.type,'image/jpeg');assert.ok(options.body.size<=200*1024);return json({Key:url});}
  if(options.method==='DELETE')return json({});
 }
 if(url.endsWith('/rest/v1/rpc/set_equipment_photo')){const body=JSON.parse(options.body),previousPath=storedPath;assert.equal(body.w,workspaceId);storedPath=body.photo_path;return json({path:storedPath,previousPath});}
 if(url.includes('/storage/v1/object/sign/equipment-photos/')&&options.method==='POST')return json({signedURL:'/object/sign/equipment-photos/'+storedPath+'?token=fictif'});
 if(url.includes('?token=fictif'))return {ok:true,blob:async()=>new Blob(['jpeg fictif'],{type:'image/jpeg'})};
 throw Error('Appel inattendu : '+url);
};
const cloud=new CloudStore({enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId},{fetcher,storage:{getItem:()=>null},persistentStorage:{getItem:()=>null}});
cloud.session={access_token:'fictif',expires_at:Date.now()/1000+3600};
assert.equal(await cloud.equipmentPhotoPath('e1'),null);
const path=await cloud.equipmentPhotoUpload(new Blob(['jpeg fictif'],{type:'image/jpeg'}));
assert.match(path,/^10000000-0000-0000-0000-000000000001\/[a-f0-9-]{36}_[a-f0-9]{64}\.jpg$/);
assert.equal((await cloud.equipmentPhotoSet('e1',path)).path,path);
assert.equal(await cloud.equipmentPhotoPath('e1'),path);
assert.equal((await cloud.equipmentPhotoBlob(path)).type,'image/jpeg');
assert.equal((await cloud.equipmentPhotoSet('e1',null)).previousPath,path);
await cloud.equipmentPhotoRemove(path);
assert.ok(calls.some(([url])=>url.includes('/rpc/set_equipment_photo')));
console.log('Photo VGP cloud : chemin privé, liaison SQL, URL signée et nettoyage validés.');
