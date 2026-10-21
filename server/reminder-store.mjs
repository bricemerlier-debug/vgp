// Serveur / tests isolés uniquement. Le navigateur utilise IndexedDB.
import {DatabaseSync} from 'node:sqlite';
export class ReminderSqliteStore{
 constructor(path){this.db=new DatabaseSync(path);this.db.exec(`PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS reminder_simulation_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS reminder_simulation_jobs (job_key TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, equipment_id TEXT NOT NULL, cycle TEXT NOT NULL, recipient TEXT NOT NULL, stage INTEGER NOT NULL CHECK(stage IN (30,14,7,0) OR (stage<0 AND stage%7=0)), mode TEXT NOT NULL CHECK(mode='simulation'), status TEXT NOT NULL CHECK(status IN ('queued','processing','simulated','failed','uncertain','cancelled')), payload TEXT NOT NULL, UNIQUE(workspace_id,equipment_id,cycle,recipient,stage));
 CREATE TABLE IF NOT EXISTS reminder_simulation_events (job_key TEXT NOT NULL REFERENCES reminder_simulation_jobs(job_key), event_index INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(job_key,event_index));`);const schema=this.db.prepare("SELECT sql FROM sqlite_master WHERE name='reminder_simulation_jobs'").get().sql;
 if(!schema.includes('stage<0'))this.db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE reminder_simulation_jobs_upgrade ${schema.slice(schema.indexOf('(')).replace('CHECK(stage IN (30,14,7,0))','CHECK(stage IN (30,14,7,0) OR (stage<0 AND stage%7=0))')};
 INSERT INTO reminder_simulation_jobs_upgrade SELECT * FROM reminder_simulation_jobs;
 DROP TABLE reminder_simulation_jobs;
 ALTER TABLE reminder_simulation_jobs_upgrade RENAME TO reminder_simulation_jobs;
 COMMIT;`);
 this.db.prepare('INSERT OR IGNORE INTO reminder_simulation_state VALUES (1,?)').run(JSON.stringify({jobs:[],issues:[]}));}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const state=JSON.parse(this.db.prepare('SELECT payload FROM reminder_simulation_state WHERE id=1').get().payload);const result=fn(state);if(result?.then)throw Error('La transaction doit être synchrone.');
 // Index unique en base en plus de la réservation atomique. Le journal n'est jamais écrasé.
 const put=this.db.prepare('INSERT INTO reminder_simulation_jobs VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(job_key) DO UPDATE SET status=excluded.status,payload=excluded.payload');
 const log=this.db.prepare('INSERT OR IGNORE INTO reminder_simulation_events VALUES (?,?,?)');
 for(const job of state.jobs){put.run(job.key,job.workspace_id,job.equipment_id,job.cycle,job.recipient.toLowerCase(),job.stage,job.mode,job.status,JSON.stringify(job));job.history.forEach((event,i)=>log.run(job.key,i,JSON.stringify(event)));}
 this.db.prepare('UPDATE reminder_simulation_state SET payload=? WHERE id=1').run(JSON.stringify(state));this.db.exec('COMMIT');return Promise.resolve(result);}catch(error){this.db.exec('ROLLBACK');return Promise.reject(error);}}
 close(){this.db.close();}
}
