'use strict';
// Runs only in isolated browser pages. No UI preferences/model files are changed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
let pw;try{pw=require(process.env.ASMACH_PLAYWRIGHT_MODULE||'playwright');}catch(error){if(process.env.ASMACH_PLAYWRIGHT_MODULE)throw error;pw=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/tesseract-finetune'),study=path.join(out,'feedback-study-v1');
const manifest=JSON.parse(fs.readFileSync(path.join(study,'manifest.json'))),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const tracked=['src/ocr-engine.js','src/app.template.html','ASMach_Teknik_Resim_Balonlama.html','ocr/technical-model/activation.json',...['eng','tur','deu'].map(n=>'ocr/lang/'+n+'.traineddata.gz')];
const protectedHashes=()=>Object.fromEntries(tracked.map(n=>[n,hash(fs.readFileSync(path.join(root,n)))]));
const before=protectedHashes(),variants={stock:'ocr/lang/eng.traineddata.gz',starting:'ocr/technical-model/asmtech.traineddata.gz',round1:'outputs/tesseract-finetune/feedback-study-v1/round1-bounded/asmtech.traineddata.gz',round2:'outputs/tesseract-finetune/feedback-study-v1/round2-bounded/asmtech.traineddata.gz'};
const reportFile=path.join(study,'application-evaluation.json');if(fs.existsSync(reportFile))throw Error('Completed pilot report exists');
const mean=a=>a.reduce((n,v)=>n+v,0)/a.length,median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
function summary(rows){return{cases:rows.length,exact:rows.filter(r=>r.ok).length,unreviewedErrors:rows.filter(r=>!r.ok&&!r.needsReview).length,meanMs:mean(rows.map(r=>r.ms)),medianMs:median(rows.map(r=>r.ms))};}
(async()=>{const browser=await pw.chromium.launch({channel:'msedge',headless:true}),pages={},rows=[],cold={},blocked=[];
 try{
  for(const [variant,file] of Object.entries(variants)){
   const page=await browser.newPage();await page.route(/^https?:/,r=>{blocked.push(r.request().url());return r.abort();});await page.goto(pathToFileURL(path.join(root,'ASMach_Teknik_Resim_Balonlama.html')).href);
   if(variant!=='stock')await page.evaluate(model=>{window.ASMachOcrAssets={...ASMachOcrAssets,eng:model};},fs.readFileSync(path.join(root,file)).toString('base64'));
   cold[variant]=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=170;c.height=70;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,c.width,c.height);g.fillStyle='black';g.font='32px Arial';g.fillText('123.456',8,47);const t=performance.now();await ASMachOCR.recognize(c.toDataURL(),{refresh:true});return performance.now()-t;});pages[variant]=page;
  }
  for(let i=0;i<manifest.splits.holdout.length;i++){
   const c=manifest.splits.holdout[i],bytes=fs.readFileSync(path.join(out,c.file+'.png'));if(hash(bytes)!==c.sha256)throw Error('Holdout changed');
   const order=Object.keys(variants);order.push(...order.splice(0,i%order.length));
   for(const variant of order){
    const r=await pages[variant].evaluate(async image=>{const start=performance.now(),ocr=await ASMachOCR.recognize(image,{refresh:true,enhancement:'auto'});return{ms:performance.now()-start,text:ocr.text,rawText:ocr.rawText,needsReview:!!ocr.needsReview,error:ocr.error,parsed:ASMachApp.parseRequirement(ocr.text,'')};},'data:image/png;base64,'+bytes.toString('base64'));
    const failures=Object.entries(c.expected).filter(([k,v])=>typeof v==='number'?String(r.parsed[k]??'').trim()===''||!Number.isFinite(Number(r.parsed[k]))||Math.abs(Number(r.parsed[k])-v)>1e-9:r.parsed[k]!==v).map(([field,expected])=>({field,expected,actual:r.parsed[field]??null}));if(r.error)failures.push({field:'ocrError',actual:r.error});
    rows.push({id:c.id,variant,family:c.family,quality:c.quality,...r,ok:!failures.length,failures});
   }
   if((i+1)%5===0){fs.writeFileSync(path.join(study,'application-progress.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify({tested:i+1,of:40,results:Object.fromEntries(Object.keys(variants).map(v=>[v,summary(rows.filter(r=>r.variant===v))]))}));}
  }
  const after=protectedHashes();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Production artifacts changed during pilot');
  const report={synthetic:true,realUserCorrections:0,unseenMeasurements:40,trainingTestOverlap:0,createdAt:new Date().toISOString(),productionUnchanged:true,protectedHashes:after,coldStartMs:cold,blockedRequests:blocked,modelHashes:Object.fromEntries(Object.entries(variants).map(([v,p])=>[v,hash(fs.readFileSync(path.join(root,p)))])),summaries:Object.fromEntries(Object.keys(variants).map(v=>[v,summary(rows.filter(r=>r.variant===v))])),rows};
  fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined,protectedHashes:undefined},null,2));
  for(const page of Object.values(pages))await page.evaluate(()=>ASMachOCR.terminate());
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
