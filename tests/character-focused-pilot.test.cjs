const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const pilot = require('./helpers/character-focused-verifier.js'), t = pilot._test;
test('only explicit confusable families can produce a review suggestion', () => {
  for (const [a,b] of [['0','O'],['O','Ø'],['1','l'],['5','S'],['8','B'],['0','8']]) assert.equal(t.related(a,b),true);
  for (const [a,b] of [['3','9'],['M','H'],['0','0'],['8','<reject>']]) assert.equal(t.related(a,b),false);
});
test('two image variants must agree and satisfy the fixed review thresholds', () => {
  const p={label:'0',score:.99,margin:.96}; assert.equal(t.allowedProposal(p,p),true);
  assert.equal(t.allowedProposal(p,{...p,label:'O'}),false); assert.equal(t.allowedProposal(p,{...p,score:.94}),false);
  assert.equal(t.allowedProposal(p,{...p,margin:.8}),false); assert.equal(t.allowedProposal({...p,label:'<reject>'},{...p,label:'<reject>'}),false);
});
test('binary image preprocessing preserves the source evidence', () => {
  const source={width:2,height:1,data:new Uint8ClampedArray([30,30,30,255,240,240,240,255])},copy=Array.from(source.data),result=t.binarize(source);
  assert.deepEqual(Array.from(source.data),copy); assert.notEqual(result.data,source.data); assert.equal(result.data[0],0); assert.equal(result.data[4],255);
});
test('GD&T, prose and trusted reads remain unchanged without image processing', async () => {
  const previous = global.ASMachRequirements;
  global.ASMachRequirements={assessReading:()=>({valid:true,kind:'dimension',signature:'same'})};
  try {
    for(const [source,options] of [[{visualGdt:true},{}],[{}, {textMode:true}],[{}, {numericScope:'nominal'}],[{confidence:98},{}]]){
      const primary=Object.freeze({text:'25',words:[],...source}),r=await pilot.analyze(null,primary,null,options);
      assert.equal(r.text,'25');assert.equal(r.proposedText,null);assert.equal(r.automaticallyChanged,false);assert.deepEqual(r.checks,[]);
    }
  } finally { global.ASMachRequirements=previous; }
});
test('missing character geometry is not invented', async () => {
  const previous=global.ASMachRequirements;global.ASMachRequirements={assessReading:()=>({valid:false,kind:'dimension'})};
  try { const r=await pilot.analyze(null,{text:'??',needsReview:true},null,{});assert.equal(r.reason,'no-observed-character-boxes');assert.equal(r.proposedText,null); }
  finally { global.ASMachRequirements=previous; }
});
test('experimental helper is not included in the production HTML', () => {
  const html=fs.readFileSync(path.join(__dirname,'../ASMach_Teknik_Resim_Balonlama.html'),'utf8');
  assert.equal(html.includes('PilotCharacterVerifier'),false);assert.equal(html.includes('character-focused-pilot-v1'),false);
});
test('frozen fonts are excluded from fitting and calibration', {skip:!fs.existsSync(path.join(__dirname,'../outputs/character-focused-pilot-v1/training-report.json'))}, () => {
  const report=JSON.parse(fs.readFileSync(path.join(__dirname,'../outputs/character-focused-pilot-v1/training-report.json')));
  for(const font of report.fontSplits.holdout)assert.equal([...report.fontSplits.train,...report.fontSplits.calibration].includes(font),false);
  assert.equal(report.realUserCorrections,0);assert.equal(report.productionEnabled,false);
});
