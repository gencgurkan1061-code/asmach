const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const context={window:{}};
for(const name of ['requirements-engine','measurement-layout'])vm.runInNewContext(fs.readFileSync(`src/${name}.js`,'utf8'),context);
const reconstruct=context.window.ASMachMeasurementLayout.reconstruct;
const read=words=>reconstruct(words,{details:true});

function glyphs(text,{x=100,y=200,h=40,gap=.2,proportional=false}={}){
  const result=[];
  for(const char of text){
    const decimal=/[.,]/.test(char),minus=char==='-',degree=char==='°';
    const width=h*(decimal?.12:proportional&&char==='1'?.27:.55);
    result.push({text:char,x,y:y+(decimal?h*.86:minus?h*.47:degree?-h*.12:0),w:width,h:decimal?h*.14:minus?h*.08:degree?h*.35:h});
    x+=width+h*gap;
  }
  return result;
}
function word(text,symbols){
  const x=Math.min(...symbols.map(s=>s.x)),y=Math.min(...symbols.map(s=>s.y));
  return {text,x,y,w:Math.max(...symbols.map(s=>s.x+s.w))-x,h:Math.max(...symbols.map(s=>s.y+s.h))-y,symbols};
}
function rotate(words,angle,ocr){
  return words.map(w=>{
    const corners=[[w.x,w.y],[w.x+w.w,w.y],[w.x,w.y+w.h],[w.x+w.w,w.y+w.h]].map(([x,y])=>[Math.cos(angle)*x-Math.sin(angle)*y,Math.sin(angle)*x+Math.cos(angle)*y]);
    const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
    return {...w,x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),angle:ocr?-angle*180/Math.PI:angle,
      ...(w.symbols?{symbols:rotate(w.symbols,angle,ocr)}:{})};
  });
}

let positiveCases=0;
for(const proportional of [false,true])for(const gap of [.08,.5,1.05]){
  const options={gap,proportional};
  for(const text of ['27.3','Ø27.3','R125','45°','.205']){
    const source=[word(text,glyphs(text,options))],original=JSON.stringify(source);
    for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI])for(const ocr of [false,true]){
      const result=reconstruct(rotate(source,angle,ocr),{details:true,ocr});
      assert.equal(result.text,text,`${text}, gap=${gap}, proportional=${proportional}, angle=${angle}`);
      assert.equal(result.symbolGeometryWords,1);
      assert.equal(result.missingDigits,0);
      assert.notEqual(result.ambiguousSpacing,true);
      positiveCases++;
    }
    assert.equal(JSON.stringify(source),original,'character reconstruction must not mutate retained OCR evidence');
  }
}

// OCR may normalize spacing before this stage. Character boxes still reveal
// whether there was a genuine gap between independent numeric groups.
const spacedSymbols=glyphs('27.3',{gap:.5});
assert.equal(read([word('2 7 . 3',spacedSymbols)]).text,'27.3');
const brokenSymbols=glyphs('1.25',{gap:.1});
for(const symbol of brokenSymbols.slice(1))symbol.x+=100;
const broken=read([word('1.25',brokenSymbols)]);
assert.equal(broken.ambiguousSpacing,true);
assert.equal(broken.structured,false);
assert.ok(broken.ambiguityReasons.includes('separated_numeric_glyphs'));
assert.match(broken.geometryText,/1\s+\./,'the unjoined evidence must remain available for review');
assert.equal(broken.missingDigits,0);

// Neither ordering of single-digit / whole numeric words may concatenate.
for(const [left,right]of [['5','12'],['12','5'],['12','35']])for(const withSymbols of [false,true]){
  const first=word(left,glyphs(left,{x:100,gap:.08}));
  const second=word(right,glyphs(right,{x:first.x+first.w+8,gap:.08}));
  const source=[first,second].map(w=>withSymbols?w:(({symbols,...rest})=>rest)(w));
  const result=read(source);
  assert.notEqual(result.text,left+right);
  assert.equal(result.ambiguousSpacing,true);
  assert.ok(result.ambiguityReasons.includes('separate_numeric_words'));
  assert.equal(result.missingDigits,0);
}

