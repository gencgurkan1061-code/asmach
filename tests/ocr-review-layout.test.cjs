const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('src/app.template.html','utf8'),snapshot=fs.readFileSync('src/snapshot-tools.js','utf8');
const declarations=selector=>{const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return [...html.matchAll(new RegExp(escaped+'\\s*\\{([^}]+)\\}','g'))].map(m=>m[1]).join(' ');};
test('OCR review uses content-sized fields, three tolerance columns and a bounded scrolling body',()=>{
  assert.match(declarations('.ocr-review-card'),/display:\s*flex/);
  assert.match(declarations('.ocr-review-card'),/max-height:\s*calc\(100dvh - 24px\)/);
  assert.match(declarations('.ocr-review-card .modal-body'),/overflow:\s*auto/);
  assert.match(declarations('.ocr-review-card .modal-body'),/min-height:\s*0/);
  assert.match(declarations('.ocr-review-card .modal-actions'),/flex-shrink:\s*0/);
  assert.match(declarations('.ocr-review-grid'),/align-items:\s*start/);
  assert.match(declarations('.ocr-fields'),/align-content:\s*start/);
  assert.match(declarations('.ocr-fields .field'),/align-content:\s*start/);
  assert.match(declarations('.ocr-fields .ocr-measure-field'),/grid-column:\s*span 2/);
  for(const id of ['ocrNominal','ocrLowerTolerance','ocrUpperTolerance'])assert.match(html,new RegExp('<div class="field ocr-measure-field">\\s*<label for="'+id+'"'));
  assert.match(html,/@media \(max-width:680px\)/);
});
test('Snapshot editor retains editing controls and makes the duplicate report preview optional',()=>{
  for(const control of ['data-auto','data-new','data-reset','data-crop','data-result'])assert.ok(snapshot.includes(control));
  assert.doesNotMatch(snapshot,/<input[^>]+data-angle/);
  assert.match(snapshot,/<details class="snapshot-report"><summary>Rapor önizlemesi<\/summary>/);
  assert.ok(snapshot.indexOf('<div class="snapshot-stage">')<snapshot.indexOf('<canvas data-result'));
  for(const id of ['ocrReviewCancelButton','ocrRetryButton','ocrReviewConfirmButton'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
});
