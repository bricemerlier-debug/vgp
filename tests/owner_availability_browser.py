"""Planning et matériel fictifs dans le navigateur, sans accès à la production."""
import os
from pathlib import Path
exec((Path(__file__).with_name('workspace_paths_browser.py')).read_text().split('with sync_playwright() as p:')[0])
source['owners']=['Alice','Bob'];source['ownerContacts']=[{'owner':'Alice','email':'','team':'B'}]
source['equipment'][0].update(owner='Alice',team='A',firstControlDate='2026-10-15')
source['equipment'][2].update(owner='Bob',team='',firstControlDate='2026-10-15')
source['equipment'].append(gear(4,'SANS-AFFECTATION','Pas de secteur'));source['equipment'][-1].update(team='Pas d’équipe',firstControlDate='2026-10-15')
planning={'revision':1,'rows':[{'date':'2026-10-15','team':'B','code':'M','sourceCell':'A1'},{'date':'2026-10-16','team':'B','code':'S','sourceCell':'A2'}],'imports':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.clock.install(time=datetime(2026,10,15,6,tzinfo=timezone.utc))
 page.add_init_script('if(!localStorage.getItem("vgp-prototype-v1")){localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');localStorage.setItem("vgp-shift-calendar-v1",'+json.dumps(json.dumps(planning))+');}')
 page.route('**/cloud-config.js',lambda route:route.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'))
 page.goto('http://127.0.0.1:8000/'+('index.html' if os.getenv('VGP_TEST_MODULE') else 'prototype-vgp.html')+'#planning')
 card=page.locator('#weeklyCalendar [data-calendar-equipment="1"]');expect(card).to_contain_text('Alice · Équipe B');expect(card).to_contain_text('Présent en même temps aujourd’hui');expect(card).to_contain_text('8 h–13 h')
 expect(page.locator('#weeklyCalendar [data-calendar-equipment="3"] [data-owner-presence]')).to_be_hidden()
 expect(card.locator('.calendar-owner')).to_have_text('Propriétaire : Alice')
 expect(page.locator('#weeklyCalendar [data-calendar-equipment="3"] .calendar-assignment')).not_to_contain_text('Équipe')
 expect(page.locator('#weeklyCalendar [data-calendar-equipment="4"] .calendar-owner')).to_have_count(0)
 expect(page.locator('#weeklyCalendar [data-calendar-equipment="4"] .calendar-assignment')).to_have_count(0)
 expect(page.locator('#weeklyCalendar [data-calendar-equipment="3"] .calendar-owner')).to_have_text('Propriétaire : Bob')
 expect(page.locator('#homeWeeklyCalendar [data-calendar-equipment="3"] .calendar-owner')).to_have_text('Propriétaire : Bob')
 card.click();expect(page.locator('#detailContent [data-owner-presence]')).to_contain_text('Alice · Équipe B')
 # Le changement de créneau actualise le texte sans fermer un formulaire ouvert.
 page.locator('#edit').click();page.clock.fast_forward(5*60*60*1000);expect(page.locator('#editor')).to_be_visible();expect(page.locator('#detailContent [data-owner-presence]')).to_contain_text('16/10');expect(page.locator('#detailContent [data-owner-presence]')).to_contain_text('13 h–17 h');page.locator('[data-close=editor]').click()
 planning.update(revision=2,rows=[])
 page.evaluate('(state)=>{localStorage.setItem("vgp-shift-calendar-v1",JSON.stringify(state));window.dispatchEvent(new StorageEvent("storage",{key:"vgp-shift-calendar-v1"}));}',planning)
 expect(page.locator('#detailContent [data-owner-presence]')).to_contain_text('Aucun créneau commun renseigné')
 assert page.evaluate('document.documentElement.scrollWidth')==390
 saved=json.loads(page.evaluate('localStorage.getItem("vgp-prototype-v1")'));assert saved==source;assert not errors,errors;b.close()
print('PASS présences : agenda et fiche, équipe propriétaire prioritaire, sans équipe masqué, actualisation sans fermer la saisie, mobile et aucune écriture métier.')
