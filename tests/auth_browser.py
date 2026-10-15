from playwright.sync_api import sync_playwright,expect
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001'};document.documentElement.classList.add('cloud-locked');"
logins=0

def api(route):
 global logins
 headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST'}
 if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 if '/token?' in route.request.url:
  logins+=1;result={'access_token':'fake','refresh_token':'refresh','expires_in':3600,'user':{'id':'20000000-0000-0000-0000-000000000001','email':'fictif@example.test'}}
 elif route.request.url.endswith('read_shift_calendar'):result={'revision':0,'rows':[],'imports':[]}
 elif route.request.url.endswith('read_state'):result={'revision':0,'payload':{'anticipation':30,'equipment':[],'owners':[]}}
 elif '/logout?' in route.request.url:result={}
 else:raise AssertionError(route.request.url)
 route.fulfill(json=result,headers=headers)

def prepare(context):
 context.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));context.route('https://test.supabase.co/**',api)

def login(page,remember):
 page.goto('http://127.0.0.1:8000/');expect(page.locator('#authGate')).to_be_visible();page.locator('#loginForm [name=email]').fill('fictif@example.test');page.locator('#loginForm [name=password]').fill('mot-de-passe-fictif');page.locator('#rememberLogin').set_checked(remember);page.locator('#loginForm button').first.click();expect(page.locator('#homeView')).to_be_visible()

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context();prepare(c);page=c.new_page();page.add_init_script("localStorage.setItem('vgp-prototype-v1','SOURCE_A_CONSERVER')");login(page,True);saved=c.storage_state();assert any('vgp-auth:' in v['name'] for o in saved['origins'] for v in o['localStorage']);assert 'mot-de-passe-fictif' not in str(saved);c.close()
 new=b.new_context(storage_state=saved);prepare(new);page=new.new_page();page.goto('http://127.0.0.1:8000/');expect(page.locator('#homeView')).to_be_visible();assert logins==1;page.locator('#cloudLogout').click();expect(page.locator('#authGate')).to_be_visible();assert page.evaluate("localStorage.getItem('vgp-prototype-v1')")=='SOURCE_A_CONSERVER';assert page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('vgp-auth:')).length")==0
 login(page,False);session_only=new.storage_state();new.close();last=b.new_context(storage_state=session_only);prepare(last);page=last.new_page();page.goto('http://127.0.0.1:8000/');expect(page.locator('#authGate')).to_be_visible();assert logins==2;b.close()
print('PASS : case de connexion persistante, reprise dans un navigateur sans session précédente, session seule si décochée, déconnexion et données VGP conservées.')
