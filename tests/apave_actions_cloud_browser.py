from playwright.sync_api import sync_playwright,expect
from openpyxl import Workbook
from io import BytesIO
from datetime import datetime,timezone
import json
w='10000000-0000-0000-0000-000000000001';core={'revision':7,'payload':{'anticipation':30,'owners':[],'equipment':[{'id':'e1','siteId':1,'identifier':'FICTIF','designation':'Harnais','serialNumber':'','sector':'B2','zone':'DMCR','team':'A','owner':'','location':'Atelier','category':'','assignment':'','months':12,'controls':[],'archived':False,'archiveHistory':[]}]}}
imports=[];actions=[];attempts=0
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'"+w+"'};document.documentElement.classList.add('cloud-locked');"
headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST,GET'}
def api(route):
 global attempts
 if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 url=route.request.url
 if '/token?' in url:result={'access_token':'test','refresh_token':'test','expires_in':3600,'user':{'id':'20000000-0000-0000-0000-000000000001','email':'fictif@example.test'}}
 elif url.endswith('read_state'):result=core
 elif url.endswith('read_shift_calendar'):result={'revision':0,'rows':[],'imports':[]}
 elif url.endswith('read_maintenance_action_imports'):result=imports
 elif url.endswith('read_maintenance_actions'):result=actions
 elif url.endswith('read_equipment_maintenance'):result=[]
 elif url.endswith('import_apave_maintenance_actions_v2'):
  body=route.request.post_data_json;assert body['w']==w;items=body['items'];assert len(items)==1;a=items[0];assert a['source_observation']==a['plan']=='Réparer sans déformer le texte.\nEssai final.';assert a['level']==2 and a['action_date']=='2026-07-09' and a['equipment_id']=='e1';assert len(a['source_key'])==64;attempts+=1
  if not imports:
   imports.append({'source_key':a['source_key'],'action_id':a['id']});actions.append({**a,'action_number':56,'revision':1,'due_date':'2026-12-31','created_at':'2026-10-15T10:00:00Z'})
   route.fulfill(status=503,json={'message':'Réponse interrompue après enregistrement'},headers=headers);return
  result={'added':0,'skipped':1}
 else:raise AssertionError('Unexpected API request: '+url)
 route.fulfill(json=result,headers=headers)
book=Workbook();sheet=book.active;sheet.append(['numEquipement','gravite','observation','dateVisite','idRapport']);sheet.append(['FICTIF',2,'Réparer sans déformer le texte.\nEssai final.','09/07/2026','R123']);buffer=BytesIO();book.save(buffer);file={'name':'Fictif.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':buffer.getvalue()}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=browser.new_context(viewport={'width':1440,'height':1000});c.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));c.route('https://test.supabase.co/**',api);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,15,10,tzinfo=timezone.utc));page.goto('http://127.0.0.1:8000/#equipment/e1');page.locator('#loginForm [name=email]').fill('fictif@example.test');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();expect(page.locator('#detailTitle')).to_contain_text('Harnais');page.locator('#maintenanceTab').click();page.locator('#equipmentMaintenance [data-import-apave-actions]').click();page.locator('#actionImportFile').set_input_files(file);expect(page.locator('#actionImportSelection')).to_contain_text('1 action(s)');assert not imports
 page.locator('#actionImportConfirmed').check();page.locator('#actionImportApply').click();expect(page.locator('#actionImportError')).to_contain_text('non confirmé');assert len(imports)==1;page.locator('#actionImportApply').click();expect(page.locator('#actionImportStatus')).to_contain_text('0 action(s) créée(s) · 1 déjà importée(s)');assert attempts==2 and len(actions)==1;page.locator('#actionImportClose').click();expect(page.locator('#actionList')).to_contain_text('PA-56');expect(page.locator('#actionList')).to_contain_text('Niveau 2');assert core['revision']==7 and core['payload']['equipment'][0]['controls']==[];assert not errors,errors;browser.close()
print('PASS import Excel cloud simulé : confirmation avant envoi, source complète, reprise après réponse ambiguë sans doublon, carnet actualisé PA-56, parc VGP intact.')
