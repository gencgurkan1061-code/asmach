const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),{pathToFileURL}=require('node:url'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const p=await browser.newPage({viewport:{width:1500,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route(/^https?:/,r=>r.abort());await p.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 for(const id of ['openFileButton','loadProjectButton']){assert.equal(await p.locator('#'+id).isVisible(),true);assert.equal(await p.locator('#'+id).isDisabled(),false);assert.equal(await p.locator('#'+id).evaluate(n=>!!n.closest('details')),false);}
 for(const id of ['drawing','production','reports','view'])assert.equal(await p.locator('#rbTab-'+id).isDisabled(),true);
 for(const id of ['saveProjectButton','saveProjectAsButton','projectSetupButton'])assert.equal(await p.locator('#'+id).isDisabled(),true);
 await p.keyboard.press('r');assert.equal(await p.locator('.view-numbering-dialog[open]').count(),0);
 await p.locator('#rbTab-help').click();assert.equal(await p.locator('#keyboardHelp').isVisible(),true);await p.locator('#rbTab-file').click();
 await p.evaluate(()=>{const a=ASMachApp;a.state.fileData='fixture';a.state.fileName='drawing.png';a.state.pageCount=1;a.elements.sourceCanvas.width=1000;a.elements.sourceCanvas.height=700;a.renderAll();});
 for(const id of ['drawing','production','reports','view'])assert.equal(await p.locator('#rbTab-'+id).isDisabled(),false);
 for(const id of ['saveProjectButton','saveProjectAsButton','projectSetupButton'])assert.equal(await p.locator('#'+id).isDisabled(),false);
 await p.screenshot({path:'outputs/safety-review-qa/file-ribbon.png'});
 for(const width of [1500,850,480]){await p.setViewportSize({width,height:900});assert.ok(await p.locator('.toolbar').evaluate(n=>n.scrollWidth<=n.clientWidth+1));const overlap=await p.locator('#rbPanel-file .btn').evaluateAll(ns=>ns.some((n,i)=>ns.slice(i+1).some(m=>{const a=n.getBoundingClientRect(),b=m.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;})));assert.equal(overlap,false);}
 await p.evaluate(()=>{ASMachApp.state.fileData=null;ASMachApp.renderAll();});assert.equal(await p.locator('#rbTab-drawing').isDisabled(),true);assert.deepEqual(errors,[]);console.log('PASS: direct file actions, unloaded gating, hotkey guard, reopen enablement and overlap checks at 1500/850/480.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
