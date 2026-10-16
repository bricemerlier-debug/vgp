"""Données fictives, réseau bloqué ; aucune écriture Supabase ou messagerie."""
from playwright.sync_api import sync_playwright,expect
from datetime import datetime,timezone
from pathlib import Path
import json,subprocess
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'artifacts/local-review';ART.mkdir(parents=True,exist_ok=True)
types=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {initialEquipmentTypes} from './nomenclature.mjs';console.log(JSON.stringify(initialEquipmentTypes()))"],cwd=ROOT,text=True))
def gear(n,identifier,sector='B2',archive=False):
 return {'id':str(n),'siteId':n,'identifier':identifier,'designation':'Anneau de retournement ancien '+identifier,'typeId':'anneau-retournement','variantId':'anneau-m16','standardName':'Anneau de retournement · M16','serialNumber':'','sector':sector,'zone':'DMCR' if sector=='B2' else '', 'team':'A','owner':'','location':'Atelier fictif','category':'','assignment':'','comments':'Historique conservé','months':12,'firstControlDate':'2026-10-31','periodicityValidation':{'validated':True,'months':12,'reason':'Fictif','by':'Testeur'},'dateValidation':{'validated':True,'source':'Fictif','reason':'Fictif','by':'Testeur'},'controls':[],'archived':archive,'archiveHistory':[{'id':'archive-'+str(n),'type':'archive','workflow':'memoryflow-archive','reason':'Mis au rebut','date':'2026-09-01','requester':'Testeur','observations':'Archive fictive','sourceArchiveConfirmed':True,'sourceDateUnknown':True,'sourceIds':['88']}] if archive else []}
