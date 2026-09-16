'use strict';
const { chromium } = require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const out = path.resolve('outputs/radius-thread-qa');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200; canvas.height = 800;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1200, 800);
      ctx.fillStyle = 'blue'; ctx.font = '46px Arial';
      ['R16', 'R1/8', 'R16', 'R16'].forEach((text, i) => ctx.fillText(text, 450, 180 + i * 130));
      const legacy = { type: 'Diş', nominalValue: '16', unit: 'in', evaluationMethod: 'OK_NOT_OK', threadStandard: 'ISO 7-1', toleranceStandard: 'ISO 7-1', callout: { threadForm: 'R' }, ocrText: 'R16', requirement: 'R 16', requirementMode: 'auto', status: 'needs_review', autoParse: true };
      const make = (id, i, fields) => {
        const box = { x: 440 / 1200, y: (130 + i * 130) / 800, w: 150 / 1200, h: 65 / 800 };
        return { ...legacy, id, number: String(i + 45), page: 1, size: 20, fontSize: 10, selectionBox: box, snapshot: ASMachSnapshots._test.extract(canvas, ASMachSnapshots.boxRect(box, 1200, 800)).toDataURL(), anchorX: box.x, anchorY: box.y + .03, bubbleX: box.x - .04, bubbleY: box.y + .03, ...fields };
      };
      window.fixture = { format: 'asmach-ballooning-project', source: { name: 'radius-thread-regression.png', type: 'image/png', dataUrl: canvas.toDataURL() }, generalTolerance: { standard: 'ISO 2768-mK', unit: 'mm' }, annotations: [make('auto-radius', 0), make('pipe', 1, { ...ASMachApp.parseRequirement('R1/8'), ocrText: 'R1/8', requirement: 'R 1/8' }), make('manual-thread', 2, { manualFields: ['type'] }), make('approved-thread', 3, { status: 'approved' })] };
      await ASMachApp.restoreProject(fixture);
      ASMachMessages.confirm = async () => true;
      window.ocrCalls = 0;
      ASMachApp.recognizeSnapshotAutomatically = async () => { ocrCalls++; throw Error('Classification repair must not invoke OCR'); };
      ASMachApp.state.selectedId = 'auto-radius'; ASMachApp.renderAll();
    });
    assert.equal(await page.locator('#characteristicType').inputValue(), 'Yarıçap');
    assert.equal(await page.locator('#nominalValue').inputValue(), '16');
    assert.equal(await page.locator('#measurementUnit').inputValue(), 'mm');
    assert.equal(Number(await page.locator('#lowerTolerance').inputValue()), -.2);
    assert.equal(Number(await page.locator('#upperTolerance').inputValue()), .2);
    assert.match(await page.locator('#requirement').inputValue(), /R16 ±0\.2/);
    const loaded = await page.evaluate(() => ({ rows: ASMachApp.state.annotations, original: fixture.annotations[0] }));
    assert.equal(loaded.original.type, 'Diş', 'Loading does not modify the original project payload');
    assert.equal(loaded.rows[0].threadStandard, '');
    assert.equal(loaded.rows[0].ocrNeedsReview, true);
    assert.equal(loaded.rows[0].evaluationMethod, 'VALUE');
    assert.equal(loaded.rows[0].snapshot, loaded.original.snapshot);
    assert.equal(loaded.rows[1].type, 'Diş'); assert.equal(loaded.rows[1].threadPitch, '28 TPI');
    assert.equal(loaded.rows[2].type, 'Diş'); assert.equal(loaded.rows[3].type, 'Diş');
    if (await page.locator('#cwSourceToggle').getAttribute('aria-expanded') !== 'true') await page.locator('#cwSourceToggle').click();
    await page.screenshot({ path: path.join(out, 'radius-corrected.png') });
    // Exercise actual project serialization and reload, not just the parser helper.
    await page.evaluate(async () => {
      const saved = JSON.parse(JSON.stringify(ASMachApp.projectPayload()));
      await ASMachApp.restoreProject(saved);
      ASMachApp.state.selectedId = 'auto-radius'; ASMachApp.renderAll();
    });
    assert.equal(await page.locator('#characteristicType').inputValue(), 'Yarıçap');
    assert.equal(await page.locator('#measurementUnit').inputValue(), 'mm');
    assert.equal(await page.evaluate(() => ASMachApp.selectedAnnotation().ocrText), 'R16');
    assert.equal(await page.evaluate(() => ocrCalls), 0);
    assert.deepEqual(errors, []);
    const report = { passed: true, checks: ['R16 UI type / nominal / unit', 'drawing general tolerance', 'requirement synchronization', 'old automatic record repair', 'original image and payload preserved', 'fractional pipe retained', 'manual and approved records protected', 'project serialization / reload', 'zero OCR calls', 'no page errors'], errors };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
