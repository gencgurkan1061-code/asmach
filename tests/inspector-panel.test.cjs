const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// A scoped, non-browser DOM model checks node relocation, bindings and tab state.
function fixture(){
  let doc;
  class Node {
    constructor(tag){this.tagName=tag.toLowerCase();this.children=[];this.attrs={};this.events={};this.style={};this.ownerDocument=doc;this._text='';this.hidden=false;this.scrollTop=0;this.dataset={};}
    get id(){return this.attrs.id||'';}set id(v){this.attrs.id=v;}
    get className(){return this.attrs.class||'';}set className(v){this.attrs.class=v;}
    get classList(){return{add:n=>this.className=[...new Set([...this.className.split(' '),n])].join(' '),remove:n=>this.className=this.className.split(' ').filter(c=>c!==n).join(' ') };}
    matches(s){if(s.startsWith('#'))return this.id===s.slice(1);if(s.startsWith('.'))return this.className.split(' ').includes(s.slice(1));const m=s.match(/^(\w+)(?:\[([\w-]+)="([^"]+)"\])?$/);return Boolean(m&&this.tagName===m[1]&&(!m[2]||this.attrs[m[2]]===m[3]));}
    querySelectorAll(s){const result=[];for(const child of this.children){if(s.split(',').some(v=>child.matches(v.trim())))result.push(child);result.push(...child.querySelectorAll(s));}return result;}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
    closest(s){let n=this;while(n){if(n.matches(s))return n;n=n.parentElement;}return null;}
    append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;this.children.push(n);}}
    prepend(n){n.remove();n.parentElement=this;this.children.unshift(n);}
    remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}}
    replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.append(...nodes);}
    setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}
    addEventListener(k,f){(this.events[k]||=[]).push(f);}
    emit(k,props={}){for(const f of this.events[k]||[])f({target:this,preventDefault(){},stopPropagation(){},...props});}
    focus(){doc.activeElement=this;}
    set textContent(v){this.replaceChildren();this._text=String(v);}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
    set innerHTML(html){
      this.replaceChildren();this._text='';const stack=[this];
      for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
        if(token.startsWith('<!--'))continue;
        if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
        if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const n=new Node(tag);
          for(const m of token.matchAll(/([\w-]+)="([^"]*)"/g))n.setAttribute(m[1],m[2]);n.hidden=/\shidden(?:\s|>)/.test(token);stack.at(-1).append(n);
          if(!['input','img','br','hr','meta','link'].includes(tag)&&!token.endsWith('/>'))stack.push(n);
        }else stack.at(-1)._text+=token;
      }
    }
  }
  doc={createElement:tag=>new Node(tag),getElementById:id=>doc.root.querySelector('#'+id)};doc.root=new Node('main');
  const html=fs.readFileSync('src/app.template.html','utf8'),start=html.indexOf('<div class="selection-form" id="selectionForm">'),end=html.indexOf('<div class="list-panel">',start);
  const host=new Node('div');host.className='selection-panel';host.innerHTML=html.slice(start,end);doc.root.append(host);
  const form=doc.getElementById('selectionForm'),detail=new Node('button');detail.id='acuiDetailsOpen';form.prepend(detail);
  const ctx={window:{}};vm.runInNewContext(fs.readFileSync('src/inspection-plan.js','utf8'),ctx);vm.runInNewContext(fs.readFileSync('src/inspector-panel.js','utf8'),ctx);
  ctx.window.ASMachRequirements={fieldProfile:type=>({numeric:type!=='Not',nominal:type!=='GD&T'})};
  return{api:ctx.window.ASMachInspectorPanel,doc,form,host};
}
test('Inspector reorganizes every existing control once and preserves event handlers',()=>{
  const {api,doc,form}=fixture(),controls=form.querySelectorAll('input,select,textarea,button'),refs=new Map(controls.map(n=>[n.id,n]));let changed=0;
  refs.get('nominalValue').addEventListener('change',()=>changed++);api.mount(form);
  for(const [id,node] of refs){assert.equal(doc.getElementById(id),node,id);assert.equal(form.querySelectorAll('#'+id).length,1,id+' has no duplicate');}
  assert.equal(doc.getElementById('balloonSize').closest('.ip-pane').id,'ipStylePane');
  assert.equal(doc.getElementById('nominalValue').closest('.ip-pane').id,'ipDataPane');
  assert.ok(doc.getElementById('selectionSnapshotImage').closest('.ip-source'));
  assert.equal(doc.getElementById('ipStylePane').hidden,true);assert.ok(doc.getElementById('deleteButton').closest('.ip-footer'));
  refs.get('nominalValue').emit('change');assert.equal(changed,1);
  const count=form.querySelectorAll('input,select,textarea').length;api.mount(form);assert.equal(form.querySelectorAll('input,select,textarea').length,count);
});
test('Inspector tabs, frequency shortcut and settings keep keyboard and data state separate',()=>{
  const {api,doc,form}=fixture();let frequency=0,settings=0;api.mount(form,{onFrequency:()=>frequency++,onSettings:()=>settings++});
  const data=doc.getElementById('ipDataTab'),style=doc.getElementById('ipStyleTab');style.emit('click');
  assert.equal(style.getAttribute('aria-selected'),'true');assert.equal(doc.getElementById('ipDataPane').hidden,true);
  style.emit('keydown',{key:'ArrowLeft'});assert.equal(doc.activeElement,doc.getElementById('ipControlTab'));assert.equal(doc.getElementById('ipControlPane').hidden,false);
  doc.getElementById('ipControlTab').emit('keydown',{key:'ArrowLeft'});assert.equal(doc.activeElement,data);assert.equal(data.getAttribute('aria-selected'),'true');
  data.emit('keydown',{key:'ArrowLeft'});assert.equal(doc.activeElement,style);style.emit('keydown',{key:'Home'});assert.equal(doc.activeElement,data);
  doc.getElementById('ipEditFrequency').emit('click');form.querySelector('.ip-settings').emit('click');assert.equal(frequency,1);assert.equal(settings,1);
  api.update({page:2,zone:'B4',zoneSource:'auto',type:'GD&T',inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:10,snapshot:'data:image/png;base64,example'},3);
  assert.equal(doc.getElementById('ipLocation').textContent,'Sayfa 2 / 3');assert.match(doc.getElementById('ipZone').textContent,/B4/);assert.equal(doc.getElementById('ipFrequency').textContent,'Her 10 parçada');
  assert.equal(doc.getElementById('nominalValue').closest('.field').hidden,true);
  api.update({page:1,type:'Not'},3);assert.equal(doc.getElementById('ipMeasurement').hidden,true);
  assert.equal(doc.getElementById('selectionSnapshotImage').closest('.field').hidden,true);
  api.update({page:1,type:'Uzunluk',ocrText:'25 ±0.1'},3);assert.equal(doc.getElementById('ipMeasurement').hidden,false);assert.equal(doc.getElementById('nominalValue').closest('.field').hidden,false);
});
