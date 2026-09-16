/* Experimental two-engine verification. Disabled unless explicitly requested.
 * Never splice digits from different engines into a fabricated measurement. */
(function(root){
 'use strict';
 let secondary=null,classifier=null;
 const clock=()=>root.performance?.now?.()||Date.now();
 function configure(options={}){secondary=options.secondary||null;classifier=options.classifier||null;}
 const normalized=s=>String(s||'').replace(/[−–]/g,'-').replace(/[⌀∅]/g,'Ø').replace(/,/g,'.');
 const assessment=text=>root.ASMachRequirements?.assessReading?.(text);
 function combine(primary,other){
  const original={...primary,alternatives:[...(primary.alternatives||[])]},a=assessment(primary.text),b=assessment(other?.text);
  if(!other||other.error||!other.text)return {...original,secondaryEvidence:{engine:other?.engine||'PaddleOCR',status:'unavailable',reason:other?.error||'İkinci motor metin döndürmedi.'}};
  const agreement=!!(a?.valid&&b?.valid&&a.signature===b.signature);
  const evidence={engine:other.engine||'PaddleOCR',text:other.text,score:other.score??null,scoreIsProbability:false,status:agreement?'agreement':b?.valid?'disagreement':'unverified'};
  if(agreement)return {...original,secondaryEvidence:evidence};
  const alternative={text:other.text,source:other.engine||'PaddleOCR',confidence:other.confidence,needsReview:true};
  if(!original.alternatives.some(x=>x.text===other.text))original.alternatives.push(alternative);
  // A whole valid second reading may rescue an unreadable first result, but
  // it always remains an explicit review choice, never automatic acceptance.
  if(!a?.valid&&b?.valid&&Number(other.score)>=.9)return {text:other.text,rawText:other.rawText||other.text,words:other.words||[],lines:other.lines||[],source:other.engine||'PaddleOCR',confidence:null,needsReview:true,reviewReason:'İlk okuma doğrulanamadı; ikinci motorun ölçü önerisini kaynakla kontrol edin.',secondaryEvidence:evidence,primaryEvidence:{...primary},alternatives:[{text:primary.text,confidence:primary.confidence,source:primary.source},...original.alternatives.filter(x=>x.text!==other.text)]};
  return {...original,secondaryEvidence:evidence,...(b?.valid?{needsReview:true,reviewReason:'İki OCR motoru ölçü alanlarında uyuşmuyor; kaynak görüntüden doğrulayın.'}:{})};
 }
 async function glyphEvidence(snapshot,result){
  if(!classifier||result.visualGdt)return [];
  // This model was trained on near-horizontal glyphs only. OCR boxes are
  // mapped to the original image, so rotated readings must not be scored.
  const symbols=(result.words||[]).filter(w=>{const angle=((Number(w.angle??result.angle)||0)%360+360)%360;return Math.min(angle,360-angle)<=4.5;}).flatMap(w=>w.symbols||[]).filter(s=>/^[0.,+\-−±ØOR]$/.test(s.text)).slice(0,16);
  if(!symbols.length)return [];
  let image=snapshot;
  if(typeof snapshot==='string'){image=new root.Image();image.src=snapshot;await image.decode();}
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  if(!width||!height)return [];
  const canvas=root.document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true}),out=[];
  const referenceHeight=Math.max(1,...symbols.filter(s=>/\d/.test(s.text)).map(s=>s.h*height));
  for(const symbol of symbols){
   const x=Math.max(0,Math.floor(symbol.x*width)),y=Math.max(0,Math.floor(symbol.y*height)),w=Math.min(width-x,Math.ceil(symbol.w*width)),h=Math.min(height-y,Math.ceil(symbol.h*height));
   if(w<1||h<1||w*h>200000)continue;
   canvas.width=w;canvas.height=h;context.fillStyle='white';context.fillRect(0,0,w,h);context.drawImage(image,x,y,w,h,0,0,w,h);
   const prediction=classifier.inferImage(canvas,{referenceHeight});
   out.push({observed:symbol.text,label:prediction.label,accepted:prediction.accepted,score:prediction.score,scoreIsProbability:false,reason:prediction.reason,conflict:!!prediction.accepted&&normalized(prediction.label)!==normalized(symbol.text)});
  }
  canvas.width=canvas.height=1;return out;
 }
 async function recognize(snapshot,options,primaryRead){
  const started=clock(),primary=await primaryRead(snapshot,options),primaryMs=clock()-started;
  const excluded=options.textMode||options.gdtCell||options.numericScope||primary.visualGdt||primary.measurementKind==='gdt';
  const hasSymbolCandidate=(primary.words||[]).some(w=>(w.symbols||[]).some(s=>/^[0.,+\-−±ØOR]$/.test(s.text)));
  if(excluded||(!options.forceVerification&&!primary.needsReview&&Number(primary.confidence)>=90&&!hasSymbolCandidate))return {...primary,verificationPerformance:{enabled:true,ran:false,primaryMs,totalMs:clock()-started}};
  let other=null,checks=[],result=primary;
  const extraStarted=clock();
  if(secondary){try{other=await secondary.recognize(snapshot,options);}catch(e){other={error:String(e.message||e),engine:'PaddleOCR'};}result=combine(primary,other);}
  try{checks=await glyphEvidence(snapshot,result);}catch(e){result={...result,glyphModelError:String(e.message||e)};}
  const conflicts=checks.filter(x=>x.conflict);
  return {...result,glyphEvidence:checks,...(conflicts.length?{needsReview:true,reviewReason:'Eğitilmiş karakter modeli bazı rakam/işaretlerde farklı sonuç buldu. Değerler otomatik değiştirilmedi; kaynakla doğrulayın.'}:{}),verificationPerformance:{enabled:true,ran:true,primaryMs,extraMs:clock()-extraStarted,totalMs:clock()-started}};
 }
 try{if(root.ASMachGlyphModel&&root.ASMachTechnicalGlyphModel)classifier=root.ASMachTechnicalGlyphModel.create(root.ASMachGlyphModel);}catch(error){root.console?.warn?.('Teknik sembol denetleyicisi yüklenemedi.',error);}
 root.ASMachOcrVerifier=Object.freeze({configure,recognize,_test:{combine,normalized}});
})(typeof window!=='undefined'?window:globalThis);
