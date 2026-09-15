const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const context={window:{}};vm.createContext(context);
  const html=fs.readFileSync('src/app.template.html','utf8');vm.runInContext(html.slice(html.indexOf('function parseTechnicalRequirementLegacy('),html.indexOf('function technicalTextScore(')),context);
  for(const name of ['requirements-engine','region-measurements'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),context);
  const nodes={},events={},container={querySelector:s=>nodes[s]||=( {value:'',dataset:{}} ),addEventListener:(name,fn)=>events[name]=fn,
    set innerHTML(html){for(const m of html.matchAll(/<input data-measure="([^"]+)"[^>]*value="([^"]*)"/g))this.querySelector(`[data-measure="${m[1]}"]`).value=m[2];this.querySelector('[data-measure="type"]').value='Çap';this.querySelector('[data-region-text]').value='Ø24.5';}};
  const record={type:'Çap',nominalValue:'24.5',unit:'mm',lowerTolerance:'',upperTolerance:'',requirement:'Ø24.5',inspectionFrequency:'PER_SHIFT',inspectionMethod:'CALIPER'};
  const api=context.window.ASMachRegionMeasurements,app={parseRequirement:t=>context.window.ASMachRequirements.parse(t,'',context.parseTechnicalRequirementLegacy)};
  return{api,record,container,nodes,events,app};
}

test('Limit-derived nominal survives region edits and manual reference keeps original endpoints',()=>{
 const f=fixture(),r=f.app.parseRequirement('0.596 MAX 0.586 MIN');
 const same=f.api.derive(r,{type:r.type,unit:r.unit,nominalValue:r.nominalValue,lowerTolerance:r.lowerTolerance,upperTolerance:r.upperTolerance});
 assert.equal(same.nominalSource,'limit_midpoint');assert.equal(same.nominalValue,'0.591');assert.equal(same.lowerLimit,'0.586');
 const changed=f.api.derive(r,{type:r.type,unit:r.unit,nominalValue:'0.590',lowerTolerance:r.lowerTolerance,upperTolerance:r.upperTolerance});
 assert.equal(changed.nominalSource,'manual');assert.equal(changed.lowerLimit,'0.586');assert.equal(changed.upperLimit,'0.596');assert.equal(changed.lowerTolerance,'-0.004');assert.equal(changed.upperTolerance,'0.006');
});
test('Symmetric entry derives deviations, decimal limits and requirement; blank and zero remain distinct',()=>{
  const f=fixture(),form=f.api.mount(f.container,f.record,f.app),s=f.nodes['[data-symmetric]'];
  assert.equal(Object.keys(form.read()).length,0,'Untouched geometry-only edit preserves original fields');
  s.value='0,05';s.oninput();const result=form.read();
  assert.equal(result.lowerTolerance,'-0.05');assert.equal(result.upperTolerance,'0.05');assert.equal(result.lowerLimit,'24.45');assert.equal(result.upperLimit,'24.55');assert.match(result.requirement,/Ø24.5 ±0.05/);
  assert.equal(f.record.lowerTolerance,'');assert.equal(f.record.inspectionFrequency,'PER_SHIFT');
  s.value='0';s.oninput();assert.equal(form.read().lowerTolerance,'0');assert.equal(form.read().lowerLimit,'24.5');
  f.nodes['[data-measure="lowerTolerance"]'].value='';f.nodes['[data-measure="upperTolerance"]'].value='';assert.equal(form.read().lowerLimit,'');assert.doesNotMatch(form.read().requirement,/0\/0/);
});
test('Re-reading split decimal tolerance fixes zero truncation; direct overrides and invalid ranges are respected',()=>{
  const f=fixture(),form=f.api.mount(f.container,f.record,f.app);
  form.applyText('Ø 2 4 . 5 ± 0 . 0 5');assert.equal(form.read().lowerTolerance,'-0.05');assert.equal(form.read().lowerLimit,'24.45');assert.equal(form.read().ocrText,'Ø 2 4 . 5 ± 0 . 0 5');
  const lower=f.nodes['[data-measure="lowerTolerance"]'];lower.value='-0.02';f.events.input({target:{dataset:{measure:'lowerTolerance'}}});assert.equal(form.read().lowerLimit,'24.48');assert.equal(f.nodes['[data-symmetric]'].value,'');
  lower.value='0.2';assert.throws(()=>form.read(),/Alt tolerans/);lower.value='abc';assert.throws(()=>form.read(),/geçerli sayı/);
});
