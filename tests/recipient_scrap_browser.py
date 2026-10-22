from playwright.sync_api import sync_playwright, expect
import os
base='http://127.0.0.1:'+os.environ.get('VGP_TEST_PORT','18494')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page();calls=[];errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('**/cloud-config.js',lambda route:route.fulfill(body="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'test'};",content_type='text/javascript'))
 def api(route):
  name=route.request.url.split('/')[-1];calls.append(name)
  if name=='read_equipment_scrap_link':
   route.fulfill(json={'status':'ready','test':True,'recipient':'test@example.test','equipment':{'number':'TEST-REBUT','name':'Matériel fictif'}})
  elif name=='submit_equipment_scrap':
   body=route.request.post_data_json
   assert body['accepted'] and body['signature']['data'].startswith('/9j/')
   route.fulfill(json={'id':'test','number':'TEST-REBUT','test':True})
  else:raise AssertionError(name)
 page.route('https://test.supabase.co/rest/v1/rpc/**',api)
 page.goto(base+'/declarer-rebut.html#token='+'a'*64)
 expect(page.locator('#lossPanel')).to_be_visible()
 expect(page.locator('h1')).to_have_text('Déclarer une mise au rebut')
 page.locator('#lossSigner').fill('Déclarant Test')
 page.locator('#lossDetails').fill('Matériel détérioré, déclaration fictive pour le test.')
 page.locator('#lossSignWithName').click();page.locator('#lossAccepted').check();page.locator('#lossSubmit').click()
 expect(page.locator('#lossSuccessText')).to_contain_text('Aucun matériel n’a été mis au rebut')
 assert calls==['read_equipment_scrap_link','submit_equipment_scrap'] and not errors
 browser.close()
print('PASS formulaire rebut : identité, signature, attestation, RPC distinct et test sans modification.')
