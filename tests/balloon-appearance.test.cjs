const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={window:{}};vm.runInNewContext(fs.readFileSync('src/balloon-appearance.js','utf8'),c);const api=c.window.ASMachBalloonAppearance;
test('Appearance validates decimals and enums; legacy settings receive stable pixel defaults',()=>{
 assert.equal(api.normalize().boxLineWidth,1.5);const a=api.normalize({boxLineWidth:2.34,leaderLineWidth:99,balloonLineWidth:-8,boxLineStyle:'none',balloonLineStyle:'evil'});
 assert.equal(a.boxLineWidth,2.3);assert.equal(a.leaderLineWidth,12);assert.equal(a.balloonLineWidth,.5);assert.equal(a.boxLineStyle,'none');assert.equal(a.balloonLineStyle,'solid');
 assert.equal(api.normalize({}, {boxLineWidth:4.5}).boxLineWidth,4.5);
});
test('SVG and canvas share independently scaled widths and dash patterns',()=>{
 const s={boxLineWidth:1.5,boxLineStyle:'dashed',balloonLineWidth:4,balloonLineStyle:'dotted',leaderLineWidth:.5,leaderLineStyle:'solid'},ctx={setLineDash(v){this.dash=[...v];}};
 api.canvas(ctx,s,'box',3);assert.equal(ctx.lineWidth,4.5);assert.deepEqual(ctx.dash,[18,11.25]);assert.match(api.svg(s,'box',3),/stroke-width="4.5" stroke-dasharray="18 11.25"/);
 api.canvas(ctx,s,'leader',3);assert.equal(ctx.lineWidth,1.5);assert.deepEqual(ctx.dash,[]);api.canvas(ctx,s,'balloon',3);assert.equal(ctx.lineWidth,12);assert.deepEqual(ctx.dash,[12,30]);
 const preview=api.preview({...s,size:46,fontSize:20,arrowEnabled:true,color:'#123456',opacity:.7},9);assert.match(preview,/stroke-width="1.5"/);assert.match(preview,/stroke-width="4"/);assert.match(preview,/stroke-width="0.5"/);assert.ok(!api.preview({...s,boxLineStyle:'none',shape:'circle',arrowEnabled:false}).includes('<rect'));
});
const html=fs.readFileSync('src/app.template.html','utf8');
function host(name){const start=html.indexOf(`        function ${name}(`),end=html.indexOf('\n        }',start);assert.ok(start>0);return html.slice(start,end+10);}
test('Project normalization, method changes, and PDF export preserve all six appearance properties',()=>{
 const ctx={window:c.window,elements:{sourceCanvas:{width:1000}},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),normalizeInspectionMethod:m=>m,methodStyle:()=>({size:40,fontSize:14,shape:'circle',opacity:1,arrowEnabled:true,color:'#07899a',...api.normalize({boxLineWidth:3,boxLineStyle:'dotted',leaderLineWidth:2.5})}),crypto:{randomUUID:()=>1}};
 for(const f of ['normalizeStoredSelectionBox','normalizeAnnotation','applyMethodToAnnotation','drawAnnotations'])vm.runInNewContext(host(f),ctx);
 const item=ctx.normalizeAnnotation({inspectionMethod:'CMM',size:40,balloonLineWidth:6,balloonLineStyle:'dashed'});assert.equal(item.boxLineWidth,3);assert.equal(item.balloonLineWidth,6);ctx.applyMethodToAnnotation(item,'KUMPAS');assert.equal(item.balloonLineWidth,2);assert.equal(item.leaderLineWidth,2.5);
 const calls=[],draw={lineWidth:0,save(){},restore(){},setLineDash(v){this.dash=[...v];},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){calls.push({width:this.lineWidth,dash:this.dash});},strokeRect(){this.stroke();},fill(){},fillText(){}};
 Object.assign(ctx,{boxConnection:i=>i,radiusFor:()=>20,fontSizeFor:()=>20,addCanvasBubblePath(){},drawCanvasArrowHead(){throw Error('Box connections must never draw arrowheads');}});
 item.selectionBox={x:.1,y:.2,w:.2,h:.1};ctx.drawAnnotations(draw,[item],2000,1000);assert.deepEqual(calls.map(c=>c.width),[6,5,4]);assert.deepEqual(calls[0].dash,[6,15]);
 calls.length=0;item.boxLineStyle='none';item.arrowEnabled=false;ctx.drawAnnotations(draw,[item],1000,500);assert.equal(calls.length,1);assert.equal(calls[0].width,2);
});
