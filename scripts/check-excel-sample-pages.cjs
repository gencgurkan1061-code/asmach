const { chromium } = require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    const results = await page.evaluate(() => {
      const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
      const rels = 'http://schemas.openxmlformats.org/package/2006/relationships';
      const cols = Array.from({ length: 15 }, (_, i) => String.fromCharCode(75 + i));
      const numeric = (ref, value) => `<c r="${ref}" t="n"><v>${value}</v></c>`;
      const formula = (ref, value) => `<c r="${ref}"><f>${value}</f><v>0</v></c>`;
      const sheet = `<worksheet xmlns="${ns}"><dimension ref="A1:Y45"/><sheetData>` +
        `<row r="11">${cols.map((col, i) => numeric(col + '11', i + 1)).join('')}</row>` +
        `<row r="12">${cols.map(col => numeric(col + '12', 999)).join('')}</row>` +
        `<row r="39">${cols.map(col => formula(col + '39', `IF(COUNTA(${col}12:${col}38)=0,"",IF(COUNT(${col}12:${col}38)&gt;0,"UYGUN",""))`)).join('')}</row>` +
        `<row r="42">${formula('D42', 'IF(COUNTA(K11:Y11)=0,"",COUNTA(K11:Y11))')}${formula('J42', 'COUNTIF(K39:Y39,"UYGUN")')}</row>` +
        `<row r="43">${formula('D43', 'COUNTIF(K39:Y39,"UYGUN DEĞİL")')}${formula('J43', 'IF(D43&gt;0,"UYGUN DEĞİL",IF(J42&gt;0,"UYGUN",""))')}</row>` +
        `</sheetData><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
      const names = `<definedNames>` +
        `<definedName name="ASMach_ResultHeader" localSheetId="0">'Muayene'!$K$11:$Y$11</definedName>` +
        `<definedName name="ASMach_ResultInput" localSheetId="0">'Muayene'!$K$12:$Y$38</definedName>` +
        `<definedName name="ASMach_ResultSummary" localSheetId="0">'Muayene'!$K$39:$Y$39</definedName>` +
        `<definedName name="ASMach_FinalFooter" localSheetId="0">'Muayene'!$A$42:$Y$43</definedName>` +
        `<definedName name="_xlnm.Print_Area" localSheetId="0">'Muayene'!$A$1:$Y$43</definedName>` +
        `</definedNames>`;
      const template = { format: 'imported', direction: 'rows', sheetIndex: 0, sourceSheets: [{ name: 'Muayene', path: 'xl/worksheets/sheet1.xml' }], bindings: { 'xl/worksheets/sheet1.xml': {} }, cells: {}, parts: {
        'xl/worksheets/sheet1.xml': { text: sheet },
        'xl/workbook.xml': { text: `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Muayene" sheetId="1" r:id="rId1"/></sheets>${names}<calcPr calcId="1"/></workbook>` },
        'xl/_rels/workbook.xml.rels': { text: `<Relationships xmlns="${rels}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
        'docProps/custom.xml': { text: '<Properties><property name="ASMachSampleLayout"><value>sheets</value></property></Properties>' },
        '[Content_Types].xml': { text: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' }
      }};
      const parse = text => new DOMParser().parseFromString(text, 'application/xml');
      const read = count => {
        const output = ASMachExcelTemplateImport.files(template, { metadata: {}, annotations: [], __excelSampleCount: count }, false);
        const workbook = parse(output['xl/workbook.xml']), relationships = parse(output['xl/_rels/workbook.xml.rels']);
        const sheets = [...workbook.getElementsByTagNameNS('*', 'sheet')].map(sheetNode => {
          const id = sheetNode.getAttribute('r:id'), target = [...relationships.documentElement.children].find(item => item.getAttribute('Id') === id).getAttribute('Target'), document = parse(output['xl/' + target]);
          const cell = ref => document.querySelector(`c[r="${ref}"]`);
          return { name: sheetNode.getAttribute('name'), headers: cols.map(col => cell(col + '11')?.textContent || ''), firstInput: cell('K12')?.textContent || '', summaryFormulas: cols.map(col => cell(col + '39')?.querySelector('f')?.textContent || ''), totalFormula: cell('D42')?.querySelector('f')?.textContent || '', suitableFormula: cell('J42')?.querySelector('f')?.textContent || '', statusFormula: cell('J43')?.querySelector('f')?.textContent || '' };
        });
        return { info: ASMachExcelSamplePages.inspect(template.parts), sheets };
      };
      return [15, 32, 45].map(read);
    });
    const [fifteen, thirtyTwo, fortyFive] = results;
    assert.deepEqual(fifteen.info, { enabled: true, capacity: 15, layout: 'sheets', sheets: ['Muayene'] });
    assert.equal(fifteen.sheets.length, 1);
    assert.equal(fifteen.sheets[0].name, 'Muayene');
    assert.deepEqual(fifteen.sheets[0].headers, Array.from({ length: 15 }, (_, i) => String(i + 1)));
    assert.equal(fifteen.sheets[0].firstInput, '');
    assert.ok(fifteen.sheets[0].summaryFormulas.every(Boolean));
    assert.equal(thirtyTwo.sheets.length, 3);
    assert.deepEqual(thirtyTwo.sheets.map(sheet => sheet.name), ['Muayene P001-015', 'Muayene P016-030', 'Muayene P031-032']);
    assert.deepEqual(thirtyTwo.sheets[2].headers.slice(0, 3), ['31', '32', '']);
    assert.ok(thirtyTwo.sheets[2].summaryFormulas.slice(0, 2).every(Boolean));
    assert.ok(thirtyTwo.sheets[2].summaryFormulas.slice(2).every(value => value === ''));
    assert.ok(thirtyTwo.sheets.slice(0, -1).every(sheet => sheet.totalFormula === '' && sheet.statusFormula === ''));
    assert.match(thirtyTwo.sheets[2].totalFormula, /SUM\(COUNTA\('Muayene P001-015'!K11:Y11\),COUNTA\('Muayene P016-030'!K11:Y11\),COUNTA\('Muayene P031-032'!K11:Y11\)\)/);
    assert.match(thirtyTwo.sheets[2].suitableFormula, /SUM\(COUNTIF\('Muayene P001-015'!K39:Y39,"UYGUN"\),COUNTIF\('Muayene P016-030'!K39:Y39,"UYGUN"\),COUNTIF\('Muayene P031-032'!K39:Y39,"UYGUN"\)\)/);
    assert.ok(thirtyTwo.sheets[2].statusFormula.includes('D43'));
    assert.equal(fortyFive.sheets.length, 3);
    assert.deepEqual(fortyFive.sheets.map(sheet => sheet.name), ['Muayene P001-015', 'Muayene P016-030', 'Muayene P031-045']);
    assert.deepEqual(fortyFive.sheets[2].headers, Array.from({ length: 15 }, (_, i) => String(i + 31)));
    assert.ok(fortyFive.sheets[2].summaryFormulas.every(Boolean));
    assert.ok(fortyFive.sheets.slice(0, -1).every(sheet => sheet.totalFormula === ''));
    assert.match(fortyFive.sheets[2].totalFormula, /P001-015.*P016-030.*P031-045/);
    console.log('PASS 15/32/45 sample pages, numbered ranges and one global approval summary on the final page');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
