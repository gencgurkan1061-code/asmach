'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/app.template.html','utf8');
function host(name){
  const start=new RegExp('^        (?:async )?function '+name+'\\(','m').exec(source);
  assert.ok(start,name+' exists');
  const end=source.indexOf('\n        }',start.index);
  return source.slice(start.index,end+'\n        }'.length);
}
function context(){
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false});return nodes.get(id);};
  const c=vm.createContext({window:{},console,document:{querySelector:selector=>node(selector)},state:{generalTolerance:{standard:'',unit:'mm'},annotations:[]}});
  for(const name of ['requirements-engine','inspection-plan','role-plans','characteristic-editing'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),c);
  const start=source.indexOf('function parseTechnicalRequirementLegacy('),end=source.indexOf('function technicalTextScore(',start);
  vm.runInContext(source.slice(start,end),c);
  for(const name of ['parseTechnicalRequirement','recalculateAnnotationLimits','ocrRequirementRecord','updateOcrStructuredField','changeOcrMeasurementType','parseOcrRequirement','updateOcrRequirement','updateOcrFieldsFromText'])vm.runInContext(host(name),c);
  c.elements=Object.fromEntries(['ocrCharacteristicType','ocrNominal','ocrLowerTolerance','ocrUpperTolerance','ocrUnit','ocrRecognizedText','ocrGeneralTolerance','ocrStatusText','ocrReviewConfirmButton'].map(name=>[name,node('#'+name)]));
  c.updateOcrGdtReport=record=>{c.lastPreview=record;};
  c.applyParsedOcrFields=parsed=>{
    const e=c.elements;e.ocrCharacteristicType.value=parsed.type;e.ocrNominal.value=parsed.nominalValue||'';e.ocrLowerTolerance.value=parsed.lowerTolerance||'';e.ocrUpperTolerance.value=parsed.upperTolerance||'';e.ocrUnit.value=parsed.unit||'';
    c.state.pendingRecognition.requirementParsed=parsed;c.updateOcrRequirement();
  };
  c.load=(raw,extra={})=>{
    const parsed=c.parseTechnicalRequirement(raw);c.elements.ocrRecognizedText.value=raw;
    c.state.pendingRecognition={requirementParsed:parsed,requirementDraft:raw,requirementMode:'auto',...extra};
    c.applyParsedOcrFields(parsed);return c.state.pendingRecognition;
  };
  c.edit=(key,value)=>{
    const names={nominalValue:'ocrNominal',lowerTolerance:'ocrLowerTolerance',upperTolerance:'ocrUpperTolerance',unit:'ocrUnit'};
    c.elements[names[key]].value=value;c.updateOcrStructuredField(key,value);
  };
  c.nodes=nodes;return c;
}

test('Explicit nominal/tolerance edits replace manual requirements and preserve separate OCR source',()=>{
  const c=context(),p=c.load('Ø12 ±0.1',{requirementMode:'manual',requirementDraft:'OLD MANUAL'});
  c.edit('nominalValue','15');assert.equal(p.requirementMode,'auto');assert.match(p.requirementDraft,/Ø15/);assert.match(p.requirementDraft,/±0.1/);
  assert.equal(c.elements.ocrRecognizedText.value,'Ø12 ±0.1');assert.equal(c.lastPreview.lowerLimit,'14.9');assert.equal(c.lastPreview.upperLimit,'15.1');
  c.edit('upperTolerance','0.2');assert.match(p.requirementDraft,/\+0.2/);assert.doesNotMatch(p.requirementDraft,/OLD/);
});

test('Limit-derived nominal edits preserve source bounds and mark the nominal as manual',()=>{
  const c=context(),p=c.load('0.205 MAX 0.198 MIN');c.edit('nominalValue','0.2');
  assert.equal(c.lastPreview.nominalValue,'0.2');assert.equal(c.lastPreview.lowerLimit,'0.198');assert.equal(c.lastPreview.upperLimit,'0.205');
  assert.equal(c.lastPreview.nominalSource,'manual');assert.match(p.requirementDraft,/0.198/);assert.match(p.requirementDraft,/0.205/);
  c.edit('upperTolerance','0.01');assert.equal(c.lastPreview.limitDimension,false);assert.match(p.requirementDraft,/0.2/);assert.equal(c.lastPreview.upperLimit,'0.21');
});

