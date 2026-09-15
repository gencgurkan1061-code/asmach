/* Conservative evidence checks for automatic measurement proposals only. Manual OCR is unchanged. */
(function(root){
  'use strict';
  const area=b=>Math.max(1e-9,b.w*b.h);
  function coverage(a,b){return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y))/area(a);}
  const numberText=t=>/^\d+(?:[.,]\d+)?$/.test(String(t).trim());
  const header=/\b(?:MATERIAL|MALZEME|SHEET|SAYFA|SCALE|ÖLÇEK|OLCEK|REV(?:ISION)?|DRAWING|RESİM\s*NO|PART\s*(?:NO|NUMBER)|PARÇA\s*NO|WEIGHT|AĞIRLIK|AGIRLIK|DATE|TARİH|TARIH|APPROVED|CHECKED|PREPARED|DRAWN|SPECIFIED|UNLESS|AKSI|AKSİ|BELİRTİLMEDİKÇE|BELIRTILMEDIKCE|T651|T6|ALUMINIUM|ALÜMİNYUM)\b/i;
  function context(pdfWords=[],words=[],lines=[],image=null){
    const evidence=[...pdfWords.map(w=>({...w,pdf:true})),...words];
    const labels=evidence.filter(w=>header.test(w.text||''));
    // A title block needs several independent labels, not an arbitrary bottom-page cutoff.
    const bottom=labels.filter(w=>w.y>.65&&w.x>.35),anchors=new Set(bottom.map(w=>String(w.text).toUpperCase()));
    const title=anchors.size>=3?{x:Math.min(...bottom.map(w=>w.x))-.025,y:Math.min(...bottom.map(w=>w.y))-.02,w:1,h:1}:null;
    return{pdfWords,evidence,labels,title,lines,image};
  }
  function visualEvidence(image,box){
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    const w=box.w*width,h=box.h*height;if(w<2||h<2)return{glyphs:0};
    const scale=Math.min(1,180/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.max(2,Math.ceil(w*scale));canvas.height=Math.max(2,Math.ceil(h*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,box.x*width,box.y*height,w,h,0,0,canvas.width,canvas.height);
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,W=canvas.width,H=canvas.height,mask=new Uint8Array(W*H),queue=new Int32Array(W*H);
    for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>100&&(data[i*4]+data[i*4+1]+data[i*4+2])<540?1:0;
    let glyphs=0,ink=0;
    for(let i=0;i<mask.length;i++)if(mask[i]){let head=0,tail=1,minX=W,minY=H,maxX=0,maxY=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;queue[0]=i;mask[i]=0;
      while(head<tail){const p=queue[head++],x=p%W,y=Math.floor(p/W);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<W&&ny>=0&&ny<H&&mask[ny*W+nx]){mask[ny*W+nx]=0;queue[tail++]=ny*W+nx;}}
      }
      ink+=tail;const bw=maxX-minX+1,bh=maxY-minY+1,vx=sxx/tail-(sx/tail)**2,vy=syy/tail-(sy/tail)**2,cov=sxy/tail-sx*sy/tail**2,delta=Math.sqrt((vx-vy)**2+4*cov*cov),major=(vx+vy+delta)/2,minor=(vx+vy-delta)/2;
      const straight=major>10&&major/Math.max(.08,minor)>65;
      if(tail>=6&&Math.max(bw,bh)>=5&&Math.min(bw,bh)>=2&&!straight&&tail/(bw*bh)>.075&&tail/(bw*bh)<.94)glyphs++;
    }
    return{glyphs,inkRatio:ink/(W*H)};
  }
  function rejectReason(source,ctx){
    const text=String(source.text||'').trim(),ocr=!String(source.source||'').startsWith('PDF'),bare=numberText(text);
    if(!source.w||!source.h||source.x<0||source.y<0||source.x+source.w>1.01||source.y+source.h>1.01)return 'bounds';
    if(ctx.title&&coverage(source,ctx.title)>.85)return 'title';
    // Border grid labels are never measurement candidates, even if OCR calls G a 9.
    if(!ctx.selectedArea&&bare&&(source.x+source.w<=.035+1e-9||source.x>=.965||source.y+source.h<=.035+1e-9||source.y>=.965))return 'border';
    if(ctx.lines.some(line=>coverage(source,line)>.8&&header.test(line.text||'')&&line.w*line.h<.12))return 'heading';
    if(source.visualGdt||source.visualSurface)return ''; // Closed frame + independently recognized geometric symbol and cell-local OCR.
    if(bare&&ctx.labels.some(label=>{const dy=Math.abs(label.y+label.h/2-source.y-source.h/2),dx=Math.max(0,label.x-source.x-source.w,source.x-label.x-label.w);return dy<Math.max(label.h,source.h)*1.8&&dx<.04;}))return 'metadata';
    if(ocr){
      if(ctx.evidence.some(w=>(w.pdf||w.confidence>=85)&&coverage(source,w)>.65&&/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(w.text||'')&&!/\d/.test(w.text||'')&&!/^(?:mm|in)$/i.test(w.text||'')&&!(/^(?:R|M|C|DIA)$/i.test(w.text||'')&&text.toUpperCase().startsWith(w.text.toUpperCase())&&/\d/.test(text))))return 'letter-conflict';
      if(ctx.pdfWords.some(w=>coverage(source,w)>.75&&numberText(w.text)&&bare&&Number(w.text)!==Number(text)))return 'pdf-conflict';
      if((source.confidence||0)<(bare?85:70))return 'uncertain-ocr';
      if(ctx.image){const visual=visualEvidence(ctx.image,source);if(!visual.glyphs)return 'line-or-hatch';if(bare&&visual.inkRatio<.015)return 'almost-empty';}
      // A lone 1 is indistinguishable from a drawing line without independent text evidence.
      if(/^1$/.test(text)&&!ctx.pdfWords.some(w=>coverage(source,w)>.7&&String(w.text).trim()==='1'))return 'isolated-stroke';
    }
    return '';
  }
  function searchable(pdfWords,score){const dims=[];for(const word of pdfWords)if(score(word.text)>=35&&!numberText(word.text)&&!dims.some(d=>coverage(word,d)>.5||coverage(d,word)>.5))dims.push(word);const cells=new Set(dims.map(w=>`${Math.floor(w.x*3)}:${Math.floor(w.y*3)}`));return dims.length>=8&&cells.size>=3;}
  root.ASMachDimensionFilter={context,rejectReason,visualEvidence,searchable};
})(window);
