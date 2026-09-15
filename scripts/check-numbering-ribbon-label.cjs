const { chromium } = require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1850, height: 420 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      await ASMachApp.restoreProject({
        format: 'asmach-ballooning-project',
        source: { name: 'etiket-kontrol.png', type: 'image/png', dataUrl: canvas.toDataURL() },
        annotations: []
      });
    });
    await page.locator('#rbTab-format').evaluate(element => element.click());
    await page.waitForTimeout(400);

    const button = page.locator('#viewNumberingButton');
    assert.equal((await button.textContent()).trim(), 'Balon sırası');
    assert.equal(await button.locator('kbd,.qt-key').count(), 0);
    assert.equal(await button.getAttribute('aria-keyshortcuts'), 'R');
    assert.equal(Math.round((await button.locator('svg').boundingBox()).width), 22);
    assert.deepEqual(errors, []);

    await page.screenshot({ path: 'outputs/numbering-ribbon-label.png', fullPage: false });
    console.log('PASS ribbon label is Balon sırası; R remains only as the keyboard shortcut.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
