const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={ASMachApp:{state:{metadata:{projectDefaults:{balloonSizeMode:'ocr'}}}}};vm.runInNewContext(fs.readFileSync('src/balloon-placement.js','utf8'),{window});const api=window.ASMachBalloonPlacement;
assert.equal(api.verifiedTextHeight(40,14),14,'inflated PDF height uses visual glyph');
assert.equal(api.verifiedTextHeight(40,39),40,'genuine large lettering retained');
assert.equal(api.verifiedTextHeight(null,14),14);assert.equal(api.verifiedTextHeight(14,null),14);assert.equal(api.verifiedTextHeight(null,null),null);
for(const shape of ['square','hexagon','circle']){
 const r={shape,number:'17',sourceTextHeight:50,selectionBox:{x:.4,y:.4,w:.06,h:.014}};api.autoStyle(r,1000,1000);assert.equal(r.sourceTextHeight,14,'impossible old height repaired');const size=r.size;api.autoStyle(r,1000,1000);assert.equal(r.size,size,'stable repeat');
 const large={shape,number:'18',sourceTextHeight:40,selectionBox:{x:.4,y:.4,w:.12,h:.045}};api.autoStyle(large,1000,1000);assert.equal(large.sourceTextHeight,40);assert.ok(large.fontSize>r.fontSize);
}
const rotated={number:'18',sourceTextHeight:80,selectionBox:{points:[{x:.4,y:.4},{x:.4,y:.5},{x:.414,y:.5},{x:.414,y:.4}]}};api.autoStyle(rotated,1000,1000);assert.ok(Math.abs(rotated.sourceTextHeight-14)<1e-8);
window.ASMachApp.state.metadata.projectDefaults.balloonSizeMode='manual';const manual={size:80,fontSize:40,sourceTextHeight:80,selectionBox:{w:.1,h:.01}};api.autoStyle(manual,1000,1000);assert.equal(manual.size,80);assert.equal(manual.sourceTextHeight,80);
console.log('PASS inflated metrics, genuine large text, rotated strips, stable sizes and manual preservation');
