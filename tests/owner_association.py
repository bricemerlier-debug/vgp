from playwright.sync_api import sync_playwright,expect
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/cloud-config.js',lambda r:r.fulfill(body="window.VGP_CLOUD={enabled:false};",content_type='text/javascript'));page.goto('http://127.0.0.1:8000'+'#material')
 page.get_by_role('button',name='+ Ajouter un équipement').click();f=page.locator('#equipmentForm');f.locator('[name=identifier]').fill('ASSOC-001');f.locator('[name=typeId]').select_option('__free__');f.locator('[name=designation]').fill('Anneau à associer');f.get_by_role('button',name='Enregistrer l’équipement').click()
 data=json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"));data['owners']=['Alice','Bob'];data['equipment'][0]['owner']='Bob';page.evaluate('(d)=>localStorage.setItem("vgp-prototype-v1",JSON.stringify(d))',data);page.reload()
 page.get_by_role('button',name='Ouvrir le menu',exact=True).click();page.get_by_role('button',name='Propriétaires',exact=True).click()
 page.get_by_role('heading',name='Alice',exact=True).click()
 assert page.locator('#ownerProfileName').inner_text()=='Alice'
 page.get_by_role('button',name='+ Associer un équipement existant').click();page.locator('#associationSearch').fill('ASSOC-001');expect(page.locator('#associationList tbody tr')).to_have_count(1)
 page.locator('#associationList').get_by_role('button',name='Associer',exact=True).click();expect(page.locator('#associateDialog')).not_to_be_visible()
 expect(page.locator('#ownerProfile .owner-equipment-list').first.locator('tbody tr')).to_have_count(1)
 assert 'ASSOC-001' in page.locator('#ownerProfile').inner_text()
 page.get_by_role('button',name='+ Associer un équipement existant').click();page.locator('#associationSearch').fill('ASSOC-001');expect(page.locator('#associationList').get_by_role('button',name='Déjà associé')).to_be_disabled()
 page.locator('#associationSearch').fill('DEMO-AR-001')
 def cancel(d):d.dismiss()
 page.on('dialog',cancel);page.locator('#associationList').get_by_role('button',name='Associer',exact=True).click();page.remove_listener('dialog',cancel)
 assert json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))['equipment'][0]['owner']=='Bob'
 page.on('dialog',lambda d:d.accept());page.locator('#associationList').get_by_role('button',name='Associer',exact=True).click()
 expect(page.locator('#ownerProfile .owner-equipment-list').first.locator('tbody tr')).to_have_count(2)
 page.locator('#ownerProfile .owner-equipment-list').first.locator('tbody tr').filter(has_text='ASSOC-001').get_by_role('button',name='Ouvrir',exact=True).click();expect(page.locator('#detailContent .owner-link')).to_have_text(['Alice']);page.locator('#detail [data-close]').click()
 page.reload();page.get_by_role('button',name='Ouvrir le menu',exact=True).click();page.get_by_role('button',name='Propriétaires',exact=True).click();page.locator('.owner-card').filter(has=page.get_by_role('heading',name='Bob',exact=True)).get_by_role('button').click();expect(page.locator('#ownerProfile .owner-equipment-list').first.locator('tbody tr')).to_have_count(1)
 page.get_by_role('button',name='Retour aux propriétaires').click();page.locator('.owner-card').filter(has=page.get_by_role('heading',name='Alice',exact=True)).get_by_role('button').click();expect(page.locator('#ownerProfile .owner-equipment-list').first.locator('tbody tr')).to_have_count(2)
 page.set_viewport_size({'width':390,'height':844});assert page.locator('body').evaluate('(e)=>e.scrollWidth<=window.innerWidth')
 assert not errors,errors;b.close();print('PASS: fiche propriétaire, liste associée, recherche, association, doublon bloqué, association supplémentaire confirmée/annulée, persistance et mobile')
