from playwright.sync_api import sync_playwright,expect
import io,zipfile,json
from xml.sax.saxutils import escape

def fixture():
 rows=[['Nom','Numéro interne','N° de série','ID','Date de mise en service','Catégorie','Localisation'],['Nom fictif','FICTIF-1','SERIE-1','1','01/01/2020','Secteur B2 - Cuisson','Atelier fictif'],['Numéro absent','','SERIE-2','2','01/01/2020','Atelier Central','']]
 sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join('<row r="%d">'%(i+1)+''.join('<c r="%s%d" t="inlineStr"><is><t>%s</t></is></c>'%(chr(65+j),i+1,escape(v)) for j,v in enumerate(row))+'</row>' for i,row in enumerate(rows))+'</sheetData></worksheet>'
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w') as z:
  z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
  z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Fictif" sheetId="1" r:id="rId1"/></sheets></workbook>')
  z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
  z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');z.writestr('xl/worksheets/sheet1.xml',sheet)
 return {'name':'export-fictif.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':out.getvalue()}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append((r.method,r.url)));page.goto('http://127.0.0.1:8000/conversion-excel.html');expect(page.locator('#conversionDownload')).to_be_disabled();before=len(requests);page.locator('#conversionFile').set_input_files(fixture());expect(page.locator('#conversionStatus')).to_contain_text('2 équipements : 1 fiches importables, 1 fiches à corriger')
 with page.expect_download() as info:page.locator('#conversionDownload').click()
 download=info.value;assert download.suggested_filename=='Import_VGP_MemoryFlow.xlsx';assert download.failure() is None
 with zipfile.ZipFile(download.path()) as z:assert b'FICTIF-1' in z.read('xl/worksheets/sheet1.xml');assert b'Num' in z.read('xl/worksheets/sheet2.xml')
 assert len(requests)==before,'La sélection/conversion ne doit déclencher aucune requête réseau';assert not errors,errors;assert page.evaluate('document.documentElement.scrollWidth')==390;b.close()
 print('PASS : fichier Excel téléchargé réellement par le navigateur, sans upload ni requête Supabase, correction séparée, mobile et absence d’erreur JS.')
