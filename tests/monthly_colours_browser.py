"""Seuils mensuels sur données fictives, aucun accès de production."""
from pathlib import Path
exec((Path(__file__).with_name('workspace_paths_browser.py')).read_text().split('with sync_playwright() as p:')[0])
source['equipment']=[]
for month,done in [(1,0),(2,2),(3,3),(4,4)]:
 for n in range(4):
  ident=month*10+n;e=gear(ident,f'TEST-{ident}');date=f'2026-{month:02d}-15';e['firstControlDate']=date
  if n<done:e['controls']=[{'id':f'c{ident}','reportId':f'R{ident}','date':date,'plannedDate':date,'intervenant':'Testeur fictif','result':'Bon état','observations':'Fixture','created':ident}]
  source['equipment'].append(e)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/#kpi','/prototype-vgp.html#kpi']:
  page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,16,10,tzinfo=timezone.utc));page.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000'+path)
  cards=page.locator('#monthlyCards .month-card')
  for i,value,colour in [(0,'0 %','month-low'),(1,'50 %','month-low'),(2,'75 %','month-warning'),(3,'100 %','month-complete'),(4,'Non applicable','month-complete')]:
   expect(cards.nth(i).locator('strong')).to_have_text(value);expect(cards.nth(i)).to_have_class('month-card '+colour)
  expect(cards.nth(4).get_by_role('button')).to_be_disabled();assert page.evaluate('document.documentElement.scrollWidth')==390;assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==source;assert not errors,errors;page.close()
 b.close()
print('PASS couleurs mensuelles : rouge 0/50 %, jaune 75 %, vert 100 % et non applicable ; module/autonome, mobile, aucune écriture.')
