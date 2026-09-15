const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const c={window:{},atob,Uint8Array,DataView,document:{createElement:()=>createCanvas(1,1)}};
for(const n of ['requirements-engine','gdt-vision','gdt-report','inspection-plan','role-plans','report-brand','excel-reports','inspection-reports','fai-template'])vm.runInNewContext(fs.readFileSync(`src/${n}.js`,'utf8'),c);
c.window.ASMachReportLogo='data:image/png;base64,'+fs.readFileSync('src/assets/report-logo.png').toString('base64');
const source=createCanvas(50,50).toDataURL(),plan={...c.window.ASMachRolePlans.blank(),enabled:true,inspectionMethod:'Kumpas',inspectionFrequency:'PER_LOT',sampleMode:'table',sampleLevel:'G2'};
const state={metadata:{partNo:'TEST'},annotations:[{id:'a',number:'1',type:'Çap',requirement:'Ø20',snapshot:source,rolePlans:{operator:plan},page:1},{id:'b',number:'2',type:'GD&T',upperTolerance:'0.1',gdtSubtype:'concentricity',datumRefs:'A',snapshot:source,rolePlans:{operator:plan},page:1}]};
test('All main reports are branded, English first and omit raw snapshots even when legacy image option is true',()=>{
 for(const mode of ['control','characteristics','intermediate']){const m=c.window.ASMachInspectionReports.build(state,{mode,lotSize:400,orderQuantity:1000,includeSnapshots:true,role:'both'});assert.equal(m.options.includeSnapshots,false);assert.match(m.sheets[0].cells[0].value,/^[A-Z].*\n/);assert.ok(m.sheets.every(s=>s.images.some(i=>i.name==='Şenyüz Makine')));assert.ok(m.sheets[0].images.some(i=>i.name==='GD&T 2'));assert.ok(m.sheets.flatMap(s=>s.images).every(i=>i.dataUrl!==source));assert.ok(m.sheets[0].cells.some(c=>String(c.value).includes('Document ID')));assert.equal(m.sheets[0].paperSize,9);}
});
test('FAI and legacy measurement outputs keep field numbers but use generated frames only',()=>{
 for(const mode of ['as9102c','form3','inspection','gdt']){const m=c.window.ASMachExcelReports.build(state,{mode});assert.ok(m.sheets.every(s=>s.images.some(i=>i.name==='Şenyüz Makine')));assert.ok(m.sheets.flatMap(s=>s.images).every(i=>i.dataUrl!==source));if(mode==='as9102c')assert.ok(m.sheets[0].cells.some(c=>String(c.value).startsWith('26. Comments\nAçıklamalar')));}
 const saved=c.window.ASMachGdtReport;c.window.ASMachGdtReport=null;const m=c.window.ASMachExcelReports.build(state,{mode:'inspection'});assert.equal(m.sheets[0].images.filter(i=>i.name.startsWith('GD&T')).length,0);c.window.ASMachGdtReport=saved;
});
test('Unknown user text and source records are never translated or mutated; bilingual wrapping fits merged spans',()=>{
 const original=JSON.stringify(state);assert.equal(c.window.ASMachReportBrand.text('YÜZEYE MARKALAMA YAPILMAMALIDIR.'),'YÜZEYE MARKALAMA YAPILMAMALIDIR.');c.window.ASMachInspectionReports.build(state,{mode:'control',lotSize:400,orderQuantity:1000});assert.equal(JSON.stringify(state),original);
 const m=c.window.ASMachExcelReports.build(state,{mode:'as9102c'}),s=m.sheets[0];assert.ok(s.heights[15]>=34);assert.equal(s.paperSize,9);assert.equal(m.sheets[2].paperSize,8);
});
