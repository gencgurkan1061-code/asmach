const { chromium } = require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.evaluate(async () => {
      const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
      const rels = 'http://schemas.openxmlformats.org/package/2006/relationships';
      const columns = Array.from({ length: 15 }, (_, i) => String.fromCharCode(75 + i));
      const cell = (ref, value) => `<c r="${ref}" t="n"><v>${value}</v></c>`;
      const sheet = `<worksheet xmlns="${ns}"><dimension ref="A1:Y43"/><sheetData><row r="11">${columns.map((col, i) => cell(col + '11', i + 1)).join('')}</row><row r="12">${columns.map(col => cell(col + '12', 1)).join('')}</row><row r="39">${columns.map(col => `<c r="${col}39"><f>COUNTA(${col}12:${col}38)</f><v>0</v></c>`).join('')}</row></sheetData></worksheet>`;
      const workbook = `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Muayene" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="ASMach_ResultHeader" localSheetId="0">'Muayene'!$K$11:$Y$11</definedName><definedName name="ASMach_ResultInput" localSheetId="0">'Muayene'!$K$12:$Y$38</definedName><definedName name="ASMach_ResultSummary" localSheetId="0">'Muayene'!$K$39:$Y$39</definedName></definedNames></workbook>`;
      const bytes = ASMachWorkflow.zipStored({
        '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        'xl/workbook.xml': workbook,
        'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${rels}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
        'xl/worksheets/sheet1.xml': sheet
      });
      const templateFile = new File([bytes], 'Parça Muayene.xltx');
      ASMachApp.state.fileName = 'test.pdf'; ASMachApp.state.metadata = {}; ASMachApp.state.annotations = [];
      window.ASMachDesktop = { listExcelTemplates: async () => [{ id: 'sample', name: 'Parça Muayene' }], readExcelTemplate: async () => templateFile, deleteExcelTemplate: async () => {} };
      ASMachReportCenter.open('excel');
    });
    const dialog = page.locator('#reportCenter');
    await dialog.getByText('Parça Muayene', { exact: true }).click();
    const count = dialog.getByLabel('Muayene edilecek parça adedi');
    await count.waitFor();
    assert.equal(await count.inputValue(), '15');
    assert.match(await dialog.locator('[data-sample-plan]').textContent(), /15 parça\/sayfa · 1 çalışma sayfası · 001-015/);
    await count.fill('32');
    await count.dispatchEvent('change');
    await page.waitForFunction(() => document.querySelectorAll('#reportCenter [aria-label="Çalışma sayfası"] option').length === 3);
    assert.deepEqual(await dialog.getByLabel('Çalışma sayfası').locator('option').allTextContents(), ['Muayene P001-015', 'Muayene P016-030', 'Muayene P031-032']);
    assert.match(await dialog.locator('[data-sample-plan]').textContent(), /15 parça\/sayfa · 3 çalışma sayfası · 001-015, 016-030, 031-032/);
    await page.screenshot({ path: 'outputs/template-review/sample-output.png' });
    assert.deepEqual(errors, []);
    console.log('PASS output quantity prompt and 32-piece multi-sheet preview');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
