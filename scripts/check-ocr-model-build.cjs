'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
let playwright;try{playwright=require(process.env.ASMACH_PLAYWRIGHT_MODULE||'playwright');}catch(error){if(process.env.ASMACH_PLAYWRIGHT_MODULE)throw error;playwright=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tests/fixtures/ocr-100'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
(async()=>{const browser=await playwright.chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),requests=[];await page.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});await page.goto(pathToFileURL(path.join(root,'ASMach_Teknik_Resim_Balonlama.html')).href);
 const stock=Object.fromEntries(['eng','tur','deu'].map(lang=>[lang,fs.readFileSync(path.join(root,'ocr/lang',lang+'.traineddata.gz')).toString('base64')]));
 assert.equal(await page.evaluate(expected=>Object.entries(expected).every(([lang,b64])=>ASMachOcrAssets[lang]===b64)&&!ASMachOcrAssets.asmtech&&!window.ASMachOcrModelInfo&&ASMachOCR._test.modelForJob({})==='standard',stock),true,'Production build must keep the stock model while candidate is disabled');
 for(const id of ['m001','m019','m020','m047','m075','m093']){
  const c=manifest.cases.find(c=>c.id===id),image='data:image/png;base64,'+fs.readFileSync(path.join(dir,c.file)).toString('base64');
  const r=await page.evaluate(async({c,image})=>{const ocr=await ASMachOCR.recognize(image,{refresh:true,textMode:!!c.textMode});return{text:ocr.text,error:ocr.error,parsed:ASMachApp.parseRequirement(ocr.text,c.generalTolerance||'')};},{c,image});
  assert.ok(!r.error,`${id}: ${r.error}`);
  for(const [field,expected] of Object.entries(c.expected)){const actual=field.split('.').reduce((v,k)=>v?.[k],r.parsed);if(typeof expected==='number'){assert.ok(String(actual??'').trim()!==''&&Math.abs(Number(actual)-expected)<1e-9,`${id} ${field}: ${actual} != ${expected}`);}else assert.equal(actual,expected,`${id} ${field}`);}
  console.log(id+' '+r.text);
 }
 assert.deepEqual(requests,[]);await page.evaluate(()=>ASMachOCR.terminate());console.log('Built application: stock model preserved, 6 field-level OCR smoke cases passed, no external requests.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
