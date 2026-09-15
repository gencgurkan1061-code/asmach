const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),{pathToFileURL}=require('node:url'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const p=await browser.newPage({viewport:{width:1700,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route(/^https?:/,r=>r.abort());await p.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 await p.evaluate(()=>{const a=ASMachApp;a.state.fileData='fixture';a.state.fileName='test.png';a.state.pageCount=1;a.elements.sourceCanvas.width=1000;a.elements.sourceCanvas.height=700;a.renderAll();});
 await p.keyboard.press('b');assert.equal(await p.locator('#manualToolOptions button').count(),3);assert.equal(await p.locator('#manualToolOptions').isVisible(),true);
 for(const [key,type] of [['c','Uzunluk'],['t','GD&T'],['n','Not'],['3','GD&T']]){
  await p.evaluate(()=>document.activeElement?.blur());await p.keyboard.press(key);await p.locator('#acuiEditor').waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>ASMachApp.state.annotations.at(-1).type),type);
  const before=await p.evaluate(()=>ASMachApp.state.annotations.length);const input=p.locator('#acuiEditor textarea').first();await input.fill('test c t n');assert.equal(await p.evaluate(()=>ASMachApp.state.annotations.length),before);
  await p.evaluate(()=>document.getElementById('acuiEditor').close());
 }
 await p.evaluate(()=>document.activeElement?.blur());await p.keyboard.press('k');assert.equal(await p.locator('#manualToolOptions').isVisible(),false);await p.keyboard.press('3');assert.equal(await p.locator('#boxContentMode').inputValue(),'gdt');
 await p.keyboard.press('F2');assert.equal(await p.locator('#desktopSettings').isVisible(),true);await p.evaluate(()=>document.activeElement?.blur());await p.keyboard.press('h');assert.equal(await p.locator('#desktopSettings').isVisible(),false);
 await p.keyboard.press('e');assert.equal(await p.locator('#reportCenter').isVisible(),true);await p.evaluate(()=>document.activeElement?.blur());await p.keyboard.press('h');await p.keyboard.press('p');assert.equal(await p.locator('.wl-appbar details').first().evaluate(n=>n.open),true);
 assert.deepEqual(errors,[]);console.log('PASS: three manual types, GD&T defaults, contextual shortcuts, text safety, settings/reports/drawing/project navigation.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
