from playwright.sync_api import sync_playwright,expect
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/cloud-config.js',lambda r:r.fulfill(body="window.VGP_CLOUD={enabled:false};",content_type='text/javascript'));page.goto('http://127.0.0.1:8000'+'#material')
 page.get_by_role('button',name='+ Ajouter un équipement').click()
 form=page.locator('#equipmentForm')
 form.locator('[name=identifier]').fill('ZONE-01')
 form.locator('[name=designation]').fill('Anneau DMCR')
 expect(form.locator('[name=zone]')).to_be_disabled()
 form.locator('[name=sector]').select_option('B2')
 form.locator('[name=zone]').select_option('DMCR')
 form.locator('[name=team]').select_option('B')
 form.get_by_role('button',name='Enregistrer l’équipement').click()
 assert 'DMCR' in page.locator('tbody tr').filter(has_text='ZONE-01').inner_text()
 data=json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))
 second=dict(data['equipment'][-1]);second.update(id='zone02',siteId=data['nextVgpId'],identifier='ZONE-02',zone='Yuzer',team='A');data['nextVgpId']+=1
 data['equipment'].append(second)
 page.evaluate('(d)=>localStorage.setItem("vgp-prototype-v1",JSON.stringify(d))',data)
 page.reload()
 page.locator('#sectorFilter').select_option('B2')
 expect(page.locator('tbody tr')).to_have_count(2)
 page.locator('#zoneFilter').select_option('DMCR')
 expect(page.locator('tbody tr')).to_have_count(1)
 page.locator('#teamFilter').select_option('A')
 expect(page.get_by_text('Aucun équipement correspondant.',exact=True)).to_be_visible()
 page.locator('#stats [data-status-filter="En retard"]').click()
 expect(page.locator('tbody tr')).to_have_count(1)
 assert 'DEMO-AR-001' in page.locator('tbody').inner_text()
 assert page.locator('#sectorFilter').input_value()==''
 page.locator('#stats [data-status-filter="without-control"]').click()
 expect(page.locator('tbody tr')).to_have_count(3)
 page.locator('#stats [data-status-filter="À faire"]').click()
 expect(page.get_by_text('Aucun équipement correspondant.',exact=True)).to_be_visible()
 page.locator('#stats [data-status-filter=""]').click()
 expect(page.locator('tbody tr')).to_have_count(4)
 page.locator('#sectorFilter').select_option('B2')
 page.locator('#sortBy').select_option('team')
 assert 'ZONE-02' in page.locator('tbody tr').first.inner_text()
 page.locator('#sortBy').select_option('sector')
 assert 'ZONE-01' in page.locator('tbody tr').first.inner_text()
 page.locator('#zoneFilter').select_option('Yuzer')
 page.locator('#sectorFilter').select_option('A1')
 expect(page.locator('#zoneFilter')).to_be_disabled()
 assert page.locator('#zoneFilter').input_value()==''
 page.get_by_role('button',name='Réinitialiser les filtres').click()
 page.locator('tbody tr').filter(has_text='ZONE-01').get_by_role('button',name='Ouvrir',exact=True).click()
 assert 'Zone : DMCR' in page.locator('#detailContent').inner_text()
 page.get_by_role('button',name='Modifier la fiche').click()
 assert form.locator('[name=zone]').input_value()=='DMCR'
 form.locator('[name=sector]').select_option('B1')
 assert form.locator('[name=zone]').input_value()==''
 form.get_by_role('button',name='Enregistrer l’équipement').click()
 page.reload()
 data=json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))
 assert next(e for e in data['equipment'] if e['identifier']=='ZONE-01')['zone']==''
 assert next(e for e in data['equipment'] if e['identifier']=='ZONE-02')['zone']=='Yuzer'
 page.set_viewport_size({'width':390,'height':844})
 assert page.locator('body').evaluate('(e)=>e.scrollWidth <= window.innerWidth')
 assert not errors,errors
 b.close()
 print('PASS: compteurs cliquables, filtres combinés et reset, tri équipe/secteur-zone, zones B2, changement de secteur, migration, persistance, mobile')
