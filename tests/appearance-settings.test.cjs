const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Minimal non-browser DOM contract for settings events. No GUI/page execution.
class Node{
 constructor(tag='div',attrs={}){this.tagName=tag;this.attrs=attrs;this.children=[];this.parentElement=null;this.dataset={};for(const[k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;this.value=attrs.value||'';this.checked='checked'in attrs;this.type=attrs.type||'';this.className=attrs.class||'';this.disabled=false;this.scrollTop=0;this.scrollLeft=0;}
 get classList(){return{contains:v=>this.className.split(' ').includes(v)};}
 append(n){n.parentElement=this;this.children.push(n);}before(n){const p=this.parentElement;p.children.splice(p.children.indexOf(this),0,n);n.parentElement=p;}
 matches(s){if(s.startsWith('.'))return this.className.split(' ').includes(s.slice(1));const m=s.match(/^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/);return m?m[1]in this.attrs&&(m[2]===undefined||this.attrs[m[1]]===m[2]):s===this.tagName;}
 closest(s){for(let n=this;n;n=n.parentElement)if(n.matches(s))return n;return null;}
 querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}
 set innerHTML(html){this.children=[];const stack=[this];for(const m of html.matchAll(/<\/?([\w-]+)\b([^>]*?)>/g)){const[tag,attrs]=[m[1],m[2]];if(m[0].startsWith('</')){if(stack.length>1)stack.pop();continue;}const a={};for(const p of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g))a[p[1]]=p[2]??'';const n=new Node(tag,a);stack.at(-1).append(n);if(!['input','br','hr'].includes(tag)&&!m[0].endsWith('/>'))stack.push(n);}}
 focus(){this.focused=true;}
}
function fixture(){const head=new Node('head'),container=new Node(),document={head,getElementById:()=>null,createElement:t=>new Node(t)},c={window:{},document};for(const n of ['balloon-appearance','appearance-settings'])vm.runInNewContext(fs.readFileSync(`src/${n}.js`,'utf8'),c);
 const source={color:'#07899a',size:46,fontSize:20,opacity:1,shape:'circle',arrowEnabled:true,arrowStyle:'open',...c.window.ASMachBalloonAppearance.normalize()};
 const draft={methods:[{value:'A',label:'Kumpas'},{value:'B',label:'CMM'}],styles:{A:{...source},B:{...source,color:'#ee0000'}},activeMethod:'A'},removed=[];
 c.window.ASMachAppearanceSettings.mount(container,{draft,fallback:()=>({...source}),copyDimensions:()=>{},removeMethod:k=>removed.push(k)});
 const event=(target)=>({target,stopPropagation(){}}),input=(key,value,type='number',commit=false)=>{const el=container.querySelectorAll(`[data-edit="${key}"]`).find(n=>n.type===type)||container.querySelector(`[data-edit="${key}"]`);el.value=value;container[commit?'onchange':'oninput'](event(el));return el;};return{container,draft,input,event,removed};}
test('Compact editor keeps draft isolated, synchronizes sliders, and accepts decimal thickness without typing jumps',()=>{
 const {container,draft,input}=fixture();assert.equal(container.querySelectorAll('[data-pick]').length,2);assert.equal(container.querySelectorAll('.appearance-detail').length,1);
 input('boxLineWidth','2.7');assert.equal(draft.styles.A.boxLineWidth,2.7);assert.equal(container.querySelector('[data-edit="boxLineWidth"]').value,'2.7');
 input('boxPadding','12');assert.equal(draft.styles.A.boxPadding,12);assert.equal(container.querySelector('[data-edit="boxPadding"]').value,'12');
 input('size','1');assert.equal(draft.styles.A.size,46);input('size','18');assert.equal(draft.styles.A.size,18);const el=input('boxLineWidth','', 'number',true);assert.equal(el.value,2.7);
});
test('Copying line appearance preserves colors; method selection and deletion target the right method',()=>{
 const {container,draft,input,event,removed}=fixture();input('balloonLineWidth','4.5');container.onclick(event(container.querySelector('[data-copy="lines"]')));assert.equal(draft.styles.B.balloonLineWidth,4.5);assert.equal(draft.styles.B.color,'#ee0000');
 container.onclick(event(container.querySelector('[data-pick="B"]')));assert.equal(draft.activeMethod,'B');input('boxLineStyle','none','select');assert.equal(draft.styles.B.boxLineStyle,'none');assert.equal(draft.styles.A.boxLineStyle,'solid');assert.equal(container.querySelector('[data-edit="boxLineWidth"]').disabled,true);
 container.onclick(event(container.querySelector('[data-delete]')));assert.deepEqual(removed,['B']);
});
