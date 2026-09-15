'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('src/requirements-engine.js','utf8'),c);
const api=c.window.ASMachRequirements;
const base={type:'Çap',nominalValue:'50',lowerTolerance:'-0.096',upperTolerance:'-0.080',lowerLimit:'49.904',upperLimit:'49.920',fitClass:'d6',unit:'mm',requirementMode:'auto',ocrText:'Ø5 0 d 6',requirement:'Ø5 0 d 6'};

test('Requirements derive from fields, preserve OCR and distinguish symmetric / asymmetric / one-sided deviations',()=>{
  const p=api.syncRequirement(base);assert.equal(p.requirement,'Ø50 d6 (-0.08/-0.096)');assert.equal(p.ocrText,base.ocrText);
  assert.equal(api.generateRequirement({...base,fitClass:'',lowerTolerance:'-0.1',upperTolerance:'0.1'}),'Ø50 ±0.1');
  assert.equal(api.generateRequirement({...base,fitClass:'',lowerTolerance:'-0.05',upperTolerance:'0'}),'Ø50 (0/-0.05)');
  assert.equal(api.generateRequirement({...base,fitClass:'',lowerTolerance:'0',upperTolerance:'0'}),'Ø50 (0/0)');
  assert.equal(api.generateRequirement({...base,fitClass:'',lowerTolerance:'',upperTolerance:'0.2'}),'Ø50 (üst +0.2)');
  assert.equal(api.generateRequirement({...base,type:'Yarıçap',fitClass:'',nominalValue:'5',lowerTolerance:'',upperTolerance:''}),'R5');
});

test('Limit dimensions publish ordered limits instead of concatenated OCR or inferred nominal',()=>{
  const record={type:'Uzunluk',nominalValue:'49.912',lowerTolerance:'-0.008',upperTolerance:'0.008',lowerLimit:'49.904',upperLimit:'49.920',toleranceStandard:'Metinde limit ölçü (nominal orta noktadan hesaplandı)'};
  assert.equal(api.generateRequirement(record),'49.904–49.92');
  assert.equal(api.generateRequirement({type:'Çap',upperLimit:'5',upperInclusive:false}), 'Ø<5');
  assert.equal(api.generateRequirement({type:'Uzunluk',lowerLimit:'0'}),'≥0');
});

test('GD&T, surface, chamfer, thread and angle descriptions use saved subtype fields',()=>{
  assert.equal(api.generateRequirement({type:'GD&T',gdtSubtype:'cylindricity',upperTolerance:'0.05'}),'⌭ | 0.05');
  assert.equal(api.generateRequirement({type:'GD&T',gdtSubtype:'position',upperTolerance:'0.2',datumRefs:'A | B',gdtFrame:{diameter:true,modifiers:['Ⓜ']}}),'⌖ | Ø0.2Ⓜ | A | B');
  assert.equal(api.generateRequirement({type:'Yüzey',nominalValue:'.2',specialDesignator:'Ra',unit:'µm'}),'Ra 0.2 µm');
  assert.equal(api.parse('Ra 0.2').specialDesignator,'Ra');
  assert.equal(api.generateRequirement({type:'Pah',nominalValue:'3.5',chamferAngle:'15'}),'3.5 × 15°');
  assert.equal(api.generateRequirement({type:'Diş',nominalValue:'6',threadPitch:'1',threadClass:'6H'}),'M6 × 1-6H');
  assert.equal(api.generateRequirement({type:'Açı',nominalValue:'30',lowerTolerance:'-.5',upperTolerance:'.5'}),'30° ±0.5');
  assert.equal(api.generateRequirement({type:'Diş',nominalValue:'.25',threadPitch:'20 TPI',unit:'in'}),null,'Do not invent missing inch thread family');
  for(const type of ['Not','Malzeme','Proses','Görsel','Diğer'])assert.equal(api.generateRequirement({type,nominalValue:'50'}),null);
});

