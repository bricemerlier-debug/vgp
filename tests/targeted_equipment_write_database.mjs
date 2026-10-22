import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {goodyearReportLogo} from '../assets/report-logo.mjs';

const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;`);
for(const file of ['001_schema.sql','003_tracking_guard.sql','004_fast_writes.sql','024_recipient_loss_declaration.sql','025_recipient_scrap_declaration.sql','026_recipient_declaration_controller.sql','027_equipment_fast_save.sql','028_equipment_write_timeout.sql','031_targeted_equipment_writes.sql'])await db.exec(readFileSync('supabase/'+file,'utf8'));

const workspace='10000000-0000-0000-0000-000000000001',admin='20000000-0000-0000-0000-000000000001';
await db.query('insert into auth.users values($1,$2)',[admin,'admin@example.test']);
await db.query('insert into public.workspaces values($1,$2)',[workspace,'Test ciblé']);
await db.query('insert into public.workspace_members values($1,$2,$3)',[workspace,admin,'admin']);
await db.query('insert into public.workspace_state(workspace_id) values($1)',[workspace]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');

const equipment={id:'gear-1',siteId:1,identifier:'TEST-1',serialNumber:'SER-1',designation:'Équipement de test',owner:'Responsable Test',months:12,archived:false,archiveHistory:[],dateHistory:[],controls:[],obligations:[],periodicityValidation:{validated:false,months:12}};
const document={trackingVersion:2,owners:['Responsable Test'],ownerContacts:[{owner:'Responsable Test',email:'responsable@example.test'}],equipment:[equipment]};
await db.query('select public.write_state($1,0,$2::jsonb,null)',[workspace,JSON.stringify(document)]);

const added={...equipment,id:'gear-2',siteId:2,identifier:'TEST-2',serialNumber:'SER-2'};
await db.query('select public.write_equipment_record($1,$2,$3::jsonb)',[workspace,1,JSON.stringify(added)]);
let state=(await db.query('select public.read_state($1) as state',[workspace])).rows[0].state;
assert.equal(state.revision,2);assert.deepEqual(state.payload.equipment.map(e=>e.id),['gear-1','gear-2']);
assert.deepEqual((await db.query('select details->>\'identifier\' as identifier from public.equipment where workspace_id=$1 and id=$2',[workspace,'gear-2'])).rows[0],{identifier:'TEST-2'});
assert.deepEqual((await db.query('select payload->\'equipment\' as equipment from public.workspace_state where workspace_id=$1',[workspace])).rows[0].equipment.map(e=>e.id),['gear-1']);

const controlled=structuredClone(added);controlled.controls.push({id:'ctrl-1',reportId:'TARGET-001',date:'2026-10-21',intervenant:'Testeur',result:'Bon état',enteredById:admin,observations:'Contrôle ciblé.'});
await db.query('select public.write_equipment_record($1,$2,$3::jsonb)',[workspace,2,JSON.stringify(controlled)]);
state=(await db.query('select public.read_state($1) as state',[workspace])).rows[0].state;
assert.equal(state.revision,3);assert.equal(state.payload.equipment[1].controls[0].id,'ctrl-1');
assert.equal((await db.query('select count(*)::int as n from public.controls where workspace_id=$1',[workspace])).rows[0].n,1);
assert.equal((await db.query('select count(*)::int as n from public.equipment_write_history where workspace_id=$1',[workspace])).rows[0].n,2);

// Le chemin historique des sauvegardes composées réconcilie d'abord le JSON resté ancien.
await db.query('select public.write_state($1,$2,$3::jsonb,null)',[workspace,3,JSON.stringify(state.payload)]);
state=(await db.query('select public.read_state($1) as state',[workspace])).rows[0].state;
assert.equal(state.revision,4);assert.equal(state.payload.equipment[1].controls[0].id,'ctrl-1');

const tampered=structuredClone(controlled);tampered.controls[0].result='Mauvais état — à jeter';tampered.controls.push({id:'ctrl-2',reportId:'TARGET-002',date:'2026-10-22',intervenant:'Testeur',result:'Bon état',enteredById:admin});
await assert.rejects(()=>db.query('select public.write_equipment_record($1,$2,$3::jsonb)',[workspace,4,JSON.stringify(tampered)]),/Historique de contrôle immuable/);
await assert.rejects(()=>db.query('select public.write_equipment_record($1,$2,$3::jsonb)',[workspace,3,JSON.stringify(controlled)]),/REVISION_CONFLICT/);

// Les parcours mail utilisent aussi le détail ciblé et le formulaire garde la même sémantique.
const link=(await db.query('select public.create_equipment_loss_link($1,$2,$3,false) as value',[workspace,'gear-2','responsable@example.test'])).rows[0].value;
await db.exec('reset role;set role anon');
const ready=(await db.query('select public.read_equipment_loss_link($1) as value',[link.token])).rows[0].value;
assert.equal(ready.equipment.number,'TEST-2');
const signature={width:600,height:180,data:goodyearReportLogo.data};
const receipt=(await db.query('select public.submit_equipment_loss($1,$2,$3,$4::jsonb,true) as value',[link.token,'test_operator@goodyear.com','Recherche effectuée dans la zone de stockage sans retrouver le matériel.',JSON.stringify(signature)])).rows[0].value;
assert.equal(receipt.test,false);assert.equal(receipt.number,'TEST-2');
await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');
state=(await db.query('select public.read_state($1) as state',[workspace])).rows[0].state;
assert.equal(state.payload.equipment[1].archived,true);assert.equal(state.payload.equipment[1].archiveHistory[0].workflow,'loss-declaration');

await db.close();console.log('Écritures VGP ciblées : ajout, contrôle, immuabilité, CAS, lien et déclaration de perte OK.');
