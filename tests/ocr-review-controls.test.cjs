const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const nodes={};
  class Node{
    constructor(){this.value='';this.children=[];this.dataset={};this.style={};this.hidden=false;}
    set id(v){this._id=v;nodes[v]=this;}get id(){return this._id;}
    append(n){n.parent=this;this.children.push(n);}replaceChildren(...n){this.children=[];n.forEach(c=>this.append(c));}
    after(n){n.parent=this.parent||null;}
    closest(){return this.parent||(this.parent=new Node());}
  }
  const document={getElementById:id=>nodes[id],createElement:()=>new Node(),querySelector:s=>nodes[s]||(nodes[s]=new Node())};
  for(const id of ['ocrInspectionMethod','ocrFrequency','ocrFrequencyInterval','ocrFrequencyNote','ocrTypeExtras','ocrUnit','ocrNominal','ocrLowerTolerance','ocrUpperTolerance','ocrGeneralTolerance','ocrRecognizedText']){const n=new Node();n.id=id;}
  const c={window:{},document,Option:function(label,value){this.label=label;this.value=value;}};vm.createContext(c);
  for(const file of ['requirements-engine','inspection-plan','ocr-review-controls'])vm.runInContext(fs.readFileSync('src/'+file+'.js','utf8'),c);
  const pending={previewMethod:'KUMPAS'};let refresh=0,changes=0;
  const api=c.window.ASMachOcrReviewControls;api.start({getPending:()=>pending,methods:[{value:'KUMPAS',label:'Kumpas'},{value:'GÖRSEL_KONTROL',label:'Görsel kontrol'},{value:'DOKÜMAN_KONTROLÜ',label:'Doküman kontrolü'}],onMethod:()=>refresh++,onChange:()=>changes++});
  return{c,nodes,pending,api,refresh:()=>refresh,changes:()=>changes};
}
test('Review fields follow characteristic type without clearing hidden drafts; GD&T has a tolerance zone, not nominal',()=>{
  const {api,nodes}=fixture();const hidden=id=>nodes[id].closest().hidden;
  api.render({type:'Proses'});for(const id of ['ocrNominal','ocrLowerTolerance','ocrUpperTolerance','ocrUnit','ocrGeneralTolerance'])assert.equal(hidden(id),true,id);
  api.render({type:'GD&T'});assert.equal(hidden('ocrNominal'),true);assert.equal(hidden('ocrLowerTolerance'),true);assert.equal(hidden('ocrUpperTolerance'),false);assert.equal(hidden('ocrGeneralTolerance'),true);
  nodes.ocrNominal.value='59.9';api.render({type:'Çap'});assert.equal(hidden('ocrNominal'),false);assert.equal(nodes.ocrNominal.value,'59.9');assert.equal(hidden('ocrGeneralTolerance'),false);
  api.render({type:'Diş',threadPitch:'1.5',threadClass:'6H'});assert.equal(hidden('ocrExtra_threadPitch'),false);assert.equal(nodes.ocrExtra_threadPitch.value,'1.5');assert.equal(hidden('ocrLowerTolerance'),true);
  api.render({type:'Pah',chamferAngle:'45'});assert.equal(hidden('ocrExtra_chamferAngle'),false);assert.equal(hidden('ocrExtra_threadPitch'),true);
  api.render({type:'Yüzey',specialDesignator:'Ra'});assert.equal(hidden('ocrExtra_specialDesignator'),false);
});
test('Inline method and frequency controls preserve explicit choices, show interval/custom fields and validate required details',()=>{
  const {api,c,nodes,pending,refresh}=fixture();nodes.ocrRecognizedText.value='Malzeme sertifikası kontrol edilecek';api.render({type:'Not'});assert.equal(pending.previewMethod,'DOKÜMAN_KONTROLÜ');
  nodes.ocrInspectionMethod.value='GÖRSEL_KONTROL';nodes.ocrInspectionMethod.onchange();api.render({type:'Not'});assert.equal(pending.previewMethod,'GÖRSEL_KONTROL');assert.ok(refresh()>=2);
  nodes.ocrFrequency.value='EVERY_N_PIECES';nodes.ocrFrequency.onchange();assert.equal(nodes.ocrFrequencyInterval.closest().hidden,false);assert.match(c.window.ASMachInspectionPlan.validate(api.frequency()),/tam sayı/);
  nodes.ocrFrequencyInterval.value='10';assert.equal(c.window.ASMachInspectionPlan.validate(api.frequency()),'');assert.equal(api.frequency().frequencyInterval,'10');
  nodes.ocrFrequency.value='CUSTOM';nodes.ocrFrequency.onchange();assert.equal(nodes.ocrFrequencyInterval.closest().hidden,true);assert.match(c.window.ASMachInspectionPlan.validate(api.frequency()),/açıklayın/);
  nodes.ocrFrequencyNote.value='Her kurulumda';assert.equal(c.window.ASMachInspectionPlan.validate(api.frequency()),'');
});
test('Structured extras remain editable and nonnumeric records cannot save stale dimensional tolerances',()=>{
  const {api,nodes,pending,changes}=fixture();api.render({type:'Diş',threadPitch:'1.5'});pending.requirementMode='manual';nodes.ocrExtra_threadPitch.value='2';nodes.ocrExtra_threadPitch.oninput();assert.equal(pending.structuredEdits.threadPitch,'2');assert.equal(pending.requirementMode,'auto');assert.equal(changes(),1);
  const saved=api.sanitize({type:'Proses',nominalValue:'50',lowerTolerance:'-0.1',upperTolerance:'0.1',unit:'mm',toleranceStandard:'ISO',requirement:'Markalama yapılmalıdır.'});assert.equal(saved.nominalValue,'');assert.equal(saved.unit,'');assert.equal(saved.toleranceStandard,'');assert.equal(saved.requirement,'Markalama yapılmalıdır.');
  const gdt=api.sanitize({type:'GD&T',nominalValue:'87.5',lowerTolerance:'-0.2',upperTolerance:'0.2'});assert.equal(gdt.nominalValue,'');assert.equal(gdt.lowerTolerance,'0');
});

test('Manual balloon geometry attaches to rotated box edges, avoids covering the box and stays on the page',()=>{
  const c={window:{}};vm.runInNewContext(fs.readFileSync('src/balloon-placement.js','utf8'),c);const api=c.window.ASMachBalloonPlacement;
  for(const angle of [0,25,90,-70]){
    const a=angle*Math.PI/180,points=[[-100,-25],[100,-25],[100,25],[-100,25]].map(([x,y])=>({x:300+x*Math.cos(a)-y*Math.sin(a),y:250+x*Math.sin(a)+y*Math.cos(a)}));
    for(const position of [{x:300,y:250},{x:440,y:200},{x:-50,y:400},{x:550,y:900}]){
      const p=api.manual({points,width:800,height:600,size:40,position});assert.ok(p);assert.ok(p.x>=21&&p.x<=779&&p.y>=21&&p.y<=579);assert.ok(Math.hypot(p.x-p.anchor.x,p.y-p.anchor.y)>=22-1e-8);
      const onEdge=points.some((v,i)=>{const q=points[(i+1)%4];return Math.abs(Math.hypot(p.anchor.x-v.x,p.anchor.y-v.y)+Math.hypot(p.anchor.x-q.x,p.anchor.y-q.y)-Math.hypot(q.x-v.x,q.y-v.y))<1e-7;});assert.ok(onEdge);
    }
  }
});
