/* Recover graphical symbols even when a searchable PDF omits them from its text layer. */
(function(root){
 'use strict';
 const make=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;};
 function crop(image,b,pad=0){const W=image.naturalWidth||image.width,H=image.naturalHeight||image.height,x=Math.max(0,Math.floor(b.x*W-pad)),y=Math.max(0,Math.floor(b.y*H-pad)),r=Math.min(W,Math.ceil((b.x+b.w)*W+pad)),bot=Math.min(H,Math.ceil((b.y+b.h)*H+pad)),canvas=make(r-x,bot-y);canvas.getContext('2d').drawImage(image,x,y,r-x,bot-y,0,0,canvas.width,canvas.height);return{canvas,x,y,W,H};}
 function diameter(image,word){
   if(!/^\d/.test(word.text.trim())||!root.ASMachDiameterVision)return null;
   const W=image.naturalWidth||image.width,H=image.naturalHeight||image.height,font=Math.min(word.w*W,word.h*H),local=crop(image,word,Math.max(12,font*1.7));
   const result=root.ASMachDiameterVision.detect(local.canvas,word.text.split(/[ ±(/]/)[0]);if(!result.diameter)return null;
   const p=result.box,sx=local.x+(p.x+p.w/2)*local.canvas.width,sy=local.y+(p.y+p.h/2)*local.canvas.height,a=-result.angle*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),cx=(word.x+word.w/2)*W,cy=(word.y+word.h/2)*H;
   const along=(cx-sx)*ux+(cy-sy)*uy,across=Math.abs(-(cx-sx)*uy+(cy-sy)*ux),half=(Math.abs(ux)*word.w*W+Math.abs(uy)*word.h*H)/2;
   // Only a prefix immediately preceding this nominal; never borrow a neighbouring diameter.
   if(across>font*.7||along<half-font*.3||along-half>font*2.3)return null;
   const x=Math.min(word.x,(local.x+p.x*local.canvas.width-2)/W),y=Math.min(word.y,(local.y+p.y*local.canvas.height-2)/H),right=Math.max(word.x+word.w,(local.x+(p.x+p.w)*local.canvas.width+2)/W),bottom=Math.max(word.y+word.h,(local.y+(p.y+p.h)*local.canvas.height+2)/H);
   return{...word,x:Math.max(0,x),y:Math.max(0,y),w:Math.min(1,right)-Math.max(0,x),h:Math.min(1,bottom)-Math.max(0,y),text:'Ø'+word.text,readingAngle:-result.angle,visualDiameter:true,retainBounds:true,source:word.source+' · Çap simgesi doğrulandı'};
 }
 function frameSeeds(image){
   const W=image.naturalWidth||image.width,H=image.naturalHeight||image.height,k=Math.min(1,1800/Math.max(W,H)),base=make(W*k,H*k);base.getContext('2d').drawImage(image,0,0,base.width,base.height);const seeds=[];
   for(const rotation of [0,90]){
     const page=rotation?root.ASMachSnapshots.rotateCanvas(base,rotation):base,w=page.width,h=page.height,d=page.getContext('2d').getImageData(0,0,w,h).data;
     const dark=(x,y)=>{const i=(y*w+x)*4;return d[i+3]>128&&d[i]+d[i+1]+d[i+2]<630;},runs=[];
     for(let y=0;y<h;y++){let start=-1,last=-1;for(let x=0;x<=w;x++){
       if(x<w&&dark(x,y)){if(start<0)start=x;last=x;}
       if(start>=0&&(x-last>1||x===w)){if(last-start>=24&&last-start<600){const prior=runs.at(-1);if(!prior||y-prior.y>2||Math.abs(start-prior.l)>2||Math.abs(last-prior.r)>2)runs.push({l:start,r:last,y});}start=-1;}
     }}
     for(let i=0;i<runs.length&&seeds.length<100;i++)for(let j=i+1;j<runs.length;j++){
       const t=runs[i],b=runs[j],height=b.y-t.y,width=t.r-t.l;if(height>Math.min(120,width/1.6))break;
       if(height<10||width/height>12||Math.abs(t.l-b.l)>3||Math.abs(t.r-b.r)>3)continue;
       const edge=x=>{let n=0;for(let y=t.y;y<=b.y;y++)if(dark(x,y)||dark(Math.max(0,x-1),y)||dark(Math.min(w-1,x+1),y))n++;return n/(height+1);};
       if(edge(t.l)<.78||edge(t.r)<.78)continue;
       const r={x:Math.max(0,t.l-4)/w,y:Math.max(0,t.y-4)/h,w:Math.min(w,t.r+4)/w-Math.max(0,t.l-4)/w,h:Math.min(h,b.y+4)/h-Math.max(0,t.y-4)/h};
       const mapped=rotation?{x:r.y,y:1-r.x-r.w,w:r.h,h:r.w}:r;
       if(!seeds.some(s=>Math.abs(s.x-mapped.x)+Math.abs(s.y-mapped.y)<.008))seeds.push(mapped);
     }
   }return seeds;
 }
 // Isolated, asymmetric surface-finish marks only. Drawing lines touching the mark
 // intentionally fail this conservative component test instead of becoming dimensions.
 function surfaceTemplate(kind){const c=make(48,64),g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,48,64);g.strokeStyle='black';g.lineWidth=2.5;g.lineJoin='round';g.beginPath();g.moveTo(4,35);g.lineTo(17,59);g.lineTo(44,5);if(kind==='required'){g.moveTo(5,35);g.lineTo(32,35);}g.stroke();if(kind==='prohibited'){g.beginPath();g.arc(18,37,8,0,Math.PI*2);g.stroke();}return c;}
 function surfaceMask(c){const out=make(32,40),g=out.getContext('2d');g.fillStyle='white';g.fillRect(0,0,32,40);g.drawImage(c,1,1,30,38);const d=g.getImageData(0,0,32,40).data;return Array.from({length:1280},(_,i)=>d[i*4+3]>100&&Math.min(d[i*4],d[i*4+1],d[i*4+2])<160);}
 let surfaceMasks;
 function surface(image,word){
   if(!/^(?:(?:Ra|Rz|Rq|Rt|Rp|Rv|Rmax)\s*)?\d+(?:[.,]\d+)?(?:\s*(?:µm|μm|µin|um))?$/i.test(word.text.trim()))return null;
   const W=image.naturalWidth||image.width,H=image.naturalHeight||image.height,font=word.h*H;if(font<5)return null;
   const local=crop(image,{x:Math.max(0,word.x-3*font/W),y:Math.max(0,word.y-font/H),w:word.w+3*font/W,h:word.h+3*font/H});
   if(local.canvas.width*local.canvas.height>400000)return null;
   const w=local.canvas.width,h=local.canvas.height,d=local.canvas.getContext('2d').getImageData(0,0,w,h).data,seen=new Uint8Array(w*h),components=[];
   const ink=i=>d[i*4+3]>100&&Math.min(d[i*4],d[i*4+1],d[i*4+2])<150;
   for(let i=0;i<w*h;i++){if(seen[i]||!ink(i))continue;const q=[i];seen[i]=1;let l=w,t=h,r=0,b=0;for(let n=0;n<q.length;n++){const p=q[n],x=p%w,y=Math.floor(p/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!seen[j]&&ink(j)){seen[j]=1;q.push(j);}}}if(b-t>font*1.25&&b-t<font*4&&r-l>font*.65&&r-l<font*3)components.push({l,t,r,b});}
   if(!surfaceMasks)surfaceMasks=['basic','required','prohibited'].map(kind=>{const c=surfaceTemplate(kind),g=c.getContext('2d'),trim=make(43,57);trim.getContext('2d').drawImage(c,2,3,43,57,0,0,43,57);return{kind,mask:surfaceMask(trim)};});
   const near=(mask,x,y)=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<32&&y+dy>=0&&y+dy<40&&mask[(y+dy)*32+x+dx])return true;return false;};
   for(const c of components){const x=local.x+c.l,y=local.y+c.t,cw=c.r-c.l+1,ch=c.b-c.t+1;if(x+cw>word.x*W+font*.65||word.x*W-x-cw>font*1.6||Math.abs((y+ch*.45)-(word.y*H+font*.5))>font*1.8)continue;
     const isolated=make(cw,ch);isolated.getContext('2d').drawImage(local.canvas,c.l,c.t,cw,ch,0,0,cw,ch);const mask=surfaceMask(isolated);
     const scores=surfaceMasks.map(t=>{let a=0,b=0,na=0,nb=0;for(let i=0;i<1280;i++){if(mask[i]){na++;if(near(t.mask,i%32,Math.floor(i/32)))a++;}if(t.mask[i]){nb++;if(near(mask,i%32,Math.floor(i/32)))b++;}}return{kind:t.kind,score:Math.min(a/na,b/nb)};}).sort((a,b)=>b.score-a.score);
     if(scores[0].score<.91||scores[0].score-scores[1].score<.025)continue;
     const left=Math.min(word.x,x/W),top=Math.min(word.y,y/H),right=Math.max(word.x+word.w,(x+cw)/W),bottom=Math.max(word.y+word.h,(y+ch)/H);
     return{...word,x:left,y:top,w:right-left,h:bottom-top,text:'SURFACE['+scores[0].kind+'] '+word.text,originalText:word.text,visualSurface:true,retainBounds:true,confidence:Math.min(word.confidence||85,85),source:(word.source||'OCR')+' · Yüzey sembolü adayı (doğrulayın)'};
   }return null;
 }
 async function enrich(image,sources,{read,shouldCancel=()=>false,onProgress=()=>{}}={}){
   const recovered=[];
   for(let i=0;i<sources.length;i++){
     if(shouldCancel())return recovered;
     if(i%25===0){onProgress('Çap sembolleri doğrulanıyor');await new Promise(resolve=>setTimeout(resolve,0));}
     const word=sources[i];if(word.w>0&&word.h>0){const finish=surface(image,word);if(finish){recovered.push(finish);continue;}const found=diameter(image,word);if(found)recovered.push(found);}
   }
   const seeds=frameSeeds(image);
   for(let i=0;i<seeds.length;i++){
     if(shouldCancel())break;onProgress(`GD&T çerçeveleri okunuyor · ${i+1}/${seeds.length}`);await new Promise(resolve=>setTimeout(resolve,0));
     const local=crop(image,seeds[i]),frame=root.ASMachGdtVision.findFrame(local.canvas,{cx:local.canvas.width/2,cy:local.canvas.height/2,w:local.canvas.width,h:local.canvas.height},{requireSymbol:true});if(!frame)continue;
     const snapshot=root.ASMachSnapshots._test.extract(local.canvas,frame.rect),symbol=root.ASMachGdtVision.classify(root.ASMachGdtVision._test.crop(snapshot,frame.cells[0],Math.max(3,frame.cells[0].h*.07)));
     if(symbol.subtype==='unknown'||symbol.confidence<88)continue; // Closed dimension boxes and title-block cells are not GD&T.
     const result=await root.ASMachGdtVision.recognize(snapshot.toDataURL(),read);if(!result||shouldCancel())continue;
     const points=root.ASMachSnapshots._test.corners(frame.rect).map(p=>({x:(local.x+p.x)/local.W,y:(local.y+p.y)/local.H})),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
     const sourceTextHeight=root.ASMachGdtVision.textHeight(snapshot,frame.cells);
     recovered.push({x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y,points,readingAngle:frame.rect.angle,text:result.text,confidence:result.confidence,source:result.source,visualGdt:true,sourceTextHeight:Number.isFinite(sourceTextHeight)?sourceTextHeight:null,snapshot:snapshot.toDataURL()});
   }return recovered;
 }
 root.ASMachAutomaticSymbols={enrich,diameter,frameSeeds,surface,_test:{surfaceTemplate}};
})(window);
