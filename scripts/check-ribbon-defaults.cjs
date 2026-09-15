const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),{pathToFileURL}=require('node:url'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{const p=await b.newPage({viewport:{width:1700,height:950}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);await p.evaluate(()=>{const a=ASMachApp;a.state.fileData='fixture';a.state.fileName='test.png';a.elements.sourceCanvas.width=1000;a.elements.sourceCanvas.height=700;a.renderAll();});await p.locator('#rbTab-format').click();assert.equal(await p.locator('#balloonDefaultsButton').count(),0);await p.locator('#rd-unit').selectOption('in');assert.equal(await p.evaluate(()=>ASMachApp.state.generalTolerance.unit),'in');await p.locator('#rd-unit').selectOption('mm');await p.locator('#rd-dpi').selectOption('400');assert.equal(await p.evaluate(()=>ASMachApp.state.metadata.projectDefaults.dpi),'400');await p.getByRole('button',{name:'Algılanacak türler ▾',exact:true}).click();assert.equal(await p.locator('.rd-popup:popover-open').count(),1);await p.keyboard.press('Escape');await p.getByRole('button',{name:'Varsayılan kontrol planı ▾',exact:true}).click();assert.equal(await p.locator('dialog:modal').count(),0);assert.equal(await p.locator('.rd-popup:popover-open').count(),1);await p.keyboard.press('Escape');assert.equal(await p.locator('#rbPanel-format>.rd-defaults:last-child').count(),1);
for(const name of ['Özel tolerans ▾','Algılanacak türler ▾','Varsayılan kontrol planı ▾']){
 const trigger=p.getByRole('button',{name,exact:true});await trigger.click();
 assert.equal(await p.locator('.rd-popup:popover-open').count(),1);
 await p.locator('#viewer').click({position:{x:10,y:10}});
 assert.equal(await p.locator('.rd-popup:popover-open').count(),0);
 await trigger.click();await trigger.click();assert.equal(await p.locator('.rd-popup:popover-open').count(),0);
}
await p.getByRole('button',{name:'Algılanacak türler ▾',exact:true}).click();
await p.locator('.rd-popup:popover-open label').first().click();
assert.equal(await p.locator('.rd-popup:popover-open').count(),1);
await p.locator('#rbTab-view').click();assert.equal(await p.locator('.rd-popup:popover-open').count(),0);
await p.locator('#rbTab-format').click();
for(const width of [1700,950,600]){
 await p.setViewportSize({width,height:950});
 assert.equal(await p.locator('.rd-defaults').evaluate(n=>n.scrollWidth>n.clientWidth+2),false);
 const last=await p.locator('.rd-defaults').boundingBox(),number=await p.locator('#rbPanel-format .fr-bar').boundingBox();
 assert.ok(last.y>=number.y+number.height);
}
await p.setViewportSize({width:1700,height:950});
await p.screenshot({path:'outputs/safety-review-qa/direct-defaults.png'});assert.deepEqual(errors,[]);console.log('PASS: direct selectors save, enum popovers, no defaults modal.');}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
