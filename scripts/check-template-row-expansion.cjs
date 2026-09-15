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
    const result = await page.evaluate(() => {
      const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
      const rels = 'http://schemas.openxmlformats.org/package/2006/relationships';
      const cell = (ref, text) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
      const sheet = `<worksheet xmlns="${ns}"><dimension ref="A1:E6"/><sheetData>` +
        `<row r="1">${cell('A1', 'BAŞLIK')}</row>` +
        `<row r="3" ht="22" customHeight="1">${cell('A3', '{{record.number}}')}${cell('B3', '{{record.nominal}}')}${cell('C3', 'Birleşik')}</row>` +
        `<row r="4" ht="22" customHeight="1"/>` +
        `<row r="6">${cell('A6', 'TOPLAM / ONAY')}<c r="B6"><f>SUM(B3:B4)</f><v>0</v></c></row>` +
        `</sheetData><mergeCells count="1"><mergeCell ref="C3:D3"/></mergeCells>` +
        `<rowBreaks count="1" manualBreakCount="1"><brk id="6" man="1" max="16383"/></rowBreaks>` +
        `<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
        `<headerFooter><oddFooter>Sayfa &amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;
      const bindings = { '2:0': { field: 'record.number' }, '2:1': { field: 'record.nominalValue' } };
      const workbook = `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Rapor" sheetId="1" r:id="rId1"/></sheets><definedNames>` +
        `<definedName name="ASMach_List" localSheetId="0">'Rapor'!$A$3:$E$4</definedName>` +
        `<definedName name="ASMach_FinalFooter" localSheetId="0">'Rapor'!$A$6:$E$6</definedName>` +
        `<definedName name="_xlnm.Print_Area" localSheetId="0">'Rapor'!$A$1:$E$6</definedName>` +
        `<definedName name="_xlnm.Print_Titles" localSheetId="0">'Rapor'!$1:$2</definedName>` +
        `</definedNames></workbook>`;
      const template = {
        format: 'imported', direction: 'rows', overflowMode: 'expandRows', sheetIndex: 0,
        sourceSheets: [{ name: 'Rapor', path: 'xl/worksheets/sheet1.xml' }],
        bindings: { 'xl/worksheets/sheet1.xml': bindings }, cells: bindings,
        parts: {
          'xl/worksheets/sheet1.xml': { text: sheet },
          'xl/workbook.xml': { text: workbook },
          'xl/_rels/workbook.xml.rels': { text: `<Relationships xmlns="${rels}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rIdCalc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>` },
          'xl/calcChain.xml': { text: `<calcChain xmlns="${ns}"><c r="B6" i="1"/></calcChain>` },
          '[Content_Types].xml': { text: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>' }
        }
      };
      const state = { ...ASMachApp.state, annotations: Array.from({ length: 5 }, (_, i) => ({ number: String(i + 1), nominalValue: String(i + 1), type: 'Uzunluk', requirement: `Ölçü ${i + 1}`, page: 1 })) };
      const output = ASMachExcelTemplateImport.files(template, state, false);
      const parse = text => new DOMParser().parseFromString(text, 'application/xml');
      const document = parse(output['xl/worksheets/sheet1.xml']);
      const work = parse(output['xl/workbook.xml']);
      const textAt = ref => document.querySelector(`c[r="${ref}"]`)?.textContent || '';
      return {
        sheetCount: Object.keys(output).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).length,
        values: [3, 4, 5, 6, 7].map(row => textAt(`A${row}`)),
        footer: textAt('A9'), formula: document.querySelector('c[r="B9"] f')?.textContent,
        merges: [...document.getElementsByTagName('mergeCell')].map(item => item.getAttribute('ref')),
        breakId: document.querySelector('brk')?.getAttribute('id'),
        names: [...work.getElementsByTagName('definedName')].map(item => [item.getAttribute('name'), item.textContent]),
        dimension: document.querySelector('dimension')?.getAttribute('ref'),
        calcChainPart: Object.hasOwn(output, 'xl/calcChain.xml'),
        calcChainRelationship: /calcChain/i.test(output['xl/_rels/workbook.xml.rels']),
        calcChainType: /calcChain/i.test(output['[Content_Types].xml']),
        fullCalculation: /fullCalcOnLoad="1"/.test(output['xl/workbook.xml']) && /forceFullCalc="1"/.test(output['xl/workbook.xml'])
      };
    });
    assert.equal(result.sheetCount, 1);
    assert.deepEqual(result.values, ['1', '2', '3', '4', '5']);
    assert.equal(result.footer, 'TOPLAM / ONAY');
    assert.equal(result.formula, 'SUM(B3:B7)');
    assert.deepEqual(result.merges, ['C3:D3', 'C4:D4', 'C5:D5', 'C6:D6', 'C7:D7']);
    assert.equal(result.breakId, '9');
    assert.ok(result.names.some(([name, value]) => name === 'ASMach_List' && value.endsWith('$A$3:$E$7')));
    assert.ok(result.names.some(([name, value]) => name === 'ASMach_FinalFooter' && value.endsWith('$A$9:$E$9')));
    assert.ok(result.names.some(([name, value]) => name === '_xlnm.Print_Area' && value.endsWith('$A$1:$E$9')));
    assert.equal(result.dimension, 'A1:E9');
    assert.equal(result.calcChainPart, false);
    assert.equal(result.calcChainRelationship, false);
    assert.equal(result.calcChainType, false);
    assert.equal(result.fullCalculation, true);
    console.log('PASS row expansion, formula/footer shifts, merges, print area and page breaks');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
