const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const c={window:{}};vm.runInNewContext(fs.readFileSync('src/balloon-placement.js','utf8'),c);const resolve=c.window.ASMachBalloonPlacement.resolveCollisions;
const record=(id,x,y,box)=>({id,bubbleX:x,bubbleY:y,anchorX:.5,anchorY:.5,size:30,shape:'circle',arrowEnabled:true,selectionBox:box});
const box={x:.4,y:.4,w:.12,h:.08};const records=[record('a',.35,.44,box),record('b',.35,.44,box),record('c',.45,.43,{x:.65,y:.6,w:.1,h:.1})];const before=JSON.stringify(records.map(r=>r.selectionBox));const result=resolve(records,1000,700);assert.ok(result.moved>=2);assert.equal(result.unresolved,0);assert.equal(JSON.stringify(records.map(r=>r.selectionBox)),before);assert.equal(resolve(records,1000,700).moved,0,'stable re-render');
const crossing=[{...record('d',.2,.2),anchorX:.8,anchorY:.8},{...record('e',.8,.2),anchorX:.2,anchorY:.8}];assert.equal(resolve(crossing,1000,700).moved,0,'leaders may cross');
const rotated=[record('f',.5,.5,{x:.4,y:.4,w:.2,h:.2,points:[{x:.5,y:.35},{x:.65,y:.5},{x:.5,y:.65},{x:.35,y:.5}]})];assert.equal(resolve(rotated,1000,700).moved,1);
const tiny=[record('g',.5,.5,{x:0,y:0,w:1,h:1})];assert.equal(resolve(tiny,50,50,{maxCandidates:100}).unresolved,1);assert.equal(tiny[0].bubbleX,.5,'impossible placement preserves position');
const hidden=[{...record('hidden',.45,.44,box),boxLineStyle:'none',arrowEnabled:false}];assert.equal(resolve(hidden,1000,700).moved,1,'hidden source area remains protected');assert.equal(resolve(hidden,1000,700).moved,0,'stable contact');
hidden[0].boxLineStyle='solid';assert.equal(resolve(hidden,1000,700).moved,1,'visible stroke clearance');
const near=[{...record('near',.45,.44,box),boxLineStyle:'none',arrowEnabled:false},{...record('other',.45,.44),arrowEnabled:false}];assert.ok(resolve(near,1000,700).moved>0,'balloons still avoid each other');
console.log('PASS visible/hidden obstacles, separation, crossing leaders, rotated boxes, stability and no-space fallback');
for(const shape of ['circle','square','hexagon','triangle','diamond']){
 const pair=[{...record('one',.3,.3),shape,arrowEnabled:false,balloonLineWidth:2},{...record('two',.333,.3),shape,arrowEnabled:false,balloonLineWidth:2}];
 assert.equal(resolve(pair,1000,1000).moved,0,shape+' one pixel outline gap must stay still');
}
const tight=[{...record('one',.3,.3),shape:'square',arrowEnabled:false},{...record('two',.3325,.3),shape:'square',arrowEnabled:false}];
const old={x:tight[0].bubbleX,y:tight[0].bubbleY};assert.equal(resolve(tight,1000,1000).unresolved,0);assert.ok(Math.hypot(tight[0].bubbleX-old.x,tight[0].bubbleY-old.y)*1000<.6,'half pixel deficit should not cause large jump');assert.equal(resolve(tight,1000,1000).moved,0);
const corner=[{...record('circle',.325,.325),arrowEnabled:false},{...record('square',.3,.3),shape:'square',arrowEnabled:false}];assert.equal(resolve(corner,1000,1000).unresolved,0,'real circle to square corner contact');
console.log('PASS shape-specific compact clearance and subpixel settling');
