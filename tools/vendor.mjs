import {build} from 'esbuild';
await build({stdin:{contents:"import {readSheet as readXlsxFile} from 'read-excel-file/browser'; globalThis.VGPReadExcel=readXlsxFile;",resolveDir:process.cwd()},bundle:true,format:'iife',minify:true,outfile:'vendor/excel.js',legalComments:'eof'});
await build({stdin:{contents:"import {workbookBytes} from './tools/xlsx-output.mjs';globalThis.VGPWorkbookBytes=workbookBytes;",resolveDir:process.cwd()},bundle:true,format:'iife',minify:true,outfile:'vendor/xlsx-output.js',legalComments:'eof'});
await build({stdin:{contents:"import {fillContainerReportPptx} from './tools/container-report-pptx.mjs';globalThis.VGPFillContainerReportPptx=fillContainerReportPptx;",resolveDir:process.cwd()},bundle:true,format:'iife',minify:true,outfile:'vendor/container-report-pptx.js',legalComments:'eof'});

import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('vendor/pdfjs',{recursive:true});
for(const name of ['pdf.min.mjs','pdf.worker.min.mjs'])await copyFile('node_modules/pdfjs-dist/build/'+name,'vendor/pdfjs/'+name);
await copyFile('node_modules/pdfjs-dist/LICENSE','vendor/pdfjs/LICENSE');
