from playwright.sync_api import sync_playwright,expect
from PIL import Image
import io,json,os

workspace='10000000-0000-0000-0000-000000000001'
equipment_id='equipment-photo-test'
state={'revision':8,'role':'editor','payload':{'anticipation':30,'owners':['Responsable Test'],'equipment':[{'id':equipment_id,'siteId':1,'identifier':'PHOTO-VGP-001','designation':'Anneau de test','serialNumber':'','sector':'B2','zone':'','team':'A','owner':'Responsable Test','location':'Atelier','category':'','assignment':'','months':12,'firstControlDate':'2026-11-21','controls':[],'archived':False,'archiveHistory':[]}]}}
config=f"window.VGP_CLOUD={{enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'{workspace}'}};document.documentElement.classList.add('cloud-locked');"
picture=Image.new('RGB',(1600,1100),'#0057a8');buffer=io.BytesIO();picture.save(buffer,format='PNG');png=buffer.getvalue()
paths={'current':None,'uploaded':[],'deleted':[],'body':None}
headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type,x-upsert','Access-Control-Allow-Methods':'POST,GET,DELETE'}

def api(route):
 url=route.request.url;method=route.request.method
 if method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 if '/token?' in url:result={'access_token':'test','refresh_token':'test','expires_in':3600,'user':{'id':'20000000-0000-0000-0000-000000000001','email':'test@example.fr'}}
 elif url.endswith('/rpc/read_state'):result=state
 elif url.endswith('/rpc/tracking_ready'):result=True
 elif url.endswith('/rpc/read_shift_calendar'):result={'revision':0,'rows':[],'imports':[]}
 elif '/rest/v1/equipment_photos?' in url:result=[{'photo_path':paths['current']}] if paths['current'] else []
 elif url.endswith('/rpc/set_equipment_photo'):
  request=route.request.post_data_json;assert request['w']==workspace and request['equipment_id']==equipment_id
  previous=paths['current'];paths['current']=request['photo_path'];result={'path':paths['current'],'previousPath':previous}
 elif '/storage/v1/object/sign/equipment-photos/' in url:
  if method=='POST':result={'signedURL':'/object/sign/equipment-photos/'+paths['current']+'?token=fictif'}
  else:route.fulfill(body=paths['body'],content_type='image/jpeg',headers=headers);return
 elif '/storage/v1/object/equipment-photos/' in url:
  path=url.split('/equipment-photos/',1)[1]
  if method=='POST':
   assert route.request.headers['content-type']=='image/jpeg'
   assert route.request.post_data_buffer[:2]==b'\xff\xd8' and len(route.request.post_data_buffer)<=200*1024
   paths['uploaded'].append(path);paths['body']=route.request.post_data_buffer;result={'Key':path}
  elif method=='DELETE':paths['deleted'].append(path);result={}
  else:raise AssertionError('Méthode de stockage inattendue '+method)
 else:result=None
 route.fulfill(json=result,headers=headers)

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':900});page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('**/cloud-config.js',lambda route:route.fulfill(body=config,content_type='text/javascript'))
 page.route('https://test.supabase.co/**',api)
 base='http://127.0.0.1:'+os.environ.get('VGP_TEST_PORT','8000')
 page.goto(base+'/#material');page.locator('#loginForm [name=email]').fill('test@example.fr');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click()
 page.locator('[data-open="'+equipment_id+'"]').click();page.locator('#equipmentPhotoInput').set_input_files({'name':'photo.png','mimeType':'image/png','buffer':png})
 expect(page.locator('#equipmentPhotoStatus')).to_have_text('Photo enregistrée.')
 expect(page.locator('#equipmentPhotoImage')).to_be_visible()
 assert paths['current']==paths['uploaded'][0] and state['revision']==8
 page.goto(base+'/#mailSettings');page.locator('#mailSampleEquipment').select_option(equipment_id)
 expect(page.frame_locator('#mailSettingsPreview').get_by_alt_text('Photo du matériel PHOTO-VGP-001')).to_be_visible()
 page.goto(base+'/#equipment/'+equipment_id);page.locator('#equipmentPhotoRemove').click()
 expect(page.locator('#equipmentPhotoStatus')).to_have_text('Photo retirée.')
 assert paths['current'] is None and paths['deleted']==paths['uploaded'] and state['revision']==8
 assert not errors,errors
 browser.close()
print('PASS photo VGP cloud simulé : stockage privé, fiche, mail et retrait sans écriture globale.')
