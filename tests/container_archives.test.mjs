import assert from 'node:assert/strict';
import {containerArchiveInfo,containerPreventiveStatus,containerStatusCounts,containerAnnualActivity} from '../containers.mjs';
const item=(comment,date='2026-02-01')=>({number:'I1',date,type:'préventif',comment});
const container=comment=>({number:'CE1',subtype:'R2 - VERTE',interventions:[item(comment)]});
for(const comment of ['mise au rebut','mise au rebus','mis au rebut','destruction','mise en benne -> châssis cassé']){
 assert.ok(containerArchiveInfo(container(comment)),comment);
 assert.equal(containerPreventiveStatus(container(comment),'2026-10-19').status,'archived');
}
for(const comment of ['pas de mise au rebut','non mise en benne','pour destruction','mise au rebut à prévoir','contrôle préventif réalisé']){
 assert.equal(containerArchiveInfo(container(comment)),null,comment);
}
const after={number:'CE9',subtype:'PC',interventions:[item('mise en benne','2025-01-01'),item('réparé','2026-01-01')]};
assert.equal(containerArchiveInfo(after).laterInterventions,1);
const archived=container('mise en benne');
const active={number:'CE2',subtype:'R2 - VERTE',interventions:[item('bon état')]};
assert.deepEqual(containerStatusCounts([archived,active],'2026-10-19'),{current:1,overdue:0,unknown:0,exempt:0});
assert.equal(containerAnnualActivity([archived],2026)[1].actions.length,1);
assert.equal(containerAnnualActivity([archived],2027)[1].due,0);
console.log('Archivage et exclusion des échéances futures validés.');
