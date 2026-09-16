// Paired real OCR measurements. No installer is built or published by this test.
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs','ocr-dual-engine');
const repetitions=Math.max(1,Math.min(5,Number(process.argv.find(s=>s.startsWith('--rounds='))?.split('=')[1]||3)));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'outputs/ocr-freetype-evaluation/manifest.json'),'utf8'));
const cases=manifest.cases;
const sources=['requirements-engine','measurement-layout','ocr-image-enhancement','ocr-engine','technical-glyph-model','secondary-ocr','ocr-verifier'];
const mime={'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.tar':'application/octet-stream','.onnx':'application/octet-stream','.html':'text/html'};
const server=http.createServer((req,res)=>{
 let route;try{route=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400).end();return;}
 const permitted=route==='/'||sources.some(s=>route==='/src/'+s+'.js')||route.startsWith('/ocr/experimental-paddle/')||route.startsWith('/ocr/experimental-model/');
 const file=route==='/'?path.join(root,'ASMach_Teknik_Resim_Balonlama.html'):path.resolve(root,'.'+route);
 if(!permitted||!file.startsWith(root+path.sep)||!fs.statSync(file,{throwIfNoEntry:false})?.isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res);
});
const median=a=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:0;};
const percentile=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.ceil(b.length*p)-1)]||0;};
const equal=(actual,expected)=>typeof expected==='number'?String(actual??'').trim()!==''&&Number.isFinite(Number(actual))&&Math.abs(Number(actual)-expected)<1e-9:actual===expected;
const fields=(record,expected)=>Object.entries(expected).filter(([key,value])=>!equal(record?.[key],value)).map(([key,value])=>({field:key,expected:value,actual:record?.[key]}));
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});const records=[],blocked=[];
 try{
  const context=await browser.newContext();await context.route('**/*',route=>{const u=route.request().url();if(u.startsWith(origin+'/'))return route.continue();blocked.push(u);return route.abort();});const page=await context.newPage();page.setDefaultTimeout(120000);
  await page.goto(origin);for(const name of sources)await page.addScriptTag({url:origin+'/src/'+name+'.js'});
  const modelSetupMs=await page.evaluate(async origin=>{const start=performance.now();const model=await(await fetch(origin+'/ocr/experimental-model/technical-glyph-v1.json')).json();window.glyphClassifier=ASMachTechnicalGlyphModel.create(model);ASMachSecondaryOCR.configure({baseUrl:origin+'/ocr/experimental-paddle/'});ASMachOcrVerifier.configure({secondary:ASMachSecondaryOCR,classifier:glyphClassifier});return performance.now()-start;},origin);
  async function run(entry,variant,round){
   const snapshot='data:image/png;base64,'+fs.readFileSync(path.join(root,'outputs/ocr-freetype-evaluation',entry.file)).toString('base64');
   const result=await page.evaluate(async({snapshot,variant})=>{const start=performance.now();const r=await ASMachOCR.recognize(snapshot,{enhancement:'auto',refresh:true,...(variant==='dual'?{verification:'experimental'}:{})});return{text:r.text,parsed:ASMachApp.parseRequirement(r.text),elapsedMs:performance.now()-start,needsReview:!!r.needsReview,error:r.error,verification:r.verificationPerformance,secondary:r.secondaryEvidence,glyphChecks:r.glyphEvidence,alternatives:r.alternatives};},{snapshot,variant});
   const item={id:entry.id,variant,round,...result,failures:fields(result.parsed,entry.expected)};records.push(item);console.log(JSON.stringify({id:item.id,variant,round,ms:Math.round(item.elapsedMs),ran:!!item.verification?.ran,failures:item.failures.length,secondary:item.secondary?.status}));return item;
  }
  // Cold-start report on a crop guaranteed to request the optional verifier.
  const coldCase=cases.find(x=>x.id==='ft-courier-diameter-symmetric')||cases[0];
  await run(coldCase,'baseline',-1);await run(coldCase,'dual',-1);
  for(let round=0;round<repetitions;round++)for(const entry of cases)for(const variant of round%2?['dual','baseline']:['baseline','dual'])await run(entry,variant,round);
  const warm=records.filter(r=>r.round>=0),baseline=warm.filter(r=>r.variant==='baseline'),dual=warm.filter(r=>r.variant==='dual');
  const summary=list=>({count:list.length,medianMs:median(list.map(r=>r.elapsedMs)),p95Ms:percentile(list.map(r=>r.elapsedMs),.95),meanMs:list.reduce((s,r)=>s+r.elapsedMs,0)/Math.max(1,list.length),fieldFailures:list.reduce((s,r)=>s+r.failures.length,0),incorrectWithoutReview:list.filter(r=>r.failures.length&&!r.needsReview).length});
  const before=summary(baseline),after=summary(dual),slower=after.meanMs>before.meanMs||after.medianMs>before.medianMs||after.p95Ms>before.p95Ms;
  const cold=records.filter(r=>r.round<0),coldExtra=cold[1].verification?.extraMs||0;
  const ran=dual.filter(r=>r.verification?.ran).length,unavailable=dual.filter(r=>r.secondary?.status==='unavailable').length;
  const reasons=[...(slower?['Ölçülen sıcak okuma süresi arttı.']:[]),...(coldExtra>0?['İkinci motorun ilk kullanımı ek süre gerektiriyor.']:[]),...(after.fieldFailures>before.fieldFailures?['Alan doğruluğu geriledi.']:[]),...(!ran?['İkinci motor gerçekten çalıştırılmadı.']:[]),...(unavailable?['İkinci motor bazı denemelerde kullanılamadı.']:[]),...(blocked.length?['Dış ağ isteği denendi ve engellendi.']:[])];
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  const report={schema:1,createdAt:new Date().toISOString(),repetitions,before,after,modelSetupMs,coldExtraMs:coldExtra,secondaryRuns:ran,unavailable,blockedRequests:blocked,publishAllowed:reasons.length===0,approvalRequired:reasons.length>0,reasons,sourceHashes:Object.fromEntries(sources.map(s=>[s,hash('src/'+s+'.js')])),artifactHashes:{glyphModel:hash('ocr/experimental-model/technical-glyph-v1.json'),paddleManifest:hash('ocr/experimental-paddle/manifest.json')},records};
  fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,records:undefined,sourceHashes:undefined},null,2));
  await page.evaluate(async()=>{await ASMachOCR.terminate();await ASMachSecondaryOCR.dispose?.();});
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
