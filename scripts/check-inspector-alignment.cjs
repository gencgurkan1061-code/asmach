const fs=require('node:fs');
let fixture=fs.readFileSync('scripts/check-characteristic-info.cjs','utf8').split('\n').slice(0,4).join('\n');
fixture+=`\nawait p.waitForTimeout(500);
const measure=()=>p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,w:r.width}};return {panel:rect('.inspector'),standard:rect('#cwDrawingStandard'),type:rect('#characteristicType'),nominal:rect('#nominalValue'),lower:rect('#lowerTolerance'),upper:rect('#upperTolerance'),limit:rect('[data-limit="lowerLimit"]'),evaluation:rect('#evaluationMethod')};});
// Read actual input IDs before checking the geometry.
console.log(await p.locator('#cwCharacteristicInfo input,#cwCharacteristicInfo select').evaluateAll(es=>es.map(e=>e.id)));
const handle=p.locator('.cw-inspector-resize');
await p.screenshot({path:'outputs/inspector-alignment-narrow.png'});
const before=await measure();
const r=await handle.boundingBox();await p.mouse.move(r.x+2,r.y+100);await p.mouse.down();await p.mouse.move(r.x-170,r.y+100,{steps:12});await p.mouse.up();await p.waitForTimeout(200);
const after=await measure();console.log({before,after});
for(const m of [before,after]){assert.ok(Math.abs(m.lower.w-m.upper.w)<1);for(const k of ['nominal','lower','limit','evaluation'])assert.ok(Math.abs(m.standard.x-m[k].x)<1,k+' alignment');}
assert.ok(after.lower.w>before.lower.w+40);assert.ok(Math.abs((after.lower.w-before.lower.w)-(after.upper.w-before.upper.w))<1);
await p.screenshot({path:'outputs/inspector-alignment-wide.png'});assert.deepEqual(errors,[]);console.log('PASS aligned fields and equal growth via drag');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});`;
eval(fixture);
