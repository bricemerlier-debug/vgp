"""Protection de l’éditeur : fixtures locales uniquement."""
from pathlib import Path
exec((Path(__file__).with_name('material_sort.py')).read_text().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/#material','/prototype-vgp.html#material']:
  page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));page.add_init_script('if(!localStorage.getItem("vgp-prototype-v1"))localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000'+path);page.locator('#list [data-open="sort-fictif-1"]').click();page.locator('#edit').click();form=page.locator('#equipmentForm');close=form.locator('[data-close=editor]');close.click();expect(page.locator('#equipmentUnsaved')).not_to_be_visible();page.locator('#edit').click();form.locator('[name=location]').fill('Nouvelle localisation');close.click();d=page.locator('#equipmentUnsaved');expect(d).to_be_visible();d.locator('[data-draft-stay]').click();expect(form.locator('[name=location]')).to_have_value('Nouvelle localisation');page.keyboard.press('Escape');expect(d).to_be_visible();d.locator('[data-draft-discard]').click();expect(page.locator('#editor')).not_to_be_visible();assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==source
  page.locator('#edit').click();expect(form.locator('[name=location]')).to_have_value('Atelier fictif');form.locator('[name=location]').fill('Modification sauvegardée');close.click();d.locator('[data-draft-save]').click();expect(page.locator('#editor')).not_to_be_visible();saved=json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'));assert saved['equipment'][0]['location']=='Modification sauvegardée'
  # Échec du stockage : ne fermer ni l’éditeur ni perdre la saisie.
  page.locator('#edit').click();form.locator('[name=location]').fill('À conserver si erreur');page.evaluate("()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}}");close.click();d.locator('[data-draft-save]').click();expect(page.locator('#equipmentError')).to_contain_text('Enregistrement impossible');expect(page.locator('#editor')).to_be_visible();expect(form.locator('[name=location]')).to_have_value('À conserver si erreur');page.evaluate('()=>{Storage.prototype.setItem=window.originalSetItem}');close.click();d.locator('[data-draft-discard]').click()
  # Champ invalide : rester dans l’éditeur, ne rien enregistrer.
  page.locator('#edit').click();form.locator('[name=identifier]').fill('');close.click();d.locator('[data-draft-save]').click();expect(page.locator('#editor')).to_be_visible();expect(form.locator('[name=identifier]')).to_have_value('');assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==saved
  # Un rafraîchissement demande bien une confirmation native ; refus = brouillon conservé.
  events=[]
  def refuse(dialog):events.append(dialog.type);dialog.dismiss()
  page.on('dialog',refuse)
  try:page.reload(timeout=1500)
  except Exception:pass
  assert 'beforeunload' in events;expect(form.locator('[name=identifier]')).to_have_value('');assert not errors,errors
  page.remove_listener('dialog',refuse);page.on('dialog',lambda d:d.accept());page.close()
 b.close()
print('PASS brouillons : croix/Échap, continuer/abandonner/enregistrer, validation bloquante, rafraîchissement refusé conservant la saisie ; module/autonome et mobile.')
