"""Fenêtre contrôle sur écran bas et mobile ; sans enregistrement."""
from pathlib import Path
exec((Path(__file__).with_name('material_sort.py')).read_text().split('with sync_playwright() as p:')[0])
source['controllerProfiles']=[{'id':'test-controller','name':'Contrôleur fictif','email':'test@example.com','signature':None}]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/#material','/prototype-vgp.html#material']:
  for width,height in [(1200,675),(1366,600),(390,650)]:
   page=b.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000'+path);page.locator('#list [data-open="sort-fictif-1"]').click();page.locator('#newControl').click();dialog=page.locator('#control');expect(dialog).to_be_visible();footer=page.locator('.control-form-footer');box=footer.bounding_box();assert box['y']>=0 and box['y']+box['height']<=height;assert page.locator('#controlForm [name=result]').is_visible();page.locator('#controlForm [name=result]').select_option('Introuvable');expect(page.locator('#lossHelp')).to_be_visible();box=footer.bounding_box();assert box['y']+box['height']<=height
   # Menu des contrôleurs contenu dans la zone de saisie, Échap le ferme.
   page.locator('.control-form-body').evaluate('e=>e.scrollTop=0');combo=page.locator('#controlForm').get_by_role('combobox',name='Contrôleur *',exact=True);combo.click();popup=page.locator('.select-popup:visible');expect(popup).to_be_visible();bounds=popup.bounding_box();assert bounds['y']>=0 and bounds['y']+bounds['height']<=height;popup.get_by_role('searchbox').press('Escape');expect(dialog).to_be_visible();assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==source;assert not errors,errors
   if width==1200:
    page.locator('#controlForm [name=intervenant]').select_option('Contrôleur fictif');page.locator('#controlForm [name=observations]').fill('Recherche fictive pour tester la fenêtre.');page.locator('.control-form-footer button').click();expect(dialog).not_to_be_visible();saved=json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'));assert saved['equipment'][0]['archiveHistory'][-1]['workflow']=='loss-declaration';assert saved['equipment'][0]['controls']==source['equipment'][0]['controls']
   page.close()
 b.close()
print('PASS contrôle : bouton et fermeture visibles à 675/600 px et mobile, résultat sans menu tronqué, menu contrôleur et clavier, versions module/autonome, déclaration introuvable locale conservée, aucune écriture en production.')
