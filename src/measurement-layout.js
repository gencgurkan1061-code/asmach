/* Reconstruct a selected dimension in reading coordinates, not PDF object order. */
(function(root){
  'use strict';
  function reconstruct(words,{width=1,height=1,ocr=false,details=false}={}){
    if(!words?.length)return '';
    const clean=s=>root.ASMachRequirements.normalize(s);
    const readingAngle=words.filter(w=>/\d/.test(w.text)).sort((a,b)=>b.text.length-a.text.length)[0]?.angle||0;
    const boxes=words.filter(w=>w.text?.trim()).map(w=>{
      const wordAngle=/^(?:Ø|R|SR)$/.test(clean(w.text))?readingAngle:w.angle||0;
      const angle=ocr?-wordAngle*Math.PI/180:wordAngle,c=Math.cos(angle),s=Math.sin(angle);
      const corners=[[w.x,w.y],[w.x+w.w,w.y],[w.x,w.y+w.h],[w.x+w.w,w.y+w.h]].map(([x,y])=>[c*x*width+s*y*height,-s*x*width+c*y*height]);
      const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
      return {text:clean(w.text),x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
    }).filter(w=>w.h>0&&w.w>0);
    const lines=[],smallMarks=[];
    for(const w of boxes.sort((a,b)=>b.h-a.h||a.x-b.x)){
      // OCR/PDF glyph boxes follow the ink, not the font em square. Decimal
      // points sit at the baseline and minus signs are often only a few pixels
      // high. Assign these after the numeric rows have established their size.
      if(/^[.,+±\-°]$/.test(w.text)){smallMarks.push(w);continue;}
      const cy=w.y+w.h/2;
      let line=lines.find(l=>Math.abs(cy-l.cy)<Math.max(l.h,w.h)*.36&&(Math.min(l.h,w.h)/Math.max(l.h,w.h)>.7||/^[.,]$/.test(w.text)));
      if(!line){line={words:[],cy,h:w.h};lines.push(line);}line.words.push(w);
    }
    let ambiguousSpacing=boxes.some(w=>/\d[ \t]+\d/.test(w.text));
    for(const w of smallMarks){
      const cy=w.y+w.h/2,decimal=/^[.,]$/.test(w.text),degree=w.text==='°';
      const eligible=lines.map(line=>{
        const top=line.cy-line.h/2,bottom=line.cy+line.h/2;
        const nearDigits=line.words.filter(p=>/\d/.test(p.text)).map(p=>Math.max(0,p.x-w.x-w.w,w.x-p.x-p.w));
        const dx=Math.min(...nearDigits);
        const vertical=decimal?(w.h>=line.h*.55?Math.abs(cy-line.cy)<line.h*.36:Math.abs(w.y+w.h-bottom)<line.h*.32&&w.y>=top+line.h*.38):
          degree?cy>=top-line.h*.25&&cy<=line.cy:Math.abs(cy-line.cy)<line.h*.4;
        return {line,dx,vertical,score:dx/line.h+Math.abs((decimal?w.y+w.h:cy)-(decimal?bottom:line.cy))/line.h};
      }).filter(v=>v.vertical&&v.dx<v.line.h*1.3&&v.line.h>=w.h*.75);
      eligible.sort((a,b)=>a.score-b.score);
      if(eligible.length&&(!eligible[1]||eligible[1].score-eligible[0].score>.12))eligible[0].line.words.push(w);
      else {lines.push({words:[w],cy,h:w.h});if(decimal)ambiguousSpacing=true;}
    }
    for(const l of lines){
      const sorted=l.words.sort((a,b)=>a.x-b.x);let value='';
      const atom=w=>/^(?:[ØR]|SR|SØ|\d|[.,+±\-°])$/.test(w.text);
      // Expanded tracking is accepted only inside a run of individual glyphs.
      // Complete numeric OCR words ("25", "35") are never concatenated just
      // because they share a baseline. A large gap outlier also splits a run.
      const runAt=new Map();
      for(let start=0;start<sorted.length;){
        if(!atom(sorted[start])){start++;continue;}
        let end=start+1;
        while(end<sorted.length&&atom(sorted[end])&&sorted[end].x-sorted[end-1].x-sorted[end-1].w<l.h*1.3&&!/^[+±-]$/.test(sorted[end].text))end++;
        const run=sorted.slice(start,end),gaps=run.slice(1).map((w,i)=>Math.max(0,w.x-run[i].x-run[i].w)).sort((a,b)=>a-b);
        if(run.filter(w=>/^[.,]$/.test(w.text)).length>1)ambiguousSpacing=true;
        const median=gaps.length?gaps[Math.floor(gaps.length/2)]:0;
        const runRight=run.at(-1).x+run.at(-1).w;
        const signedNeighbor=/^[+±-]/.test(sorted[end]?.text||'')||lines.some(other=>other!==l&&other.h<l.h*.9&&Math.abs(other.cy-l.cy)<l.h*1.8&&other.words.some(w=>/^[+±-]/.test(w.text)&&w.x>=runRight-l.h*.2&&w.x-runRight<l.h*3));
        const digitCount=run.filter(w=>/^\d$/.test(w.text)).length;
        const anchor=run.some(w=>/^(?:[.,ØR°]|SR|SØ)$/.test(w.text))||digitCount>=2&&signedNeighbor;
        const limit=anchor?Math.min(l.h*1.3,Math.max(l.h*.7,median*1.65+l.h*.08)):l.h*.7;
        for(const w of run)runAt.set(w,{run,limit});
        start=end;
      }
      sorted.forEach((w,i)=>{
        const prior=sorted[i-1],gap=prior?w.x-prior.x-prior.w:0;
        const glyphs=prior&&/^(?:SR|SØ|[RØ⌀Φ\d.,+\-±°]+)$/.test(prior.text)&&/^(?:SR|SØ|[RØ⌀Φ\d.,+\-±°]+)$/.test(w.text)&&(prior.text.length===1||w.text.length===1);
        const tracking=prior&&runAt.has(w)&&runAt.get(prior)?.run===runAt.get(w).run?runAt.get(w).limit:l.h*.7;
        const completeNumberBoundary=prior&&prior.text.length>1&&/\d$/.test(prior.text)&&/^\d/.test(w.text);
        const glue=glyphs&&!completeNumberBoundary&&gap<Math.max(tracking,.001)&&!(/^[+±-]/.test(w.text)&&/\d$/.test(prior.text));
        if(prior&&!glue&&/[\d.,]$/.test(prior.text)&&/^[\d.,]/.test(w.text))ambiguousSpacing=true;
        value+=(value&&!glue?' ':'')+w.text;
      });l.text=clean(value);
    }
    const left=l=>Math.min(...l.words.map(w=>w.x)),right=l=>Math.max(...l.words.map(w=>w.x+w.w));
    const number='(?:\\d+(?:\\.\\d+)?|\\.\\d+)',unit='(?:mm|cm|µm|μm|µin|nm|in|m|°)';
    const measurePattern=new RegExp(`^((?:\\d+\\s*[x×]\\s*)?)(S?Ø|SR|R)?\\s*(${number})(°)?(?:\\s+(${unit}))?$`,'i');
    const measure=l=>l.text.match(measurePattern);
    const deviationPattern=new RegExp(`^(?:[±+-]${number}|0(?:\\.0+)?)(°)?$`);
    const unitPattern=new RegExp(`^${unit}$`,'i');
    const digits=t=>(String(t).match(/\d/g)||[]).length;
    let nominal=null;
    const finish=(text,structured=false,extra={})=>{
      const missingDigits=Math.max(0,boxes.reduce((sum,w)=>sum+digits(w.text),0)-digits(text));
      return details?{text,structured:structured&&!ambiguousSpacing,missingDigits,nominal:nominal?.text||'',...extra,...(ambiguousSpacing?{ambiguousSpacing:true}:{})}:text;
    };
    // Equal-height, aligned unsigned rows are limit dimensions, not deviations.
    // Require geometry and retain all other tokens; never join unrelated values.
    const unsigned=lines.filter(l=>measure(l));
    for(const upper of unsigned)for(const lower of unsigned){
      const h=Math.max(upper.h,lower.h),dy=lower.cy-upper.cy;
      if(dy<h*.75||dy>h*2.8||Math.min(upper.h,lower.h)/h<.8||Math.abs(right(upper)-right(lower))>h*.6)continue;
      const up=measure(upper),low=measure(lower);
      // Quantity, dimensional prefix and unit must agree when both rows repeat them.
      if([1,2,4,5].some(i=>up[i]&&low[i]&&up[i].toUpperCase()!==low[i].toUpperCase())||[1,2].some(i=>low[i]&&!up[i]))continue;
      const hi=Number(up[3]),lo=Number(low[3]);
      if(!(hi>lo&&lo>0&&hi/lo<2))continue;
      const others=lines.filter(l=>l!==upper&&l!==lower),extra=others.sort((a,b)=>left(a)-left(b)).map(l=>l.text).join(' ');
      const extras=extra.match(new RegExp(`^((?:\\d+\\s*[x×]\\s*)?)(S?Ø|SR|R)?\\s*((?:[x×]\\s*${number}\\s*°)?)(?:\\s*(${unit}))?$`,'i'));
      if(!extras)continue;
      // Adjacent annotations must not become the pair's quantity or unit.
      if(others.some(l=>Math.abs(l.cy-(upper.cy+lower.cy)/2)>h*1.2||left(l)>Math.max(right(upper),right(lower))+h*3||right(l)<Math.min(left(upper),left(lower))-h*3))continue;
      if(extras[1]&&(up[1]||low[1])||extras[2]&&(up[2]||low[2])||extras[4]&&(up[5]||low[5]))continue;
      const prefix=(extras[1]||up[1]||low[1]||'')+(extras[2]||up[2]||low[2]||'');
      const degree=up[4]||low[4]||'',suffix=[extras[3],extras[4]||up[5]||low[5]].filter(Boolean).join(' ');
      const text=clean(`${prefix}${up[3]}${degree} MAX ${low[3]}${degree} MIN ${suffix}`);
      return finish(text,true,{nominal:'',limitDimension:true});
    }
    const deviationsFor=n=>lines.filter(l=>l!==n&&deviationPattern.test(l.text)&&(!l.text.includes('°')||n.text.includes('°'))&&left(l)>=right(n)-n.h*.25&&left(l)-right(n)<n.h*3&&Math.abs(l.cy-n.cy)<n.h*1.8&&l.h<=n.h*1.2);
    const candidates=lines.filter(l=>measure(l));
    const support=n=>{const ds=deviationsFor(n);return ds.some(l=>/^[±+-]/.test(l.text))?ds.length:0;};
    nominal=candidates.sort((a,b)=>support(b)-support(a)||b.h-a.h||left(a)-left(b))[0];
    if(nominal){
      const deviations=deviationsFor(nominal);
      const extras=lines.filter(l=>l!==nominal&&!deviations.includes(l)),prefixes=[],suffixes=[];
      let supported=true;
      for(const line of extras){
        const near=Math.abs(line.cy-nominal.cy)<nominal.h*.85;
        if(near&&right(line)<=left(nominal)+nominal.h*.2&&left(nominal)-right(line)<nominal.h*3&&/^(?:\d+\s*[x×]\s*)?(?:S?Ø|SR|R)?$/.test(line.text))prefixes.push(line);
        else if(near&&left(line)>=right(nominal)-nominal.h*.2&&left(line)-right(nominal)<nominal.h*5&&(unitPattern.test(line.text)||new RegExp(`^[x×]\\s*${number}\\s*°$`).test(line.text)))suffixes.push(line);
        else supported=false;
      }
      const sourceMeasure=measure(nominal),prefixText=prefixes.sort((a,b)=>left(a)-left(b)).map(l=>l.text).join(' ');
      // Never silently drop extra dimensions, annotations or a second prefix.
      if(prefixText&&((sourceMeasure[1]&&/\d/.test(prefixText))||(sourceMeasure[2]&&/[ØR]/.test(prefixText))))supported=false;
      const core=clean(`${prefixText} ${sourceMeasure[1]||''}${sourceMeasure[2]||''}${sourceMeasure[3]}${sourceMeasure[4]||''}`);
      const suffix=[sourceMeasure[5],...suffixes.sort((a,b)=>left(a)-left(b)).map(l=>l.text)].filter(Boolean).join(' ');
      if(supported){
        if(deviations.length===2&&!deviations.some(l=>l.text.startsWith('±'))&&deviations.some(l=>/^[+-]/.test(l.text))){
          const ordered=deviations.sort((a,b)=>a.cy-b.cy);
          if(ordered[1].cy-ordered[0].cy>Math.min(...ordered.map(l=>l.h))*.5)return finish(clean(`${core} (${ordered.map(l=>l.text).join('/')}) ${suffix}`),true);
        }
        if(deviations.length===1&&/^[±+-]/.test(deviations[0].text))return finish(clean(`${core} ${deviations[0].text} ${suffix}`),true);
        if(!deviations.length&&(prefixes.length||suffixes.length))return finish(clean(`${core} ${suffix}`),true);
      }
    }
    return finish(clean(lines.sort((a,b)=>a.cy-b.cy).map(l=>l.text).join('\n')));
  }
  root.ASMachMeasurementLayout={reconstruct};
})(window);
