import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {approved} from './fixtures.mjs';
import {reminderDates,reminderCivilDate} from '../reminder-dates.mjs';
import {reminders} from '../domain.mjs';
import {createReminderContact,assignReminderContact,reminderOwnershipStamp} from '../reminder-contacts.mjs';
import {reminderPlan} from '../reminder-plan.mjs';
import {runReminderWorker,simulatedReminderTransport,reconcileReminderQueue} from '../reminder-worker.mjs';
import {ReminderSqliteStore} from '../server/reminder-store.mjs';
import {microsoft365Message,microsoft365Transport} from '../server/microsoft365-contract.mjs';
function fixture(deadline='2026-10-31'){
 const d={equipment:[approved({id:'e',identifier:'FF-TEST',designation:'Harnais de Paul (nom historique)',owner:'Service réel confirmé',months:12,controls:[],firstControlDate:deadline})],reminderContacts:[createReminderContact({id:'c1',name:'Métrologie',type:'service',verification:'confirmed',email:'test@example.invalid'})],reminderAssignments:[],mailTemplates:['month','twoWeeks','week','deadline'].map(kind=>({kind,subject:'VGP {{numero_interne}}',body:'Bonjour {{nom_proprietaire}}. Retour au service Métrologie le {{date_controle}}.'}))};assignReminderContact(d,{equipmentId:'e',contactId:'c1',role:'primary',status:'confirmed'});return d;
}
async function isolated(fn){const dir=mkdtempSync(join(tmpdir(),'vgp-reminders-')),path=join(dir,'simulation.sqlite'),store=new ReminderSqliteStore(path);try{await fn(store,path);}finally{store.close();rmSync(dir,{recursive:true,force:true});}}
const state=store=>store.transaction(s=>structuredClone(s));
const run=(store,d,date='2026-10-01T05:00:00Z',transport=simulatedReminderTransport(),extras={})=>runReminderWorker({store,readDocument:async()=>structuredClone(d),workspaceId:'w',now:()=>new Date(date),transport,...extras});
test('J-30 exact partagé aperçu/plan : fins de mois, année bissextile, année suivante, J0 et DST Paris',()=>{
 for(const deadline of ['2024-03-31','2026-12-31','2027-01-01','2026-03-29','2026-10-25']){const d=fixture(deadline),dates=reminderDates(deadline);assert.deepEqual(reminders(d.equipment[0]).map(r=>r.date),dates.map(r=>r.date));assert.deepEqual(reminderPlan(d,'w').jobs.map(j=>j.run_on),dates.map(r=>r.date));assert.equal((Date.parse(deadline)-Date.parse(dates[0].date))/86400000,30);assert.equal(dates[3].date,deadline);}
 assert.equal(reminderCivilDate('2026-03-28T23:30:00Z'),'2026-03-29');assert.equal(reminderCivilDate('2026-10-24T22:30:00Z'),'2026-10-25');assert.equal(reminderCivilDate('2026-10-25T23:30:00Z'),'2026-10-26');assert.throws(()=>reminderDates('2026-02-30'));
});
test('contacts explicites, plusieurs détenteurs, escalade J0, adresses manquantes et doublons non fusionnés',()=>{
 const d=fixture();d.reminderContacts.push(createReminderContact({id:'c2',name:'Second détenteur',type:'person',email:'second@example.invalid',verification:'confirmed'}));assignReminderContact(d,{equipmentId:'e',contactId:'c2',role:'holder',status:'confirmed'});assert.equal(reminderPlan(d,'w').jobs.length,8);
 d.reminderContacts.push(createReminderContact({id:'c3',name:'Escalade',type:'company',email:'escalade@example.invalid',verification:'confirmed'}));assignReminderContact(d,{equipmentId:'e',contactId:'c3',role:'escalation',status:'confirmed'});assert.equal(reminderPlan(d,'w').jobs.filter(j=>j.contact_id==='c3').length,1);
 d.reminderContacts[1].email='';assert.match(reminderPlan(d,'w').issues.map(i=>i.reason).join(),/Adresse/);assert.equal(reminderPlan(d,'w').jobs.length,5);
 d.reminderContacts[1].email=d.reminderContacts[0].email;assert.equal(d.reminderContacts.length,3);assert.match(reminderPlan(d,'w').issues.map(i=>i.reason).join(),/commune/);
 d.reminderAssignments=[];assert.equal(reminderPlan(d,'w').jobs.length,0);assert.equal(reminderPlan(d,'w').issues[0].equipmentId,'e');assert.ok(!JSON.stringify(reminderPlan(d,'w')).includes('Paul'));
 const empty=fixture();empty.reminderContacts[0].email='';assert.equal(reminderPlan(empty,'w').jobs.length,0);assert.match(reminderPlan(empty,'w').issues[0].reason,/Adresse/);
});
test('double exécution concurrente, persistance après réouverture, jamais envoyé',async()=>isolated(async(store,path)=>{
 const d=fixture();let calls=0;const transport={mode:'simulation',async send({message}){calls++;assert.match(message.text,/Métrologie/);assert.match(message.text,/SIMULATION/);}};
 const second=new ReminderSqliteStore(path);try{await Promise.all([run(store,d,undefined,transport),run(second,d,undefined,transport)]);}finally{second.close();}await run(store,d,undefined,transport);assert.equal(calls,1);const reopened=new ReminderSqliteStore(path);try{const s=await state(reopened);assert.equal(s.jobs.length,4);assert.equal(s.jobs.filter(j=>j.status==='simulated').length,1);assert.ok(s.jobs.every(j=>j.status!=='sent'));}finally{reopened.close();}
}));
test('réseau simulé : reprises bornées, attente croissante, succès sans double',async()=>isolated(async(store)=>{
 const d=fixture();for(const date of ['2026-10-01T05:00:00Z','2026-10-01T05:01:00Z','2026-10-01T05:03:00Z','2026-10-01T05:10:00Z'])await run(store,d,date,simulatedReminderTransport('network'));
 const j=(await state(store)).jobs[0];assert.equal(j.attempts,3);assert.equal(j.status,'failed');assert.equal(j.history.filter(h=>h.status==='failed').length,3);
}));
test('timeout fournisseur : résultat incertain, pas de relance automatique',async()=>isolated(async(store)=>{
 const d=fixture();let calls=0;const transport={mode:'simulation',send(){calls++;return new Promise(()=>{});}};await run(store,d,undefined,transport,{timeoutMs:5});await run(store,d,'2026-10-01T06:00:00Z');assert.equal(calls,1);assert.equal((await state(store)).jobs[0].status,'uncertain');
}));
test('contrôle après mise en file ET entre réservation et transport : annulation sans message',async()=>isolated(async(store)=>{
 const d=fixture();await store.transaction(s=>reconcileReminderQueue(s,d,'w','2026-09-30T12:00:00Z'));let reads=0,calls=0;
 await run(store,d,undefined,{mode:'simulation',async send(){calls++;}},{readDocument:async()=>{reads++;if(reads===3)d.equipment[0].controls.push({id:'new',date:'2026-10-01',plannedDate:'2026-10-31',result:'Bon état',intervenant:'Testeur fictif',created:1});return structuredClone(d);}});
 assert.equal(calls,0);assert.equal((await state(store)).jobs.find(j=>j.due_on==='2026-10-31'&&j.stage===30).status,'cancelled');
}));
test('réaffectation du propriétaire ou du contact annule les anciennes étapes ; nouveau détenteur explicite',async()=>isolated(async(store)=>{
 const d=fixture();await store.transaction(s=>reconcileReminderQueue(s,d,'w','2026-09-30T12:00:00Z'));d.equipment[0].owner='Autre service';await run(store,d);assert.ok((await state(store)).jobs.every(j=>j.status==='cancelled'));assert.match((await state(store)).issues.map(i=>i.reason).join(),/réaffectation/);
 d.reminderContacts.push(createReminderContact({id:'new',name:'Autre service',type:'service',email:'autre@example.invalid',verification:'confirmed'}));d.reminderAssignments=[];assignReminderContact(d,{equipmentId:'e',contactId:'new',role:'primary',status:'confirmed'});await run(store,d);assert.equal((await state(store)).jobs.filter(j=>j.status==='simulated').length,1);
}));
test('changement d’adresse, archivage, étape passée et J0',async()=>isolated(async(store)=>{
 const d=fixture();await store.transaction(s=>reconcileReminderQueue(s,d,'w','2026-09-30T12:00:00Z'));d.reminderContacts[0].email='nouveau@example.invalid';await run(store,d);assert.ok((await state(store)).jobs.filter(j=>j.recipient==='test@example.invalid').every(j=>j.status==='cancelled'));assert.equal((await state(store)).jobs.filter(j=>j.recipient==='nouveau@example.invalid'&&j.status==='simulated').length,1);
 const j0=fixture('2027-01-01');await run(store,j0,'2026-12-31T23:15:00Z');assert.equal((await state(store)).jobs.filter(j=>j.status==='simulated'&&j.stage===0).length,1);assert.ok((await state(store)).jobs.filter(j=>j.cycle===reminderPlan(j0,'w').jobs[0].cycle&&j.stage!==0).every(j=>j.status==='cancelled'));
 j0.equipment[0].archived=true;await run(store,j0,'2027-01-01T09:00:00Z');assert.equal((await state(store)).jobs.filter(j=>j.due_on==='2027-01-01'&&j.status==='simulated').length,1);
}));
test('aucun branchement réel possible, payload Microsoft 365 préparé sans réseau',async()=>isolated(async(store)=>{
 await assert.rejects(run(store,fixture(),undefined,{mode:'live',send(){throw Error('ne doit pas être appelé');}}),/désactivé/);assert.throws(microsoft365Transport,/non activable/);assert.equal(microsoft365Message({recipient:'test@example.invalid',subject:'test',text:'simulation',correlationId:'unique'}).saveToSentItems,true);
}));

test('retard : J+7 puis J+14 sans doublon, pas de rattrapage, arrêt à l’archivage',async()=>isolated(async store=>{
 const d=fixture('2026-10-01');d.mailTemplates.push({kind:'overdue',subject:'Retard {{numero_interne}}',body:'Échéance dépassée le {{date_controle}}.'});
 let calls=0;const transport={mode:'simulation',async send({message}){calls++;assert.match(message.subject,/Retard/);}};
 await run(store,d,'2026-10-08T07:00:00Z',transport);
 await run(store,d,'2026-10-08T08:00:00Z',transport);assert.equal(calls,1);
 await run(store,d,'2026-10-09T07:00:00Z',transport);assert.equal(calls,1);
 await run(store,d,'2026-10-15T07:00:00Z',transport);assert.equal(calls,2);
 d.equipment[0].archived=true;
 await run(store,d,'2026-10-22T07:00:00Z',transport);assert.equal(calls,2);
}));
