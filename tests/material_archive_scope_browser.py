"""Périmètres actif/archives sans mutation des données."""
from pathlib import Path
exec((Path(__file__).with_name('workspace_paths_browser.py')).read_text().split('with sync_playwright() as p:')[0])
source['equipment']=[gear(1,'ACTIF'),gear(2,'PERDU'),gear(3,'REBUT',archive=True)]
e=source['equipment'][1];e['archived']=True;e['archiveHistory']=[{'id':'loss','reportId':'18','workflow':'loss-declaration','type':'archive','reason':'Équipement perdu','date':'2026-10-16','requester':'Testeur fictif','observations':'Recherche fictive'}]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/#material','/prototype-vgp.html#material']:
  page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000'+path)
  def ids():return page.locator('#list [data-open]').evaluate_all('(nodes)=>nodes.map(n=>n.dataset.open)')
  expect(page.locator('#activeEquipmentTab')).to_have_text('En suivi (1)');expect(page.locator('#archivedEquipmentTab')).to_contain_text('(2)');assert ids()==[source['equipment'][0]['id']]
  page.locator('#archivedEquipmentTab').click();expect(page.locator('#list tbody tr')).to_have_count(2);expect(page.locator('#list .lost-row')).to_have_count(1);expect(page.locator('#list .scrapped-row')).to_have_count(1)
  page.locator('#archiveReasonFilter').select_option('Équipement perdu');expect(page.locator('#list tbody tr')).to_have_count(1);page.locator('#list [data-open]').click();expect(page.locator('#detail')).to_be_visible();page.locator('#backEquipment').click();expect(page.locator('#archiveReasonFilter')).to_have_value('Équipement perdu');expect(page.locator('#list tbody tr')).to_have_count(1)
  page.locator('#activeEquipmentTab').click();assert ids()==[source['equipment'][0]['id']];page.locator('#archiveReasonFilter').evaluate("e=>{e.value='';e.dispatchEvent(new Event('change',{bubbles:true}))}")
  page.locator('#stats [data-status-filter="Introuvable"]').click();expect(page.locator('#archivedEquipmentTab')).to_have_attribute('aria-pressed','true');expect(page.locator('#list .lost-row')).to_have_count(1)
  # Recherche conservée et proposition de recherche dans les archives.
  page.locator('#resetFilters').click();page.locator('#activeEquipmentTab').click();page.locator('#search').fill('PERDU');expect(page.locator('#searchArchives')).to_be_visible();page.locator('#searchArchives').click();expect(page.locator('#search')).to_have_value('PERDU');expect(page.locator('#list .lost-row')).to_have_count(1)
  assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==source;assert not errors,errors;assert page.evaluate('document.documentElement.scrollWidth')==390;page.close()
 b.close()
print('PASS archives : introuvables/rebut regroupés, actif séparé, motifs, couleurs, compteur, recherche et retour conservés, mobile, données inchangées.')
