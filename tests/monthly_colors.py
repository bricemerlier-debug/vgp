import json
from playwright.sync_api import sync_playwright,expect
source={'anticipation':30,'owners':[],'equipment':[]}
for i,(kind,date,control_date) in enumerate([('done','2026-10-15','2026-10-10'),('done-late','2026-10-01','2026-10-05'),('overdue','2026-10-01',None),('pending','2026-10-20',None),('excluded','2026-10-20',None)],1):
 e={'id':kind,'siteId':i,'identifier':'FICTIF-'+kind,'designation':'Matériel fictif '+kind,'category':'','assignment':'','location':'Atelier fictif','sector':'B2','zone':'DMCR','team':'A','owner':'','serialNumber':'','comments':'','months':12,'controls':[],'archived':False,'archiveHistory':[],'periodicityValidation':{'validated':True,'months':12,'reason':'Fixture','by':'Testeur'},'obligations':[{'id':kind+'|'+date,'date':date}]}
 if control_date:
  e['controls']=[{'id':'c-'+kind,'reportId':str(i),'date':control_date,'plannedDate':date,'intervenant':'Testeur fictif','result':'Bon état','observations':'Fixture','created':i}];e['obligations'][0].update(done=True,controlId='c-'+kind,controlDate=control_date)
 if kind=='excluded':e['obligations'][0].update(excludedAt='2026-10-10',excludedReason='Modification fictive d’échéance')
 source['equipment'].append(e)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000/prototype-vgp.html#kpi');page.locator('#monthlyCards .month-card').nth(9).get_by_role('button',name='Voir les échéances').click()
 for kind,color,label in [('done','rgb(234, 245, 239)','Fait — dans les délais'),('done-late','rgb(255, 245, 223)','Fait — en retard'),('overdue','rgb(255, 240, 239)','Non fait — en retard'),('pending','rgb(237, 243, 252)','À faire'),('excluded','rgb(238, 240, 241)','Exclu — non réalisé')]:
  row=page.locator('#monthlyRemainingList .monthly-'+kind+'-row');expect(row).to_have_count(1);expect(row.locator('.badge')).to_have_text(label);assert row.evaluate('e=>getComputedStyle(e).backgroundColor')==color
 expect(page.locator('.monthly-status-legend .badge')).to_have_count(5);assert json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))==source;assert page.evaluate('document.documentElement.scrollWidth')==390;assert not errors,errors;b.close()
print('PASS couleurs et libellés des cinq états mensuels, légende, données inchangées et mobile.')
