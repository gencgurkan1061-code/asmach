const fs=require('node:fs');
let fixture=fs.readFileSync('scripts/check-characteristic-info.cjs','utf8').split('\n').slice(0,4).join('\n');
fixture+=`\nawait p.evaluate(()=>{const r=ASMachApp.selectedAnnotation();Object.assign(r,ASMachApp.parseRequirement('⌖ | Ø0.2 | B | C | D'));ASMachApp.renderAll();});await p.waitForTimeout(300);
const measure=()=>p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};return{type:rect('#characteristicType'),subtype:rect('#selectedGdtField button'),tol:rect('#upperTolerance'),zone:rect('#cwGdtZone'),datum:rect('#cwGdtRef0'),cond:rect('#cwGdtDatum0Menu') ,material:rect('[popovertarget="cwGdtMaterialMenu"]'),datumCondition:rect('[popovertarget="cwGdtDatum0Menu"]'),unit:rect('#measurementUnit'),evaluation:rect('#evaluationMethod')};});
await p.screenshot({path:'outputs/gdt-alignment-narrow.png'});const a=await measure();
const handle=await p.locator('.cw-inspector-resize').boundingBox();await p.mouse.move(handle.x+2,handle.y+100);await p.mouse.down();await p.mouse.move(handle.x-160,handle.y+100,{steps:10});await p.mouse.up();await p.waitForTimeout(200);const z=await measure();
for(const m of [a,z]){for(const k of ['subtype','tol','zone','datum','unit','evaluation'])assert.ok(Math.abs(m.type.x-m[k].x)<2,k+' left alignment');assert.ok(Math.abs(m.tol.w-m.material.w)<2,'equal tolerance controls');assert.ok(Math.abs(m.datum.w-m.datumCondition.w)<2,'equal datum controls');assert.ok(Math.abs(m.tol.y-m.material.y)<2,'same tolerance row');}
assert.ok(z.tol.w>a.tol.w+40);assert.ok(Math.abs((z.tol.w-a.tol.w)-(z.material.w-a.material.w))<2);await p.screenshot({path:'outputs/gdt-alignment-wide.png'});
await p.locator('#cwGdtRef0').fill('A');await p.locator('#cwGdtRef0').dispatchEvent('change');assert.match(await p.evaluate(()=>ASMachApp.selectedAnnotation().datumRefs),/^A/);
await p.evaluate(()=>{const r=ASMachApp.selectedAnnotation();Object.assign(r,ASMachApp.parseRequirement('⌓ | 0.2 | A'));ASMachApp.renderAll();});assert.ok(await p.locator('[popovertarget="cwProfileDistributionMenu"]').isVisible());assert.deepEqual(errors,[]);console.log('PASS GDT aligned rows, equal drag growth, datum edit and profile fields');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});`;
eval(fixture);
