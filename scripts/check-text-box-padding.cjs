const { chromium } = require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.evaluate(() => ASMachApp.openBalloonSettings());

    const field = page.locator('[data-section="Ölçü kutusu"] [data-edit="boxPadding"][type="number"]');
    await field.waitFor({ state: 'visible' });
    assert.equal(await field.inputValue(), '4');
    const before = Number(await page.locator('[data-preview-box]').first().getAttribute('width'));
    await field.fill('12');
    await field.dispatchEvent('change');
    const after = Number(await page.locator('[data-preview-box]').first().getAttribute('width'));
    assert.ok(after > before, `${before} -> ${after}`);

    const geometry = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 360; canvas.height = 180;
      const context = canvas.getContext('2d');
      context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = 'black'; context.font = '42px Arial'; context.fillText('Ø27.3', 95, 105);
      const seed = { cx: 180, cy: 90, w: 250, h: 100, angle: 0 };
      const tight = ASMachAutoSelection.detect(canvas, seed, { angleHint: 0, padding: 0 }).rect;
      const padded = ASMachAutoSelection.detect(canvas, seed, { angleHint: 0, padding: 12 }).rect;
      return { widthDelta: padded.w - tight.w, heightDelta: padded.h - tight.h };
    });
    assert.ok(Math.abs(geometry.widthDelta - 24) < 0.01);
    assert.ok(Math.abs(geometry.heightDelta - 24) < 0.01);

    fs.mkdirSync('outputs', { recursive: true });
    await page.screenshot({ path: 'outputs/text-box-padding-html-preview.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: automatic text bounds, configurable padding, live settings preview and HTML startup.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
