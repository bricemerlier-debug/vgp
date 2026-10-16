"""Indicateurs d’en-tête : calculs existants et affichage responsive, données locales."""
from pathlib import Path
exec((Path(__file__).with_name('workspace_paths_browser.py')).read_text().split('with sync_playwright() as p:')[0])
source['equipment']=[gear(1,'JAN-DONE'),gear(2,'JAN-LATE'),gear(3,'MARCH')]
for e,date in zip(source['equipment'],['2027-01-30','2027-01-30','2027-03-15']):e['firstControlDate']=date
source['equipment'][0]['controls']=[{'id':'done','reportId':'1','date':'2027-01-10','plannedDate':'2027-01-30','intervenant':'Testeur fictif','result':'Bon état','observations':'Fixture','created':1}]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/#home','/prototype-vgp.html#home']:
  for width in [1920,1200,390,320]:
   page=b.new_page(viewport={'width':width,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2027,1,31,12,tzinfo=timezone.utc));page.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000'+path);expect(page.locator('#headerMonthPercent')).to_have_text('50 %');expect(page.locator('#headerTotalPercent')).to_have_text('67 %');expect(page.locator('#headerWeekPercent')).to_have_text('50 %');
   for metric_id in ['headerMonthMetric','headerWeekMetric','headerTotalMetric']:expect(page.locator('#'+metric_id)).to_have_class('header-metric header-metric-low')
   expect(page.locator('#headerMonthMetric')).to_have_attribute('title','Réalisation de janvier 2027 : 1 / 2 échéances traitées');page.locator('#homeNextMonth').click();expect(page.locator('#homeOverview .eyebrow')).to_contain_text('FÉVRIER');expect(page.locator('#headerMonthPercent')).to_have_text('50 %');assert page.evaluate('document.documentElement.scrollWidth')==width
   metric=page.locator('#headerProgress').bounding_box();icons=page.locator('#notificationToggle').bounding_box();assert metric['x']+metric['width']<=icons['x'] or metric['y']+metric['height']<=icons['y'];assert metric['x']>=0
   if width<=700:
    page.locator('#menuToggle').focus();menu=page.locator('#menuToggle').bounding_box();assert menu['x']+menu['width']<=metric['x'] or metric['y']+metric['height']<=menu['y']
   assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==source;assert not errors,errors
   if width==1920:
    changed=json.loads(json.dumps(source))
    for n in [4,5]:
     item=gear(n,'DONE-'+str(n));item['firstControlDate']='2027-01-30';item['controls']=[{'id':'done'+str(n),'reportId':str(n),'date':'2027-01-29','plannedDate':'2027-01-30','intervenant':'Testeur fictif','result':'Bon état','observations':'Fixture','created':n}];changed['equipment'].append(item)
    def sync(d):page.evaluate('(d)=>{localStorage.setItem("vgp-prototype-v1",JSON.stringify(d));window.dispatchEvent(new StorageEvent("storage",{key:"vgp-prototype-v1"}));}',d)
    sync(changed);expect(page.locator('#headerWeekPercent')).to_have_text('75 %');expect(page.locator('#headerMonthPercent')).to_have_text('75 %');expect(page.locator('#headerTotalPercent')).to_have_text('80 %')
    for metric_id in ['headerMonthMetric','headerWeekMetric','headerTotalMetric']:expect(page.locator('#'+metric_id)).to_have_class('header-metric header-metric-warning')
    changed['equipment'][1]['controls']=[{'id':'done2','reportId':'2','date':'2027-01-30','plannedDate':'2027-01-30','intervenant':'Testeur fictif','result':'Bon état','observations':'Fixture','created':2}];sync(changed)
    for prefix in ['Month','Week','Total']:expect(page.locator('#header'+prefix+'Percent')).to_have_text('100 %');expect(page.locator('#header'+prefix+'Metric')).to_have_class('header-metric header-metric-complete')
    changed['equipment']=[];sync(changed)
    for prefix in ['Month','Week','Total']:expect(page.locator('#header'+prefix+'Percent')).to_have_text('—');expect(page.locator('#header'+prefix+'Metric')).to_have_class('header-metric header-metric-complete')
   page.close()
 b.close()
print('PASS en-tête : semaine/mois/total, seuils rouge/jaune/vert et période vide, indépendance du mois consulté, 1920/1200/390/320 px sans chevauchement, module/autonome, aucune écriture en production.')
