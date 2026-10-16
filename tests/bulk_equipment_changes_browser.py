"""Modifications de sélection : aperçu et validation, stockage local uniquement."""
from pathlib import Path
exec((Path(__file__).with_name('material_sort.py')).read_text().split('with sync_playwright() as p:')[0])
source['equipment'][0]['months']=6
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/#material','/prototype-vgp.html#material']:
  page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));page.add_init_script('if(!localStorage.getItem("vgp-prototype-v1"))localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000'+path);dialog=page.locator('#bulkOwnersDialog')
  def open_batch(operation):
   page.locator('[data-bulk-toggle]').click()
   for n in [1,2]:page.locator(f'[data-bulk-equipment="sort-fictif-{n}"]').check()
   page.locator('[data-bulk-assign]').click();dialog.locator('[name=operation]').select_option(operation)
  def apply():dialog.get_by_role('button',name='Appliquer à la sélection',exact=True).click();expect(dialog).not_to_be_visible()
  open_batch('sector');dialog.locator('[name=sector]').select_option('B1');expect(dialog.locator('[data-bulk-change-summary]')).to_contain_text('2 zone(s) incompatible(s)');assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==source;dialog.locator('[name=zone]').select_option('Setup');apply();state=json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'));assert all(e['sector']=='B1' and e['zone']=='Setup' for e in state['equipment'][:2]);assert state['equipment'][2]['sector']=='B2' and state['equipment'][2]['zone']=='DMCR'
  open_batch('zone');dialog.locator('[name=zone]').select_option('__clear__');apply();state=json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'));assert all(e['zone']=='' for e in state['equipment'][:2])
  open_batch('naming');dialog.locator('[name=typeId]').select_option('anneau-retournement');dialog.locator('[name=variantId]').select_option('anneau-m30');expect(dialog.locator('[data-bulk-change-summary]')).to_contain_text('Anneau de retournement · M30');assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==state
  # Catalogue modifié sur un autre poste : exiger une nouvelle lecture de l’aperçu.
  changed=json.loads(json.dumps(state));changed['equipmentTypes'][0]['name']='Anneau révisé';page.evaluate('(s)=>localStorage.setItem("vgp-prototype-v1",JSON.stringify(s))',changed);dialog.get_by_role('button',name='Appliquer à la sélection',exact=True).click();expect(dialog.locator('[data-bulk-error]')).to_contain_text('ont changé');expect(dialog.locator('[data-bulk-change-summary]')).to_contain_text('Anneau révisé · M30');apply();final=json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))
  for index in [0,1]:
   e=final['equipment'][index];assert e['standardName']=='Anneau révisé · M30';assert e['originalDesignation']==source['equipment'][index]['designation'];assert e['months']==source['equipment'][index]['months'];assert e['owner']==source['equipment'][index]['owner'];assert e['manualNextControlDate']==source['equipment'][index]['manualNextControlDate'];assert e['controls']==source['equipment'][index]['controls']
  assert final['equipment'][2]['designation']==source['equipment'][2]['designation'];assert page.evaluate('document.documentElement.scrollWidth')==390;assert not errors,errors;page.close()
 b.close()
print('PASS lot : secteur/zone/nom/variante, aperçu avant validation, zones incompatibles signalées, catalogue concurrent relu, anciennes désignations et délais conservés, sélection seule modifiée, mobile/module/autonome ; aucune production.')
