from playwright.sync_api import sync_playwright,expect
import json,zipfile,io
from xml.sax.saxutils import escape

def workbook():
 headers=['Site','Service','Nom','ID','N° interne','N° de série','Type','Fréquence','Date du dernier contrôle','Echéance','Catégorie','Remarques éventuelles']
 def row(n,number,kind='Réglementaire',frequency='1 année'):return ['Site fictif','Atelier fictif','Anneau fictif '+str(n),str(n),number,'SERIE-FICTIVE-'+str(n),kind,frequency,'2026-01-01','2027-01-01','Secteur B2 - cuisson','Observation fictive conservée']
 rows=[headers,row(1,'IMPORT-FICTIF-1'),row(1,'IMPORT-FICTIF-1','Niveau 1','1 mois'),row(2,''),row(3,'IMPORT-FICTIF-3')]
 sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join('<row r="%d">'%(i+1)+''.join('<c r="%s%d" t="inlineStr"><is><t>%s</t></is></c>'%(chr(65+j),i+1,escape(v)) for j,v in enumerate(row))+'</row>' for i,row in enumerate(rows))+'</sheetData></worksheet>'
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w') as z:
  z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
  z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Export fictif" sheetId="1" r:id="rId1"/></sheets></workbook>')
  z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
  z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');z.writestr('xl/worksheets/sheet1.xml',sheet)
 return {'name':'export-fictif.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':out.getvalue()}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.goto('http://127.0.0.1:8000/prototype-vgp.html#material')
 before=json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')")) if page.evaluate("localStorage.getItem('vgp-prototype-v1')") else None
 page.locator('#settingsToggle').click();page.locator('#dataSettings').click();page.locator('#legacyImportTools > summary').click();page.locator('#excelFile').set_input_files(workbook());expect(page.locator('#excelPreview')).to_contain_text('4 lignes source regroupées en 3 fiches');expect(page.locator('#excelPreview')).to_contain_text('2 ajouts possibles');expect(page.locator('#excelApply')).to_be_disabled();page.locator('#excelPartial').check();expect(page.locator('#excelApply')).to_be_enabled();page.locator('#excelApply').click();expect(page.locator('#dataStatus')).to_contain_text('Équipements ajoutés')
 data=json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"));imported=[e for e in data['equipment'] if e['identifier'].startswith('IMPORT-FICTIF')];assert len(imported)==2
 for e in imported:assert e['controls']==[] and not e['periodicityValidation']['validated'] and not e['dateValidation']['validated']
 assert len(imported[0]['sourceImport']['sourceLines'])==2 and imported[0]['sourceImport']['sourceLines'][1]['fields']['Type']=='Niveau 1'
 page.locator('#excelFile').set_input_files(workbook());expect(page.locator('#excelPreview')).to_contain_text('0 ajouts possibles');expect(page.locator('#excelPreview')).to_contain_text('2 doublons ignorés');expect(page.locator('#excelApply')).to_be_disabled()
 page.locator('#dataDialog [data-close]').click();page.reload();page.locator('#list tbody tr').filter(has_text='IMPORT-FICTIF-1').get_by_role('button',name='Ouvrir',exact=True).click();expect(page.locator('#detailContent')).to_contain_text('Situation à vérifier');expect(page.locator('#detailContent')).to_contain_text('2 lignes conservées');expect(page.locator('#detailContent')).to_contain_text('Informations conservées de l’import Excel');assert not errors,errors;b.close()
 print('PASS : XLSX fictif réel, regroupement par ID, import partiel explicite, aucun faux contrôle, dates et sources conservées, réimport sans doublon, fiche et persistance.')