test('Type changes use current edits, clear incompatible fields and assign the new default unit',()=>{
  const c=context(),p=c.load('M12x1.25-6H');c.edit('nominalValue','14');
  c.elements.ocrCharacteristicType.value='Açı';c.changeOcrMeasurementType('Açı');
  assert.equal(c.lastPreview.nominalValue,'14');assert.equal(c.lastPreview.unit,'°');assert.equal(c.lastPreview.threadClass,'');assert.equal(c.lastPreview.threadPitch,'');assert.match(p.requirementDraft,/14(?:\.0+)?°/);assert.doesNotMatch(p.requirementDraft,/M12|6H/);
  c.elements.ocrCharacteristicType.value='GD&T';c.changeOcrMeasurementType('GD&T');
  assert.equal(c.lastPreview.nominalValue,'');assert.equal(c.lastPreview.upperTolerance,'');assert.equal(p.requirementDraft,'');
});

test('Explicit OCR text edits replace stale extra fields and stale forced type',()=>{
  const c=context(),p=c.load('M12x1.25-6H',{forcedType:'Diş',structuredEdits:{threadClass:'6g',threadPitch:'2'},requirementMode:'manual',requirementDraft:'OLD'});
  c.elements.ocrRecognizedText.value='Ra 1.6';c.updateOcrFieldsFromText({target:c.elements.ocrRecognizedText});
  assert.equal(c.lastPreview.type,'Yüzey');assert.equal(c.lastPreview.threadPitch,'');assert.equal(c.lastPreview.threadClass,'');assert.equal(p.requirementMode,'auto');assert.match(p.requirementDraft,/Ra/);assert.match(p.requirementDraft,/1.6/);
});

test('Incomplete OCR text preserves the last valid fields and blocks confirmation until corrected',()=>{
  const c=context(),p=c.load('Ø12 ±0.1');const before=p.requirementDraft;
  for(const text of ['', 'unreadable']){
    c.elements.ocrRecognizedText.value=text;c.updateOcrFieldsFromText({target:c.elements.ocrRecognizedText});
    assert.ok(p.textEditError);assert.equal(c.elements.ocrReviewConfirmButton.disabled,true);assert.equal(c.elements.ocrNominal.value,'12');assert.equal(p.requirementDraft,before);
  }
  c.elements.ocrRecognizedText.value='Ø20 ±0.2';c.updateOcrFieldsFromText({target:c.elements.ocrRecognizedText});
  assert.equal(p.textEditError,'');assert.equal(c.elements.ocrReviewConfirmButton.disabled,false);assert.equal(c.elements.ocrNominal.value,'20');assert.match(p.requirementDraft,/20/);
});

test('Clearing a required numeric field cannot leave an old requirement displayed',()=>{
  const c=context(),p=c.load('M12x1.25-6H');c.edit('nominalValue','');assert.equal(p.requirementDraft,'');assert.equal(c.nodes.get('#ocrRequirement').value,'');
});

test('Changing a surface MAX value updates its bound instead of dropping the qualifier',()=>{
  const c=context(),p=c.load('Ra <=1.6');c.edit('nominalValue','3.2');
  assert.equal(c.lastPreview.upperLimit,'3.2');assert.equal(c.lastPreview.lowerLimit,'0');assert.match(p.requirementDraft,/≤3.2/);
});

