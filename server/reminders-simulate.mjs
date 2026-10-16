// Commande manuelle sans réseau, sans tâche planifiée, sans secret.
import {readFile} from 'node:fs/promises';
import {ReminderSqliteStore} from './reminder-store.mjs';
import {runReminderWorker,simulatedReminderTransport} from '../reminder-worker.mjs';
const [documentPath,queuePath,date]=process.argv.slice(2);
if(!documentPath||!queuePath||!date)throw Error('Usage : node server/reminders-simulate.mjs document-fictif.json file-simulation.sqlite 2026-10-16T07:00:00Z');
const store=new ReminderSqliteStore(queuePath);
try{const result=await runReminderWorker({store,readDocument:async()=>JSON.parse(await readFile(documentPath,'utf8')),workspaceId:'simulation-isolee',now:()=>new Date(date),transport:simulatedReminderTransport()});console.log(JSON.stringify({mode:'SIMULATION — aucun mail envoyé',jobs:result.jobs.map(j=>({identifier:j.identifier,stage:j.stage,status:j.status,attempts:j.attempts})),issues:result.issues},null,2));}finally{store.close();}
