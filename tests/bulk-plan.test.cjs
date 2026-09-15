const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){const c={window:{}};for(const n of ['inspection-plan','bulk-plan'])vm.runInNewContext(fs.readFileSync('src/'+n+'.js','utf8'),c);let history=[],changes=0;
 const bridge={state:{annotations:['a','b','c'].map((id,i)=>({id,number:i+1,type:'Çap',nominalValue:'27.3',upperTolerance:'0',bubbleX:.2+i*.1,bubbleY:.3,inspectionMethod:i?'CMM':'KUMPAS',inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:String(5+i),frequencyNote:'Eski not'}))},getMethods:()=>[{value:'CMM'},{value:'KUMPAS'}],checkpoint(){history.push(JSON.stringify(this.state.annotations));},applyMethodStyle(r,m){r.inspectionMethod=m;r.color=m==='CMM'?'red':'blue';},recordChange(){changes++;},renderAll(){}};
 return{api:c.window.ASMachBulkPlan,bridge,history,changes:()=>changes};}
test('Bulk method and frequency update touches selected IDs only and creates one undo checkpoint',()=>{
 const f=setup(),other=JSON.stringify(f.bridge.state.annotations[2]);assert.equal(f.api.apply(f.bridge,['a','b'],{method:'CMM',frequency:'EVERY_N_PIECES',interval:'10'}).changed,2);assert.equal(f.history.length,1);assert.equal(f.changes(),2);assert.equal(JSON.stringify(f.bridge.state.annotations[2]),other);
 for(const r of f.bridge.state.annotations.slice(0,2)){assert.equal(r.inspectionMethod,'CMM');assert.equal(r.frequencyInterval,'10');assert.equal(r.nominalValue,'27.3');assert.equal(r.bubbleY,.3);assert.ok(r.manualFields.includes('inspectionFrequency'));}
 f.bridge.state.annotations=JSON.parse(f.history.pop());assert.equal(f.bridge.state.annotations[0].inspectionMethod,'KUMPAS');assert.equal(f.bridge.state.annotations[0].frequencyInterval,'5');
});
test('Unchanged fields preserve mixed values; frequency-only changes do not restyle or move balloons',()=>{
 const f=setup();f.api.apply(f.bridge,['a','b'],{method:'CMM'});assert.equal(f.bridge.state.annotations[0].frequencyInterval,'5');assert.equal(f.bridge.state.annotations[1].frequencyInterval,'6');
 const before=f.bridge.state.annotations.map(r=>({color:r.color,bubbleX:r.bubbleX}));f.api.apply(f.bridge,['a','b'],{frequency:'PER_LOT'});f.bridge.state.annotations.forEach((r,i)=>{assert.equal(r.color,before[i].color);assert.equal(r.bubbleX,before[i].bubbleX);});assert.equal(f.bridge.state.annotations[0].frequencyInterval,'');assert.equal(f.bridge.state.annotations[0].frequencyNote,'');
});
test('Invalid interval, custom plan or method causes no partial changes; keep-all is a no-op',()=>{
 for(const values of [{method:'CMM',frequency:'EVERY_N_PIECES',interval:'0'},{frequency:'CUSTOM',note:''},{method:'missing'}]){const f=setup(),before=JSON.stringify(f.bridge.state.annotations);assert.ok(f.api.apply(f.bridge,['a','b'],values).error);assert.equal(JSON.stringify(f.bridge.state.annotations),before);assert.equal(f.history.length,0);}
 const f=setup();assert.equal(f.api.apply(f.bridge,['a','b'],{}).changed,0);assert.equal(f.history.length,0);
});
