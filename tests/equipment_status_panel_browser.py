"""Couleur du bloc échéance entier, sur fixtures locales sans écriture métier."""
from pathlib import Path
exec((Path(__file__).with_name('calendar_status_colors.py')).read_text().split('with sync_playwright() as p:')[0])
unknown=dict(source['equipment'][3]);unknown.update(id='unknown',siteId=9,identifier='FICTIF-unknown',obligations=[],manualNextControlDate=None,controls=[],archived=False,archiveHistory=[]);source['equipment'].append(unknown)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,15,8,tzinfo=timezone.utc));page.add_init_script('if(!localStorage.getItem("vgp-prototype-v1"))localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');')
 for kind,key,color,text in [('lost','lost','rgb(231, 216, 247)','rgb(79, 42, 119)'),('scrapped','scrapped','rgb(79, 87, 93)','rgb(255, 255, 255)'),('done','done','rgb(213, 237, 223)','rgb(21, 81, 57)'),('pending','pending','rgb(255, 237, 186)','rgb(112, 73, 0)'),('late','late','rgb(251, 216, 211)','rgb(133, 36, 29)'),('unknown','unknown','rgb(237, 240, 243)','rgb(53, 76, 96)')]:
  page.goto('http://127.0.0.1:8000/prototype-vgp.html#equipment/'+kind);page.reload();panel=page.locator('.equipment-deadline');expect(panel).to_have_class('equipment-deadline deadline-'+key);assert panel.evaluate('e=>getComputedStyle(e).backgroundColor')==color;assert panel.locator('strong').first.evaluate('e=>getComputedStyle(e).color')==text;assert panel.locator('span').first.evaluate('e=>getComputedStyle(e).color')==text;assert panel.locator('.foot').evaluate('e=>getComputedStyle(e).color')==text
  if kind=='done':assert panel.locator('.badge').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(25, 115, 76)'
  assert page.evaluate('document.documentElement.scrollWidth')==390
 assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==source;assert not errors,errors;b.close()
print('PASS : bloc entier violet/vert/jaune/rouge/gris selon statut, texte contrasté, badge à jour vert, mobile et données intactes.')
