from playwright.sync_api import sync_playwright,expect
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/', '/prototype-vgp.html']:
  page=b.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('crypto.randomUUID=undefined')
  page.route('**/cloud-config.js',lambda r:r.fulfill(body="window.VGP_CLOUD={enabled:false};",content_type='text/javascript'));page.goto('http://127.0.0.1:8000'+path+'#material')
  page.locator('#search').fill('Filtre qui masque tout')
  page.locator('#filter').select_option('Archivé')
  page.get_by_role('button',name='+ Ajouter un équipement').click()
  form=page.locator('#equipmentForm')
  form.locator('[name=identifier]').fill('NEW-001')
  form.locator('[name=designation]').fill('Anneau ajouté sans contrôle')
  form.get_by_role('button',name='Enregistrer l’équipement').click()
  expect(page.locator('#editor')).not_to_be_visible()
  expect(page.locator('#message')).to_contain_text('NEW-001 créé et enregistré')
  expect(page.locator('tbody tr')).to_have_count(3)
  record=next(e for e in json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))['equipment'] if e['identifier']=='NEW-001')
  assert record['controls']==[]
  assert record['scheduledControl'] is None and record['firstControlDate'] is None

  row=page.locator('tbody tr').filter(has_text='NEW-001')
  assert 'Situation à vérifier' in row.inner_text() and 'Aucun contrôle' in row.inner_text()
  row.get_by_role('button',name='Ouvrir',exact=True).click()
  assert page.get_by_role('button',name='Télécharger le PDF').count()==0
  assert 'aucune première échéance justifiée' in page.locator('#detailContent').inner_text()
  page.get_by_role('button',name='Modifier la fiche').click()
  form.locator('[name=location]').fill('Usine')
  form.get_by_role('button',name='Enregistrer l’équipement').click()
  page.locator('#detail [data-close]').click()
  page.reload()
  expect(page.locator('tbody tr').filter(has_text='NEW-001')).to_be_visible()
  page.get_by_role('button',name='Ouvrir le menu',exact=True).click()
  page.locator('[data-view=kpi]').click()
  expect(page.locator('#kpi-performed')).to_have_text('1')
  expect(page.locator('#kpi-todo')).to_have_text('1')
  expect(page.locator('#kpi-percent')).to_have_text('0 %')
  assert not errors,errors
  page.close()
 b.close()
 print('PASS: ajout sans contrôle, navigateur sans randomUUID, visibilité immédiate malgré filtres, absence d’échéance artificielle, absence de contrôle fictif, modification et persistance, KPI ; sources et HTML autonome')
