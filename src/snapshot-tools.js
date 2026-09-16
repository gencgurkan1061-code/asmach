/* One non-destructive rotated ROI drives the drawing outline and report image. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function corners(r){const a=r.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:r.cx+x*r.w/2*c-y*r.h/2*s,y:r.cy+x*r.w/2*s+y*r.h/2*c}));}
  // All rotation math is in PAGE PIXELS, not normalized coordinates: using
  // normalized x/y directly would skew boxes on non-square drawing sheets.
  function boxRect(box,width,height){
    const p=box.points?.length===4?box.points.map(v=>({x:v.x*width,y:v.y*height})):null;
    if(p)return{cx:p.reduce((s,v)=>s+v.x,0)/4,cy:p.reduce((s,v)=>s+v.y,0)/4,w:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),h:Math.hypot(p[3].x-p[0].x,p[3].y-p[0].y),angle:Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x)*180/Math.PI};
    return{cx:(box.x+box.w/2)*width,cy:(box.y+box.h/2)*height,w:box.w*width,h:box.h*height,angle:0};
  }
  function rotateBox(box,width,height,angle){
    if(!box||!Number.isFinite(angle)||!(width>0&&height>0))throw Error('Geçerli kutu ve açı gerekli.');
    const rect=constrain({...boxRect(box,width,height),angle:clamp(angle,-180,180)},width,height);
    const points=corners(rect).map(p=>({x:clamp(p.x/width,0,1),y:clamp(p.y/height,0,1)})),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
    return{x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y,points,rotation:rect.angle,angleLocked:true};
  }
  function constrain(r,width,height){
    const a=r.angle*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
    const w=Math.max(2,r.w),h=Math.max(2,r.h),scale=Math.min(1,width/(w*c+h*s),height/(w*s+h*c));
    const next={...r,w:w*scale,h:h*scale},ex=(next.w*c+next.h*s)/2,ey=(next.w*s+next.h*c)/2;
    next.cx=clamp(next.cx,ex,width-ex);next.cy=clamp(next.cy,ey,height-ey);return next;
  }
  function adjust(r,mode,start,end,width,height){
    const dx=end.x-start.x,dy=end.y-start.y,a=r.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    if(mode==='move')return constrain({...r,cx:r.cx+dx,cy:r.cy+dy},width,height);
    if(mode==='rotate'){const delta=(Math.atan2(end.y-r.cy,end.x-r.cx)-Math.atan2(start.y-r.cy,start.x-r.cx))*180/Math.PI;return constrain({...r,angle:((r.angle+delta+540)%360)-180},width,height);}
    let l=-r.w/2,t=-r.h/2,right=r.w/2,b=r.h/2;const u=c*dx+s*dy,v=-s*dx+c*dy;
    if(mode.includes('w'))l=Math.min(right-2,l+u);if(mode.includes('e'))right=Math.max(l+2,right+u);
    if(mode.includes('n'))t=Math.min(b-2,t+v);if(mode.includes('s'))b=Math.max(t+2,b+v);
    const mx=(l+right)/2,my=(t+b)/2;
    return constrain({...r,cx:r.cx+mx*c-my*s,cy:r.cy+mx*s+my*c,w:right-l,h:b-t},width,height);
  }
  function extract(source,r,scale=1){
    const out=document.createElement('canvas');out.width=Math.max(1,Math.round(r.w*scale));out.height=Math.max(1,Math.round(r.h*scale));
    const ctx=out.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,out.width,out.height);ctx.translate(out.width/2,out.height/2);ctx.scale(out.width/r.w,out.height/r.h);ctx.rotate(-r.angle*Math.PI/180);ctx.drawImage(source,-r.cx,-r.cy);return out;
  }
  function cropCanvas(source,r){
    const out=document.createElement('canvas'),x=Math.max(0,Math.floor(r.x*source.width)),y=Math.max(0,Math.floor(r.y*source.height));
    out.width=Math.max(1,Math.min(source.width-x,Math.ceil(r.w*source.width)));out.height=Math.max(1,Math.min(source.height-y,Math.ceil(r.h*source.height)));
    const ctx=out.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(source,x,y,out.width,out.height,0,0,out.width,out.height);return out;
  }
  function rotateCanvas(source,degrees){
    const a=degrees*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
    const out=document.createElement('canvas');out.width=Math.max(1,Math.ceil(source.width*c+source.height*s-1e-8));out.height=Math.max(1,Math.ceil(source.width*s+source.height*c-1e-8));
    const ctx=out.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,out.width,out.height);ctx.translate(out.width/2,out.height/2);ctx.rotate(a);ctx.drawImage(source,-source.width/2,-source.height/2);return out;
  }
  function mount(container,snapshot,onSave,onError,options={}){
    container.innerHTML=`<div class="snapshot-controls">
      <div class="snapshot-actions"><button type="button" class="btn" data-auto>Otomatik sığdır</button><button type="button" class="btn" data-new>Yeni kutu</button><button type="button" class="btn" data-reset title="İlk seçime dön">Sıfırla</button></div>
      <div class="snapshot-view-tools"><button type="button" class="btn" data-zoom-out aria-label="Kaynak görüntüsünü uzaklaştır">−</button><output data-zoom-label>100%</output><button type="button" class="btn" data-zoom-in aria-label="Kaynak görüntüsünü yakınlaştır">+</button><button type="button" class="btn" data-view-fit title="Yalnız görüntüyü sığdır; seçim değişmez">Sığdır</button><button type="button" class="btn" data-rotate title="Seçimi 90° döndür">↻ 90°</button></div>
      <small>Kutuyu taşı / kırp / döndür · Balonu tutup sürükle<br>İnce dönüş: [ / ] · Shift: 0,1° · R: 90°</small>
    </div>
    <div class="snapshot-stage"><canvas tabindex="0" aria-label="Gerçek seçim: taşı, boyutlandır veya döndür"></canvas></div>
    <div class="snapshot-feedback" data-info role="status">Görüntü yükleniyor…</div>
    <div class="snapshot-footer"><details class="snapshot-report"><summary>Rapor önizlemesi</summary><canvas data-result aria-label="Rapora aktarılacak düzeltilmiş seçim"></canvas></details><button type="button" class="btn primary" data-crop title="Seçimi çizime ve rapora uygula">Uygula</button></div>`;
    const $=s=>container.querySelector(s),canvas=$('canvas'),preview=$('[data-result]'),info=$('[data-info]');
    canvas.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();};
    let source=null,r=null,initial=null,drag=null,disposed=false,newBox=false,displayScale=1,view={x:0,y:0,w:1,h:1},autoMessage='',manualView=false,zoomLevel=1,detectedTextHeight=null;
    function metadata(){return{points:corners(r).map(p=>({x:p.x/source.width,y:p.y/source.height})),angle:r.angle,rect:{...r},sourceWidth:source.width,sourceHeight:source.height,...(Number.isFinite(detectedTextHeight)?{textHeight:detectedTextHeight}:{})};}
    function sync(){}
    function handles(){const p=corners(r),mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2}),n=mid(p[0],p[1]),a=r.angle*Math.PI/180,d=24/displayScale,pad=7/displayScale;return{nw:p[0],n,ne:p[1],e:mid(p[1],p[2]),se:p[2],s:mid(p[2],p[3]),sw:p[3],w:mid(p[3],p[0]),rotate:{x:clamp(n.x+Math.sin(a)*d,pad,Math.max(pad,source.width-pad)),y:clamp(n.y-Math.cos(a)*d,pad,Math.max(pad,source.height-pad))}};}
    function draw(){
      if(!source||disposed)return;
      const balloon=options.getBalloon?.(metadata());
      if(!drag&&!manualView){view={x:balloon?Math.min(0,balloon.x-balloon.radius-12):0,y:balloon?Math.min(0,balloon.y-balloon.radius-12):0};
      view.w=Math.max(source.width,balloon?balloon.x+balloon.radius+12:0)-view.x;view.h=Math.max(source.height,balloon?balloon.y+balloon.radius+12:0)-view.y;}
      const scale=Math.min(1,900/Math.max(view.w,view.h)),px=x=>(x-view.x)*scale,py=y=>(y-view.y)*scale;canvas.width=Math.round(view.w*scale);canvas.height=Math.round(view.h*scale);
      const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,px(0),py(0),source.width*scale,source.height*scale);displayScale=(canvas.getBoundingClientRect().width||canvas.width)/view.w;
      const p=corners(r);ctx.fillStyle='rgba(13,30,48,.4)';ctx.beginPath();ctx.rect(0,0,canvas.width,canvas.height);p.forEach((v,i)=>i?ctx.lineTo(px(v.x),py(v.y)):ctx.moveTo(px(v.x),py(v.y)));ctx.closePath();ctx.fill('evenodd');
      ctx.save();ctx.strokeStyle=balloon?.color||'#009caf';ctx.globalAlpha=balloon?.opacity??1;ctx.lineWidth=1.5*scale/displayScale;
      if(balloon)root.ASMachBalloonAppearance?.canvas(ctx,balloon,'box',(balloon.strokeScale||1)*scale);
      ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(px(v.x),py(v.y)):ctx.moveTo(px(v.x),py(v.y)));ctx.closePath();if(balloon?.boxLineStyle!=='none')ctx.stroke();ctx.restore();
      ctx.strokeStyle='#009caf';ctx.lineWidth=1.5*scale/displayScale;ctx.setLineDash?.([]);
      const h=handles();ctx.beginPath();ctx.moveTo(px(h.n.x),py(h.n.y));ctx.lineTo(px(h.rotate.x),py(h.rotate.y));ctx.stroke();
      Object.entries(h).forEach(([key,v])=>{ctx.beginPath();ctx.arc(px(v.x),py(v.y),(key==='rotate'?6:4.5)*scale/displayScale,0,Math.PI*2);ctx.fillStyle=key==='rotate'?'#009caf':'white';ctx.fill();ctx.stroke();});
      if(balloon){
        ctx.save();ctx.globalAlpha=balloon.opacity??1;ctx.strokeStyle=balloon.color||'#07899a';ctx.lineWidth=2*scale/displayScale;
        root.ASMachBalloonAppearance?.canvas(ctx,balloon,'leader',(balloon.strokeScale||1)*scale);
        if(balloon.connected!==false){const dx=balloon.anchorX-balloon.x,dy=balloon.anchorY-balloon.y,len=Math.hypot(dx,dy)||1,extent=balloon.shape==='square'?balloon.radius/Math.max(Math.abs(dx/len),Math.abs(dy/len)):balloon.radius;ctx.beginPath();ctx.moveTo(px(balloon.anchorX),py(balloon.anchorY));ctx.lineTo(px(balloon.x+dx/len*extent),py(balloon.y+dy/len*extent));ctx.stroke();}
        root.ASMachBalloonAppearance?.canvas(ctx,balloon,'balloon',(balloon.strokeScale||1)*scale);
        const cx=px(balloon.x),cy=py(balloon.y),radius=balloon.radius*scale;ctx.beginPath();
        if(balloon.shape==='square')ctx.rect(cx-radius,cy-radius,2*radius,2*radius);
        else if(balloon.shape==='hexagon'){for(let j=0;j<6;j++){const x=cx+radius*Math.cos(j*Math.PI/3),y=cy+radius*Math.sin(j*Math.PI/3);j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}
        else ctx.arc(cx,cy,radius,0,Math.PI*2);
        ctx.fillStyle='white';ctx.fill();ctx.stroke();ctx.fillStyle=balloon.color||'#07899a';ctx.font=`700 ${Math.max(6,balloon.fontSize*scale)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(balloon.number),cx,cy);ctx.restore();
      }
      const generated=options.getReport?.(),result=generated||extract(source,r,Math.min(1,480/r.w,160/r.h));preview.width=result.width;preview.height=result.height;preview.getContext('2d').drawImage(result,0,0);preview.style.height=generated?'28px':'';preview.style.width=generated?'auto':'';
      info.textContent=`${Math.round(r.w)} × ${Math.round(r.h)} px · ${r.angle.toFixed(1)}°${autoMessage?' · '+autoMessage:''}${balloon?' · Balon önizlemesi: '+balloon.methodLabel:options.getBalloon?' · Yakında uygun balon boşluğu bulunamadı':''}`;
    }
    function commit(){if(!source||disposed)return;const result=extract(source,r);onSave(result.toDataURL('image/png'),metadata());return result;}
    function setAngle(value){if(!r||!Number.isFinite(value))return;r=constrain({...r,angle:((value+540)%360)-180},source.width,source.height);draw();}
    function fit(){if(!source||!root.ASMachAutoSelection)return;const p=corners(r),seed={cx:r.cx,cy:r.cy,w:Math.max(...p.map(v=>v.x))-Math.min(...p.map(v=>v.x)),h:Math.max(...p.map(v=>v.y))-Math.min(...p.map(v=>v.y)),angle:0},paddingRatio=Number(typeof options.getPaddingRatio==='function'?options.getPaddingRatio():options.paddingRatio),padding=Number.isFinite(paddingRatio)?paddingRatio*source.width:undefined;const detected=root.ASMachAutoSelection.detect(source,seed,{angleHint:options.angleHint,...(padding===undefined?{}:{padding})});r=constrain(detected.rect,source.width,source.height);detectedTextHeight=Number.isFinite(detected.textHeight)?detected.textHeight:null;autoMessage=detected.reason;draw();commit();}
    $('[data-auto]').onclick=fit;$('[data-new]').onclick=()=>{newBox=true;canvas.style.cursor='crosshair';info.textContent='Görüntüde sürükleyerek yeni kutu çizin.';};
    $('[data-reset]').onclick=()=>{if(!initial)return;r={...initial};newBox=false;sync();draw();commit();};$('[data-crop]').onclick=commit;
    function zoom(factor,at){if(!source||drag)return;const level=clamp(zoomLevel*factor,.5,16),f=zoomLevel/level,center=at||{x:view.x+view.w/2,y:view.y+view.h/2};view={x:center.x+(view.x-center.x)*f,y:center.y+(view.y-center.y)*f,w:view.w*f,h:view.h*f};zoomLevel=level;manualView=true;$('[data-zoom-label]').textContent=Math.round(level*100)+'%';draw();}
    $('[data-zoom-in]').onclick=()=>zoom(1.25);$('[data-zoom-out]').onclick=()=>zoom(.8);$('[data-view-fit]').onclick=()=>{manualView=false;zoomLevel=1;$('[data-zoom-label]').textContent='100%';draw();};$('[data-rotate]').onclick=()=>{if(!r)return;r={...r,w:r.h,h:r.w};setAngle(r.angle+90);commit();};
    canvas.addEventListener('wheel',e=>{if(!e.ctrlKey||!source)return;e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15,point(e));},{passive:false});
    function point(e,bounded=false){const b=canvas.getBoundingClientRect(),p={x:view.x+(e.clientX-b.left)/b.width*view.w,y:view.y+(e.clientY-b.top)/b.height*view.h};return bounded?{x:clamp(p.x,0,source.width),y:clamp(p.y,0,source.height)}:p;}
    function hit(p){const balloon=options.getBalloon?.(metadata());if(balloon&&options.onBalloonMove&&Math.hypot(p.x-balloon.x,p.y-balloon.y)<=balloon.radius+4/displayScale)return 'balloon';const h=handles();for(const key of ['rotate','nw','ne','se','sw','n','e','s','w'])if(Math.hypot(p.x-h[key].x,p.y-h[key].y)<9/displayScale)return key;const a=r.angle*Math.PI/180,dx=p.x-r.cx,dy=p.y-r.cy;return Math.abs(dx*Math.cos(a)+dy*Math.sin(a))<=r.w/2&&Math.abs(-dx*Math.sin(a)+dy*Math.cos(a))<=r.h/2?'move':'new';}
    canvas.onpointerdown=e=>{if(!source||disposed||e.button!==0)return;e.preventDefault();const p=point(e),mode=e.altKey?'pan':newBox?'new':hit(p);drag={mode,start:mode==='balloon'?p:point(e,true),rect:{...r},balloon:options.getBalloon?.(metadata()),view:{...view},screen:{x:e.clientX,y:e.clientY}};newBox=false;canvas.setPointerCapture(e.pointerId);};
    function move(e){if(!source||disposed)return;const p=point(e,drag&&drag.mode!=='balloon');if(!drag){const mode=hit(p);canvas.style.cursor=['rotate','balloon'].includes(mode)?'grab':mode==='move'?'move':mode==='new'?'crosshair':mode+'-resize';return;}if(drag.mode==='balloon'){options.onBalloonMove({x:drag.balloon.x+p.x-drag.start.x,y:drag.balloon.y+p.y-drag.start.y},metadata());canvas.style.cursor='grabbing';draw();return;}if(drag.mode==='new')r=constrain({cx:(p.x+drag.start.x)/2,cy:(p.y+drag.start.y)/2,w:Math.abs(p.x-drag.start.x),h:Math.abs(p.y-drag.start.y),angle:0},source.width,source.height);else r=adjust(drag.rect,drag.mode,drag.start,p,source.width,source.height);sync();draw();}
    const moveSelection=move;function moveView(e){if(drag?.mode==='pan'){const b=canvas.getBoundingClientRect();view={...drag.view,x:drag.view.x-(e.clientX-drag.screen.x)/b.width*drag.view.w,y:drag.view.y-(e.clientY-drag.screen.y)/b.height*drag.view.h};manualView=true;canvas.style.cursor='grabbing';draw();}else moveSelection(e);}
    canvas.onpointermove=moveView;canvas.onpointerup=e=>{if(!drag)return;moveView(e);const mode=drag.mode;drag=null;canvas.releasePointerCapture?.(e.pointerId);if(mode==='new'&&options.autoFit)fit();else{draw();if(!['balloon','pan'].includes(mode))commit();}};canvas.onpointercancel=()=>{if(drag){if(drag.mode==='balloon')options.onBalloonMove(drag.balloon,metadata());if(drag.mode==='pan')view=drag.view;r=drag.rect;drag=null;sync();draw();}};
    canvas.onkeydown=e=>{if(!r)return;if(['[',']','r','R'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key.toLowerCase()==='r'){r={...r,w:r.h,h:r.w};setAngle(r.angle+90);}else setAngle(r.angle+(e.key===']'?1:-1)*(e.shiftKey?.1:1));commit();return;}const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();e.stopPropagation();const step=e.shiftKey?10:1;r=constrain({...r,cx:r.cx+delta[0]*step,cy:r.cy+delta[1]*step},source.width,source.height);draw();commit();};
    const image=new Image();image.src=snapshot;image.decode().then(()=>{if(disposed)return;source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;source.getContext('2d').drawImage(image,0,0);const b=options.initialRect||{x:0,y:0,w:1,h:1};initial=constrain({cx:(b.x+b.w/2)*source.width,cy:(b.y+b.h/2)*source.height,w:b.w*source.width,h:b.h*source.height,angle:0},source.width,source.height);r={...initial};if(options.detected){r=constrain(options.detected.rect,source.width,source.height);detectedTextHeight=Number.isFinite(options.detected.textHeight)?options.detected.textHeight:null;autoMessage=options.detected.reason;}else if(options.autoFit){fit();return;}draw();commit();}).catch(error=>{if(!disposed){info.textContent='Snapshot yüklenemedi.';onError?.(error);}});
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(source&&!drag)draw();}):null;observer?.observe(container.querySelector('.snapshot-stage'));
    return{commit,refresh:draw,fit,dispose(){disposed=true;observer?.disconnect();},getSelection(){return r?{...r}:null;}};
  }
  root.ASMachSnapshots={cropCanvas,rotateCanvas,boxRect,rotateBox,mount,_test:{corners,constrain,adjust,extract}};
})(window);
