const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage({viewport:{width:1350,height:950}});await page.route(/^https?:/,r=>r.abort());await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 const values=await page.evaluate(async()=>{
  const resolve=ASMachExcelCellTemplate.resolve;const values=['VALUE','OK_NOT_OK'].map(e=>resolve('record.evaluationMethod',{}, {evaluationMethod:e}));
  ASMachApp.state.fileName='drawing.pdf';ASMachApp.state.metadata.partNo='P:42';ASMachApp.state.annotations=[ASMachApp.normalizeAnnotation({id:'test',number:'1.1',evaluationMethod:'VALUE'})];
  const p=ASMachExcelCellTemplate.presets()[0];p.cells['5:0'].field='record.evaluationMethod';const blob=ASMachExcelCellTemplate.blob(p,ASMachApp.state);window.reportFixture=new File([blob],'test.xltx');window.previewCalls=[];window.saveCalls=[];
  ASMachDesktop={listExcelTemplates:async()=>[{id:'test.xltx',name:'Test'}],readExcelTemplate:async()=>reportFixture,excelPrintPreview:async(blob,paper,landscape)=>{previewCalls.push({blob,paper,landscape});const pdf=new jspdf.jsPDF();pdf.text('Report preview',10,10);return new Blob([pdf.output('arraybuffer')],{type:'application/pdf'});}};
  ASMachApp.saveBlob=async(blob,name,description,accept,options)=>{saveCalls.push({blob,name,options});return true;};ASMachReportCenter.open('excel');return values;
 });assert.deepEqual(values,['Değer','OK / NOT OK']);
 await page.locator('.out-select').filter({hasText:'Test'}).click();await page.waitForFunction(()=>previewCalls.length>0);
 await page.selectOption('[data-delivery=paper]','a3');await page.selectOption('[data-delivery=orientation]','landscape');await page.selectOption('[data-delivery=scale]','width');await page.selectOption('[data-delivery=naming]','part');await page.locator('[data-delivery=openAfter]').check();
 await page.locator('#reportCenter button[data-output]').click();await page.waitForFunction(()=>saveCalls.length===1);
 const saved=await page.evaluate(async()=>{const s=saveCalls[0],t=await ASMachExcelTemplateImport.read(new File([s.blob],'saved.xlsx')),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',d=new DOMParser().parseFromString(t.parts[t.sourceSheets[0].path].text,'application/xml'),setup=d.getElementsByTagNameNS(ns,'pageSetup')[0];return{name:s.name,open:s.options.openAfter,paper:setup.getAttribute('paperSize'),orientation:setup.getAttribute('orientation'),width:setup.getAttribute('fitToWidth'),height:setup.getAttribute('fitToHeight'),evaluation:d.querySelector('c[r="A6"]').textContent,preview:previewCalls.at(-1).paper};});
 assert.equal(saved.name,'P_42_Test.xlsx');assert.equal(saved.open,true);assert.equal(saved.paper,'8');assert.equal(saved.orientation,'landscape');assert.equal(saved.width,'1');assert.equal(saved.height,'0');assert.equal(saved.evaluation,'Değer');assert.equal(saved.preview,'template');
 await page.selectOption('select[aria-label="Önizleme türü"]','cells');await page.locator('.out-sheet').waitFor();
 await page.screenshot({path:'outputs/report-delivery.png'});
 console.log('PASS evaluation labels, filename sanitization, opt-in open, shared preview/export print settings, cell/print view switching');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
