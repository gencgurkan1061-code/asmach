// Offline parity and bounded inference benchmark for the independently trained
// glyph model. This does not claim complete-line/drawing OCR accuracy or speed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'outputs','technical-glyph-training');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'holdout-fixtures.json'),'utf8'));
const modelText=fs.readFileSync(path.join(root,'ocr','experimental-model','technical-glyph-v1.json'),'utf8');
const hash=crypto.createHash('sha256').update(modelText).digest('hex');
if(hash!==manifest.modelSha256)throw new Error('Holdout/model identity mismatch.');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage();
    await page.route(/^https?:/,route=>route.abort());
    await page.setContent('<!doctype html><title>Offline glyph model verification</title>');
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'src','technical-glyph-model.js'),'utf8')});
    const startupMs=await page.evaluate(text=>{const start=performance.now();window.classifier=ASMachTechnicalGlyphModel.create(JSON.parse(text));window.testImages=[];return performance.now()-start;},modelText);
    const cases=[];
    for(const fixture of manifest.fixtures){
      if(path.basename(fixture.file)!==fixture.file)throw new Error('Unsafe fixture path.');
      const snapshot='data:image/png;base64,'+fs.readFileSync(path.join(directory,'holdout-fixtures',fixture.file)).toString('base64');
      const result=await page.evaluate(async ({snapshot,fixture})=>{
        const image=new Image();image.src=snapshot;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
        const pixels=context.getImageData(0,0,canvas.width,canvas.height),options={referenceHeight:fixture.referenceHeight};
        const extracted=ASMachTechnicalGlyphModel.extractPixels(pixels,options);
        const maxFeatureDifference=Math.max(...Array.from(extracted.vector,(value,index)=>Math.abs(value-fixture.features[index])));
        const predicted=classifier.inferPixels(pixels,options);
        testImages.push({pixels,options});
        return {maxFeatureDifference,label:predicted.label,accepted:predicted.accepted,score:predicted.score,margin:predicted.margin};
      },{snapshot,fixture});
      cases.push({file:fixture.file,expected:fixture.label,...result,correct:result.label===fixture.label});
    }
    const timing=await page.evaluate(()=>{
      // Warm up separately. Include feature extraction and inference, but not
      // image decoding/segmentation or the main OCR engine.
      for(let i=0;i<200;i++){const item=testImages[i%testImages.length];classifier.inferPixels(item.pixels,item.options);}
      const runs=[];
      for(let round=0;round<7;round++){
        const started=performance.now();
        for(let i=0;i<1000;i++){const item=testImages[i%testImages.length];classifier.inferPixels(item.pixels,item.options);}
        runs.push((performance.now()-started)/1000);
      }
      return {perGlyphMs:runs,medianGlyphMs:[...runs].sort((a,b)=>a-b)[Math.floor(runs.length/2)],includes:'feature extraction + MLP; excludes image decode, segmentation and main OCR'};
    });
    const maxFeatureDifference=Math.max(...cases.map(item=>item.maxFeatureDifference));
    const accepted=cases.filter(item=>item.accepted),summary={createdAt:new Date().toISOString(),modelSha256:hash,modelBytes:Buffer.byteLength(modelText),startupMs,
      fixtures:cases.length,exact:cases.filter(item=>item.correct).length,accepted:accepted.length,acceptedErrors:accepted.filter(item=>!item.correct).length,
      maxFeatureDifference,featureParityPass:maxFeatureDifference<1e-6,timing,cases};
    fs.writeFileSync(path.join(directory,'js-parity-benchmark.json'),JSON.stringify(summary,null,2)+'\n');
    console.log(JSON.stringify({...summary,cases:undefined}));
    if(!summary.featureParityPass)process.exitCode=1;
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
