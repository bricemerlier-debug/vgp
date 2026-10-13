from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page()
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/cloud-config.js',lambda r:r.fulfill(body="window.VGP_CLOUD={enabled:false};",content_type='text/javascript'));page.goto('http://127.0.0.1:8000'+'#material')
 page.get_by_role('button',name='+ Ajouter un équipement').click()
 form=page.locator('#equipmentForm')
 form.locator('[name=identifier]').fill('1234')
 form.locator('[name=serialNumber]').fill('SN-01')
 form.locator('[name=designation]').fill('Anneau test')
 form.locator('[name=sector]').select_option('B3')
 form.locator('[name=team]').select_option('Jour')
 def owner_dialog(d): d.accept('Service levage')
 page.on('dialog',owner_dialog)
 page.get_by_role('button',name='+ Ajouter un propriétaire').click()
 page.remove_listener('dialog',owner_dialog)
 form.get_by_role('button',name='Enregistrer l’équipement').click()
 page.get_by_role('button',name='+ Ajouter un équipement').click()
 form.locator('[name=identifier]').fill(' 1234 ')
 assert page.locator('#identifierError').inner_text()=='Équipement déjà existant'
 assert form.locator('[name=identifier]').get_attribute('aria-invalid')=='true'
 form.locator('[name=designation]').fill('Doublon')
 form.get_by_role('button',name='Enregistrer l’équipement').click()
 assert page.locator('#editor').evaluate('(e)=>e.open')
 form.locator('[name=identifier]').fill('5678')
 assert page.locator('#identifierError').inner_text()==''
 form.locator('[name=serialNumber]').fill(' sn-01 ')
 assert page.locator('#serialNumberError').inner_text()=='Numéro de série déjà existant'
 form.get_by_role('button',name='Enregistrer l’équipement').click()
 assert page.locator('#editor').evaluate('(e)=>e.open')
 form.locator('[name=serialNumber]').fill('SN-02')
 form.get_by_role('button',name='Enregistrer l’équipement').click()
 page.locator('#search').fill('1234')
 page.get_by_role('button',name='Ouvrir',exact=True).click()
 text=page.locator('#detailContent').inner_text()
 for value in ['SN-01','B3','Jour','Service levage']:assert value in text
 page.get_by_role('button',name='Modifier la fiche').click()
 assert form.locator('[name=owner]').input_value()=='Service levage'
 assert form.locator('[name=sector]').input_value()=='B3'
 assert page.locator('#identifierError').inner_text()==''
 assert page.locator('#serialNumberError').inner_text()==''
 form.locator('[name=identifier]').fill('5678')
 assert page.locator('#identifierError').inner_text()
 form.locator('[name=identifier]').fill('1234')
 form.get_by_role('button',name='Enregistrer l’équipement').click()
 page.reload()
 data=json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))
 record=next(e for e in data['equipment'] if e['identifier']=='1234')
 assert record['serialNumber']=='SN-01' and record['owner']=='Service levage'
 # Import rejects duplicate serials, including whitespace and case differences.
 bad=json.loads(json.dumps(data));bad['equipment'][0]['serialNumber']=' sn-01 '
 page.locator('#import').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
 page.get_by_text('Format de sauvegarde invalide.',exact=True).wait_for()
 assert json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))==data
 # Legacy records retain their controls and identifiers, with empty new fields.
 legacy=json.loads(json.dumps(data))
 legacy.pop('owners')
 for e in legacy['equipment']:
  for field in ['serialNumber','sector','team','owner']:e.pop(field)
 page.on('dialog',lambda d:d.accept())
 page.locator('#import').set_input_files({'name':'old.json','mimeType':'application/json','buffer':json.dumps(legacy).encode()})
 page.get_by_text('Sauvegarde importée.',exact=True).wait_for()
 migrated=json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))
 assert len(migrated['equipment'])==len(data['equipment'])
 assert all(e['serialNumber']=='' for e in migrated['equipment'])
 assert not errors,errors
 b.close()
 print('PASS: doublons immédiats et bloqués, modification, secteurs/équipes/propriétaires, persistance, import et migration')
