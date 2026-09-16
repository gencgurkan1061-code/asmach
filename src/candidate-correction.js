/* Source-only crops and page-coordinate mapping for review drafts. */
(function(root){
  'use strict';
  // Keep the OCR evidence separate from the interpreted text. Inline automatic
  // application must not discard a review warning or the pre-repair reading.
  function readingEvidence(result){return{
    rawText:String(result.rawText??result.text??''),
    originalOcrText:String(result.originalOcrText||result.rawText||result.text||''),
    needsReview:!!result.needsReview,reviewReason:String(result.reviewReason||''),
    reviewConfirmed:!!result.reviewConfirmed,
    alternatives:Array.isArray(result.alternatives)?result.alternatives:[]
  };}
  function map(region,selection){
    const points=selection.points.map(p=>({x:region.x+p.x*region.w,y:region.y+p.y*region.h}));
    const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
    return{x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y,points,rotation:selection.angle};
  }
  function prepare(candidate,region){
    const page=candidate.pageImage,W=page.width,H=page.height;
    const x=Math.max(0,Math.floor(region.x*W)),y=Math.max(0,Math.floor(region.y*H));
    const w=Math.min(W-x,Math.ceil(region.w*W)),h=Math.min(H-y,Math.ceil(region.h*H));
    const source=document.createElement('canvas');source.width=w;source.height=h;source.getContext('2d').drawImage(page,x,y,w,h,0,0,w,h);
    const actual={x:x/W,y:y/H,w:w/W,h:h/H},b=candidate.box;
    const points=(b.points?.length===4?b.points:[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}]).map(p=>({x:p.x*W-x,y:p.y*H-y}));
    const a=points[0],next=points[1],last=points[3];
    return{region:actual,snapshot:source.toDataURL('image/png'),detected:{rect:{cx:points.reduce((s,p)=>s+p.x,0)/4,cy:points.reduce((s,p)=>s+p.y,0)/4,w:Math.hypot(next.x-a.x,next.y-a.y),h:Math.hypot(last.x-a.x,last.y-a.y),angle:Math.atan2(next.y-a.y,next.x-a.x)*180/Math.PI}}};
  }
  async function recognize(app,candidate,edit){
    if(edit.scope&&edit.scope!=='all'){
      const result=await root.ASMachOCR.recognize(edit.snapshot,{textMode:true,numericScope:edit.scope,gdtTolerance:edit.scope==='tolerance'&&(candidate.reviewed?.type||candidate.parsed?.type)==='GD&T',enhancement:edit.enhancement,skipGdt:true});
      if(result.error||!result.text?.trim())throw Error(result.error||'Seçilen alanda metin okunamadı.');
      return {...result,...readingEvidence(result),scope:edit.scope,snapshot:edit.snapshot,box:edit.box};
    }
    if(app.recognizeSnapshotAutomatically)return recognizeBox(app,candidate,edit);
    let snapshot=edit.snapshot;
    if(app.captureExact&&app.savedReviewSelection){
      const data=await app.captureExact(edit.box,candidate.page),image=await app.loadImage(data);
      const source=document.createElement('canvas');source.width=image.naturalWidth||image.width;source.height=image.naturalHeight||image.height;source.getContext('2d').drawImage(image,0,0);
      const selection=app.savedReviewSelection({selectionBox:edit.box},edit.box,source.width,source.height);
      snapshot=root.ASMachSnapshots._test.extract(source,selection.rect).toDataURL('image/png');
    }
    const result=await root.ASMachOCR.recognize(snapshot,{enhancement:edit.enhancement});
    if(result.error)throw new Error(result.error);
    return{...readingEvidence(result),snapshot,text:result.text||'',confidence:result.confidence||0,source:result.source||'Yerel OCR · yeniden seçilen bölge'};
  }
  // Use the same capture, layout, rotation, frame and diameter engines as Kutu OCR.
  // No modal state or candidate values are changed during recognition.
  async function recognizeBox(app,candidate,edit){
    if(candidate.parsed?.type==='Not'){
      const snapshot=await app.captureExact(edit.box,candidate.page),result=await app.recognizeSnapshotAutomatically(snapshot,{skipGdt:true,textMode:true,enhancement:edit.enhancement});
      if(!result.text)throw Error(result.error||'Not metni okunamadı.');
      return{...readingEvidence(result),box:edit.box,snapshot,text:result.text,confidence:result.confidence||0,source:result.source||'Not OCR'};
    }
    const box=edit.box,W=candidate.pageImage?.width||1000,H=candidate.pageImage?.height||1000;
    const mx=Math.max(box.w*.25,12/W),my=Math.max(box.h*.25,12/H),x=Math.max(0,box.x-mx),y=Math.max(0,box.y-my);
    const region={x,y,w:Math.min(1,box.x+box.w+mx)-x,h:Math.min(1,box.y+box.h+my)-y};
    const source=await app.captureExact(region,candidate.page);
    const initial={x:(box.x-region.x)/region.w,y:(box.y-region.y)/region.h,w:box.w/region.w,h:box.h/region.h};
    let words=[],size={width:W,height:H};
    if(app.state.pdfDoc){
      try{const page=await app.state.pdfDoc.getPage(candidate.page),viewport=page.getViewport({scale:1.5}),content=await page.getTextContent();words=content.items.map(item=>app.mapPdfTextBox(item,viewport)).filter(Boolean);size={width:viewport.width,height:viewport.height};}catch{/* Image OCR remains available when the PDF text layer fails. */}
    }else if(candidate.page===app.state.currentPage)words=app.state.textBoxes||[];
    const inside=w=>w.x+w.w/2>=box.x&&w.x+w.w/2<=box.x+box.w&&w.y+w.h/2>=box.y&&w.y+w.h/2<=box.y+box.h;
    const hint=words.filter(w=>inside(w)&&/\d/.test(w.text)).sort((a,b)=>b.text.length-a.text.length)[0];
    const angleHint=Number.isFinite(hint?.angle)?hint.angle*180/Math.PI:undefined;
    let detected=null,snapshot=edit.snapshot,resultBox=box;
    if(!box.angleLocked&&root.ASMachAutoSelection){try{detected=await root.ASMachAutoSelection.inspect(source,initial,{angleHint});}catch{}}
    if(detected)snapshot=detected.snapshot;
    else{
      const raw=await app.captureExact(box,candidate.page),image=await app.loadImage(raw),canvas=document.createElement('canvas');canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;canvas.getContext('2d').drawImage(image,0,0);
      const selection=app.savedReviewSelection({selectionBox:box},box,canvas.width,canvas.height);snapshot=root.ASMachSnapshots._test.extract(canvas,selection.rect).toDataURL('image/png');
    }
    const pdfText=edit.enhancement&&edit.enhancement!=='auto'?'':app.recognizeTextBoxes(box,words,size),readings=pdfText?[{text:pdfText,confidence:100,source:'PDF metin katmanı'}]:[];
    let failure='';
    if(detected?.frame||!app.isReliableTechnicalText(pdfText)||app.parseRequirement(pdfText).type==='Uzunluk'){
      const result=await app.recognizeSnapshotAutomatically(snapshot,{enhancement:edit.enhancement});
      if(result.text)readings.push(result);else failure=result.error||'Seçilen kutuda ölçü okunamadı.';
      if(!box.angleLocked&&!detected?.frame&&!Number.isFinite(angleHint)&&Number.isFinite(result.angle)&&result.confidence>=65&&root.ASMachAutoSelection){
        try{detected=await root.ASMachAutoSelection.inspect(source,initial,{angleHint:(detected?.rect.angle||0)-result.angle});snapshot=detected.snapshot;}catch{}
      }
    }
    const best=readings.filter(r=>r.text).sort((a,b)=>Number(Boolean(b.visualGdt))-Number(Boolean(a.visualGdt))||app.ocrCandidateScore(b)-app.ocrCandidateScore(a))[0];
    if(!best)throw Error(failure||'Ölçü okunamadı. Metni elle girin veya yeniden seçin.');
    if(best.needsReview&&!edit.autoApply&&root.ASMachOcrEnhancement){const choice=await root.ASMachOcrEnhancement.review(best);if(!choice)throw Error('OCR sonucu uygulanmadı; mevcut bilgiler korundu.');Object.assign(best,choice);}
    let text=app.recoverDiameterPrefix(best.text,readings),label=best.source||'Kutu OCR';const parsed=app.parseRequirement(text);
    if(parsed.type==='Uzunluk'&&parsed.nominalValue&&root.ASMachDiameterVision){
      try{if((await root.ASMachDiameterVision.inspect(snapshot,parsed.nominalValue)).diameter){text='Ø'+text;label+=' · Çap simgesi görüntüden doğrulandı';}}catch{}
    }
    if(detected){const points=root.ASMachSnapshots._test.corners(detected.rect).map(p=>({x:p.x/detected.sourceWidth,y:p.y/detected.sourceHeight}));resultBox=map(region,{points,angle:detected.rect.angle});}
    const sourceTextHeight=Number.isFinite(detected?.textHeight)?detected.textHeight*region.w*W/detected.sourceWidth:null;
    return{...readingEvidence(best),box:resultBox,sourceTextHeight,snapshot,text,confidence:best.confidence||0,source:label};
  }
  root.ASMachCandidateCorrection={map,prepare,recognize};
})(window);