test('An intentional switch to a text type accepts edited text without carrying numeric fields',()=>{
  const c=context(),p=c.load('Ø12');c.elements.ocrRecognizedText.value='Markalama yapılacak';c.updateOcrFieldsFromText({target:c.elements.ocrRecognizedText});assert.ok(p.textEditError);
  c.elements.ocrCharacteristicType.value='Not';c.changeOcrMeasurementType('Not');
  assert.equal(p.textEditError,'');assert.equal(c.lastPreview.nominalValue,'');assert.equal(c.lastPreview.unit,'');assert.equal(p.requirementDraft,'Markalama yapılacak');
});

test('Bulk structured changes regenerate; unrelated metadata edits preserve manual text',()=>{
  const c=context(),api=c.window.ASMachCharacteristicEditing,r={...c.parseTechnicalRequirement('Ø12 ±0.1'),id:'a',number:1,requirement:'manual',requirementMode:'manual',manualFields:['requirement']};
  const metadata=api.prepare([r],{fields:{zone:'F2'}},c.parseTechnicalRequirement);assert.equal(metadata.updates[0].after.requirement,'manual');
  const changed=api.prepare([r],{fields:{type:'Yarıçap'}},c.parseTechnicalRequirement);assert.equal(changed.errors.length,0);assert.equal(changed.updates[0].after.requirementMode,'auto');assert.match(changed.updates[0].after.requirement,/R12/);
  assert.ok(!changed.updates[0].after.manualFields.includes('requirement'));assert.equal(r.requirement,'manual');
});

test('Main inspector type correction clears incompatible thread data before the preview and save',async()=>{
  const c=context(),r={...c.parseTechnicalRequirement('M12x1.25-6H'),id:'a',number:1,requirementMode:'manual',requirement:'old',manualFields:['requirement']};let checkpoints=0;
  c.window.ASMachMessages={confirm:async()=>true,alert:async message=>assert.fail(message)};
  const app={state:{fileData:'doc',generalTolerance:{unit:'mm'}},selectedAnnotation:()=>r,checkpoint:()=>checkpoints++,recordChange:()=>{},renderAll:()=>{}};
  assert.equal(await c.window.ASMachCharacteristicEditing.confirmCorrection(app,r,{type:'Açı'}),true);
  assert.equal(checkpoints,1);assert.equal(r.unit,'°');assert.equal(r.threadPitch,'');assert.equal(r.threadClass,'');assert.match(r.requirement,/12(?:\.0+)?°/);assert.equal(r.requirementMode,'auto');
});

test('Unspecified dimensions get general tolerances; type and nominal changes recompute them',()=>{
 const c=context();c.state.generalTolerance={standard:'ISO 2768-mK',unit:'mm'};c.elements.ocrGeneralTolerance.value='ISO 2768-mK';
 const parsed=c.parseTechnicalRequirement('2','ISO 2768-mK');assert.equal(Number(parsed.upperTolerance),.1);
 const p=c.load('2');c.changeOcrMeasurementType('Pah');
 assert.equal(Number(c.lastPreview.upperTolerance),.2);assert.equal(c.lastPreview.lowerLimit,'1.8');assert.match(p.requirementDraft,/0.2/);
 c.edit('nominalValue','5');assert.equal(Number(c.lastPreview.upperTolerance),.5);assert.equal(c.lastPreview.upperLimit,'5.5');
 c.elements.ocrCharacteristicType.value='Uzunluk';c.changeOcrMeasurementType('Uzunluk');assert.equal(Number(c.lastPreview.upperTolerance),.1);assert.equal(c.lastPreview.lowerLimit,'4.9');
 c.elements.ocrCharacteristicType.value='Yüzey';c.changeOcrMeasurementType('Yüzey');assert.equal(c.lastPreview.lowerTolerance,'');assert.equal(c.lastPreview.toleranceStandard,'');
});

