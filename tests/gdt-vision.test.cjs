const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,loadImage,Image}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
// Native image adapter supplies browser decode() while preserving native drawImage inputs.
Image.prototype.decode=async function(){if(this.complete)return;await new Promise((resolve,reject)=>{this.onload=resolve;this.onerror=reject;});};
const c={window:{},Image,document:{createElement:()=>createCanvas(1,1)}};
for(const n of ['requirements-engine','snapshot-tools','gdt-vision','auto-selection'])vm.runInNewContext(fs.readFileSync(`src/${n}.js`,'utf8'),c);
const api=c.window.ASMachGdtVision;
function fixture(type='cylindricity',angle=0){
  const base=createCanvas(340,150),g=base.getContext('2d');g.fillStyle='white';g.fillRect(0,0,340,150);g.strokeStyle='black';g.lineWidth=2;g.strokeRect(55,45,225,60);
  g.beginPath();g.moveTo(115,45);g.lineTo(115,105);g.moveTo(55,45);g.lineTo(20,45);g.lineTo(20,140);g.stroke();
  g.drawImage(api._test.symbolTemplate(type),61,51,48,48);g.fillStyle='black';g.font='32px Arial';g.fillText('0.05',131,86);g.font='20px Arial';g.fillText('Ø50 d6',120,27);g.fillText('KAPLAMA',120,140);
  if(!angle)return base;return c.window.ASMachSnapshots.rotateCanvas(base,angle);
}
test('Frame detection retains outer box and dividers, excluding the attached leader and neighbouring notes',()=>{
  const source=fixture(),before=source.toDataURL(),seed={cx:180,cy:75,w:160,h:47,angle:0},result=c.window.ASMachAutoSelection.detect(source,seed,{angleHint:0});
  assert.ok(result.frame);assert.equal(result.cells.length,2);assert.ok(result.rect.w>225&&result.rect.w<240);assert.ok(result.rect.h>60&&result.rect.h<70);assert.ok(result.rect.cx>160&&result.rect.cx<175);assert.equal(source.toDataURL(),before);
});
test('Rotated frame uses the PDF reading direction and shares deskewed crop coordinates',()=>{
  for(const angle of [-90,-27,31]){
    const source=fixture('position',angle),result=api.findFrame(source,{cx:source.width/2,cy:source.height/2,w:source.width*.78,h:source.height*.7},{angleHint:angle});
    assert.ok(result,`Frame at ${angle}`);assert.equal(result.rect.angle,angle);assert.equal(result.cells.length,2);
  }
});
test('All 14 geometric symbol templates resolve independently; an unfamiliar mark stays unknown',()=>{
  for(const item of c.window.ASMachRequirements.GDT_TYPES)assert.equal(api.classify(api._test.symbolTemplate(item.value)).subtype,item.value);
  const blank=createCanvas(50,50);assert.equal(api.classify(blank).subtype,'unknown');
  const noisy=createCanvas(50,50),g=noisy.getContext('2d');g.fillStyle='white';g.fillRect(0,0,50,50);g.fillStyle='black';g.font='32px Arial';g.fillText('?',10,36);assert.equal(api.classify(noisy).subtype,'unknown');
});
test('Plain text, boxed basic dimension without a symbol compartment and open rectangles are not GD&T frames',()=>{
  for(const boxed of [false,true]){const source=createCanvas(280,100),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,280,100);g.fillStyle='black';g.font='30px Arial';g.fillText('Ø50 ±0.1',35,63);if(boxed){g.strokeStyle='black';g.strokeRect(20,20,240,60);}assert.equal(api.findFrame(source,{cx:140,cy:50,w:280,h:100}),null);}
});
test('Cell OCR cannot turn the symbol into tolerance digits, and unknown symbols cannot inherit general tolerances',async()=>{
  const source=fixture();let calls=0;
  const result=await api.recognize(source.toDataURL(),async()=>{calls++;return {text:'0 . 0 5',confidence:92};});
  assert.equal(calls,1);assert.equal(result.text,'⌭ | 0.05');assert.equal(result.visualGdt,true);
  const parsed=c.window.ASMachRequirements.parse(result.text,'ISO2768-m');assert.equal(parsed.type,'GD&T');assert.equal(parsed.gdtSubtype,'cylindricity');assert.equal(parsed.nominalValue,'');assert.equal(parsed.lowerTolerance,'0');assert.equal(parsed.upperTolerance,'0.05');
  const signed=await api.recognize(source.toDataURL(),async()=>({text:'±0.05',confidence:65}));assert.equal(signed.text,'⌭ | ±0.05');assert.equal(c.window.ASMachRequirements.parse(signed.text).upperTolerance,'0.05');assert.ok(c.window.ASMachRequirements.parse(signed.text).parseWarnings.some(w=>w.includes('±')));
  const lostDecimal=await api.recognize(source.toDataURL(),async()=>({text:'0 0 5',confidence:70}));assert.equal(c.window.ASMachRequirements.parse(lostDecimal.text).upperTolerance,'');
  const failed=await api.recognize(source.toDataURL(),async()=>{throw new Error('Worker unavailable');});assert.ok(failed.visualGdt);assert.ok(failed.needsReview);assert.equal(failed.gdt.cells[1],'?');assert.equal(c.window.ASMachRequirements.parse(failed.text).upperTolerance,'');
  const plus=await api.recognize(source.toDataURL(),async()=>({text:'+',confidence:99}));assert.ok(plus.needsReview);assert.equal(plus.gdt.cells[1],'?');assert.ok(signed.needsReview);
  const unknown=c.window.ASMachRequirements.parse('GD&T | 0.05');assert.equal(unknown.type,'GD&T');assert.equal(unknown.gdtSubtype,'unknown');assert.equal(unknown.upperTolerance,'0.05');assert.ok(unknown.parseWarnings.length);
});
test('User screenshot: actual cylindrical symbol and complete report frame are recognized',async t=>{
  const path='C:/Users/gencg/AppData/Local/Temp/codex-clipboard-a2a60980-941f-4f31-8bf2-1cc6132b1774.png';if(!fs.existsSync(path)){t.skip('Screenshot unavailable');return;}
  const image=await loadImage(path),source=createCanvas(230,80);source.getContext('2d').drawImage(image,65,417,230,80,0,0,230,80);
  const f=api.findFrame(source,{cx:115,cy:40,w:190,h:45});assert.ok(f);assert.ok(f.rect.w>200);assert.ok(f.rect.h>57);
  const framed=c.window.ASMachSnapshots._test.extract(source,f.rect);assert.equal(api.classify(api._test.crop(framed,f.cells[0],5)).subtype,'cylindricity');
});

