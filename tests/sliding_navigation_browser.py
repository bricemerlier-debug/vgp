"""Navigation souris/clavier/tactile, sans écriture."""
from pathlib import Path
exec((Path(__file__).with_name('material_sort.py')).read_text().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/#material','/prototype-vgp.html#material']:
  page=b.new_page(viewport={'width':1200,'height':750});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000'+path);menu=page.locator('#navigation');page.mouse.move(600,400);page.mouse.move(3,400);expect(menu).to_be_visible();page.mouse.move(150,400);expect(menu).to_be_visible();page.mouse.move(700,400);expect(menu).not_to_be_visible(timeout=2000)
  page.mouse.move(3,400);expect(menu).to_be_visible();menu.locator('[data-view=controllers]').click();expect(page.locator('#controllersView')).to_be_visible();expect(menu).not_to_be_visible()
  # Clavier : ouverture explicite, pas de fermeture au déplacement de souris.
  page.locator('#menuToggle').focus();page.locator('#menuToggle').press('Enter');expect(menu).to_be_visible();page.mouse.move(800,500);expect(menu).to_be_visible();page.keyboard.press('Escape');expect(menu).not_to_be_visible();expect(page.locator('#menuToggle')).to_be_focused()
  # Ne pas ouvrir par-dessus une saisie modale.
  page.locator('#menuToggle').click();menu.locator('[data-view=material]').click();page.locator('#add').click();page.mouse.move(700,500);page.mouse.move(3,400);expect(menu).not_to_be_visible();expect(page.locator('#editor')).to_be_visible();assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==source;assert not errors,errors;page.close()
 # Écran tactile : bouton conservé et bord non actif ; animation réduite.
 page=b.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce');page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000/prototype-vgp.html#material');expect(page.locator('.navigation-hover-edge')).not_to_be_visible();page.locator('#menuToggle').tap();expect(page.locator('#navigation')).to_be_visible();page.locator('#navigation [data-view=controllers]').tap();expect(page.locator('#controllersView')).to_be_visible();expect(page.locator('#navigation')).not_to_be_visible();b.close()
print('PASS menu coulissant : survol bord gauche, fermeture en sortie, navigation, clavier/Échap/focus, modal protégé, tactile et animation réduite, données intactes.')
