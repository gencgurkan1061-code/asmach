const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,loadImage}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const c={window:{}};vm.runInNewContext(fs.readFileSync('src/diameter-vision.js','utf8'),c);
function fixture(symbol,angle){
  const source=createCanvas(280,100),g=source.getContext('2d');g.fillStyle='white';g.fillRect(0,0,280,100);g.fillStyle='black';g.strokeStyle='black';g.lineWidth=2;
  if(symbol==='phi'||symbol==='slash'){
    g.beginPath();g.arc(36,48,15,0,Math.PI*2);g.stroke();g.beginPath();
    if(symbol==='phi'){g.moveTo(36,26);g.lineTo(36,70);}else{g.moveTo(23,64);g.lineTo(49,32);}g.stroke();
  }else{g.font='42px Arial';g.fillText(symbol,20,64);}
  g.font='42px Arial';g.fillText('27.3',68,64);g.font='20px Arial';g.fillText('0',190,35);g.fillText('-0.05',190,65);
  const out=createCanvas(angle%180?100:280,angle%180?280:100),ctx=out.getContext('2d');ctx.translate(out.width/2,out.height/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(source,-140,-50);return out;
}
test('Graphical diameter prefix is recovered in four orientations without converting 0 or 8',()=>{
  for(const angle of [0,90,180,270])for(const symbol of ['phi','slash','0','8','B','']){
    const result=c.window.ASMachDiameterVision.detect(fixture(symbol,angle),'27.3');
    assert.equal(result.diameter,['phi','slash'].includes(symbol),`${symbol}/${angle}`);
  }
});
test('Visual evidence repairs a confused prefix and preserves numeric and tolerance signs',()=>{
 const api=c.window.ASMachDiameterVision,evidence=api.detect(fixture('phi',0),'27.3');
 for(const prefix of ['©','O','Φ']){const reading={text:prefix+'27.3 (0/-0.05)',angle:0};const fixed=api.recover(reading,evidence);assert.equal(fixed.text,'Ø27.3 (0/-0.05)');assert.equal(fixed.rawText,reading.text);}
 for(const text of ['027.3','27.3 ±0.05','8 27.3'])assert.equal(api.recover({text,angle:0},evidence).text,text);
 assert.equal(api.recover({text:'O27.3',angle:0},{diameter:false}).text,'O27.3');assert.equal(api.recover({text:'O27.3',angle:90},evidence).text,'O27.3');
});
test('User screenshot regression: vertical graphical diameter omitted from PDF text',async t=>{
  const path='C:/Users/gencg/AppData/Local/Temp/codex-clipboard-377aa3b1-b9a1-42fd-b3af-69c3c4205b8d.png';
  if(!fs.existsSync(path)){t.skip('Local diagnostic screenshot is no longer available');return;}
  const img=await loadImage(path),canvas=createCanvas(85,250),ctx=canvas.getContext('2d');
  ctx.drawImage(img,140,128,85,250,0,0,85,250);
  assert.equal(c.window.ASMachDiameterVision.detect(canvas,'27.3').diameter,true);
});
