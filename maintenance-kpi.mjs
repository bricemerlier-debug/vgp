export function maintenanceKpi({actions=[],entries=[]},year,today){
 const start=`${year}-01-01`,end=`${year}-12-31`,cutoff=end<today?end:today;
 const day=value=>new Date(value).toLocaleDateString('sv-SE',{timeZone:'Europe/Paris'});
 const byEntry=new Map(entries.map(e=>[e.id,e]));
 const createdDate=a=>a.created_at?new Date(a.created_at).toLocaleDateString('sv-SE',{timeZone:'Europe/Paris'}):(a.action_date||'');
 const finishedDate=a=>a.status==='done'?byEntry.get(a.completed_entry_id)?.date||null:null;
 // Les reports restent dans le même dénominateur ; le reliquat est repris l’année suivante.
 const historicalDue=a=>{let due=a.initial_due_date||a.deferrals?.[0]?.previous_due_date||a.due_date;if(a.annual_cap_previous_due_date&&due)due=due<createdDate(a).slice(0,4)+'-12-31'?due:createdDate(a).slice(0,4)+'-12-31';for(const d of a.deferrals||[])if(day(d.at)<=cutoff)due=d.new_due_date;return due;};
 const cohort=actions.map(a=>({...a,due_date:historicalDue(a)})).filter(a=>createdDate(a)<=end&&(createdDate(a)>=start||!finishedDate(a)||finishedDate(a)>=start));
 const done=a=>!!finishedDate(a)&&finishedDate(a)<=cutoff;
 const rate=rows=>({total:rows.length,done:rows.filter(done).length,percent:rows.length?Math.floor(rows.filter(done).length/rows.length*100):null});
 const graded=cohort.filter(a=>[1,2,3].includes(Number(a.level))),outstanding=cohort.filter(a=>!done(a));
 const annualEntries=[...new Map(entries.filter(e=>e.date>=start&&e.date<=cutoff).map(e=>[e.id,e])).values()];
 return {year,cutoff,cohort,graded,global:rate(graded),levels:[1,2,3].map(level=>({level,...rate(graded.filter(a=>Number(a.level)===level))})),outstanding,unclassified:cohort.filter(a=>![1,2,3].includes(Number(a.level))).length,overdue:outstanding.filter(a=>a.due_date&&a.due_date<cutoff),carried:cohort.filter(a=>createdDate(a)<start),deferred:cohort.filter(a=>(a.deferrals||[]).some(d=>day(d.at)<=cutoff)),crossYear:outstanding.filter(a=>(a.due_date||'')>end),annualEntries,months:Array.from({length:12},(_,i)=>({month:i+1,total:annualEntries.filter(e=>Number(e.date.slice(5,7))===i+1).length})),pendingJustification:outstanding.filter(a=>createdDate(a)<start&&!(a.deferrals||[]).some(d=>day(d.at)<=cutoff&&String(d.new_due_date)>=start))};
}
