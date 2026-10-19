import assert from 'node:assert/strict';
import {CloudStore} from '../cloud.mjs';
const config={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001'};
const requests=[];
const cloud=new CloudStore(config,{storage:{getItem:()=>null},persistentStorage:{getItem:()=>null},fetcher:async(url,options)=>{
 const body=JSON.parse(options.body||'{}');requests.push({url,body});
 const result=url.endsWith('tracking_ready')?true:{revision:2};
 return {ok:true,json:async()=>result};
}});
cloud.session={access_token:'test',expires_at:Date.now()/1000+3600};cloud.revision=1;
const containers=[{id:'c1',number:'CE048',type:'CE',subtype:'R2 - VERTE',interventions:[]}];
await cloud.writeContainers(containers);
assert.equal(cloud.revision,2);
assert.deepEqual(requests.find(r=>r.url.endsWith('write_containers')).body.containers,containers);
assert.equal(cloud.busy,false);
console.log('Client : écriture ciblée des contenants et révision confirmées.');
