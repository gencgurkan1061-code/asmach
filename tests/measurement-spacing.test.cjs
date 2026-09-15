const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};
for(const name of ['requirements-engine','measurement-layout'])vm.runInNewContext(fs.readFileSync(`src/${name}.js`,'utf8'),context);
const reconstruct=context.window.ASMachMeasurementLayout.reconstruct;
function glyphRow(text,{x=100,y=200,h=40,gap=.25,proportional=false}={}){
  const words=[];
  for(const glyph of text){
    const punctuation=/[.,]/.test(glyph),minus=glyph==='-',degree=glyph==='°';
    const narrow=punctuation||glyph==='1',w=h*(punctuation?.12:proportional?(narrow?.26:.57):.55);
    words.push({text:glyph,x,y:y+(punctuation?h*.86:minus?h*.47:degree?-h*.12:0),w,h:punctuation?h*.14:minus?h*.08:degree?h*.35:h});
    x+=w+h*gap;
  }
  return words;
}
function rotated(words,angle,ocr){
  return words.map(w=>{
    const points=[[w.x,w.y],[w.x+w.w,w.y],[w.x,w.y+w.h],[w.x+w.w,w.y+w.h]].map(([x,y])=>[Math.cos(angle)*x-Math.sin(angle)*y,Math.sin(angle)*x+Math.cos(angle)*y]);
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    return {...w,x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),angle:ocr?-angle*180/Math.PI:angle};
  });
}
const result=words=>reconstruct(words,{details:true});
let positiveCount=0;
for(const proportional of [false,true])for(const gap of [.08,.5,1.05]){
  const options={gap,proportional};
  const main=glyphRow('Ø27.3',options),right=Math.max(...main.map(w=>w.x+w.w));
  const eleven=glyphRow('11',options),elevenRight=Math.max(...eleven.map(w=>w.x+w.w));
  const scenarios=[
    [main,'Ø27.3'],
    [glyphRow('R125',options),'R125'],
    [glyphRow('45°',options),'45°'],
    [glyphRow('.205',options),'.205'],
    [[...main,...glyphRow('0',{...options,x:right+30,y:184,h:16}),...glyphRow('-0.05',{...options,x:right+30,y:231,h:16})],'Ø27.3 (0/-0.05)'],
    [[...eleven,...glyphRow('+0.1',{...options,x:elevenRight+30,y:180,h:18}),...glyphRow('0',{...options,x:elevenRight+30,y:229,h:18})],'11 (+0.1/0)'],
    [[...glyphRow('0.596',options),...glyphRow('0.586',{...options,y:262})],'0.596 MAX 0.586 MIN'],
    [[...glyphRow('11',options),...glyphRow('+0.2',{...options,x:elevenRight+30,y:180,h:18}),...glyphRow('+0.1',{...options,x:elevenRight+30,y:229,h:18})],'11 (+0.2/+0.1)'],
  ];
  for(const [words,expected]of scenarios)for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI])for(const ocr of [false,true]){
    const actual=reconstruct(rotated(words,angle,ocr),{details:true,ocr});
    assert.equal(actual.text,expected,`${expected}: proportional=${proportional} gap=${gap} angle=${angle} ocr=${ocr}`);
    assert.equal(actual.missingDigits,0);
    assert.notEqual(actual.ambiguousSpacing,true);
    positiveCount++;
  }
}
// A complete numeric word remains a separate measure, even close to another.
for(const [left,right]of [['25','35'],['0.2','0.5'],['1','2'],['25.4','5'],['25','4']]){
  const actual=result([{text:left,x:100,y:100,w:30,h:40},{text:right,x:195,y:100,w:30,h:40}]);
  assert.notEqual(actual.text,left+right);
  assert.equal(actual.structured,false);
  assert.equal(actual.ambiguousSpacing,true);
  assert.equal(actual.missingDigits,0);
}
// One oversized gap between the first digit and decimal group is not tracking.
const split=glyphRow('1.25',{gap:.12});
for(const w of split.slice(1))w.x+=90;
const ambiguous=result(split);
assert.equal(ambiguous.structured,false);
assert.equal(ambiguous.ambiguousSpacing,true);
assert.equal(ambiguous.missingDigits,0);
const bareWide=result(glyphRow('123',{gap:1.1}));
assert.notEqual(bareWide.text,'123');
assert.equal(bareWide.ambiguousSpacing,true);
assert.equal(bareWide.structured,false);
const unresolved=result([{text:'25 4',x:100,y:200,w:100,h:40},{text:'+0.1',x:230,y:185,w:50,h:18}]);
assert.equal(unresolved.ambiguousSpacing,true);
assert.equal(unresolved.structured,false);
assert.equal(unresolved.missingDigits,0);
// Quantities and datum letters remain visible, not numeric reconstruction data.
const quantity=result([{text:'3',x:0,y:200,w:20,h:40},{text:'x',x:45,y:200,w:20,h:40},...glyphRow('Ø25.4')]);
assert.equal(quantity.text,'3 x Ø25.4');
const datum=result([...glyphRow('25.4'),{text:'A',x:450,y:200,w:25,h:40}]);
assert.equal(datum.structured,false);
assert.ok(datum.text.includes('A'));
assert.equal(datum.missingDigits,0);
console.log(`Measurement spacing: ${positiveCount} proportional/monospace, tracking, baseline punctuation, limits, signed deviations and rotated cases passed; uncertain neighboring values retained.`);
