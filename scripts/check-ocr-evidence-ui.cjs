// Integration only: injected OCR results test evidence propagation, not OCR accuracy.
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());
 await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 for(const name of ['candidate-correction','candidate-source'])await page.addScriptTag({content:fs.readFileSync('src/'+name+'.js','utf8')});
 await page.evaluate(()=>{
  const drawing=document.createElement('canvas');drawing.width=500;drawing.height=180;const g=drawing.getContext('2d');g.fillStyle='white';g.fillRect(0,0,500,180);g.fillStyle='black';g.font='30px Arial';g.fillText('2 5 . 4 5',160,94);
  const host=document.createElement('div');host.id='ocrEvidenceQa';host.style.cssText='position:fixed;left:10px;top:10px;width:360px;z-index:999999;background:white';document.body.replaceChildren(host);
  const candidate={page:1,box:{x:.3,y:.35,w:.4,h:.25},snapshot:drawing.toDataURL(),pageImage:drawing,text:'25.45',parsed:{}};
  window.evidenceEdits=[];window.recreateEvidenceUi=false;window.ocrEvidenceResult={text:'25.45',rawText:'2 5 . 4 5',confidence:78,source:'Injected OCR for evidence test',needsReview:true,reviewReason:'Karakter aralıkları farklı okumalara neden oldu.',alternatives:[{text:'25.4',confidence:72}]};
  window.ASMachOCR={recognize:async()=>({...ocrEvidenceResult})};
  window.mountEvidence=()=>{
   window.evidenceMount?.dispose();host.replaceChildren();
   window.evidenceMount=ASMachCandidateSource.mount(host,{candidate,candidates:[candidate],isCurrent:()=>true,parse:text=>({nominalValue:text}),recognize:edit=>ASMachCandidateCorrection.recognize({},candidate,edit),apply:edit=>{evidenceEdits.push(edit);candidate.parsed={ocrNeedsReview:edit.needsReview,ocrReviewReason:edit.reviewReason,originalOcrText:edit.originalOcrText};if(recreateEvidenceUi)mountEvidence();}});
  };mountEvidence();
 });
 const host=page.locator('#ocrEvidenceQa');await host.locator('[data-ocr-mode="off"]').click();await page.waitForFunction(()=>evidenceEdits.length===1);
 let applied=await page.evaluate(()=>evidenceEdits.at(-1));assert.equal(applied.text,'25.45');assert.equal(applied.rawText,'2 5 . 4 5');assert.equal(applied.originalOcrText,'2 5 . 4 5');assert.equal(applied.needsReview,true);assert.equal(applied.alternatives[0].text,'25.4');
 assert.match(await host.locator('.wf-source-hint').textContent(),/kontrol gerekli/i);assert.equal(await page.locator('dialog[open]').count(),0,'auto application must not open a blocking dialog');
 await host.getByRole('textbox',{name:'Yeni seçim metni'}).fill('25.46');await host.getByRole('button',{name:'Ölçüyü güncelle',exact:true}).click();
 applied=await page.evaluate(()=>evidenceEdits.at(-1));assert.equal(applied.text,'25.46');assert.equal(applied.originalOcrText,'2 5 . 4 5');assert.equal(applied.needsReview,false);assert.equal(applied.reviewConfirmed,true);
 await page.evaluate(()=>{recreateEvidenceUi=true;});await host.locator('[data-ocr-mode="strong"]').click();await page.waitForFunction(()=>evidenceEdits.length===3);
 assert.match(await host.locator('.wf-source-hint').textContent(),/Kontrol gerekli/,'persisted review hint survives a synchronous inspector re-mount');
 assert.match(await host.locator('.wf-source-hint').textContent(),/Karakter aralıkları/);
 await page.evaluate(()=>{ocrEvidenceResult={text:'25.45',rawText:'25.45',confidence:96,source:'Clean reading',needsReview:false};});await host.locator('[data-ocr-mode="off"]').click();await page.waitForFunction(()=>evidenceEdits.length===4);
 assert.equal((await page.evaluate(()=>evidenceEdits.at(-1))).needsReview,false);assert.doesNotMatch(await host.locator('.wf-source-hint').textContent(),/Kontrol gerekli/);
 assert.deepEqual(errors,[]);console.log('PASS automatic inline application; raw evidence and alternatives; review hint; manual correction; remount persistence; no modal');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
