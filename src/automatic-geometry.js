/* Automatic candidates use the same crop geometry and short leaders as manual box selections. */
(function(root){
  'use strict';
  function inside(b,r){return b.w>0&&b.h>0&&b.x>=r.x-1e-8&&b.y>=r.y-1e-8&&b.x+b.w<=r.x+r.w+1e-8&&b.y+b.h<=r.y+r.h+1e-8;}
  function toLocal(b,r){return{...b,x:(b.x-r.x)/r.w,y:(b.y-r.y)/r.h,w:b.w/r.w,h:b.h/r.h};}
  function toPage(b,r){return{...b,x:r.x+b.x*r.w,y:r.y+b.y*r.h,w:b.w*r.w,h:b.h*r.h};}
  function refine(image,word,region){
    const W=image.naturalWidth||image.width,H=image.naturalHeight||image.height;
    const mx=Math.max(6/W,word.w*.12),my=Math.max(6/H,word.h*.12),x=Math.max(0,Math.floor((word.x-mx)*W)),y=Math.max(0,Math.floor((word.y-my)*H));
    const right=Math.min(W,Math.ceil((word.x+word.w+mx)*W)),bottom=Math.min(H,Math.ceil((word.y+word.h+my)*H));
    const source=document.createElement('canvas');source.width=Math.max(2,right-x);source.height=Math.max(2,bottom-y);source.getContext('2d').drawImage(image,x,y,source.width,source.height,0,0,source.width,source.height);
    const seed={cx:(word.x+word.w/2)*W-x,cy:(word.y+word.h/2)*H-y,w:word.w*W,h:word.h*H,angle:0};
    const hint=Number.isFinite(word.readingAngle)?word.readingAngle:Number.isFinite(word.angle)?-word.angle:undefined;
    const detected=root.ASMachAutoSelection.detect(source,seed,{angleHint:hint});
    let rect=detected.rect;
    if((!detected.confident||word.retainBounds)&&Number.isFinite(hint)&&Math.abs(hint%90)<.01){const sideways=Math.abs(Math.round(hint/90))%2===1;rect={...seed,w:sideways?seed.h:seed.w,h:sideways?seed.w:seed.h,angle:hint};}
    rect=root.ASMachSnapshots._test.constrain(rect,source.width,source.height);
    const points=root.ASMachSnapshots._test.corners(rect).map(p=>({x:region.x+(x+p.x)/W*region.w,y:region.y+(y+p.y)/H*region.h}));
    const left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y));
    return{box:{x:left,y:top,w:Math.max(...points.map(p=>p.x))-left,h:Math.max(...points.map(p=>p.y))-top,points,rotation:rect.angle},snapshot:root.ASMachSnapshots._test.extract(source,rect).toDataURL('image/png'),sourceTextHeightRatio:Number.isFinite(detected.textHeight)?detected.textHeight/W*region.w:null,note:detected.confident?'Kutu, yön ve teknik yazı boyu algılandı':'Yönü kontrol edin'};
  }
  function place(item,width,height,annotations,ink){
    if(!item.boxDirection)item.boxDirection=root.ASMachBalloonPlacement.defaultDirection(item);
    const b=item.selectionBox,points=(b.points?.length===4?b.points:[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}]).map(p=>({x:p.x*width,y:p.y*height}));
    const occupied=annotations.filter(a=>!a.listOnly&&a.page===item.page&&a.id!==item.id).map(a=>({x:a.bubbleX*width,y:a.bubbleY*height,radius:(Number(a.size)||46)/2}));
    const plan=item.reviewBalloonPosition?root.ASMachBalloonPlacement.manual({points,width,height,size:item.size,shape:item.shape,position:{x:item.reviewBalloonPosition.x*width,y:item.reviewBalloonPosition.y*height}}):(root.ASMachBalloonPlacement.directed({points,width,height,size:item.size,shape:item.shape,gap:item.boxGap??8,direction:item.boxDirection||root.ASMachBalloonPlacement.defaultDirection(),occupied})||root.ASMachBalloonPlacement.choose({points,width,height,size:item.size,shape:item.shape,gap:item.boxGap??8,direction:item.boxDirection||root.ASMachBalloonPlacement.defaultDirection(),edgeFractions:[.5,.2,.8],occupied,ink}));
    if(!plan)return false;
    Object.assign(item,{bubbleX:plan.x/width,bubbleY:plan.y/height,anchorX:plan.anchor.x/width,anchorY:plan.anchor.y/height,anchorMode:'edge'});return true;
  }
  root.ASMachAutomaticGeometry={inside,toLocal,toPage,refine,place};
})(window);
