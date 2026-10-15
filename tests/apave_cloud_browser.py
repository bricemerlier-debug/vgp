# Entire Supabase API is mocked: no production network request or write.
import json,os,subprocess,tempfile
from playwright.sync_api import sync_playwright,expect
w='10000000-0000-0000-0000-000000000001';user='20000000-0000-0000-0000-000000000001';old={'id':'old','reportId':'1','date':'2025-07-01','intervenant':'Test fictif','result':'Bon état','observations':'Historique fictif intact','created':1}
source={'anticipation':30,'owners':[],'equipment':[{'id':'e1','siteId':1,'identifier':'FICTIF100','designation':'Anneau fictif','serialNumber':'','sector':'B2','team':'A','zone':'DMCR','owner':'','location':'Lieu fictif','category':'','assignment':'','comments':'','months':12,'controls':[old],'archived':False,'archiveHistory':[]}]};state={'revision':1,'payload':source};ready=False;uploads=[];commits=[];signed=[]
fd,path=tempfile.mkstemp(suffix='.pdf');os.close(fd)
subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import {generatePdf} from './domain.mjs';fs.writeFileSync(process.argv[1],generatePdf(['N° DE RAPPORT : FICTIF-001','N° Ordre 1','Rapport de vérification','Anneau fictif','Date de la vérification 09/07/2026 Vérificateur TEST FICTIF','Client Atelier Bâtiment FICTIF100 Service B2','N° Identification S100','Contenu et conditions de la vérification','Examen complet fictif.','Résultat de la vérification','Texte source fictif avec observation, sans résultat métier déduit.','Observations','Observer et conserver cette phrase.']));",path],check=True)
pdf=open(path,'rb').read()
headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type,x-upsert','Access-Control-Allow-Methods':'POST,GET'}
def api(route):
 url=route.request.url
 if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 if '/token?' in url:result={'access_token':'test','refresh_token':'test','expires_in':3600,'user':{'id':user,'email':'fictif@example.com'}}
 elif url.endswith('read_state'):result=state
 elif url.endswith('apave_ready'):result=ready
 elif '/storage/v1/object/sign/' in url:
  if route.request.method=='POST':
   signed.append(route.request.post_data_json);result={'signedURL':'/object/sign/apave-reports/'+url.split('/apave-reports/')[1]+'?token=TEMPORARY'}
  else:route.fulfill(body=pdf,content_type='application/pdf',headers=headers);return
 elif '/storage/v1/object/apave-reports/' in url:
  uploads.append(route.request.post_data_buffer);assert uploads[-1]==pdf;assert route.request.headers['x-upsert']=='false';result={'Key':'fictif'}
 elif url.endswith('import_apave'):
  body=route.request.post_data_json;assert body['expected_revision']==state['revision'];commits.append(body);state.update(revision=2,payload=body['document']);result={'revision':2,'apave_checks':1}
 else:raise AssertionError(url)
 route.fulfill(json=result,headers=headers)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=b.new_context(viewport={'width':1440,'height':1000});context.route('**/cloud-config.js',lambda r:r.fulfill(body="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'"+w+"'};document.documentElement.classList.add('cloud-locked');",content_type='text/javascript'));context.route('https://test.supabase.co/**',api);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8000/#material');page.locator('#loginForm [name=email]').fill('fictif@example.com');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();page.locator('#apaveImport').click();page.locator('#apaveFile').set_input_files(path);expect(page.locator('#apaveStatus')).to_contain_text('1 éléments',timeout=30000);assert uploads==[] and commits==[]
 page.locator('[data-apave-result]').select_option('Mauvais état — réparable');page.locator('#apaveConfirmed').check();page.once('dialog',lambda d:d.accept());page.locator('#apaveApply').click();expect(page.locator('#apaveError')).to_contain_text('006_apave.sql');assert uploads==[] and commits==[]
 ready=True;page.once('dialog',lambda d:d.accept());page.locator('#apaveApply').click();expect(page.locator('#apaveStatus')).to_contain_text('1 constat(s) importé(s)');assert len(uploads)==1 and len(commits)==1;controls=state['payload']['equipment'][0]['controls'];assert len(controls)==2;assert all(controls[0][k]==v for k,v in old.items());assert controls[1]['date']=='2026-07-09';assert controls[1]['intervenant']=='TEST FICTIF';assert controls[1]['enteredById']==user;assert controls[1]['apave']['reportHash']==state['payload']['apaveReports'][0]['sha256'];assert 'base64' not in json.dumps(commits)
 page.locator('#apaveClose').click();page.locator('[data-open=e1]').click()
 with page.expect_popup() as popup:page.locator('#detail [data-apave-hash]').click()
 popup.value.wait_for_url('**#page=1');assert signed==[{'expiresIn':120}];assert not errors,errors;b.close()
os.unlink(path)
print('PASS APAVE cloud simulé : activation requise, zéro écriture avant confirmation, original binaire unique, commit validé, ancien historique intact et ouverture signée #page=1.')
