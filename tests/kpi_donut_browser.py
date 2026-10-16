from pathlib import Path
exec((Path(__file__).with_name('workspace_paths_browser.py')).read_text().split('with sync_playwright() as p:')[0])
source['equipment']=[gear(1,'LATE'),gear(2,'CURRENT'),gear(3,'UNKNOWN'),gear(4,'ARCHIVE',archive=True)]
source['equipment'][0]['firstControlDate']='2026-10-01';source['equipment'][1]['firstControlDate']='2027-01-01';source['equipment'][2]['needsReverification']=True
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for path in ['/#kpi','/prototype-vgp.html#kpi']:
  page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,16,10,tzinfo=timezone.utc));page.route('**/cloud-config.js',lambda r:r.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'));page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000'+path)
  arc=page.locator('.donut-remaining');expect(arc).to_have_attribute('aria-label','67 % manquants : voir les 2 équipements');arc.focus();arc.press('Enter');expect(page.locator('#kpiListDialog')).to_be_visible();expect(page.locator('#kpiListContent')).to_contain_text('LATE');expect(page.locator('#kpiListContent')).to_contain_text('UNKNOWN');expect(page.locator('#kpiListContent')).not_to_contain_text('CURRENT');expect(page.locator('#kpiListContent')).not_to_contain_text('ARCHIVE');page.keyboard.press('Escape');page.locator('.donut-center').click();expect(page.locator('#kpiListContent')).to_contain_text('CURRENT');expect(page.locator('#kpiListContent')).not_to_contain_text('LATE');assert not errors,errors;assert json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'))==source;page.close()
 b.close()
print('PASS secteurs du donut : manquants = retard + inconnus, archives exclues ; centre à jour conservé, clavier, mobile, module et autonome, aucune écriture.')
