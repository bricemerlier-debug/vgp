from playwright.sync_api import sync_playwright,expect
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001',requireTrackingGuard:true};document.documentElement.classList.add('cloud-locked');"
state={'revision':1,'payload':{'anticipation':30,'equipment':[],'owners':[]}};ready=False;writes=0

def api(route):
 global state,writes
 headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST'}
 if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 if '/token?' in route.request.url:result={'access_token':'fictif','refresh_token':'fictif','expires_in':3600,'user':{'id':'20000000-0000-0000-0000-000000000001','email':'fictif@example.test'}}
 elif route.request.url.endswith('read_state'):result=state
 elif route.request.url.endswith('tracking_ready'):
  if not ready:route.fulfill(status=404,json={'message':'Function not found'},headers=headers);return
  result=True
 elif route.request.url.endswith('write_state'):
  assert ready;writes+=1;state={'revision':state['revision']+1,'payload':route.request.post_data_json['document']};result={'revision':state['revision']}
 else:result=None
 route.fulfill(json=result,headers=headers)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));page.route('https://test.supabase.co/**',api);page.goto('http://127.0.0.1:8000/')
 page.locator('#loginForm [name=email]').fill('fictif@example.test');page.locator('#loginForm [name=password]').fill('mot-de-passe-fictif');page.locator('#loginForm button').first.click();expect(page.locator('#cloudGuardNotice')).to_be_visible();page.locator('#homeAdd').click();form=page.locator('#equipmentForm');form.locator('[name=identifier]').fill('FICTIF-GUARD');form.locator('[name=designation]').fill('Anneau fictif');form.get_by_role('button',name='Enregistrer l’équipement').click();expect(page.locator('#equipmentError')).to_contain_text('Lecture seule');assert writes==0 and state['payload']['equipment']==[]
 ready=True;form.get_by_role('button',name='Enregistrer l’équipement').click();expect(page.locator('#editor')).not_to_be_visible();expect(page.locator('#cloudGuardNotice')).not_to_be_visible();assert writes==1 and len(state['payload']['equipment'])==1;page.reload();expect(page.locator('#cloudGuardNotice')).not_to_be_visible();assert not errors,errors;b.close()
 print('PASS : bannière en lecture seule avant SQL, aucun enregistrement réel simulé avant activation, reprise immédiate après protection, connexion et données conservées.')
