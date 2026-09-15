'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('Preview navigation, zoom, print and save all use the prepared PDF; close releases resources',async()=>{
  const controls={};let modal,frame,saved=0,printed=0,destroyed=0,revoked=0,focused=0,bytes;
  const renders=[];
  const element=()=>({style:{setProperty(key,value){this[key]=value;}},setAttribute(){},focus(){},append(){},remove(){},getContext:()=>({}),clientWidth:850,clientHeight:550,replaceChildren(child){this.child=child;}});
  const document={activeElement:{focus(){focused++;}},body:{append(){}},createElement(type){
    if(type==='div'){
      modal=element();modal.querySelector=selector=>controls[selector]||(controls[selector]=Object.assign(element(),{value:'1'}));
      modal.append=child=>{frame=child;child.onload();};return modal;
    }
    if(type==='iframe')return Object.assign(element(),{contentWindow:{focus(){},print(){printed++;}}});
    return element();
  }};
  const root={devicePixelRatio:1,pdfjsLib:{getDocument(options){bytes=options.data;return{promise:Promise.resolve({numPages:2,destroy:async()=>{destroyed++;},getPage:async page=>({getViewport:({scale})=>({width:600*scale,height:800*scale}),render(options){renders.push({page,width:options.viewport.width});return{promise:Promise.resolve(),cancel(){}};}})}),destroy:async()=>{}};}}};
  const context={window:root,document,URL:{createObjectURL:()=> 'blob:prepared',revokeObjectURL:url=>{assert.equal(url,'blob:prepared');revoked++;}},Uint8Array};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/pdf-preview.js'),'utf8'),context);
  await root.ASMachPdfPreview.open(new Blob(['pdf bytes']),{fileName:'output.pdf',detail:'300 DPI',onSave:async()=>{saved++;}});
  assert.equal(modal.style['z-index'],'5000');
  assert.equal(Buffer.from(bytes).toString(),'pdf bytes');assert.equal(saved,0);assert.equal(printed,0);
  assert.equal(controls['[data-native]'].href,'blob:prepared');assert.equal(frame.src,'blob:prepared');
  assert.equal(controls['[data-page]'].textContent,'1 / 2');assert.equal(controls['[data-prev]'].disabled,true);
  controls['[data-next]'].onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(renders.at(-1).page,2);assert.equal(controls['[data-next]'].disabled,true);
  const previousWidth=renders.at(-1).width;controls['[data-zoom]'].value='2';controls['[data-zoom]'].onchange();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(renders.at(-1).width,previousWidth*2);
  controls['[data-print]'].onclick();assert.equal(printed,1);
  await controls['[data-save]'].onclick();assert.equal(saved,1);
  controls['[data-close]'].onclick();assert.equal(destroyed,1);assert.equal(revoked,1);assert.equal(focused,1);
});
