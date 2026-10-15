from playwright.sync_api import sync_playwright,expect
from openpyxl import Workbook
from io import BytesIO
from datetime import datetime,timezone
import json
w='10000000-0000-0000-0000-000000000001';core={'revision':7,'payload':{'anticipation':30,'owners':[],'equipment':[{'id':'e1','siteId':1,'identifier':'FICTIF','designation':'Harnais','serialNumber':'','sector':'B2','zone':'DMCR','team':'A','owner':'','location':'Atelier','category':'','assignment':'','months':12,'controls':[],'archived':False,'archiveHistory':[]}]}}
actions=[{'id':'a1','equipment_id':'e1','action_number':56,'title':'Pièce à remplacer','plan':'Réparation prévue','source':'Manuel','reference':'','responsible':'Atelier','level':2,'action_date':'2026-07-09','status':'todo','due_date':'2026-12-31','initial_due_date':'2026-12-31','revision':1,'deferrals':[],'created_at':'2026-07-09T10:00:00Z'}];requests=[];attempts=0
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'"+w+"'};document.documentElement.classList.add('cloud-locked');"
headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST,GET'}
def api(route):
 global attempts
 if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 url=route.request.url
 if '/token?' in url:result={'access_token':'test','refresh_token':'test','expires_in':3600,'user':{'id':'20000000-0000-0000-0000-000000000001','email':'fictif@example.test'}}
 elif url.endswith('read_state'):result=core
 elif url.endswith('read_shift_calendar'):result={'revision':0,'rows':[],'imports':[]}
 elif url.endswith('read_maintenance_actions'):result=actions
 elif url.endswith('read_equipment_maintenance'):result=[]
 elif url.endswith('read_maintenance_dashboard'):result={'actions':actions,'entries':[{'id':'m1','equipment_id':'e1','date':'2026-07-09','kind':'Entretien'}]}
 elif url.endswith('postpone_maintenance_action'):
  body=route.request.post_data_json;requests.append(body);attempts+=1;assert body['w']==w and body['action_id']=='a1' and body['expected_revision']==1 and body['new_due_date']=='2027-03-31' and body['justification']=='Budget non disponible'
  if attempts==1:
   actions[0].update({'due_date':'2027-03-31','revision':2,'deferrals':[{'id':body['request_id'],'previous_due_date':'2026-12-31','new_due_date':'2027-03-31','justification':body['justification'],'declared_by':'Compte fictif','at':'2026-10-15T10:00:00Z'}]});route.fulfill(status=503,json={'message':'Réponse interrompue après enregistrement'},headers=headers);return
  assert requests[0]['request_id']==body['request_id'];result=actions[0]
 else:raise AssertionError('Unexpected API request: '+url)
 route.fulfill(json=result,headers=headers)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=browser.new_context(viewport={'width':1440,'height':1000});c.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));c.route('https://test.supabase.co/**',api);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,15,10,tzinfo=timezone.utc));page.goto('http://127.0.0.1:8000/#equipment/e1');page.locator('#loginForm [name=email]').fill('fictif@example.test');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();expect(page.locator('#detailTitle')).to_contain_text('Harnais');page.locator('#maintenanceTab').click();page.locator('[data-postpone-action]').click();f=page.locator('#actionPostponeForm');f.locator('[name=new_due_date]').fill('2027-03-31');f.locator('[name=justification]').fill('Budget non disponible');f.locator('[type=submit]').click();expect(page.locator('#actionError')).to_contain_text('Report non confirmé');expect(f.locator('[name=justification]')).to_have_value('Budget non disponible');f.locator('[type=submit]').click();expect(f).not_to_be_visible();expect(page.locator('#actionList')).to_contain_text('1 report(s) justifié(s)');assert attempts==2 and len(actions[0]['deferrals'])==1
 page.locator('#menuToggle').click();page.locator('[data-view=actionKpi]').click();page.locator('#plansKpiTab').click();expect(page.locator('#actionKpiGlobal')).to_contain_text('0 %');expect(page.locator('#actionKpiAnnualEntries')).to_have_text('1');expect(page.locator('.action-kpi-card').filter(has_text='Reports justifiés')).to_contain_text('1');assert core['revision']==7 and core['payload']['equipment'][0]['controls']==[];assert not errors,errors;browser.close()
print('PASS cloud reports/KPI : justification persistante après réponse ambiguë, reprise avec même identifiant sans doublon, lecture globale du carnet et reports, VGP intacte.')
