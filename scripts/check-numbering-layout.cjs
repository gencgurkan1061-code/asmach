const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1500,height:950}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(require('url').pathToFileURL(require('path').resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=800;await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'t.png',type:'image/png',dataUrl:c.toDataURL()},annotations:[{id:'a',number:'9',page:1,type:'Uzunluk',selectionBox:{x:.2,y:.2,w:.1,h:.04}},{id:'b',number:'4',page:1,type:'Uzunluk',selectionBox:{x:.2,y:.4,w:.1,h:.04}}]});void ASMachViewNumbering.open();});
 const d=p.locator('.view-numbering-dialog');await d.waitFor();
 assert.equal(await d.locator('.vn-change-preview').getAttribute('open'),null);
 assert.equal(await d.locator('aside [data-add]').count(),1);
 assert.equal(await d.locator('.vn-zoom-tools [data-page]').count(),1);
 await d.locator('[data-order-choice=columns]').click();assert.equal(await d.locator('[data-order]').inputValue(),'columns');
 await d.locator('[data-start]').fill('20');await d.locator('[data-start]').dispatchEvent('change');
 await d.locator('[data-count]').click();assert.ok(await d.locator('[data-mapping] tr').count());
 assert.deepEqual(await p.evaluate(()=>ASMachApp.state.annotations.map(r=>r.number)),['9','4']);
 await d.locator('[data-count]').click();const height=await d.locator('.vn-zoom-viewport').evaluate(e=>e.clientHeight);assert.ok(height>350,'Canvas should remain spacious: '+height);
 await p.screenshot({path:'outputs/numbering-compact.png'});
 await d.locator('[data-apply]').click();await d.waitFor({state:'detached'});assert.deepEqual(await p.evaluate(()=>ASMachApp.state.annotations.map(r=>r.number)),['20','21']);
 assert.deepEqual(errors,[]);console.log('PASS layout, collapsed preview, order/start changes, unchanged until apply, numbering application, no page errors');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
