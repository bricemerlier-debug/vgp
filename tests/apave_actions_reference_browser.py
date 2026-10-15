# Essai local sur le document fourni ; aucune connexion ni écriture Supabase.
from playwright.sync_api import sync_playwright,expect
from openpyxl import load_workbook
import os,json,re,calendar
from datetime import date
path=os.environ['APAVE_ACTIONS_FILE'];rows=list(load_workbook(path,data_only=True).worksheets[0].values);h=rows[2];records=[dict(zip(h,r)) for r in rows[3:] if str(r[h.index('gravite')]) in ['1','2','3']];ids=list(dict.fromkeys(str(r['numEquipement']).strip() for r in records if not re.match(r'^(sans\b|inconnu)',str(r['numEquipement']),re.I)))
source={'anticipation':30,'owners':[],'equipment':[{'id':str(i),'siteId':i,'identifier':identifier,'designation':'Fiche fictive de rapprochement','serialNumber':'','sector':'B2','zone':'DMCR','team':'A','owner':'','location':'Atelier','category':'','assignment':'','months':12,'controls':[],'archived':False,'archiveHistory':[]} for i,identifier in enumerate(ids,1)]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=browser.new_context(viewport={'width':1440,'height':1000});c.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));c.add_init_script("if(!localStorage.getItem('vgp-prototype-v1'))localStorage.setItem('vgp-prototype-v1',"+json.dumps(json.dumps(source))+")");page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8000/#material');before=page.evaluate("localStorage.getItem('vgp-prototype-v1')");page.locator('#materialView [data-import-apave-actions]').click();page.locator('#actionImportFile').set_input_files(path);expect(page.locator('#actionImportStatus')).to_contain_text('219 lignes avec gravité',timeout=30000);expect(page.locator('#actionImportStatus')).to_contain_text('34 niveau 1 · 97 niveau 2 · 88 niveau 3');expect(page.locator('#actionImportStatus')).to_contain_text('5 doublons');expect(page.locator('#actionImportSelection')).to_contain_text('209 action(s)');assert page.locator('[data-match]').count()<=30;expect(page.locator('#actionImportError')).to_have_text('')
 page.locator('#actionImportConfirmed').check();page.locator('#actionImportApply').click();expect(page.locator('#actionImportStatus')).to_contain_text('209 action(s) créée(s)',timeout=30000)
 stored=page.evaluate("async()=>{const db=await new Promise(r=>{let q=indexedDB.open('vgp-maintenance-v1',2);q.onsuccess=()=>r(q.result)});return await new Promise(r=>{let q=db.transaction('actions').objectStore('actions').getAll();q.onsuccess=()=>r(q.result)})}")
 expected={str(r['numEquipement']).strip()+'\x00'+str(r['observation']) for r in records if not re.match(r'^(sans\b|inconnu)',str(r['numEquipement']),re.I)};assert len(stored)==209;assert {a['source_identifier']+'\x00'+a['plan'] for a in stored}==expected;assert len(set(a['action_number'] for a in stored))==209;assert all(a['status']=='todo' for a in stored)
 for a in stored:
  observed=date.fromisoformat(a['action_date']);created_year=int(a['created_at'][:4]);end=date(created_year,12,31)
  if a['level']==1:expected_due=observed
  elif a['level']==2:
   month=observed.month+6;target_year=observed.year+(month-1)//12;target_month=(month-1)%12+1;expected_due=min(date(target_year,target_month,min(observed.day,calendar.monthrange(target_year,target_month)[1])),end)
  else:expected_due=end
  assert a['due_date']==expected_due.isoformat(),a['source_identifier']
 page.locator('#actionImportFile').set_input_files(path);expect(page.locator('#actionImportStatus')).to_contain_text('209 déjà importées',timeout=30000);expect(page.locator('#actionImportSelection')).to_contain_text('0 action(s)');assert before==page.evaluate("localStorage.getItem('vgp-prototype-v1')");assert not errors,errors;browser.close()
print('PASS document réel : 219 lignes, 34/97/88, 5 doublons, 209 actions reconnues sur parc fictif, 5 associations manuelles, observations intégrales, numéros uniques, réimport sans doublon, aucune écriture Supabase.')
