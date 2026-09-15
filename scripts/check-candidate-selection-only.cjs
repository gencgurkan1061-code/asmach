const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
const p=await b.newPage();await p.goto(require('url').pathToFileURL(require('path').resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;const data=c.toDataURL();await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'test.png',type:'image/png',dataUrl:data},annotations:[],pendingCandidates:[20,30].map(n=>({selected:false,page:1,box:{x:.1,y:.1,w:.2,h:.03},text:String(n),parsed:ASMachApp.parseRequirement(String(n)),snapshot:data,confidence:95,plan:{}}))});});
await p.locator('#autoDetectButton').evaluate(e=>e.click());const before=await p.evaluate(()=>JSON.stringify(ASMachWorkflow.exportQueue()));
await p.locator('#wfRows tr[data-index="1"] [data-preview]').click();
assert.equal(await p.locator('#candidatePreviewTitle').count(),0);
assert.ok(await p.locator('#wfRows tr[data-index="1"]').evaluate(e=>e.classList.contains('wf-active')));
assert.equal(await p.evaluate(()=>JSON.stringify(ASMachWorkflow.exportQueue())),before);
console.log('PASS thumbnail selects right panel without popup or source mutation');
const replacement=await p.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=120;canvas.height=50;canvas.getContext('2d').fillRect(0,0,120,50);const snapshot=canvas.toDataURL(),r=ASMachApp.state.controlledDraft.record;r.snapshot=snapshot;r.selectionBox={x:.2,y:.2,w:.12,h:.05};ASMachApp.renderAll();return snapshot;});
await p.waitForTimeout(100);
assert.equal(await p.locator('#wfRows tr[data-index="1"] img').getAttribute('src'),replacement);
assert.equal(await p.evaluate(()=>ASMachWorkflow.exportQueue()[1].snapshot),replacement);
assert.equal(await p.evaluate(()=>ASMachWorkflow.exportQueue()[1].box.x),.2);
console.log('PASS changed source snapshot and box immediately synchronize to candidate list and queue');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
