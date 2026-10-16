"""Sous-secteur B1 Setup : fixtures locales, aucune connexion Supabase."""
from pathlib import Path
exec((Path(__file__).with_name('workspace_paths_browser.py')).read_text().split('with sync_playwright() as p:')[0])
source['equipment'][0].update(sector='B1',zone='Setup')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('if(!localStorage.getItem("vgp-prototype-v1"))localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');')
 page.goto('http://127.0.0.1:8000/prototype-vgp.html#material')
 page.locator('#sectorFilter').select_option('B1');page.locator('#zoneFilter').select_option('Setup');expect(page.locator('#list tbody tr')).to_have_count(1)
 page.locator('#list [data-open="1"]').click();page.locator('#edit').click();f=page.locator('#equipmentForm');expect(f.locator('[name=zone]')).to_have_value('Setup');page.locator('[data-close=editor]').click()
 # Reopening after another sector must retain Setup even when the previous dropdown was empty.
 page.locator('#backEquipment').click();page.locator('#sectorFilter').select_option('B2');expect(page.locator('#zoneFilter')).to_have_value('')
 page.locator('#resetFilters').click();page.locator('#list [data-open="3"]').click();page.locator('#edit').click();expect(f.locator('[name=zone]')).to_be_disabled();page.locator('[data-close=editor]').click();page.locator('#backEquipment').click()
 page.locator('#list [data-open="1"]').click();page.locator('#edit').click();expect(f.locator('[name=zone]')).to_have_value('Setup');f.get_by_role('button',name='Enregistrer l’équipement',exact=True).click();expect(page.locator('#editor')).not_to_be_visible()
 saved=json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'));e=next(e for e in saved['equipment'] if e['id']=='1');assert e['zone']=='Setup' and e['sector']=='B1';assert e['controls']==[] and e['months']==12
 page.reload();page.locator('#edit').click();expect(page.locator('#equipmentForm [name=zone]')).to_have_value('Setup');expect(f.locator('[name=sector] option:checked')).to_have_text('B1 - Confection');f.locator('[name=sector]').select_option('B2');f.locator('[name=zone]').select_option('Démontage membrane');f.get_by_role('button',name='Enregistrer l’équipement',exact=True).click();expect(page.locator('#editor')).not_to_be_visible();page.reload();page.locator('#edit').click();expect(f.locator('[name=zone]')).to_have_value('Démontage membrane');expect(f.locator('[name=sector] option:checked')).to_have_text('B2 - Cuisson');page.locator('[data-close=editor]').click();page.locator('#backEquipment').click();page.locator('#sectorFilter').select_option('B2');page.locator('#zoneFilter').select_option('Démontage membrane');expect(page.locator('#list tbody tr')).to_have_count(1);expect(page.locator('#activeFilters')).to_contain_text('B2 - Cuisson');saved=json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'));e=next(e for e in saved['equipment'] if e['id']=='1');assert e['sector']=='B2' and e['zone']=='Démontage membrane' and e['controls']==[] and e['months']==12;assert not errors,errors;b.close()
print('PASS B1 Setup et B2 Démontage membrane : filtre combiné, édition successive, sauvegarde et rechargement ; contrôles et périodicité conservés.')
