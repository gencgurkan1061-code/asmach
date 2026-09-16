const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=500;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,800,500);g.fillStyle='black';g.font='28px Arial';g.fillText('M12x1.25-6H',240,210);const parsed=ASMachApp.parseRequirement('M12x1.25-6H');await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'thread.png',type:'image/png',dataUrl:c.toDataURL()},annotations:[{id:'thread',number:'58',page:1,...parsed,ocrText:'M12x1.25-6H',requirement:'M12 × 1.25-6H',selectionBox:{x:.28,y:.34,w:.3,h:.08},anchorX:.4,anchorY:.4,bubbleX:.23,bubbleY:.4}]});ASMachApp.state.selectedId='thread';ASMachApp.renderAll();});
 const standard=page.locator('#cwExtra_threadStandard');assert.equal(await standard.isVisible(),true);assert.equal(await standard.inputValue(),'ISO 261 / ISO 965-1');assert.equal(await page.evaluate(()=>ASMachApp.selectedAnnotation().threadStandard),'ISO 261 / ISO 965-1');
 assert.equal(await standard.evaluate(n=>n.tagName),'SELECT');assert.equal(await standard.getAttribute('list'),null);assert.equal(await page.locator('#cwThreadStandards').count(),0);
 await standard.selectOption('ISO 261');assert.equal(await page.evaluate(()=>ASMachApp.selectedAnnotation().threadStandard),'ISO 261');
 await standard.selectOption('');assert.equal(await page.evaluate(()=>ASMachApp.selectedAnnotation().threadStandard),'');
 await page.evaluate(()=>{ASMachApp.selectedAnnotation().threadStandard='CUSTOM STD 123';ASMachApp.renderAll();});assert.equal(await standard.inputValue(),'CUSTOM STD 123');
 await page.evaluate(()=>ASMachApp.renderAll());assert.equal(await standard.locator('[data-custom-standard]').count(),1);
 await standard.selectOption('ASME B1.20.1');assert.equal(await page.evaluate(()=>ASMachApp.selectedAnnotation().threadStandard),'ASME B1.20.1');assert.equal(await standard.locator('[data-custom-standard]').count(),0);
 await standard.selectOption('ISO 261 / ISO 965-1');
 for(const width of [1366,1024]){await page.setViewportSize({width,height:900});const size=await standard.boundingBox(),parent=await standard.locator('..').boundingBox();assert.ok(size.width>150,'Standard label needs sufficient width');assert.ok(size.x+size.width<=parent.x+parent.width+1,'Selector must fit its row');}
 await page.screenshot({path:'outputs/thread-standard-select.png'});
 assert.equal(await page.locator('[data-characteristic-field="threadStandard"]').count(),1);
 assert.deepEqual(errors,[]);console.log('PASS OCR thread standard field is visible, editable and preserved in detailed editing');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
