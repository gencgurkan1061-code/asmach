const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const jobs=new Map();let next=0;
  const node=()=>({events:{},attrs:{},classes:new Set(),addEventListener(n,f){(this.events[n]||=[]).push(f);},emit(n,e={}){for(const f of this.events[n]||[])f({target:this,stopPropagation(){},...e});},setAttribute(k,v){this.attrs[k]=v;},matches(){return false;}});
  const panel=node(),doc=node(),win=node(),controls={toggle:node(),pin:node(),close:node(),expand:[node(),node()]};
  panel.classList={add:n=>panel.classes.add(n),remove:n=>panel.classes.delete(n)};panel.contains=n=>n===panel||[controls.toggle,controls.pin,controls.close,...controls.expand].includes(n)||n.inside;panel.getBoundingClientRect=()=>({left:0,right:100,top:50,bottom:100});doc.querySelector=()=>null;
  const ctx={window:{},setTimeout:f=>{jobs.set(++next,f);return next;},clearTimeout:id=>jobs.delete(id)};
  vm.runInNewContext(fs.readFileSync('src/characteristic-dock.js','utf8'),ctx);
  const api=ctx.window.ASMachCharacteristicDock.attach(panel,controls,doc,win);
  return {panel,doc,win,controls,api,flush:()=>{const all=[...jobs.values()];jobs.clear();all.forEach(f=>f());}};
}
test('Hover closes after leaving even if a button or checkbox retains focus; quick return cancels close',()=>{
  const f=fixture();f.panel.emit('pointerenter');assert.ok(f.api.getState().opened);
  f.panel.emit('focusin',{target:f.controls.toggle});f.panel.emit('pointerleave');f.flush();assert.equal(f.api.getState().opened,false);
  f.panel.emit('pointerenter');f.panel.emit('pointerleave');f.panel.emit('pointerenter');f.flush();assert.ok(f.api.getState().opened);
  f.panel.emit('focusin',{target:{matches:()=>false}});f.panel.emit('pointerleave');f.flush();assert.equal(f.api.getState().opened,false);
});
test('Close overrides focus and pin; outside click does not prevent next hover; pin is explicit',()=>{
  const f=fixture();f.panel.emit('pointerenter');f.controls.pin.emit('click');f.panel.emit('pointerleave');f.flush();assert.ok(f.api.getState().pinned);
  f.doc.emit('pointerdown');assert.ok(f.api.getState().pinned);f.controls.close.emit('click');assert.equal(f.api.getState().pinned,false);
  f.doc.emit('pointerdown');f.panel.emit('pointerenter');assert.ok(f.api.getState().opened);
  f.controls.close.emit('click');assert.equal(f.api.getState().opened,false);f.panel.emit('pointerenter');assert.equal(f.api.getState().opened,false);
  f.panel.emit('pointerleave');f.panel.emit('pointerenter');assert.ok(f.api.getState().opened);
});
test('Keyboard, touch, missed pointerleave, window blur and expansion recover cleanly',()=>{
  const f=fixture();f.panel.emit('pointerenter',{pointerType:'touch'});assert.equal(f.api.getState().opened,false);f.controls.toggle.emit('click');assert.ok(f.api.getState().opened);
  f.controls.expand[0].emit('click');assert.ok(f.api.getState().expanded);f.doc.emit('keydown',{key:'Escape'});assert.equal(f.api.getState().expanded,false);
  f.doc.emit('keydown',{key:'Tab'});f.panel.emit('focusin');assert.ok(f.api.getState().opened);f.panel.emit('focusout');f.flush();assert.equal(f.api.getState().opened,false);
  f.panel.emit('pointerenter');f.doc.emit('pointermove',{clientX:200,clientY:200});f.flush();assert.equal(f.api.getState().opened,false);
  f.panel.emit('pointerenter');f.win.emit('blur');assert.equal(f.api.getState().opened,false);
});
