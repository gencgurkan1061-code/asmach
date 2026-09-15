const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,loadImage}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
function fixture(){const c={window:{},document:{createElement:()=>createCanvas(1,1)}};vm.createContext(c);for(const name of ['auto-selection','snapshot-tools','balloon-placement','automatic-geometry'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),c);return c.window;}
test('Region coordinates round-trip and candidates crossing the selected boundary are excluded',()=>{
  const api=fixture().ASMachAutomaticGeometry,r={x:.1,y:.08,w:.75,h:.65},b={x:.3,y:.4,w:.08,h:.03};assert.ok(api.inside(b,r));const mapped=api.toPage(api.toLocal(b,r),r);for(const k of ['x','y','w','h'])assert.ok(Math.abs(mapped[k]-b[k])<1e-8);
  assert.equal(api.inside({x:.5,y:.8,w:.2,h:.1},r),false,'Title block outside selection');assert.equal(api.inside({x:.08,y:.2,w:.04,h:.02},r),false,'Do not read partial dimensions cut by region edge');
});

test('Explicit stacked tolerances retain the full selection after automatic refinement in all cardinal directions',async()=>{
  const api=fixture().ASMachAutomaticGeometry;
  for(const angle of [0,90,180,270]){
    const image=createCanvas(500,500),ctx=image.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,500,500);
    ctx.translate(250,250);ctx.rotate(angle*Math.PI/180);ctx.fillStyle='black';ctx.font='35px Arial';ctx.fillText('27.3',-90,10);ctx.font='20px Arial';ctx.fillText('0',70,-12);ctx.fillText('-0.05',35,15);
    const sideways=angle%180!==0,w=sideways?.10:.4,h=sideways?.4:.10;
    const word={x:.5-w/2,y:.5-h/2,w,h,readingAngle:angle,retainBounds:true};
    const result=api.refine(image,word,{x:0,y:0,w:1,h:1});
    assert.ok(Math.abs(result.box.w-w)<1e-8);assert.ok(Math.abs(result.box.h-h)<1e-8);
    const snapshot=await loadImage(result.snapshot);assert.equal(snapshot.width,200);assert.equal(snapshot.height,50);
  }
});
test('Automatic candidates receive tight rotated drawing polygons and deskewed report snapshots',async()=>{
  const api=fixture().ASMachAutomaticGeometry,region={x:.1,y:.1,w:.7,h:.65};
  for(const angle of [0,-90,-60]){
    const image=createCanvas(900,700),ctx=image.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,900,700);ctx.save();ctx.translate(450,350);ctx.rotate(angle*Math.PI/180);ctx.font='50px Arial';ctx.fillStyle='black';ctx.fillText('27.3',-55,18);ctx.restore();
    const a=angle*Math.PI/180,points=[[-70,-35],[70,-35],[70,35],[-70,35]].map(([x,y])=>({x:450+x*Math.cos(a)-y*Math.sin(a),y:350+x*Math.sin(a)+y*Math.cos(a)}));
    const left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),right=Math.max(...points.map(p=>p.x)),bottom=Math.max(...points.map(p=>p.y));
    const result=api.refine(image,{x:left/900,y:top/700,w:(right-left)/900,h:(bottom-top)/700,readingAngle:angle},region);
    assert.equal(result.box.points.length,4);assert.ok(api.inside(result.box,region));assert.ok(Math.abs(result.box.rotation-angle)<5,`${angle}: ${result.box.rotation}`);
    assert.ok(result.sourceTextHeightRatio>0,'Detected drawing text height is retained independently from the box');
    const report=await loadImage(result.snapshot);assert.ok(report.width>report.height*1.5,'Report text is horizontal');assert.ok(report.height<65,'Excess context is cropped');
  }
});
test('Batch placement uses a six-pixel edge gap, avoids previous balloons and does not fall back to remote leaders',()=>{
  const api=fixture().ASMachAutomaticGeometry,width=1000,height=700,base={page:1,size:30,shape:'circle',selectionBox:{x:.4,y:.4,w:.15,h:.04}},placed=[];
  for(let i=0;i<5;i++){const item={...base,id:'b'+i};assert.ok(api.place(item,width,height,placed));assert.ok(Math.abs(Math.hypot((item.bubbleX-item.anchorX)*width,(item.bubbleY-item.anchorY)*height)-21)<1e-7);for(const p of placed)assert.ok(Math.hypot((p.bubbleX-item.bubbleX)*width,(p.bubbleY-item.bubbleY)*height)>=34);placed.push(item);}
  const impossible={id:'full',page:1,size:80,selectionBox:{x:0,y:0,w:1,h:1}};assert.equal(api.place(impossible,width,height,[]),false);assert.equal(impossible.bubbleX,undefined);
});
