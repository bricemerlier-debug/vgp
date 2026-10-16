from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import json
# Fixture locale, droits lecteur simulés ; seul read_state est autorisé.
source={'anticipation':30,'owners':[],'equipment':[{'id':'reader-equipment','siteId':1,'identifier':'LECTEUR-TEST','designation':'Matériel fictif','serialNumber':'','sector':'B2','zone':'DMCR','team':'A','owner':'','location':'Atelier','category':'','assignment':'','comments':'Original inchangé','months':12,'controls':[],'archived':False,'firstControlDate':'2026-10-31','dateValidation':{'validated':True,'source':'Fictif','reason':'Fictif','by':'Testeur'}}]}
calls=[];config="window.VGP_CLOUD={enabled:true,url:'https://reader-test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001'};document.documentElement.classList.add('cloud-locked');"
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def api(route):
  calls.append(route.request.url);headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST'}
  if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
  if '/token?' in route.request.url:result={'access_token':'fictif','refresh_token':'fictif','expires_in':3600,'user':{'id':'reader-fictif'}}
  elif route.request.url.endswith('read_state'):result={'revision':1,'payload':source,'role':'reader'}
  elif route.request.url.endswith('read_shift_calendar'):result={'revision':0,'rows':[],'imports':[]}
  else:raise AssertionError('Appel non autorisé en lecture : '+route.request.url)
  route.fulfill(json=result,headers=headers)
 page.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));page.route('https://reader-test.supabase.co/**',api);page.goto('http://127.0.0.1:8000/#material');page.locator('#loginForm [name=email]').fill('reader@example.invalid');page.locator('#loginForm [name=password]').fill('fictif');page.locator('#loginForm button').first.click();expect(page.locator('#list')).to_contain_text('LECTEUR-TEST');page.locator('#search').fill('LECTEUR');page.locator('#list [data-open]').click();page.locator('#commentsTab').click();page.locator('#commentsForm textarea').fill('Tentative fictive');page.locator('#commentsForm button').click();expect(page.locator('#message')).to_contain_text('Accès lecteur');assert source['equipment'][0]['comments']=='Original inchangé';assert not any('write_state' in c for c in calls);assert not errors,errors;b.close()
print('PASS : lecteur fictif, liste/recherche/fiche accessibles, modification refusée sans appel d’écriture ; RLS vérifiée séparément sur PostgreSQL isolé.')
