const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(require('url').pathToFileURL(require('path').resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=800;await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'test.png',type:'image/png',dataUrl:c.toDataURL()},annotations:[]});});
 const r=await p.locator('#overlay').boundingBox();await p.mouse.move(r.x+100,r.y+100);
 const badge=p.locator('#qtPointerBadge');await badge.waitFor({state:'visible'});
 for(const [mode,content,label] of [['select','auto','Seçim aracı'],['add','auto','Balon ekle'],['box','auto','Otomatik ayıklama'],['box','dimension','Ölçü ayıkla'],['box','gdt','GD&T ayıkla'],['box','note','Not OCR']]){
  await p.evaluate(({mode,content})=>{ASMachApp.state.mode=mode;document.getElementById('boxContentMode').value=content;document.getElementById('boxScanMode').value='controlled';ASMachApp.renderAll();},{mode,content});
  await p.waitForFunction(label=>document.getElementById('qtPointerBadge').dataset.tool===label,label);
 }
 assert.equal(await badge.getAttribute('data-record'),'controlled');
 await p.evaluate(()=>document.getElementById('boxScanMode').value='smart');await p.waitForFunction(()=>document.getElementById('qtPointerBadge').dataset.record==='smart');
 assert.equal(await badge.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
 assert.equal(await p.locator('#overlay').evaluate(e=>getComputedStyle(e).cursor.includes('url(')),false);
 const pos=await badge.boundingBox();assert.ok(pos.y>r.y+100);
 await p.mouse.move(5,5);await badge.waitFor({state:'hidden'});assert.deepEqual(errors,[]);
 console.log('PASS selected tool icons, OCR subtypes, live record mode, normal cursor, below-pointer position, leave hiding, click-through');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