test('Main inspector recomputes derived tolerances after a confirmed type edit and preserves explicit or manual values',async()=>{
 const c=context(),api=c.window.ASMachCharacteristicEditing;c.state.generalTolerance={standard:'ISO 2768-mK',unit:'mm'};
 c.window.ASMachMessages={confirm:async()=>true,alert:async m=>assert.fail(m)};
 for(const [raw,extra,expected]of [['2',{},.2],['103 (+0.05/0)',{},.05],['2',{lowerTolerance:'0',upperTolerance:'.04',lowerLimit:'2',upperLimit:'2.04',toleranceExplicit:false,manualFields:['upperTolerance']},.04]]){
  const r={...c.parseTechnicalRequirement(raw,'ISO 2768-mK'),id:'r',number:1,ocrText:raw,...extra};
  const app={state:c.state,parseRequirement:c.parseTechnicalRequirement,selectedAnnotation:()=>r,checkpoint(){},recordChange(){},renderAll(){}};
  await api.confirmCorrection(app,r,{type:'Pah'});assert.equal(Number(r.upperTolerance),expected,raw);assert.match(r.requirement,/pah/i);
 }
});

test('Refresh clears stale derived values when inapplicable and protects unknown legacy limits, basic, reference and explicit bounds',()=>{
 const c=context(),api=c.window.ASMachCharacteristicEditing,profile={standard:'ISO 2768-mK',unit:'mm'};
 const r={...c.parseTechnicalRequirement('2',profile.standard),ocrText:'2'};
 for(const extra of [{unit:'in'},{type:'Yüzey'},{type:'GD&T'},{type:'Diş'},{type:'Açı',unit:'°',referenceLength:0},{nominalValue:'0.1'},{callout:{basic:true}},{callout:{reference:true}}]){
  const next=api.refreshGeneral({...r,...extra},profile,c.parseTechnicalRequirement);assert.equal(next.upperTolerance,'',JSON.stringify(extra));assert.equal(next.upperLimit,'');
 }
 assert.equal(api.refreshGeneral(r,{standard:''},c.parseTechnicalRequirement).lowerTolerance,'');
 const legacy={type:'Uzunluk',unit:'mm',nominalValue:'2',upperLimit:'2.1',toleranceStandard:''};assert.equal(api.refreshGeneral(legacy,profile,c.parseTechnicalRequirement),legacy);
 const explicit=c.parseTechnicalRequirement('0.205 MAX 0.198 MIN');assert.equal(api.refreshGeneral(explicit,profile,c.parseTechnicalRequirement),explicit);
 for(const raw of ['BASIC 20','(20)']){const next=c.parseTechnicalRequirement(raw,profile.standard);assert.equal(next.upperTolerance,'',raw);}
});

test('Angular reference lengths, custom drawings and ASME precision rules remain type-specific on refresh',()=>{
 const c=context(),api=c.window.ASMachCharacteristicEditing;
 c.state.generalTolerance={standard:'ISO 2768-mK',unit:'mm'};
 const angle=api.refreshGeneral({type:'Açı',unit:'°',nominalValue:'45',referenceLength:25},c.state.generalTolerance,c.parseTechnicalRequirement);assert.equal(Number(angle.upperTolerance),.5);
 c.state.generalTolerance={standard:'CUSTOM',unit:'in',lower:'-.005',upper:'.01'};
 const custom=api.refreshGeneral({type:'Çap',unit:'in',nominalValue:'2'},c.state.generalTolerance,c.parseTechnicalRequirement);assert.equal(Number(custom.lowerTolerance),-.005);assert.equal(Number(custom.upperLimit),2.01);
 c.state.generalTolerance={standard:'ASME Y14.5-2018',unit:'mm',precisionRules:{2:'.05',angle:'.25'}};
 const asme=api.refreshGeneral({type:'Çap',unit:'mm',nominalValue:'20',ocrText:'20.00'},c.state.generalTolerance,c.parseTechnicalRequirement);assert.equal(Number(asme.upperTolerance),.05);
 const noGuess=api.refreshGeneral({...asme,nominalValue:'21'},c.state.generalTolerance,c.parseTechnicalRequirement);assert.equal(noGuess.upperTolerance,'','Do not invent the source decimal precision after editing the nominal');
});
