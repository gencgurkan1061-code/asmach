const { chromium } = require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');canvas.width = 1000;canvas.height = 700;
      await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'ayar-kontrol.png',type:'image/png',dataUrl:canvas.toDataURL()},annotations:[{id:'a1',number:'1',page:1,type:'Uzunluk',requirement:'20 ±0.1',bubbleX:.3,bubbleY:.3,anchorX:.4,anchorY:.4}]});
      ASMachRibbon.open('view');document.getElementById('appSettingsButton').click();
    });
    await page.locator('#desktopSettings').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('overlay')).display), 'none');
    await page.screenshot({ path: 'outputs/settings-clean.png' });
    await page.evaluate(() => document.getElementById('ribbonAboutButton').click());
    await page.locator('#aboutWorkspace').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#aboutApplicationDialog').count(), 0);
    assert.equal(await page.evaluate(() => document.body.dataset.workspaceScreen), 'about');
    assert.match(await page.locator('#aboutWorkspace').innerText(), /Mevcut sürüm/);
    assert.doesNotMatch(await page.locator('#aboutWorkspace').innerText(), /Güncelleme ilkesi|En güncel sürüm|Güncellemeleri denetle/);
    await page.screenshot({ path: 'outputs/about-inline-simple.png' });
    assert.deepEqual(errors, []);
    console.log('PASS settings hides drawing overlay; About opens inline with concise version information.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
