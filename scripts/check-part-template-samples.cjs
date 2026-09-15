const { chromium } = require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const source = 'C:/Users/gencg/AppData/Roaming/com.asmach.ballooning/templates/Parca_Muayene_Formu.xltx';
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    const result = await page.evaluate(async base64 => {
      const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
      const template = await ASMachExcelTemplateImport.read(new File([bytes], 'Parca_Muayene_Formu.xltx'));
      const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', parse = value => new DOMParser().parseFromString(value, 'application/xml'), sheetName = template.sourceSheets[0].name;
      const output = ASMachExcelTemplateImport.files(template, { metadata: {}, annotations: [], __excelSampleCount: 45 }, false), work = parse(output['xl/workbook.xml']), rels = parse(output['xl/_rels/workbook.xml.rels']);
      const sheets = [...work.getElementsByTagNameNS(ns, 'sheet')].map((sheet, sheetIndex) => { const id = sheet.getAttribute('r:id'), target = [...rels.documentElement.children].find(item => item.getAttribute('Id') === id).getAttribute('Target'), filePath = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, ''), document = parse(output[filePath]), names=[...work.getElementsByTagNameNS(ns,'definedName')],order=[...document.documentElement.children].map(n=>n.localName); const cell = ref => document.querySelector(`c[r="${ref}"]`), localName = name => names.find(n=>n.getAttribute('name')===name&&n.getAttribute('localSheetId')===String(sheetIndex))?.textContent||''; return { name: sheet.getAttribute('name'), headers:[cell('M11')?.textContent||'',cell('AA11')?.textContent||''], extraHeader:cell('AD11')?.textContent||'', formula:cell('M39')?.querySelector('f')?.textContent||'', countFormula: cell('E42')?.querySelector('f')?.textContent || '', suitableFormula: cell('L42')?.querySelector('f')?.textContent || '', unsuitableFormula: cell('E43')?.querySelector('f')?.textContent || '', statusFormula: cell('L43')?.querySelector('f')?.textContent || '', print:localName('_xlnm.Print_Area'),fit:document.querySelector('pageSetup')?.getAttribute('fitToWidth')||'',order }; });
      const workbookBytes=new Uint8Array(await ASMachWorkflow.zipStored(output).arrayBuffer()),workbookBase64=btoa(Array.from(workbookBytes,value=>String.fromCharCode(value)).join(''));
      return { source: sheetName, sheets, workbookBase64, calcChain: Object.hasOwn(output, 'xl/calcChain.xml') || /calcChain/i.test(output['xl/_rels/workbook.xml.rels']) || /calcChain/i.test(output['[Content_Types].xml']), invalidXml: Object.entries(output).filter(([name, value]) => /\.(?:xml|rels)$/.test(name) && typeof value === 'string' && parse(value).querySelector('parsererror')).map(([name]) => name) };
    }, fs.readFileSync(source).toString('base64'));
    assert.equal(result.sheets.length, 3);
    assert.deepEqual(result.sheets.map(sheet=>sheet.headers), [['1','15'],['16','30'],['31','45']]);
    assert.ok(result.sheets.every(sheet=>sheet.extraHeader===''));
    assert.ok(result.sheets.every(sheet=>sheet.formula));
    assert.ok(result.sheets.slice(0,-1).every(sheet=>!sheet.countFormula&&!sheet.suitableFormula&&!sheet.unsuitableFormula&&!sheet.statusFormula));
    const sheet=result.sheets.at(-1);
    assert.match(sheet.countFormula, /P001-015.*M\$?11:AA\$?11.*P016-030.*M\$?11:AA\$?11.*P031-045.*M\$?11:AA\$?11/);
    assert.match(sheet.suitableFormula, /P001-015.*M\$?39:AA\$?39.*P016-030.*M\$?39:AA\$?39.*P031-045.*M\$?39:AA\$?39/);
    assert.match(sheet.unsuitableFormula, /P001-015.*M\$?39:AA\$?39.*P016-030.*M\$?39:AA\$?39.*P031-045.*M\$?39:AA\$?39/);
    assert.match(sheet.statusFormula, /E43/);
    assert.ok(result.sheets.every(sheet=>!/\$BK\$/.test(sheet.print)));
    assert.ok(result.sheets.every(item=>item.order.lastIndexOf('conditionalFormatting') < item.order.indexOf('dataValidations')));
    assert.ok(result.sheets.every(item=>item.order.lastIndexOf('conditionalFormatting') < item.order.indexOf('pageMargins')));
    assert.equal(result.calcChain, false);
    assert.deepEqual(result.invalidXml, []);
    const review=path.resolve('outputs/template-review/Parca_Muayene_Formu_45_sayfalar_test.xlsx');fs.mkdirSync(path.dirname(review),{recursive:true});fs.writeFileSync(review,Buffer.from(result.workbookBase64,'base64'));
    console.log('PASS real Parca_Muayene_Formu: 45 pieces, 3 sheets, one global approval summary and no calcChain repair');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
