const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1366,height:768}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(require('url').pathToFileURL(require('path').resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=800;await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'t.png',type:'image/png',dataUrl:c.toDataURL()},annotations:['a','b'].map((id,i)=>({id,number:String(i+1),page:1,type:'Uzunluk',unit:'mm',nominalValue:'20'}))});ASMachCharacteristicUI.selectIds(['a','b']);ASMachCharacteristicEditing.open(ASMachApp,['a','b']);});
 assert.equal(await p.locator('#acuiListStats').isVisible(),false);
 const fit=await p.locator('#acuiBulkEditor').evaluate(d=>({width:d.clientWidth,scroll:d.scrollWidth,height:d.getBoundingClientRect().bottom,bodyOverflow:d.querySelector('.acui-content').scrollHeight-d.querySelector('.acui-content').clientHeight}));
 assert.ok(fit.scroll<=fit.width);assert.ok(fit.height<=768);assert.ok(fit.bodyOverflow<2,JSON.stringify(fit));
 await p.locator('[data-enable=comment]').check();await p.locator('[data-bulk=comment]').fill('Toplu kontrol');
 await p.locator('[data-preview-button]').click();assert.equal(await p.locator('#acuiBulkEditor [data-save]').isEnabled(),true);
 assert.equal(await p.evaluate(()=>ASMachApp.state.annotations.some(r=>r.comment==='Toplu kontrol')),false);
 await p.screenshot({path:'outputs/compact-bulk.png'});
 await p.locator('#acuiBulkEditor [data-save]').click();assert.equal(await p.evaluate(()=>ASMachApp.state.annotations.every(r=>r.comment==='Toplu kontrol')),true);
 assert.deepEqual(errors,[]);console.log('PASS compact desktop layout, hidden summary, opt-in preview and bulk update');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
