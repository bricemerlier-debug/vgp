from playwright.sync_api import sync_playwright, expect
import os
base='http://127.0.0.1:'+os.environ.get('VGP_TEST_PORT','18494')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for kind,page_name,title,success in [('loss','perte','Déclarer un matériel perdu','Aucun matériel n’a été marqué perdu'),('scrap','rebut','Déclarer une mise au rebut','Aucun matériel n’a été mis au rebut')]:
  page=browser.new_page();calls=[];errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.route('**/cloud-config.js',lambda route:route.fulfill(body="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'test'};",content_type='text/javascript'))
  def api(route):
   name=route.request.url.split('/')[-1];calls.append(name)
   if name=='read_equipment_'+kind+'_link':
    route.fulfill(json={'status':'ready','test':True,'recipient':'test@example.test','equipment':{'number':'TEST-REBUT','name':'Matériel fictif'}})
   elif name=='submit_equipment_'+kind:
    body=route.request.post_data_json
    assert body['signer_name']=='brice_merlier@goodyear.com'
    assert body['accepted'] and body['signature']['data'].startswith('/9j/')
    route.fulfill(json={'id':'test','number':'TEST-REBUT','test':True})
   else:raise AssertionError(name)
  page.route('https://test.supabase.co/rest/v1/rpc/**',api)
  page.goto(base+'/declarer-'+page_name+'.html#token='+'a'*64)
  expect(page.locator('#lossPanel')).to_be_visible()
  expect(page.locator('h1')).to_have_text(title)
  page.locator('#lossSigner').fill('brice_merlier@goodyear.com')
  expect(page.locator('#declarationIdentity')).to_have_text('Brice Merlier')
  page.locator('#lossDetails').fill('Matériel détérioré, déclaration fictive pour le test.')
  page.locator('#lossSignWithName').click();page.locator('#lossAccepted').check();page.locator('#lossSubmit').click()
  expect(page.locator('#lossSuccessText')).to_contain_text(success)
  assert calls==['read_equipment_'+kind+'_link','submit_equipment_'+kind] and not errors
 browser.close()
print('PASS formulaires perte et rebut : identité, signature, attestation, RPC distinct et test sans modification.')
