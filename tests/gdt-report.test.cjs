const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const c={window:{},document:{createElement:()=>createCanvas(1,1)},atob,Uint8Array,DataView};
for(const n of ['number-order','requirements-engine','gdt-vision','gdt-report','excel-reports','fai-template'])vm.runInNewContext(fs.readFileSync(`src/${n}.js`,'utf8'),c);
const engine=c.window.ASMachRequirements,api=c.window.ASMachGdtReport;
const source=createCanvas(100,100).toDataURL(),record={number:'1',page:1,type:'GD&T',gdtSubtype:'concentricity',upperTolerance:'0.1',lowerTolerance:'0',nominalValue:'',datumRefs:'A | B | C',snapshot:source,requirement:'Old OCR text'};
test('Generated frame uses edited type, tolerance and ordered datums, without changing the captured image',()=>{
  const before=JSON.stringify(record),first=api.render(record);assert.equal(first.cells.join('|'),'◎|0.1|A|B|C');assert.notEqual(first.dataUrl,source);assert.equal(JSON.stringify(record),before);
  const changed=api.render({...record,gdtSubtype:'parallelism',upperTolerance:'0.2',datumRefs:'D | E | F'});assert.equal(changed.cells.join('|'),'∥|0.2|D|E|F');assert.notEqual(changed.dataUrl,first.dataUrl);
  assert.equal(api.render({...record,upperTolerance:'',gdtFrame:{tolerance:'10.05'}}).cells[1],'?');
  assert.equal(api.image({...record,type:'Uzunluk'}),source);
});
test('Datum parsing preserves common datums, modifiers, explicit blanks and references beyond the third',()=>{
  assert.equal(engine.datumTokens('A B C').join('|'),'A|B|C');assert.equal(engine.datumTokens('A-BⓂ | | C | D').join('|'),'A-BⓂ||C|D');
  const frame=engine.withGdtSubtype({...record,datumRefs:'A-BⓂ | | C'}).gdtFrame;assert.equal(frame.cells.join('|'),'◎|0.1|A-BⓂ||C');
});
test('Every Excel report mode embeds the generated PNG at text-line height, including the user FAI template',()=>{
  const expected=api.image(record);
  for(const mode of ['as9102c','form3','inspection','gdt']){
    const model=c.window.ASMachExcelReports.build({annotations:[record]},{mode});const pic=model.sheets.flatMap(s=>s.images)[0];assert.ok(pic,mode);assert.equal(pic.dataUrl,expected);assert.ok(pic.height<=16.001);assert.ok(pic.width>pic.height*2);
  }
  const pages=c.window.ASMachFaiTemplate.paginate([record],{},true),pic=pages[0][0].pic;assert.ok(pic.h<=16.001);assert.equal(Buffer.from(pic.bytes).toString('base64'),expected.split(',')[1]);
  assert.equal(c.window.ASMachFaiTemplate.paginate([record],{},false)[0][0].pic,null);
});

// A deterministic diagnostic view of the actual generated canvas, not a mock-up.
if(process.env.ASMACH_REPORT_PREVIEW){
  const sheet=createCanvas(780,200),g=sheet.getContext('2d');g.fillStyle='white';g.fillRect(0,0,780,200);g.fillStyle='#16394b';g.font='16px Arial';g.fillText('Üretilen GD&T çerçevesi',20,25);
  const full=api.render(record);g.drawImage(full.canvas,20,42,full.width/2,full.height/2);g.fillText('Rapor satırı — 16 px görsel yüksekliği',20,140);g.drawImage(full.canvas,355,125,full.width*16/full.height,16);
  fs.mkdirSync('outputs',{recursive:true});fs.writeFileSync('outputs/gdt-report-r17-preview.png',sheet.toBuffer('image/png'));
}
