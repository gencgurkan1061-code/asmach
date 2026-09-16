// Isolated deployment check: exact production CSP on document AND worker.
// This script never modifies the CSP, production bundle, or release artifacts.
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs','ocr-dual-engine');
const tauri=JSON.parse(fs.readFileSync(path.join(root,'src-tauri','tauri.conf.json'),'utf8'));
const csp=tauri.app.security.csp;
if(typeof csp!=='string'||!csp.trim())throw Error('Production CSP is missing; refusing an unprotected test.');
const mime={'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.json':'application/json','.tar':'application/octet-stream'};
const report={schema:1,purpose:'secondary-ocr-production-csp-smoke',csp,cspSource:'src-tauri/tauri.conf.json app.security.csp',
  cspAppliedTo:'all HTTP responses, including module worker',startedAt:new Date().toISOString(),status:'pending',
  console:[],pageErrors:[],violations:[],failedRequests:[],externalRequests:[],result:null};
const server=http.createServer((req,res)=>{
  res.setHeader('Content-Security-Policy',csp);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400).end();return;}
  if(pathname==='/'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><html><head><meta charset="utf-8"><title>Isolated OCR CSP check</title></head><body><p>Production-CSP OCR check</p></body></html>');return;
  }
  const allowed=pathname==='/src/secondary-ocr.js'||pathname.startsWith('/ocr/experimental-paddle/');
  const filename=path.resolve(root,'.'+pathname);
  if(!allowed||!filename.startsWith(root+path.sep)||!fs.statSync(filename,{throwIfNoEntry:false})?.isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');
  fs.createReadStream(filename).on('error',()=>res.destroy()).pipe(res);
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});
    const context=await browser.newContext();
    // Browser-instrumentation script records violations; the application itself
    // is still loaded as an external script under the exact production policy.
    await context.addInitScript(()=>{
      globalThis.__ocrCspViolations=[];
      addEventListener('securitypolicyviolation',event=>{
        globalThis.__ocrCspViolations.push({blockedURI:event.blockedURI,effectiveDirective:event.effectiveDirective,
          violatedDirective:event.violatedDirective,sourceFile:event.sourceFile,lineNumber:event.lineNumber,sample:event.sample,disposition:event.disposition});
      });
    });
    await context.route('**/*',route=>{
      const url=route.request().url();
      if(url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
      report.externalRequests.push(url);return route.abort('blockedbyclient');
    });
    const page=await context.newPage();
    page.on('console',message=>report.console.push({type:message.type(),text:message.text().slice(0,1600)}));
    page.on('pageerror',error=>report.pageErrors.push(error.message));
    page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
    const session=await context.newCDPSession(page);
    await session.send('Log.enable');
    session.on('Log.entryAdded',({entry})=>{
      if(entry.source==='security'||/content security|unsafe-eval|violat|refused/i.test(entry.text||''))
        report.violations.push({source:'browser-log',level:entry.level,text:entry.text,url:entry.url});
    });
    await page.goto(origin,{waitUntil:'load'});
    await page.addScriptTag({url:origin+'/src/secondary-ocr.js'});
    report.result=await page.evaluate(async base=>{
      const started=performance.now();let initialization;
      try{
        ASMachSecondaryOCR.configure({baseUrl:base+'/ocr/experimental-paddle/'});
        const operation=(async()=>{
          initialization=await ASMachSecondaryOCR.initialize();
          const canvas=document.createElement('canvas');canvas.width=400;canvas.height=90;
          const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,400,90);
          context.fillStyle='black';context.font='40px Arial';context.fillText('12.50 ±0.1',20,60);
          const reading=await ASMachSecondaryOCR.recognize(canvas);
          return {initialization,text:reading.text,score:reading.score,metrics:reading.metrics,elapsedMs:performance.now()-started};
        })();
        let timer;
        try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('CSP smoke exceeded 30 seconds.')),30000);})]);}
        finally{clearTimeout(timer);}
      }catch(error){return {initialization,error:String(error.message||error),errorName:error.name,elapsedMs:performance.now()-started};}
      finally{ASMachSecondaryOCR.dispose();}
    },origin);
    report.violations.push(...await page.evaluate(()=>globalThis.__ocrCspViolations||[]));
    const diagnostics=JSON.stringify([report.result,report.console,report.pageErrors,report.violations]);
    const blocked=/unsafe-eval|EvalError|content security policy|violates.*script-src|refused to evaluate/i.test(diagnostics);
    report.status=report.result.error?(blocked?'blocked-by-production-csp':'failed'):
      report.result.text==='12.50 ±0.1'&&report.externalRequests.length===0?'passed':'recognition-mismatch';
  }catch(error){report.status='failed';report.harnessError=String(error.stack||error);}
  finally{
    if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
    report.completedAt=new Date().toISOString();fs.mkdirSync(out,{recursive:true});
    const filename=path.join(out,'production-csp-smoke.json');fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({status:report.status,error:report.result?.error,text:report.result?.text,violationCount:report.violations.length,externalRequests:report.externalRequests.length,report:filename},null,2));
    if(report.status!=='passed')process.exitCode=report.status==='blocked-by-production-csp'?2:1;
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;server.close();});
