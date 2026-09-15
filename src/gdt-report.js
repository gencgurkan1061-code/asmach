/* A report image is derived afresh from fields; the captured drawing stays intact. */
(function(root){
  'use strict';
  const cache=new Map();
  function render(record){
    if(record.type!=='GD&T')return null;
    const api=root.ASMachRequirements,current=api.withGdtSubtype(record),frame=current.gdtFrame;
    if(Object.prototype.hasOwnProperty.call(record,'upperTolerance')&&String(record.upperTolerance??'').trim()==='')frame.tolerance='';
    const cells=api.gdtCells(current);
    if(cells[1])cells[1]=cells[1].replace(/\d+(?:[.,]\d+)?/,v=>api.displayNumber(v,record));
    const key=JSON.stringify([current.gdtSubtype,cells]);if(cache.has(key))return cache.get(key);
    const canvas=document.createElement('canvas'),probe=canvas.getContext('2d');probe.font='24px Arial';
    const widths=cells.map((text,i)=>i?Math.max(34,Math.ceil(probe.measureText(text||'?').width)+16):42),height=40,width=widths.reduce((n,w)=>n+w,0)+2,k=3;
    canvas.width=width*k;canvas.height=(height+2)*k;const g=canvas.getContext('2d');g.scale(k,k);g.fillStyle='white';g.fillRect(0,0,width,height+2);g.strokeStyle='#111';g.lineWidth=1;g.fillStyle='#111';g.font='24px Arial';g.textAlign='center';g.textBaseline='middle';
    let x=1;
    cells.forEach((text,i)=>{
      const cellWidth=widths[i];
      if(i===0&&api.GDT_TYPES.some(t=>t.value===current.gdtSubtype)&&root.ASMachGdtVision){
        const symbol=root.ASMachGdtVision._test.symbolTemplate(current.gdtSubtype,0,192);g.drawImage(symbol,x+5,5,32,32);
      }else g.fillText(text||'?',x+cellWidth/2,21);
      if(i){g.beginPath();g.moveTo(x,1);g.lineTo(x,41);g.stroke();}x+=cellWidth;
    });
    g.strokeRect(1,1,width-2,40);
    const result={dataUrl:canvas.toDataURL('image/png'),canvas,width:canvas.width,height:canvas.height,cells};
    if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
  }
  function image(record){return record.type==='GD&T'?render(record)?.dataUrl||'':record.snapshot||'';}
  function markup(record,height=28){const report=render(record);if(!report)return '';const alt=String(record.requirement||report.cells.join(' | ')).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return `<img class="gdt-generated-frame" src="${report.dataUrl}" alt="${alt}" style="display:inline-block;vertical-align:middle;height:${height}px;width:auto;max-width:none;object-fit:contain" draggable="false">`;}
  root.ASMachGdtReport={render,image,markup,lineHeight:16};
})(window);
