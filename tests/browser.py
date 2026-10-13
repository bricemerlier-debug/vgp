from browser_support import approve_period
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/cloud-config.js',lambda r:r.fulfill(body="window.VGP_CLOUD={enabled:false};",content_type='text/javascript'));page.goto('http://127.0.0.1:8000'+'#material')
    page.get_by_role('button',name='+ Ajouter un équipement').click()
    form=page.locator('#equipmentForm')
    approve_period(form)
    form.locator('#initial summary').click()
    for name,value in [('identifier','TEST-001'),('designation','Anneau test'),('date','2026-06-15'),('intervenant','Testeur')]:
        form.locator('[name='+name+']').fill(value)
    form.locator('[name=result]').select_option(label='Mauvais état — réparable')
    form.locator('[name=attachment]').set_input_files({'name':'rapport.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 test'})
    form.get_by_role('button',name='Enregistrer l’équipement').click()
    expect(page.locator('#editor')).not_to_be_visible()
    page.locator('#search').fill('TEST-001')
    assert page.locator('tbody tr').count()==1
    page.get_by_role('button',name='Ouvrir',exact=True).click()
    assert '15/06/2027' in page.locator('#detailContent').inner_text()
    assert page.get_by_role('link',name='Télécharger : rapport.pdf').count()==1
    page.get_by_role('button',name='+ Enregistrer un contrôle').click()
    form=page.locator('#controlForm')
    form.locator('[name=date]').fill('2026-07-15')
    form.locator('[name=intervenant]').fill('Autre testeur')
    form.locator('[name=result]').select_option(label='Mauvais état — à jeter')
    form.get_by_role('button',name='Enregistrer le contrôle',exact=True).click()
    assert page.locator('.history').count()==2
    with page.expect_popup() as popup:
        page.get_by_role('button',name='Compte rendu / PDF').first.click()
    assert popup.value.url.startswith('blob:')
    page.reload()
    page.locator('#search').fill('TEST-001')
    assert 'Mauvais état — à jeter' in page.locator('tbody').inner_text()
    page.get_by_role('button',name='Ouvrir',exact=True).click()
    page.get_by_role('button',name='Modifier la fiche').click()
    page.locator('#equipmentForm [name=location]').fill('Usine')
    page.get_by_role('button',name='Enregistrer l’équipement').click()
    assert 'Usine' in page.locator('#detailContent').inner_text()
    page.locator('#detail [data-close]').click()
    page.set_viewport_size({'width':390,'height':844})
    assert page.locator('body').evaluate('(e)=>e.scrollWidth <= window.innerWidth')
    with page.expect_download() as download:
        page.get_by_role('button',name='Exporter une sauvegarde').click()
    download.value.save_as('/tmp/vgp-test-backup.json')
    page.on('dialog',lambda d:d.accept())
    page.locator('#import').set_input_files('/tmp/vgp-test-backup.json')
    page.get_by_text('Sauvegarde importée.',exact=True).wait_for()
    assert not errors,errors
    print('PASS: ajout, pièce jointe, historique, compte rendu, persistance, modification, mobile, export/import')
    browser.close()
