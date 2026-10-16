"""Tri des en-têtes sur matériel fictif : aucune écriture de production."""
from pathlib import Path
exec((Path(__file__).with_name('material_sort.py')).read_text().split('with sync_playwright() as p:')[0])
for e,date in zip(source['equipment'],['2026-10-10','2026-01-01']):
 e['controls']=[{'id':'c-'+e['id'],'reportId':e['id'],'date':date,'intervenant':'Testeur fictif','result':'Bon état','observations':'Contrôle fictif','created':1}];e['periodicityValidation']={'validated':True,'months':12,'reason':'Fixture','by':'Testeur'}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('if(!localStorage.getItem("vgp-prototype-v1"))localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000/prototype-vgp.html#material')
 def names():return page.locator('#list tbody tr td:first-child b').all_text_contents()
 page.locator('#search').fill('fictif');page.locator('#sectorFilter').select_option('B2');button=page.locator('[data-material-sort=lastResultDate]');button.click();assert names()==['Alpha fictif','Zulu fictif','Bravo fictif'];expect(page.locator('#sortBy')).to_have_value('lastResultDate');expect(page.locator('#sortOrder')).to_have_value('asc');expect(button.locator('..')).to_have_attribute('aria-sort','ascending');expect(button).to_be_focused()
 button.press('Enter');assert names()==['Zulu fictif','Alpha fictif','Bravo fictif'];expect(page.locator('#sortOrder')).to_have_value('desc');expect(button.locator('..')).to_have_attribute('aria-sort','descending');expect(page.locator('#search')).to_have_value('fictif');expect(page.locator('#sectorFilter')).to_have_value('B2')
 page.locator('[data-material-sort=designation]').click();assert names()==['Alpha fictif','Bravo fictif','Zulu fictif'];page.locator('[data-material-sort=designation]').press('Space');assert names()==['Zulu fictif','Bravo fictif','Alpha fictif']
 page.locator('[data-material-sort=deadline]').click();expect(page.locator('#sortBy')).to_have_value('deadline');expect(page.locator('#sortOrder')).to_have_value('asc')
 # Le tri et les critères survivent à l’aller-retour fiche-liste.
 page.locator('#list [data-open="sort-fictif-1"]').click();page.locator('#backEquipment').click();expect(page.locator('#sortBy')).to_have_value('deadline');expect(page.locator('#search')).to_have_value('fictif');expect(page.locator('#sectorFilter')).to_have_value('B2');assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==source;assert page.evaluate('document.documentElement.scrollWidth')==390;assert not errors,errors;b.close()
print('PASS en-têtes : tri des dates dans les deux sens, dates absentes en dernier, nom A–Z/Z–A, clavier/focus, critères et retour conservés, mobile et aucune écriture.')
