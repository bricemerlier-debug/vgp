from playwright.sync_api import sync_playwright,expect
from datetime import datetime,timezone
import json

def gear(n,date=None,controls=None,archived=False):
 return {'id':str(n),'siteId':n,'identifier':'EQ-'+str(n),'designation':'Anneau '+str(n),'serialNumber':'','sector':'B2','zone':'DMCR','team':'A','owner':'','location':'Usine','category':'','assignment':'','months':12,'periodicityValidation':{'validated':True,'months':12,'reason':'Règle fictive','by':'Testeur'},'dateValidation':{'validated':True,'source':'Document fictif','reason':'Échéance fictive explicite','by':'Testeur'},'firstControlDate':date,'controls':controls or [],'archived':archived,'archiveHistory':[]}
controls=lambda n:[{'id':'c'+str(n),'date':'2026-06-01','plannedDate':'2026-06-01','intervenant':'Testeur','result':'Bon état','observations':'','created':n,'attachment':None}]
source={'anticipation':30,'owners':[],'equipment':[gear(n,controls=controls(n)) for n in (1,2,3)]+[gear(4,'2026-06-20'),gear(5,'2026-07-01'),gear(6)]}
state={'revision':1,'payload':source};fail=False;reads=0
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001'};document.documentElement.classList.add('cloud-locked');"
def api(route):
 global reads
 headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST'}
 if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 if '/token?' in route.request.url:result={'access_token':'test','refresh_token':'test','expires_in':3600}
 elif route.request.url.endswith('read_shift_calendar'):result={'revision':0,'rows':[],'imports':[]}
 elif route.request.url.endswith('read_state'):
  reads+=1
  if fail:route.fulfill(status=503,json={'message':'Serveur indisponible'},headers=headers);return
  result=state
 else:raise AssertionError(route.request.url)
 route.fulfill(json=result,headers=headers)

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=b.new_context(viewport={'width':1440,'height':1100});context.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));context.route('https://test.supabase.co/**',api)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,6,25,12,tzinfo=timezone.utc));page.goto('http://127.0.0.1:8000/');page.locator('#loginForm [name=email]').fill('test@example.fr');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();expect(page.locator('#homeView')).to_be_visible();expect(page.locator('.home-ring strong')).to_have_text('75 %');expect(page.locator('#materialView')).not_to_be_visible();expect(page.locator('#homeOverview')).to_contain_text('3 contrôles réalisés sur 4 échéances');expect(page.locator('#homePriorities')).to_contain_text('Anneau 4')
 page.locator('#homeRemaining').click();expect(page.locator('#monthlyRemainingList')).to_contain_text('EQ-4');page.locator('[data-close=monthlyRemainingDialog]').click()
 page.locator('#homePriorities [data-home-control="4"]').click();expect(page.locator('#control')).to_be_visible();page.locator('#control [name=observations]').fill('Brouillon à conserver');before=reads;state['payload']['equipment'][3]['controls']=[{'id':'c4','date':'2026-06-25','plannedDate':'2026-06-20','intervenant':'Testeur','result':'Bon état','observations':'Contrôle réalisé sur un autre appareil','created':4,'attachment':None}];state['revision']=2;page.clock.fast_forward(21000);expect(page.locator('#control [name=observations]')).to_have_value('Brouillon à conserver');assert reads==before
 page.locator('#control [data-close]').click();page.locator('#detail [data-close]').click();page.clock.fast_forward(21000);expect(page.locator('.home-ring strong')).to_have_text('100 %');expect(page.locator('[data-home-list=overdue] strong')).to_have_text('0');assert reads>before
 page.locator('#homeMaterial').click();expect(page.locator('#materialView')).to_be_visible();expect(page.locator('#list')).to_contain_text('ID : 4');assert 'ID VGP' not in page.locator('#list').inner_text();page.locator('#homeLogo').click();expect(page.locator('#homeView')).to_be_visible()
 # Calendrier : choisir la semaine prochaine et ouvrir directement l'équipement.
 page.locator('#homeNextWeek').click();page.locator('#homeWeeklyCalendar [data-calendar-equipment="5"]').click();expect(page.locator('#detailTitle')).to_contain_text('EQ-5');page.locator('#detail [data-close]').click()
 fail=True;page.locator('#homeSync').click();expect(page.locator('#homeSyncStatus')).to_contain_text('Actualisation interrompue');expect(page.locator('.home-ring strong')).to_have_text('100 %');fail=False
 # Ne pas remplacer une saisie de modèle de mail ouverte hors d'un dialogue.
 page.locator('#homeKpi').click();page.locator('#settingsToggle').click();page.locator('#settingsMenu [data-view=mailSettings]').click();page.locator('#mailSubject').fill('Modèle non enregistré');before=reads;page.clock.fast_forward(21000);expect(page.locator('#mailSubject')).to_have_value('Modèle non enregistré');assert reads==before
 page.locator('#homeLogo').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth')==390;expect(page.locator('#homeLogo')).to_be_visible();page.reload();expect(page.locator('#homeView')).to_be_visible();assert not errors,errors;b.close()
print('PASS : accueil 75 % puis 100 %, listes et contrôle directs, ID, logo, agenda, synchronisation automatique, brouillons préservés, panne signalée et mobile.')
