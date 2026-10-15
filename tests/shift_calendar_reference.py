# Private workbook and independently checked expectations stay outside the public repository.
# python tests/shift_calendar_reference.py /private/calendar.xlsm /private/expected.json
import sys,json
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright,expect
expected=json.load(open(sys.argv[2]))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844},timezone_id='America/Los_Angeles');errors=[];outside=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:outside.append(r.url) if not r.url.startswith(('http://127.0.0.1:8000/','blob:','data:')) else None);page.clock.install(time=datetime(2026,10,15,4,tzinfo=timezone.utc));page.goto('http://127.0.0.1:8000/prototype-vgp.html#shiftCalendar');gear=page.evaluate('localStorage.getItem("vgp-prototype-v1")');page.locator('#shiftOpenImport').click();page.locator('#shiftImportFile').set_input_files(sys.argv[1]);expect(page.locator('#shiftImportStatus')).to_contain_text(str(expected['days'])+' jours',timeout=30000)
 parsed=page.evaluate("async()=>{const m=await import('./shift-calendar.mjs');const grid=await VGPReadExcel(document.querySelector('#shiftImportFile').files[0],'calendrier global');return m.parseShiftGlobal(grid);}")
 for k in ['days','unknown','from','to']:assert parsed[k]==expected[k],(k,parsed[k],expected[k])
 assert len(parsed['rows'])==expected['rows'];assert len(parsed['warnings'])==expected['warnings'];index={r['date']+'|'+r['team']:r['code'] for r in parsed['rows']}
 for date,teams in expected['samples'].items():
  for team,code in teams.items():assert index[date+'|'+team]==code,(date,team,index[date+'|'+team],code)
 assert all(r['date']>=expected['from'] and r['date']<=expected['to'] for r in parsed['rows']);assert len(index)==len(parsed['rows']);assert page.evaluate('localStorage.getItem("vgp-shift-calendar-v1")') is None;assert page.evaluate('localStorage.getItem("vgp-prototype-v1")')==gear;assert page.evaluate('document.documentElement.scrollWidth')==390;assert not outside,outside;assert not errors,errors;b.close()
print('PASS classeur réel : feuille globale seulement, dates et affectations de référence, vides et CP/JF, aperçu mobile, aucune requête externe ou écriture Supabase.')
