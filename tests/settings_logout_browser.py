"""Déconnexion via paramètres : Supabase entièrement simulé."""
from pathlib import Path
exec(Path(__file__).with_name('home_browser.py').read_text().split('with sync_playwright() as p:')[0])
calls=[]
def mock(route):
 if '/logout?' in route.request.url:
  calls.append(route.request.url);route.fulfill(json={},headers={'Access-Control-Allow-Origin':'*'});return
 api(route)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=b.new_context(viewport={'width':390,'height':844});context.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));context.route('https://test.supabase.co/**',mock);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8000/');page.locator('#loginForm [name=email]').fill('test@example.fr');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();expect(page.locator('#homeView')).to_be_visible();expect(page.locator('header #cloudLogout')).to_have_count(0);expect(page.locator('#cloudRefresh')).to_have_count(0);assert 'CENTRALISÉES' not in page.locator('header').inner_text();page.locator('#settingsToggle').click();expect(page.locator('#settingsMenu #cloudLogout')).to_be_visible();page.locator('#cloudLogout').click();expect(page.locator('#authGate')).to_be_visible();assert len(calls)==1;assert not errors,errors;context.close()
 page=b.new_page();page.goto('http://127.0.0.1:8000/prototype-vgp.html');page.locator('#settingsToggle').click();expect(page.locator('#cloudLogout')).not_to_be_visible();b.close()
print('PASS déconnexion : en-tête nettoyé, entrée Paramètres visible après connexion, retour connexion et appel logout simulé unique ; masquée en local.')
