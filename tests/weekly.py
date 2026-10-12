from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/prototype-vgp.html');today=page.evaluate("(()=>{let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})()")
 page.get_by_role('button',name='+ Ajouter un équipement').click();f=page.locator('#equipmentForm');f.locator('[name=identifier]').fill('SEMAINE-001');f.locator('[name=designation]').fill('Anneau semaine');page.get_by_role('button',name='Date manuelle du prochain contrôle').click();f.locator('[name=manualNextControlDate]').fill(today);f.get_by_role('button',name='Enregistrer l’équipement').click()
 expect(page.locator('#weeklyCalendar .calendar-task')).to_have_count(1);assert 'Anneau semaine' in page.locator('#weeklyCalendar').inner_text()
 before=page.locator('#notificationCount').inner_text();page.get_by_role('button',name='Semaine suivante').click();expect(page.locator('#weeklyCalendar .calendar-task')).to_have_count(0);page.get_by_role('button',name='Cette semaine',exact=True).click();expect(page.locator('#weeklyCalendar .calendar-task')).to_have_count(1)
 page.locator('#notificationToggle').click();item=page.locator('#notificationList .notification-item').filter(has_text='SEMAINE-001');expect(item).to_be_visible();item.click();expect(page.locator('#notificationMenu')).not_to_be_visible();assert 'SEMAINE-001' in page.locator('#detailTitle').inner_text()
 page.get_by_role('button',name='+ Enregistrer un contrôle').click();c=page.locator('#controlForm');c.locator('[name=intervenant]').fill('Vérificateur semaine');c.locator('[name=result]').select_option('Bon état');c.get_by_role('button',name='Enregistrer le contrôle',exact=True).click();expect(page.locator('#control')).not_to_be_visible();page.locator('#detail [data-close]').click()
 assert int(page.locator('#notificationCount').inner_text())==int(before)-1;expect(page.locator('#weeklyCalendar .calendar-done')).to_have_count(1)
 page.locator('#notificationToggle').click();expect(page.locator('#notificationList .notification-item').filter(has_text='SEMAINE-001')).to_have_count(0);page.locator('#notificationMenu [data-close]').click();page.reload();expect(page.locator('#weeklyCalendar .calendar-done')).to_have_count(1)
 page.set_viewport_size({'width':390,'height':844});assert page.locator('body').evaluate('(e)=>e.scrollWidth<=window.innerWidth')
 assert not errors,errors;b.close();print('PASS: calendrier semaine, navigation, notification vers fiche, disparition après contrôle, VGP réalisée conservée, persistance et mobile')
