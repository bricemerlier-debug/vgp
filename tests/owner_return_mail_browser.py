"""Préparation manuelle sans messagerie réelle, données locales uniquement."""
from pathlib import Path
exec((Path(__file__).with_name('workspace_paths_browser.py')).read_text().split('with sync_playwright() as p:')[0])
source['owners']=['Jean Test'];source['ownerContacts']=[{'owner':'Jean Test','email':'jean@example.com'}]
source['equipment']=[gear(1,'LATE'),gear(2,'SOON'),gear(3,'FUTURE')]
for e,date in zip(source['equipment'],['2026-10-01','2026-11-01','2027-01-01']):e['owner']='Jean Test';e['firstControlDate']=date
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/#owners','/prototype-vgp.html#owners']:
  page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,16,10,tzinfo=timezone.utc));page.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000'+path);page.locator('#ownerPicker').select_option('Jean Test');page.locator('#prepareOwnerReturnMail').click();d=page.locator('#ownerReturnMail');expect(d).to_be_visible();expect(d.locator('[data-mail-count]')).to_contain_text('2 équipement');expect(d.locator('[data-mail-recipient]')).to_have_value('jean@example.com');body=d.locator('textarea').input_value();assert 'LATE' in body and 'SOON' in body and 'FUTURE' not in body;assert 'Métrologie' in body
  # Changement concurrent : aucun mail périmé ni protocole externe lancé.
  changed=json.loads(json.dumps(source));changed['equipment'][0]['owner']='Autre Personne';changed['owners'].append('Autre Personne');page.evaluate('(s)=>localStorage.setItem("vgp-prototype-v1",JSON.stringify(s))',changed);d.locator('[data-mail-open]').click();expect(d.locator('[data-mail-status]')).to_contain_text('a changé');expect(d.locator('[data-mail-count]')).to_contain_text('1 équipement');assert 'LATE' not in d.locator('textarea').input_value();assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==changed;page.keyboard.press('Escape');expect(d).not_to_be_visible();expect(page.locator('#prepareOwnerReturnMail')).to_be_focused();assert page.evaluate('document.documentElement.scrollWidth')==390;assert not errors,errors;page.close()
 b.close()
print('PASS mail manuel : module et autonome, liste filtrée, mobile, clavier/focus, revalidation réaffectation, aucune écriture ni ouverture de messagerie réelle.')
