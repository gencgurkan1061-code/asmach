const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1400,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.waitForFunction(()=>window.ASMachApp);
    await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=700;
      const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,1000,700);
      await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'queue.png',type:'image/png',dataUrl:canvas.toDataURL()},annotations:[]});
      window.ASMachAutoSelection=null;window.ASMachDiameterVision=null;window.ASMachGdtVision=null;
      window.queueOcrCalls=0;
      window.ASMachOCR={...ASMachOCR,recognize:async(_snapshot,options)=>{
        window.queueOcrCalls++;options.onProgress?.({status:'Test tanıma',progress:.5});
        await new Promise(resolve=>setTimeout(resolve,350));
        return {text:'20 ±0.1',confidence:95,source:'Test OCR'};
      }};
      document.getElementById('boxScanMode').value='controlled';
      document.getElementById('boxContentMode').value='dimension';
      ASMachApp.setMode('box');
    });
    const overlay=await page.locator('#overlay').boundingBox();
    async function draw(x,y){
      await page.mouse.move(overlay.x+overlay.width*x,overlay.y+overlay.height*y);
      await page.mouse.down();
      await page.mouse.move(overlay.x+overlay.width*(x+.12),overlay.y+overlay.height*(y+.08),{steps:3});
      await page.mouse.up();
    }
    await draw(.18,.2);await draw(.48,.42);
    await page.waitForFunction(()=>ASMachApp.state.boxRecognitionRunning&&ASMachApp.state.boxRecognitionQueue.length===1);
    assert.equal(await page.locator('#busyLayer').isVisible(),false,'Box OCR must not show the blocking busy layer');
    assert.equal(await page.locator('#boxOcrStatus').isVisible(),true);
    assert.ok((await page.locator('.ocr-box-preview').count())>=2,'Active and queued boxes remain visible');
    await page.screenshot({path:'outputs/box-recognition-running-preview.png'});
    await page.waitForFunction(()=>!!ASMachApp.state.controlledDraft&&ASMachApp.state.boxRecognitionQueue.length===1);
    assert.equal(await page.evaluate(()=>queueOcrCalls),1,'Controlled approval pauses the serial OCR worker');
    assert.match(await page.locator('#boxOcrStatusTitle').textContent(),/onay bekleniyor/i);
    await page.screenshot({path:'outputs/box-recognition-queue-preview.png'});
    await page.locator('#controlledDraftActions [data-accept]').click();
    await page.waitForFunction(()=>queueOcrCalls===2&&!!ASMachApp.state.controlledDraft);
    assert.equal(await page.evaluate(()=>ASMachApp.state.annotations.length),1);
    await page.locator('#controlledDraftActions [data-discard]').click();
    await page.waitForFunction(()=>!ASMachApp.state.boxRecognitionRunning&&ASMachApp.state.boxRecognitionQueue.length===0);
    assert.equal(await page.locator('#boxOcrStatus').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('PASS non-blocking serial box OCR queue pauses for each controlled approval and resumes safely');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
