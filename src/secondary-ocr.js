/* Experimental offline PaddleOCR adapter. Loading this file does not initialize
 * an engine. The release/performance gate decides whether callers may use it.
 * Protocol pinned to official @paddleocr/paddleocr-js 0.4.2 worker transport. */
(function(root){
  'use strict';
  const SDK='0.4.2',MODEL='PP-OCRv5_mobile',MAX_PIXELS=4194304,MAX_SIDE=4096;
  let config={baseUrl:null},worker=null,initialization=null,summary=null,sequence=0,queue=Promise.resolve();
  const pending=new Map();
  const now=()=>root.performance?root.performance.now():Date.now();
  const abortError=()=>Object.assign(new Error('İkinci OCR okuması iptal edildi.'),{name:'AbortError'});
  function baseUrl(value){
    const url=new URL(value||config.baseUrl||'./ocr/experimental-paddle/',root.document?.baseURI||root.location.href);
    if(!['http:','https:','tauri:','asset:'].includes(url.protocol)||url.origin!==root.location.origin)throw new Error('İkinci OCR yalnızca uygulama içindeki yerel varlıkları kullanabilir.');
    if(!url.pathname.endsWith('/'))url.pathname+='/';
    return url.href;
  }
  function terminate(error=new Error('İkinci OCR kapatıldı.')){
    if(worker)worker.terminate();worker=null;initialization=null;summary=null;
    for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(error);}pending.clear();
  }
  function configure(options={}){
    if(options.baseUrl){const next=baseUrl(options.baseUrl);if(next!==config.baseUrl){terminate();config.baseUrl=next;}}
    return {engine:'paddleocr',sdk:SDK,model:MODEL,baseUrl:config.baseUrl,initialized:!!summary};
  }
  function request(type,payload,transferables=[],timeout=120000){
    if(!worker)return Promise.reject(new Error('İkinci OCR başlatılmadı.'));
    const requestId=++sequence;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>terminate(new Error(`İkinci OCR süre sınırını aştı (${type}).`)),timeout);
      pending.set(requestId,{resolve,reject,timer});
      try{worker.postMessage({kind:'worker-transport-request',type,payload,requestId},transferables);}
      catch(error){clearTimeout(timer);pending.delete(requestId);reject(error);}
    });
  }
  async function initialize(options={}){
    if(options.baseUrl)configure(options);
    if(summary)return summary;
    if(initialization)return initialization;
    const base=baseUrl(),local=relative=>new URL(relative,base).href;
    initialization=(async()=>{
      worker=new root.Worker(local('sdk/dist/assets/worker-entry-C9UNuyOJ.js'),{type:'module',name:'ASMach-PaddleOCR'});
      worker.onmessage=event=>{
        const message=event.data;if(message?.kind!=='worker-transport-response')return;
        const entry=pending.get(message.requestId);if(!entry)return;
        pending.delete(message.requestId);clearTimeout(entry.timer);
        if(message.status==='success')entry.resolve(message.payload);
        else entry.reject(Object.assign(new Error(message.error?.message||'İkinci OCR başarısız.'),{name:message.error?.name||'Error'}));
      };
      worker.onerror=event=>terminate(new Error(event.message||'İkinci OCR çalışanı başlatılamadı.'));
      const start=now();
      const result=await request('init',{options:{
        pipelineConfig:{pipelineName:'OCR',raw:{},warnings:[],unsupportedFeatures:[],
          modelSelection:{textDetectionModelName:MODEL+'_det',textRecognitionModelName:MODEL+'_rec'},
          assets:{det:{url:local('models/'+MODEL+'_det.tar')},rec:{url:local('models/'+MODEL+'_rec.tar')}},
          runtimeDefaults:{text_det_limit_side_len:960,text_det_limit_type:'max',text_det_max_side_limit:1024,text_det_thresh:0.3,text_det_box_thresh:0.45,text_det_unclip_ratio:1.5,text_rec_score_thresh:0},
          pipelineBatchSize:1,textDetectionBatchSize:1,textRecognitionBatchSize:1},
        ortOptions:{backend:'wasm',wasmPaths:local('runtime/'),numThreads:1,simd:true,proxy:false,disableWasmProxy:true}
      }});
      summary={engine:'paddleocr',sdk:SDK,model:MODEL,elapsedMs:now()-start,runtime:result.summary};
      return summary;
    })().catch(error=>{terminate(error);throw error;});
    return initialization;
  }
  async function imageBitmap(input){
    if(typeof input==='string'){
      if(!/^data:image\/(png|jpeg|webp);base64,/i.test(input)||input.length>24*1024*1024)throw new Error('İkinci OCR için yerel ölçü görüntüsü gerekli.');
      const response=await root.fetch(input);input=await response.blob();
    }
    const bitmap=await root.createImageBitmap(input);
    if(!bitmap.width||!bitmap.height||bitmap.width>MAX_SIDE||bitmap.height>MAX_SIDE||bitmap.width*bitmap.height>MAX_PIXELS){bitmap.close();throw new Error('İkinci OCR yalnızca seçili ölçü kesitinde çalışır (en fazla 4 megapiksel).');}
    return bitmap;
  }
  function normalizeResult(result,elapsedMs,coldStartMs){
    const width=Number(result?.image?.width)||1,height=Number(result?.image?.height)||1;
    const lines=(result?.items||[]).map(item=>{
      const points=(item.poly||[]).map(point=>Array.isArray(point)?{x:Number(point[0]),y:Number(point[1])}:{x:Number(point.x),y:Number(point.y)}).filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y));
      if(!points.length)return null;
      const clamp=(value,maximum)=>Math.max(0,Math.min(maximum,value));
      const x0=clamp(Math.min(...points.map(point=>point.x)),width),x1=clamp(Math.max(...points.map(point=>point.x)),width);
      const y0=clamp(Math.min(...points.map(point=>point.y)),height),y1=clamp(Math.max(...points.map(point=>point.y)),height);
      const score=typeof item.score==='number'&&Number.isFinite(item.score)&&item.score>=0&&item.score<=1?item.score:null;
      return {text:String(item.text||''),x:x0/width,y:y0/height,w:Math.max(0,x1-x0)/width,h:Math.max(0,y1-y0)/height,
        bbox:{x0,y0,x1,y1},poly:points,score,scoreSource:'paddle-line-recognition',granularity:'line'};
    }).filter(Boolean);
    const scored=lines.filter(line=>line.score!==null),count=scored.reduce((sum,line)=>sum+Math.max(1,line.text.length),0);
    const score=count?scored.reduce((sum,line)=>sum+line.score*Math.max(1,line.text.length),0)/count:null;
    const text=lines.map(line=>line.text).join('\n');
    return {text,rawText:text,engine:'paddleocr',model:MODEL,sdk:SDK,score,scoreSource:'character-weighted-line-score',
      scoreIsCalibratedProbability:false,words:lines,lines,image:{width,height},runtime:result?.runtime,
      metrics:{...result?.metrics,elapsedMs,coldStartMs}};
  }
  function recognize(input,options={}){
    const execute=async()=>{
      if(options.signal?.aborted)throw abortError();
      const start=now(),wasCold=!summary;
      await initialize(options);
      const coldStartMs=wasCold?now()-start:0;
      if(options.signal?.aborted)throw abortError();
      const bitmap=await imageBitmap(input);
      if(options.signal?.aborted){bitmap.close();throw abortError();}
      const onAbort=()=>terminate(abortError());options.signal?.addEventListener('abort',onAbort,{once:true});
      try{
        const results=await request('predict',{sources:[{kind:'imageBitmap',imageBitmap:bitmap}],params:{}},[bitmap]);
        if(options.signal?.aborted)throw abortError();
        return normalizeResult(results[0],now()-start,coldStartMs);
      }finally{options.signal?.removeEventListener('abort',onAbort);}
    };
    const result=queue.then(execute,execute);queue=result.catch(()=>{});return result;
  }
  root.ASMachSecondaryOCR={configure,initialize,recognize,dispose:terminate,status:()=>({engine:'paddleocr',model:MODEL,sdk:SDK,initialized:!!summary,pending:pending.size}),normalizeResult};
})(typeof window!=='undefined'?window:globalThis);
