const { chromium } = require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 360 } });
    const errors = [];page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.evaluate(async () => {
      const canvas=document.createElement('canvas');canvas.width=900;canvas.height=600;
      await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'durum-kontrol.png',type:'image/png',dataUrl:canvas.toDataURL()},annotations:[]});
      ASMachRecovery.mark();await ASMachRecovery.flush();
    });
    assert.equal(await page.locator('#projectFileState').isVisible(), false);
    assert.equal(await page.locator('#projectRecovery').isVisible(), false);
    assert.equal(await page.locator('.document-strip').innerText().then(text => /Kurtarılan yerel kopya|Kaydedilmemiş değişiklikler|Yerel kurtarma kopyası|Son yerel kopyayı kurtar/.test(text)), false);
    await page.screenshot({ path: 'outputs/document-strip-clean.png' });
    assert.deepEqual(errors, []);
    console.log('PASS project and recovery details stay hidden while recovery remains operational.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
