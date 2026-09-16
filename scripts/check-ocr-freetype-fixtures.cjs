// Evaluate FreeType-generated PNGs with the real, offline production OCR worker.
// Default overlays current source; --built evaluates the built HTML only.
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const directory=path.join(root,'outputs','ocr-freetype-evaluation');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
if(manifest.purpose!=='evaluation-only'||manifest.training!==false||!Array.isArray(manifest.cases)||manifest.cases.length>18)throw new Error('Expected the fixed, evaluation-only fixture manifest (at most18 cases).');
const current=!process.argv.includes('--built');
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7);
// Rescoring reuses captured OCR output after a documented label-schema repair;
// it never invokes OCR again and preserves the original source hashes/timings.
const rescore=process.argv.includes('--rescore');
const previous=rescore?JSON.parse(fs.readFileSync(path.join(directory,`results-${current?'current':'built'}.json`),'utf8')):null;
const cases=only?manifest.cases.filter(item=>item.id.includes(only)):manifest.cases;
if(!cases.length)throw new Error('No matching FreeType evaluation case.');
const sourceNames=['requirements-engine','gdt-vision','measurement-layout','ocr-image-enhancement','ocr-engine'];
const sourceOverlays=current?sourceNames.map(name=>({name,source:fs.readFileSync(path.join(root,'src',name+'.js'),'utf8')})):[];
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:null;};

(async()=>{
  const browser=rescore?null:await chromium.launch({channel:'msedge',headless:true});
  const results=[],fieldTotals={},blockedRequests=[];
  try{
    const page=browser?await browser.newPage():null;
    if(page){
      await page.route(/^https?:/,route=>{blockedRequests.push(route.request().url());return route.abort();});
      await page.goto(pathToFileURL(path.join(root,'ASMach_Teknik_Resim_Balonlama.html')).href);
      for(const item of sourceOverlays)await page.addScriptTag({content:item.source});
    }
    for(const entry of cases){
      const started=Date.now();
      const expected=entry.expected||{};
      try{
        if(path.basename(entry.file)!==entry.file)throw new Error('Fixture filenames must remain inside the evaluation directory.');
        const bytes=fs.readFileSync(path.join(directory,entry.file));
        if(digest(bytes)!==entry.sha256)throw new Error('Fixture hash no longer matches fixed manifest.');
        const cached=previous?.results.find(item=>item.id===entry.id);
        if(rescore&&!cached)throw new Error('Missing captured OCR result; rescoring cannot generate a new reading.');
        const result=cached||await page.evaluate(async snapshot=>{
          const started=performance.now();
          const ocr=await ASMachOCR.recognize(snapshot,{enhancement:'auto'});
          const elapsedMs=performance.now()-started;
          const parsed=ASMachApp.parseRequirement(ocr.text,'');
          return {text:ocr.text,rawText:ocr.rawText,confidence:ocr.confidence,needsReview:!!ocr.needsReview,reviewReason:ocr.reviewReason,
            error:ocr.error,parsed,semantic:ASMachRequirements.assessReading(ocr.text),alternatives:ocr.alternatives,performance:ocr.performance,ocrElapsedMs:elapsedMs};
        },'data:image/png;base64,'+bytes.toString('base64'));
        const fields=Object.fromEntries(Object.entries(expected).map(([name,value])=>{
          const actual=result.parsed[name];
          const exact=typeof value==='number'?String(actual??'').trim()!==''&&Number.isFinite(Number(actual))&&Math.abs(Number(actual)-value)<1e-9:actual===value;
          return [name,{expected:value,actual:actual??null,exact}];
        }));
        const failures=Object.entries(fields).filter(([,value])=>!value.exact).map(([name,value])=>`${name}: expected ${JSON.stringify(value.expected)}, received ${JSON.stringify(value.actual)}`);
        if(result.error)failures.unshift('OCR error: '+result.error);
        const item={id:entry.id,font:entry.font,quality:entry.quality,tracking:entry.tracking,sourceText:entry.text,...result,fields,ok:!failures.length,failures,elapsedMs:cached?cached.elapsedMs:Date.now()-started};
        results.push(item);
        console.log(JSON.stringify({id:item.id,text:item.text,ok:item.ok,needsReview:item.needsReview,failures:item.failures,elapsedMs:item.elapsedMs}));
      }catch(error){
        const fields=Object.fromEntries(Object.entries(expected).map(([name,value])=>[name,{expected:value,actual:null,exact:false}]));
        const item={id:entry.id,font:entry.font,quality:entry.quality,fields,ok:false,needsReview:true,failures:[error.message],elapsedMs:Date.now()-started};
        results.push(item);console.log(JSON.stringify(item));
      }
    }
    if(page)await page.evaluate(()=>ASMachOCR.terminate());
    for(const result of results)for(const [field,value]of Object.entries(result.fields)){
      const tally=fieldTotals[field]||{total:0,exact:0};tally.total++;if(value.exact)tally.exact++;fieldTotals[field]=tally;
    }
    for(const value of Object.values(fieldTotals))value.accuracy=value.total?value.exact/value.total:null;
    const totalFields=Object.values(fieldTotals).reduce((sum,value)=>sum+value.total,0),exactFields=Object.values(fieldTotals).reduce((sum,value)=>sum+value.exact,0);
    const output={schemaVersion:1,purpose:'evaluation-only',training:false,mode:current?'current-source-overlay':'built',createdAt:new Date().toISOString(),renderer:manifest.renderer,
      sourceHashes:previous?.sourceHashes||Object.fromEntries(sourceOverlays.map(item=>[item.name,digest(item.source)])),
      ...(previous?{rescoredFrom:`results-${current?'current':'built'}.json`,originalRunCreatedAt:previous.createdAt,labelCorrection:'NPT threadPitch storage is a TPI-suffixed string, not a unitless number. Images and OCR output unchanged.'}:{}),
      totalCases:results.length,exactCases:results.filter(item=>item.ok).length,failedCases:results.filter(item=>!item.ok).length,
      totalFields,exactFields,fieldAccuracy:totalFields?exactFields/totalFields:null,fieldTotals,
      needsReviewCases:results.filter(item=>item.needsReview).length,incorrectWithoutReview:results.filter(item=>!item.ok&&!item.needsReview).map(item=>item.id),
      timing:{firstCaseMs:results[0]?.elapsedMs,warmMedianMs:median(results.slice(1).map(item=>item.elapsedMs)),maxMs:Math.max(...results.map(item=>item.elapsedMs)),includesWorkerStartupForFirstCase:true},
      network:previous?.network||{offline:true,blockedRequestCount:blockedRequests.length},
      limitations:['Synthetic font/quality fixture evaluation only; not a representative real-drawing accuracy estimate.','These results were not used to tune the recognition algorithms in this task.'],results};
    const filename=`results-${current?'current':'built'}${rescore?'-rescored':''}${only?'-'+only.replace(/[^a-z0-9-]/gi,'_'):''}.json`;
    fs.writeFileSync(path.join(directory,filename),JSON.stringify(output,null,2)+'\n');
    console.log(JSON.stringify({exactCases:output.exactCases,totalCases:output.totalCases,exactFields,totalFields,fieldAccuracy:output.fieldAccuracy,incorrectWithoutReview:output.incorrectWithoutReview,timing:output.timing,file:path.join(directory,filename)}));
    if(output.failedCases)process.exitCode=1;
  }finally{if(browser)await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
