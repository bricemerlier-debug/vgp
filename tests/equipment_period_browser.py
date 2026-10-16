"""Correction de périodicité sur données fictives, sans écriture cloud."""
from pathlib import Path
exec((Path(__file__).with_name('workspace_paths_browser.py')).read_text().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('if(!localStorage.getItem("vgp-prototype-v1"))localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');')
 page.goto('http://127.0.0.1:8000/prototype-vgp.html#material');page.locator('#list [data-open="1"]').click();page.locator('#edit').click();f=page.locator('#equipmentForm')
 page.locator('#addEquipmentType').click();catalog=page.locator('#catalogItemForm');catalog.locator('[name=label]').fill('Élingue fictive six mois');catalog.locator('[name=months]').select_option('6');catalog.locator('button:not([type])').click()
 expect(f.locator('[name=months]')).to_be_enabled();expect(f.locator('[name=months]')).to_have_value('6')
 # Une variante ne doit pas rétablir les douze mois de l’ancienne fiche.
 page.locator('#addEquipmentVariant').click();catalog.locator('[name=label]').fill('2 brins');catalog.locator('button:not([type])').click();expect(f.locator('[name=months]')).to_have_value('6')
 f.get_by_role('button',name='Enregistrer l’équipement',exact=True).click();expect(page.locator('#editor')).not_to_be_visible()
 saved=json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'));e=next(e for e in saved['equipment'] if e['id']=='1');assert e['months']==6 and e['periodicityValidation']['months']==6 and e['controls']==source['equipment'][0]['controls'];assert next(t for t in saved['equipmentTypes'] if t['id']==e['typeId'])['months']==6;assert e['dateHistory'][-1]['previousMonths']==12
 page.reload();page.locator('#edit').click();expect(f.locator('[name=months]')).to_have_value('6');f.locator('[name=months]').select_option('3');f.locator('[name=variantId]').select_option('');expect(f.locator('[name=months]')).to_have_value('3');f.get_by_role('button',name='Enregistrer l’équipement',exact=True).click();expect(page.locator('#editor')).not_to_be_visible()
 page.reload();page.locator('#edit').click();expect(f.locator('[name=months]')).to_have_value('3');page.locator('[data-close=editor]').click()
 # Le défaut du catalogue reste six mois pour une nouvelle fiche du même type.
 page.locator('#backEquipment').click();page.locator('#add').click();f.locator('[name=typeId]').select_option(e['typeId']);expect(f.locator('[name=months]')).to_have_value('6');assert not errors,errors;b.close()
print('PASS : nouveau type six mois depuis fiche existante, variante sans remise à douze, correction manuelle persistante et défaut catalogue conservé.')
