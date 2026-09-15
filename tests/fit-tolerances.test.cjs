'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const html = fs.readFileSync('src/app.template.html', 'utf8');
const context = vm.createContext({window:{},console});
vm.runInContext(html.slice(html.indexOf('function parseTechnicalRequirementLegacy('),html.indexOf('function technicalTextScore(')),context);
vm.runInContext(fs.readFileSync('src/requirements-engine.js','utf8'),context);
const api = context.window.ASMachRequirements;
const parse = text => api.parse(text,'ISO 2768-mK',context.parseTechnicalRequirementLegacy);

test('Screenshot: isolated PDF/OCR glyphs retain Ø50 d6 and yield exact deviations and limits',()=>{
  for(const text of ['Ø5 0 d6','Ø5 0 d 6','Φ 5 0 d 6','Ø50d6','Ø 50 d6','⌀50 d6']){
    const p=parse(text);
    assert.equal(p.type,'Çap',text);assert.equal(p.nominalValue,'50',text);assert.equal(p.fitClass,'d6');
    assert.equal(p.lowerTolerance,'-0.096');assert.equal(p.upperTolerance,'-0.08');
    assert.equal(p.lowerLimit,'49.904');assert.equal(p.upperLimit,'49.92');
    assert.equal(p.toleranceExplicit,true);assert.equal(p.parseWarnings.length,0);
    assert.match(p.toleranceStandard,/ISO 286 d6.*NACHI/);
  }
  assert.equal(api.normalize('Ø5 0 d 6'),'Ø50 d6');
  assert.equal(parse('50 d6').type,'Geçme');
  assert.equal(parse('Ø2 7 . 3 d 6').nominalValue,'27.3');
  assert.equal(parse('Ø27,3 d6').nominalValue,'27.3');
});

test('Fit code is case sensitive and preserves asymmetric / positive / symmetric fields',()=>{
  for(const [code,low,high] of [['d6',-.096,-.08],['e6',-.066,-.05],['f6',-.041,-.025],['g6',-.025,-.009],['G6',.009,.025],['h6',-.016,0],['H6',0,.016],['H7',0,.025],['k6',.002,.018],['js6',-.008,.008],['JS7',-.0125,.0125]]){
    const p=parse(`Ø50 ${code}`);assert.equal(Number(p.lowerTolerance),low,code);assert.equal(Number(p.upperTolerance),high,code);
  }
  assert.equal(api.isoFitLookup(50,'D6'),null,'Do not replace unknown D6 with shaft d6');
});

test('Nominal intervals are lower-exclusive / upper-inclusive with no extrapolation',()=>{
  for(const [size,low,high] of [[6,-.038,-.03],[6.001,-.049,-.04],[30,-.078,-.065],[50,-.096,-.08],[50.001,-.119,-.1],[400,-.246,-.21],[500,-.270,-.230]]){
    const p=parse(`Ø${size} d6`);assert.equal(Number(p.lowerTolerance),low,String(size));assert.equal(Number(p.upperTolerance),high,String(size));
  }
  for(const size of [0,3,1601,NaN,Infinity])assert.equal(api.isoFitLookup(size,'d6'),null);
});

test('Every shipped lookup reproduces the captured producer cell at midpoint and inclusive endpoint',()=>{
  const source=JSON.parse(fs.readFileSync('reference/iso-fit-reference.json','utf8')).rows;
  let checked=0;
  for(const code of api.fitClasses){
    const rows=source[code]||source[code.replace(/^JS/,'Js')];assert.ok(rows?.length,code);
    for(const [lo,hi,lower,upper] of rows){
      for(const size of [(lo+hi)/2,hi]){
        const found=api.isoFitLookup(size,code);assert.ok(found,`${size} ${code}`);
        assert.equal(Number(found.lower),lower/1000,`${size} ${code} lower`);
        assert.equal(Number(found.upper),upper/1000,`${size} ${code} upper`);checked++;
      }
    }
  }
  assert.ok(checked>1500);
});

test('Unsupported classes, units, pairs and ambiguous extra numbers cannot inherit general tolerances',()=>{
  for(const text of ['Ø50 D6','Ø50 z9','Ø2 d6','Ø1800 d6','Ø50 d6 in','Ø50 H7/g6','Ø50 d6 30']){
    const p=parse(text);assert.equal(p.lowerTolerance,'',text);assert.equal(p.upperTolerance,'',text);
    assert.equal(p.lowerLimit,'',text);assert.equal(p.upperLimit,'',text);assert.equal(p.toleranceExplicit,true,text);
    assert.ok(p.parseWarnings.length,text);assert.ok(!p.toleranceStandard.includes('2768'),text);
  }
  assert.equal(parse('Ø20 30 H7').nominalValue,'','Never merge two complete dimensions');
  for(const text of ['M6x1-6H','M10-6g','R5','D6','DATUM A','Not 6: kontrol'])assert.equal(parse(text).fitClass||'','',text);
});

test('Explicit deviations next to a fit code win and mismatches are flagged',()=>{
  const p=parse('Ø50 d6 (+0.02/-0.01)');
  assert.equal(p.fitClass,'d6');assert.equal(Number(p.lowerTolerance),-.01);assert.equal(Number(p.upperTolerance),.02);
  assert.equal(p.lowerLimit,'49.99');assert.equal(p.upperLimit,'50.02');assert.match(p.toleranceStandard,/öncelikli/);
  assert.ok(p.parseWarnings.some(w=>w.includes('farklı')));
});
