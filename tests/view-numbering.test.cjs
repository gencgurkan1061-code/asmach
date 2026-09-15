const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('src/view-numbering.js','utf8'),ctx);const api=ctx.window.ASMachViewNumbering;
const r=(id,n,x,y,page=1)=>({id,number:String(n),page,selectionBox:{x:x-.01,y:y-.01,w:.02,h:.02},bubbleX:1-x,bubbleY:1-y,requirement:'Ø20',rolePlans:{quality:{enabled:true}},snapshot:'keep'});
test('Page and selected-view scope preserve outside numbers and honor per-view direction',()=>{
 const records=[r('a',9,.1,.1),r('b',8,.2,.05),r('c',1,.7,.2),r('d',2,.1,.1,2)];
 const views=[{id:'left',name:'Left',page:1,order:'columns',box:{x:0,y:0,w:.4,h:1}},{id:'right',name:'Right',page:1,box:{x:.5,y:0,w:.5,h:1}},{id:'p2',name:'Page2',page:2,box:{x:0,y:0,w:1,h:1}}];
 const p=api.plan(records,views,{scope:'selected',selectedViews:['left'],start:1});assert.deepEqual(Array.from(p.assignments,a=>[a.id,a.number]),[['a','3'],['b','4']]);assert.equal(p.records,records);
 const page=api.plan(records,views,{scope:'page',page:2,start:1});assert.deepEqual(Array.from(page.assignments,a=>[a.id,a.number]),[['d','2']]);assert.match(api.plan(records,views,{scope:'selected',selectedViews:[]}).error,/seçin/);
});
test('Automatic view groups finish the left section before the high right detail (screenshot regression)',()=>{
 const coordinates=[[.26,.05],[.23,.1],[.32,.21],[.12,.32],[.08,.49],[.15,.47],[.22,.5],[.35,.49],[.43,.48],[.48,.47],[.52,.48],[.56,.49],[.3,.56],[.4,.8],[.29,.84],[.28,.88],[.28,.92],[.28,.96]];
 const records=coordinates.map(([x,y],i)=>r('left'+i,i+1,x,y));records.splice(2,0,r('detail',3,.86,.16));
 const views=api.suggestViews(records),p=api.plan(records);assert.equal(views.length,2);assert.equal(p.assignments[2].id,'left2');assert.equal(p.assignments.at(-1).id,'detail');assert.equal(p.assignments.at(-1).number,'19');assert.equal(p.groups[0].count,18);
 records.forEach(a=>{a.bubbleX=Math.random();a.bubbleY=Math.random();});assert.deepEqual(Array.from(api.plan(records).assignments,a=>a.id),Array.from(p.assignments,a=>a.id));
});
test('Suggestions keep a regular single-view grid together and separate pages deterministically',()=>{
 const records=[r('a',1,.1,.1),r('b',2,.2,.3),r('c',3,.3,.2),r('d',4,.4,.8),r('e',5,.8,.1,2)];
 const views=api.suggestViews(records);assert.equal(views.length,2);assert.deepEqual(Array.from(views,v=>v.page),[1,2]);assert.equal(api.plan(records).groups[0].count,4);assert.equal(api.suggestViews([]).length,0);
});
test('View order takes precedence over old numbers; row bands use measurement boxes instead of balloons',()=>{
 const records=[r('b',1,.3,.102),r('c',8,.8,.1),r('a',9,.1,.1),r('d',3,.1,.5)];const before=JSON.stringify(records),views=[{name:'Sağ',page:1,box:{x:.6,y:0,w:.4,h:1}},{name:'Sol',page:1,box:{x:0,y:0,w:.6,h:1}}];
 const p=api.plan(records,views,{order:'rows'});assert.deepEqual(Array.from(p.assignments,a=>a.id),['c','a','b','d']);assert.deepEqual(Array.from(p.assignments,a=>a.number),['1','2','3','4']);assert.equal(JSON.stringify(records),before);
 assert.deepEqual(Array.from(api.ordered(records,'columns'),a=>a.id),['a','d','b','c']);
});
test('Clockwise order starts at the top and uses the page aspect; pages and overlaps stay deterministic',()=>{
 const records=[r('bottom',4,.5,.9),r('left',2,.1,.5),r('top',3,.5,.1),r('right',1,.9,.5),r('p2',5,.1,.1,2)];assert.deepEqual(Array.from(api.ordered(records.slice(0,4),'clockwise'),a=>a.id),['top','right','bottom','left']);
 const view={page:1,box:{x:0,y:0,w:1,h:1}},p=api.plan(records,[view,view],{order:'clockwise'});assert.equal(p.assignments.length,5);assert.equal(p.overlap.length,4);assert.equal(p.assignments.at(-1).id,'p2');
});
test('Keeping outside balloons reserves their numbers including leading zeros; invalid input and stale geometry cannot apply',()=>{
 const records=[r('a',9,.1,.1),r('b','01',.9,.1),r('c',2,.1,.5)],views=[{page:1,box:{x:0,y:0,w:.5,h:1}}];const p=api.plan(records,views,{includeRemaining:false,start:1});assert.deepEqual(Array.from(p.assignments,a=>a.number),['2','3']);assert.ok(api.plan(records,views,{start:0}).error);
 let checkpoints=0;const app={state:{annotations:records,metadata:{}},checkpoint(){checkpoints++;},recordChange(){},renderAll(){}};records[0].selectionBox.x=.2;assert.ok(api.apply(app,p,views,{}).error);assert.equal(checkpoints,0);
});
test('Apply is one checkpoint and only changes labels plus view settings, preserving record IDs and all quality data',()=>{
 const records=[r('a',8,.2,.1),r('b',4,.1,.1)];let undo,checkpoints=0;const app={state:{annotations:records,metadata:{other:'keep'}},checkpoint(){undo=JSON.stringify(this.state);checkpoints++;},recordChange(){},renderAll(){}};const p=api.plan(records,[],{}),before=records.map(a=>({...a}));assert.equal(api.apply(app,p,[],{}).changed,2);assert.equal(checkpoints,1);assert.equal(app.state.metadata.other,'keep');for(let i=0;i<records.length;i++)assert.deepEqual({...records[i],number:before[i].number},before[i]);assert.equal(JSON.parse(undo).annotations[0].number,'8');
});
test('Automatic scan and numbering use one shared view record without geometric duplicates',()=>{
 const app={state:{annotations:[],metadata:{}},checkpoint(){},recordChange(){}};
 const first=api.registerScanArea(app,{id:'scan-a',name:'Ön görünüş',page:1,box:{x:.1,y:.2,w:.3,h:.4}});
 const same=api.registerScanArea(app,{id:'temporary-id',page:1,box:{x:.101,y:.199,w:.3,h:.401}});
 assert.equal(first.id,same.id);assert.equal(api.ensureViews(app).length,1);assert.equal(api.ensureViews(app)[0].name,'Ön görünüş');
 api.replaceViews(app,[{...api.ensureViews(app)[0],name:'Ön görünüş güncel'}]);
 assert.equal(app.state.metadata.viewNumbering.views[0].name,'Ön görünüş güncel');
 assert.equal(api.removeSharedView(app,first.id),true);assert.equal(api.ensureViews(app).length,0);
});
