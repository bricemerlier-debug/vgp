from playwright.sync_api import sync_playwright,expect
from datetime import datetime,timezone
import io,json
from PIL import Image
w='10000000-0000-0000-0000-000000000001';core={'revision':7,'payload':{'anticipation':30,'owners':[],'equipment':[{'id':'e1','siteId':1,'identifier':'FICTIF','designation':'Harnais','serialNumber':'','sector':'B2','zone':'DMCR','team':'A','owner':'','location':'Atelier','category':'','assignment':'','months':12,'controls':[],'archived':False,'archiveHistory':[]}]}}
entries=[];uploads=[];signed=[];attempts=0
image=Image.new('RGB',(400,300),'orange');buffer=io.BytesIO();image.save(buffer,format='PNG');png=buffer.getvalue()
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'"+w+"'};document.documentElement.classList.add('cloud-locked');"
headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type,x-upsert','Access-Control-Allow-Methods':'POST,GET'}
def api(route):
 global attempts
 if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 url=route.request.url
 if '/token?' in url:result={'access_token':'test','refresh_token':'test','expires_in':3600,'user':{'id':'20000000-0000-0000-0000-000000000001','email':'fictif@example.test'}}
 elif url.endswith('read_state'):result=core
 elif url.endswith('read_shift_calendar'):result={'revision':0,'rows':[],'imports':[]}
 elif url.endswith('read_maintenance_actions'):result=[]
 elif url.endswith('read_equipment_maintenance'):result=entries
 elif '/storage/v1/object/sign/equipment-maintenance/' in url:
  if route.request.method=='POST':
   assert route.request.post_data_json=={'expiresIn':120};signed.append(url);result={'signedURL':'/object/sign/equipment-maintenance/'+uploads[0]+'?token=fictif'}
  else:route.fulfill(body=png,content_type='image/png',headers=headers);return
 elif '/storage/v1/object/equipment-maintenance/' in url:
  path=url.split('/equipment-maintenance/')[1];assert path.startswith(w+'/') and path.endswith('.jpg');assert route.request.headers['content-type']=='image/jpeg';assert route.request.post_data_buffer[:2]==b'\xff\xd8';assert route.request.headers['x-upsert']=='false'
  if path not in uploads:uploads.append(path)
  result={'Key':path}
 elif url.endswith('add_equipment_maintenance'):
  entry=route.request.post_data_json['entry'];assert entry['photo_path']==uploads[0];assert 'base64' not in json.dumps(entry);attempts+=1
  if not entries:entries.append({**entry,'created_at':'2026-10-15T10:00:00Z','entered_by':'Compte fictif'})
  if attempts==1:route.fulfill(status=503,json={'message':'Réponse interrompue après enregistrement'},headers=headers);return
  result=entries[0]
 else:raise AssertionError('Unexpected API request: '+url)
 route.fulfill(json=result,headers=headers)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=browser.new_context(viewport={'width':1440,'height':1000});c.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));c.route('https://test.supabase.co/**',api);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,15,10,tzinfo=timezone.utc));page.goto('http://127.0.0.1:8000/#equipment/e1');page.locator('#loginForm [name=email]').fill('fictif@example.test');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();expect(page.locator('#detailTitle')).to_contain_text('Harnais')
 page.locator('#maintenanceTab').click();page.locator('#maintenanceAdd').click();page.locator('#maintenanceForm [name=comment]').fill('Réparation fictive conservée exactement.');page.locator('#maintenancePhoto').set_input_files({'name':'test.png','mimeType':'image/png','buffer':png});expect(page.locator('#maintenancePhotoPreview')).to_be_visible();page.locator('#maintenanceSave').click();expect(page.locator('#maintenanceError')).to_contain_text('non confirmé');expect(page.locator('#maintenanceForm [name=comment]')).to_have_value('Réparation fictive conservée exactement.');assert len(entries)==1
 # Retry after an ambiguous response keeps the same entry/photo IDs and does not duplicate.
 page.locator('#maintenanceSave').click();expect(page.locator('#maintenanceStatus')).to_contain_text('Intervention enregistrée');assert attempts==2 and len(uploads)==1 and len(entries)==1;page.locator('[data-maintenance-photo]').click();expect(page.locator('.maintenance-entry img')).to_be_visible();assert len(signed)==1;page.reload();page.locator('#maintenanceTab').click();expect(page.locator('.maintenance-entry')).to_contain_text('Réparation fictive');assert core['revision']==7 and core['payload']['equipment'][0]['controls']==[];assert not errors,errors;browser.close()
print('PASS carnet cloud simulé : photo JPEG privée, URL temporaire, réponse ambiguë/reprise sans doublon, historique conservé et aucun contrôle/statut/échéance modifié.')
