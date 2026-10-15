import json,os,tempfile
from datetime import datetime,timezone
import openpyxl
from playwright.sync_api import sync_playwright,expect
fd,path=tempfile.mkstemp(suffix='.xlsx');os.close(fd);w=openpyxl.Workbook();w.active.title='calendrier global';w.active.append(['OCT','Date','M','S','N','A','B','C','D','E']);w.active.append(['J',datetime(2026,10,15),'B','C','D','A',None,None,None,'E']);w.save(path)
core={'revision':7,'payload':{'anticipation':30,'equipment':[],'owners':[]}};calendar={'revision':0,'rows':[],'imports':[]};writes=[];reads=0
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001'};document.documentElement.classList.add('cloud-locked');"
headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST'}
def api(route):
 global calendar,reads
 if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
 url=route.request.url
 if '/token?' in url:result={'access_token':'test','refresh_token':'test','expires_in':3600,'user':{'id':'20000000-0000-0000-0000-000000000001','email':'fictif@example.test'}}
 elif url.endswith('read_state'):result=core
 elif url.endswith('read_shift_calendar'):reads+=1;result=calendar
 elif url.endswith('import_shift_calendar'):
  body=route.request.post_data_json
  if body['expected_revision']!=calendar['revision']:route.fulfill(status=409,json={'message':'REVISION_CONFLICT : rechargez'},headers=headers);return
  writes.append(body);calendar={'revision':1,'rows':body['entries'],'imports':[{'revision':1,'imported_at':'2026-10-15T04:00:00Z','source':body['source'],'changed':5}]};result={'revision':1,'changed':5,'conflicts':0}
 else:raise AssertionError(url)
 route.fulfill(json=result,headers=headers)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);pages=[];errors=[]
 for mobile in [False,True]:
  c=b.new_context(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 1000},timezone_id='Asia/Tokyo' if mobile else 'America/New_York');c.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));c.route('https://test.supabase.co/**',api);page=c.new_page();page.clock.install(time=datetime(2026,10,15,4,tzinfo=timezone.utc));page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8000/#shiftCalendar');page.locator('#loginForm [name=email]').fill('fictif@example.test');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();expect(page.locator('#shiftCalendarTitle')).to_be_visible();expect(page.locator('#shiftCalendarStatus')).to_contain_text('0 jour(s)');page.locator('#shiftOpenImport').click();page.locator('#shiftImportFile').set_input_files(path);expect(page.locator('#shiftImportStatus')).to_contain_text('1 jours');page.locator('#shiftImportConfirmed').check();pages.append(page)
 assert writes==[]
 first,second=pages;first.once('dialog',lambda d:d.accept());first.locator('#shiftImportApply').click();expect(first.locator('#shiftImportStatus')).to_contain_text('Planning enregistré');assert len(writes)==1;assert len(writes[0]['entries'])==5;assert writes[0]['source']['sheet']=='calendrier global';assert 'base64' not in json.dumps(writes)
 second.once('dialog',lambda d:d.accept());second.locator('#shiftImportApply').click();expect(second.locator('#shiftImportError')).to_contain_text('REVISION_CONFLICT');assert len(writes)==1;second.locator('#shiftImportAnalyze').click();expect(second.locator('#shiftImportStatus')).to_contain_text('déjà présent');expect(second.locator('#shiftImportApply')).to_be_disabled()
 for page in pages:
  page.locator('#shiftImportClose').click();expect(page.locator('#shiftCurrentContent .shift-live-team')).to_have_text('Équipe B');expect(page.locator('#shiftCurrentContent')).to_contain_text('05:00–13:00');assert page.evaluate('document.documentElement.scrollWidth')==page.viewport_size['width']
 assert core['revision']==7 and core['payload']['equipment']==[];assert not errors,errors;b.close()
os.unlink(path)
print('PASS planning cloud simulé : deux appareils/fuseaux cohérents, import sans classeur transmis, conflit concurrent bloqué, doublon après relecture et parc VGP intact.')
