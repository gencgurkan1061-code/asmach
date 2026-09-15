const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// A small event-capable DOM adapter exercises the extension without launching a browser.
const nodes = new Map();
const all = new Set();
const decode = value => String(value || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase(); this.dataset = {}; this.style = {}; this.listeners = {}; this.children = [];
    this.value = ""; this.textContent = ""; this.hidden = false; this.open = false; this.options = []; this.isConnected = true;
    this.className = "";
    this.classList = {
      add: name => this.className = [...new Set([...this.className.split(" "), name])].join(" ").trim(),
      remove: name => this.className = this.className.split(" ").filter(item => item !== name).join(" "),
      contains: name => this.className.split(" ").includes(name),
      toggle: name => { const next = !this.classList.contains(name); this.classList[next ? "add" : "remove"](name); return next; },
    };
    all.add(this);
  }
  set id(value) { this._id = value; nodes.set(`#${value}`, this); }
  get id() { return this._id; }
  set innerHTML(html) {
    this._html = html;
    if (this.tagName === "SELECT") {
      this.options = [...html.matchAll(/<option value="([^"]*)"([^>]*)>(.*?)<\/option>/gs)].map(match => ({ value: decode(match[1]), textContent: decode(match[3]), selected: /selected/.test(match[2]) }));
      this.value = (this.options.find(option => option.selected) || this.options[0])?.value || "";
    }
    for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/g)) {
      const opening = match[0];
      const id = opening.match(/\bid="([^"]+)"/);
      const data = [...opening.matchAll(/\bdata-([\w-]+)(?:="([^"]*)")?/g)];
      if (!id && !data.length) continue;
      const element = new Element(match[1]);
      element.parentElement = this;
      if (id) element.id = id[1];
      for (const attribute of data) {
        const name = attribute[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        element.dataset[name] = decode(attribute[2] || "");
        nodes.set(`[data-${attribute[1]}="${attribute[2] || ""}"]`, element);
      }
      if (element.tagName === "SELECT") {
        const after = html.slice(match.index + opening.length);
        element.innerHTML = after.slice(0, after.indexOf("</select>"));
      }
      if (opening.includes(" checked")) element.checked = true;
    }
  }
  get innerHTML() { return this._html || ""; }
  querySelector(selector) {
    if (selector === '#acuiNumericSection>h3') return nodes.get('#acuiNumericSection');
    if (selector === ".acui-inline-input") return null;
    if (selector === "colgroup") return null;
    if (selector === "thead") return base.thead;
    return nodes.get(selector) || null;
  }
  querySelectorAll(selector) {
    const data = selector.match(/^\[data-([\w-]+)\]$/);
    if (!data) return [];
    const key = data[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return [...all].filter(element => key in element.dataset);
  }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  prepend(child) { this.append(child); }
  insertBefore(child) { this.append(child); }
  before(child) { this.parentElement?.append(child); }
  after(child) { this.parentElement?.append(child); }
  remove() { this.isConnected = false; }
  removeAttribute(name) { delete this[name]; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  emit(type, values = {}) { for (const callback of this.listeners[type] || []) callback({ target: this, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...values }); }
  closest(selector) {
    if (selector === "table") return base.table;
    if (selector === ".list-panel") return base.panel;
    if (selector === ".table-wrap") return base.tableWrap;
    if (selector === ".acui-field") return this.wrapper ||= new Element("label");
    return this.parentElement;
  }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit("close"); }
  focus() { document.activeElement = this; }
  scrollIntoView() {}
  add(option) { this.options.push(option); }
}
const base = { toolbar: new Element("nav"), spacer: new Element(), panel: new Element(), table: new Element("table"), tableWrap: new Element(), thead: new Element("thead"), body: new Element("tbody"), selectionForm: new Element(), search: new Element("input") };
nodes.set(".toolbar", base.toolbar); nodes.set(".toolbar-spacer", base.spacer);
nodes.set('#acuiEditor .acui-editor-main',new Element('div'));
const document = { head: new Element("head"), body: new Element("body"), activeElement: null, createElement: tag => new Element(tag), querySelector: selector => nodes.get(selector) || null, querySelectorAll: selector => document.body.querySelectorAll(selector) };
const context = { window: {}, document, crypto: { randomUUID: () => "test-uuid" }, setTimeout, clearTimeout, Option: function (label, value) { this.textContent = label; this.value = value; } };
context.globalThis = context;
vm.createContext(context);
for(const name of ['inspection-plan','characteristic-dock'])vm.runInContext(fs.readFileSync(path.join(__dirname,`../src/${name}.js`),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/requirements-engine.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/characteristic-ui.js"), "utf8"), context);
// The requirements engine also supports Node globals; expose it through the page's window.
context.window.ASMachRequirements ||= context.ASMachRequirements;
const record = { id: "sample", number: "1", page: 1, sheetNo: "1", type: "Uzunluk", requirement: "20 ±0.1", nominalValue: "20", lowerTolerance: "-0.1", upperTolerance: "0.1", lowerLimit: "19.9", upperLimit: "20.1", unit: "mm", evaluationMethod: "VALUE", result: "20", status: "needs_review", inspectionMethod: "CALIPER", color: "#07899a", bubbleX: 0.5, bubbleY: 0.5 };
const state = { annotations: [record], metadata: {}, generalTolerance: {}, auditLog: [], fileData: "data:application/pdf;base64,test", pageCount: 1, selectedId: "sample", search: "" };
let checkpointCount = 0;
let parseCount = 0;
const ui = context.window.ASMachCharacteristicUI;
const uiBridge={
  state,
  elements: { balloonTableBody: base.body, selectionForm: base.selectionForm, searchInput: base.search },
  getMethods: () => [{ value: "CALIPER", label: "Kumpas" },{value:"CMM",label:"CMM"}],
  applyMethodStyle: (item,method) => {item.inspectionMethod=method;item.color=method==='CMM'?'#df3f4f':'#07899a';},
  methodLabel: () => "Kumpas",
  selectedAnnotation: () => record,
  checkpoint: () => checkpointCount++,
  renderAll: () => ui.render(),
  parseRequirement: () => { parseCount++; return { type: "Uzunluk", nominalValue: "30", lowerTolerance: "-2", upperTolerance: "2", lowerLimit: "28", upperLimit: "32", unit: "mm", evaluationMethod: "VALUE", upperInclusive: true, lowerInclusive: true }; },
  toast() {},
};
ui.init(uiBridge);
const field = name => nodes.get(`[data-characteristic-field="${name}"]`);
const input = (name, value) => { field(name).value = value; nodes.get("#acuiEditor").emit("input", { target: field(name) }); };
const save = () => nodes.get("#acuiEditorForm").emit("submit");

// The planning list must never render editable inspection results or status.
assert.doesNotMatch(base.thead.innerHTML,/SONUÇ|DURUM/);
assert.doesNotMatch(base.body.innerHTML,/data-editable="(?:result|status)"/);
assert.match(base.thead.innerHTML,/BİLGİ KONTROLÜ/);
assert.match(base.body.innerHTML,/Kontrol sıklığı eksik/);
assert.equal(nodes.get('#acuiFilterPanel').hidden,true);
assert.equal(nodes.get('#acuiBulkTools').hidden,true);
assert.match(base.body.innerHTML,/20 ±0.1 mm/);
nodes.get('#acuiFilterToggle').emit('click');assert.equal(nodes.get('#acuiFilterPanel').hidden,false);
nodes.get('#acuiFilterToggle').emit('click');assert.equal(nodes.get('#acuiFilterPanel').hidden,true);
const filterNode=base.panel.children.find(e=>e.className==='acui-filters');
const filter=(name,value)=>{const el=nodes.get(`[data-acui-filter="${name}"]`);el.value=value;filterNode.emit('change',{target:el});};
filter('completeness','complete');assert.match(base.body.innerHTML,/Filtrelere uyan karakteristik bulunamadı/);
filter('completeness','frequency');assert.match(base.body.innerHTML,/data-id="sample"/);
filter('method','CMM');assert.doesNotMatch(base.body.innerHTML,/data-id="sample"/);
nodes.get('#acuiClearFilters').emit('click');assert.match(base.body.innerHTML,/data-id="sample"/);
filter('zone','__missing');assert.match(base.body.innerHTML,/data-id="sample"/);
filter('frequency','__missing');assert.match(base.body.innerHTML,/data-id="sample"/);
filter('confidence','manual');assert.match(base.body.innerHTML,/data-id="sample"/);
assert.match(nodes.get('#acuiExtraFilterCount').textContent,/2 etkin/);
nodes.get('#acuiClearFilters').emit('click');
state.search='kumpas UZUNLUK';ui.render();assert.match(base.body.innerHTML,/data-id="sample"/);
nodes.get('#acuiClearFilters').emit('click');
assert.equal(record.result,'20');assert.equal(record.status,'needs_review');

ui.openEditor("sample");
assert.ok(nodes.get("#acuiEditor").classList.contains("open"));
assert.ok(nodes.get("#acuiEditor").classList.contains("asmach-modal"), "Native dialog matches application's keyboard guard");
input("nominalValue", "40");
const requirementParseCount=parseCount;
input("requirement", "30 ±2");
assert.equal(parseCount,requirementParseCount,'Editing requirement never reparses dimensions');
assert.equal(field('lowerLimit').value,'39.9','Current tolerances are untouched');
record.ocrText='30 ±2';
nodes.get('#acuiReadSource').emit('click');
assert.equal(field("nominalValue").value, "40", "Reparsing preserves manual nominal");
assert.equal(field("lowerLimit").value, "38", "Limits use retained manual nominal");
input("result", "40");
const beforeSaveParseCount = parseCount;
save();
assert.equal(record.nominalValue, "40");
assert.equal(record.lowerLimit, "38");
assert.equal(record.upperLimit, "42");
assert.equal(record.result, "40", "Raw measured result is preserved");
assert.equal(record.resultStatus, "pass", "Persisted outcome uses application's normalized status");
assert.equal(parseCount, beforeSaveParseCount, "Save never reparses entered values");
assert.ok(record.manualFields.includes("nominalValue"));
assert.equal(checkpointCount, 1);
assert.equal(nodes.get("#acuiEditor").classList.contains("open"), false);

record.type = "Diş"; record.threadPitch = "20 TPI"; record.requirement = "1/4-20 UNC-2B"; record.evaluationMethod = "OK_NOT_OK"; record.result = "OK";
ui.openEditor("sample"); save();
assert.equal(record.threadPitch, "20 TPI", "Inch thread pitch does not fail numeric validation");
assert.equal(checkpointCount, 2);

record.type = "GD&T"; record.requirement = "⌖ | Ø0.2 | A | B"; record.nominalValue = ""; record.upperTolerance = "0.2"; record.evaluationMethod = "VALUE"; record.result = "0.1"; record.manualFields = [];
ui.openEditor("sample");
nodes.get("#acuiRecalculateLimits").emit("click");
assert.equal(field("lowerLimit").value, "0");
assert.equal(field("upperLimit").value, "0.2");
save();
assert.equal(record.resultStatus, "pass");
assert.equal(checkpointCount, 3);
console.log("Characteristic UI interaction tests passed: manual override, save, result status, modal guard, TPI and GD&T limits.");
const second={...record,id:'second',number:'2',requirement:'BULK_TARGET',inspectionMethod:'CALIPER',manualFields:[]};
const third={...record,id:'third',number:'3',inspectionMethod:'CALIPER',manualFields:[]};
state.annotations.push(second,third);ui.render();
state.search='BULK_TARGET';ui.render();
const selectAll=nodes.get('#acuiBulkAll');selectAll.checked=true;selectAll.emit('change',{target:selectAll});
nodes.get('#acuiBulkMethod').value='CMM';
const beforeBulk=checkpointCount;nodes.get('#acuiBulkApply').emit('click');
assert.equal(second.inspectionMethod,'CMM');assert.equal(second.color,'#df3f4f');
assert.equal(third.inspectionMethod,'CALIPER');assert.equal(record.inspectionMethod,'CALIPER');
assert.equal(checkpointCount,beforeBulk+1,'Bulk update is one undo checkpoint');
assert.ok(second.manualFields.includes('inspectionMethod'));
nodes.get('#acuiBulkClear').emit('click');
assert.equal(nodes.get('#acuiBulkApply').disabled,true);
console.log('Bulk selection tests passed: filtered selection, method style, untouched unselected rows, clear and one checkpoint.');

// Frequency updates are validated, scoped to selected records and persisted in the editor.
selectAll.checked=true;selectAll.emit('change',{target:selectAll});
nodes.get('#acuiBulkFrequency').value='EVERY_N_PIECES';nodes.get('#acuiBulkInterval').value='0';
const beforeFrequency=checkpointCount;nodes.get('#acuiBulkFrequencyApply').emit('click');
assert.equal(checkpointCount,beforeFrequency,'Invalid sampling intervals must not mutate records');
nodes.get('#acuiBulkInterval').value='10';nodes.get('#acuiBulkFrequencyNote').value='Üretim kontrolü';nodes.get('#acuiBulkFrequencyApply').emit('click');
assert.equal(second.inspectionFrequency,'EVERY_N_PIECES');assert.equal(second.frequencyInterval,'10');assert.equal(third.inspectionFrequency,'');
assert.equal(checkpointCount,beforeFrequency+1);
ui.openEditor('second');assert.equal(field('frequencyInterval').value,'10');save();assert.equal(second.frequencyNote,'Üretim kontrolü');
ui.openEditor('second');input('inspectionFrequency','CUSTOM');input('frequencyNote','');const beforeInvalid=checkpointCount;save();assert.equal(checkpointCount,beforeInvalid);
input('frequencyNote','Partiden 3 adet');save();assert.equal(second.frequencyNote,'Partiden 3 adet');

// Notes keep their explicit type, do not inherit dimensional limits and use binary evaluation.
ui.openEditor('sample');input('type','Not');const noteParseCount=parseCount;input('requirement','Not 3: Malzeme sertifikası sağlanacak');
assert.equal(parseCount,noteParseCount);assert.equal(field('type').value,'Not');
assert.match(nodes.get('#acuiNoteMethods').innerHTML,/Doküman \/ sertifika kontrolü/);
assert.ok(nodes.get('#acuiNumericSection').hidden);
save();assert.equal(record.type,'Not');assert.equal(record.nominalValue,'');assert.equal(record.upperTolerance,'');assert.equal(record.evaluationMethod,'OK_NOT_OK');assert.equal(record.autoParse,false);
ui.openEditor('sample');assert.equal(nodes.get('#acuiAutoParse').checked,false);
console.log('Frequency and note tests passed: bulk validation, custom plan, persistence, binary evaluation and method suggestions.');

// GD&T enum selection is protected independently from the recognized source symbol.
Object.assign(record, context.window.ASMachRequirements.parse('⌖ | Ø0.2 | A | B'));
Object.assign(record, {type:'GD&T',requirement:'⌖ | Ø0.2 | A | B',result:'',manualFields:[],autoParse:true});
ui.openEditor('sample');
assert.equal(field('gdtSubtype').tagName,'SELECT');
assert.equal(field('gdtSubtype').value,'position');
assert.ok(field('gdtSubtype').options.some(option=>option.value==='total_runout'));
input('gdtSubtype','parallelism');
assert.match(nodes.get('#acuiGdtFrame').innerHTML,/∥/);
input('requirement','⌖ | Ø0.3 | A | B');
assert.equal(field('gdtSubtype').value,'parallelism','Manual subtype survives automatic reparse');
assert.equal(field('type').value,'GD&T');
save();
assert.equal(record.gdtSubtype,'parallelism');
assert.equal(record.gdtFrame.symbol,'∥');
assert.ok(record.manualFields.includes('gdtSubtype'));
assert.equal(record.nominalValue,'');
ui.openEditor('sample');
assert.equal(field('gdtSubtype').value,'parallelism','Reopening restores enum selection');
console.log('GD&T editor tests passed: enum choices, live frame, protected subtype and reopen.');
const editDatum=(index,value)=>{const element=nodes.get(`[data-datum-slot="${index}"]`);element.value=value;nodes.get('#acuiEditor').emit('input',{target:element});};
editDatum(0,'D');editDatum(1,'E');editDatum(2,'F');
assert.equal(field('datumRefs').value,'D | E | F');save();assert.equal(record.datumRefs,'D | E | F');
assert.ok(record.manualFields.includes('datumRefs'));ui.openEditor('sample');assert.equal(nodes.get('[data-datum-slot="2"]').value,'F');

Object.assign(record, context.window.ASMachRequirements.parse('Ø50 d6'));
Object.assign(record,{requirement:'Ø5 0 d6',ocrText:'Ø5 0 d6',requirementMode:'auto',manualFields:[],result:''});
ui.openEditor('sample');
assert.equal(field('requirement').value,'Ø50 d6 (-0.08/-0.096)');
input('nominalValue','55');assert.equal(field('requirement').value,'Ø55 d6 (-0.08/-0.096)');
const beforeManual=parseCount;input('requirement','Özel kabul: çizime bakınız');input('nominalValue','60');
assert.equal(parseCount,beforeManual);assert.equal(field('requirement').value,'Özel kabul: çizime bakınız');
save();assert.equal(record.requirementMode,'manual');assert.equal(record.nominalValue,'60');
ui.openEditor('sample');assert.equal(nodes.get('#acuiAutoParse').checked,false);
nodes.get('#acuiParse').emit('click');assert.equal(nodes.get('#acuiAutoParse').checked,true);
assert.equal(field('requirement').value,'Ø60 d6 (-0.08/-0.096)');
save();assert.equal(record.requirementMode,'auto');assert.ok(!record.manualFields.includes('requirement'));
assert.equal(record.ocrText,'Ø5 0 d6');
console.log('Generated requirement interaction checks passed: field updates, manual protection, explicit reset and independent OCR.');

require('node:test').test('Region editing retains unsaved fields, saves one geometry transaction and discards cancelled drafts',async()=>{
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const box={x:.2,y:.3,w:.1,h:.05,rotation:25,points:[{x:.2,y:.3},{x:.3,y:.32},{x:.29,y:.37},{x:.19,y:.35}]};
  let result={selectionBox:box,snapshot:'data:image/png;base64,bmV3',page:1,anchorX:.25,anchorY:.325},seen;
  context.window.ASMachCharacteristicRegion={open:async(app,draft,options)=>{seen={draft,options};return result;}};
  ui.openEditor('sample');input('nominalValue','72');input('requirement','Elle düzeltilen ölçü');
  const before=JSON.stringify(record),checkpoints=checkpointCount;
  nodes.get('#acuiReselectRegion').emit('click');await tick();
  assert.equal(seen.options.reselect,true);assert.equal(seen.draft.nominalValue,'72');
  assert.equal(JSON.stringify(record),before,'Region acceptance is still only a form draft');
  assert.equal(field('nominalValue').value,'72');assert.equal(field('requirement').value,'Elle düzeltilen ölçü');
  assert.equal(nodes.get('#acuiSnapshot').src,result.snapshot);assert.equal(nodes.get('#acuiEditor').open,true);
  save();assert.equal(checkpointCount,checkpoints+1);assert.equal(record.selectionBox.rotation,25);
  assert.equal(record.nominalValue,'72');assert.equal(record.snapshot,result.snapshot);
  ui.openEditor('sample');const saved=JSON.stringify(record);
  result={...result,snapshot:'data:image/png;base64,Y2FuY2Vs'};
  nodes.get('#acuiEditRegion').emit('click');await tick();assert.equal(seen.options.reselect,false);
  nodes.get('#acuiEditor').close();assert.equal(JSON.stringify(record),saved,'Cancelling main form discards accepted region draft');
  ui.openEditor('sample');assert.equal(nodes.get('#acuiSnapshot').src,record.snapshot);
  input('nominalValue','73');result=null;
  nodes.get('#acuiReselectRegion').emit('click');await tick();
  assert.equal(field('nominalValue').value,'73');assert.equal(JSON.stringify(record),saved);
  context.window.ASMachCharacteristicRegion.open=async()=>{throw new Error('capture failed');};
  nodes.get('#acuiEditRegion').emit('click');await tick();
  assert.equal(nodes.get('#acuiEditor').open,true);assert.equal(field('nominalValue').value,'73');
});

require('node:test').test('Detail form resolves number conflicts on save and cancellation preserves its unsaved fields',async()=>{
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/balloon-numbering.js'),'utf8'),context);
  const n=context.window.ASMachBalloonNumbering;
  const other={...record,id:'number-conflict-test',number:'812'};state.annotations.push(other);
  uiBridge.planNumberChange=(id,value)=>n.plan(state.annotations,id,value);
  uiBridge.validNumberChange=p=>n.valid(state.annotations,p);
  uiBridge.applyNumberChange=p=>n.apply(state.annotations,p);
  let choice=null,asked=0;
  uiBridge.resolveNumberChange=async(id,value)=>{asked++;return choice?n.plan(state.annotations,id,value,choice):null;};
  const old=record.number,before=checkpointCount;
  ui.openEditor(record.id);input('number','812');input('comment','Taslak korunmalı');save();await new Promise(r=>setImmediate(r));
  assert.equal(asked,1);assert.equal(record.number,old);assert.equal(other.number,'812');assert.equal(checkpointCount,before);
  assert.equal(nodes.get('#acuiEditor').open,true);assert.equal(field('comment').value,'Taslak korunmalı');
  choice='swap';save();await new Promise(r=>setImmediate(r));
  assert.equal(record.number,'812');assert.equal(other.number,old);assert.equal(record.comment,'Taslak korunmalı');assert.equal(checkpointCount,before+1);
});

require('node:test').test('Bulk delete control passes the complete explicit selection without deleting records itself',()=>{
  let removed;uiBridge.removeAnnotations=ids=>removed=[...ids];
  const ids=state.annotations.slice(0,2).map(r=>r.id),before=state.annotations.length;
  ui.selectIds(ids);ui.render();assert.equal(nodes.get('#acuiBulkDelete').disabled,false);
  nodes.get('#acuiBulkDelete').emit('click');assert.deepEqual(removed,ids);assert.equal(state.annotations.length,before);
  ui.selectIds([]);ui.render();assert.equal(nodes.get('#acuiBulkDelete').disabled,true);
});

require('node:test').test('Reselected measurement fields replace stale parent values and commit with the crop as one draft',async()=>{
  const before=JSON.stringify(record),box={x:.2,y:.3,w:.15,h:.03};
  context.window.ASMachCharacteristicRegion={open:async()=>({page:1,selectionBox:box,snapshot:'data:image/png;base64,new',type:'Çap',fitClass:'',nominalValue:'24.5',lowerTolerance:'-0.05',upperTolerance:'0.05',lowerLimit:'24.45',upperLimit:'24.55',unit:'mm',toleranceExplicit:true,requirementMode:'auto',requirement:'Ø24.5 ±0.05',ocrText:'Ø24.5 ±0.0 5'})};
  ui.openEditor(record.id);nodes.get('#acuiReselectRegion').emit('click');await new Promise(r=>setImmediate(r));
  assert.equal(JSON.stringify(record),before);assert.equal(field('lowerTolerance').value,'-0.05');assert.equal(field('upperLimit').value,'24.55');assert.equal(field('requirement').value,'Ø24.5 ±0.05');
  save();assert.equal(record.lowerTolerance,'-0.05');assert.equal(record.upperLimit,'24.55');assert.equal(record.snapshot,'data:image/png;base64,new');assert.equal(record.ocrText,'Ø24.5 ±0.0 5');
});
