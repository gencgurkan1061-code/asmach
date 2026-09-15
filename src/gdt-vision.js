/* Feature-control-frame geometry and conservative, cell-local symbol matching.
   Shapes follow the catalog already used by the manual GD&T selector. */
(function(root){
  'use strict';
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;};
  function binary(source,threshold=155){const {width:w,height:h}=source,d=source.getContext('2d').getImageData(0,0,w,h).data,b=new Uint8Array(w*h);for(let i=0;i<b.length;i++)b[i]=d[i*4+3]>128&&d[i*4]*.299+d[i*4+1]*.587+d[i*4+2]*.114<threshold?1:0;return b;}
  function axisFrame(source,seed){
    const w=source.width,h=source.height,b=binary(source,210),runs=[],minWidth=Math.max(28,seed.w*.55);
    for(let y=Math.max(0,Math.floor(seed.cy-seed.h));y<Math.min(h,seed.cy+seed.h);y++){
      let start=-1,last=-1;
      for(let x=Math.max(0,Math.floor(seed.cx-seed.w));x<=Math.min(w-1,seed.cx+seed.w);x++){
        if(b[y*w+x]||(y>0&&b[(y-1)*w+x])||(y<h-1&&b[(y+1)*w+x])){if(start<0)start=x;last=x;}
        if((x-last>2||x===w-1)&&start>=0){if(last-start>=minWidth)runs.push({y,l:start,r:last});start=-1;}
      }
      if(start>=0&&last-start>=minWidth)runs.push({y,l:start,r:last});
    }
    if(runs.length>240)return null;
    const coverage=(x,t,bot)=>{let n=0;for(let y=t;y<=bot;y++)n+=(b[y*w+x]||(x>0&&b[y*w+x-1])||(x<w-1&&b[y*w+x+1]))?1:0;return n/(bot-t+1);};
    const candidates=[];
    for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){
      const top=runs[i],bottom=runs[j],height=bottom.y-top.y;
      if(height<14||height>seed.h*1.8)continue;
      const l=Math.max(top.l,bottom.l),r=Math.min(top.r,bottom.r),width=r-l;
      if(width<height*1.6||width>height*12)continue;
      if(seed.cx<l-3||seed.cx>r+3||seed.cy<top.y-3||seed.cy>bottom.y+3)continue;
      const vertical=[];
      // A divider reaches both frame edges. A position cross may span most
      // of the height, but its stem stops short of the upper/lower borders.
      const edgeBand=Math.max(4,Math.floor(height*.22)),edgeInset=Math.max(2,Math.floor(height*.05));
      for(let x=l-2;x<=r+2;x++)if(x>=0&&x<w&&coverage(x,top.y,bottom.y)>.82&&coverage(x,top.y+edgeInset,top.y+edgeBand)>.8&&coverage(x,bottom.y-edgeBand,bottom.y-edgeInset)>.8){if(!vertical.length||x-vertical.at(-1).end>2)vertical.push({start:x,end:x});else vertical.at(-1).end=x;}
      const xs=vertical.map(v=>(v.start+v.end)/2);
      if(xs.length<3||Math.abs(xs[0]-l)>4||Math.abs(xs.at(-1)-r)>4)continue;
      const first=xs[1]-xs[0];if(first<height*.55||first>height*1.7)continue;
      const overlap=Math.max(0,Math.min(r,seed.cx+seed.w/2)-Math.max(l,seed.cx-seed.w/2))*Math.max(0,Math.min(bottom.y,seed.cy+seed.h/2)-Math.max(top.y,seed.cy-seed.h/2));
      if(overlap/(seed.area||seed.w*seed.h)<.18)continue;
      candidates.push({l:xs[0],r:xs.at(-1),t:top.y,b:bottom.y,xs,score:overlap/(width*height)-Math.abs((top.y+bottom.y)/2-seed.cy)/seed.h});
    }
    return candidates.sort((a,b)=>b.score-a.score)[0]||null;
  }
  function findFrame(source,seed,options={}){
    const k=Math.min(1,800/Math.max(source.width,source.height)),scaled=canvas(source.width*k,source.height*k);scaled.getContext('2d').drawImage(source,0,0,scaled.width,scaled.height);
    const angles=[...new Set([Number.isFinite(options.angleHint)?options.angleHint:0,0,-90,90])];
    for(const angle of angles){
      const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),rw=Math.ceil(scaled.width*Math.abs(c)+scaled.height*Math.abs(s)),rh=Math.ceil(scaled.width*Math.abs(s)+scaled.height*Math.abs(c));
      const work=canvas(rw,rh),g=work.getContext('2d');g.fillStyle='white';g.fillRect(0,0,rw,rh);g.translate(rw/2,rh/2);g.rotate(-a);g.drawImage(scaled,-scaled.width/2,-scaled.height/2);
      const sx=seed.cx*k-scaled.width/2,sy=seed.cy*k-scaled.height/2,local={cx:rw/2+c*sx+s*sy,cy:rh/2-s*sx+c*sy,w:k*(Math.abs(c)*seed.w+Math.abs(s)*seed.h),h:k*(Math.abs(s)*seed.w+Math.abs(c)*seed.h),area:seed.w*seed.h*k*k};
      const f=axisFrame(work,local);if(!f)continue;
      const x=(f.l+f.r)/2-rw/2,y=(f.t+f.b)/2-rh/2,pad=3;
      const rect={cx:(c*x-s*y+scaled.width/2)/k,cy:(s*x+c*y+scaled.height/2)/k,w:(f.r-f.l+pad*2)/k,h:(f.b-f.t+pad*2)/k,angle};
      const cells=f.xs.slice(0,-1).map((left,i)=>({x:(left-f.l+pad)/k,y:pad/k,w:(f.xs[i+1]-left)/k,h:(f.b-f.t)/k}));
      if(options.requireSymbol){const framed=root.ASMachSnapshots._test.extract(source,rect);if(classify(crop(framed,cells[0],Math.max(3,cells[0].h*.07))).subtype==='unknown')continue;}
      const frameImage=crop(work,{x:f.l-pad,y:f.t-pad,w:f.r-f.l+pad*2,h:f.b-f.t+pad*2}),scaledCells=f.xs.slice(0,-1).map((left,i)=>({x:left-f.l+pad,y:pad,w:f.xs[i+1]-left,h:f.b-f.t})),textHeight=technicalTextHeight(frameImage,scaledCells);
      return {rect,cells,textHeight:Number.isFinite(textHeight)?textHeight/k:null,sourceWidth:source.width,sourceHeight:source.height,confident:true,frame:true,reason:'GD&T dış çerçevesi, hücre sınırları ve teknik yazı boyu algılandı'};
    }
    return null;
  }
  function crop(source,r,inset=0){const out=canvas(r.w-2*inset,r.h-2*inset);out.getContext('2d').drawImage(source,r.x+inset,r.y+inset,r.w-2*inset,r.h-2*inset,0,0,out.width,out.height);return out;}
  function technicalTextHeight(source,cells){
    const heights=[];
    for(const cell of (cells||[]).slice(1)){
      const inset=Math.max(3,Math.min(cell.w,cell.h)*.08),sample=crop(source,cell,inset),mask=binary(sample,205),minimum=Math.max(1,Math.floor(sample.width*.012));let top=sample.height,bottom=-1;
      for(let y=0;y<sample.height;y++){let ink=0;for(let x=0;x<sample.width;x++)ink+=mask[y*sample.width+x];if(ink>=minimum){top=Math.min(top,y);bottom=Math.max(bottom,y);}}
      const height=bottom-top+1;if(height>=sample.height*.18&&height<=sample.height*.92)heights.push(height);
    }
    if(!heights.length)return null;heights.sort((a,b)=>a-b);return heights[Math.floor((heights.length-1)/2)];
  }
  function normalized(source){
    const b=binary(source);let l=source.width,r=-1,t=source.height,bot=-1;
    for(let i=0;i<b.length;i++)if(b[i]){const x=i%source.width,y=Math.floor(i/source.width);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);bot=Math.max(bot,y);}
    if(r<l||bot<t)return null;
    const out=canvas(48,48),g=out.getContext('2d');g.fillStyle='white';g.fillRect(0,0,48,48);const k=40/Math.max(r-l+1,bot-t+1),w=(r-l+1)*k,h=(bot-t+1)*k;g.drawImage(source,l,t,r-l+1,bot-t+1,(48-w)/2,(48-h)/2,w,h);return binary(out);
  }
  const templates=[];
  function symbolTemplate(type,variant=0,size=64){
    const out=canvas(size,size),g=out.getContext('2d');g.scale(size/64,size/64);g.fillStyle='white';g.fillRect(0,0,64,64);g.strokeStyle='black';g.lineWidth=2;g.lineCap='butt';
    const line=(x,y,x2,y2)=>{g.beginPath();g.moveTo(x,y);g.lineTo(x2,y2);g.stroke();},circle=r=>{g.beginPath();g.arc(32,32,r,0,Math.PI*2);g.stroke();};
    if(type==='cylindricity'){circle(12);const shift=variant?17:12;line(12,55,12+shift,9);line(40,55,40+shift,9);}
    if(type==='circularity')circle(20);
    if(type==='concentricity'){circle(21);circle(12);}
    if(type==='position'){g.lineWidth=[2,3,4][Math.floor(variant/4)%3];circle([14,17,20,23][variant%4]);line(4,32,60,32);line(32,4,32,60);}
    if(type==='parallelism'){line(14,54,30,10);line(34,54,50,10);}
    if(type==='perpendicularity'){line(9,53,55,53);line(32,10,32,53);}
    if(type==='flatness'){g.beginPath();g.moveTo(8,46);g.lineTo(21,18);g.lineTo(56,18);g.lineTo(43,46);g.closePath();g.stroke();}
    if(type==='angularity'){line(7,53,57,53);line(7,53,43,12);}
    if(type==='straightness')line(7,32,57,32);
    if(type==='symmetry'){line(5,32,59,32);line(13,20,51,20);line(13,44,51,44);}
    if(type==='profile'||type==='profile_surface'){g.beginPath();g.arc(32,42,22,Math.PI,Math.PI*2);g.stroke();if(type==='profile_surface')line(6,48,58,48);}
    if(type==='runout'||type==='total_runout'){
      const arrow=(dx)=>{line(12+dx,54,42+dx,12);line(42+dx,12,28+dx,18);line(42+dx,12,41+dx,28);};
      arrow(type==='total_runout'?-7:0);if(type==='total_runout')arrow(8);
    }
    return out;
  }
  function distances(mask){const d=new Float32Array(mask.length).fill(100);for(let i=0;i<d.length;i++)if(mask[i])d[i]=0;for(let y=0;y<48;y++)for(let x=0;x<48;x++){const i=y*48+x;if(x)d[i]=Math.min(d[i],d[i-1]+1);if(y)d[i]=Math.min(d[i],d[i-48]+1);if(x&&y)d[i]=Math.min(d[i],d[i-49]+1.414);}for(let y=47;y>=0;y--)for(let x=47;x>=0;x--){const i=y*48+x;if(x<47)d[i]=Math.min(d[i],d[i+1]+1);if(y<47)d[i]=Math.min(d[i],d[i+48]+1);if(x<47&&y<47)d[i]=Math.min(d[i],d[i+49]+1.414);}return d;}
  function classify(source){
    const mask=normalized(source);if(!mask)return {subtype:'unknown',confidence:0};
    if(!templates.length)for(const type of ['cylindricity','circularity','concentricity','position','parallelism','perpendicularity','flatness','angularity','straightness','symmetry','profile','profile_surface','runout','total_runout'])for(let v=0;v<(type==='position'?12:type==='cylindricity'?2:1);v++){const bits=normalized(symbolTemplate(type,v));templates.push({type,bits,d:distances(bits)});}
    const d=distances(mask),mean=(a,b)=>{let n=0,total=0;for(let i=0;i<a.length;i++)if(a[i]){n++;total+=b[i];}return total/Math.max(1,n);};
    const ranked=templates.map(t=>({type:t.type,score:(mean(mask,t.d)+mean(t.bits,d))/2})).sort((a,b)=>a.score-b.score),best=ranked[0],next=ranked.find(t=>t.type!==best.type);
    const accepted=best.score<1.65&&next.score-best.score>.28;
    return {subtype:accepted?best.type:'unknown',confidence:accepted?Math.round(95-best.score*12):0,score:best.score,margin:next.score-best.score};
  }
  async function load(snapshot){const image=new Image();image.src=snapshot;await image.decode();const source=canvas(image.naturalWidth,image.naturalHeight);source.getContext('2d').drawImage(image,0,0);return source;}
  function zonePrefix(source){
    const diameter=root.ASMachDiameterVision?.detect(source);if(diameter?.diameter&&diameter.box.x<.25){const start=Math.ceil((diameter.box.x+diameter.box.w)*source.width)+1;if(start<source.width)return {prefix:'Ø',image:crop(source,{x:start,y:0,w:source.width-start,h:source.height})};}
    // Read the leading ± graphically, before OCR can mistake it for 2 or 1.
    const mask=binary(source),w=source.width,h=source.height,columns=[];
    for(let x=0;x<w;x++){let n=0;for(let y=0;y<h;y++)n+=mask[y*w+x];columns.push(n);}
    const left=columns.findIndex(n=>n>0);if(left<0)return null;
    let right=left;while(right+1<w&&columns[right+1]>0)right++;
    if(right-left<4||right>w*.45)return null;
    const glyph=crop(source,{x:left,y:0,w:right-left+1,h}),bits=normalized(glyph);if(!bits)return null;
    // In a zone cell Ø often becomes 3/0 in OCR. Compare the isolated leading
    // glyph with slashed-circle templates, requiring separation from plain zero.
    const glyphDistances=distances(bits),metric=expected=>{const d=distances(expected);let sum=0,n=0,back=0,m=0;for(let i=0;i<bits.length;i++){if(bits[i]){sum+=d[i];n++;}if(expected[i]){back+=glyphDistances[i];m++;}}return(sum/Math.max(1,n)+back/Math.max(1,m))/2;};
    const glyphMask=text=>{const c=canvas(64,64),g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,64,64);g.fillStyle='black';g.font='48px Arial';g.textAlign='center';g.fillText(text,32,50);return normalized(c);};
    const zeroScore=Math.min(metric(glyphMask('0')),metric(normalized(symbolTemplate('circularity'))));
    const slash=canvas(64,64),sg=slash.getContext('2d');sg.fillStyle='white';sg.fillRect(0,0,64,64);sg.strokeStyle='black';sg.lineWidth=2;sg.beginPath();sg.arc(32,32,18,0,2*Math.PI);sg.moveTo(16,58);sg.lineTo(48,6);sg.stroke();
    const diameterScore=Math.min(metric(glyphMask('Ø')),metric(normalized(slash)));
    if(diameterScore<1.25&&zeroScore-diameterScore>.25){let start=right+1;while(start<w&&!columns[start])start++;if(start<w)return {prefix:'Ø',image:crop(source,{x:start,y:0,w:w-start,h})};}
    const template=canvas(64,64),g=template.getContext('2d');g.fillStyle='white';g.fillRect(0,0,64,64);g.strokeStyle='black';g.lineWidth=4;
    g.beginPath();g.moveTo(10,24);g.lineTo(54,24);g.moveTo(32,4);g.lineTo(32,44);g.moveTo(10,56);g.lineTo(54,56);g.stroke();
    const expected=normalized(template),a=distances(bits),b=distances(expected),mean=(m,d)=>{let n=0,sum=0;for(let i=0;i<m.length;i++)if(m[i]){n++;sum+=d[i];}return sum/Math.max(1,n);};
    if((mean(bits,b)+mean(expected,a))/2>1.15)return null;
    let start=right+1;while(start<w&&!columns[start])start++;if(start>=w)return null;
    return {prefix:'±',image:crop(source,{x:start,y:0,w:w-start,h})};
  }
  async function readCircledModifiers(source,read,role){
    const w=source.width,h=source.height,b=binary(source),seen=new Uint8Array(b.length),rings=[];
    for(let k=0;k<b.length;k++){if(!b[k]||seen[k])continue;const stack=[k];seen[k]=1;let l=w,r=0,t=h,bot=0;
      while(stack.length){const i=stack.pop(),x=i%w,y=Math.floor(i/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);bot=Math.max(bot,y);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*w+nx;if(nx>=0&&nx<w&&ny>=0&&ny<h&&b[j]&&!seen[j]){seen[j]=1;stack.push(j);}}}
      const rw=r-l+1,rh=bot-t+1;if(rw<9||rh<9||rw/rh<.75||rw/rh>1.3||rh>h*.95)continue;let hits=0;
      for(let a=0;a<32;a++){const angle=a*Math.PI/16,cx=(l+r)/2,cy=(t+bot)/2;let found=false;for(const scale of [.82,.9,1]){const x=Math.round(cx+Math.cos(angle)*(rw-1)*scale/2),y=Math.round(cy+Math.sin(angle)*(rh-1)*scale/2);if(b[y*w+x])found=true;}if(found)hits++;}if(hits>=27)rings.push({x:l,y:t,w:rw,h:rh});
    }
    if(!rings.length)return null;const clean=canvas(w,h);clean.getContext('2d').drawImage(source,0,0);const modifiers=[];
    for(const ring of rings.sort((a,b)=>a.x-b.x)){const inner=crop(source,ring,Math.max(2,ring.w*.22));if(binary(inner).reduce((n,v)=>n+v,0)<3)continue;const result=await read(inner.toDataURL('image/png'),{gdtCell:'modifier'}),letter=(result.text||'').trim().toUpperCase();const symbol={M:'Ⓜ',L:'Ⓛ',S:'Ⓢ',P:'Ⓟ',F:'Ⓕ',T:'Ⓣ'}[letter];if(!symbol)continue;modifiers.push(symbol);clean.getContext('2d').fillStyle='white';clean.getContext('2d').fillRect(ring.x-1,ring.y-1,ring.w+2,ring.h+2);}
    if(!modifiers.length)return null;const rest=await read(clean.toDataURL('image/png'),{gdtCell:role});return {...rest,text:(rest.text||'').trim()+modifiers.join(''),visualModifiers:true};
  }
  async function recognize(snapshot,read){
    const source=await load(snapshot),found=findFrame(source,{cx:source.width/2,cy:source.height/2,w:source.width,h:source.height});if(!found)return null;
    const framed=root.ASMachSnapshots._test.extract(source,found.rect),first=found.cells[0],inset=Math.max(3,first.h*.07),visual=classify(crop(framed,first,inset));
    const entry=root.ASMachRequirements.GDT_TYPES.find(t=>t.value===visual.subtype),texts=[],scores=[],warnings=[];
    for(const [index,cell] of found.cells.slice(1,5).entries()){
      let result;
      const cellImage=crop(framed,cell,Math.max(3,cell.h*.07)),prefix=index===0?zonePrefix(cellImage):null;
      try{result=await readCircledModifiers(prefix?.image||cellImage,read,index===0?'tolerance':'datum')||await read((prefix?.image||cellImage).toDataURL('image/png'),{gdtCell:index===0?'tolerance':'datum'});}
      catch(error){result={text:'',confidence:0,error:String(error?.message||error)};}
      let text=root.ASMachRequirements.normalize(result.text||'').trim();
      if(prefix&&text&&!text.startsWith(prefix.prefix))text=prefix.prefix+text;
      if(/[.,]/.test(text))text=text.replace(/(?<=\d)\s+(?=[\d.,])/g,'').replace(/\s*([.,])\s*/g,'$1');
      const valid=index===0?/^(?:Ø\s*)?(?:±\s*)?(?:\d+(?:[.,]\d+)?|[.,]\d+)\s*[ⓂⓁⓈⓅⒻⓉ]*$/.test(text):/^(?:[A-Z](?:\s*-\s*[A-Z])?[ⓂⓁⓈⓅⒻ]*|CZ|SZ|P\s*\d+(?:\.\d+)?)$/.test(text.toUpperCase());
      texts.push(valid?(index===0?text:text.toUpperCase().replace(/\s+/g,'')):'?');scores.push(valid?result.confidence||0:0);
      if(!valid)warnings.push(index===0?'Tolerans okunamadı; doğrulayın':`${index}. datum okunamadı; doğrulayın`);
      else if(result.needsReview)warnings.push(index===0?'Tolerans okumaları farklı; doğrulayın':`${index}. datum okumaları farklı; doğrulayın`);
    }
    // Each cell owns its value: a failed zone cannot erase or shift datum precedence.
    // Keep ± as source evidence so the parser warns instead of treating it as bilateral limits.
    const confidence=Math.min(visual.confidence||0,...scores),needsReview=!entry||warnings.length>0||confidence<85||texts.some(t=>t.includes('±'));
    return {text:`${entry?.symbol||'GD&T'} | ${texts.join(' | ')}`,confidence,needsReview:Boolean(needsReview),gdt:{subtype:entry?.value||'',name:entry?.name||'Sembol belirsiz',cells:[entry?.symbol||'?',...texts],warnings},source:`GD&T hücreleri · ${entry?entry.name:'Sembol belirsiz — tür seçin'}${warnings.length?' · '+warnings.join(' · '):''}`,visualGdt:true};
  }
  root.ASMachGdtVision={findFrame,classify,recognize,zonePrefix,textHeight:technicalTextHeight,_test:{symbolTemplate,crop,axisFrame,zonePrefix,readCircledModifiers,technicalTextHeight}};
})(window);
