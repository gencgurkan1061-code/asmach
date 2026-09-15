'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const c={window:{},atob:s=>Buffer.from(s,'base64').toString('binary'),Uint8Array,DataView};vm.createContext(c);
for(const m of ['inspection-plan','role-plans','inspection-reports','excel-reports'])vm.runInContext(fs.readFileSync('src/'+m+'.js','utf8'),c);
const rp=c.window.ASMachRolePlans,reports=c.window.ASMachInspectionReports;
const p={...rp.blank(),enabled:true,inspectionMethod:'CMM',inspectionFrequency:'PER_LOT',sampleMode:'table',sampleLevel:'G2'};
test('Sampling quantity is independent of frequency and rejects conflicting full inspection',()=>{
 const manual={...p,sampleMode:'manual',sampleCount:'3',inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'10'};
 assert.equal(rp.sample(manual,undefined,'quality').count,3);
 assert.equal(rp.sample(manual,100,'quality').count,3);
 assert.ok(rp.sample(manual,2,'quality').error);
 assert.ok(rp.sample({...manual,inspectionFrequency:'EACH_PART'},100,'quality').error);
 assert.equal(rp.sample({...manual,inspectionFrequency:'EACH_PART',sampleMode:'all'},100,'quality').count,100);
 assert.equal(manual.sampleCount,'3');
});
test('Operator sampling and frequency are optional, quality stays required, and entered intervals remain valid',()=>{
 const op={...rp.blank(),enabled:true,inspectionMethod:'CMM'};
 assert.equal(rp.validate({rolePlans:{operator:op}},400),'');assert.equal(rp.sample(op,400,'operator').count,'');
 assert.equal(c.window.ASMachInspectionPlan.validate({rolePlans:{operator:op}}),'');
 assert.ok(rp.validate({rolePlans:{quality:op}},400));
 assert.ok(rp.validate({rolePlans:{operator:{...op,sampleCount:'0'}}},400));
 assert.ok(rp.validate({rolePlans:{operator:{...op,inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:''}}},400));
 assert.equal(rp.validate({rolePlans:{operator:{...op,sampleMode:'none',inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'10'}}},400),'');
 assert.equal(rp.sample({...op,sampleMode:'manual',sampleCount:'3'},400,'operator').count,3);
});
test('All report variants keep optional operator counts blank without inventing samples or rejecting intermediate records',()=>{
 for(const sampleMode of ['none','manual']){const state={metadata:{},annotations:[{id:'op',number:1,page:1,type:'Çap',requirement:'Ø9',rolePlans:{operator:{...rp.blank(),enabled:true,inspectionMethod:'CMM',sampleMode}}}]};
 for(const mode of ['control','characteristics','intermediate']){const model=reports.build(state,{mode,orderQuantity:100,lotSize:100,role:'operator'});const count=model.sheets[1].cells.find(c=>c.r===8&&c.c===6).value;assert.equal(count.value,'');assert.match(count.formula,/IF\(OR\(C9="none",AND\(C9="manual",E9=""\)\),"",/);if(mode==='intermediate'){const values=model.sheets[0].cells.map(c=>c.value);assert.ok(values.includes('Not specified\nBelirtilmedi'));assert.ok(!values.some(v=>typeof v==='string'&&/N\d+:/.test(v)));}}}
});
test('Reference sampling table has all 105 supplied codes and exact interval boundaries',()=>{
 const expected=['AAAAAAB','AAAAABC','AABBBCD','ABBCCDE','BBCCCEF','BBCDDFG','BCDEEGH','BCDEFHJ','CCEFGJK','CDEGHKL','CDFGJLM','CDFHKMN','DEGJLNP','DEGJMPQ','DEHKNQR'];
 rp.starts.forEach((n,i)=>rp.levels.forEach((level,j)=>{assert.equal(rp.sample({...p,sampleLevel:level},n).code,expected[i][j]);if(i<14)assert.equal(rp.sample({...p,sampleLevel:level},rp.starts[i+1]-1).code,expected[i][j]);}));
 assert.equal(rp.sample(p,400).count,50);assert.equal(rp.sample(p,280).count,32);assert.equal(rp.sample(p,281).count,50);assert.equal(rp.sample(p,501).count,80);
 for(const n of ['',0,-1,1,2.5,Infinity])assert.ok(rp.sample(p,n).error);
 assert.equal(rp.sample({...p,sampleMode:'all'},1).count,1);
 assert.ok(rp.sample({...p,sampleMode:'manual',sampleCount:401},400).error);
});
test('Responsibilities remain independent and legacy records are not silently assigned',()=>{
 assert.equal(rp.normalize({inspectionMethod:'CMM'}),null);
 const input={rolePlans:{operator:{...p,inspectionMethod:'KUMPAS'},quality:p}};const normalized=rp.normalize(input);normalized.quality.inspectionMethod='OTHER';assert.equal(input.rolePlans.quality.inspectionMethod,'CMM');assert.equal(normalized.operator.inspectionMethod,'KUMPAS');
 assert.equal(rp.validate(input,400),'');assert.ok(rp.validate({rolePlans:{quality:{...p,inspectionFrequency:'EVERY_N_HOURS',frequencyInterval:0}}}));
 assert.equal(rp.validate({rolePlans:{quality:{...p,inspectionFrequency:'EVERY_N_HOURS',frequencyInterval:2}}}), '');
});
test('Three reports preserve roles and sampling formulas; intermediate form splits all 50 samples without fabricated results',()=>{
 const state={metadata:{partNo:'P1'},annotations:[{id:'a',number:1,page:1,type:'Çap',requirement:'Ø20 (+0.02/-0.05)',rolePlans:{quality:p},result:'20.01'}]};
 for(const mode of ['control','characteristics','intermediate']){const model=reports.build(state,{mode,orderQuantity:400,lotSize:400,role:'both'});assert.equal(model.sheets.length,3);const plan=model.sheets[1];assert.equal(plan.cells.find(c=>c.r===8&&c.c===6).value.value,50);const files=c.window.ASMachExcelReports.files(model);assert.match(files['xl/workbook.xml'],/Print_Titles/);assert.match(files['xl/worksheets/sheet2.xml'],/<f>IF/);assert.match(files['xl/worksheets/sheet1.xml'],/paperSize="9"/);if(mode==='intermediate'){const vals=model.sheets[0].cells.map(c=>c.value);assert.ok(vals.includes('N50: ______'));assert.ok(!vals.includes('20.01'));}}
 assert.throws(()=>reports.build(state,{mode:'control',orderQuantity:1,lotSize:400}),/sipariş/);
 assert.throws(()=>reports.build({...state,annotations:[{...state.annotations[0],rolePlans:null}]},{mode:'control',orderQuantity:400,lotSize:400}),/kontrol yöntemi/);
});
test('Completed legacy plans export without role migration or invented quantities, without mutating source',()=>{
 const state={metadata:{},annotations:[{id:'old',number:1,page:1,type:'Uzunluk',requirement:'9 ±0.2',inspectionMethod:'CMM',inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'10',rolePlans:null}]},before=JSON.stringify(state);
 for(const mode of ['control','characteristics','intermediate']){const m=reports.build(state,{mode,role:'both'}),plan=m.sheets[1];assert.equal(plan.cells.find(c=>c.r===1&&c.c===1).value,'');assert.equal(plan.cells.find(c=>c.r===2&&c.c===1).value,'');assert.equal(plan.cells.find(c=>c.r===8&&c.c===6).value.value,'');assert.ok(m.sheets[0].cells.some(c=>c.value==='Ortak plan (sorumlu atanmamış)'||String(c.value).includes('Ortak plan')));assert.ok(!m.sheets[0].cells.some(c=>c.value==='Kalite'||c.value==='Operatör'));}assert.equal(JSON.stringify(state),before);
 assert.throws(()=>reports.build(state,{mode:'control',role:'quality'}),/Seçilen sorumlu/);
 assert.throws(()=>reports.build({...state,annotations:[{...state.annotations[0],frequencyInterval:'0'}]},{mode:'control'}),/Aralık/);
});
test('Manual sampling needs no lot; table/full sampling requires lot but does not require a purchase quantity',()=>{
 const state={metadata:{},annotations:[{number:1,page:1,type:'Çap',requirement:'Ø9',rolePlans:{quality:{...p,sampleMode:'manual',sampleCount:'3'}}}]};assert.equal(reports.build(state,{mode:'control'}).sheets[1].cells.find(c=>c.r===8&&c.c===6).value.value,3);
 state.annotations[0].rolePlans.quality=p;assert.throws(()=>reports.build(state,{mode:'control'}),/partinin adedini/);assert.equal(reports.build(state,{mode:'control',lotSize:400}).sheets[1].cells.find(c=>c.r===8&&c.c===6).value.value,50);
 assert.throws(()=>reports.build(state,{mode:'control',lotSize:-2}),/pozitif/);
});
