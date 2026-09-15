const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),context={window:{}};
for(const file of ['requirements-engine','measurement-layout'])vm.runInNewContext(fs.readFileSync('src/'+file+'.js','utf8'),context);
const {ASMachRequirements:r,ASMachMeasurementLayout:l}=context.window;
for(const [high,low]of [['0.205','0.198'],['1.416','1.396'],['0.596','0.586'],['0.030','0.020']]){
 for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI]){
  const parts=[{text:high,x:.3,y:.2,w:.1,h:.03},{text:low,x:.3,y:.25,w:.1,h:.03},{text:'Ø',x:.275,y:.225,w:.02,h:.03},{text:'3 x',x:.2,y:.225,w:.05,h:.03}];
  const words=parts.map(w=>{const corners=[[w.x,w.y],[w.x+w.w,w.y],[w.x,w.y+w.h],[w.x+w.w,w.y+w.h]].map(([x,y])=>[Math.cos(angle)*x-Math.sin(angle)*y,Math.sin(angle)*x+Math.cos(angle)*y]),xs=corners.map(v=>v[0]),ys=corners.map(v=>v[1]);return{...w,x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),angle};});
  const text=l.reconstruct(words,{width:1000,height:1000});const parsed=r.parse(text,'ISO 2768-m',()=>({nominalValue:'999',lowerTolerance:'-1',upperTolerance:'1'}));
  assert.equal(parsed.upperLimit,String(Number(high)),text);assert.equal(parsed.lowerLimit,String(Number(low)),text);assert.equal(parsed.type,'Çap');assert.equal(parsed.quantity,3);assert.equal(parsed.nominalValue,String(Number(((+high+ +low)/2).toFixed(8))));assert.equal(parsed.upperTolerance,String(Number(((+high- +low)/2).toFixed(8))));assert.equal(parsed.nominalSource,'limit_midpoint');assert.equal(parsed.limitDimension,true);
 }
}
for(const text of ['0.205 MAX 0.198 MIN','MIN 0.198 MAX 0.205','0,198 MIN 0,205 MAX']){const p=r.parse(text);assert.equal(p.lowerLimit,'0.198');assert.equal(p.upperLimit,'0.205');}
const chamfer=r.parse('3 x 0.030 MAX 0.020 MIN x 45°');assert.equal(chamfer.type,'Pah');assert.equal(chamfer.chamferAngle,'45');assert.equal(chamfer.quantity,3);
const adjacent=l.reconstruct([{text:'10',x:.1,y:.1,w:.1,h:.03},{text:'9',x:.4,y:.15,w:.1,h:.03}]);assert.ok(!adjacent.includes('MAX'));
assert.ok(r.parse('0.1 MAX 0.2 MIN').parseWarnings.length);
assert.equal(r.parse('0.1 MAX 0.2 MIN').nominalValue,'');
assert.equal(r.assessReading('0.1 MAX 0.2 MIN').valid,false);
for(const [text,nominal,tolerance,type]of [
 ['0.596 MAX 0.586 MIN','0.591','0.005','Uzunluk'],
 ['0.205 MAX 0.198 MIN','0.2015','0.0035','Uzunluk'],
 ['0 MAX -0.2 MIN','-0.1','0.1','Uzunluk'],
 ['-0.2 MAX -0.4 MIN','-0.3','0.1','Uzunluk'],
 ['0 MAX 0 MIN','0','0','Uzunluk'],
 ['2 x Ø0.205 MAX Ø0.198 MIN in','0.2015','0.0035','Çap'],
 ['3 x R 10 MAX R 9 MIN','9.5','0.5','Yarıçap'],
 ['90° MAX 89° MIN','89.5','0.5','Açı'],
 ['MAX 90° MIN 89°','89.5','0.5','Açı'],
 ['3 x 0.030 MAX 0.020 MIN x 45°','0.025','0.005','Pah']
]){
 const p=r.parse(text);assert.equal(p.type,type,text);assert.equal(p.nominalValue,nominal,text);assert.equal(p.upperTolerance,tolerance,text);assert.equal(p.lowerTolerance,Number(tolerance)===0?'0':'-'+tolerance,text);assert.equal(p.nominalSource,'limit_midpoint');assert.equal(p.limitDimension,true);assert.equal(r.assessReading(text).tolerance,'limits');assert.equal(r.assessReading(text).valid,true);assert.equal(r.consistencyErrors(p).length,0);
 assert.ok(!p.requirement.includes('±'),p.requirement);assert.ok(p.requirement.includes('–'),p.requirement);
 for(const bound of ['lowerLimit','upperLimit'])assert.equal(r.evaluate({...p,result:p[bound]}).result,'pass',text+' '+bound);
 assert.equal(r.evaluate({...p,result:String(Number(p.upperLimit)+0.001)}).result,'fail',text);
}
const precise=r.parse('0.205 MAX 0.198 MIN');assert.equal(precise.decimalPlaces,4);assert.equal(r.assessReading('0.205 MAX 0.198 MIN').kind,'limits');
const legacy={type:'Uzunluk',lowerLimit:'0.586',upperLimit:'0.596',nominalValue:'',lowerTolerance:'',upperTolerance:'',toleranceStandard:'Metinde alt / üst limit',requirement:'0.586–0.596',requirementMode:'auto',ocrText:'0.596 MAX 0.586 MIN',decimalPlaces:3};
const migrated=r.syncRequirement(legacy);assert.equal(migrated.nominalValue,'0.591');assert.equal(migrated.ocrText,legacy.ocrText);assert.equal(migrated.requirement,legacy.requirement);assert.equal(legacy.nominalValue,'');
const resized=r.normalizeLimitDimension({...migrated,upperLimit:'0.598'});assert.equal(resized.nominalValue,'0.592');assert.equal(resized.upperTolerance,'0.006');assert.equal(resized.lowerLimit,'0.586');assert.equal(resized.upperLimit,'0.598');
const removed=r.normalizeLimitDimension({...migrated,upperLimit:''});assert.equal(removed.nominalValue,'');assert.equal(removed.upperTolerance,'');assert.equal(removed.lowerLimit,'0.586');
const invalid=r.normalizeLimitDimension({...migrated,upperLimit:'0.58'});assert.equal(invalid.nominalValue,'');assert.equal(r.evaluate({...invalid,result:'0.587'}).result,'invalid');
for(const manual of [{...legacy,nominalValue:'0.59'},{...legacy,nominalSource:'manual',nominalValue:''},{...legacy,manualFields:['nominalValue']},{...migrated,limitDimension:false,nominalSource:'',nominalValue:'0.59',lowerTolerance:'-0.01',upperTolerance:'0.01'}])assert.equal(r.normalizeLimitDimension(manual).nominalValue,manual.nominalValue);
for(const text of ['10 MAX','10 MIN','MAX 10','MIN 10']){const p=r.parse(text);assert.equal(p.nominalValue,'',text);assert.notEqual(p.nominalSource,'limit_midpoint',text);}
for(const text of ['Ø10 MAX R9 MIN','Ø10° MAX Ø9° MIN']){const p=r.parse(text);assert.equal(p.nominalValue,'',text);assert.ok(p.parseWarnings.length,text);}
for(const [text,midpoint,halfWidth,places]of [
 ['0.000002 MAX 0.000001 MIN','0.0000015','0.0000005',7],
 ['0.000000002 MAX 0.000000001 MIN','0.0000000015','0.0000000005',10],
 ['0.000000000002 MAX 0.000000000001 MIN','0.0000000000015','0.0000000000005',13],
 ['-0.000000000001 MAX -0.000000000002 MIN','-0.0000000000015','0.0000000000005',13],
 ['0.123456789013 MAX 0.123456789012 MIN','0.1234567890125','0.0000000000005',13]
]){
 const p=r.parse(text);assert.equal(p.nominalValue,midpoint,text);assert.equal(p.upperTolerance,halfWidth,text);assert.equal(p.lowerTolerance,'-'+halfWidth,text);assert.equal(p.decimalPlaces,places,text);
 for(const key of ['nominalValue','lowerTolerance','upperTolerance','lowerLimit','upperLimit'])assert.ok(!/[eE]/.test(p[key]),key+': '+p[key]);
 assert.ok(!/[eE]/.test(p.requirement),p.requirement);assert.ok(p.requirement.includes('–'),p.requirement);
 assert.equal(r.displayNumber(p.nominalValue,p),midpoint);assert.equal(r.displayNumber(p.upperTolerance,p),halfWidth);
 assert.equal(r.consistencyErrors(p).length,0);assert.equal(r.validate(p).valid,true);assert.equal(r.assessReading(text).valid,true);
 for(const bound of ['lowerLimit','upperLimit'])assert.equal(r.evaluate({...p,result:p[bound]}).result,'pass',text+' '+bound);
 const restored=r.syncRequirement(JSON.parse(JSON.stringify(p)));assert.equal(restored.nominalValue,midpoint);assert.equal(restored.upperTolerance,halfWidth);assert.equal(restored.requirement,p.requirement);
}
assert.equal(r.displayNumber(0.000000000001,{limitDimension:true,decimalPlaces:13}),'0.0000000000010');
assert.equal(r.displayNumber('0.000000000001',{limitDimension:true}),'0.000000000001');
assert.equal(r.displayNumber('0.000000000001',{limitDimension:true,decimalPlaces:6}),'0.000000000001','Display precision never rounds authoritative endpoints');
const tooFine=r.parse('0.0000000000002 MAX 0.0000000000001 MIN');assert.equal(tooFine.nominalValue,'');assert.ok(tooFine.parseWarnings.some(w=>w.includes('hassasiyeti')));assert.equal(tooFine.lowerLimit,'0.0000000000001');assert.equal(tooFine.upperLimit,'0.0000000000002');
const integerWidth=r.parse('10 MAX 9 MIN');assert.equal(integerWidth.nominalValue,'9.5');assert.equal(integerWidth.parseWarnings.length,0);assert.equal(r.assessReading('10 MAX 9 MIN').valid,true);
const reversedIntegerWidth=r.parse('9 MAX 10 MIN');assert.equal(reversedIntegerWidth.nominalValue,'');assert.ok(reversedIntegerWidth.parseWarnings.some(w=>w.includes('Alt limit üst limitten büyük')));assert.equal(r.assessReading('9 MAX 10 MIN').valid,false);assert.equal(r.evaluate({...reversedIntegerWidth,result:'9.5'}).result,'invalid');
console.log('PASS stacked limits, four rotations, derived nominal provenance, decimal precision, quantity, diameter, radius, angle, chamfer, migration, manual edits, inclusive endpoints and unilateral/reversed guards');
