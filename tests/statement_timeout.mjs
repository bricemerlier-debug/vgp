import assert from 'node:assert/strict';import {CloudStore} from '../cloud.mjs';
const config={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001'};
const c=new CloudStore(config,{storage:{getItem:()=>null},persistentStorage:{getItem:()=>null},fetcher:async()=>({ok:false,status:500,json:async()=>({code:'57014',message:'canceling statement due to statement timeout'})})});
c.session={access_token:'fictif',expires_at:Date.now()/1000+3600};c.revision=7;await assert.rejects(()=>c.write({equipment:[]}),/délai serveur dépassé/);assert.equal(c.revision,7);assert.equal(c.busy,false);console.log('Délai SQL : erreur expliquée en français avec correctif, aucune réussite annoncée ni révision avancée.');
