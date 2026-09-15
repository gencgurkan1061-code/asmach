// Real, offline OCR matrix. Generated canvases are read by the production OCR worker.
// Baseline intentionally loads only the built HTML; --current overlays current sources.
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const current=process.argv.includes('--current');
const cases=[
  {id:'arial-clean-length',font:'Arial',tracking:0,text:'25.4',expected:{type:'Uzunluk',nominalValue:25.4}},
  {id:'arial-tracking3-length',font:'Arial',tracking:3,text:'125.45',expected:{type:'Uzunluk',nominalValue:125.45}},
  {id:'arial-tracking6-diameter',font:'Arial',tracking:6,text:'Ø27.3 ±0.05',expected:{type:'Çap',nominalValue:27.3,lowerTolerance:-.05,upperTolerance:.05}},
  {id:'times-tracking3-stacked',font:'Times New Roman',tracking:3,layout:'stacked',text:'Ø54.9',upper:'0',lower:'-0.1',expected:{type:'Çap',nominalValue:54.9,lowerTolerance:-.1,upperTolerance:0}},
  {id:'courier-jpeg-tracking6-stacked',font:'Courier New',tracking:6,quality:'jpeg',layout:'stacked',text:'11',upper:'+0.1',lower:'0',expected:{type:'Uzunluk',nominalValue:11,lowerTolerance:0,upperTolerance:.1}},
  {id:'arial-small-tracking6-limits',font:'Arial',tracking:6,quality:'small',layout:'limits',prefix:'Ø',text:'0.205',lower:'0.198',expected:{type:'Çap',nominalValue:.2015,lowerTolerance:-.0035,upperTolerance:.0035,lowerLimit:.198,upperLimit:.205}},
  {id:'times-small-limits',font:'Times New Roman',tracking:0,quality:'small',layout:'limits',text:'0.596',lower:'0.586',expected:{type:'Uzunluk',nominalValue:.591,lowerTolerance:-.005,upperTolerance:.005,lowerLimit:.586,upperLimit:.596}},
  {id:'courier-tracking6-radius',font:'Courier New',tracking:6,text:'R12.5',expected:{type:'Yarıçap',nominalValue:12.5}},
  {id:'arial-italic-jpeg-radius',font:'Arial',italic:true,tracking:3,quality:'jpeg',text:'R5 ±0.1',expected:{type:'Yarıçap',nominalValue:5,lowerTolerance:-.1,upperTolerance:.1}},
  {id:'times-jpeg-angle',font:'Times New Roman',tracking:3,quality:'jpeg',text:'45° ±0.5°',expected:{type:'Açı',nominalValue:45,lowerTolerance:-.5,upperTolerance:.5}},
  {id:'courier-tracking3-thread',font:'Courier New',tracking:3,text:'M10x1.5',expected:{type:'Diş',nominalValue:10,threadPitch:1.5}},
  {id:'arial-blur-chamfer',font:'Arial',tracking:3,quality:'blur',text:'0.5 x 45°',expected:{type:'Pah',nominalValue:.5,chamferAngle:45}},
  {id:'courier-small-tracking6-fit',font:'Courier New',tracking:6,quality:'small',text:'Ø20 H7',expected:{type:'Çap',nominalValue:20,fitClass:'H7',lowerTolerance:0,upperTolerance:.021}},
  {id:'arial-blur-surface',font:'Arial',tracking:0,quality:'blur',text:'Ra 3.2',expected:{type:'Yüzey',nominalValue:3.2,specialDesignator:'Ra'}},
  {id:'times-blur-tracking6-symmetric',font:'Times New Roman',tracking:6,quality:'blur',text:'25.4 ±0.1',expected:{type:'Uzunluk',nominalValue:25.4,lowerTolerance:-.1,upperTolerance:.1}},
  {id:'courier-jpeg-labeled-limits',font:'Courier New',tracking:3,quality:'jpeg',text:'10.5 MAX 10.1 MIN',expected:{type:'Uzunluk',nominalValue:10.3,lowerTolerance:-.2,upperTolerance:.2,lowerLimit:10.1,upperLimit:10.5}},
  {id:'separate-dimensions-no-join',font:'Arial',tracking:3,layout:'separate',text:'25',other:'35',forbidden:[2535,253.5,25.35]},
  {id:'separate-decimals-no-join',font:'Courier New',tracking:6,quality:'jpeg',layout:'separate',text:'2.5',other:'3.5',forbidden:[2.535,25.35,2535]}
];
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const selected=only?cases.filter(c=>c.id.includes(only)):cases;
if(!selected.length)throw new Error('No matching cases');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const results=[];
  try{
    const page=await browser.newPage();await page.route(/^https?:/,r=>r.abort());
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    if(current)for(const name of ['requirements-engine','gdt-vision','measurement-layout','ocr-image-enhancement','ocr-engine'])await page.addScriptTag({content:fs.readFileSync(path.join('src',name+'.js'),'utf8')});
    const fonts=await page.evaluate(()=>['Arial','Times New Roman','Courier New'].map(font=>({font,available:document.fonts.check('40px "'+font+'"')})));
    for(const entry of selected){
      const started=Date.now();
      try{
        const result=await page.evaluate(async entry=>{
          const source=document.createElement('canvas');source.width=700;source.height=entry.layout==='limits'||entry.layout==='stacked'?160:106;
          const g=source.getContext('2d');g.fillStyle=entry.quality==='blur'?'#eeeeee':'white';g.fillRect(0,0,source.width,source.height);g.fillStyle=entry.quality==='blur'?'#444444':'#111111';
          const font=size=>`${entry.italic?'italic ':''}${size}px "${entry.font}"`;
          function draw(text,x,y,size=40){g.font=font(size);let cursor=x;for(const char of text){g.fillText(char,cursor,y);cursor+=g.measureText(char).width+entry.tracking;}return cursor;}
          let right;
          if(entry.layout==='stacked'){
            right=draw(entry.text,18,97);right=Math.max(draw(entry.upper,right+17,56,25),draw(entry.lower,right+17,133,25));
          }else if(entry.layout==='limits'){
            const offset=entry.prefix?draw(entry.prefix,18,94)+6:18;
            right=Math.max(draw(entry.text,offset,61),draw(entry.lower,offset,133));
          }else if(entry.layout==='separate'){
            right=draw(entry.text,18,70);right=draw(entry.other,right+110,70);
          }else right=draw(entry.text,18,70);
          const crop=document.createElement('canvas');crop.width=Math.ceil(right+20);crop.height=source.height;crop.getContext('2d').drawImage(source,0,0);
          const image=document.createElement('canvas'),scale=entry.quality==='small'?.58:1;image.width=Math.round(crop.width*scale);image.height=Math.round(crop.height*scale);const imageContext=image.getContext('2d');
          imageContext.fillStyle='white';imageContext.fillRect(0,0,image.width,image.height);
          if(entry.quality==='blur')imageContext.filter='blur(0.75px)';imageContext.drawImage(crop,0,0,image.width,image.height);
          const snapshot=entry.quality==='jpeg'?image.toDataURL('image/jpeg',.42):image.toDataURL();
          const ocr=await ASMachOCR.recognize(snapshot,{enhancement:'auto'});
          const parsed=ASMachApp.parseRequirement(ocr.text,'');
          const semantic=ASMachRequirements.assessReading(ocr.text);
          return{snapshot,text:ocr.text,rawText:ocr.rawText,confidence:ocr.confidence,needsReview:!!ocr.needsReview,reviewReason:ocr.reviewReason,error:ocr.error,parsed,semantic,alternatives:ocr.alternatives};
        },entry);
        const failures=[];
        if(result.error)failures.push('OCR error: '+result.error);
        if(entry.expected)for(const [field,value] of Object.entries(entry.expected)){
          const actual=result.parsed[field];
          const same=typeof value==='number'?String(actual??'').trim()!==''&&Number.isFinite(Number(actual))&&Math.abs(Number(actual)-value)<1e-9:actual===value;
          if(!same)failures.push(`${field}: expected ${JSON.stringify(value)}, received ${JSON.stringify(actual)}`);
        }
        if(entry.forbidden){
          const nominal=Number(result.parsed.nominalValue);
          if(entry.forbidden.includes(nominal))failures.push('Separate dimensions incorrectly concatenated: '+nominal);
          if(result.semantic.valid&&!result.needsReview)failures.push('Ambiguous separate dimensions silently accepted without review');
        }
        const {snapshot,...serializable}=result;
        const item={...entry,...serializable,ok:failures.length===0,failures,elapsedMs:Date.now()-started};results.push(item);
        console.log(JSON.stringify({id:entry.id,text:result.text,ok:item.ok,needsReview:result.needsReview,failures,elapsedMs:item.elapsedMs}));
      }catch(error){const item={...entry,ok:false,failures:[error.stack||error.message],elapsedMs:Date.now()-started};results.push(item);console.log(JSON.stringify(item));}
    }
    await page.evaluate(()=>ASMachOCR.terminate());
    const output={mode:current?'current':'baseline',createdAt:new Date().toISOString(),fonts,total:results.length,passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results};
    fs.mkdirSync('outputs',{recursive:true});const filename=`outputs/ocr-font-quality-${current?'current':'baseline'}${only?'-'+only.replace(/[^a-z0-9-]/gi,'_'):''}.json`;fs.writeFileSync(filename,JSON.stringify(output,null,2));
    console.log(`${output.passed}/${output.total} exact font/quality cases passed; ${output.failed} failed. ${filename}`);
    if(output.failed)process.exitCode=1;
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
