/* Shared placement for the editor preview and final drawing. All geometry is in page pixels. */
(function(root){
  'use strict';
  // Explicit UI directions are page-relative, not relative to a rotated box edge.
  // Never silently substitute another direction for a user-selected position.
  function directed({points,width,height,size=46,shape='circle',gap=8,direction,occupied=[]}){
    const vector={left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1],'top-left':[-1,-1],'top-right':[1,-1],'bottom-left':[-1,1],'bottom-right':[1,1]}[direction];
    if(!vector||!points?.length)return null;
    const radius=Math.max(8,Number(size)/2),ry=shape==='hexagon'?radius*Math.sqrt(3)/2:radius;
    const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
    const [dx,dy]=vector;
    // Search farther out on the same ray when another visible balloon occupies it.
    for(let extra=0;extra<=Math.max(width,height);extra+=Math.max(4,radius/2)){
      const x=dx<0?left-radius-gap-extra:dx>0?right+radius+gap+extra:(left+right)/2;
      const y=dy<0?top-ry-gap-extra:dy>0?bottom+ry+gap+extra:(top+bottom)/2;
      if(x-radius<1||x+radius>width-1||y-ry<1||y+ry>height-1)return null;
      if(occupied.some(p=>Math.hypot(p.x-x,p.y-y)<radius+(p.radius||23)+4))continue;
      let anchor=null,distance=Infinity;
      points.forEach((a,i)=>{const b=points[(i+1)%points.length],vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*vx+(y-a.y)*vy)/(vx*vx+vy*vy||1))),p={x:a.x+t*vx,y:a.y+t*vy},dist=Math.hypot(x-p.x,y-p.y);if(dist<distance){distance=dist;anchor=p;}});
      return{x,y,anchor,radius};
    }return null;
  }
  function choose({points,width,height,size=46,shape='circle',gap=8,direction='left',occupied=[],ink,edgeFractions=[.5]}){
    const radius=Math.max(8,size/2),ry=shape==='hexagon'?radius*Math.sqrt(3)/2:radius;
    const desired={right:[1,0],left:[-1,0],top:[0,-1],bottom:[0,1],'top-left':[-1,-1],'top-right':[1,-1],'bottom-left':[-1,1],'bottom-right':[1,1]}[direction];
    if(desired?.every(v=>v!==0)){
      const anchor=points.reduce((a,b)=>a.x*desired[0]+a.y*desired[1]>b.x*desired[0]+b.y*desired[1]?a:b);
      const x=anchor.x+desired[0]*(radius+gap),y=anchor.y+desired[1]*(ry+gap);
      if(x-radius>=1&&y-ry>=1&&x+radius<=width-1&&y+ry<=height-1&&!occupied.some(p=>Math.hypot(p.x-x,p.y-y)<radius+(p.radius||23)+4))return{x,y,anchor,radius};
    }
    const candidates=points.flatMap((a,i)=>edgeFractions.map(fraction=>{
      const b=points[(i+1)%4],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=dy/len,ny=-dx/len;
      const extent=shape==='square'?radius*(Math.abs(nx)+Math.abs(ny)):shape==='hexagon'?Math.max(...Array.from({length:6},(_,j)=>radius*(Math.cos(j*Math.PI/3)*nx+Math.sin(j*Math.PI/3)*ny))):radius;
      const anchor={x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction},x=anchor.x+nx*(extent+gap),y=anchor.y+ny*(extent+gap);
      const inPage=x-radius>=1&&y-ry>=1&&x+radius<=width-1&&y+ry<=height-1;
      const overlaps=occupied.reduce((sum,p)=>sum+(Math.hypot(p.x-x,p.y-y)<radius+(p.radius||23)+4?1:0),0);
      const density=ink?ink(x-radius,y-ry,2*radius,2*ry):0;
      const preference=desired?-(nx*desired[0]+ny*desired[1])*1000:(nx>0?.0:.04);
      return{x,y,anchor,radius,edge:i,inPage,overlaps,score:overlaps*100+density*30+preference};
    })).filter(p=>p.inPage&&p.overlaps===0).sort((a,b)=>a.score-b.score);
    return candidates[0]||null;
  }
  function inkSampler(canvas){
    // Read a small page thumbnail once; candidate scoring remains cheap during dragging.
    const thumb=document.createElement('canvas'),scale=Math.min(1,900/Math.max(canvas.width,canvas.height));thumb.width=Math.max(1,Math.round(canvas.width*scale));thumb.height=Math.max(1,Math.round(canvas.height*scale));
    const ctx=thumb.getContext('2d');ctx.drawImage(canvas,0,0,thumb.width,thumb.height);const data=ctx.getImageData(0,0,thumb.width,thumb.height).data;
    return(x,y,w,h)=>{let n=0,dark=0;for(let j=Math.max(0,Math.floor(y*scale));j<Math.min(thumb.height,(y+h)*scale);j+=2)for(let i=Math.max(0,Math.floor(x*scale));i<Math.min(thumb.width,(x+w)*scale);i+=2){const p=(j*thumb.width+i)*4;n++;if(data[p+3]>128&&(data[p]+data[p+1]+data[p+2])/3<190)dark++;}return n?dark/n:0;};
  }
  function manual({points,width,height,size=46,shape='circle',position}){
    const radius=Math.max(8,size/2),margin=shape==='square'?radius*Math.SQRT2:radius;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    let x=clamp(position.x,margin+1,width-margin-1),y=clamp(position.y,margin+1,height-margin-1);
    let closest=null,inside=true;
    points.forEach((a,i)=>{const b=points[(i+1)%4],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,nx=dy/length,ny=-dx/length;
      if((x-a.x)*nx+(y-a.y)*ny>0)inside=false;
      const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(length*length),0,1),anchor={x:a.x+t*dx,y:a.y+t*dy},d=Math.hypot(x-anchor.x,y-anchor.y);
      if(!closest||d<closest.d)closest={anchor,d,nx,ny};
    });
    if(!closest)return null;
    if(inside||closest.d<margin+2){x=closest.anchor.x+closest.nx*(margin+2);y=closest.anchor.y+closest.ny*(margin+2);}
    if(x-radius<1||y-radius<1||x+radius>width-1||y+radius>height-1)return choose({points,width,height,size,shape});
    return{x,y,anchor:closest.anchor,radius};
  }
  function textGeometry(item,width,height){
    const b=item?.selectionBox;if(!b||!width||!height)return null;
    let angle=Number.isFinite(b.rotation)?b.rotation:null,thickness;
    if(b.points?.length===4){const p=b.points.map(p=>({x:p.x*width,y:p.y*height}));thickness=Math.hypot(p[2].x-p[1].x,p[2].y-p[1].y);if(angle===null)angle=Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x)*180/Math.PI;}
    else {thickness=Math.min(b.w*width,b.h*height);if(angle===null)angle=b.h*height>b.w*width*1.5?-90:0;}
    return {angle,thickness};
  }
  function nominalTextHeight(words,nominal,width,height){
    const target=String(nominal??'').replace(',','.').match(/\d+(?:\.\d+)?/)?.[0];
    if(!target||!(width>0&&height>0))return null;
    const matches=(Array.isArray(words)?words:[words]).filter(Boolean).map(word=>{
      const values=String(word.text??'').replace(/,/g,'.').match(/\d+(?:\.\d+)?/g)||[];
      if(!values.includes(target))return null;
      let angle=Number(word.angle??word.readingAngle??0);if(Math.abs(angle)<=Math.PI*2+.01)angle=angle*180/Math.PI;
      const vertical=Math.abs(((angle%180)+180)%180-90)<35;
      const pixels=vertical?Number(word.w)*width:Number(word.h)*height;
      return Number.isFinite(pixels)&&pixels>0?{pixels,score:(values[0]===target?100:0)-String(word.text??'').length}:null;
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
    return matches[0]?.pixels??null;
  }
  function defaultDirection(item){const app=root.ASMachApp,value=app?.state.metadata?.projectDefaults?.balloonPosition;
    if(value==='text-auto'){
      const canvas=app?.elements?.sourceCanvas,g=textGeometry(item||{selectionBox:app?.state.pendingRecognition?.box},canvas?.width||1,canvas?.height||1);
      const a=(g?.angle||0)*Math.PI/180,x=-Math.cos(a),y=-Math.sin(a);
      return Math.abs(x)>=Math.abs(y)?(x<0?'left':'right'):(y<0?'top':'bottom');
    }
    return ['left','right','top','bottom','top-left','top-right','bottom-left','bottom-right'].includes(value)?value:'left';
  }
  function applyVisibleHeight(item,textHeight){
    // The nominal glyph height controls the number font. The balloon diameter is
    // the smallest size that contains it; OCR box dimensions are not used.
    item.ocrAutoSized=true;
    item.ocrFontHeightCalibrated=true;
    const appearance=root.ASMachBalloonAppearance,a=appearance?.normalize(item)||item,sourceFont=appearance?.fontSizeForVisibleHeight('0',textHeight,a.fontWeight)||textHeight,matchedFont=sourceFont*(10/12);
    item.fontSize=Math.round(Math.max(6,Math.min(96,matchedFont)));
    const minimum=appearance?.minimumSize(item.number||'1',item.fontSize,item.shape,a.fontWeight,a.balloonLineWidth)||16;
    item.size=Math.round(Math.max(16,Math.min(160,minimum)));return item;
  }
  function autoStyle(item,width,height){
    const quick=item.newRecordAppearance||{};
    if(quick.size||quick.fontSize){Object.assign(item,quick);item.ocrAutoSized=false;return item;}
    if(root.ASMachApp?.state.metadata?.projectDefaults?.balloonSizeMode!=='ocr')return item;
    let textHeight=Number(item?.sourceTextHeight);if(!Number.isFinite(textHeight)||textHeight<=0)return item;
    // A glyph cannot be taller than its fitted source strip. This also repairs
    // older records whose PDF word height included the rotated word's length.
    const thickness=textGeometry(item,width,height)?.thickness;
    if(Number.isFinite(thickness)&&thickness>2&&textHeight>thickness*1.6){textHeight=thickness;item.sourceTextHeight=textHeight;}
    return applyVisibleHeight(item,textHeight);
  }
  function verifiedTextHeight(layerHeight,imageHeight){
    const valid=v=>Number.isFinite(v)&&v>0;
    // Trust the actual detected glyphs when the text-layer metrics are inflated.
    if(valid(imageHeight)&&(!valid(layerHeight)||layerHeight>imageHeight*1.6))return imageHeight;
    return valid(layerHeight)?layerHeight:valid(imageHeight)?imageHeight:null;
  }
  function applyNewDefaults(item){
    if(item.newRecordAppearance)return item;
    const source=root.ASMachApp?.state.metadata?.projectDefaults?.newRecordAppearance||{},p={};
    for(const [key,min,max] of [['size',16,160],['fontSize',6,96]])if(Number.isFinite(source[key]))p[key]=Math.max(min,Math.min(max,source[key]));
    if(typeof source.arrowEnabled==='boolean')p.arrowEnabled=source.arrowEnabled;
    if(['solid','none'].includes(source.boxLineStyle))p.boxLineStyle=source.boxLineStyle;
    item.newRecordAppearance=p;Object.assign(item,p);return item;
  }
  function stabilizeAutoStyles(records){
    const groups=new Map();
    for(const item of records||[]){const height=Number(item?.sourceTextHeight);if(!item?.ocrAutoSized||item.listOnly||!(height>0))continue;const key=`${item.page}|${item.type}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
    for(const items of groups.values()){
      if(items.length<2)continue;const values=items.map(item=>Number(item.sourceTextHeight)).sort((a,b)=>a-b),min=values[0],max=values.at(-1);
      if(max/min>1.6)continue;const middle=Math.floor(values.length/2),median=values.length%2?values[middle]:(values[middle-1]+values[middle])/2;
      for(const item of items)applyVisibleHeight(item,median);
      const commonSize=Math.max(...items.map(item=>Number(item.size)||16));for(const item of items)item.size=commonSize;
    }
    return records;
  }
  function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
  function shapeOffsets(r){const radius=Math.max(8,(Number(r.size)||46)/2),v=r.shape==='square'?[[-1,-1],[1,-1],[1,1],[-1,1]]:r.shape==='triangle'?[[0,-1],[1,1],[-1,1]]:r.shape==='diamond'?[[0,-1],[1,0],[0,1],[-1,0]]:r.shape==='hexagon'?Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3),Math.sin(i*Math.PI/3)]):null;return v?.map(([x,y])=>({x:x*radius,y:y*radius}));}
  function segmentGap(a,b,c,d){const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;return Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b));}
  function shapeGap(r,p,s,q){const av=shapeOffsets(r)?.map(v=>({x:p.x+v.x,y:p.y+v.y})),bv=shapeOffsets(s)?.map(v=>({x:q.x+v.x,y:q.y+v.y})),ar=Math.max(8,(Number(r.size)||46)/2),br=Math.max(8,(Number(s.size)||46)/2);if(!av&&!bv)return Math.hypot(p.x-q.x,p.y-q.y)-ar-br;if(!av)return polygonDistance(p,bv)-ar;if(!bv)return polygonDistance(q,av)-br;if(av.some(v=>polygonDistance(v,bv)===0)||bv.some(v=>polygonDistance(v,av)===0))return 0;let gap=Infinity;av.forEach((a,i)=>bv.forEach((b,j)=>{gap=Math.min(gap,segmentGap(a,av[(i+1)%av.length],b,bv[(j+1)%bv.length]));}));return gap;}
  function leaderGap(r,p,a,b){const vertices=shapeOffsets(r)?.map(v=>({x:p.x+v.x,y:p.y+v.y}));if(!vertices)return segmentDistance(p,a,b)-Math.max(8,(Number(r.size)||46)/2);if(polygonDistance(a,vertices)===0||polygonDistance(b,vertices)===0)return 0;return Math.min(...vertices.map((v,i)=>segmentGap(v,vertices[(i+1)%vertices.length],a,b)));}
  function polygonDistance(p,points){let inside=false,min=Infinity;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;min=Math.min(min,segmentDistance(p,a,b));}return inside?0:min;}
  function nearestAnchor(p,points,fallback){if(!points?.length)return fallback;let best,d=Infinity;points.forEach((a,i)=>{const b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),v={x:a.x+t*dx,y:a.y+t*dy},dist=Math.hypot(p.x-v.x,p.y-v.y);if(dist<d){best=v;d=dist;}});return best;}
  // Only balloons move. Source boxes retain their exact OCR coordinates; box/box
  // overlap and leader/leader intersections are deliberately not collisions.
  function boxVisible(r){return !!r.selectionBox&&r.boxLineStyle!=='none'&&(r.opacity??1)>0&&(r.boxOpacity??1)>0;}
  function selectionGuide(r,width,height){const b=r.selectionBox;if(!b)return '';const points=b.points?.length===4?b.points:[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}];return '<polygon class="selection-box-guide" points="'+points.map(p=>Number(p.x)*width+','+Number(p.y)*height).join(' ')+'" fill="none" stroke="#008b9b" stroke-width="1.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" pointer-events="none" />';}
  function leaderVisible(r){return r.arrowEnabled!==false&&(r.opacity??1)>0&&(r.leaderOpacity??1)>0;}
  // Minimum separating translation, using the real balloon shape, not its bounding circle.
  function outsideBox(r,p,points,box=r){
    if(!points.length)return p;
    const radius=Math.max(8,(Number(r.size)||46)/2),shape=r.shape;
    const offsets=shapeOffsets(r),axes=[];
    const edges=list=>list.forEach((a,i)=>{const b=list[(i+1)%list.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len)axes.push({x:-dy/len,y:dx/len});});edges(points);if(offsets)edges(offsets);else for(const q of points){const dx=p.x-q.x,dy=p.y-q.y,len=Math.hypot(dx,dy);if(len)axes.push({x:dx/len,y:dy/len});}
    const margin=(Number(r.balloonLineWidth)||2)/2+(boxVisible(box)?(Number(box.boxLineWidth)||1.5)/2:0)+(leaderVisible(r)?1:0);
    let best=null,length=Infinity;
    for(const a of axes){const values=points.map(q=>q.x*a.x+q.y*a.y),lo=Math.min(...values),hi=Math.max(...values),center=p.x*a.x+p.y*a.y,ext=offsets?.map(q=>q.x*a.x+q.y*a.y),min=center+(ext?Math.min(...ext):-radius)-margin,max=center+(ext?Math.max(...ext):radius)+margin;
      if(max<=lo+1e-7||min>=hi-1e-7)return p;
      const delta=lo-max>min-hi?lo-max:hi-min;
      if(Math.abs(delta)<length){length=Math.abs(delta);best={x:p.x+a.x*delta,y:p.y+a.y*delta};}
    }return best||p;
  }
  function constrainBox(r,width,height){const b=r.selectionBox;if(!b||!width||!height)return;const points=(b.points?.length===4?b.points:[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}]).map(q=>({x:q.x*width,y:q.y*height}));const p=outsideBox(r,{x:r.bubbleX*width,y:r.bubbleY*height},points);r.bubbleX=p.x/width;r.bubbleY=p.y/height;}
  function resolveCollisions(records,width,height,{maxCandidates=12000}={}){
    if(!(width>0&&height>0))return{moved:0,unresolved:0};
    const nodes=records.filter(r=>!r.listOnly&&Number.isFinite(r.bubbleX)&&Number.isFinite(r.bubbleY)).map(r=>{const b=r.selectionBox,points=b?(b.points?.length===4?b.points:[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}]).map(p=>({x:p.x*width,y:p.y*height})):[];return{r,p:{x:r.bubbleX*width,y:r.bubbleY*height},radius:Math.max(8,(Number(r.size)||46)/2)+((Number(r.balloonLineWidth)||2)/2),points,padding:Number(r.boxPadding)||0,anchor:{x:r.anchorX*width,y:r.anchorY*height}};});
    const anchor=n=>nearestAnchor(n.p,n.points,n.anchor),gap=1;
    const blocked=(n,p)=>{if(p.x<n.radius+1||p.y<n.radius+1||p.x>width-n.radius-1||p.y>height-n.radius-1)return true;const a=nearestAnchor(p,n.points,n.anchor);for(const o of nodes){if(o.points.length){const clear=outsideBox(n.r,p,o.points,o.r);if(Math.hypot(clear.x-p.x,clear.y-p.y)>1e-6)return true;}if(o===n)continue;if(shapeGap(n.r,p,o.r,o.p)<((Number(n.r.balloonLineWidth)||2)+(Number(o.r.balloonLineWidth)||2))/2+gap-1e-7)return true;if(leaderVisible(o.r)&&leaderGap(n.r,p,anchor(o),o.p)<((Number(n.r.balloonLineWidth)||2)+(Number(o.r.leaderLineWidth)||1.5))/2+gap-1e-7)return true;if(leaderVisible(n.r)&&leaderGap(o.r,o.p,a,p)<((Number(o.r.balloonLineWidth)||2)+(Number(n.r.leaderLineWidth)||1.5))/2+gap-1e-7)return true;}return false;};
    let moved=0;
    for(const n of nodes){if(!blocked(n,n.p))continue;const start={...n.p},step=3;let found=null,tried=0;const tangent=outsideBox(n.r,start,n.points);if(!blocked(n,tangent))found=tangent;for(let distance=step;distance<Math.hypot(width,height)&&!found&&tried<maxCandidates;distance+=step){const samples=Math.max(12,Math.ceil(2*Math.PI*distance/step));for(let k=0;k<samples&&tried++<maxCandidates;k++){const angle=k*2*Math.PI/samples,p={x:start.x+Math.cos(angle)*distance,y:start.y+Math.sin(angle)*distance};if(!blocked(n,p)){let lo=Math.max(0,distance-step),hi=distance;for(let j=0;j<12;j++){const d=(lo+hi)/2,q={x:start.x+Math.cos(angle)*d,y:start.y+Math.sin(angle)*d};if(blocked(n,q))lo=d;else hi=d;}const q={x:start.x+Math.cos(angle)*hi,y:start.y+Math.sin(angle)*hi};if(!found||hi<Math.hypot(found.x-start.x,found.y-start.y))found=q;}}}if(found){const dx=found.x-start.x,dy=found.y-start.y,length=Math.hypot(dx,dy);let lo=Math.max(0,1-step/(length||1)),hi=1;for(let i=0;i<12;i++){const t=(lo+hi)/2,q={x:start.x+dx*t,y:start.y+dy*t};if(blocked(n,q))lo=t;else hi=t;}found={x:start.x+dx*hi,y:start.y+dy*hi};n.p=found;const a=anchor(n);n.r.bubbleX=found.x/width;n.r.bubbleY=found.y/height;if(a){n.r.anchorX=a.x/width;n.r.anchorY=a.y/height;}if(n.r.reviewBalloonPosition)n.r.reviewBalloonPosition={x:n.r.bubbleX,y:n.r.bubbleY};moved++;}}
    return{moved,unresolved:nodes.filter(n=>blocked(n,n.p)).length};
  }
  root.ASMachBalloonPlacement={choose,directed,manual,inkSampler,defaultDirection,autoStyle,applyNewDefaults,verifiedTextHeight,stabilizeAutoStyles,textGeometry,nominalTextHeight,resolveCollisions,boxVisible,leaderVisible,selectionGuide,constrainBox,outsideBox};
})(window);
