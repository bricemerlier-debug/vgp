import json,copy
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright,expect
source={'anticipation':30,'owners':[],'equipmentTypes':[{'id':'pont','name':'Pont roulant','months':6,'variants':[]}],'equipment':[{'id':'e1','siteId':1,'identifier':'FICTIF','designation':'AT-PR-01 PONT ROULANT','serialNumber':'SN-1','sector':'B2','zone':'DMCR','team':'A','owner':'','location':'Atelier fictif','category':'','assignment':'','comments':'Ancien commentaire','months':12,'controls':[],'archiveHistory':[],'archived':False}]}
state={'revision':7,'payload':copy.deepcopy(source)};attempts=0;writes=0;reads=0
config="window.VGP_CLOUD={enabled:true,requireTrackingGuard:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001'};document.documentElement.classList.add('cloud-locked');"
headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST'}
def api(route):
 global reads,writes,attempts,state
 if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 url=route.request.url
 if '/token?' in url:result={'access_token':'test','refresh_token':'test','expires_in':3600,'user':{'id':'20000000-0000-0000-0000-000000000001','email':'fictif@example.test'}}
 elif url.endswith('read_shift_calendar'):result={'revision':0,'rows':[],'imports':[]}
 elif url.endswith('tracking_ready'):result=True
 elif url.endswith('read_state'):reads+=1;result=state
 elif url.endswith('write_state'):
  body=route.request.post_data_json;attempts+=1
  if body['expected_revision']!=state['revision']:route.fulfill(status=409,json={'message':'REVISION_CONFLICT : rechargez les données avant de réessayer'},headers=headers);return
  writes+=1;state={'revision':state['revision']+1,'payload':body['document']};result={'revision':state['revision']}
 else:raise AssertionError(url)
 route.fulfill(json=result,headers=headers)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));page.route('https://test.supabase.co/**',api);page.clock.install(time=datetime(2026,10,15,10,tzinfo=timezone.utc));page.goto('http://127.0.0.1:8000/#material');page.locator('#loginForm [name=email]').fill('fictif@example.test');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();page.locator('#autoNamingMaterial').click();expect(page.locator('#autoNamingRows')).to_contain_text('AT-PR-01');assert reads>=2 and attempts==0;page.locator('#autoNamingSelectReliable').click();page.locator('#autoNamingValidate').click();assert attempts==0
 # A second editor changed the fiche during human review.
 state['revision']=8;state['payload']['equipment'][0]['comments']='Commentaire du second poste'
 page.once('dialog',lambda d:d.accept());page.locator('#autoNamingApply').click();expect(page.locator('#autoNamingError')).to_contain_text('REVISION_CONFLICT');assert writes==0
 page.locator('#autoNamingAnalyze').click();expect(page.locator('#autoNamingCount')).to_contain_text('0 sélectionnées');page.locator('#autoNamingSelectReliable').click();page.locator('#autoNamingValidate').click();page.once('dialog',lambda d:d.accept());page.locator('#autoNamingApply').click();expect(page.locator('#autoNamingStatus')).to_contain_text('1 fiche(s) standardisée(s)');assert reads>=3 and writes==1 and attempts==2;assert state['revision']==9;row=state['payload']['equipment'][0];assert row['comments']=='Commentaire du second poste';assert row['months']==12 and row['controls']==[] and row['identifier']=='FICTIF' and row['siteId']==1;assert row['equipmentMark']=='AT-PR-01';assert row['namingHistory'][0]['by']=='fictif@example.test';assert state['payload']['namingRules'][0]['typeId']=='pont';page.locator('#autoNamingClose').click();page.reload();page.locator('#search').fill('AT-PR-01 PONT ROULANT');expect(page.locator('#list')).to_contain_text('FICTIF');assert not errors,errors;b.close()
print('PASS nomenclature cloud simulé : lecture fraîche, aucune écriture avant validation humaine, conflit concurrent bloqué, réanalyse puis sauvegarde sans écraser l’autre poste, règles et recherche persistantes.')
