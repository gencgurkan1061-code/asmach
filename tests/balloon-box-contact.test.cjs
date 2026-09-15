const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const c={window:{}};vm.runInNewContext(fs.readFileSync('src/balloon-placement.js','utf8'),c);const api=c.window.ASMachBalloonPlacement;
for(const shape of ['circle','square','hexagon'])for(const visible of [true,false]){
 const r={id:'a',size:30,shape,balloonLineWidth:2,boxLineWidth:2,boxLineStyle:visible?'solid':'none',arrowEnabled:false,bubbleX:.49,bubbleY:.45,selectionBox:{x:.4,y:.4,w:.1,h:.1},anchorX:.5,anchorY:.45};
 api.constrainBox(r,1000,1000);assert.ok(Math.abs(r.bubbleX-(.5+(16+(visible?1:0))/1000))<1e-8,shape+' tangent');
 const before=JSON.stringify(r);assert.equal(api.resolveCollisions([r],1000,1000).moved,0,'release keeps tangent');assert.equal(JSON.stringify(r),before);
 r.bubbleX=.49;r.arrowEnabled=true;api.constrainBox(r,1000,1000);assert.ok(Math.abs(r.bubbleX-(.517+(visible?.001:0)))<1e-8,'visible leader one pixel margin');
}
const rotated={size:30,shape:'circle',arrowEnabled:false,boxLineStyle:'none',bubbleX:.5,bubbleY:.5,selectionBox:{points:[{x:.5,y:.3},{x:.7,y:.5},{x:.5,y:.7},{x:.3,y:.5}]}};api.constrainBox(rotated,1000,1000);const initial=[rotated.bubbleX,rotated.bubbleY];api.constrainBox(rotated,1000,1000);assert.deepEqual([rotated.bubbleX,rotated.bubbleY],initial);console.log('PASS hidden/visible boxes; circle, square, hexagon flush contact; rotated box; stable release; leader gap');
