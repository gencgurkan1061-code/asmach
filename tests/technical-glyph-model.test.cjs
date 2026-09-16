const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../src/technical-glyph-model.js');
const model=JSON.parse(fs.readFileSync(path.join(__dirname,'..','ocr','experimental-model','technical-glyph-v1.json'),'utf8'));
test('trained glyph model loads learned weights and remains advisory',()=>{
  const classifier=api.create(model);
  assert.equal(model.training.method,'supervised Adam/backpropagation');
  assert.ok(model.training.samples>=8000);
  assert.equal(classifier.modelId,'technical-glyph-mlp-v1');
  const result=classifier.inferPixels({width:2,height:2,data:new Uint8ClampedArray(16).fill(255)});
  assert.equal(result.accepted,false);assert.equal(result.reason,'empty-crop');assert.equal(result.advisoryOnly,true);
});
test('glyph inputs and model dimensions are validated',()=>{
  assert.throws(()=>api.create({...model,input:{side:24,features:1}}),/Unsupported/);
  assert.throws(()=>api.create({...model,weights:{...model.weights,w1:[NaN]}}),/weights/);
  assert.throws(()=>api.extractPixels({width:999999,height:999999,data:[]}),/bounded/);
  assert.throws(()=>api.create(model).inferFeatures([NaN]),/feature/);
});
test('font families and fixture seeds are separated before model fitting',()=>{
  const splits=model.training.fontSplits;
  for(const [left,right]of [['train','calibration'],['train','holdout'],['calibration','holdout']]){
    assert.equal(splits[left].some(value=>splits[right].includes(value)),false);
    assert.notEqual(model.training.splitSeeds[left],model.training.splitSeeds[right]);
  }
  assert.match(model.limitations.join(' '),/Never silently replace/);
});
test('transparent glyph pixels do not become black evidence',()=>{
  const data=new Uint8ClampedArray(4*4*4),extracted=api.extractPixels({width:4,height:4,data});
  assert.equal(extracted.empty,true);
  data[4*5+3]=255;
  const opaque=api.extractPixels({width:4,height:4,data});
  assert.equal(opaque.empty,false);assert.equal(opaque.bounds.width,1);
});
