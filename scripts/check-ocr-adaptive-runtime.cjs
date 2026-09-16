// Actual offline worker regression, with fresh and cached passes kept separate.
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();await page.route(/^https?:/,r=>r.abort());await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 for(const name of ['requirements-engine','measurement-layout','ocr-image-enhancement','ocr-engine'])await page.addScriptTag({content:fs.readFileSync('src/'+name+'.js','utf8')});
 const result=await page.evaluate(async()=>{
  function snapshot(text,italic=false){const c=document.createElement('canvas');c.width=350;c.height=106;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,c.width,c.height);g.fillStyle='#111';g.font=(italic?'italic ':'')+'40px Arial';let x=18;for(const char of text){g.fillText(char,x,70);x+=g.measureText(char).width+3;}const crop=document.createElement('canvas');crop.width=Math.ceil(x+20);crop.height=c.height;crop.getContext('2d').drawImage(c,0,0);return crop.toDataURL('image/jpeg',.42);}
  const image=snapshot('25.4'),first=await ASMachOCR.recognize(image,{enhancement:'auto'});first.text='consumer mutation';const repeated=await ASMachOCR.recognize(image,{enhancement:'auto'});
  const changed=await ASMachOCR.recognize(snapshot('35.4'),{enhancement:'auto'}),fresh=await ASMachOCR.recognize(image,{enhancement:'auto',forceAll:true});
  const signs=[];for(const text of ['R5 ±0.1','R5 +0.1','R5 -0.1']){const data=snapshot(text,!text.includes('-')),im=new Image();im.src=data;await im.decode();const c=document.createElement('canvas');c.width=im.width*2;c.height=im.height*2;c.getContext('2d').drawImage(im,0,0,c.width,c.height);const result=await ASMachOCR.recognize(data,{enhancement:'auto'});signs.push({text,snapshot:data,result,parsed:ASMachApp.parseRequirement(result.text),signs:ASMachOcrEnhancement.toleranceSigns(c),rows:ASMachOcrEnhancement.measurementInkRows(c)});}
  await ASMachOCR.terminate();return{first,repeated,changed,fresh,signs};
 });
 fs.mkdirSync('outputs',{recursive:true});for(const [i,sign]of result.signs.entries())fs.writeFileSync('outputs/ocr-sign-'+i+'.jpg',Buffer.from(sign.snapshot.split(',')[1],'base64'));
 fs.writeFileSync('outputs/ocr-adaptive-runtime.json',JSON.stringify(result,null,2));
 assert.equal(result.repeated.text,'25.4');assert.ok(result.repeated.performance.cacheHits>0);assert.equal(result.repeated.performance.enginePasses,0);
 assert.equal(result.changed.text,'35.4');assert.ok(result.changed.performance.enginePasses>0);assert.equal(result.fresh.performance.cacheHits,0);
 for(const s of result.signs){assert.equal(Number(s.parsed.nominalValue),5,s.text);assert.equal(Number(s.parsed.lowerTolerance),s.text.includes('+')?0:-.1,s.text);assert.equal(Number(s.parsed.upperTolerance),s.text.includes('-')?0:.1,s.text);}
 console.log('PASS immutable raw cache, image invalidation, fresh reads and italic ± / + / - distinction.',JSON.stringify({repeat:result.repeated.performance,fresh:result.fresh.performance}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
