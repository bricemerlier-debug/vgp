from playwright.sync_api import sync_playwright,expect
import json
w='10000000-0000-0000-0000-000000000001'
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'"+w+"'};document.documentElement.classList.add('cloud-locked');"
state={'revision':0,'payload':{'equipment':[],'owners':[],'anticipation':30}}
receipt='30000000-0000-0000-0000-000000000001'
def api(route):
 global state
 headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST'}
 if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 body=route.request.post_data_json
 if '/token?' in route.request.url:result={'access_token':'test','refresh_token':'test','expires_in':3600}
 elif route.request.url.endswith('read_shift_calendar'):result={'revision':0,'rows':[],'imports':[]}
 elif route.request.url.endswith('read_state'):result=state
 elif route.request.url.endswith('write_state'):
  assert body['source'].startswith('Stockage local')
  state={'revision':1,'payload':body['document'],'migration':{'id':receipt,'validated_at':None}};result={'revision':1,'receipt':receipt}
 elif route.request.url.endswith('validate_migration'):
  assert body['receipt']==receipt and body['expected_document']==state['payload'];state['migration']['validated_at']='2026-10-12';result=None
 else:raise AssertionError(route.request.url)
 route.fulfill(json=result,headers=headers)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 local=b.new_page();local.route('**/cloud-config.js',lambda r:r.fulfill(body="window.VGP_CLOUD={enabled:false};",content_type='text/javascript'));local.goto('http://127.0.0.1:8000/#material');local.get_by_role('button',name='+ Ajouter un équipement').click();local.locator('[name=identifier]').fill('MIGRATION');local.locator('[name=designation]').fill('Anneau à migrer');local.get_by_role('button',name='Enregistrer l’équipement').click();expect(local.locator('#editor')).not_to_be_visible();raw=local.evaluate("localStorage.getItem('vgp-prototype-v1')");source=json.loads(raw)
 context=b.new_context();context.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));context.route('https://test.supabase.co/**',api)
 context.add_init_script("localStorage.setItem('vgp-prototype-v1',"+json.dumps(raw)+")")
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto('http://127.0.0.1:8000/#material');page.locator('#loginForm [name=email]').fill('admin@example.fr');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();expect(page.locator('main')).to_be_visible();page.locator('#settingsToggle').click();page.locator('#dataSettings').click();page.locator('#legacyImportTools > summary').click();page.locator('#migrateLocal').click();expect(page.locator('#dataStatus')).to_contain_text('relecture intégrale réussies');assert state['payload']==source;assert page.evaluate("localStorage.getItem('vgp-prototype-v1')")==raw
 # Rechargement avant validation : retrouver la demande grâce au reçu serveur.
 page.reload();expect(page.locator('tbody')).to_contain_text('Anneau à migrer');page.locator('#settingsToggle').click();page.locator('#dataSettings').click();page.locator('#legacyImportTools > summary').click();expect(page.locator('#validateMigration')).to_be_enabled();page.locator('#validateMigration').click();expect(page.locator('#dataStatus')).to_contain_text('Migration validée');assert state['migration']['validated_at'];assert page.evaluate("localStorage.getItem('vgp-prototype-v1')")==raw;assert not errors,errors;b.close()
print('PASS: migration avec historique, relecture intégrale, copie locale intacte et validation retrouvée après rechargement.')
