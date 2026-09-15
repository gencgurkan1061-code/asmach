'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('src/app.template.html','utf8'),ctx=vm.createContext({window:{},console});
const start=/function (?:legacyParseTechnicalRequirement|parseTechnicalRequirementLegacy)\(rawText, generalToleranceStandard = ""\) \{/.exec(html);
assert.ok(start);
vm.runInContext(html.slice(start.index,html.indexOf('function technicalTextScore(',start.index)),ctx);
vm.runInContext(fs.readFileSync('src/requirements-engine.js','utf8'),ctx);
const r=ctx.window.ASMachRequirements,parse=text=>r.parse(text,'',ctx[start[0].match(/function (\w+)/)[1]]);
let checks=0;
for(const [text,fields] of [
  ['2 5 . 4 ± 0 . 0 5',{nominalValue:'25.4',lowerTolerance:'-0.05',upperTolerance:'+0.05'}],
  ['Ø 2 7 . 3 0 - 0 . 0 5',{type:'Çap',nominalValue:'27.3',lowerTolerance:'-0.05',upperTolerance:'0'}],
  ['1 1 ± 0 . 1',{nominalValue:'11',lowerTolerance:'-0.1',upperTolerance:'+0.1'}],
  ['Ø 5 0',{type:'Çap',nominalValue:'50'}],
  ['R 1 2 . 5',{type:'Yarıçap',nominalValue:'12.5'}],
  ['R 1 2',{type:'Yarıçap',nominalValue:'12'}],
  ['0 . 2 0 5 MAX 0 . 1 9 8 MIN',{nominalValue:'0.2015',lowerLimit:'0.198',upperLimit:'0.205'}],
  ['0 . 5 9 6\n0 . 5 8 6',{nominalValue:'0.591',lowerLimit:'0.586',upperLimit:'0.596'}],
  ['3 0° ± 0 . 5°',{type:'Açı',nominalValue:'30',lowerTolerance:'-0.5',upperTolerance:'0.5'}],
  ['R a 1 . 6 µm',{type:'Yüzey',nominalValue:'1.6',specialDesignator:'Ra',unit:'µm'}],
  ['Rz 1 2 . 5 µm',{type:'Yüzey',nominalValue:'12.5',specialDesignator:'Rz',unit:'µm'}],
  ['M 1 2 x 1 . 2 5 -6H',{type:'Diş',nominalValue:'12',threadPitch:'1.25',threadClass:'6H'}],
  ['Ø 5 0 H 7',{type:'Çap',nominalValue:'50',fitClass:'H7'}],
  ['⌖ | Ø 0 . 0 0 8 Ⓜ | A | B | C',{type:'GD&T',gdtSubtype:'position',upperTolerance:'0.008',datumRefs:'A | B | C'}],
  ['Ø\u202f２７．３ ± ０．０５',{type:'Çap',nominalValue:'27.3',lowerTolerance:'-0.05',upperTolerance:'+0.05'}],
]) {
  const value=parse(text);
  for(const [key,expected] of Object.entries(fields)){assert.equal(value[key],expected,text+' '+key+' -> '+JSON.stringify(value));checks++;}
  assert.equal(r.normalize(r.normalize(text)),r.normalize(text),'normalization is idempotent: '+text);
}
for(const [text,expected] of [
  ['1 1','1 1'],['20 30','20 30'],['20 30 ±0.1','20 30 ±0.1'],['0.2 0.5','0.2 0.5'],
  ['Ø24.5 ±0.05 35','Ø24.5 ±0.05 35'],['25.4 0 -0.1','25.4 0 -0.1'],
  ['1/4-20 UNC-2B','1/4-20 UNC-2B'],['1 1/4-20 UNC-2B','1 1/4-20 UNC-2B'],
  ['⌖ | Ø0.008Ⓜ | A-B | C','⌖|Ø0.008Ⓜ|A-B|C'],
  ['NOTE 1 2 3','NOTE 1 2 3'],['NOTE 2 5.4','NOTE 2 5.4'],['ØO.8','ØO.8'],['B54.9','B54.9'],
  ['25.4 5','25.4 5'],['Ra 3.2 5','Ra 3.2 5'],['25.4 5 ±0.1','25.4 5 ±0.1'],
  ['+0.1\n0','+0.1 / 0'],['0\n-0.1','0 / -0.1'],
]){assert.equal(r.normalize(text),expected,'must preserve ambiguity/source: '+text);assert.equal(r.normalize(r.normalize(text)),expected,'repeated normalization preserves boundaries: '+text);checks++;}
for(const text of ['1 1','20 30 ±0.1','0.2 0.5']){
  const value=parse(text);assert.equal(value.toleranceAmbiguous,true,text);assert.equal(value.lowerLimit,'',text);assert.equal(value.upperLimit,'',text);checks+=3;
}
ctx.window.ASMachApp={parseRequirement:parse};
for(const text of ['25.4 ±0.l','R5 +0.O','45° ±0.l°','2 x 45° ±0.l°']){
  const value=parse(text);assert.equal(value.toleranceAmbiguous,true,text);assert.equal(value.lowerTolerance,'',text);assert.equal(value.upperTolerance,'',text);assert.equal(r.assessReading(text).valid,false,text);checks+=4;
}
console.log('PASS '+checks+' spaced-text field and preservation checks; decimal/signed/limit/surface/angle/thread/fit/GD&T, unicode whitespace, no invented digits');
