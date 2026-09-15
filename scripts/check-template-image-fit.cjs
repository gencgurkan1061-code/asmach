const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();await page.route(/^https?:/,r=>r.abort());await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 const results=await page.evaluate(async()=>{
  const parse=s=>new DOMParser().parseFromString(s,'application/xml'),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',dr='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
  const state={metadata:{},annotations:[{...ASMachApp.parseRequirement('⌖ | Ø0.2 | A | B'),number:'1.1',page:1,classification:'critical'}]};
  const seed=await ASMachExcelTemplateImport.read(new File([ASMachExcelCellTemplate.blob(ASMachExcelCellTemplate.presets()[0],state)],'test.xltx'));
  const data=[];
  for(const field of ['record.balloonImage','record.classificationImage','record.requirement'])for(const mode of ['cell','height','width','legacy']){
   const parts=Object.fromEntries(Object.entries(seed.parts).map(([k,v])=>[k,v.text??Uint8Array.from(atob(v.base64),c=>c.charCodeAt(0))]));
   const sheet=seed.sourceSheets[0].path,token='{{'+field+(mode==='legacy'?'':'|fit='+mode)+'}}';
   parts[sheet]=`<worksheet xmlns="${ns}"><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="2" width="15" customWidth="1"/></cols><sheetData><row r="1" ht="45" customHeight="1"><c r="A1" t="inlineStr"><is><t>${token}</t></is></c></row></sheetData><mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells></worksheet>`;
   const template=await ASMachExcelTemplateImport.read(new File([ASMachWorkflow.zipStored(parts)],'sizing.xltx'));
   const parsed=template.cells['0:0'];if(parsed.field!==field||parsed.imageFit!==(mode==='legacy'?undefined:mode))throw Error('Sizing token was not loaded');
   const before=JSON.stringify(template.parts),out=ASMachExcelTemplateImport.files(template,state,false);
   const drawing=Object.entries(out).find(([k])=>/^xl\/drawings\/drawing\d+\.xml$/.test(k)),d=parse(drawing[1]),anchor=d.getElementsByTagNameNS(dr,'oneCellAnchor')[0],size=anchor.getElementsByTagNameNS(dr,'ext')[0];
   const bytes=Object.entries(out).find(([k])=>k.startsWith('xl/media/asmach-gdt-'))[1],png=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
   const width=Number(size.getAttribute('cx'))/9525,height=Number(size.getAttribute('cy'))/9525;
   data.push({field,mode,width,height,ratio:png.getUint32(16)/png.getUint32(20),unchanged:before===JSON.stringify(template.parts),rowHeight:parse(out[sheet]).getElementsByTagNameNS(ns,'row')[0].getAttribute('ht'),tokens:out[sheet].includes('{{'),valid:!d.querySelector('parsererror')});
  }
  return data;
 });
 for(const r of results){assert.ok(r.valid&&r.unchanged&&!r.tokens,JSON.stringify(r));assert.equal(r.rowHeight,'45');assert.ok(Math.abs(r.width/r.height-r.ratio)<.001);if(r.mode==='height')assert.ok(Math.abs(r.height-56)<.001);if(r.mode==='width')assert.ok(Math.abs(r.width-216)<.001);if(r.mode==='cell')assert.ok(r.width<=216.001&&r.height<=56.001);if(r.mode==='legacy')assert.ok(r.height<=16.001);}
 console.log('PASS 12 visual-field/fit combinations, merged cells, aspect ratio, token round-trip, unchanged template dimensions and legacy rendering');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
