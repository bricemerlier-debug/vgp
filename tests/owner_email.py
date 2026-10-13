from playwright.sync_api import sync_playwright,expect
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/cloud-config.js',lambda r:r.fulfill(body="window.VGP_CLOUD={enabled:false};",content_type='text/javascript'));page.goto('http://127.0.0.1:8000'+'#material')
 # Prepare ordinary existing data; no external email operation occurs.
 page.get_by_role('button',name='+ Ajouter un équipement').click();f=page.locator('#equipmentForm');f.locator('[name=identifier]').fill('MAIL-1');f.locator('[name=designation]').fill('Anneau avec rappels');f.get_by_role('button',name='Enregistrer l’équipement').click()
 data=json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"));data['owners']=['Alice'];data['equipment'][-1]['owner']='Alice';data['equipment'][-1]['firstControlDate']='2027-10-13';data['equipment'][-1]['dateValidation']={'validated':True,'source':'Document fictif','reason':'Échéance fictive explicite','by':'Responsable fictif'};page.evaluate('(d)=>localStorage.setItem("vgp-prototype-v1",JSON.stringify(d))',data);page.reload()
 def open_owner():
  page.get_by_role('button',name='Ouvrir le menu',exact=True).click();page.get_by_role('button',name='Propriétaires',exact=True).click();page.get_by_role('heading',name='Alice',exact=True).click()
 open_owner();page.locator('#ownerContactForm [name=email]').fill('alice@example.com');page.get_by_role('button',name='Enregistrer l’adresse').click()
 expect(page.locator('#message')).to_contain_text('Adresse e-mail enregistrée')
 expect(page.locator('.owner-reminders tbody tr')).to_have_count(4)
 page.locator('[data-reminder-kind=deadline]').click();expect(page.locator('#emailPreviewMeta')).to_contain_text('alice@example.com')
 assert 'ne doit plus être utilisé' in page.locator('#emailPreviewBody').input_value()
 assert 'PRÉVISUALISATION' in page.locator('#emailPreviewBody').input_value()
 page.locator('#emailPreview [data-close]').click();page.reload();open_owner()
 assert page.locator('#ownerContactForm [name=email]').input_value()=='alice@example.com'
 with page.expect_download() as download:page.locator('#export').evaluate('(button)=>button.click()')
 download.value.save_as('/tmp/owner-email-backup.json')
 assert json.load(open('/tmp/owner-email-backup.json'))['ownerContacts']==[{'owner':'Alice','email':'alice@example.com'}]
 page.set_viewport_size({'width':390,'height':844});assert page.locator('body').evaluate('(e)=>e.scrollWidth<=window.innerWidth')
 assert not errors,errors;b.close();print('PASS: e-mail propriétaire, sauvegarde/rechargement/export, quatre rappels, aperçu suspension, mobile ; aucun envoi')
