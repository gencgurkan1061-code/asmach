const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,loadImage,Image}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
Image.prototype.decode=async function(){if(this.complete)return;await new Promise((r,j)=>{this.onload=r;this.onerror=j;});};
function api(){const c={window:{},Image,document:{createElement:()=>createCanvas(1,1)},setTimeout};vm.createContext(c);for(const name of ['requirements-engine','snapshot-tools','gdt-vision','diameter-vision','balloon-placement','automatic-symbols'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),c);return c.window;}
test('Horizontal and vertical omitted diameter prefixes are recovered with their full bounds; plain dimensions stay plain',()=>{
 const root=api();for(const angle of [0,90,-90])for(const prefix of ['Ø','']){
   const source=createCanvas(500,500),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,500,500);g.save();g.translate(250,250);g.rotate(angle*Math.PI/180);g.font='32px Arial';g.fillStyle='black';if(prefix)g.fillText(prefix,-100,10);g.fillText('27.3',-65,10);g.restore();
   const a=angle*Math.PI/180,points=[[-67,-20],[1,-20],[1,12],[-67,12]].map(([x,y])=>({x:250+x*Math.cos(a)-y*Math.sin(a),y:250+x*Math.sin(a)+y*Math.cos(a)})),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
   const word={text:'27.3',x:x/500,y:y/500,w:(Math.max(...points.map(p=>p.x))-x)/500,h:(Math.max(...points.map(p=>p.y))-y)/500,source:'PDF'};
   const result=root.ASMachAutomaticSymbols.diameter(source,word);if(prefix){assert.equal(result?.text,'Ø27.3',String(angle));assert.ok(result.w*result.h>word.w*word.h);assert.equal(result.retainBounds,true);}else assert.equal(result,null);
 }
});
test('Graphical GD&T frames are discovered without any OCR text seeds, including vertical orientation',async()=>{
 const root=api();for(const rotation of [0,90,-90]){
   const source=createCanvas(700,500),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,700,500);g.strokeStyle='black';g.lineWidth=2;g.strokeRect(200,200,230,50);for(const x of [250,380]){g.beginPath();g.moveTo(x,200);g.lineTo(x,250);g.stroke();}g.drawImage(root.ASMachGdtVision._test.symbolTemplate('concentricity'),205,205,40,40);g.font='26px Arial';g.fillStyle='black';g.fillText('0.1',277,235);g.fillText('A',395,235);
   const image=rotation?root.ASMachSnapshots.rotateCanvas(source,rotation):source;let calls=0;const found=await root.ASMachAutomaticSymbols.enrich(image,[],{read:async()=>({text:calls++%2===0?'0.1':'A',confidence:92})});
   const frame=found.find(r=>r.visualGdt&&root.ASMachRequirements.parse(r.text).datumRefs==='A');assert.ok(frame,`rotation ${rotation}`);assert.ok(Number.isFinite(frame.sourceTextHeight),`text height ${rotation}`);assert.ok(frame.sourceTextHeight>=15&&frame.sourceTextHeight<=32,`font height ${frame.sourceTextHeight} at ${rotation}`);root.ASMachApp={state:{metadata:{projectDefaults:{balloonSizeMode:'ocr'}}}};const balloon={number:'9',size:72,sourceTextHeight:frame.sourceTextHeight};root.ASMachBalloonPlacement.autoStyle(balloon,image.width,image.height);assert.ok(balloon.size<72&&balloon.fontSize<balloon.size,`auto balloon ${rotation}`);
 }
});
test('Current screenshot: GD&T symbol and frame survive automatic discovery without PDF text',async t=>{
 const path='C:/Users/gencg/AppData/Local/Temp/codex-clipboard-e2605476-9430-4b45-a950-6f6f76a6e55c.png';if(!fs.existsSync(path))return t.skip('Screenshot unavailable');
 const root=api(),image=await loadImage(path),source=createCanvas(image.width*3,image.height*3);source.getContext('2d').drawImage(image,0,0,source.width,source.height);let calls=0;
 const found=await root.ASMachAutomaticSymbols.enrich(source,[],{read:async()=>({text:calls++%2===0?'±0.1':'A',confidence:90})});
 assert.equal(found.length,1,'Existing coloured dimension boxes are not GD&T');assert.ok(found.some(r=>r.visualGdt&&root.ASMachRequirements.parse(r.text).gdtSubtype==='concentricity'));assert.ok(calls>=2);
});
test('Current screenshot: omitted 27.3 diameter prefix expands the selection down to the real symbol',async t=>{
 const path='C:/Users/gencg/AppData/Local/Temp/codex-clipboard-e2605476-9430-4b45-a950-6f6f76a6e55c.png';if(!fs.existsSync(path))return t.skip('Screenshot unavailable');
 const root=api(),image=await loadImage(path),source=createCanvas(image.width*3,image.height*3);source.getContext('2d').drawImage(image,0,0,source.width,source.height);
 for(const [text,x,y,w,h]of [['27.3 (0/-0.05)',122,356,22,81]]){
   const word={text,x:x/image.width,y:y/image.height,w:w/image.width,h:h/image.height,source:'PDF'};
   const result=root.ASMachAutomaticSymbols.diameter(source,word);assert.equal(result?.text,'Ø'+text);assert.ok(result.y+result.h>word.y+word.h,'Include the real prefix below the nominal');
 }
});