test('GD&T characteristic corrections override stale OCR; explicit regeneration also updates OCR with preserved source evidence',()=>{
  for(const ocrText of ['⌖ | Ø0.15 | B | C | D','⏥ | 0,050','⌖ | Ø0.20Ⓜ | AⓂ | B']){
    const parsed=api.parse(ocrText);
    const record={...parsed,gdtSubtype:'parallelism',ocrText,upperTolerance:'0.3',lowerTolerance:'0',upperLimit:'0.3',datumRefs:'C | DⓂ',gdtFrame:{...parsed.gdtFrame,diameter:true,modifiers:['Ⓜ']},quantity:2,decimalPlaces:1,requirement:ocrText,requirementMode:'auto'};
    const expected='2 × ∥ | Ø0.3Ⓜ | C | DⓂ';
    assert.equal(api.generateRequirement(record),expected);
    const synced=api.syncRequirement(record);
    assert.equal(synced.requirement,expected);
    assert.equal(synced.ocrText,ocrText,'Automatic display synchronization does not rewrite source OCR');
    assert.deepEqual(Array.from(synced.gdtFrame.cells),['∥','Ø0.3Ⓜ','C','DⓂ']);
    const forced=api.syncRequirement(record,true);
    assert.equal(forced.requirement,expected);
    assert.equal(forced.ocrText,'∥ | Ø0.3Ⓜ | C | DⓂ');
    assert.equal(forced.originalOcrText,ocrText);
    assert.equal(api.syncRequirement({...forced,upperTolerance:'0.4'},true).originalOcrText,ocrText,'Further corrections retain the first OCR evidence');
    assert.equal(record.ocrText,ocrText,'Synchronization does not mutate its input');
  }
  const cleared={...api.parse('⌖ | Ø0.2Ⓜ | A | B'),gdtSubtype:'circularity',upperTolerance:'0.1',datumRefs:'',gdtFrame:{diameter:false,modifiers:[]},ocrText:'⌖ | Ø0.2Ⓜ | A | B',requirementMode:'auto',decimalPlaces:1};
  assert.equal(api.syncRequirement(cleared).requirement,'○ | 0.1','Explicitly removed diameter, material condition and datums do not return from OCR');
});

test('Manual editing is permanent until explicit regeneration; no fields or raw OCR are reparsed',()=>{
  const manual={...base,requirementMode:'manual',requirement:'Müşterinin özel ifadesi',manualFields:['requirement','upperTolerance']};
  assert.equal(api.syncRequirement({...manual,nominalValue:'60'}).requirement,manual.requirement);
  const generated=api.syncRequirement(manual,true);
  assert.equal(generated.requirementMode,'auto');assert.equal(generated.requirement,'Ø50 d6 (-0.08/-0.096)');
  assert.ok(!generated.manualFields.includes('requirement'));assert.ok(generated.manualFields.includes('upperTolerance'));
  assert.equal(api.syncRequirement({...generated,nominalValue:'55'}).requirement,'Ø55 d6 (-0.08/-0.096)');
  for(const key of ['nominalValue','lowerTolerance','upperTolerance','ocrText'])assert.equal(generated[key],manual[key]);
});

test('Legacy OCR text can migrate to automatic mode but custom / explicitly manual text stays unchanged',()=>{
  const old={...base};delete old.requirementMode;
  assert.equal(api.syncRequirement(old).requirementMode,'auto');
  assert.equal(api.syncRequirement({...old,requirement:'Özel kabul koşulu'}).requirementMode,'manual');
  assert.equal(api.syncRequirement({...old,manualFields:['requirement']}).requirement,base.requirement);
  assert.equal(api.syncRequirement({...old,autoParse:false}).requirement,base.requirement);
  assert.equal(api.syncRequirement({...old,nominalValue:'',lowerLimit:'',upperLimit:''}).requirement,base.requirement,'Insufficient data never deletes the source text');
});
