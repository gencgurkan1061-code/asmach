'use strict';
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:900}});
    await page.route(/^https?:/,route=>route.abort());
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.waitForFunction(()=>window.ASMachApp);
    await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=700;await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'measurement.png',type:'image/png',dataUrl:canvas.toDataURL()},annotations:[]});});
    await page.locator('#overlay').click({button:'right',position:{x:30,y:30}});
    const submenu=page.locator('#qtDrawingMenu .qt-submenu-host');
    assert.equal(await submenu.count(),1);
    await submenu.locator(':scope > button').click();
    await submenu.getByRole('menuitemradio',{name:'Diş',exact:true}).click();
    assert.equal(await page.locator('#boxContentMode').inputValue(),'dimension');
    assert.equal(await page.locator('#boxMeasurementType').inputValue(),'Diş');
    await page.locator('#overlay').click({button:'right',position:{x:30,y:30}});
    assert.equal(await submenu.locator('[role="menuitemradio"]').filter({hasText:'Diş'}).first().getAttribute('aria-checked'),'true');
    await submenu.locator(':scope > button').focus();
    await page.keyboard.press('ArrowRight');
    await submenu.getByRole('menuitemradio',{name:'Otomatik tür seçimi'}).click();
    assert.equal(await page.locator('#boxMeasurementType').inputValue(),'');
    console.log('PASS: right-click measurement submenu, selected type and automatic reset.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
