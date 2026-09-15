const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{},console};vm.createContext(ctx);for(const name of ['requirements-engine','inspection-plan','role-plans','characteristic-editing','inspection-reports','bulk-plan','excel-reports'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),ctx);
const w=ctx.window,Q=w.ASMachRequirements,IP=w.ASMachInspectionPlan,RP=w.ASMachRolePlans;
const row=extra=>({id:'a',number:'1',page:1,type:'Uzunluk',unit:'mm',nominalValue:'9',lowerTolerance:'-0.2',upperTolerance:'0.2',lowerLimit:'8.8',upperLimit:'9.2',requirement:'9 ±0.2',inspectionMethod:'CMM',inspectionFrequency:'PER_LOT',evaluationMethod:'VALUE',...extra});
test('Contradictory bounds are not complete, cannot pass and cannot be exported',()=>{
 const r=row({lowerLimit:'0',upperLimit:'100',result:'50'});assert.equal(Q.evaluate(r).status,'invalid');assert.ok(IP.checkInformation(r).some(i=>i.code==='inconsistent'));
 for(const api of [w.ASMachInspectionReports,w.ASMachExcelReports])assert.throws(()=>api.build({metadata:{},annotations:[r]},{mode:'control'}),/çelişiyor/);
 assert.equal(Q.evaluate(row({result:'9.2'})).status,'pass');assert.equal(Q.consistencyErrors(row({lowerTolerance:'',upperTolerance:'',lowerLimit:'0',upperLimit:'100'})).length,0);
 assert.equal(Q.consistencyErrors(row({upperLimit:'9.20000000001'})).length,0);
});
test('Information readiness and draft report distinguish missing measurements without forging approval',()=>{
 const model=w.ASMachInspectionReports.build({metadata:{},annotations:[row({requirement:'',nominalValue:'',lowerTolerance:'',upperTolerance:'',lowerLimit:'',upperLimit:''})]},{mode:'control'});
 assert.equal(model.options.draft,true);assert.ok(model.sheets[0].cells.some(c=>typeof c.value==='string'&&c.value.includes('DRAFT / TASLAK')));assert.ok(model.validation.length>=3);
 assert.equal(w.ASMachInspectionReports.build({metadata:{},annotations:[row()]},{mode:'control'}).options.draft,false);
});
test('Legacy quick bulk updates cannot silently shadow role plans',()=>{
 const r=row({rolePlans:{quality:{...RP.blank(),enabled:true,inspectionMethod:'CMM',inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'10',sampleCount:'3'}}}),before=JSON.stringify(r);
 const result=w.ASMachBulkPlan.apply({state:{annotations:[r]}},['a'],{method:'KUMPAS',frequency:'EVERY_N_PIECES',interval:'25'});assert.ok(result.error);assert.equal(JSON.stringify(r),before);
});
test('Bulk role patches validate the resulting full plan and preserve all unselected role fields',()=>{
 const invalid=w.ASMachCharacteristicEditing.prepare([row()],{roles:{quality:{inspectionMethod:'CMM'}}},()=>null);assert.ok(invalid.errors.some(e=>e.includes('Numune')));
 const r=row({rolePlans:{quality:{...RP.blank(),enabled:true,inspectionMethod:'CMM',inspectionFrequency:'PER_LOT',sampleCount:'3',operation:'OP10',reaction:'STOP'},operator:{...RP.blank(),enabled:true,inspectionMethod:'CALIPER'}}});
 const p=w.ASMachCharacteristicEditing.prepare([r],{roles:{quality:{inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'25'}}},()=>null);assert.equal(p.errors.length,0);assert.equal(p.updates[0].after.rolePlans.quality.sampleCount,'3');assert.equal(p.updates[0].after.rolePlans.quality.operation,'OP10');assert.equal(p.updates[0].after.rolePlans.quality.reaction,'STOP');assert.equal(JSON.stringify(p.updates[0].after.rolePlans.operator),JSON.stringify(r.rolePlans.operator));
});
test('Invalid source decoding leaves annotations, metadata and undo history untouched',async()=>{
 const text=fs.readFileSync('src/app.template.html','utf8'),start=text.indexOf('        async function loadDocumentSource('),end=text.indexOf('\n        }',start);
 const state={annotations:[{id:'old'}],metadata:{partNo:'original'},history:['undo'],fileData:'original'},before=JSON.stringify(state);
 const c={state,window:{pdfjsLib:{getDocument:()=>({promise:Promise.reject(Error('bad PDF'))})}},inferMime:()=>'',dataUrlToBytes:()=>new Uint8Array()};vm.createContext(c);vm.runInContext(text.slice(start,end+10),c);
 await assert.rejects(c.loadDocumentSource({name:'broken.pdf',dataUrl:'bad',annotations:[]}),/bad PDF/);assert.equal(JSON.stringify(state),before);
});
