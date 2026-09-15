const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const {xml2js}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/xml-js');
const c={window:{},atob,Uint8Array,DataView};vm.runInNewContext(fs.readFileSync('src/excel-reports.js','utf8'),c);const api=c.window.ASMachExcelReports;
const png=createCanvas(180,40).toDataURL('image/png');
c.window.ASMachGdtReport={image:item=>item.type==='GD&T'?png:null};
const state={metadata:{partNo:'P001',drawingNo:'D001',drawingRevision:'C',fai:{partName:'Test',fairIdentifier:'FAI-001'}},annotations:Array.from({length:13},(_,i)=>({number:String(i+1),page:1,type:i===0?'GD&T':'Çap',requirement:'Ø27.3 (0/-0.05)',nominalValue:'27.3',lowerTolerance:'-0.05',upperTolerance:'0',result:i===1?'0':'',zone:'B2',snapshot:png,inspectionMethod:'Kumpas'}))};
test('AS9102C exports all three numbered forms, blank approvals and repeated Form 3 headers',()=>{
  const model=api.build(state),files=api.files(model);assert.equal(model.sheets.map(s=>s.name).join(','),'Form 1,Form 2,Form 3');
  const first=model.sheets[0];for(let n=1;n<=26;n++)assert.ok(first.cells.some(c=>String(c.value).startsWith(`${n}. `)),`Form 1 field ${n}`);
  const second=model.sheets[1];for(let n=1;n<=13;n++)assert.ok(second.cells.some(c=>String(c.value).startsWith(`${n}. `)),`Form 2 field ${n}`);
  assert.ok(first.cells.some(c=>c.value==='20. FAIR Verified By\n'));
  assert.equal(model.sheets[2].breaks.length,2);assert.equal(model.sheets[2].images.length,1);
  const form3=model.sheets[2];
  const pageHeight=Array.from({length:15},(_,r)=>form3.heights[r]||18).reduce((a,b)=>a+b,0);
  assert.ok(pageHeight<=612-0.6*72,'Each Form 3 page fits inside landscape Letter printable height');
  assert.equal(model.sheets[2].images[0].c,8,'Snapshot is inside Form 3 field 8, not a distant extra column');
  assert.equal(model.sheets[2].cells.filter(c=>c.value==='4. FAIR Identifier\nFAI-001').length,3);
  assert.ok(model.sheets[2].cells.some(c=>c.value===0),'A measured zero stays numeric');
  for(const [name,data] of Object.entries(files))if(name.endsWith('.xml')||name.endsWith('.rels'))assert.doesNotThrow(()=>xml2js(data),name);
  assert.deepEqual(Buffer.from(files['xl/media/s3image1.png']),Buffer.from(png.split(',')[1],'base64'));
  assert.match(files['xl/worksheets/sheet3.xml'],/orientation="landscape"/);assert.match(files['xl/worksheets/sheet1.xml'],/orientation="portrait"/);
});
test('Report modes include visible snapshots and preserve every row without overlapping merged cells',()=>{
  for(const mode of ['as9102c','form3','inspection','gdt']){
    const m=api.build(state,{mode});for(const sheet of m.sheets){const occupied=new Set();for(const cell of sheet.cells){assert.ok(cell.c+cell.cs<=sheet.n);for(let r=cell.r;r<cell.r+cell.rs;r++)for(let col=cell.c;col<cell.c+cell.cs;col++){const key=`${r}:${col}`;assert.ok(!occupied.has(key),`${mode}/${sheet.name} overlap ${key}`);occupied.add(key);}}}
    if(mode==='inspection')assert.equal(m.sheets[0].images.length,1);
    if(mode==='gdt')assert.equal(m.sheets[0].images.length,1);
  }
  assert.equal(api.build(state,{mode:'inspection',includeSnapshots:false}).sheets[0].images.length,1);
});
