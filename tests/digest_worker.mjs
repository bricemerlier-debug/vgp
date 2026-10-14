import {build} from 'esbuild';
import assert from 'node:assert/strict';
const NativeDate=Date;globalThis.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:['2026-06-01T05:00:00Z']));}};
const secrets={DIGEST_CRON_SECRET:'fictional-cron-secret',SUPABASE_URL:'https://fictional.example',SUPABASE_SERVICE_ROLE_KEY:'fictional-service-key',DIGEST_WORKSPACE_ID:'fictional-workspace',MS_TENANT_ID:'fictional-tenant',MS_CLIENT_ID:'fictional-client',MS_CLIENT_SECRET:'fictional-secret',MS_SENDER:'sender@example.com'};let handler,mailCalls=0,dbCalls=0,claimCount=0,claims=new Set(),failed=false;
globalThis.Deno={env:{get:key=>secrets[key]},serve:fn=>handler=fn};
globalThis.fetch=async (url,options={})=>{
 url=String(url);
 if(url.includes('workspace_state')){dbCalls++;return Response.json([{payload:{equipment:[],digestSettings:{recipient:'test@example.com',week:true,month:true}}}]);}
 if(url.includes('oauth2'))return Response.json({access_token:'fictional-token'});
 if(url.includes('sendMail')){mailCalls++;if(failed)throw Error('fictional lost response');return new Response(null,{status:202});}
 if(url.includes('digest_deliveries')){if(options.method==='POST'){const job=JSON.parse(options.body),id=job.kind+job.period_start;if(claims.has(id))return new Response(null,{status:409});claims.add(id);claimCount++;return new Response(null,{status:201});}return new Response(null,{status:204});}
 throw Error('Unexpected mocked URL');
};
const bundle=await build({entryPoints:['supabase/functions/vgp-digests/index.ts'],bundle:true,write:false,format:'esm',platform:'neutral'});await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const invoke=(auth='fictional-cron-secret')=>handler(new Request('https://fictional.example/function',{method:'POST',headers:{Authorization:'Bearer '+auth}}));
assert.equal((await invoke('wrong')).status,401);assert.equal(dbCalls,0);
let response=await invoke();assert.equal((await response.json()).reports.length,2);assert.equal(mailCalls,0);assert.equal(claimCount,0);
secrets.DIGEST_SEND_ENABLED='true';await Promise.all([invoke(),invoke()]);assert.equal(mailCalls,2);assert.equal(claimCount,2);await invoke();assert.equal(mailCalls,2);
claims.clear();failed=true;await invoke();assert.equal(mailCalls,4);await invoke();assert.equal(mailCalls,4,'pas de double envoi après réponse perdue');
console.log('PASS worker : secret obligatoire, simulation sans mail/réservation, lundi premier du mois, réservation concurrente et absence de relance ambiguë. Tous les appels réseau sont simulés.');
