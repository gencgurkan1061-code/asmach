'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const viewControls=()=>Object.fromEntries(['zoom-in','zoom-out','zoom-label','view-fit','rotate'].map(k=>['[data-'+k+']',{}]));
function fixture(){
  const drawings=[];
  function canvas(){return{width:0,height:0,style:{},addEventListener(){},getContext(){return{save(){},restore(){},fillText(){},fillRect(){},translate(){},scale(){},rotate(){},beginPath(){},rect(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},arc(){},drawImage(...args){drawings.push(args);},setLineDash(){},strokeRect(){}};},toDataURL(){return `png:${this.width}x${this.height}`;},getBoundingClientRect(){return{left:0,top:0,width:200,height:100};},setPointerCapture(){}};}
  const c={window:{},document:{createElement:()=>canvas()},Image:class{naturalWidth=400;naturalHeight=200;decode(){return Promise.resolve();}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/snapshot-tools.js'),'utf8'),c);
  return{api:c.window.ASMachSnapshots,canvas,drawings};
}
test('Rotation retains full source resolution and fits arbitrary angles without clipping',()=>{
  const {api,canvas}=fixture();const source=canvas();source.width=400;source.height=200;
  for(const [angle,w,h] of [[0,400,200],[90,200,400],[-90,200,400],[180,400,200],[45,425,425]]){
    const result=api.rotateCanvas(source,angle);assert.equal(result.width,w);assert.equal(result.height,h);
    assert.equal(source.width,400);assert.equal(source.height,200);
  }
});

test('OCR rotation slider geometry uses page aspect ratio, preserves dimensions and round-trips in projects',()=>{
 const {api}=fixture(),base={x:.2,y:.3,w:.25,h:.08};
 for(const [W,H]of [[1600,600],[600,1600]])for(const angle of [-180,-90,-8.3,0,25.5,90,180]){
  const box=api.rotateBox(base,W,H,angle),r=api.boxRect(JSON.parse(JSON.stringify(box)),W,H);
  assert.equal(box.angleLocked,true);assert.equal(box.rotation,angle);assert.ok(Math.abs(r.w-base.w*W)<1e-7);assert.ok(Math.abs(r.h-base.h*H)<1e-7);
  assert.ok(Math.abs(Math.cos(r.angle*Math.PI/180)-Math.cos(angle*Math.PI/180))<1e-7);
  for(const p of box.points)assert.ok(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
  const flat=api.rotateBox(box,W,H,0),rect=api.boxRect(flat,W,H);assert.ok(Math.abs(rect.w-base.w*W)<1e-7);assert.equal(rect.angle,0);
 }
 for(const angle of [-180,-90,-45,0,45,90,180]){const box=api.rotateBox({x:0,y:.001,w:.2,h:.15},1600,600,angle);for(const p of box.points)assert.ok(p.x>=0&&p.y>=0&&p.x<=1&&p.y<=1);}
});

test('Balloon is preview-only; its virtual margin does not resize or annotate the report source',async()=>{
  const {api,canvas,drawings}=fixture(),controls={...viewControls(),canvas:canvas(),'[data-result]':canvas(),'[data-auto]':{},'[data-info]':{},'[data-crop]':{},'[data-reset]':{},'[data-new]':{}};
  const container={querySelector:k=>controls[k],querySelectorAll:()=>[]};let saved;
  const editor=api.mount(container,'original',value=>saved=value,null,{getBalloon:()=>({x:440,y:100,anchorX:400,anchorY:100,radius:30,fontSize:20,number:4,methodLabel:'Kumpas',shape:'circle'})});await Promise.resolve();
  assert.equal(saved,'png:400x200');assert.ok(controls.canvas.width>400,'Preview reserves space for the balloon outside the captured source');
  const before=JSON.stringify(editor.getSelection());editor.refresh();assert.equal(JSON.stringify(editor.getSelection()),before);
  editor.commit();assert.equal(saved,'png:400x200');
  assert.ok(drawings.every(args=>args[0]!==controls.canvas),'The annotated preview canvas is never used as report source');
});
test('Inline rotated ROI remains editable after applying and drives report plus drawing geometry',async()=>{
  const {api,canvas}=fixture();const controls={...viewControls(),'canvas':canvas(),'[data-result]':canvas(),'[data-auto]':{},'[data-info]':{},'[data-crop]':{},'[data-reset]':{},'[data-new]':{}};
  const turns=[{dataset:{turn:'90'}},{dataset:{turn:'-90'}}];let saved,selection;
  const container={querySelector:key=>controls[key],querySelectorAll:()=>turns};
  const editor=api.mount(container,'original',(value,metadata)=>{saved=value;selection=metadata;});await Promise.resolve();
  assert.equal(saved,'png:400x200');
  controls['[data-new]'].onclick();
  const preview=controls.canvas;preview.onpointerdown({button:0,clientX:50,clientY:25,pointerId:1,preventDefault(){}});
  preview.onpointerup({clientX:150,clientY:75});
  editor.commit();assert.equal(saved,'png:200x100');
  controls['[data-crop]'].onclick();assert.equal(saved,'png:200x100');
  const key=value=>preview.onkeydown({key:value,preventDefault(){},stopPropagation(){}});
  for(let i=0;i<20;i++)key(']');
  assert.equal(saved,'png:200x100');assert.equal(selection.angle,20);assert.equal(selection.points.length,4);
  assert.notEqual(selection.points[0].y,selection.points[1].y,'The drawing box, not just the report, is rotated');
  const before=editor.getSelection();controls['[data-crop]'].onclick();assert.deepEqual(editor.getSelection(),before,'Apply never discards original pixels or resets the selection');
  key('r');assert.equal(saved,'png:100x200');assert.equal(selection.angle,110);
  for(let i=0;i<3;i++)key('r');assert.equal(saved,'png:200x100');assert.equal(selection.angle,20);
  preview.onpointerdown({button:0,clientX:100,clientY:50,pointerId:2,preventDefault(){}});preview.onpointerup({clientX:110,clientY:50});
  assert.ok(Math.abs(editor.getSelection().cx-before.cx-20)<1e-8,'Drag inside moves the existing rotated ROI');
  controls['[data-reset]'].onclick();assert.equal(saved,'png:400x200');
  editor.dispose();key('r');assert.equal(saved,'png:400x200');
});

test('Real pixels: rotated crop is deskewed without including the surrounding image',()=>{
  const {createCanvas}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
  const c={window:{},document:{createElement:()=>createCanvas(1,1)}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/snapshot-tools.js'),'utf8'),c);
  for(const angle of [-90,-31.5,0,24.7,90]){
    const source=createCanvas(600,400),ctx=source.getContext('2d');ctx.fillStyle='#0000ff';ctx.fillRect(0,0,600,400);
    ctx.translate(300,200);ctx.rotate(angle*Math.PI/180);ctx.fillStyle='#ff0000';ctx.fillRect(-120,-40,240,80);
    ctx.fillStyle='#000000';ctx.fillRect(-100,-3,200,6);
    const out=c.window.ASMachSnapshots._test.extract(source,{cx:300,cy:200,w:240,h:80,angle});
    assert.equal(out.width,240);assert.equal(out.height,80);
    const pixel=(x,y)=>out.getContext('2d').getImageData(x,y,1,1).data;
    for(const x of [25,60,120,180,215]){
      const middle=pixel(x,40);assert.ok(middle[0]<25&&middle[1]<25&&middle[2]<25,'Line must be horizontal in the report');
      const upper=pixel(x,15);assert.ok(upper[0]>230&&upper[2]<25,'Surrounding blue context must not be included');
    }
  }
});

test('All eight resize handles preserve angle and opposite sides; move/rotation stay within source',()=>{
  const {api}=fixture(),{adjust,corners,constrain}=api._test;
  const r={cx:400,cy:300,w:200,h:80,angle:30};
  for(const mode of ['nw','n','ne','e','se','s','sw','w']){
    const next=adjust(r,mode,{x:0,y:0},{x:4,y:5},800,600);
    assert.equal(next.angle,30);assert.ok(next.w>=2&&next.h>=2);
    assert.ok(next.w!==r.w||next.h!==r.h);
  }
  const moved=adjust(r,'move',{x:0,y:0},{x:-900,y:900},800,600);
  for(const p of corners(moved)){assert.ok(p.x>=-1e-8&&p.x<=800+1e-8);assert.ok(p.y>=-1e-8&&p.y<=600+1e-8);}
  const turned=adjust(r,'rotate',{x:400,y:200},{x:500,y:300},800,600);assert.equal(turned.angle,120);
  for(const angle of [-179,-90,-32,0,45,90,179]){
    const safe=constrain({...r,cx:0,cy:0,w:2000,h:1500,angle},800,600);
    for(const p of corners(safe)){assert.ok(p.x>=-1e-7&&p.x<=800+1e-7);assert.ok(p.y>=-1e-7&&p.y<=600+1e-7);}
  }
});

test('Balloon drag works in the virtual preview margin and never moves or crops the source ROI',async()=>{
  const {api,canvas}=fixture(),controls={...viewControls(),canvas:canvas(),'[data-result]':canvas(),'[data-auto]':{},'[data-info]':{},'[data-crop]':{},'[data-reset]':{},'[data-new]':{}};
  let bubble={x:-40,y:100,anchorX:0,anchorY:100,radius:25,fontSize:20,number:7,methodLabel:'Kumpas',shape:'circle'},saves=0;
  const editor=api.mount({querySelector:k=>controls[k]},'original',()=>saves++,null,{getBalloon:()=>bubble,onBalloonMove:p=>{bubble={...bubble,x:p.x,y:p.y};}});await Promise.resolve();
  const initial=JSON.stringify(editor.getSelection()),before=saves,c=controls.canvas;
  // View spans x=-77..400. Canvas DOM width is 200; click the balloon outside source x=0.
  const x=(-40+77)/477*200;
  c.onpointerdown({button:0,clientX:x,clientY:50,pointerId:1,preventDefault(){}});c.onpointermove({clientX:x-10,clientY:60});c.onpointerup({clientX:x-10,clientY:60,pointerId:1});
  assert.ok(bubble.x<-60);assert.equal(bubble.y,120);assert.equal(JSON.stringify(editor.getSelection()),initial);assert.equal(saves,before,'Moving balloon must not save a new crop');
});

test('Zoom, fit and Alt-pan never change the selection or commit a crop',async()=>{
 const {api,canvas}=fixture(),controls={...viewControls(),canvas:canvas(),'[data-result]':canvas(),'[data-auto]':{},'[data-info]':{},'[data-crop]':{},'[data-reset]':{},'[data-new]':{}};let saves=0;
 const editor=api.mount({querySelector:k=>controls[k]},'original',()=>saves++);await Promise.resolve();const before=JSON.stringify(editor.getSelection()),count=saves;
 controls['[data-zoom-in]'].onclick();assert.equal(controls['[data-zoom-label]'].textContent,'125%');controls['[data-zoom-out]'].onclick();
 const c=controls.canvas;c.onpointerdown({button:0,altKey:true,clientX:80,clientY:40,pointerId:1,preventDefault(){}});c.onpointerup({clientX:110,clientY:55,pointerId:1});
 controls['[data-view-fit]'].onclick();assert.equal(JSON.stringify(editor.getSelection()),before);assert.equal(saves,count);
 controls['[data-rotate]'].onclick();assert.equal(editor.getSelection().angle,90);assert.equal(saves,count+1);editor.dispose();
});
