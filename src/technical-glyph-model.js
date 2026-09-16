(function(root){
  'use strict';
  // Pure, offline experimental glyph inference. Loading this module does not
  // load a model, start training, fetch files, or modify production OCR text.
  const SIDE=24,INPUTS=582;
  function extractPixels(image,options={}){
    const width=Number(image?.width),height=Number(image?.height),data=image?.data;
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>1048576||!data||data.length!==width*height*4)throw new Error('Expected a bounded RGBA glyph crop.');
    const ink=new Float32Array(width*height);let left=width,top=height,right=-1,bottom=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x,j=i*4,alpha=data[j+3]/255;
      // The Python renderer emits grayscale; average preserves it exactly.
      // Match NumPy's float32 divide/subtract before thresholding. In particular
      // gray=204 must not fall on opposite sides of the 0.2 threshold in JS.
      const value=Math.fround(Math.fround(1-Math.fround((data[j]+data[j+1]+data[j+2])/765))*alpha);ink[i]=value;
      if(value>=Math.fround(0.2)){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    const vector=new Float32Array(INPUTS);
    if(right<left)return {vector,empty:true,bounds:null};
    const w=right-left+1,h=bottom-top+1,factor=22/Math.max(w,h),ow=Math.max(1,Math.round(w*factor)),oh=Math.max(1,Math.round(h*factor));
    const ox=Math.floor((SIDE-ow)/2),oy=Math.floor((SIDE-oh)/2);
    for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){
      const sx=Math.min(w-1,Math.floor((x+0.5)*w/ow)),sy=Math.min(h-1,Math.floor((y+0.5)*h/oh));
      vector[(y+oy)*SIDE+x+ox]=ink[(sy+top)*width+sx+left];
    }
    let total=0,pixels=0;
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const value=ink[y*width+x];total+=value;if(value>=Math.fround(0.2))pixels++;}
    const reference=Number(options.referenceHeight),hasReference=Number.isFinite(reference)&&reference>0;
    vector[576]=Math.max(-1,Math.min(1,Math.log2(w/h)/3));vector[577]=total/(w*h);vector[578]=pixels/(w*h);
    vector[579]=hasReference?Math.min(2,h/reference)/2:0;vector[580]=hasReference?Math.min(2,w/reference)/2:0;vector[581]=hasReference?1:0;
    return {vector,empty:false,bounds:{x:left,y:top,width:w,height:h},inkFraction:pixels/(w*h),hasReference};
  }
  function create(model){
    if(model?.schemaVersion!==1||model.input?.features!==INPUTS||model.input?.side!==SIDE||model.architecture?.kind!=='mlp-relu-softmax')throw new Error('Unsupported technical glyph model.');
    const labels=model.labels,hidden=Number(model.architecture.hidden),weights=model.weights,threshold=model.thresholds;
    if(!Array.isArray(labels)||labels.length<2||labels.length>64||!labels.includes('<reject>')||!Number.isInteger(hidden)||hidden<1||hidden>256)throw new Error('Invalid glyph model dimensions.');
    if(!threshold||![threshold.scoreMin,threshold.marginMin].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw new Error('Invalid glyph model thresholds.');
    const array=(name,length)=>{const value=weights?.[name];if(!Array.isArray(value)||value.length!==length||!value.every(Number.isFinite))throw new Error('Invalid glyph model weights: '+name);return Float32Array.from(value);};
    const w1=array('w1',INPUTS*hidden),b1=array('b1',hidden),w2=array('w2',hidden*labels.length),b2=array('b2',labels.length);
    function inferFeatures(features){
      if(!features||features.length!==INPUTS||!Array.from(features).every(Number.isFinite))throw new Error('Invalid glyph feature vector.');
      const layer=Float64Array.from(b1);
      for(let i=0;i<INPUTS;i++){const value=features[i];if(!value)continue;const offset=i*hidden;for(let j=0;j<hidden;j++)layer[j]+=value*w1[offset+j];}
      const logits=Float64Array.from(b2);
      for(let i=0;i<hidden;i++){const value=Math.max(0,layer[i]);if(!value)continue;for(let j=0;j<labels.length;j++)logits[j]+=value*w2[i*labels.length+j];}
      const max=Math.max(...logits),exp=Array.from(logits,v=>Math.exp(v-max)),sum=exp.reduce((a,b)=>a+b,0);
      const candidates=labels.map((label,i)=>({label,score:exp[i]/sum})).sort((a,b)=>b.score-a.score),winner=candidates[0],margin=winner.score-candidates[1].score;
      const accepted=winner.label!=='<reject>'&&winner.score>=threshold.scoreMin&&margin>=threshold.marginMin;
      return {modelId:model.modelId,label:winner.label,accepted,score:winner.score,margin,candidates:candidates.slice(0,3),
        scoreMeaning:'uncalibrated-softmax-not-correctness-probability',reason:accepted?'calibration-threshold-met':winner.label==='<reject>'?'unknown-glyph':'ambiguous-glyph',advisoryOnly:true};
    }
    function inferPixels(image,options={}){
      const extracted=extractPixels(image,options);
      if(extracted.empty)return {modelId:model.modelId,label:'<reject>',accepted:false,score:0,margin:0,candidates:[],reason:'empty-crop',advisoryOnly:true};
      return {...inferFeatures(extracted.vector),features:{bounds:extracted.bounds,inkFraction:extracted.inkFraction,hasReference:extracted.hasReference}};
    }
    function inferImage(canvas,options={}){
      if(!canvas||typeof canvas.getContext!=='function')throw new Error('Expected a glyph canvas.');
      const context=canvas.getContext('2d',{willReadFrequently:true});
      if(!context)throw new Error('Glyph canvas unavailable.');
      return inferPixels(context.getImageData(0,0,canvas.width,canvas.height),options);
    }
    return Object.freeze({modelId:model.modelId,inferImage,inferPixels,inferFeatures,thresholds:Object.freeze({...threshold}),labels:Object.freeze([...labels])});
  }
  const api=Object.freeze({create,extractPixels});
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ASMachTechnicalGlyphModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
