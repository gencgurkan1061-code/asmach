const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({window:{}});
for(const name of ['requirements-engine','inspection-plan'])vm.runInContext(fs.readFileSync(`src/${name}.js`,'utf8'),c);
const api=c.window.ASMachInspectionPlan;
const base={id:'one',number:'1',page:1,type:'Çap',requirement:'Ø50 d6',nominalValue:'50',lowerTolerance:'-0.096',upperTolerance:'-0.08',unit:'mm',inspectionMethod:'CALIPER',inspectionFrequency:'EACH_PART',evaluationMethod:'VALUE',result:'',status:''};
const context={methods:[{value:'CALIPER'}],pageCount:2};
const check=record=>api.checkInformation(record,context);
test('Planning completeness ignores results, approval, optional zone and snapshot; never mutates input',()=>{
  const before=JSON.stringify(base);assert.equal(check(base).length,0);assert.equal(JSON.stringify(base),before);
  assert.equal(check({...base,result:'FAIL',status:'rejected'}).length,0);
});
test('Missing methods, frequency and dimensions are independently identifiable',()=>{
  const issues=check({...base,inspectionMethod:'',inspectionFrequency:'',nominalValue:'',lowerTolerance:'',upperTolerance:''});
  for(const code of ['method','frequency','nominal','tolerance'])assert.ok(issues.some(i=>i.code===code),code);
  assert.ok(check({...base,inspectionMethod:'REMOVED'}).some(i=>i.code==='method'));
});
test('Zero tolerances and one-sided limits are valid; invalid numeric data and reversed bounds are flagged',()=>{
  assert.equal(check({...base,nominalValue:'0',lowerTolerance:'0',upperTolerance:'0'}).length,0);
  assert.equal(check({...base,nominalValue:'',lowerTolerance:'',upperTolerance:'',upperLimit:'5'}).length,0);
  assert.ok(check({...base,lowerTolerance:'0.2',upperTolerance:'0.1'}).some(i=>i.code==='inconsistent'));
  assert.ok(check({...base,nominalValue:'abc'}).some(i=>i.code==='inconsistent'));
});
test('Textual notes do not require numeric dimensions, units or tolerances',()=>{
  const note={...base,type:'Not',requirement:'Çapakları alınız',nominalValue:'',unit:'',lowerTolerance:'',upperTolerance:'',evaluationMethod:'OK_NOT_OK'};
  assert.equal(check(note).length,0);
  assert.ok(check({...note,requirement:''}).some(i=>i.code==='requirement'));
});
test('GD&T needs subtype and tolerance but not a nominal or universally required datums',()=>{
  const gdt={...base,type:'GD&T',gdtSubtype:'flatness',requirement:'Düzlemsellik 0.05',nominalValue:'',lowerTolerance:'',upperTolerance:'0.05'};
  assert.equal(check(gdt).length,0);
  assert.ok(check({...gdt,gdtSubtype:''}).some(i=>i.code==='gdt'));
});
test('Frequency details and drawing page limits are checked',()=>{
  for(const frequencyInterval of ['',0,1.2])assert.ok(check({...base,inspectionFrequency:'EVERY_N_PIECES',frequencyInterval}).some(i=>i.code==='frequency'));
  assert.equal(check({...base,inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:10}).length,0);
  assert.ok(check({...base,inspectionFrequency:'CUSTOM',frequencyNote:''}).some(i=>i.field==='frequencyNote'));
  assert.ok(check({...base,page:3}).some(i=>i.code==='identity'));
});
