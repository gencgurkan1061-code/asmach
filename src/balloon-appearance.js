/* Shared pixel-based appearance for drawing, export and settings previews. */
(function(root){
 'use strict';
 const defaults={boxLineWidth:1.5,boxLineStyle:'solid',balloonLineWidth:2,balloonLineStyle:'solid',leaderLineWidth:1.8,leaderLineStyle:'solid'};
 let fontProbe;const fontMetrics=new Map();
 function shapeFit(shape){
  // Each outline has a different useful inner area. A square can use its
  // corners, while circular and polygon balloons need more edge clearance.
  return shape==='triangle'?{w:.36,h:.58,ratio:2.15}:shape==='diamond'?{w:.46,h:.62,ratio:2.05}:shape==='square'?{w:.88,h:.82,ratio:1.6}:shape==='hexagon'?{w:.72,h:.78,ratio:1.8}:{w:.84,h:.84,ratio:2};
 }
 function fitFont(text,requested,radius,shape='circle',weight=800){
  const value=String(text??''),key=weight+'|'+value;let m=fontMetrics.get(key);
  if(!m){fontProbe ||= document.createElement('canvas').getContext('2d');fontProbe.font=`${weight} 100px Arial`;const measured=fontProbe.measureText(value);m={w:Math.max(1,measured.width),h:Math.max(75,(measured.actualBoundingBoxAscent||70)+(measured.actualBoundingBoxDescent||20))};if(fontMetrics.size>256)fontMetrics.clear();fontMetrics.set(key,m);}
  const fit=shapeFit(shape),diameter=radius*2;
  return Math.max(.1,Math.min(Number(requested)||10,diameter*fit.w/m.w*100,diameter*fit.h/m.h*100));
 }
 function minimumSize(text,fontSize,shape='circle',weight=800,lineWidth=2){
  const value=String(text??''),key=weight+'|'+value;let m=fontMetrics.get(key);
  if(!m){fitFont(value,fontSize,1,shape,weight);m=fontMetrics.get(key);}
  const fit=shapeFit(shape),font=Math.max(.1,Number(fontSize)||10),scale=font/100;
  const edge=Math.max(1,Math.max(.5,Number(lineWidth)||2)/2+.5);
  // Use the real text width and height plus the outline-specific safe area.
  // The square therefore stays compact for one/two digits; wide numbers grow
  // only when their measured width actually requires it.
  const proportional=Math.ceil(font*fit.ratio),contentFit=Math.ceil(Math.max(m.w*scale/fit.w,m.h*scale/fit.h)+edge*2);
  return Math.max(16,proportional,contentFit);
 }
 function fontSizeForVisibleHeight(text,visibleHeight,weight=800){
  const value=String(text??''),height=Number(visibleHeight);if(!(height>0))return null;
  fitFont(value,100,1,'circle',weight);const metrics=fontMetrics.get(weight+'|'+value),ratio=(metrics?.h||75)/100;
  return height/Math.max(.5,ratio);
 }
 function normalize(input={},fallback={}){const out={};for(const [key,value] of Object.entries(defaults)){const v=input[key]??fallback[key]??value;out[key]=key.endsWith('Width')?Number.isFinite(Number(v))?Math.max(.5,Math.min(12,Math.round(Number(v)*10)/10)):value:['solid','dashed','dotted',...(key==='boxLineStyle'?['none']:[])].includes(v)?v:value;}for(const key of ['balloonFill','boxFill','textColor','boxColor','leaderColor']){const value=input[key]??fallback[key];out[key]=/^#[0-9a-f]{6}$/i.test(value)?value:['balloonFill','boxFill'].includes(key)?'#ffffff':'';}out.boxGap=Math.max(0,Math.min(500,Number(input.boxGap??fallback.boxGap??8)||0));out.boxPadding=Math.max(0,Math.min(40,Number(input.boxPadding??fallback.boxPadding??4)||0));out.fontWeight=[400,700,800].includes(Number(input.fontWeight??fallback.fontWeight))?Number(input.fontWeight??fallback.fontWeight):800;out.arrowSize=Math.max(4,Math.min(40,Number(input.arrowSize??fallback.arrowSize)||9));out.boxFillOpacity=Math.max(0,Math.min(1,Number(input.boxFillOpacity??fallback.boxFillOpacity??0)));for(const part of ['box','balloon','leader','text']){const key=part+'Opacity',v=Number(input[key]??fallback[key]??1);out[key]=Number.isFinite(v)?Math.max(0,Math.min(1,v)):1;}return out;}
 function dash(style,width=1){return style==='dashed'?[width*4,width*2.5]:style==='dotted'?[width,width*2.5]:[];}
 function canvas(ctx,appearance,part,scale=1){const a=normalize(appearance),w=a[part+'LineWidth']*scale;ctx.globalAlpha=(appearance.opacity??1)*a[part+'Opacity'];ctx.lineWidth=w;ctx.strokeStyle=a[part+'Color']||appearance.color||'#07899a';ctx.setLineDash?.(dash(a[part+'LineStyle'],w));ctx.lineCap='round';ctx.lineJoin='round';return w;}
 function svg(appearance,part,scale=1){const a=normalize(appearance),w=a[part+'LineWidth']*scale;return `opacity="${a[part+'Opacity']}" stroke-width="${w}" stroke-dasharray="${dash(a[part+'LineStyle'],w).join(' ')||'none'}" stroke-linecap="round" stroke-linejoin="round"`;}
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function previewBase(style,number=1,mini=false){
  const a={...style,...normalize(style)},r=Math.max(8,Math.min(80,(a.size||46)/2)),h=mini?72:190,w=mini?152:Math.max(400,260+a.boxGap+2*r),k=mini?Math.min(.43,24/r):1;
  const x=mini?Math.max(113,91+r*k):218+a.boxGap+r,y=h/2,textWidth=mini?43:66,textHeight=mini?16:26,padding=a.boxPadding*(mini?.45:1),bw=textWidth+2*padding,bh=textHeight+2*padding,boxCenter=mini?50.5:143,bx=boxCenter-bw/2;
  let shape=a.shape==='square'?`<rect x="${x-r*k}" y="${y-r*k}" width="${2*r*k}" height="${2*r*k}" rx="${r*.12*k}"/>`:a.shape==='hexagon'?`<polygon points="${Array.from({length:6},(_,i)=>`${x+r*k*Math.cos(i*Math.PI/3)},${y+r*k*Math.sin(i*Math.PI/3)}`).join(' ')}"/>`:`<circle cx="${x}" cy="${y}" r="${r*k}"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Kutu, bağlantı ve balon önizlemesi"><text x="${boxCenter}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${mini?13:22}" fill="#243849">Ø27.3</text><g opacity="${a.opacity??1}" stroke="${esc(a.color||'#07899a')}">${a.boxLineStyle==='none'?'':`<rect data-preview-box x="${bx}" y="${y-bh/2}" width="${bw}" height="${bh}" stroke="${esc(a.boxColor||a.color||'#07899a')}" fill="${a.boxFill}" fill-opacity="${a.boxFillOpacity}" ${svg(a,'box',k)}/>`}${a.arrowEnabled?`<line x1="${bx+bw}" y1="${y}" x2="${x-r*k}" y2="${y}" ${svg(a,'leader',k)}/>`:''}<g fill="white" ${svg(a,'balloon',k)}>${shape}</g><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="${esc(a.color||'#07899a')}" stroke="none" opacity="${a.textOpacity}" font-size="${fitFont(number,(a.fontSize||20)*k,r*k,a.shape,a.fontWeight)}" font-family="Arial,sans-serif" font-weight="${a.fontWeight}">${esc(number)}</text></g></svg>`;
 }
 function preview(style,number=1,mini=false){const a={...style,...normalize(style)};let html=previewBase(a,number,mini).replace('<line x1=', '<line stroke="'+esc(a.leaderColor||a.color||'#07899a')+'" x1=').replace('<g fill="white"','<g fill="'+a.balloonFill+'"').replace('fill="'+esc(a.color||'#07899a')+'" stroke="none"','fill="'+esc(a.textColor||a.color||'#07899a')+'" stroke="none"');if(a.arrowEnabled&&a.boxLineStyle==='none'){const x=mini?85:218,y=mini?36:95,z=mini?a.arrowSize*.44:a.arrowSize,c=esc(a.leaderColor||a.color||'#07899a');const head=a.arrowStyle==='dot'?`<circle cx="${x}" cy="${y}" r="${z/2}" fill="${c}"/>`:a.arrowStyle==='open'?`<path d="M${x+z},${y-z/2} L${x},${y} L${x+z},${y+z/2}" fill="none" stroke="${c}"/>`:a.arrowStyle==='diamond'?`<path d="M${x-z/2},${y}l${z/2},${-z/2}l${z/2},${z/2}l${-z/2},${z/2}Z" fill="${c}"/>`:`<path d="M${x},${y}l${z},${-z/2}v${z}Z" fill="${c}"/>`;html=html.replace('</svg>','<g opacity="'+(a.opacity??1)*a.leaderOpacity+'">'+head+'</g></svg>');}return html;}
 function selectionEffect(shape,x,y,r,lineWidth=2){
  const z=r+Math.max(2,Number(lineWidth)/2)+3;
  const geometry=shape==='square'?`rect x="${x-z}" y="${y-z}" width="${2*z}" height="${2*z}" rx="${z*.12}"`:shape==='hexagon'?`polygon points="${Array.from({length:6},(_,i)=>`${x+z*Math.cos(i*Math.PI/3)},${y+z*Math.sin(i*Math.PI/3)}`).join(' ')}"`:shape==='triangle'?`polygon points="${x},${y-z} ${x+z},${y+z} ${x-z},${y+z}"`:shape==='diamond'?`polygon points="${x},${y-z} ${x+z},${y} ${x},${y+z} ${x-z},${y}"`:`circle cx="${x}" cy="${y}" r="${z}"`;
  return `<g class="selected-ring" aria-hidden="true" pointer-events="none" fill="none" stroke-linejoin="round"><${geometry} stroke="#ffffff" stroke-width="7" vector-effect="non-scaling-stroke"/><${geometry} stroke="#007f96" stroke-width="3" vector-effect="non-scaling-stroke"/><${geometry} stroke="#54e5ed" stroke-width="1" vector-effect="non-scaling-stroke"/></g>`;
 }
 root.ASMachBalloonAppearance={defaults,normalize,dash,canvas,svg,preview,fitFont,minimumSize,fontSizeForVisibleHeight,selectionEffect};
})(window);
