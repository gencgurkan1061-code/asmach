const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{const p=await b.newPage();await p.goto(require('url').pathToFileURL(require('path').resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=600;await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'text.png',type:'image/png',dataUrl:c.toDataURL()},annotations:[{id:'r',number:'1',page:1,type:'Not',ocrText:'Eski not',requirement:'Elle yazılmış eski açıklama',requirementMode:'manual',manualFields:['requirement'],threadClass:'6H',fitClass:'H7',chamferAngle:'45',inspectionMethod:'test-method',size:40}]});ASMachApp.state.selectedId='r';ASMachApp.renderAll();});
await p.evaluate(()=>{const raw=document.getElementById('ciOcrText');raw.value='Ø50 ±0.2';raw.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(800);
const r=await p.evaluate(()=>ASMachApp.state.annotations[0]);assert.equal(r.type,'Çap');assert.equal(Number(r.nominalValue),50);assert.equal(Number(r.lowerLimit),49.8);assert.equal(Number(r.upperLimit),50.2);assert.equal(r.requirement,'Ø50 ±0.2');assert.equal(r.fitClass,'');assert.equal(r.threadClass,'');assert.equal(r.chamferAngle,'');assert.equal(r.size,40);
await p.evaluate(()=>{const raw=document.getElementById('ciOcrText');raw.value='⌖ | Ø0.15 | B | C | D';raw.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(800);assert.equal(await p.evaluate(()=>ASMachApp.state.annotations[0].requirement),'⌖ | Ø0.15 | B | C | D');
for(const shape of ['circle','square','hexagon']){
await p.evaluate(shape=>{ASMachApp.state.annotations[0].shape=shape;ASMachApp.renderAll();},shape);await p.waitForTimeout(100);
const preview=await p.locator('#cwBalloonThumb').evaluate(e=>({frame:!!e.querySelector('g [data-role="bubble"]'),text:e.querySelector('text')?.textContent}));assert.ok(preview.frame,'Missing balloon frame: '+shape);assert.equal(preview.text,'1');
}
console.log('PASS automatic fields and full balloon thumbnail for circle, square and hexagon');
for(const [type,unit,expected] of [['Çap','mm',['mm','cm','m','µm','in']],['Açı','°',['°']],['Yüzey','µm',['µm','µin']],['Not','',['']],['Uzunluk','özel',['mm','cm','m','µm','in','özel']]]){
await p.evaluate(([type,unit])=>{Object.assign(ASMachApp.state.annotations[0],{type,unit});ASMachApp.renderAll();},[type,unit]);
assert.deepEqual(await p.locator('#measurementUnit option').evaluateAll(nodes=>nodes.map(n=>n.value)),expected);assert.equal(await p.locator('#measurementUnit').inputValue(),unit);
}
console.log('PASS type-specific unit enums and existing custom unit preservation');
const spacing=await p.evaluate(()=>{const form=document.getElementById('selectionForm'),tabs=form.querySelector('.cw-tabs').getBoundingClientRect(),source=document.getElementById('cwInlineSource').getBoundingClientRect(),scroll=getComputedStyle(form.querySelector('.ip-scroll'));return{gap:source.top-tabs.bottom,left:scroll.paddingLeft,right:scroll.paddingRight};});
assert.ok(Math.abs(spacing.gap)<=1,JSON.stringify(spacing));assert.equal(spacing.left,'0px');assert.equal(spacing.right,'0px');
console.log('PASS flush inspector tabs/source and zero outer side padding');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
