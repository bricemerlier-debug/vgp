import {build} from 'esbuild';
await build({stdin:{contents:"import {readSheet as readXlsxFile} from 'read-excel-file/browser'; globalThis.VGPReadExcel=readXlsxFile;",resolveDir:process.cwd()},bundle:true,format:'iife',minify:true,outfile:'vendor/excel.js',legalComments:'eof'});
