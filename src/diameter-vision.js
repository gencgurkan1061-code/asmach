/* Conservative visual recovery for a missing leading Ø/phi, not generic circle OCR. */
(function(root){
  'use strict';
  function components(canvas,threshold=150){
    const {width:w,height:h}=canvas,data=canvas.getContext('2d').getImageData(0,0,w,h).data,labels=new Int32Array(w*h),parts=[];
    const dark=i=>data[i*4+3]>128&&(data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114)<threshold;
    for(let i=0;i<w*h;i++){
      if(labels[i]||!dark(i))continue;
      const id=parts.length+1,queue=[i];labels[i]=id;let minX=w,minY=h,maxX=0,maxY=0;
      for(let q=0;q<queue.length;q++){const p=queue[q],x=p%w,y=Math.floor(p/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!labels[j]&&dark(j)){labels[j]=id;queue.push(j);}}
      }
      parts.push({id,x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,area:queue.length});
    }
    return {parts,labels,width:w};
  }
  function holes(p,labels,stride){
    const seen=new Uint8Array(p.w*p.h),found=[];
    for(let i=0;i<seen.length;i++){
      if(seen[i]||labels[(p.y+Math.floor(i/p.w))*stride+p.x+i%p.w]===p.id)continue;
      const queue=[i];seen[i]=1;let edge=false,sx=0,sy=0;
      for(let q=0;q<queue.length;q++){const k=queue[q],x=k%p.w,y=Math.floor(k/p.w);sx+=x;sy+=y;if(x===0||y===0||x===p.w-1||y===p.h-1)edge=true;
        for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy,j=yy*p.w+xx;if(xx>=0&&xx<p.w&&yy>=0&&yy<p.h&&!seen[j]&&labels[(p.y+yy)*stride+p.x+xx]!==p.id){seen[j]=1;queue.push(j);}}
      }
      if(!edge&&queue.length>=Math.max(2,p.w*p.h*.012))found.push({x:p.x+sx/queue.length,y:p.y+sy/queue.length,area:queue.length});
    }
    return found;
  }
  function detectAtThreshold(canvas,nominal='',threshold=150){
    const {parts,labels,width}=components(canvas,threshold),needed=Math.min(2,String(nominal).replace(/\D/g,'').length||2);
    const suspects=parts.filter(p=>p.w>=7&&p.h>=7&&p.w/p.h>.4&&p.w/p.h<2.5&&p.area/(p.w*p.h)>.12&&p.area/(p.w*p.h)<.7);
    for(const p of suspects){
      const cavities=holes(p,labels,width);if(cavities.length!==2)continue;
      if(Math.min(...cavities.map(h=>h.area))/Math.max(...cavities.map(h=>h.area))<.25)continue;
      for(const angle of [0,90,180,270]){
        const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),rotate=v=>({x:c*v.x-s*v.y,y:s*v.x+c*v.y});
        const project=v=>{const center=rotate({x:v.x+v.w/2,y:v.y+v.h/2});return {...center,w:angle%180?v.h:v.w,h:angle%180?v.w:v.h};};
        const head=project(p);if(head.w/head.h<.45||head.w/head.h>1.5)continue;
        const h=cavities.map(rotate),dx=Math.abs(h[0].x-h[1].x),dy=Math.abs(h[0].y-h[1].y);
        // Ø / phi has side-by-side or diagonal cavities. 8 and B have vertically stacked cavities.
        if(dx<head.w*.16||dx<dy*.85)continue;
        const peers=parts.filter(q=>q!==p&&q.area>=8).map(project).filter(q=>q.h>head.h*.55&&q.h<head.h*1.9&&q.w/q.h>.08&&q.w/q.h<1.15&&Math.abs(q.y-head.y)<Math.max(q.h,head.h)*.42);
        if(peers.some(q=>q.x<head.x&&head.x-q.x<head.h*4))continue;
        const next=peers.filter(q=>q.x>head.x+head.w*.5&&q.x-head.x<head.h*6).sort((a,b)=>a.x-b.x);
        if(next.length<needed||next[0].x-next[0].w/2-(head.x+head.w/2)>head.h*1.8)continue;
        return {diameter:true,confidence:90,angle,box:{x:p.x/canvas.width,y:p.y/canvas.height,w:p.w/canvas.width,h:p.h/canvas.height}};
      }
    }
    return {diameter:false};
  }
  function detect(canvas,nominal=''){for(const threshold of [150,185,210]){const result=detectAtThreshold(canvas,nominal,threshold);if(result.diameter)return result;}return {diameter:false};}
  async function inspect(snapshot,nominal){
    const image=new Image();image.src=snapshot;await image.decode();const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight));
    canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return detect(canvas,nominal);
  }
  // Correct a confused prefix only when the source pixels independently prove Ø.
  function recover(reading,evidence){
    if(!evidence?.diameter||!reading.text)return reading;
    const angle=((Number(reading.angle)||0)%360+360)%360;
    if(angle!==((evidence.angle%360+360)%360))return reading;
    const b=evidence.box,overlaps=w=>{if(!b)return false;const area=Math.max(0,Math.min(w.x+w.w,b.x+b.w)-Math.max(w.x,b.x))*Math.max(0,Math.min(w.y+w.h,b.y+b.h)-Math.max(w.y,b.y));return area/(b.w*b.h)>.45;};
    let corrected=false;let words=(reading.words||[]).map(w=>{if(overlaps(w)&&/^[©CcOo0Φφ⌀Ø]$/.test(w.text.trim())){corrected=true;return {...w,text:'Ø'};}return w;});
    const prefixed=/^[©Φφ⌀Oo]\s*(?=\d)/.test(reading.text);
    // OCR may omit the graphical Ø entirely while still reading the following
    // number perfectly. Restore it only when independent pixel evidence sits
    // immediately before the first numeric OCR box on the same text row.
    const firstNumber=words.filter(w=>/^(?!0\d)\d/.test(String(w.text||'').trim())&&Number.isFinite(w.x)&&Number.isFinite(w.y)&&Number.isFinite(w.w)&&Number.isFinite(w.h)).sort((a,b)=>a.x-b.x)[0];
    const rowOverlap=firstNumber&&Math.max(0,Math.min(firstNumber.y+firstNumber.h,b.y+b.h)-Math.max(firstNumber.y,b.y))/Math.max(.0001,Math.min(firstNumber.h,b.h));
    const gap=firstNumber?firstNumber.x-(b.x+b.w):Infinity;
    const omitted=Boolean(firstNumber&&/^(?!0\d)\d+(?:[.,]\d+)?(?:\s|$)/.test(reading.text.trim())&&rowOverlap>.35&&gap>-Math.min(b.w,firstNumber.w)*.25&&gap<Math.max(b.h,firstNumber.h)*1.8);
    if(!corrected&&!prefixed&&!omitted)return reading;
    let text=reading.text.replace(/^[©Φφ⌀Oo]\s*(?=\d)/,'Ø');
    if(omitted){text='Ø'+text;words=[{text:'Ø',confidence:evidence.confidence||90,angle,x:b.x,y:b.y,w:b.w,h:b.h,visual:true},...words];}
    if(corrected&&root.ASMachMeasurementLayout){const layout=root.ASMachMeasurementLayout.reconstruct(words,{width:evidence.width||1,height:evidence.height||1,ocr:true,details:true});if(layout?.structured&&!layout.missingDigits)text=layout.text;}
    if(!/^Ø/.test(text))return reading;
    return {...reading,rawText:reading.rawText||reading.text,text,words,symbolRecovery:'Çap simgesi kaynak görüntüden doğrulandı'};
  }
  root.ASMachDiameterVision={inspect,detect,recover};
})(window);
