/* Infer a drawing grid only from aligned, regularly spaced border labels. */
(function(root){
  'use strict';
  const center=(w,axis)=>axis==='x'?w.x+w.w/2:w.y+w.h/2;
  function infer(words){
    const labels=words.filter(w=>w.w>0&&w.h>0&&/^(?:[A-Z]|[1-9]\d?)$/.test(String(w.text||'').trim())).map(w=>({...w,text:w.text.trim()}));
    function axisGrid(axis){
      const cross=axis==='x'?'y':'x', groups=[];
      for(const first of labels){
        const edge=center(first,cross);
        if(edge>.12&&edge<.88)continue;
        const alphabet=/^[A-Z]$/.test(first.text);
        const aligned=labels.filter(w=>Math.abs(center(w,cross)-edge)<.012&&/^[A-Z]$/.test(w.text)===alphabet).sort((a,b)=>center(a,axis)-center(b,axis));
        const unique=aligned.filter((w,i)=>!i||center(w,axis)-center(aligned[i-1],axis)>.01);
        if(unique.length<3)continue;
        const ordinal=w=>alphabet?w.text.charCodeAt(0):Number(w.text);
        const deltas=unique.slice(1).map((w,i)=>center(w,axis)-center(unique[i],axis));
        const pitch=[...deltas].sort((a,b)=>a-b)[Math.floor(deltas.length/2)];
        const direction=Math.sign(ordinal(unique[1])-ordinal(unique[0]));
        // Allow skipped I/O in lettered grids but never arbitrary dimension numbers.
        if(!direction||unique.some((w,i)=>i&&(Math.sign(ordinal(w)-ordinal(unique[i-1]))!==direction||Math.abs(ordinal(w)-ordinal(unique[i-1]))> (alphabet?2:1))))continue;
        if(deltas.some(d=>Math.abs(d-pitch)>pitch*.3)||center(unique.at(-1),axis)-center(unique[0],axis)<.35)continue;
        groups.push({labels:unique,pitch,axis,edge,score:unique.length+Math.abs(edge-.5)});
      }
      groups.sort((a,b)=>b.score-a.score);
      if(!groups.length)return null;
      const best=groups[0];best.allLabels=groups.flatMap(g=>g.labels);
      return best;
    }
    return {horizontal:axisGrid('x'),vertical:axisGrid('y')};
  }
  function lookup(grid,x,y){
    if(!grid?.horizontal||!grid?.vertical)return '';
    function cell(g,v){
      const a=g.labels;
      if(v<center(a[0],g.axis)-g.pitch/2||v>center(a.at(-1),g.axis)+g.pitch/2)return '';
      return a.reduce((best,w)=>Math.abs(center(w,g.axis)-v)<Math.abs(center(best,g.axis)-v)?w:best).text;
    }
    const column=cell(grid.horizontal,x), row=cell(grid.vertical,y);
    if(!column||!row)return '';
    return /^[A-Z]$/.test(column)?column+row:row+column;
  }
  function isLabel(grid,word){
    return [grid?.horizontal,grid?.vertical].filter(Boolean).some(g=>g.allLabels.some(w=>
      w.text===String(word.text||'').trim()&&Math.abs(center(w,'x')-center(word,'x'))<Math.max(.007,w.w/2)&&Math.abs(center(w,'y')-center(word,'y'))<Math.max(.007,w.h/2)));
  }
  function assign(record,grid){
    if((record.manualFields||[]).includes('zone')||(record.zone&&record.zoneSource!=='auto'))return record.zone||'';
    const box=record.selectionBox;
    const zone=lookup(grid,box?box.x+box.w/2:record.anchorX,box?box.y+box.h/2:record.anchorY);
    if(zone||record.zoneSource==='auto'){record.zone=zone;record.zoneSource=zone?'auto':'';}
    return zone;
  }
  root.ASMachZones={infer,lookup,isLabel,assign};
})(window);