// Character evidence with a missing decimal or a box outside its parent is not
// trusted. The recognized word is retained, not rewritten from partial glyphs.
const complete=word('27.3',glyphs('27.3'));
for(const symbols of [complete.symbols.filter(s=>s.text!=='.'),complete.symbols.map((s,i)=>({...s,x:s.x+(i===0?1000:0)}))]){
  const result=read([{...complete,symbols}]);
  assert.equal(result.text,'27.3');assert.equal(result.symbolGeometryWords,undefined);assert.equal(result.missingDigits,0);
}

// A thin minus or dot between rows is evidence to review, not permission to
// invent the sign of a nearby nominal or silently treat a speck as a decimal.
for(const mark of ['-','+','±','.','°']){
  const result=read([{text:'25',x:100,y:200,w:50,h:40},{text:mark,x:170,y:290,w:8,h:4}]);
  assert.equal(result.ambiguousSpacing,true,mark);assert.equal(result.structured,false);
  assert.ok(result.ambiguityReasons.includes('unattached_mark'));
  assert.equal(result.missingDigits,0);
}

const nominal=word('11',glyphs('11',{x:100,y:200,h:40,gap:.08}));
const upper=word('+0.1',glyphs('+0.1',{x:190,y:180,h:18,gap:.15}));
const lower=word('-0.05',glyphs('-0.05',{x:190,y:231,h:18,gap:.15}));
const tolerance=read([nominal,upper,lower]);
assert.equal(tolerance.text,'11 (+0.1/-0.05)');assert.equal(tolerance.structured,true);assert.equal(tolerance.missingDigits,0);
const inverted=read([nominal,{...upper,text:'-0.05',symbols:undefined},{...lower,text:'+0.1',symbols:undefined}]);
assert.equal(inverted.structured,false);assert.equal(inverted.ambiguousSpacing,true);
assert.ok(inverted.ambiguityReasons.includes('inverted_deviation_rows'));
const limits=read([word('0.596',glyphs('0.596',{y:200})),word('0.586',glyphs('0.586',{y:262}))]);
assert.equal(limits.text,'0.596 MAX 0.586 MIN');assert.equal(limits.limitDimension,true);assert.equal(limits.structured,true);

// GD&T cells and mixed alphanumeric tokens never qualify for numeric symbol
// expansion; this change does not interpret geometric symbols or datum cells.
for(const text of ['⌖','A','M12','H7','Ra3.2']){
  const result=read([word(text,glyphs(text))]);assert.equal(result.symbolGeometryWords,undefined,text);
}
const frame=read([{text:'⌖',x:0,y:200,w:30,h:40},word('Ø0.008',glyphs('Ø0.008')),{text:'A',x:450,y:200,w:20,h:40}]);
assert.equal(frame.symbolGeometryWords,undefined,'numeric symbol expansion is bypassed when the source contains GD&T evidence');

function benchmark(source){
  const elapsed=[];
  for(let sample=0;sample<3;sample++){
    const start=performance.now();for(let i=0;i<500;i++)read(source);elapsed.push((performance.now()-start)/500);
  }
  return elapsed.sort((a,b)=>a-b)[1];
}
const symbolMs=benchmark([nominal,upper,lower]);
const wordMs=benchmark([nominal,upper,lower].map(({symbols,...rest})=>rest));
console.log(`Measurement layout safety: ${positiveCases} symbol-geometry/font/tracking/orientation cases plus boundary, small-mark, limit and deviation checks passed.`);
console.log(`Reconstruction median, 500 crops x 3: whole words ${wordMs.toFixed(3)} ms/crop; verified character boxes ${symbolMs.toFixed(3)} ms/crop (OCR time excluded).`);
