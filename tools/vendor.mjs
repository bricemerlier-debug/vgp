import {build} from 'esbuild';
await build({stdin:{contents:"import {readSheet as readXlsxFile} from 'read-excel-file/browser'; globalThis.VGPReadExcel=readXlsxFile;",resolveDir:process.cwd()},bundle:true,format:'iife',minify:true,outfile:'vendor/excel.js',legalComments:'eof'});
await build({stdin:{contents:"import {workbookBytes} from './tools/xlsx-output.mjs';globalThis.VGPWorkbookBytes=workbookBytes;",resolveDir:process.cwd()},bundle:true,format:'iife',minify:true,outfile:'vendor/xlsx-output.js',legalComments:'eof'});
