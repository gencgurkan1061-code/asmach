/* Local geometry only: a bounded seed excludes neighbouring dimensions. No source pixels are modified. */
(function(root){
  'use strict';
  const norm=a=>((a+540)%360)-180;
  function detect(source,seed,options={}){
    const frame=!options.lockAngle&&root.ASMachGdtVision?.findFrame(source,seed,options);
    if(frame)return frame;
    const scale=Math.min(1,1000/Math.max(source.width,source.height)),work=document.createElement('canvas');
    work.width=Math.max(1,Math.round(source.width*scale));work.height=Math.max(1,Math.round(source.height*scale));
    const ctx=work.getContext('2d');ctx.drawImage(source,0,0,work.width,work.height);
    const w=work.width,h=work.height,data=ctx.getImageData(0,0,w,h).data,seen=new Uint8Array(w*h);let parts=[];
    const b={x:(seed.cx-seed.w/2)*scale,y:(seed.cy-seed.h/2)*scale,w:seed.w*scale,h:seed.h*scale};
    const dark=i=>data[4*i+3]>128&&data[4*i]*.299+data[4*i+1]*.587+data[4*i+2]*.114<155;
    for(let i=0;i<w*h;i++){
      if(seen[i]||!dark(i))continue;seen[i]=1;const pixels=[i];let x0=w,y0=h,x1=0,y1=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
      for(let q=0;q<pixels.length;q++){const p=pixels[q],x=p%w,y=Math.floor(p/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!seen[j]&&dark(j)){seen[j]=1;pixels.push(j);}}
      }
      const n=pixels.length,cx=sx/n,cy=sy/n,pw=x1-x0+1,ph=y1-y0+1;
      if(n<2||cx<b.x||cx>b.x+b.w||cy<b.y||cy>b.y+b.h)continue;
      const xx=sxx/n-cx*cx,yy=syy/n-cy*cy,xy=sxy/n-cx*cy,disc=Math.hypot(xx-yy,2*xy),major=(xx+yy+disc)/2,minor=(xx+yy-disc)/2;
      if(pw>Math.max(b.w*1.4,20)||ph>Math.max(b.h*1.4,20))continue;
      parts.push({pixels,cx,cy,n,w:pw,h:ph,x:x0,y:y0,major,minor});
    }
    // Compare line length with local glyphs too: a narrow digit 1 must not be
    // discarded as a construction line merely because the user selected tightly.
    const glyphScales=parts.filter(p=>p.n>=8&&p.minor>p.major*.06).map(p=>p.major).sort((a,b)=>a-b);
    const reference=glyphScales.length?glyphScales[Math.floor(glyphScales.length/2)]:0;
    const lineScale=reference?Math.max(Math.pow(Math.max(b.w,b.h)*.06,2),reference*2.4):Math.pow(Math.max(b.w,b.h)*.12,2);
    parts=parts.filter(p=>!(p.major>lineScale&&p.minor<Math.max(1,p.major*.035)));
    const largest=parts.reduce((max,p)=>Math.max(max,p.n),0);
    const usable=parts.filter(p=>p.n>=Math.max(4,largest*.35));
    if(!parts.length)return {rect:{...seed},confident:false,reason:'Sınırlar belirsiz; seçiminiz korundu'};
    let angle=Number.isFinite(options.angleHint)?options.angleHint:null,confidence=angle!==null,pixelAngle=null,elongation=0;
    // Small superscripts/subscripts shift the whole-text centroid diagonally.
    // Infer the baseline from similarly sized nominal glyphs, but retain all
    // tolerance glyphs for the final bounds below.
    const nominal=usable.filter(p=>p.n>=largest*.65);
    const axisParts=nominal.length>=3?nominal:usable;
    if(axisParts.length>=2){
      const total=axisParts.length,cx=axisParts.reduce((n,p)=>n+p.cx,0)/total,cy=axisParts.reduce((n,p)=>n+p.cy,0)/total;
      let xx=0,yy=0,xy=0;for(const p of axisParts){xx+=(p.cx-cx)**2;yy+=(p.cy-cy)**2;xy+=(p.cx-cx)*(p.cy-cy);}
      const d=Math.hypot(xx-yy,2*xy);elongation=(xx+yy+d)/Math.max(1,xx+yy-d);
      if(elongation>7)pixelAngle=.5*Math.atan2(2*xy,xx-yy)*180/Math.PI;
    }
    // Ink mass is not a baseline: a narrow 1 can weigh less than a superscript
    // 0. Use the geometric centres of full-height glyphs instead. Iterate in
    // text coordinates so this also works on oblique and vertical dimensions.
    let alignedGlyphs=0;
    if(!options.lockAngle&&pixelAngle!==null){
      for(let iteration=0;iteration<3;iteration++){
        const a=pixelAngle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
        const projected=parts.filter(p=>p.n>=Math.max(8,largest*.12)).map(p=>{
          let l=Infinity,r=-Infinity,t=Infinity,bottom=-Infinity;
          for(const i of p.pixels){const x=i%w+.5,y=Math.floor(i/w)+.5,u=x*c+y*s,v=-x*s+y*c;l=Math.min(l,u);r=Math.max(r,u);t=Math.min(t,v);bottom=Math.max(bottom,v);}
          return{u:(l+r)/2,v:(t+bottom)/2,h:bottom-t+1,w:r-l+1};
        });
        const height=Math.max(0,...projected.map(p=>p.h));
        const line=projected.filter(p=>p.h>=height*.78&&p.w<height*1.8);
        if(line.length<2)break;
        const u=line.reduce((n,p)=>n+p.u,0)/line.length,v=line.reduce((n,p)=>n+p.v,0)/line.length;
        let xx=0,yy=0,xy=0;for(const p of line){xx+=(p.u-u)**2;yy+=(p.v-v)**2;xy+=(p.u-u)*(p.v-v);}
        if(xx<height*height*.15||yy>xx*.12)break;
        const correction=Math.atan2(xy,xx)*180/Math.PI;
        if(Math.abs(correction)>20)break;
        pixelAngle+=correction;alignedGlyphs=line.length;
      }
    }
    let correctedHint=false;
    if(pixelAngle!==null){
      // PDF layers and OCR rotation report coordinate axes, not always the actual
      // baseline. Preserve their reading polarity but verify the axis in pixels.
      const difference=angle===null?0:Math.abs(((pixelAngle-angle+270)%180)-90);
      if(!options.lockAngle&&(angle===null||(difference>12&&elongation>12)||(alignedGlyphs>=3&&difference>2.5))){
        if(angle!==null){pixelAngle+=Math.round((angle-pixelAngle)/180)*180;correctedHint=true;}
        angle=pixelAngle;confidence=true;
      }
    }
    if(!confidence)return {rect:{...seed},confident:false,reason:'Yön belirsiz; seçiminiz korundu'};
    if(!Number.isFinite(options.angleHint)&&Math.abs(Math.abs(angle)-90)<3)angle=-90;
    if(!Number.isFinite(options.angleHint)&&Math.abs(angle)<2)angle=0;
    angle=norm(angle);const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);let l=Infinity,t=Infinity,right=-Infinity,bottom=-Infinity;
    // Tiny border remnants are not decimal points; keep small punctuation inside
    // the seed and all normal-sized glyphs (including stacked tolerances).
    // Work in the text coordinate system. Nearby dimension lines and border
    // fragments must not inflate an angled text box's height.
    const projected=parts.map(p=>{let lo=Infinity,hi=-Infinity,top=Infinity,bot=-Infinity;for(const i of p.pixels){const x=i%w+.5,y=Math.floor(i/w)+.5,u=x*c+y*s,v=-x*s+y*c;lo=Math.min(lo,u);hi=Math.max(hi,u);top=Math.min(top,v);bot=Math.max(bot,v);}return{p,lo,hi,top,bot};});
    const glyphs=projected.filter(q=>q.p.n>=8&&q.p.minor>q.p.major*.06);
    const median=values=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
    const glyphHeight=glyphs.length?median(glyphs.map(q=>q.bot-q.top+1)):0;
    const baseline=glyphs.length?median(glyphs.map(q=>(q.top+q.bot)/2)):0;
    const retained=projected.filter(q=>{
      const p=q.p;
      if(!(p.n>=Math.max(4,largest*.025)||!(p.x<=0||p.y<=0||p.x+p.w>=w||p.y+p.h>=h)))return false;
      if(glyphs.length>=3&&glyphHeight>2){
        const longLine=(q.hi-q.lo)>glyphHeight*3&&(q.bot-q.top)<Math.max(2,glyphHeight*.13);
        const detached=q.bot<baseline-glyphHeight*1.6||q.top>baseline+glyphHeight*1.6;
        if(longLine||detached)return false;
      }
      return true;
    }).map(q=>q.p);
    const glyphHeights=[];
    for(const p of retained){let glyphTop=Infinity,glyphBottom=-Infinity;for(const i of p.pixels){const x=i%w+.5,y=Math.floor(i/w)+.5,u=x*c+y*s,v=-x*s+y*c;l=Math.min(l,u);right=Math.max(right,u);t=Math.min(t,v);bottom=Math.max(bottom,v);glyphTop=Math.min(glyphTop,v);glyphBottom=Math.max(glyphBottom,v);}if(Number.isFinite(glyphTop)&&glyphBottom-glyphTop>=1)glyphHeights.push((glyphBottom-glyphTop+1)/scale);}
    glyphHeights.sort((a,b)=>a-b);const largestGlyph=glyphHeights.at(-1)||0,nominalGlyphs=glyphHeights.filter(value=>value>=largestGlyph*.72),textHeight=nominalGlyphs.length?median(nominalGlyphs):0;
    const requestedPadding=Number(options.padding),pad=Number.isFinite(requestedPadding)?Math.max(0,Math.min(200,requestedPadding)):4;l-=pad;right+=pad;t-=pad;bottom+=pad;
    const u=(l+right)/2,v=(t+bottom)/2,rect={cx:(u*c-v*s)/scale,cy:(u*s+v*c)/scale,w:(right-l)/scale,h:(bottom-t)/scale,angle};
    return {rect,textHeight,confident:true,reason:correctedHint?'Yazının gerçek eğimi ve sınırları düzeltildi':Number.isFinite(options.angleHint)?'Yazı yönü, karakter boyu ve sınırları algılandı':'Karakter hizası, yazı boyu ve sınırları algılandı'};
  }
  async function inspect(snapshot,initialRect,options={}){
    const image=new Image();image.src=snapshot;await image.decode();const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;source.getContext('2d').drawImage(image,0,0);
    const b=initialRect,seed={cx:(b.x+b.w/2)*source.width,cy:(b.y+b.h/2)*source.height,w:b.w*source.width,h:b.h*source.height,angle:0};
    const paddingRatio=Number(options.paddingRatio),localOptions={...options,...(Number.isFinite(paddingRatio)?{padding:paddingRatio*source.width}:{})};
    const detected=detect(source,seed,localOptions),rect=root.ASMachSnapshots._test.constrain(detected.rect,source.width,source.height);
    return {...detected,rect,sourceWidth:source.width,sourceHeight:source.height,snapshot:root.ASMachSnapshots._test.extract(source,rect).toDataURL('image/png')};
  }
  root.ASMachAutoSelection={detect,inspect};
})(window);
