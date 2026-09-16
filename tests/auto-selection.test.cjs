const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,loadImage}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const c={window:{},document:{createElement:()=>createCanvas(1,1)}};for(const n of ['snapshot-tools','gdt-vision','auto-selection','balloon-placement'])vm.runInNewContext(fs.readFileSync(`src/${n}.js`,'utf8'),c);
function fixture(angle){
  const source=createCanvas(500,400),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,500,400);g.translate(250,200);g.rotate(angle*Math.PI/180);g.fillStyle='black';g.font='42px Arial';g.fillText('18.8',-90,14);g.font='20px Arial';g.fillText('+0.2',25,-19);g.fillText('-0.1',25,18);g.strokeStyle='black';g.lineWidth=1;g.beginPath();g.moveTo(-115,50);g.lineTo(115,50);g.stroke();
  const a=angle*Math.PI/180;return {source,seed:{cx:250,cy:200,w:240*Math.abs(Math.cos(a))+115*Math.abs(Math.sin(a)),h:240*Math.abs(Math.sin(a))+115*Math.abs(Math.cos(a)),angle:0}};
}
test('Oblique dimension text stays compact at intermediate angles with nearby dimension lines',()=>{
  for(const angle of [-60,-45,-30,30,45,60]){
    const {source,seed}=fixture(angle),result=c.window.ASMachAutoSelection.detect(source,seed,{angleHint:angle});
    assert.ok(result.confident);
    assert.ok(result.rect.w>130&&result.rect.w<210);
    assert.ok(result.rect.h>20&&result.rect.h<80,`angle ${angle}: ${result.rect.h}`);
    assert.ok(Number.isFinite(result.rect.cx)&&Number.isFinite(result.rect.cy));
  }
});
test('Automatic bounds retain nominal and stacked deviations, remove long lines and deskew PDF directions',()=>{
  for(const angle of [-90,-31,0,24,90,180]){const {source,seed}=fixture(angle),before=source.toDataURL();
    const result=c.window.ASMachAutoSelection.detect(source,seed,{angleHint:angle});assert.ok(result.confident);assert.ok(Math.abs(Math.cos(result.rect.angle*Math.PI/180)-Math.cos(angle*Math.PI/180))<1e-6);
    assert.ok(result.rect.w>130&&result.rect.w<210,`width ${angle}: ${result.rect.w}`);assert.ok(result.rect.h<80,`Construction line must be excluded (${angle}: ${result.rect.h})`);
    assert.equal(source.toDataURL(),before,'Original source is unchanged');
  }
});
test('Asymmetric tolerances do not tilt the nominal baseline',()=>{
 for(const nominal of ['98.4','22.2','22.4','66.2'])for(const tolerances of [['+0.3','0'],['+0.2','0'],['+0.3','-0.1'],['±0.1','']])for(const angle of [0,-30,30,90]){
  const source=createCanvas(440,320),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,440,320);g.translate(220,160);g.rotate(angle*Math.PI/180);g.fillStyle='#0000ff';g.font='32px Arial';g.fillText(nominal,-90,10);g.font='18px Arial';g.fillText(tolerances[0],-12,-9);g.fillText(tolerances[1],-12,15);
  const seed={cx:220,cy:160,w:260,h:240,angle:0};const r=c.window.ASMachAutoSelection.detect(source,seed,{angleHint:angle});assert.ok(r.confident);assert.ok(Math.abs(r.rect.angle-angle)<.1,`${nominal} ${tolerances} ${angle}: ${r.rect.angle}`);assert.ok(r.rect.h>25&&r.rect.h<65);
  if(angle===0){const noHint=c.window.ASMachAutoSelection.detect(source,seed);assert.ok(Math.abs(noHint.rect.angle)<2,`${nominal} without hint: ${noHint.rect.angle}`);}
 }
});
test('Pixels provide a vertical reading axis; blank or ambiguous selections are preserved',()=>{
  const {source,seed}=fixture(-90),result=c.window.ASMachAutoSelection.detect(source,seed);assert.ok(result.confident);assert.ok(Math.abs(result.rect.angle+90)<8);
  const blank=createCanvas(100,100),initial={cx:50,cy:50,w:60,h:60,angle:0};const empty=c.window.ASMachAutoSelection.detect(blank,initial);assert.equal(empty.confident,false);assert.equal(JSON.stringify(empty.rect),JSON.stringify(initial));
});
test('User screenshot: vertical 18.8 becomes a compact horizontal report selection',async t=>{
  const path='C:/Users/gencg/AppData/Local/Temp/codex-clipboard-8a1f5a2b-3ed8-4d1c-bce5-14f6de059a98.png';if(!fs.existsSync(path)){t.skip('Diagnostic screenshot unavailable');return;}
  const img=await loadImage(path),canvas=createCanvas(160,260);canvas.getContext('2d').drawImage(img,60,250,160,260,0,0,160,260);
  const result=c.window.ASMachAutoSelection.detect(canvas,{cx:106,cy:106,w:56,h:135,angle:0},{angleHint:-90});
  assert.ok(result.confident);assert.ok(result.rect.w>85);assert.ok(result.rect.h<50);assert.equal(result.rect.angle,-90);
});
test('Balloon planning avoids page edges and other balloons and prefers low-ink space',()=>{
  const p=c.window.ASMachBalloonPlacement,points=[{x:120,y:100},{x:220,y:100},{x:220,y:140},{x:120,y:140}];
  const options={points,width:400,height:300,size:40,gap:8};const right=p.choose(options);assert.equal(right.x,248);assert.equal(right.anchor.x,220);
  const open=p.choose({...options,ink:x=>x>220?1:0});assert.ok(open.x<248);
  const occupied=p.choose({...options,occupied:[{x:248,y:120,radius:20}]});assert.notEqual(occupied.edge,right.edge);
  assert.equal(p.choose({...options,width:240,height:150,size:160}),null);
  for(const shape of ['circle','square','hexagon']){const found=p.choose({...options,shape});assert.ok(found.inPage);assert.equal(found.overlaps,0);}
});

