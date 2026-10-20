"""Navigation locale avec données fictives et réseau externe bloqué."""
from pathlib import Path
from datetime import datetime,timezone
import json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
def gear(i,name,owner,sector):
 return {'id':str(i),'siteId':i,'identifier':'FICTIF-'+str(i),'designation':name,'serialNumber':'','sector':sector,'zone':'DMCR' if sector=='B2' else '', 'team':'A','owner':owner,'location':'Atelier fictif','category':'','assignment':'','comments':'Original conservé','months':12,'controls':[],'archived':False,'archiveHistory':[],'firstControlDate':'2026-10-20','dateValidation':{'validated':True,'source':'Fixture','reason':'Fixture','by':'Fictif'},'periodicityValidation':{'validated':True,'months':12,'reason':'Fixture','by':'Fictif'}}
source={'anticipation':30,'owners':['Alice fictive','Service fictif'],'ownerContacts':[{'owner':'Alice fictive','email':'alice@example.invalid'}],'controllerProfiles':[{'id':'ctrl','name':'Contrôleur fictif','email':'controleur@example.invalid','signature':None}],'equipment':[gear(1,'Anneau fictif','Alice fictive','B2'),gear(2,'Harnais fictif','Service fictif','A1')]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1440,'height':1000},timezone_id='Europe/Paris');external=[]
 def route(r):
  if r.request.url.startswith('http://127.0.0.1:8000/'):
   if r.request.url.endswith('cloud-config.js'):r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript')
   else:r.continue_()
  else:external.append(r.request.url);r.abort()
 c.route('**/*',route);c.add_init_script('if(!localStorage.getItem("vgp-prototype-v1"))localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,16,7,tzinfo=timezone.utc));page.goto('http://127.0.0.1:8000/#material')
 def tab(view):page.locator('[data-workspace-view='+view+']').click()
 def menu(view):page.evaluate("v=>{const d=document.querySelector('#navigation');if(!d.open)d.showModal();d.querySelector('[data-view='+CSS.escape(v)+']').click()}",view)
 expect(page.locator('#vgpWorkspace')).to_be_visible();expect(page.locator('#vgpMaterialTab')).to_have_attribute('aria-selected','true');expect(page.locator('#vgpControllersTab')).to_have_text('Contrôleurs');expect(page.locator('#vgpOwnersTab')).to_have_text('Propriétaires')
 page.locator('#search').fill('Anneau');page.locator('#sectorFilter').select_option('B2');page.locator('#filter').select_option('À faire');expect(page.locator('#list tbody tr')).to_have_count(1)
 tab('kpi');expect(page.locator('#kpiView')).to_be_visible();expect(page.locator('#navigation [data-nav-group=vgp]')).to_have_attribute('aria-current','page');assert page.locator('dialog[open]').count()==0
 page.locator('#monthlyYear').fill('2025');page.locator('#monthlyYear').dispatch_event('change');tab('planning');expect(page.locator('#weeklyCalendar')).to_be_visible();page.locator('#nextWeek').click();week=page.locator('#weekRange').inner_text();tab('material');expect(page.locator('#search')).to_have_value('Anneau');expect(page.locator('#sectorFilter')).to_have_value('B2');expect(page.locator('#filter')).to_have_value('À faire');expect(page.locator('#list tbody tr')).to_have_count(1)
 tab('kpi');expect(page.locator('#monthlyYear')).to_have_value('2025');tab('planning');expect(page.locator('#weekRange')).to_have_text(week)
 # Same Planning panel for VGP and 5x8, with an active accessible tab.
 page.locator('#planningView [data-view=shiftCalendar]').click();expect(page.locator('#shiftCalendarView')).to_be_visible();expect(page.locator('#planningView')).to_be_visible();expect(page.locator('#vgpPlanningTab')).to_have_attribute('aria-selected','true');tab('material')
 # Equipment retains a visible top navigation and an explicit list return.
 page.locator('#list [data-open="1"]').click();expect(page.locator('#detail')).to_be_visible();expect(page.locator('#vgpMaterialTab')).to_be_visible();page.locator('#backEquipment').click();expect(page.locator('#search')).to_have_value('Anneau');expect(page.locator('#list [data-open="1"]')).to_be_focused()
 # Arrow keys and Home/End move between the existing pages.
 page.locator('#vgpMaterialTab').focus();page.keyboard.press('ArrowRight');expect(page.locator('#vgpKpiTab')).to_be_focused();expect(page.locator('#kpiView')).to_be_visible();page.keyboard.press('End');expect(page.locator('#vgpOwnersTab')).to_be_focused();page.keyboard.press('Home');expect(page.locator('#vgpMaterialTab')).to_be_focused()
 page.screenshot(path='/tmp/vgp-grouped-material.png',full_page=True)
 tab('controllers');expect(page.locator('#vgpWorkspace')).to_be_visible();expect(page.locator('#controllersView')).to_be_visible();expect(page.locator('#vgpControllersTab')).to_have_attribute('aria-selected','true');page.locator('#controllerSearch').fill('Contrôleur');tab('owners');expect(page.locator('#ownersView')).to_be_visible();expect(page.locator('#vgpOwnersTab')).to_have_attribute('aria-selected','true');expect(page.locator('#navigation [data-nav-group=vgp]')).to_have_attribute('aria-current','page');page.locator('#ownerSearch').fill('Alice');expect(page.locator('#ownersList .owner-card')).to_have_count(1)
 tab('controllers');expect(page.locator('#controllerSearch')).to_have_value('Contrôleur');page.locator('#controllersList [data-controller-open=ctrl]').click();expect(page.locator('#controllerProfileTitle')).to_contain_text('Contrôleur fictif');tab('owners');expect(page.locator('#ownerSearch')).to_have_value('Alice');page.locator('#ownersList [data-owner-index]').click();expect(page.locator('#ownerProfileName')).to_have_text('Alice fictive');page.locator('#ownerProfile [data-open="1"]').click();expect(page.locator('#vgpOwnersTab')).to_be_visible();page.locator('#backEquipment').click();expect(page.locator('#ownerProfileName')).to_have_text('Alice fictive')
 page.screenshot(path='/tmp/vgp-grouped-personnel.png',full_page=True)
 # Existing action workspace keeps its two original tabs.
 menu('actionKpi');expect(page.locator('#plansTrackingTab')).to_be_visible();page.locator('#plansKpiTab').click();expect(page.locator('#plansKpiPanel')).to_be_visible();page.locator('#plansTrackingTab').click();expect(page.locator('#plansTrackingPanel')).to_be_visible()
 # Narrow viewport: three spaces accessible, inner tabs wrap without body overflow.
 page.set_viewport_size({'width':390,'height':844})
 for view in ['material','actionKpi','imports','administration','home']:
  menu(view);assert page.evaluate('document.documentElement.scrollWidth')==390,view
 menu('material');page.screenshot(path='/tmp/vgp-grouped-mobile.png',full_page=True);tab('planning');assert page.evaluate('document.documentElement.scrollWidth')==390;tab('controllers');tab('owners');assert page.evaluate('document.documentElement.scrollWidth')==390
 # Old deep links still select their workspace and the correct tab after reload.
 for view,group in [('material','vgp'),('kpi','vgp'),('planning','vgp'),('shiftCalendar','vgp'),('owners','vgp'),('controllers','vgp')]:
  page.goto('http://127.0.0.1:8000/#'+view);page.reload();expect(page.locator('#'+group+'Workspace')).to_be_visible();expect(page.locator('[data-workspace-view='+('planning' if view=='shiftCalendar' else view)+']')).to_have_attribute('aria-selected','true')
 assert json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))==source;assert not external,external;assert not errors,errors;b.close()
print('PASS : onglets Contrôleurs et Propriétaires au niveau de la navigation VGP, filtres conservés, KPI et agenda, clavier, 5x8, retour fiche, liens existants, mobile 390 px ; données inchangées, aucun réseau externe.')
