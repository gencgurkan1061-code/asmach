const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};
for(const name of ['requirements-engine','measurement-layout'])vm.runInNewContext(fs.readFileSync(`src/${name}.js`,'utf8'),context);
const reconstruct=context.window.ASMachMeasurementLayout.reconstruct;
const nominal=['Ø','2','7','.','3'].map((text,i)=>({text,x:.1+i*.02,y:.2,w:.015,h:.03,angle:0}));
const source=[...nominal,{text:'0',x:.23,y:.185,w:.01,h:.012,angle:0},{text:'-0.05',x:.23,y:.22,w:.04,h:.012,angle:0}];
for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI]){
  const transformed=source.map(w=>{
    const coords=[[w.x,w.y],[w.x+w.w,w.y],[w.x,w.y+w.h],[w.x+w.w,w.y+w.h]].map(([x,y])=>[.5+Math.cos(angle)*(x-.5)-Math.sin(angle)*(y-.5),.5+Math.sin(angle)*(x-.5)+Math.cos(angle)*(y-.5)]);
    const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
    return {...w,x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),angle};
  });
  assert.equal(reconstruct(transformed,{width:1000,height:1000}),'Ø27.3 (0/-0.05)');
  const ocr=transformed.map(w=>({...w,angle:-w.angle*180/Math.PI}));
  assert.equal(reconstruct(ocr,{width:1000,height:1000,ocr:true}),'Ø27.3 (0/-0.05)');
}
assert.notEqual(reconstruct([{text:'25',x:.1,y:.1,w:.025,h:.03},{text:'35',x:.18,y:.1,w:.025,h:.03}]),'2535');
for(const symbol of ['Ø','ø','⌀','∅','Φ','φ','ϕ','Ф'])for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI]){
  const parts=[{text:symbol,x:.08,y:.214,w:.017,h:.014},{text:'59.9',x:.11,y:.2,w:.1,h:.04},{text:'0',x:.23,y:.187,w:.015,h:.017},{text:'-0.1',x:.23,y:.225,w:.05,h:.017}];
  const boxes=parts.map(w=>{
    const points=[[w.x,w.y],[w.x+w.w,w.y],[w.x,w.y+w.h],[w.x+w.w,w.y+w.h]].map(([x,y])=>[.5+Math.cos(angle)*(x-.5)-Math.sin(angle)*(y-.5),.5+Math.sin(angle)*(x-.5)+Math.cos(angle)*(y-.5)]);
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    return{...w,x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),angle:w.text===symbol?0:angle};
  });
  assert.equal(reconstruct(boxes,{width:1000,height:1000}),'Ø59.9 (0/-0.1)',`${symbol} / ${angle}`);
}
assert.equal(reconstruct([{text:'ø',x:.08,y:.21,w:.015,h:.015},{text:'59.9',x:.11,y:.2,w:.1,h:.04}]),'Ø59.9');
console.log('Measurement layout: four PDF/OCR orientations, spaced glyphs, stacked zero tolerances and separate dimensions passed.');
const stacked=[{text:'11',x:.1,y:.3,w:.13,h:.15},{text:'+0.1',x:.28,y:.23,w:.18,h:.1},{text:'0',x:.28,y:.43,w:.08,h:.16}];
assert.equal(reconstruct(stacked,{width:500,height:500}),'11 (+0.1/0)','a taller tolerance zero is not the nominal');
const partial=reconstruct([...stacked,{text:'42',x:.8,y:.1,w:.1,h:.1}],{width:500,height:500,details:true});assert.equal(partial.missingDigits,0,'unclassified numeric words must not be dropped');assert.equal(partial.structured,false,'unrelated dimensions prevent a confident stacked assignment');assert.ok(partial.text.includes('42'));
const unrelated=reconstruct([{text:'11',x:.1,y:.3,w:.1,h:.1},{text:'+0.1',x:.8,y:.7,w:.1,h:.1}],{width:500,height:500});assert.ok(!unrelated.includes('('),'distant tolerance is not attached');
function oriented(source,angle,ocr=false){
  return source.map(w=>{
    const points=[[w.x,w.y],[w.x+w.w,w.y],[w.x,w.y+w.h],[w.x+w.w,w.y+w.h]].map(([x,y])=>[Math.cos(angle)*x-Math.sin(angle)*y,Math.sin(angle)*x+Math.cos(angle)*y]);
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    return{...w,x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),angle:ocr?-angle*180/Math.PI:angle};
  });
}
const main=(text)=>({text,x:.2,y:.3,w:.15,h:.08});
const tol=(text,y)=>({text,x:.37,y,w:.1,h:.03});
const recon=source=>reconstruct(source,{width:1000,height:1000,details:true});
const cases=[
  [[main('3 x Ø11'),tol('+0.1',.28),tol('0',.35)],'3 x Ø11 (+0.1/0)'],
  [[main('.5'),tol('+.02',.28),tol('-.01',.35)],'.5 (+.02/-.01)'],
  [[main('45°'),tol('+0.5°',.28),tol('-0.2°',.35)],'45° (+0.5°/-0.2°)'],
  [[main('R5'),tol('±0.1',.32)],'R5 ±0.1'],
  [[main('11 mm'),tol('+0.1',.28),tol('0',.35)],'11 (+0.1/0) mm'],
  [[main('11'),tol('+0.1',.28),tol('0',.35),{text:'3 x Ø',x:.02,y:.329,w:.16,h:.022}], '3 x Ø11 (+0.1/0)'],
  [[main('11'),tol('+0.1',.28),tol('0',.35),{text:'x 45°',x:.5,y:.329,w:.13,h:.022}], '11 (+0.1/0) x 45°'],
];
for(const [source,expected]of cases)for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI])for(const ocr of [false,true]){
  const result=reconstruct(oriented(source,angle,ocr),{width:1000,height:1000,ocr,details:true});
  assert.equal(result.text,expected);assert.equal(result.structured,true);assert.equal(result.missingDigits,0);
}
for(const extra of [{text:'TYP',x:.51,y:.32,w:.08,h:.03},{text:'2',x:.51,y:.32,w:.08,h:.03},{text:'H7',x:.51,y:.32,w:.08,h:.03},{text:'A',x:.03,y:.32,w:.08,h:.03}]){
  const source=[main('11'),tol('+0.1',.28),tol('0',.35),extra],result=recon(source);
  assert.equal(result.structured,false,extra.text);assert.equal(result.missingDigits,0);assert.ok(result.text.includes(extra.text));
}
const mismatchedDegree=recon([main('11'),tol('+0.1°',.28),tol('-0.1°',.35)]);assert.equal(mismatchedDegree.structured,false);
const sourceLimits=[{text:'0.596',x:.3,y:.2,w:.15,h:.06},{text:'0.586',x:.3,y:.29,w:.15,h:.06}];
assert.equal(recon(sourceLimits).text,'0.596 MAX 0.586 MIN');
for(const changed of [
  [...sourceLimits,{text:'3 x',x:.01,y:.78,w:.1,h:.03}],
  [...sourceLimits,{text:'63',x:.47,y:.25,w:.1,h:.03}],
  [sourceLimits[0],{...sourceLimits[1],text:'R0.586'}],
  [sourceLimits[0],{...sourceLimits[1],x:.6}],
  [sourceLimits[0],{...sourceLimits[1],h:.03}],
]){
  const result=recon(changed);assert.equal(result.limitDimension,undefined);assert.equal(result.missingDigits,0);
}
console.log('Measurement layout: lossless quantity, units, radius, angle, chamfer suffix, leading decimals, and uncertain-evidence fallbacks passed in four PDF/OCR orientations.');
