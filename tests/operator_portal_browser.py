from playwright.sync_api import sync_playwright,expect
import json,os
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001'};"
state={'interventions':[],'writes':0,'fail_next':True}
def api(route):
 request=route.request;path=request.url.split('test.supabase.co')[-1]
 if path.startswith('/auth/v1/token'):
  route.fulfill(status=200,content_type='application/json',body=json.dumps({'access_token':'test','refresh_token':'refresh','expires_in':3600,'user':{'id':'20000000-0000-0000-0000-000000000002','email':'op@example.test'}}));return
 if path.startswith('/auth/v1/logout'):
  route.fulfill(status=204,body='');return
 if path.endswith('/operator_portal_data'):
  route.fulfill(status=200,content_type='application/json',body=json.dumps({'containers':[{'id':'c1','number':'CD036','checks':['Bâti','Galet','Visserie']}],'interventions':state['interventions'],'controllers':['Laurent B.','Stéphane G.']}));return
 if path.endswith('/operator_save_intervention_v3'):
  data=request.post_data_json
  if state['fail_next']:
   state['fail_next']=False;route.fulfill(status=503,content_type='application/json',body=json.dumps({'message':'Service temporairement indisponible'}));return
  state['writes']+=1
  if data.get('intervention_id'):
   item=state['interventions'][0];item['type']=data['kind'];item['comment']=data['comment'];item['controller']=data['controller_primary']+((' / '+data['controller_secondary']) if data.get('controller_secondary') else '');item['parts']=data['checked_parts'];item['checklistRecorded']=True
  else:state['interventions'].append({'id':'entry1','containerId':'c1','containerNumber':'CD036','number':'1','date':'2026-10-20','type':data['kind'],'comment':data['comment'],'controller':data['controller_primary']+((' / '+data['controller_secondary']) if data.get('controller_secondary') else ''),'parts':data['checked_parts'],'checklistRecorded':True,'checks':['Bâti','Galet','Visserie'],'corrections':[]})
  route.fulfill(status=200,content_type='application/json',body=json.dumps({'id':'entry1','number':'1','revision':state['writes']}));return
 route.fulfill(status=404,content_type='application/json',body='{}')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'))
 page.route('https://test.supabase.co/**',api)
 page.goto('http://127.0.0.1:'+os.getenv('PORTAL_TEST_PORT','8123')+'/operateur.html')
 page.locator('#loginForm [name=email]').fill('op@example.test');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').click()
 expect(page.locator('#workspace')).to_be_visible()
 page.locator('#controllerPrimary').select_option('Laurent B.');page.locator('#containerSearch').fill('INCONNU');page.locator('[name=type][value=préventif]').check();expect(page.locator('#preventiveChecklist')).to_be_visible();page.locator('#comment').fill('Roue réparée');page.locator('#saveButton').click()
 expect(page.locator('#formError')).to_contain_text('Sélectionnez un contenant existant');assert state['writes']==0
 page.locator('#containerSearch').fill('CD036');page.locator('#saveButton').click()
 expect(page.locator('#formError')).to_contain_text('Un numéro saisi seul ne suffit pas');assert state['writes']==0
 page.locator('#containerSearch').fill('CD0');page.locator('#containerChoices [data-container-id=c1]').click();page.locator('#controllerPrimary').select_option('Laurent B.');page.locator('#controllerSecondary').select_option('Stéphane G.');expect(page.locator('#preventivePoints input:checked')).to_have_count(3);page.locator('#preventivePoints [data-check-index="1"]').uncheck();page.locator('#saveButton').click()
 expect(page.locator('#formError')).to_contain_text('non confirmé');assert page.locator('#comment').input_value()=='Roue réparée'
 page.locator('#saveButton').click()
 expect(page.locator('#history')).to_contain_text('Roue réparée');assert state['writes']==1 and state['interventions'][0]['controller']=='Laurent B. / Stéphane G.' and state['interventions'][0]['parts']=={'Bâti':'Vérifié','Visserie':'Vérifié'}
 page.locator('[data-edit=entry1]').click();expect(page.locator('#preventivePoints input:checked')).to_have_count(2);page.locator('[name=type][value=curatif]').check();expect(page.locator('#preventiveChecklist')).to_be_hidden();page.locator('#comment').fill('Roue réparée et contrôlée');page.locator('#saveButton').click()
 expect(page.locator('#history')).to_contain_text('Roue réparée et contrôlée');assert state['writes']==2 and len(state['interventions'])==1 and state['interventions'][0]['parts']=={}
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 assert not errors,errors
 browser.close()
print('Portail opérateur : connexion, saisie, correction, confirmation et mobile OK')