function datumFixture(){
  const source=createCanvas(410,90),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,410,90);g.strokeStyle='black';g.lineWidth=2;g.strokeRect(10,15,390,60);
  for(const x of [70,220,280,340]){g.beginPath();g.moveTo(x,15);g.lineTo(x,75);g.stroke();}
  g.drawImage(api._test.symbolTemplate('position'),16,21,48,48);g.fillStyle='black';g.font='30px Arial';g.fillText('0.1',95,57);for(const [i,s]of ['A','B','C'].entries())g.fillText(s,238+i*60,57);
  return source.toDataURL();
}
test('Cell failures preserve independently read tolerance and primary / secondary / tertiary datum positions',async()=>{
  for(const values of [['± 0 . 1','A','B','C'],['?','A','B','C'],['0.1','A','8','C'],['Ø0.1(M)','A-B','C(M)','D']]){
    let i=0;const modes=[];const read=await api.recognize(datumFixture(),async(_image,options)=>{modes.push(options.gdtCell);return{text:values[i++],confidence:90};});
    assert.deepEqual(modes,['tolerance','datum','datum','datum']);
    const parsed=c.window.ASMachRequirements.parse(read.text);
    assert.equal(parsed.upperTolerance,values[0]==='?'?'':'0.1');
    assert.equal(parsed.datumRefs,values[1]==='A-B'?'A-B | CⓂ | D':values[2]==='8'?'A |  | C':'A | B | C');
    assert.equal(parsed.lowerTolerance,values[0]==='?'?'':'0');
  }
  let index=0;const partial=await api.recognize(datumFixture(),async()=>{if(index++===0)throw Error('cell failed');return{text:['A','B','C'][index-2],confidence:90};});
  assert.equal(c.window.ASMachRequirements.parse(partial.text).datumRefs,'A | B | C');
});

test('Zone prefix matching distinguishes ± from real leading digits and retains screenshot tolerance pixels',async t=>{
  for(const digit of '0123456789'){
    const source=createCanvas(180,55),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,180,55);g.fillStyle='black';g.font='32px Arial';g.fillText(digit+'0.1',5,40);assert.equal(api._test.zonePrefix(source),null,`Must not strip ${digit}`);
  }
  const path='C:/Users/gencg/AppData/Local/Temp/codex-clipboard-9c42788b-f90e-47f9-8a07-3596e4328dd1.png';if(!fs.existsSync(path)){t.skip('Screenshot unavailable');return;}
  const image=await loadImage(path),cell=createCanvas(110,40);cell.getContext('2d').drawImage(image,101,242,110,40,0,0,110,40);
  assert.equal(api._test.zonePrefix(cell)?.prefix,'±');
});
