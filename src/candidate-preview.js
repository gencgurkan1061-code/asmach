/* Context preview with an isolated, explicitly applied candidate correction draft. */
(function(root){
  'use strict';
  let dialog,view,previousFocus;
  let whole=false,editor=null,draft=null,readMeta=null,revision=0,busy=false;
  let selecting=false,selectionDrag=null,shownRegion=null;
  const el=id=>document.getElementById(id);
  function bounds(candidate,item,whole){
    if(whole)return{x:0,y:0,w:1,h:1};
    const b=candidate.box,padX=Math.max(.12,b.w*1.5),padY=Math.max(.12,b.h*1.5);
    const x=Math.max(0,Math.min(b.x,item.bubbleX)-padX),y=Math.max(0,Math.min(b.y,item.bubbleY)-padY);
    return{x,y,w:Math.min(1,Math.max(b.x+b.w,item.bubbleX)+padX)-x,h:Math.min(1,Math.max(b.y+b.h,item.bubbleY)+padY)-y};
  }
  function paint(canvas,candidate,item,placed,whole=false,others=[],contextRegion=null,hideSelection=false,nativeResolution=false){
    const page=candidate.pageImage,W=page.width,H=page.height,region=contextRegion||bounds(candidate,item,whole),width=region.w*W,height=region.h*H;
    const k=nativeResolution?1:Math.min(1400/width,720/height,3);canvas.width=Math.max(1,Math.round(width*k));canvas.height=Math.max(1,Math.round(height*k));
    const g=canvas.getContext('2d');g.drawImage(page,region.x*W,region.y*H,width,height,0,0,canvas.width,canvas.height);
    const x=v=>(v-region.x)*W*k,y=v=>(v-region.y)*H*k,b=candidate.box;
    for(const other of others){const ob=other.candidate.box,oi=other.item;if(other.candidate.page!==candidate.page)continue;
      const ps=ob.points?.length===4?ob.points:[{x:ob.x,y:ob.y},{x:ob.x+ob.w,y:ob.y},{x:ob.x+ob.w,y:ob.y+ob.h},{x:ob.x,y:ob.y+ob.h}];
      g.beginPath();ps.forEach((p,i)=>i?g.lineTo(x(p.x),y(p.y)):g.moveTo(x(p.x),y(p.y)));g.closePath();g.strokeStyle='#78929b';g.lineWidth=1;g.stroke();
      if(other.placed){const bx=x(oi.bubbleX),by=y(oi.bubbleY),r=Math.max(9,(oi.size||46)*k/2);g.beginPath();g.arc(bx,by,r,0,Math.PI*2);g.fillStyle='#f2f6f8';g.fill();g.stroke();g.fillStyle='#536b75';g.font=`${Math.max(10,(oi.fontSize||20)*k)}px Arial`;g.textAlign='center';g.textBaseline='middle';g.fillText(String(oi.number),bx,by);}
    }
    if(hideSelection)return region;
    const points=b.points?.length===4?b.points:[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}];
    const polygon=()=>{g.beginPath();points.forEach((p,i)=>i?g.lineTo(x(p.x),y(p.y)):g.moveTo(x(p.x),y(p.y)));g.closePath();};
    polygon();g.fillStyle='#00c5df40';g.fill();g.strokeStyle='#008c9f';g.lineWidth=Math.max(3,(item.boxLineWidth||1.5)*k);g.stroke();
    if(placed){
      const bx=x(item.bubbleX),by=y(item.bubbleY),r=(item.size||46)*k/2;
      g.lineWidth=Math.max(1,(item.leaderLineWidth||1.8)*k);
      if(item.arrowEnabled!==false){g.beginPath();g.moveTo(x(item.anchorX),y(item.anchorY));g.lineTo(bx,by);g.stroke();}
      g.beginPath();
      if(item.shape==='square')g.rect(bx-r,by-r,2*r,2*r);
      else if(item.shape==='hexagon'){for(let i=0;i<6;i++){const px=bx+r*Math.cos(i*Math.PI/3),py=by+r*Math.sin(i*Math.PI/3);i?g.lineTo(px,py):g.moveTo(px,py);}g.closePath();}
      else g.arc(bx,by,r,0,Math.PI*2);
g.fillStyle=nativeResolution?'#008c9f':'white';g.fill();g.lineWidth=Math.max(1,(item.balloonLineWidth||2)*k);g.stroke();g.fillStyle=nativeResolution?'white':item.color||'#008c9f';g.font=`bold ${Math.max(8,(item.fontSize||20)*k)}px Arial`;g.textAlign='center';g.textBaseline='middle';g.fillText(String(item.number),bx,by);
    }
    return region;
  }
  function open(data){
    if(!dialog){
      dialog=document.createElement('dialog');dialog.style.cssText='border:1px solid #bbd7df;border-radius:14px;padding:18px;width:min(1460px,96vw);max-height:94vh;box-shadow:0 20px 80px #001b4480';
      dialog.className='asmach-modal';
      dialog.innerHTML='<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><strong id="candidatePreviewTitle" style="flex:1"></strong><button type="button" class="btn" id="candidatePreviewNear">Ölçü ve çevresi</button><button type="button" class="btn" id="candidatePreviewPage">Tüm sayfa</button><button type="button" class="btn primary" id="candidatePreviewEdit">Kutuyu yeniden seç / düzelt</button><button type="button" class="btn" id="candidatePreviewClose">Listeye dön</button></div><div id="candidatePreviewImage" style="background:#e9f1f4;text-align:center;overflow:auto;max-height:74vh"><canvas id="candidatePreviewCanvas" style="max-width:100%;height:auto"></canvas></div><div id="candidatePreviewEditing" hidden style="overflow:auto;max-height:74vh"><div id="candidatePreviewEditor"></div><label style="display:grid;gap:5px;margin:10px 0;font-size:12px">Ölçü metni — yeniden tanıyın veya elle düzeltin<input id="candidatePreviewText" type="text" style="padding:9px;border:1px solid #b9d2dd;border-radius:7px"></label><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button type="button" class="btn" id="candidatePreviewDiscard">Düzeltmeden vazgeç</button><button type="button" class="btn" id="candidatePreviewRecognize">Yeniden tanı</button><button type="button" class="btn primary" id="candidatePreviewApply">Adayı güncelle</button></div></div><p id="candidatePreviewHint" role="status" style="font-size:12px;color:#506c79"></p>';
      document.body.append(dialog);
      const nav=document.createElement('span');nav.style.cssText='display:flex;align-items:center;gap:6px';nav.innerHTML='<button type="button" class="btn" id="candidatePreviewPrevious" aria-label="Önceki balon">← Önceki</button><span id="candidatePreviewPosition"></span><button type="button" class="btn" id="candidatePreviewNext" aria-label="Sonraki balon">Sonraki →</button>';(el('candidatePreviewNear').parentElement||dialog).append(nav);
      el('candidatePreviewPrevious').onclick=()=>navigate(-1);el('candidatePreviewNext').onclick=()=>navigate(1);
      el('candidatePreviewNear').onclick=()=>{whole=false;draw();};el('candidatePreviewPage').onclick=()=>{whole=true;draw();};el('candidatePreviewClose').onclick=()=>dialog.close();
      el('candidatePreviewEdit').onclick=startEdit;
      const canvas=el('candidatePreviewCanvas');canvas.style.touchAction='none';
      canvas.onpointerdown=event=>{
        if(!selecting||busy||event.button!==0)return;
        event.preventDefault();selectionDrag={start:pagePoint(event),end:pagePoint(event),pointerId:event.pointerId};canvas.setPointerCapture?.(event.pointerId);draw();
      };
      canvas.onpointermove=event=>{if(!selectionDrag||event.pointerId!==selectionDrag.pointerId)return;selectionDrag.end=pagePoint(event);draw();};
      canvas.onpointerup=event=>{
        if(!selectionDrag||event.pointerId!==selectionDrag.pointerId)return;
        const drag=selectionDrag;drag.end=pagePoint(event);selectionDrag=null;canvas.releasePointerCapture?.(event.pointerId);
        const box=selectionBox(drag.start,drag.end);
        if(box.w*view.candidate.pageImage.width<8||box.h*view.candidate.pageImage.height<8){el('candidatePreviewHint').textContent='Ölçü ve toleransları içine alan daha büyük bir kutu çizin.';draw();return;}
        return recognizeSelection(box);
      };
      canvas.onpointercancel=()=>{selectionDrag=null;draw();};
      el('candidatePreviewDiscard').onclick=()=>{stopEdit();draw();el('candidatePreviewHint').textContent='Düzeltme iptal edildi. Adayın önceki bilgileri korundu.';};
      el('candidatePreviewRecognize').onclick=recognize;
      el('candidatePreviewApply').onclick=()=>{
        if(busy||!draft)return;
        const text=el('candidatePreviewText').value.trim();
        try{view.onApply({...draft,text,confidence:readMeta?.text===text?readMeta.confidence:0,source:readMeta?.text===text?readMeta.source:'Önizlemede elle düzeltildi'});dialog.close();}
        catch(error){el('candidatePreviewHint').textContent=error.message;}
      };
      dialog.addEventListener('keydown',event=>{event.stopPropagation();if(['ArrowLeft','ArrowRight'].includes(event.key)&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)){event.preventDefault();const delta=event.key==='ArrowLeft'?-1:1;if(view?.onNavigate&&view.index+delta>=0&&view.index+delta<view.total)navigate(delta);}if(event.key==='Escape'&&selecting&&!busy){event.preventDefault();selecting=false;selectionDrag=null;canvas.style.cursor='';draw();el('candidatePreviewHint').textContent='Yeni seçim iptal edildi. Mevcut aday korundu.';}});
      dialog.addEventListener('close',()=>{stopEdit();dialog.classList.remove('open');view=null;previousFocus?.focus?.();});
    }
    stopEdit();previousFocus=document.activeElement;view=data;whole=false;
    el('candidatePreviewPosition').textContent=data.total?`${data.index+1} / ${data.total}`:'';
    el('candidatePreviewPrevious').disabled=!data.onNavigate||data.index<=0;el('candidatePreviewNext').disabled=!data.onNavigate||data.index>=data.total-1;
    document.getElementById('candidatePreviewTitle').textContent=`Sayfa ${data.candidate.page} · ${data.candidate.parsed.type} · ${data.candidate.text}`;
    document.getElementById('candidatePreviewHint').textContent=data.placed?'İşaretli kutu algılanan ölçüdür. Balon, mevcut seçim sırası ve yöntem stiliyle hesaplanan önizlemedir. Kaynak çizim değiştirilmez.':'Algılanan ölçü işaretlendi. Kutunun yanında balon için boşluk bulunamadı; daha küçük bir yöntem stili seçebilirsiniz.';
    el('candidatePreviewEdit').hidden=!data.onApply;
    if(data.onEdit)el('candidatePreviewEdit').textContent='Bu önizlemede yeniden seç';
    draw();dialog.classList.add('open');if(!dialog.open)dialog.showModal();
  }
  function selectionBox(start,end){return{x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)};}
  function pagePoint(event){
    const rect=el('candidatePreviewCanvas').getBoundingClientRect(),clamp=v=>Math.max(0,Math.min(1,v));
    return{x:shownRegion.x+clamp((event.clientX-rect.left)/rect.width)*shownRegion.w,y:shownRegion.y+clamp((event.clientY-rect.top)/rect.height)*shownRegion.h};
  }
  function draw(){if(view){
    const canvas=el('candidatePreviewCanvas');shownRegion=paint(canvas,view.candidate,view.item,view.placed,whole,view.others||[]);
    if(selectionDrag){const b=selectionBox(selectionDrag.start,selectionDrag.end),g=canvas.getContext('2d'),x=(b.x-shownRegion.x)/shownRegion.w*canvas.width,y=(b.y-shownRegion.y)/shownRegion.h*canvas.height,w=b.w/shownRegion.w*canvas.width,h=b.h/shownRegion.h*canvas.height;g.fillStyle='#00b9ca33';g.fillRect(x,y,w,h);g.strokeStyle='#008c9f';g.lineWidth=2;g.strokeRect(x,y,w,h);}
  }}
  function navigate(delta){if(!view||busy)return;if(selecting||draft){el('candidatePreviewHint').textContent='Önce düzeltmeyi uygulayın veya düzeltmeden vazgeçin.';return;}view.onNavigate?.(delta);}
  async function recognizeSelection(box){
    const session=view,token=++revision;busy=true;
    for(const id of ['candidatePreviewNear','candidatePreviewPage','candidatePreviewEdit'])el(id).disabled=true;
    el('candidatePreviewHint').textContent='Yeni kutudaki ölçü ve toleranslar okunuyor…';
    try{
      const opened=await session.onEdit({box,page:session.candidate.page,isCurrent:()=>view===session&&revision===token});
      if(view===session&&revision===token&&opened!==false)dialog.close();
    }catch(error){if(view===session&&revision===token)el('candidatePreviewHint').textContent='Seçim okunamadı: '+error.message+' Mevcut aday korundu; bu görüntüden yeniden seçebilirsiniz.';}
    finally{if(view===session&&revision===token){busy=false;for(const id of ['candidatePreviewNear','candidatePreviewPage','candidatePreviewEdit'])el(id).disabled=false;draw();}}
  }
  function stopEdit(){revision++;editor?.dispose();editor=null;draft=null;readMeta=null;busy=false;
    selecting=false;selectionDrag=null;
    if(!dialog)return;el('candidatePreviewCanvas').style.cursor='';el('candidatePreviewEditing').hidden=true;el('candidatePreviewImage').hidden=false;
    el('candidatePreviewEditor').style.pointerEvents='';el('candidatePreviewEditor').inert=false;el('candidatePreviewText').disabled=false;
    for(const id of ['candidatePreviewNear','candidatePreviewPage','candidatePreviewEdit','candidatePreviewRecognize','candidatePreviewApply'])el(id).disabled=false;
  }
  function startEdit(){
    if(!view||busy)return;
    if(view.onEdit){selecting=true;selectionDrag=null;el('candidatePreviewCanvas').style.cursor='crosshair';el('candidatePreviewHint').textContent='Pencereyi kapatmadan, bu çizim üzerinde ölçü ve toleransları sürükleyerek kutuya alın. Gerekirse Tüm sayfa görünümünü açın. Esc: seçimden vazgeç.';return;}
    const source=root.ASMachCandidateCorrection.prepare(view.candidate,bounds(view.candidate,view.item,whole));
    el('candidatePreviewImage').hidden=true;el('candidatePreviewEditing').hidden=false;
    for(const id of ['candidatePreviewNear','candidatePreviewPage','candidatePreviewEdit','candidatePreviewRecognize','candidatePreviewApply'])el(id).disabled=true;
    el('candidatePreviewText').value=view.candidate.text;
    el('candidatePreviewHint').textContent='Yeni kutu ile doğru ölçüyü çevreleyin; kenarlardan kırpın, üst tutamaçtan döndürün. Gerekirse önce Tüm sayfa görünümünü açın.';
    editor=root.ASMachSnapshots.mount(el('candidatePreviewEditor'),source.snapshot,(snapshot,selection)=>{
      draft={snapshot,box:root.ASMachCandidateCorrection.map(source.region,selection)};readMeta=null;
      el('candidatePreviewRecognize').disabled=false;el('candidatePreviewApply').disabled=false;
    },()=>{el('candidatePreviewHint').textContent='Görüntü açılamadı. Düzeltmeden vazgeçip yeniden deneyin.';},{detected:source.detected});
    const help=el('candidatePreviewEditor').querySelector('.snapshot-controls small');if(help)help.textContent='Yeni kutu çiz · İçinden taşı · Kenarlardan kırp · Üst tutamaçla döndür';
  }
  async function recognize(){
    if(!draft||busy||!view?.onRecognize)return;busy=true;const token=++revision,edit={...draft};
    el('candidatePreviewRecognize').disabled=true;el('candidatePreviewApply').disabled=true;
    el('candidatePreviewEditor').style.pointerEvents='none';el('candidatePreviewEditor').inert=true;el('candidatePreviewText').disabled=true;
    el('candidatePreviewHint').textContent='Seçilen bölge yeniden tanınıyor…';
    try{const result=await view.onRecognize(edit);if(token!==revision||!view)return;
      draft={...edit,snapshot:result.snapshot||edit.snapshot};readMeta=result;el('candidatePreviewText').value=result.text;
      el('candidatePreviewHint').textContent='Tanınan ölçüyü kontrol edin; gerekiyorsa metni düzeltip Adayı güncelle seçin.';
    }catch(error){if(token===revision)el('candidatePreviewHint').textContent='Tanıma tamamlanamadı: '+error.message+' Ölçü metnini elle girebilirsiniz.';}
    finally{if(token===revision){busy=false;el('candidatePreviewRecognize').disabled=false;el('candidatePreviewApply').disabled=false;el('candidatePreviewEditor').style.pointerEvents='';el('candidatePreviewEditor').inert=false;el('candidatePreviewText').disabled=false;}}
  }
  root.ASMachCandidatePreview={open,paint,bounds};
})(window);
