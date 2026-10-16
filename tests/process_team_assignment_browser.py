"""Affectation automatique : stockage local et API Supabase simulée uniquement."""
from pathlib import Path
exec((Path(__file__).with_name('workspace_paths_browser.py')).read_text().split('with sync_playwright() as p:')[0])
sectors=['A1','A2','B1','B2','B3'];source['owners']=['Process Team '+s for s in sectors]+['Propriétaire existant'];source['ownerContacts']=[{'owner':'Process Team '+s,'email':s.lower()+'@example.test'} for s in sectors];source['equipment']=[gear(i+1,s,s) for i,s in enumerate(sectors)]
for e in source['equipment']:e['owner']=''
source['equipment'].append(gear(6,'EXISTANT','B1'));source['equipment'][-1]['owner']='Propriétaire existant'
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001',requireTrackingGuard:true};document.documentElement.classList.add('cloud-locked');"
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/#material','/prototype-vgp.html#material']:
  page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));page.add_init_script('if(!localStorage.getItem("vgp-prototype-v1"))localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000'+path);expect(page.locator('#message')).to_contain_text('5 équipement(s) associé(s)');saved=json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'));assert [e['owner'] for e in saved['equipment'][:5]]==['Process Team '+s for s in sectors];assert saved['equipment'][5]['owner']=='Propriétaire existant';assert saved['owners']==source['owners'];assert saved['ownerContacts']==source['ownerContacts'];assert all(a['controls']==old['controls'] and a['months']==old['months'] and a.get('manualNextControlDate')==old.get('manualNextControlDate') for a,old in zip(saved['equipment'],source['equipment']));page.reload();expect(page.locator('#materialView')).to_be_visible();assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==saved
  # Préremplissage d’une nouvelle fiche à partir du secteur, sans création de propriétaire.
  page.locator('#add').click();page.locator('#equipmentForm [name=sector]').select_option('B2');expect(page.locator('#equipmentForm [name=owner]')).to_have_value('Process Team B2');assert not errors,errors;page.close()
 for role in ['editor','reader','conflict']:
  server={'revision':1,'payload':json.loads(json.dumps(source))};writes=[]
  def api(route):
   headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST'}
   if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
   url=route.request.url
   if '/token?' in url:result={'access_token':'test','refresh_token':'test','expires_in':3600}
   elif url.endswith('tracking_ready'):result=True
   elif url.endswith('read_shift_calendar'):result={'revision':0,'rows':[],'imports':[]}
   elif url.endswith('read_state'):result={**server,'role':'reader' if role=='reader' else 'editor'}
   elif url.endswith('write_state'):
    body=route.request.post_data_json;writes.append(body);assert body['expected_revision']==server['revision']
    if role=='conflict':route.fulfill(status=409,json={'message':'Conflit de révision simulé'},headers=headers);return
    server['payload']=body['document'];server['revision']+=1;result={'revision':server['revision']}
   else:raise AssertionError(url)
   route.fulfill(json=result,headers=headers)
  context=b.new_context();context.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));context.route('https://test.supabase.co/**',api);page=context.new_page();page.goto('http://127.0.0.1:8000/');page.locator('#loginForm [name=email]').fill('test@example.test');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();expect(page.locator('#homeView')).to_be_visible()
  if role=='editor':expect(page.locator('#message')).to_contain_text('5 équipement(s) associé(s)');assert len(writes)==1;page.reload();expect(page.locator('#homeView')).to_be_visible();assert len(writes)==1
  elif role=='reader':assert len(writes)==0;assert server['payload']==source
  else:expect(page.locator('#message')).to_contain_text('Conflit de révision simulé');assert len(writes)==1;assert server['payload']==source
  context.close()
 b.close()
print('PASS Process Team : 5 secteurs existants, détenteurs/dates/contrôles préservés, préremplissage, rechargement idempotent, un seul lot CAS simulé, lecteur sans écriture et conflit sans modification ; aucune connexion de production.')