test('Oblique 4.3 ignores thick drawing lines and corrects a misleading zero PDF angle',()=>{
  for(const angle of [-74,-43,28,67]){
    const source=createCanvas(320,300),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,320,300);
    g.save();g.translate(160,150);g.rotate(angle*Math.PI/180);g.fillStyle='black';g.font='36px Arial';g.fillText('4.3',-25,12);
    g.strokeStyle='black';g.lineWidth=2;g.beginPath();g.moveTo(-60,25);g.lineTo(60,25);g.stroke();g.restore();
    g.strokeStyle='black';g.lineWidth=9;g.beginPath();g.moveTo(50,240);g.lineTo(95,195);g.stroke();
    const result=c.window.ASMachAutoSelection.detect(source,{cx:155,cy:170,w:210,h:190,angle:0},{angleHint:0});
    assert.ok(result.confident);assert.ok(Math.abs(result.rect.angle-angle)<5,`${angle}: ${result.rect.angle}`);
    assert.ok(result.rect.w<85,`Exclude drawing lines: ${result.rect.w}`);assert.ok(result.rect.h<45,`Tight glyph bounds: ${result.rect.h}`);
  }
});

test('Current user screenshot: 4.3 gets a -74 degree tight box, not a square around the part edge',async t=>{
  const path='C:/Users/gencg/AppData/Local/Temp/codex-clipboard-9a9652ba-58b1-4a22-aaa7-913c491e1901.png';
  if(!fs.existsSync(path)){t.skip('Diagnostic screenshot unavailable');return;}
  const img=await loadImage(path),source=createCanvas(127,131);
  // Interior of the selected region, excluding modal handles and UI borders.
  source.getContext('2d').drawImage(img,185,291,127,131,0,0,127,131);
  for(const options of [{},{angleHint:0},{angleHint:-74}]){
    const result=c.window.ASMachAutoSelection.detect(source,{cx:63.5,cy:65.5,w:127,h:131,angle:0},options);
    assert.ok(result.confident);assert.ok(Math.abs(result.rect.angle+74)<3);
    assert.ok(result.rect.w>80&&result.rect.w<100);assert.ok(result.rect.h<43);
    const report=c.window.ASMachSnapshots._test.extract(source,result.rect);
    assert.ok(report.width>report.height*2,'The report and drawing share a deskewed horizontal reading box');
  }
});

test('A tightly selected narrow digit 1 remains part of the detected measurement',()=>{
  const source=createCanvas(120,70),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,120,70);g.fillStyle='black';g.font='32px Arial';g.fillText('10',40,45);
  const result=c.window.ASMachAutoSelection.detect(source,{cx:58,cy:34,w:39,h:30,angle:0},{angleHint:0});
  assert.ok(result.confident);assert.ok(result.rect.w>30,`The leading 1 must be retained: ${result.rect.w}`);
});

test('Configured text padding expands the detected characteristic box equally on every edge',()=>{
  const {source,seed}=fixture(0),tight=c.window.ASMachAutoSelection.detect(source,seed,{angleHint:0,padding:0}),padded=c.window.ASMachAutoSelection.detect(source,seed,{angleHint:0,padding:12});
  assert.ok(tight.confident&&padded.confident);
  assert.ok(Math.abs(padded.rect.w-tight.rect.w-24)<.01,`width delta: ${padded.rect.w-tight.rect.w}`);
  assert.ok(Math.abs(padded.rect.h-tight.rect.h-24)<.01,`height delta: ${padded.rect.h-tight.rect.h}`);
  assert.ok(Math.abs(padded.rect.cx-tight.rect.cx)<.01);
  assert.ok(Math.abs(padded.rect.cy-tight.rect.cy)<.01);
  assert.ok(tight.textHeight>10);
  assert.ok(Math.abs(padded.textHeight-tight.textHeight)<.01,'Padding must not change detected drawing text height');
});

test('103 with sparse leading 1 and stacked +0.05 / 0 does not tilt towards the tolerance',()=>{
 for(const font of ['Arial','Times New Roman','Consolas'])for(const angle of [0,-15,27,90]){
  const source=createCanvas(600,400),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,600,400);g.translate(300,200);g.rotate(angle*Math.PI/180);g.fillStyle='blue';g.font='46px '+font;g.fillText('1 0 3',-120,16);g.font='28px '+font;g.fillText('+0.05',42,-17);g.fillText('0',42,42);g.strokeStyle='blue';g.lineWidth=2;g.beginPath();g.moveTo(-180,50);g.lineTo(190,50);g.stroke();
  const seed={cx:300,cy:200,w:510,h:370,angle:0},r=c.window.ASMachAutoSelection.detect(source,seed);assert.ok(r.confident);assert.ok(Math.abs(((r.rect.angle-angle+270)%180)-90)<2.5,`${font}, ${angle}: ${r.rect.angle}`);assert.ok(r.rect.h<110,'Nearby dimension line excluded');
  if(angle===0){const corrected=c.window.ASMachAutoSelection.detect(source,seed,{angleHint:-8});assert.ok(Math.abs(corrected.rect.angle)<2.5,`${font}: incorrect PDF angle retained: ${corrected.rect.angle}`);}
 }
});

test('Explicitly locked angle wins over automatic glyph orientation',()=>{
 const {source,seed}=fixture(30),r=c.window.ASMachAutoSelection.detect(source,seed,{angleHint:0,lockAngle:true});assert.equal(r.rect.angle,0);
});
