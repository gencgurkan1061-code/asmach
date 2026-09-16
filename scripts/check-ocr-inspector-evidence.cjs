// UI integration: injected OCR evidence is not an OCR-accuracy measurement.
const fs=require('node:fs');let fixture=fs.readFileSync('scripts/check-characteristic-info.cjs','utf8').split('\n').slice(0,4).join('\n');fixture+=`
await p.evaluate(()=>{
 const r=ASMachApp.selectedAnnotation();
 ASMachCharacteristicInspector.applyReading(r,{text:'25.4 ±0.1',rawText:'2 5 . 4 + 0 . 1',source:'Test OCR evidence',confidence:72,needsReview:true,reviewReason:'İşaret ve boşlukları kontrol edin.'},false);
});
let result=await p.evaluate(()=>{const r=ASMachApp.selectedAnnotation(),copy=ASMachApp.normalizeAnnotation(JSON.parse(JSON.stringify(r)));return{nominal:copy.nominalValue,raw:copy.originalOcrText,needsReview:copy.ocrNeedsReview,reason:copy.ocrReviewReason,requirement:copy.requirement};});
assert.equal(result.nominal,'25.4');assert.equal(result.raw,'2 5 . 4 + 0 . 1');assert.equal(result.needsReview,true);assert.match(result.reason,/boşluk/);assert.match(result.requirement,/25.4/);
await p.waitForFunction(()=>document.querySelector('#cwInlineSource .wf-source-hint')?.textContent.includes('kontrol'));
if(!await p.locator('#cwInlineSource .wf-source-hint').isVisible())await p.locator('#cwSourceToggle').click();
assert.ok(await p.locator('#cwInlineSource .wf-source-hint').isVisible(),'review hint must be visible in the expanded OCR panel');
await p.locator('#cwInlineSource').screenshot({path:'outputs/ocr-spacing-review.png'});
await p.evaluate(()=>ASMachCharacteristicInspector.applyPartial(ASMachApp.selectedAnnotation(),{scope:'nominal',text:'2 5 . 5',rawText:'2 5 . 5',needsReview:true,reviewReason:'Nominal kontrolü'}));
result=await p.evaluate(()=>{const r=ASMachApp.selectedAnnotation();return{nominal:r.nominalValue,raw:r.originalOcrText,needsReview:r.ocrNeedsReview,lower:r.lowerTolerance,upper:r.upperTolerance};});
assert.equal(result.nominal,'25.5');assert.equal(result.raw,'2 5 . 4 + 0 . 1');assert.equal(result.needsReview,true);assert.equal(Number(result.lower),-.1);assert.equal(Number(result.upper),.1);
await p.evaluate(()=>ASMachCharacteristicInspector.applyReading(ASMachApp.selectedAnnotation(),{text:'25.5 ±0.2',source:'Elle düzeltme'},false));
result=await p.evaluate(()=>ASMachApp.selectedAnnotation());assert.equal(result.ocrNeedsReview,false);assert.equal(result.ocrReviewReason,'');assert.equal(result.originalOcrText,'2 5 . 4 + 0 . 1');
const legacy=await p.evaluate(()=>{const warning='Okumalar farklı veya rakam yerleşimi şüpheli. Nominal ve toleransları kaynak görüntüyle karşılaştırın.';return ['Çap','Uzunluk'].map(type=>{const r=ASMachApp.normalizeAnnotation({type,number:'99',ocrText:'Ø84 h6',ocrNeedsReview:true,ocrReviewReason:warning});return {type,needsReview:r.ocrNeedsReview,reason:r.ocrReviewReason};});});assert.deepEqual(legacy.map(r=>r.needsReview),[false,true]);assert.equal(legacy[0].reason,'');
assert.deepEqual(errors,[]);console.log('PASS inspector OCR evidence persisted across JSON normalization and partial edit; manual correction clears uncertainty but retains original text');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});`;eval(fixture);
