const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  let doc;
  class Node{
    get parentElement(){return this.parent;}
    constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attrs={};this.events={};}
    append(...nodes){for(const n of nodes){if(n.parent)n.parent.children=n.parent.children.filter(x=>x!==n);n.parent=this;this.children.push(n);}}
    replaceChildren(...nodes){for(const n of this.children)n.parent=null;this.children=[];this.append(...nodes);}
    contains(n){return n===this||this.children.some(c=>c.contains(n));}
    querySelectorAll(s){return this.children.flatMap(n=>[...(s.split(',').some(v=>v.startsWith('#')?n.id===v.slice(1):v.startsWith('.')?n.className===v.slice(1):n.tagName===v)?[n]:[]),...n.querySelectorAll(s)]);}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
    closest(tag){return this.tagName===tag?this:this.parent?.closest(tag);}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,f){(this.events[k]||=[]).push(f);}
    emit(k,e={}){for(const f of this.events[k]||[])f({target:this,stopPropagation(){},...e});}
    focus(){doc.activeElement=this;}
  }
  const html=fs.readFileSync('src/app.template.html','utf8'),nav=html.slice(html.indexOf('<nav class="toolbar"'),html.indexOf('</nav>'));
  const toolbar=new Node('nav');toolbar.className='toolbar';
  for(const m of nav.matchAll(/<(button|input|span)[^>]*\bid="([^"]+)"/g)){const n=new Node(m[1]);n.id=m[2];toolbar.append(n);}
  for(const id of ['autoDetectButton','excelExportButton','acuiMetadataOpen','acuiCreateManual','acuiCreateNote']){const n=new Node('button');n.id=id;toolbar.append(n);}
  const page=new Node('body');page.append(toolbar);doc=new Node('document');doc.head=new Node('head');doc.createElement=tag=>new Node(tag);doc.querySelector=s=>page.querySelector(s);
  const ctx={window:{}};vm.runInNewContext(fs.readFileSync('src/workspace-layout.js','utf8'),ctx);
  return {doc,toolbar,api:ctx.window.ASMachWorkspaceLayout};
}
test('Toolbar groups every live control exactly once and retains handlers, disabled state and file inputs',()=>{
  const f=fixture(),original=f.toolbar.querySelectorAll('button,input,#zoomLabel');let clicked=0;
  const pdf=original.find(n=>n.id==='pdfButton');pdf.disabled=true;pdf.addEventListener('click',()=>clicked++);
  f.api.mount(f.doc);f.api.mount(f.doc);
  for(const n of original){assert.equal(f.toolbar.querySelector('#'+n.id),n);assert.equal(f.toolbar.querySelectorAll('#'+n.id).length,1);}
  assert.equal(pdf.disabled,true);pdf.emit('click');assert.equal(clicked,1);
  assert.ok(f.toolbar.querySelector('#fileInput'));assert.ok(f.toolbar.querySelector('#projectInput'));
  assert.equal(f.toolbar.querySelectorAll('details').length,3);
  assert.equal(f.toolbar.querySelector('#boxOcrModeButton').closest('details'),undefined,'Drawing modes stay visible');
  assert.ok(f.toolbar.querySelector('#excelExportButton').closest('details'));
  const appbar=f.toolbar.querySelector('.wl-appbar'),drawing=f.toolbar.querySelector('.wl-main');
  for(const id of ['openFileButton','saveProjectButton','pdfButton'])assert.ok(appbar.contains(f.toolbar.querySelector('#'+id)));
  for(const id of ['selectModeButton','boxOcrModeButton','autoDetectButton','undoButton','fitButton'])assert.ok(drawing.contains(f.toolbar.querySelector('#'+id)));
  assert.equal(f.toolbar.querySelector('#autoDetectButton').closest('details'),undefined,'Automatic detection stays directly accessible');
});
test('Menus support outside click, mutually exclusive expansion and Escape focus restoration',()=>{
  const f=fixture();f.api.mount(f.doc);const [a,b]=f.toolbar.querySelectorAll('details');
  a.open=true;b.open=true;b.emit('toggle');assert.equal(a.open,false);
  f.toolbar.emit('keydown',{key:'Escape'});assert.equal(b.open,false);assert.equal(f.doc.activeElement,b.querySelector('summary'));
  a.open=true;f.doc.emit('pointerdown');assert.equal(a.open,false);
});
test('Responsive structure reserves table space, hides inactive bulk tools and exposes numeric dimensions',()=>{
  const ui=fs.readFileSync('src/characteristic-ui.js','utf8'),layout=fs.readFileSync('src/workspace-layout.js','utf8');
  assert.match(ui,/filterNode.hidden=true/);assert.match(ui,/bulkTools.hidden=true/);
  assert.match(ui,/min-height:100px;max-height:314px;flex:1 1 auto/);
  assert.match(ui,/ÖLÇÜ \/ TOLERANS/);assert.match(ui,/font-size:12px!important/);
  assert.match(layout,/overflow:visible/);assert.match(layout,/@media\(max-width:700px\)/);
  assert.match(fs.readFileSync('src/app.template.html','utf8'),/ASMachWorkspaceLayout\?\.mount\(\)/);
});
