/* Non-destructive raster OCR passes. Never erase lines or synthesize missing glyphs. */
(function(root){
 'use strict';const modes={off:'Kapalı',auto:'Otomatik',mild:'Hafif',strong:'Güçlü'};let selectedMode='auto',explicitMode=false;
 function mode(options={}){if(Object.hasOwn(modes,options.enhancement))return options.enhancement;return root.ASMachApp?.state.pdfDoc&&!explicitMode?'off':selectedMode;}
 function setMode(value){if(Object.hasOwn(modes,value)){selectedMode=value;explicitMode=true;const select=document.querySelector('#ocrEnhancementControls select');if(select)select.value=value;}}
 function decorateTarget(button,key,label){const url=root.ASMachOcrIcons?.[key];if(!url)return;const icon=document.createElement('img'),text=document.createElement('span');icon.src=url;icon.alt='';icon.width=24;icon.height=24;icon.style.cssText='width:24px!important;height:24px!important;max-width:none!important;max-height:none!important;object-fit:contain';text.textContent=label;text.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';button.replaceChildren(icon,text);button.title=label;button.setAttribute('aria-label',label);button.style.cssText+=';display:inline-flex;align-items:center;justify-content:center;position:relative;padding:2px;width:30px;height:30px';}
 function process(source,strength='mild'){
  const out=document.createElement('canvas');out.width=source.width;out.height=source.height;const ctx=out.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
  if(strength==='off')return out;
  const w=out.width,h=out.height,data=ctx.getImageData(0,0,w,h),gray=new Uint8Array(w*h),hist=new Uint32Array(256);
  for(let i=0;i<gray.length;i++){const j=i*4,alpha=data.data[j+3]/255;gray[i]=Math.round((.299*data.data[j]+.587*data.data[j+1]+.114*data.data[j+2])*alpha+255*(1-alpha));hist[gray[i]]++;}
  const percentile=q=>{let n=0;for(let v=0;v<256;v++){n+=hist[v];if(n>=gray.length*q)return v;}return 255;};const low=percentile(.005),high=percentile(.995),span=Math.max(25,high-low);
  if(high-low>=25)for(let i=0;i<gray.length;i++)gray[i]=Math.max(0,Math.min(255,(gray[i]-low)*255/span));
  let sum;if(strength==='strong'){sum=new Float64Array((w+1)*(h+1));for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=gray[y*w+x];sum[(y+1)*(w+1)+x+1]=sum[y*(w+1)+x+1]+row;}}}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,j=i*4;let v=gray[i];if(sum){const r=15,l=Math.max(0,x-r),t=Math.max(0,y-r),right=Math.min(w,x+r+1),bottom=Math.min(h,y+r+1),mean=(sum[bottom*(w+1)+right]-sum[t*(w+1)+right]-sum[bottom*(w+1)+l]+sum[t*(w+1)+l])/((right-l)*(bottom-t));v=v<mean-9?0:255;}data.data[j]=data.data[j+1]=data.data[j+2]=v;data.data[j+3]=255;}
  ctx.putImageData(data,0,0);return out;
 }
 function regions(canvas){
  const w=canvas.width,h=canvas.height;if(w*h>2000000)return [];const pixels=canvas.getContext('2d').getImageData(0,0,w,h).data,columns=new Uint32Array(w);let top=h,bottom=0;
  for(let y=0;y<h;y++){let count=0;for(let x=0;x<w;x++)if(pixels[(y*w+x)*4]<170)count++;if(count>w*.65)continue;for(let x=0;x<w;x++)if(pixels[(y*w+x)*4]<170){columns[x]++;top=Math.min(top,y);bottom=Math.max(bottom,y);}}
  const occupied=Array.from(columns,(n,x)=>n>1?x:-1).filter(x=>x>=0);if(!occupied.length||bottom-top<8)return [];const left=occupied[0],right=occupied.at(-1);let best=null;
  for(let x=left+1;x<right;){if(columns[x]>1){x++;continue;}const start=x;while(x<right&&columns[x]<=1)x++;const gap=x-start;
   if(gap>=Math.max(4,(bottom-top)*.1)&&start-left>=4&&right-x>=4&&(!best||gap>best.gap))best={start,end:x,gap};}
  if(!best)return [];const cut=(best.start+best.end)/2,pad=4,y=Math.max(0,top-pad),height=Math.min(h,bottom+pad+1)-y;
  return [{x:Math.max(0,left-pad),y,w:Math.floor(cut)-Math.max(0,left-pad),h:height},{x:Math.floor(cut),y,w:Math.min(w,right+pad+1)-Math.floor(cut),h:height}];
 }
 // Partition connected ink into separate reading rows without altering source pixels.
 // Thin detached drawing rules are excluded from crop bounds, never erased in-place.
 function measurementInkRows(canvas,threshold=180){
  const w=canvas.width,h=canvas.height;if(w*h>2000000)return [];
  const pixels=canvas.getContext('2d').getImageData(0,0,w,h).data,seen=new Uint8Array(w*h),parts=[];
  const cutoff=Math.max(1,Math.min(250,Number(threshold)||180));
  const dark=i=>pixels[i*4+3]>128&&pixels[i*4]<cutoff;
  for(let i=0;i<w*h;i++){
   if(seen[i]||!dark(i))continue;const todo=[i];seen[i]=1;let x0=w,x1=0,y0=h,y1=0;
   for(let n=0;n<todo.length;n++){const j=todo[n],x=j%w,y=Math.floor(j/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,k=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!seen[k]&&dark(k)){seen[k]=1;todo.push(k);}}
   }if(todo.length>=3)parts.push({x:x0,y:y0,w:x1-x0+1,h:y1-y0+1,area:todo.length});
  }
  const letters=parts.filter(p=>p.h>=6&&p.w/p.h<8),textHeight=Math.max(0,...letters.map(p=>p.h));if(!textHeight)return [];
  const ink=parts.filter(p=>!(p.w>textHeight*5&&p.h<textHeight*.18)&&!(p.h>textHeight*5&&p.w<textHeight*.18));
  const rows=[];for(const p of ink.sort((a,b)=>b.h-a.h||a.x-b.x)){
   const row=rows.find(r=>Math.min(r.y+r.h,p.y+p.h)-Math.max(r.y,p.y)>Math.min(r.h,p.h)*.25&&Math.abs(r.y+r.h/2-p.y-p.h/2)<Math.max(r.h,p.h)*.65);
   if(row){const right=Math.max(row.x+row.w,p.x+p.w),bottom=Math.max(row.y+row.h,p.y+p.h);row.x=Math.min(row.x,p.x);row.y=Math.min(row.y,p.y);row.w=right-row.x;row.h=bottom-row.y;row.parts.push(p);}else rows.push({...p,parts:[p]});
  }
  return rows.sort((a,b)=>a.y-b.y);
 }
 function measurementRegions(canvas){
  const rows=measurementInkRows(canvas),textHeight=Math.max(0,...rows.map(r=>r.h));
  if(rows.length<2||rows.length>4||rows.some(r=>r.h<textHeight*.3))return [];
  return rows.sort((a,b)=>a.y-b.y).map(({x,y,w,h,parts})=>{const ordered=parts.slice().sort((a,b)=>a.x-b.x),first=ordered[0],next=ordered[1],minus=next&&first.w>=first.h*2.2&&first.w<h*.9&&first.h<h*.3&&first.y+first.h/2>y+h*.3&&first.y+first.h/2<y+h*.8&&next.x-first.x-first.w<h*.8;return {x,y,w,h,...(minus?{leadingSign:'-',signEnd:first.x+first.w}: {})};});
 }
 // A reading-only copy reduces repeated tracking without squeezing the glyphs.
 // Large gaps remain distinct word boundaries, and coordinates map back to the
 // unmodified image. Never apply this to stacked dimensions, frames or prose.
 function spacingVariant(canvas){
  const rows=measurementInkRows(canvas);if(rows.length!==1)return null;const row=rows[0];
  if(row.h<12||row.w<row.h*2||row.parts.filter(p=>p.h>=row.h*.45).length<4)return null;
  const pixels=canvas.getContext('2d').getImageData(row.x,row.y,row.w,row.h).data,occupied=new Uint8Array(row.w);
  for(let x=0;x<row.w;x++)for(let y=0;y<row.h;y++)if(pixels[(y*row.w+x)*4]<180){occupied[x]=1;break;}
  const strips=[];for(let x=0;x<row.w;){if(!occupied[x]){x++;continue;}const start=x;while(x<row.w&&occupied[x])x++;strips.push({start,end:x});}
  if(strips.length<4||strips.length>40)return null;
  const gaps=strips.slice(1).map((s,i)=>s.start-strips[i].end),ordered=gaps.slice().sort((a,b)=>a-b),median=ordered[Math.floor(ordered.length/2)];
  if(median<row.h*.24||gaps.filter(g=>g>=row.h*.12&&g<=median*1.65).length<3)return null;
  const pad=24,target=Math.max(3,Math.round(row.h*.22)),mapping=[];let width=pad;
  for(const [i,strip]of strips.entries()){
   if(i){const gap=gaps[i-1];width+=gap>Math.max(median*1.8,row.h*.7)?gap:Math.min(gap,target);}
   mapping.push({output:width,source:row.x+strip.start,width:strip.end-strip.start});width+=strip.end-strip.start;
  }
  if(width+pad>=row.w+pad*2-6)return null;
  const out=document.createElement('canvas');out.width=width+pad;out.height=row.h+pad*2;const ctx=out.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,out.width,out.height);
  for(const m of mapping)ctx.drawImage(canvas,m.source,row.y,m.width,row.h,m.output,pad,m.width,row.h);
  const mapX=x=>{if(x<=mapping[0].output)return mapping[0].source+x-mapping[0].output;for(let i=0;i<mapping.length;i++){const m=mapping[i];if(x<=m.output+m.width)return m.source+x-m.output;const next=mapping[i+1];if(next&&x<next.output)return m.source+m.width+(x-m.output-m.width)*(next.source-m.source-m.width)/(next.output-m.output-m.width);}const last=mapping.at(-1);return last.source+x-last.output;};
  return {canvas:out,mapX,mapY:y=>row.y+y-pad,row,mapping};
 }
 // A plus with a separate, aligned lower bar is a visual ±, not a plain +.
 // This evidence is only used for overlapping OCR sign tokens; no numbers are
 // changed and no sign is inferred from tolerances or a selected measure type.
 function toleranceSigns(canvas){
  const rows=measurementInkRows(canvas),out=[];
  for(const row of rows){const parts=row.parts;for(const plus of parts){
   if(plus.h<8||plus.w/plus.h<.65||plus.w/plus.h>1.8)continue;
   const minus=parts.find(p=>p!==plus&&p.w/p.h>=3.2&&p.w>=plus.w*.7&&p.w<=plus.w*1.35&&p.y>=plus.y+plus.h&&p.y-plus.y-plus.h<=plus.h*.5&&Math.abs(p.x+p.w/2-plus.x-plus.w/2)<=plus.w*.3);
   const data=canvas.getContext('2d').getImageData(plus.x,plus.y,plus.w,plus.h).data,isDark=(x,y)=>data[(y*plus.w+x)*4]<180;
   const stemCoverage=height=>{let best=0;for(const slope of [-.35,-.2,0,.2,.35])for(let start=Math.floor(plus.w*.25);start<plus.w*.75;start++){let n=0;for(let y=0;y<height;y++){const x=Math.round(start+slope*(height-1-y));if(x>=0&&x<plus.w&&isDark(x,y))n++;}best=Math.max(best,n);}return best;};
   if(!minus){
    // Some serif fonts join the stem to the lower bar; blur can also close the
    // small gap. Require two broad bars AND a centred stem above the first.
    const bands=[];for(let y=0;y<plus.h;y++){let n=0;for(let x=0;x<plus.w;x++)if(isDark(x,y))n++;if(n<plus.w*.75)continue;const last=bands.at(-1);if(last&&y===last.end+1)last.end=y;else bands.push({start:y,end:y});}
    if(bands.length!==2)continue;const [upper,lower]=bands,cy=(upper.start+upper.end)/2;
    if(cy<plus.h*.2||cy>plus.h*.65||lower.start<plus.h*.75||upper.end>=lower.start-plus.h*.12||upper.start<2)continue;
    const stem=stemCoverage(upper.start);
    if(stem<upper.start*.85)continue;out.push({text:'±',x:plus.x,y:plus.y,w:plus.w,h:plus.h});continue;
   }
   let vertical=stemCoverage(plus.h),horizontal=0;
   for(let y=Math.floor(plus.h*.2);y<plus.h*.8;y++){let n=0;for(let x=0;x<plus.w;x++)if(isDark(x,y))n++;horizontal=Math.max(horizontal,n);}
   if(vertical/plus.h<.82||horizontal/plus.w<.82)continue;
   out.push({text:'±',x:Math.min(plus.x,minus.x),y:plus.y,w:Math.max(plus.x+plus.w,minus.x+minus.w)-Math.min(plus.x,minus.x),h:minus.y+minus.h-plus.y});
  }}return out;
 }
 function semanticReadings(candidates,best){
  const assess=root.ASMachRequirements?.assessReading;if(!best?.text)return[];
  const floor=Math.max(55,(Number(best.confidence)||0)-18);
  const meaning=text=>{const assessed=assess?.(text);if(assessed?.valid)return assessed;const normalized=String(text||'').replace(/,/g,'.').replace(/\s+/g,'').replace(/(?:\d+(?:\.\d+)?|\.\d+)/g,value=>String(Number(value)));return{valid:!!normalized,signature:'text:'+normalized};};
  return candidates.filter(c=>c?.text&&Number(c.confidence)>=floor).map(c=>({candidate:c,meaning:meaning(c.text)})).filter(x=>x.meaning.valid);
 }
 function bestSignature(best,readings){return readings.find(x=>x.candidate===best)?.meaning.signature||readings.find(x=>String(x.candidate.text)===String(best?.text))?.meaning.signature||'';}
 function agrees(candidates,best){const readings=semanticReadings(candidates,best),signature=bestSignature(best,readings);if(!signature||readings.length<2)return false;const votes=new Map();for(const {meaning:next}of readings)votes.set(next.signature,(votes.get(next.signature)||0)+1);const own=votes.get(signature)||0,other=Math.max(0,...[...votes].filter(([key])=>key!==signature).map(([,count])=>count));return own>=2&&own>other;}
 function compare(candidates,best){
  if(!best?.text||agrees(candidates,best))return false;
  const readings=semanticReadings(candidates,best),signature=bestSignature(best,readings);
  if(signature&&readings.length){const votes=new Map();for(const {meaning:next}of readings)votes.set(next.signature,(votes.get(next.signature)||0)+1);const own=votes.get(signature)||0,other=Math.max(0,...[...votes].filter(([key])=>key!==signature).map(([,count])=>count));return other>=Math.max(2,own);}
  const key=text=>String(text||'').replace(/\s/g,'').replace(/,/g,'.'),floor=Math.max(55,(Number(best.confidence)||0)-18),votes=new Map();for(const candidate of candidates.filter(c=>c?.text&&Number(c.confidence)>=floor)){const value=key(candidate.text);votes.set(value,(votes.get(value)||0)+1);}const own=votes.get(key(best.text))||0,other=Math.max(0,...[...votes].filter(([value])=>value!==key(best.text)).map(([,count])=>count));return other>=Math.max(2,own);
 }
 function report(result){const note=document.getElementById('ocrEnhancementStatus');if(note)note.textContent=result.needsReview?'Okumalar farklı: nominal değeri, işaretleri ve toleransları kontrol edin.':'Son okuma tamamlandı. Sonucu kaynak görüntüyle kontrol edin.';}
 function review(result){return new Promise(resolve=>{const dialog=document.createElement('dialog');dialog.className='oe-review';const heading=document.createElement('h3'),hint=document.createElement('p'),list=document.createElement('div'),footer=document.createElement('footer'),cancel=document.createElement('button'),accept=document.createElement('button');heading.textContent='OCR sonucunu kontrol edin';hint.textContent='Mevcut bilgiler henüz değiştirilmedi. Kaynak görüntüyle karşılaştırıp bir okuma seçin veya vazgeçin.';cancel.textContent='Mevcut bilgiyi koru';accept.textContent='Seçili okumayı kullan';accept.disabled=true;const entries=[result,...(result.alternatives||[])].filter((r,i,a)=>r.text&&a.findIndex(q=>q.text===r.text)===i);let selected=null,settled=false;for(const entry of entries){const label=document.createElement('label'),radio=document.createElement('input'),text=document.createElement('span');radio.type='radio';radio.name='ocr-reading';text.textContent=entry.text;label.append(radio,text);list.append(label);radio.onchange=()=>{selected=entry;accept.disabled=false;};}cancel.onclick=()=>dialog.close();accept.onclick=()=>{settled=true;resolve({...selected,needsReview:false,reviewConfirmed:true});dialog.close();};dialog.addEventListener('close',()=>{if(!settled)resolve(null);dialog.remove();});footer.append(cancel,accept);dialog.append(heading,hint,list,footer);document.body.append(dialog);dialog.showModal();});}
 function diagnostic(image,result){const c=document.createElement('canvas'),w=image.naturalWidth||image.width,h=image.naturalHeight||image.height,k=Math.min(1,1600/Math.max(w,h));c.width=w*k;c.height=h*k;const ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);ctx.lineWidth=Math.max(1,c.width/400);for(const word of result.words||[]){ctx.strokeStyle=/^[+−-]/.test(word.text)?'#b44a08':/^0(?:\.0+)?$/.test(word.text)?'#7958b6':'#008b9b';ctx.strokeRect(word.x*c.width,word.y*c.height,word.w*c.width,word.h*c.height);}return c.toDataURL();}
 async function loadSnapshot(snapshot){const image=new Image();image.src=snapshot;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext('2d').drawImage(image,0,0);return c;}
 async function preview(){const app=root.ASMachApp,r=app?.selectedAnnotation();if(!r?.selectionBox){app?.toast('Önce kaynak kutusu bulunan bir karakteristik seçin.',true);return;}const canvas=app.elements.sourceCanvas,b=r.selectionBox;let source;
  if(r.snapshot)source=await loadSnapshot(r.snapshot);
  else if(b.points?.length===4){const p=b.points.map(q=>({x:q.x*canvas.width,y:q.y*canvas.height})),w=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),h=Math.hypot(p[3].x-p[0].x,p[3].y-p[0].y);source=root.ASMachSnapshots._test.extract(canvas,{cx:p.reduce((s,q)=>s+q.x,0)/4,cy:p.reduce((s,q)=>s+q.y,0)/4,w,h,angle:Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x)*180/Math.PI},Math.min(1,2000/Math.max(w,h)));}
  else source=root.ASMachSnapshots.cropCanvas(canvas,b);
  document.getElementById('ocrEnhancementPreview')?.remove();const d=document.createElement('dialog');d.id='ocrEnhancementPreview';d.innerHTML='<header><strong>OCR görüntü karşılaştırması</strong><button type="button" aria-label="Kapat">×</button></header><p>Yalnızca okuma kopyası işlenir. Çizim ve kayıtlı kaynak görüntüsü değişmez. Güçlü işlemde küçük işaretleri özellikle kontrol edin.</p><div class="oe-images"></div><p>Karşılaştırma seçili bölge içindir. Yeniden seçim yaptıktan sonra OCR okuması seçtiğiniz iyileştirme düzeyini kullanır.</p>';const images=d.querySelector('.oe-images');
  for(const [value,title]of [['off','Orijinal'],['mild','Hafif · kontrast'],['strong','Güçlü · yerel eşikleme']]){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');caption.textContent=title;img.alt=title;const processed=process(source,value);img.src=processed.toDataURL();processed.width=processed.height=1;const choose=document.createElement('button');choose.type='button';choose.className='oe-use-reading';choose.textContent=title.split(' · ')[0]+' okumayı kullan';choose.setAttribute('aria-pressed','false');choose.onclick=async()=>{const ticket=d._readTicket=(d._readTicket||0)+1;choose.disabled=true;try{const result=figure._ocrResult||await root.ASMachOCR.recognize(snapshot,{previewPass:value});if(!d.isConnected||ticket!==d._readTicket)return;if(root.ASMachApp.selectedAnnotation()!==r||r.snapshot!==originalSnapshot||root.ASMachApp.state.fileData!==fileAtStart)throw Error('Kaynak veya seçili kayıt değişti.');if(result.error||!result.text?.trim())throw Error(result.error||'Metin bulunamadı.');setMode(value);root.ASMachCharacteristicInspector.applyReading(r,{text:result.text,confidence:result.confidence,source:result.source,quiet:true},false);for(const b of d.querySelectorAll('.oe-use-reading'))b.setAttribute('aria-pressed',String(b===choose));choose.textContent='Uygulandı · '+title.split(' · ')[0];}catch(e){choose.textContent=e.message;}finally{choose.disabled=false;}};figure.append(caption,img,choose);images.append(figure);}
  const snapshot=source.toDataURL(),originalSnapshot=r.snapshot,fileAtStart=app.state.fileData;source.width=source.height=1;const read=document.createElement('button');read.type='button';read.textContent='Üç okumayı yenile';d.append(read);read.onclick=async()=>{if(read.disabled)return;read.disabled=true;try{for(const [i,value]of ['off','mild','strong'].entries()){if(!d.isConnected)break;const fig=images.children[i];let output=fig.querySelector('pre');if(!output){output=document.createElement('pre');fig.append(output);}output.textContent='Okunuyor…';const result=await root.ASMachOCR.recognize(snapshot,{previewPass:value});if(!d.isConnected)break;fig._ocrResult=result;if(result.previewImage)fig.querySelector('img').src=result.previewImage;if(result.visualGdt){const cells=result.gdt?.cells||[];output.textContent='GD&T: '+(result.gdt?.name||'Türü doğrulayın')+'\nTolerans / bölge: '+(cells[1]||'?')+'\nDatumlar: '+(cells.slice(2).join(' → ')||'Yok')+'\n'+(result.needsReview?'Kontrol gerekli':'Hücreler okundu')+'\n'+(result.gdt?.warnings||[]).join('\n');let frame=fig.querySelector('.ocr-gdt-frame');if(!frame){frame=document.createElement('div');frame.className='ocr-gdt-frame';frame.style.cssText='display:flex;align-items:stretch;margin:8px 0;overflow:auto';fig.append(frame);}frame.replaceChildren();cells.forEach((value,i)=>{const cell=document.createElement('span');cell.textContent=value;cell.title=i===0?'GD&T türü':i===1?'Tolerans / bölge':i-1+'. datum';cell.style.cssText='border:1px solid #536875;padding:5px 9px;font:20px Arial;background:'+(value==='?'?'#fff0ce':'white');if(i===0&&result.gdt?.subtype){const symbol=document.createElement('img');symbol.src=root.ASMachGdtVision._test.symbolTemplate(result.gdt.subtype,0,96).toDataURL();symbol.alt=value;symbol.style.cssText='height:24px;width:24px;display:block';cell.replaceChildren(symbol);}frame.append(cell);});continue;}fig.querySelector('.ocr-gdt-frame')?.remove();const parsed=root.ASMachApp.parseRequirement(result.text||'');output.textContent=result.error||'Ham okuma: '+(result.rawText||result.text||'—')+'\nNominal: '+(parsed.nominalValue||'—')+' · Alt: '+(parsed.lowerTolerance||'—')+' · Üst: '+(parsed.upperTolerance||'—')+'\nSonuç: '+(result.text||'Metin bulunamadı')+'\n'+(result.needsReview?'Kontrol gerekli':'Kaynakla karşılaştırın')+' · '+(result.enhancement==='regions'?'Bölgesel okuma':result.enhancement||'off');}}catch(e){read.textContent=e.message;}finally{read.disabled=false;}};d.querySelector('header button').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());document.body.append(d);const targets=document.createElement('div');targets.className='oe-region-actions';for(const label of ['Nominal için OCR','Tolerans için OCR']){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=![...document.querySelectorAll('.wf-reading-targets button')].some(b=>b.textContent===label&&!b.disabled);button.title=button.disabled?'Önce aday görüntüsünde bir alan seçin.':label;button.onclick=()=>{if(app.selectedAnnotation()!==r)return;d.close();const toggle=document.getElementById('cwSourceToggle');if(document.getElementById('ipSourcePane')?.hidden)toggle?.click();[...document.querySelectorAll('.wf-reading-targets button')].find(b=>b.textContent===label)?.click();};decorateTarget(button,label.startsWith('Nominal')?'nominal':'tolerance',label);targets.append(button);}d.append(targets);d.showModal();read.click();
 }
 function mount(){const host=document.getElementById('ipSourcePane');if(!host||document.getElementById('ocrEnhancementControls'))return;const bar=document.createElement('div');bar.id='ocrEnhancementControls';bar.innerHTML='<label>Görüntüyü iyileştir <select aria-label="OCR görüntü iyileştirme"></select></label><button type="button">Karşılaştır</button><small id="ocrEnhancementStatus" role="status">Görüntü dosyaları için · PDF okuması değiştirilmez.</small>';const select=bar.querySelector('select');for(const [v,label]of Object.entries(modes))select.add(new Option(label,v));select.value=selectedMode;select.onchange=()=>{selectedMode=select.value;bar.querySelector('small').textContent='Sonraki OCR okumasında uygulanır. Mevcut bilgiler değişmedi.';};bar.querySelector('button').onclick=()=>preview().catch(e=>root.ASMachApp?.toast(e.message,true));host.prepend(bar);}
 const css=document.createElement('style');css.textContent='#ocrEnhancementControls{display:flex;gap:5px;flex-wrap:wrap;padding:5px;border-bottom:1px solid #cadde7;font:11px Segoe UI}#ocrEnhancementControls label{display:flex;align-items:center;gap:5px}#ocrEnhancementControls select,#ocrEnhancementControls button{height:27px;padding:3px 6px;border:1px solid #bdd5e1;border-radius:4px;background:white;color:#194b62;font:inherit}#ocrEnhancementControls small{flex-basis:100%;font:10px Segoe UI;color:#597282}#ocrEnhancementPreview{width:1000px;max-width:94vw;max-height:88vh;overflow:auto;padding:15px;border:1px solid #afc8d5;border-radius:8px;color:#20495e;font:13px Segoe UI}#ocrEnhancementPreview::backdrop{background:#18364366}#ocrEnhancementPreview header{display:flex;justify-content:space-between;align-items:center}#ocrEnhancementPreview header button{font-size:22px;background:white;border:0;cursor:pointer}.oe-images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.oe-images figure{margin:0;padding:8px;background:#f1f6f8;border:1px solid #cadde7}.oe-images figcaption{margin-bottom:12px}.oe-images img{display:block;width:100%;max-height:55vh;object-fit:contain;background:white}@media(max-width:650px){.oe-images{grid-template-columns:1fr}}';document.head.append(css);
 const observer=new MutationObserver(()=>{if(document.getElementById('ipSourcePane')){mount();observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});mount();
 const reviewCss=document.createElement('style');reviewCss.textContent='.oe-review{width:560px;max-width:92vw;max-height:80vh;overflow:auto;padding:18px;border:1px solid #afc8d5;border-radius:8px;font:13px Segoe UI;color:#20495e}.oe-review::backdrop{background:#18364366}.oe-review label{display:flex;gap:8px;padding:10px;margin:5px 0;border:1px solid #d0dfe7;border-radius:4px;white-space:pre-wrap}.oe-review footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.oe-review button,#ocrEnhancementPreview>button{padding:7px 12px;border:1px solid #adc9d6;background:#edf6f8;color:#164b61;border-radius:4px;cursor:pointer}.oe-review button:disabled{opacity:.5}.oe-images pre{white-space:pre-wrap;font:14px Segoe UI;padding:8px;background:white;border-top:1px solid #cbdce5;overflow-wrap:anywhere}';document.head.append(reviewCss);
 const directCss=document.createElement('style');directCss.textContent='#ocrEnhancementControls>label{display:none}#ocrEnhancementControls small{display:none}.wf-reading-modes,.wf-reading-targets{padding:3px 5px;gap:4px}.wf-reading-modes button,.wf-reading-targets button,.oe-use-reading,.oe-region-actions button{padding:4px 7px;border:1px solid #b7cedb;border-radius:4px;background:white;color:#194b62;font:11px Segoe UI;cursor:pointer}.wf-reading-modes [aria-pressed=true],.oe-use-reading[aria-pressed=true]{background:#dbf5f7;border-color:#0095a7;color:#006578}.oe-use-reading{margin-top:8px}.oe-region-actions{display:flex;gap:6px;margin-top:8px}.wf-source-draft textarea{resize:vertical;min-height:40px;font:12px Segoe UI;width:100%;box-sizing:border-box}';document.head.append(directCss);
 const compactCss=document.createElement('style');compactCss.textContent='#ocrEnhancementControls{display:none!important}';document.head.append(compactCss);
 root.ASMachOcrEnhancement={mode,setMode,decorateTarget,process,compare,agrees,report,preview,review,regions,measurementRegions,measurementInkRows,spacingVariant,toleranceSigns,diagnostic};
})(window);
