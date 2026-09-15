const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function fixture(){
  let dialog,save,disposed=false,mountOptions;
  const state={currentPage:1,annotations:[{id:'one'}]};
  const record={id:'one',page:2,nominalValue:'11',selectionBox:{x:.1,y:.2,w:.3,h:.1,rotation:30}};
  const capture=[];
  const app={state,changePage:async page=>state.currentPage=page,selectScanArea:async()=>({page:2,box:{x:.4,y:.5,w:.2,h:.1}}),
    snapshotSourceBox:box=>({...box}),captureExact:async(box,page)=>{capture.push({box,page});return 'image';},
    loadImage:async()=>({naturalWidth:400,naturalHeight:200}),savedReviewSelection:(r)=>({rect:{angle:r.selectionBox.rotation||0}}),
    mapSnapshotSelection:(box,s)=>({...box,rotation:s.angle,points:s.points})};
  const context={window:{ASMachRegionMeasurements:{mount:()=>({read:()=>({}),applyText(){}})},ASMachSnapshots:{mount:(container,image,onSave,onError,options)=>{
    save=onSave;mountOptions=options;return{commit(){onSave('data:image/png;base64,bmV3',{angle:45,points:[{x:0,y:0}]});},dispose(){disposed=true;}};
  }}},document:{body:{append(){}},createElement(){
    const children={},listeners={};
    dialog={setAttribute(){},querySelector:s=>children[s]||=( {} ),addEventListener:(name,fn)=>listeners[name]=fn,
      showModal(){this.open=true;},close(){this.open=false;listeners.close();},remove(){this.removed=true;}};return dialog;
  }}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/characteristic-region.js'),'utf8'),context);
  return{api:context.window.ASMachCharacteristicRegion,app,record,capture,get dialog(){return dialog;},get options(){return mountOptions;},get disposed(){return disposed;},get save(){return save;}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('Box editor restores saved orientation, captures correct page and only returns a draft',async()=>{
  const f=fixture(),before=JSON.stringify(f.record),pending=f.api.open(f.app,f.record);await flush();
  assert.equal(f.app.state.currentPage,2);assert.equal(f.capture[0].page,2);assert.equal(f.options.detected.rect.angle,30);
  f.dialog.querySelector('[data-region-accept]').onclick();const patch=await pending;
  assert.equal(patch.selectionBox.rotation,45);assert.equal(patch.anchorX,.25);assert.equal(patch.snapshot,'data:image/png;base64,bmV3');
  assert.equal(JSON.stringify(f.record),before);assert.equal(f.disposed,true);assert.equal(f.dialog.removed,true);
});
test('Reselection uses new rectangle; cancel/Escape and document replacement never apply it',async()=>{
  for(const cancel of [true,false]){
    const f=fixture(),pending=f.api.open(f.app,f.record,{reselect:true});await flush();
    assert.equal(f.capture[0].box.x,.4);assert.equal(f.options.detected.rect.angle,0);
    if(cancel)f.dialog.close();else{f.app.state.annotations=[];f.dialog.querySelector('[data-region-accept]').onclick();}
    assert.equal(await pending,null);assert.equal(f.disposed,true);
  }
  const f=fixture();f.app.selectScanArea=async()=>null;
  assert.equal(await f.api.open(f.app,f.record,{reselect:true}),null);assert.equal(f.capture.length,0);
});
