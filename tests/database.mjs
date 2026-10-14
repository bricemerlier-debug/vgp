import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated;`);
await db.exec(readFileSync('supabase/001_schema.sql','utf8'));
if(process.env.VGP_FAST_SQL==='1'){await db.exec(readFileSync('supabase/003_tracking_guard.sql','utf8'));await db.exec(readFileSync('supabase/004_fast_writes.sql','utf8'));}
const w='10000000-0000-0000-0000-000000000001',admin='20000000-0000-0000-0000-000000000001',reader='20000000-0000-0000-0000-000000000002',other='20000000-0000-0000-0000-000000000003';
const editor='20000000-0000-0000-0000-000000000004';await db.query(`insert into auth.users values($1),($2),($3),($4)`,[admin,reader,other,editor]);
await db.query('insert into public.workspaces values($1,$2)',[w,'Test']);await db.query('insert into public.workspace_state(workspace_id) values($1)',[w]);await db.query("insert into public.workspace_members values($1,$2,'admin'),($1,$3,'reader')",[w,admin,reader]);await db.query("insert into public.workspace_members values($1,$2,'editor')",[w,editor]);
async function role(user,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+role);}
async function write(doc,revision,source=null){return (await db.query('select public.write_state($1,$2,$3::jsonb,$4) as value',[w,revision,JSON.stringify(doc),source])).rows[0].value;}
const control={id:'c1',reportId:'VGP-001',date:'2026-10-01',intervenant:'Vérificateur',result:'Bon état',attachment:{url:'data:application/pdf;base64,YWJj'},equipmentSnapshot:{designation:'Anneau'}};
const document={equipment:[{id:'e1',siteId:1,identifier:'ABC',serialNumber:'SN1',designation:'Anneau',months:12,controls:[control],archived:false}],owners:['Marie'],ownerContacts:[{owner:'Marie',email:'marie@example.fr'}]};
await role(null,'anon');await assert.rejects(()=>db.query('select * from public.equipment'));await assert.rejects(()=>db.query('select public.read_state($1)',[w]));
await role(other);assert.equal((await db.query('select * from public.workspace_state')).rows.length,0);await assert.rejects(()=>write(document,0));await assert.rejects(()=>db.query("insert into public.workspace_members values($1,$2,'admin')",[w,other]));
await role(reader);await assert.rejects(()=>write(document,0));await assert.rejects(()=>db.query('update public.workspace_state set revision=4'));
await role(admin);const migration=await write(document,0,'JSON test');assert.equal(migration.revision,1);assert.ok(migration.receipt);
const read=(await db.query('select public.read_state($1) as state',[w])).rows[0].state;assert.deepEqual(read.payload,document);
await assert.rejects(()=>write(document,1),/Validez la migration/);
await db.query('select public.validate_migration($1,$2,$3::jsonb)',[w,migration.receipt,JSON.stringify(document)]);
await assert.rejects(()=>write(document,0),/REVISION_CONFLICT/);await assert.rejects(()=>write(document,null),/REVISION_CONFLICT/);
await assert.rejects(()=>write({...document,equipment:[]},1),/Suppression interdite/);
await assert.rejects(()=>write({...document,equipment:[{...document.equipment[0],controls:[]}]},1),/Historique/);
const duplicate={...document,equipment:[...document.equipment,{...document.equipment[0],id:'e2',siteId:2,controls:[],identifier:' abc ',serialNumber:'NEW',archived:true}]};
await assert.rejects(()=>write(duplicate,1),/unique/);
duplicate.equipment[1].identifier='SECOND';duplicate.equipment[1].serialNumber=' sn1 ';await assert.rejects(()=>write(duplicate,1),/unique/);
assert.equal((await db.query('select public.read_state($1) as state',[w])).rows[0].state.revision,1);
await write({...document,comments:'PC update'},1);await assert.rejects(()=>write({...document,comments:'phone update'},1),/REVISION_CONFLICT/);
await role(reader);assert.equal((await db.query('select * from public.controls')).rows[0].details.attachment.url,control.attachment.url);
await role(editor);assert.equal((await write({...document,comments:'editor update'},2)).revision,3);await assert.rejects(()=>write(document,3,'JSON'),/Migration réservée/);
console.log('PostgreSQL : RLS, rôles, migration, pièces jointes, doublons, historique, conflits et transactions validés.');await db.close();
