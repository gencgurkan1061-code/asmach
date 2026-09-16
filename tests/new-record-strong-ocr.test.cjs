const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('new records default to strong OCR and the Edit ribbon saves the choice',async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1700,height:950}});
  await page.goto(pathToFileURL(path.resolve(__dirname,'..','ASMach_Teknik_Resim_Balonlama.html')).href);
  await page.evaluate(()=>{const app=window.ASMachApp;app.state.fileData='fixture';app.state.fileName='test.png';app.elements.sourceCanvas.width=1000;app.elements.sourceCanvas.height=700;app.renderAll();});
  await page.locator('#rbTab-format').click();
  const setting=page.locator('#rd-newRecordOcrMode');
  assert.equal(await setting.isVisible(),true);
  assert.equal(await setting.inputValue(),'strong');
  await setting.selectOption('auto');
  assert.equal(await page.evaluate(()=>ASMachApp.state.metadata.projectDefaults.newRecordOcrMode),'auto');
  await setting.selectOption('strong');
  assert.equal(await page.evaluate(()=>ASMachApp.state.metadata.projectDefaults.newRecordOcrMode),'strong');
  const ocr=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=260;canvas.height=85;
   const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,260,85);context.fillStyle='black';context.font='48px Arial';context.fillText('26',25,58);
   const enhancement=window.ASMachOcrEnhancement,original=enhancement.process,passes=[];
   enhancement.process=(image,mode)=>{passes.push(mode);return original(image,mode);};
   try{const result=await window.ASMachOCR.recognize(canvas,{enhancement:'strong',skipSymbolVerification:true,skipGdt:true});return{first:passes[0],error:result.error||''};}
   finally{enhancement.process=original;await window.ASMachOCR.terminate();}
  });
  assert.equal(ocr.first,'strong');
  assert.equal(ocr.error,'');
 }finally{await browser.close();}
});
