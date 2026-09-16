'use strict';
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=800;canvas.height=500;
      const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,800,500);context.fillStyle='black';context.font='28px Arial';context.fillText('M12x1.25-6H',240,210);
      const parsed=ASMachApp.parseRequirement('M12x1.25-6H');
      await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'requirement-fixture.png',type:'image/png',dataUrl:canvas.toDataURL()},annotations:[{id:'test',number:'1',page:1,...parsed,ocrText:'M12x1.25-6H',requirementMode:'auto',selectionBox:{x:.28,y:.34,w:.3,h:.08},anchorX:.4,anchorY:.4,bubbleX:.23,bubbleY:.4}]});
      ASMachApp.state.selectedId='test';ASMachApp.renderAll();
      window.ASMachMessages={...ASMachMessages,confirm:async()=>true};
    });
    const record=()=>page.evaluate(()=>JSON.parse(JSON.stringify(ASMachApp.selectedAnnotation())));
    const rich=id=>page.locator('.gt-editor:has(+ #'+id+') .gt-rich');
    const field=async(id,value)=>{if(await page.locator('#'+id).isHidden()){await rich(id).fill(value);await rich(id).press('Tab');}else{await page.locator('#'+id).fill(value);await page.locator('#'+id).dispatchEvent('change');}};
    await field('requirement','Müşteri kabul notu');assert.equal((await record()).requirementMode,'manual');
    await field('cwExtra_threadPitch','2');let current=await record();assert.equal(current.requirementMode,'auto');assert.match(current.requirement,/M12(?:\.0+)? × 2/);assert.match(current.requirement,/6H/);
    await page.locator('#characteristicType').selectOption('Çap');await page.waitForFunction(()=>ASMachApp.selectedAnnotation().type==='Çap');
    current=await record();assert.equal(current.threadClass,'');assert.equal(current.threadPitch,'');assert.match(current.requirement,/Ø12/);
    await field('nominalValue','15');await page.waitForFunction(()=>ASMachApp.selectedAnnotation().nominalValue==='15');
    await field('lowerTolerance','-0.1');await page.waitForFunction(()=>ASMachApp.selectedAnnotation().lowerTolerance==='-0.1');
    await field('upperTolerance','0.2');await page.waitForFunction(()=>ASMachApp.selectedAnnotation().upperTolerance==='0.2');
    current=await record();assert.match(current.requirement,/Ø15/);assert.match(current.requirement,/\+0.2/);assert.match(current.requirement,/-0.1/);
    assert.equal(await page.locator('#requirement').inputValue(),current.requirement);
    if(await page.locator('#ipSourcePane').isHidden())await page.locator('#cwSourceToggle').click();
    await rich('ciOcrText').fill('Ra 3.2');await page.waitForFunction(()=>ASMachApp.selectedAnnotation().type==='Yüzey'&&ASMachApp.selectedAnnotation().nominalValue==='3.2');
    await field('cwExtra_specialDesignator','Rz');current=await record();assert.match(current.requirement,/Rz 3.2/);
    const valid=current.requirement;await rich('ciOcrText').fill('unreadable');
    await page.waitForFunction(()=>document.querySelector('.ci-ocr [role=status]').textContent.includes('korundu'));
    assert.equal((await record()).requirement,valid);assert.equal((await record()).nominalValue,'3.2');
    await rich('ciOcrText').fill('M10x1.5-6g');await page.waitForFunction(()=>ASMachApp.selectedAnnotation().type==='Diş'&&ASMachApp.selectedAnnotation().nominalValue==='10');
    await field('cwExtra_threadClass','6H');assert.match((await record()).requirement,/6H/);
    await page.locator('#cwCalloutFields > summary').click();await page.locator('[data-callout=through]').check();assert.match((await record()).requirement,/THRU/);
    current=await record();await page.evaluate(()=>{const r=ASMachApp.selectedAnnotation();Object.assign(r,ASMachApp.normalizeAnnotation(JSON.parse(JSON.stringify(r))));ASMachApp.renderAll();});
    assert.equal((await record()).requirement,current.requirement);assert.equal(await page.locator('#requirement').inputValue(),current.requirement);
    await page.screenshot({path:'outputs/requirement-edit-sync.png'});
    assert.deepEqual(errors,[]);console.log('PASS browser OCR, type, nominal, asymmetric tolerances, surface parameter, thread pitch/class and depth/through edits synchronize requirement; invalid OCR preserves fields; saved record roundtrip stable');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