source={'anticipation':30,'owners':[],'equipmentTypes':types,'equipment':[gear(1,'ACTIF-16'),gear(2,'ARCHIVE-16',archive=True),gear(3,'ACTIF-A1','A1')]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1440,'height':1050},timezone_id='Europe/Paris');blocked=[];errors=[]
 def network(route):
  if route.request.url.startswith('http://127.0.0.1:8000/'):
   if route.request.url.endswith('cloud-config.js'):route.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript')
   else:route.continue_()
  else:blocked.append(route.request.url);route.abort()
 context.route('**/*',network);context.add_init_script('if(!localStorage.getItem("vgp-prototype-v1"))localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');')
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,1,5,tzinfo=timezone.utc));page.goto('http://127.0.0.1:8000/#material');expect(page.locator('#materialView')).to_be_visible()
 def nav(view):
  if view in ['kpi','planning']:
   if not page.locator('#vgpWorkspace').is_visible():
    page.locator('#menuToggle').click();page.locator('#navigation [data-view=material]').click()
   page.locator('#vgpWorkspace [data-workspace-view='+view+']').click()
  else:
   page.locator('#menuToggle').click();page.locator('#navigation [data-view='+view+']').click()
 assert page.locator('#materialView #weeklyCalendar').count()==0
 assert page.locator('#search').bounding_box()['y']<page.locator('#stats').bounding_box()['y']
 page.locator('#search').fill('ACTIF');page.locator('#filter').select_option('À faire');page.locator('#sectorFilter').select_option('B2');page.locator('#typeFilter').select_option('anneau-retournement');page.locator('#variantFilter').select_option('anneau-m16');expect(page.locator('#list tbody tr')).to_have_count(1);expect(page.locator('#list')).to_contain_text('ACTIF-16');expect(page.locator('#activeFilters')).to_contain_text('Recherche : ACTIF');expect(page.locator('#activeFilters')).to_contain_text('Type : Anneau')
 # Count click changes only explicit status/scope; all other context survives.
 page.locator('#stats [data-status-filter="À faire"]').click();expect(page.locator('#search')).to_have_value('ACTIF');expect(page.locator('#sectorFilter')).to_have_value('B2');expect(page.locator('#typeFilter')).to_have_value('anneau-retournement');expect(page.locator('#list tbody tr')).to_have_count(1)
 page.screenshot(path=str(ART/'materiel-desktop.png'),full_page=True)
 page.locator('#list [data-open="1"]').click();expect(page.locator('#detail')).to_be_visible();expect(page.locator('#detailTitle')).to_be_focused();page.locator('#backEquipment').click();expect(page.locator('#search')).to_have_value('ACTIF');expect(page.locator('#filter')).to_have_value('À faire');expect(page.locator('#list [data-open="1"]')).to_be_focused()
 nav('planning');expect(page.locator('#weeklyCalendar')).to_be_visible();nav('material');expect(page.locator('#search')).to_have_value('ACTIF');expect(page.locator('#list tbody tr')).to_have_count(1)
 page.locator('#search').fill('ARCHIVE');expect(page.locator('#searchArchives')).to_be_visible();page.locator('#searchArchives').click();expect(page.locator('#list tbody tr')).to_have_count(1);expect(page.locator('#list')).to_contain_text('ARCHIVE-16');expect(page.locator('#search')).to_have_value('ARCHIVE');expect(page.locator('#filter')).to_have_value('');expect(page.locator('#activeFilters')).to_contain_text('Archives')
 page.locator('#list [data-open="2"]').click();expect(page.locator('#detailContent')).to_contain_text('Mis au rebut');page.locator('#backEquipment').click();expect(page.locator('#archivedEquipmentTab')).to_have_attribute('aria-pressed','true');expect(page.locator('#search')).to_have_value('ARCHIVE')
 nav('administration');page.locator('#openNamingWorkspace').click();expect(page.locator('#namingView')).to_be_visible();assert page.locator('dialog[open]').count()==0
 page.locator('#namingProposalsTab').focus();page.keyboard.press('ArrowRight');expect(page.locator('#namingCatalogueTab')).to_be_focused();expect(page.locator('#namingCataloguePanel')).to_be_visible();page.keyboard.press('End');expect(page.locator('#namingMatchesTab')).to_be_focused();expect(page.locator('#namingRuleForm')).to_be_visible();page.keyboard.press('Home');expect(page.locator('#namingProposalsTab')).to_be_focused()
 # Les raccourcis des référentiels restent disponibles sur chaque page enfant.
 expect(page.locator('#referenceNavigation')).to_be_visible();page.locator('#referenceNavigation [data-reference-view=mailSettings]').click();expect(page.locator('#mailSettingsView')).to_be_visible();expect(page.locator('#referenceNavigation [data-reference-view=mailSettings]')).to_have_attribute('aria-current','page');page.locator('#referenceNavigation [data-reference-view=controllers]').click();expect(page.locator('#controllersView')).to_be_visible();page.locator('#referenceNavigation [data-reference-view=owners]').click();expect(page.locator('#ownersView')).to_be_visible();page.locator('#referenceNavigation [data-reference-view=administration]').click();expect(page.locator('#administrationView')).to_be_visible();expect(page.locator('#administrationTitle')).to_be_focused();expect(page.locator('#referenceNavigation')).not_to_be_visible();page.locator('#openNamingWorkspace').click();expect(page.locator('#referenceNavigation')).to_be_visible();expect(page.locator('#namingView')).to_be_visible();assert page.locator('dialog[open]').count()==0
 page.screenshot(path=str(ART/'standardisation-desktop.png'),full_page=True)
 nav('imports');expect(page.locator('#apaveImportSettings')).to_be_visible();expect(page.locator('[data-import-apave-actions]')).to_be_visible();assert page.locator('#importsView #legacyImportTools').count()==0
 page.locator('#apaveImportSettings').click();expect(page.locator('#apaveDialog')).to_be_visible();assert page.locator('dialog[open]').count()==1;page.keyboard.press('Escape');expect(page.locator('#apaveImportSettings')).to_be_focused()
 nav('material');page.locator('#resetFilters').click();page.locator('#activeEquipmentTab').click();page.locator('#search').fill('ACTIF-16');page.locator('#list [data-open="1"]').click();page.locator('#declareLost').click();expect(page.locator('#controlForm h2')).to_have_text('Déclarer introuvable');expect(page.locator('#controlForm > button:not([type])')).to_have_text('Déclarer introuvable');page.keyboard.press('Escape');expect(page.locator('#declareLost')).to_be_focused();page.locator('#backEquipment').click()
 # All navigation above leaves the underlying business document unchanged.
 assert json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))==source
 nav('administration');page.locator('[data-view=mailSettings]').filter(visible=True).click();expect(page.locator('#reminderSimulation')).to_be_visible();expect(page.locator('#reminderIssues')).to_contain_text('ACTIF-16')
 page.locator('#reminderSimulation > details').first.locator('summary').click();cf=page.locator('#reminderContactForm');cf.locator('[name=name]').fill('Métrologie fictive');cf.locator('[name=type]').select_option('service');cf.locator('[name=email]').fill('metrologie@example.invalid');cf.locator('[name=verification]').select_option('confirmed');cf.locator('button').click();expect(page.locator('#reminderContactsList')).to_contain_text('ID stable')
 af=page.locator('#reminderAssignmentForm');af.locator('[name=equipmentId]').select_option('1');af.locator('[name=status]').select_option('confirmed');af.locator('button').click();expect(page.locator('#reminderAssignmentList')).to_contain_text('ACTIF-16');page.locator('#reminderSimulationDate').fill('2026-10-01');page.locator('#reminderEnqueue').click();expect(page.locator('#reminderQueue')).to_contain_text('4 étape(s)');page.locator('#reminderRun').click();expect(page.locator('#reminderQueue')).to_contain_text('SIMULÉ — aucun mail envoyé');page.locator('#reminderRun').click();assert page.locator('#reminderQueue tbody td').filter(has_text='SIMULÉ — aucun mail envoyé').count()==1
 page.locator('#reminderSimulation > details').first.locator('summary').click();page.screenshot(path=str(ART/'rappels-simulation.png'),full_page=True)
 page.reload();expect(page.locator('#reminderQueue')).to_contain_text('SIMULÉ — aucun mail envoyé');assert json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))==source
 # Real narrow viewport, no overflow of document outside intentional table/calendar scrollers.
 page.set_viewport_size({'width':390,'height':844});expect(page.locator('#referenceNavigation')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth')==390;page.locator('#referenceNavigation [data-reference-view=administration]').focus();page.keyboard.press('Enter');expect(page.locator('#administrationTitle')).to_be_focused()
 for view in ['home','material','planning','imports','administration']:
  nav(view);assert page.evaluate('document.documentElement.scrollWidth')==390,(view,page.evaluate('document.documentElement.scrollWidth'))
 nav('material');page.screenshot(path=str(ART/'materiel-mobile.png'),full_page=True)
 # Static artifact uses the same runtime and never loads cloud configuration.
 standalone=browser.new_page();standalone.on('pageerror',lambda e:errors.append(str(e)));standalone.goto('http://127.0.0.1:8000/prototype-vgp.html#material');expect(standalone.locator('#materialView')).to_be_visible();assert not standalone.locator('#authError').inner_text();standalone.close()
 assert not errors,errors;assert not blocked,blocked;browser.close()
print('PASS : recherche actif/archives et statut/secteur/type/variante, compteur sans perte, retour et focus, pages sans dialogue imbriqué, onglets clavier, introuvable, simulation persistante idempotente, données métier inchangées, viewport 390 px, HTML autonome, aucun réseau externe.')
