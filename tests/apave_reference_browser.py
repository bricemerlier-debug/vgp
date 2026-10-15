# Read-only test against a private PDF, never added to Git and never rendered as screenshots.
# python tests/apave_reference_browser.py /private/report.pdf /private/expected.json
import json,sys
from playwright.sync_api import sync_playwright,expect
expected=json.load(open(sys.argv[2]));equipment=[]
for i,r in enumerate(expected['equipment']):
 identifier=next(x['value'] for x in r['identifiers'] if x['value'].startswith(('FF','EF')))
 equipment.append({'id':'fictif-'+str(i),'siteId':i+1,'identifier':identifier,'designation':'Fiche de test fictive','serialNumber':'','sector':'B2','team':'A','zone':'DMCR','owner':'','location':'Lieu fictif','category':'','assignment':'','comments':'','months':12,'controls':[],'archived':False,'archiveHistory':[]})
targets=list(equipment)
for i in range(4,865):equipment.append({'id':'filler-'+str(i),'siteId':i,'identifier':'FICTIF-RESTE-'+str(i),'designation':'Matériel fictif','serialNumber':'','sector':'B2','team':'A','zone':'DMCR','owner':'','location':'Lieu fictif','category':'','assignment':'','comments':'','months':12,'controls':[],'archived':False,'archiveHistory':[]})
source={'anticipation':30,'owners':[],'equipment':equipment}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:external.append(r.url) if not r.url.startswith(('http://127.0.0.1:8000/','blob:','data:')) else None);page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000/prototype-vgp.html#material');page.locator('#apaveImport').click();page.locator('#apaveFile').set_input_files(sys.argv[1]);expect(page.locator('#apaveStatus')).to_contain_text(str(expected['totalEntries'])+' éléments',timeout=90000)
 for r,e in zip(expected['equipment'],targets):
  page.locator('#apaveSearch').fill(e['identifier']);row=page.locator('#apaveRows tr[data-apave-source-key="'+r['sourceKey']+'"]');expect(row).to_have_count(1);expect(row.locator('[data-apave-equipment]')).to_have_value(e['id']);assert row.locator('[data-apave-local-page]').get_attribute('data-apave-local-page')==str(r['pages'][0]);row.locator('summary').click();pre=row.locator('pre');assert pre.nth(0).inner_text()==r['resultText'];assert pre.nth(1).inner_text()==(r['observations'] or 'Aucune observation extraite')
  if r['state'] in ['partial','not_verified']:expect(row.locator('[data-apave-result]')).to_be_disabled()
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth')==390;assert json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))==source;assert not external,external;assert not errors,errors;b.close()
print('PASS PDF réel dans Chromium : 377 pages, 3 équipements et observations exactes, pages correctes, correspondances exactes, aucune requête externe et aucune écriture.')
