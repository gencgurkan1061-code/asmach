// Actual offline application OCR + field parsing on 100 locked, unseen images.
// Does not train, relabel, install or publish. Default is paired baseline/model.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
let playwright;try{playwright=require(process.env.ASMACH_PLAYWRIGHT_MODULE||'playwright');}catch(error){if(process.env.ASMACH_PLAYWRIGHT_MODULE)throw error;playwright=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const {chromium}=playwright;
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs','tesseract-finetune'),dir=path.join(root,'tests/fixtures/ocr-100');
fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const argument=name=>{const i=process.argv.indexOf(name);if(i<0)return null;if(!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error('Missing value for '+name);return process.argv[i+1];};
const candidateFile=path.resolve(root,argument('--candidate-file')||path.join(out,'asmtech.traineddata.gz'));
const baselineOnly=process.argv.includes('--baseline-only'),candidateOnly=process.argv.includes('--candidate-only');
const mode=baselineOnly?'baseline':candidateOnly?'candidate':'paired';
const isolated=process.argv.includes('--isolated'),tag=argument('--tag');
if(tag&&!/^[a-z0-9-]+$/.test(tag))throw Error('Invalid report tag');
const reportName=mode+(isolated?'-isolated':'')+(tag?'-'+tag:'');
if(fs.existsSync(path.join(out,'evaluation-100-'+reportName+'.json')))throw Error('Completed report exists; use a new --tag to preserve evidence');
const sources=['requirements-engine','measurement-layout','ocr-image-enhancement','diameter-vision','gdt-vision','ocr-engine'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceContents=Object.fromEntries(sources.map(name=>[name,fs.readFileSync(path.join(root,'src',name+'.js'),'utf8')]));
const baselineLanguages=Object.fromEntries(['eng','tur','deu'].map(lang=>[lang,fs.readFileSync(path.join(root,'ocr/lang',lang+'.traineddata.gz'))]));
const runtimeFiles=['ocr/tesseract.min.js','ocr/worker.min.js','ocr/core/tesseract-core-lstm.wasm.js','src/app.template.html'];
const runtimeHashes=Object.fromEntries(runtimeFiles.map(name=>[name,hash(fs.readFileSync(path.join(root,name)))]));
if(manifest.caseCount!==100||manifest.cases.length!==100||manifest.training!==false||manifest.purpose!=='locked-holdout')throw Error('Expected exactly 100 locked, held-out measurements');
const value=(o,key)=>key.split('.').reduce((v,k)=>v?.[k],o);
const equals=(a,b)=>typeof b==='number'?String(a??'').trim()!==''&&Number.isFinite(Number(a))&&Math.abs(Number(a)-b)<1e-9:a===b;
const normalize=s=>String(s||'').normalize('NFC').replace(/[−–]/g,'-').replace(/\s+/g,' ').trim().toUpperCase();
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]||0;
function stats(rows){const times=rows.map(r=>r.ocrMs).sort((a,b)=>a-b);return{cases:rows.length,exactCases:rows.filter(r=>r.ok).length,fieldFailures:rows.reduce((n,r)=>n+r.failures.length,0),incorrectWithoutReview:rows.filter(r=>!r.ok&&!r.needsReview).map(r=>r.id),meanMs:times.reduce((a,b)=>a+b,0)/times.length,medianMs:median(times),p95Ms:times[Math.ceil(times.length*.95)-1]};}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),blocked=[],rows=[],cold={};
 try{
  const pages={};for(const variant of baselineOnly?['baseline']:candidateOnly?['candidate']:['baseline','candidate']){
   const page=await browser.newPage();await page.route(/^https?:/,r=>{blocked.push(r.request().url());return r.abort();});await page.goto(pathToFileURL(path.join(root,'ASMach_Teknik_Resim_Balonlama.html')).href);
   const matches=await page.evaluate(expected=>Object.entries(expected).every(([lang,b64])=>window.ASMachOcrAssets?.[lang]===b64),Object.fromEntries(Object.entries(baselineLanguages).map(([lang,b])=>[lang,b.toString('base64')])));if(!matches)throw Error('Built baseline language files do not match source assets');
   for(const source of Object.values(sourceContents))await page.addScriptTag({content:source});
   if(variant==='candidate')await page.evaluate(({b64,isolated})=>{window.ASMachOcrAssets={...ASMachOcrAssets,[isolated?'asmtech':'eng']:b64};}, {b64:fs.readFileSync(candidateFile).toString('base64'),isolated});
   // One training/validation-independent warm-up is reported separately and
   // does not count as an evaluation case.
   cold[variant]=await page.evaluate(async specialized=>{const c=document.createElement('canvas');c.width=160;c.height=70;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,160,70);g.fillStyle='black';g.font='32px Arial';g.fillText('123.456',8,47);const t=performance.now();await ASMachOCR.recognize(c.toDataURL(),{refresh:true,...(specialized?{model:'technical'}:{})});return performance.now()-t;},isolated&&variant==='candidate');pages[variant]=page;
  }
  for(let i=0;i<manifest.cases.length;i++){
   const c=manifest.cases[i],file=path.join(dir,c.file),bytes=fs.readFileSync(file);if(path.basename(c.file)!==c.file||hash(bytes)!==c.sha256)throw Error('Holdout image changed: '+c.id);
   for(const variant of (i%2?['candidate','baseline']:['baseline','candidate']).filter(v=>pages[v])){
    const r=await pages[variant].evaluate(async({c,image,specialized})=>{const t=performance.now();const ocr=await ASMachOCR.recognize(image,{enhancement:'auto',refresh:true,textMode:!!c.textMode,...(specialized?{model:'technical'}:{})});const ocrMs=performance.now()-t;
     let parsed=ASMachApp.parseRequirement(ocr.text,c.generalTolerance||'');if(c.typeContext){parsed=ASMachRequirements.transitionType(parsed,c.typeContext);parsed.type=c.typeContext;}
     const requirement=ASMachRequirements.generateRequirement({...parsed,requirementText:ocr.text});return{text:ocr.text,rawText:ocr.rawText,parsed,requirement,confidence:ocr.confidence,needsReview:!!ocr.needsReview,reviewReason:ocr.reviewReason,error:ocr.error,performance:ocr.performance,ocrMs};
    },{c,image:'data:image/png;base64,'+bytes.toString('base64'),specialized:isolated&&variant==='candidate'});
    const failures=Object.entries(c.expected).filter(([k,v])=>!equals(value(r.parsed,k),v)).map(([field,expected])=>({field,expected,actual:value(r.parsed,field)??null}));
    if(c.textMode&&normalize(r.text)!==normalize(c.text))failures.push({field:'text',expected:c.text,actual:r.text});
    if(r.error)failures.push({field:'ocrError',actual:r.error});
    rows.push({id:c.id,variant,family:c.family,standard:c.standard,quality:c.quality,font:c.fontFile,typeContext:c.typeContext,...r,failures,ok:!failures.length});
    console.log(JSON.stringify({id:c.id,variant,family:c.family,ms:Math.round(r.ocrMs),ok:!failures.length,text:r.text,failures}));
   }
   if(i%10===9)fs.writeFileSync(path.join(out,'evaluation-100-'+reportName+'-progress.json'),JSON.stringify(rows,null,2));
  }
  const summaries=Object.fromEntries(Object.keys(pages).map(v=>[v,stats(rows.filter(r=>r.variant===v))]));
  const byFamily=Object.fromEntries(Object.keys(manifest.families).map(f=>[f,Object.fromEntries(Object.keys(pages).map(v=>[v,stats(rows.filter(r=>r.variant===v&&r.family===f))]))]));
  const regressions=mode==='paired'?rows.filter(r=>r.variant==='candidate'&&!r.ok&&rows.find(b=>b.id===r.id&&b.variant==='baseline')?.ok).map(r=>r.id):[];
  const b=summaries.baseline,a=summaries.candidate,reasons=[];
  if(mode==='paired'){
   if(regressions.length)reasons.push('Previously correct measurements regressed');
   if(a.exactCases<=b.exactCases)reasons.push('No net exact-measurement improvement');
   if(a.incorrectWithoutReview.length>b.incorrectWithoutReview.length)reasons.push('Unflagged incorrect readings increased');
   if(a.meanMs>b.meanMs||a.medianMs>b.medianMs||a.p95Ms>b.p95Ms)reasons.push('Measured reading latency increased');
   if(byFamily['GD&T'].candidate.exactCases<byFamily['GD&T'].baseline.exactCases)reasons.push('GD&T regression');
  }else reasons.push('Paired comparison not complete');
  if(blocked.length)reasons.push('External network requested');
  const report={schema:1,mode,modelProfile:isolated?'single-technical-measurements':'replace-english-in-multilingual',createdAt:new Date().toISOString(),synthetic:true,holdoutCount:100,training:false,holdoutSha256:hash(fs.readFileSync(path.join(dir,'manifest.json'))),sourceHashes:Object.fromEntries(Object.entries(sourceContents).map(([k,v])=>[k,hash(v)])),modelHashes:{baseline:hash(fs.readFileSync(path.join(root,'ocr/lang/eng.traineddata.gz'))),...(!baselineOnly?{candidate:hash(fs.readFileSync(candidateFile))}:{})},coldStartMs:cold,summaries,byFamily,regressions,defaultActivationAllowed:!reasons.length,reasons,blockedRequests:blocked,rows};
  report.baselineLanguageHashes=Object.fromEntries(Object.entries(baselineLanguages).map(([lang,b])=>[lang,hash(b)]));report.runtimeHashes=runtimeHashes;
  fs.writeFileSync(path.join(out,'evaluation-100-'+reportName+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined,sourceHashes:undefined,byFamily:undefined},null,2));
  for(const page of Object.values(pages))await page.evaluate(()=>ASMachOCR.terminate());
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
