(function () {
  "use strict";

  let bridge;
  let initialized = false;
  let editorId = "";
  let opener = null;
  let parsing = false;
  let rowClickTimer = null;
  let parsedMetadata = {};
  let regionDraft = {};
  let regionEditing = false;
  let rolePlanEditor=null;
  const manualFields = new Set();
  const bulkSelection = new Set();
  let visibleBulkIds = [];
  let bulkRecords = null;
  let dock;
  const plan = () => window.ASMachInspectionPlan;
  const filters = { type: "", page: "", zone: "", method: "", completeness: "", frequency: "", confidence: "", sort: "number" };
  const fallbackTypes = ["Ölçü", "Uzunluk", "Çap", "Yarıçap", "Diş", "Pah", "Açı", "Geçme", "Tolerans", "GD&T", "Datum", "Yüzey", "Not", "Malzeme", "Proses", "Diğer"];
  const fallbackStatuses = [
    { value: "needs_review", label: "İnceleme bekliyor" },
    { value: "approved", label: "Onaylandı" },
    { value: "rejected", label: "Reddedildi" },
    { value: "measured", label: "Ölçüldü" },
    { value: "pass", label: "Uygun" },
    { value: "fail", label: "Uygun değil" },
  ];
  const editableFields = ["number", "page", "sheetNo", "zone", "type", "requirement", "nominalValue", "unit", "lowerTolerance", "upperTolerance", "lowerLimit", "upperLimit", "evaluationMethod", "inspectionMethod", "status", "result", "datumRefs", "specialDesignator", "nonconformanceNo", "comment", "toleranceStandard", "gdtSubtype", "fitClass", "threadPitch", "threadClass", "threadStandard"];
  const parsedFields = ["type", "nominalValue", "lowerTolerance", "upperTolerance", "lowerLimit", "upperLimit", "unit", "evaluationMethod", "toleranceStandard", "datumRefs", "gdtSubtype", "fitClass", "threadPitch", "threadClass", "threadStandard"];
  editableFields.push('inspectionFrequency','frequencyInterval','frequencyNote');
  const numericFields = ["nominalValue", "lowerTolerance", "upperTolerance", "lowerLimit", "upperLimit"];
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const text = value => String(value ?? "");
  const escape = value => text(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const dataImage = value => /^data:image\/(?:png|jpeg|webp|bmp|gif);base64,/i.test(text(value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const engine = () => window.ASMachRequirements || {};
  const types = () => engine().TYPES || fallbackTypes;
  const statuses = () => engine().STATUSES || fallbackStatuses;
  const methods = () => bridge.getMethods ? bridge.getMethods() : [...(bridge.elements.inspectionMethod?.options || [])].map(option => ({ value: option.value, label: option.textContent }));
  const state = () => bridge.state;
  const valueString = value => Array.isArray(value) ? value.join(" | ") : text(value);
  const field = name => $(`[data-characteristic-field="${name}"]`);
  const normalizedNumber = value => text(value).trim().replace(/,/g, ".");
  const finiteNumber = value => normalizedNumber(value) !== "" && Number.isFinite(Number(normalizedNumber(value)));
  const rounded = value => String(Number(Number(value).toFixed(9)));
  const informationIssues = record => plan().checkInformation(record, { methods: methods(), pageCount: state().pageCount });
  const searchText = value => text(value).toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
  function measurementSummary(record){
    if(record.type==='Açı'&&record.angleFormat==='dms')return engine().generateRequirement(record)||'—';
    const profile=engine().fieldProfile?.(record.type);
    if(profile&&!profile.numeric)return '—';
    const number=v=>finiteNumber(v)?engine().displayNumber(v,record):'';
    const nominal=number(record.nominalValue),lower=number(record.lowerTolerance),upper=number(record.upperTolerance);
    const prefix=record.type==='Çap'?'Ø':record.type==='Yarıçap'?'R':'';
    let result=nominal?prefix+nominal:record.type==='GD&T'?'GD&T':'';
    if(lower!==''&&upper!==''&&Number(upper)>0&&Number(lower)===-Number(upper))result+=` ±${upper}`;
    else if(lower!==''||upper!=='')result+=` (${upper!==''?(Number(upper)>0?'+':'')+upper:'—'} / ${lower!==''?(Number(lower)>0?'+':'')+lower:'—'})`;
    const lo=number(record.lowerLimit),hi=number(record.upperLimit);
    if(!result&&(lo!==''||hi!==''))result=`${lo||'—'} … ${hi||'—'}`;
    return result.trim()+(result&&record.unit?' '+record.unit:'')||'Ölçü bilgisi eksik';
  }

  function options(items, selected, allLabel) {
    return (allLabel ? `<option value="">${escape(allLabel)}</option>` : "") + items.map(item => {
      const value = typeof item === "string" ? item : item.value;
      const label = typeof item === "string" ? item : item.label;
      return `<option value="${escape(value)}"${text(value) === text(selected) ? " selected" : ""}>${escape(label)}</option>`;
    }).join("");
  }

  function statusLabel(value) {
    return statuses().find(item => item.value === value)?.label || ({ TASLAK: "Taslak", KONTROL: "İnceleme bekliyor", ONAYLI: "Onaylı" }[value]) || value || "İnceleme bekliyor";
  }

  function evaluate(record) {
    return engine().evaluate ? engine().evaluate(record) : { result: "pending", resultStatus: "BEKLIYOR", label: "Sonuç bekleniyor", note: "" };
  }

  function confidence(record) {
    const raw = record.detectionConfidence ?? record.recognitionConfidence;
    if (raw === null || raw === undefined || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value <= 1 && value > 0 ? value * 100 : value)) : null;
  }

  function dateLabel(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  }

  function recordChange(action, record) {
    const timestamp = new Date().toISOString();
    if (record) {
      record.createdAt ||= timestamp;
      record.updatedAt = timestamp;
      const evaluation = evaluate(record);
      record.resultStatus = evaluation.status || evaluation.result || "pending";
    }
    if (bridge.recordChange) bridge.recordChange(action, record);
    else {
      state().auditLog ||= [];
      state().auditLog.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, at: timestamp, action, annotationId: record?.id || "", number: record?.number || "" });
    }
  }

  function applyMethod(record, method) {
    const apply = bridge.applyMethodStyle || bridge.applyMethodToAnnotation;
    if (apply) apply(record, method);
  }

  function init(api) {
    if (initialized) return;
    bridge = api;
    initialized = true;
    installStyle();
    installToolbar();
    installDialogs();
    installTable();
    installInspector();
    render();
  }

  function installStyle() {
    const style = document.createElement("style");
    style.id = "asmach-characteristic-ui-style";
    style.textContent = `
      .acui-dialog{border:1px solid #ccdbe8;border-radius:16px;padding:0;width:min(1120px,calc(100vw - 36px));max-width:none;max-height:calc(100vh - 36px);color:#132b41;background:#fff;box-shadow:0 24px 80px #06172f45;font:12px/1.5 Inter,"Segoe UI",Arial,sans-serif}
      .acui-dialog::backdrop{background:#07172a99;backdrop-filter:blur(3px)}
      .acui-dialog *{box-sizing:border-box}.acui-dialog[open]{display:flex;flex-direction:column}
      .acui-head{padding:15px 20px;background:linear-gradient(110deg,#07182e,#0b3948);color:#fff;display:flex;justify-content:space-between;gap:16px;align-items:center;flex:none}
      .acui-eyebrow{font-size:10px;letter-spacing:1.5px;font-weight:800;color:#70e1e6}.acui-head h2{font-size:18px;margin:2px 0 0;font-weight:700}.acui-head p{font-size:11px;color:#c1d9e4;margin:3px 0 0}
      .acui-close{border:1px solid #ffffff45;background:#ffffff12;color:white;width:30px;height:30px;border-radius:8px;font-size:20px;cursor:pointer}
      .acui-content{overflow:auto;padding:18px 20px;min-height:0}.acui-editor-layout{display:grid;grid-template-columns:minmax(0,1fr) 242px;gap:18px}
      .acui-section{border:1px solid #dbe5ef;background:#fff;border-radius:10px;padding:12px;margin-bottom:12px}.acui-section:last-child{margin-bottom:0}.acui-section h3{font-size:12px;margin:0 0 9px;font-weight:750;color:#25465d}.acui-section p{margin:5px 0 0;color:#667d91;font-size:11px}
      .acui-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px 10px}.acui-field{display:flex;flex-direction:column;gap:4px;min-width:0}.acui-field>span{font-size:10px;font-weight:750;letter-spacing:.15px;color:#587086}.acui-span2{grid-column:span 2}.acui-full{grid-column:1/-1}
      .acui-field input,.acui-field select,.acui-field textarea,.acui-filters select,.acui-inline-input{width:100%;min-width:0;border:1px solid #cbd9e6;border-radius:6px;background:#fff;padding:6px 8px;color:#17344a;font:12px/1.4 inherit;min-height:31px;outline:none}.acui-field textarea{resize:vertical;min-height:57px}.acui-field input:focus,.acui-field select:focus,.acui-field textarea:focus,.acui-inline-input:focus{border-color:#0795a3;box-shadow:0 0 0 2px #0795a315}.acui-field input:disabled{background:#f3f6f9;color:#728398}.acui-field [data-manual="true"]{border-left:3px solid #e69a23}
      .acui-foot{padding:12px 20px;border-top:1px solid #e1e9f1;display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:none;background:#f8fbfd}.acui-foot .acui-foot-note{margin-right:auto;color:#6c8193;font-size:10px}.acui-foot .btn,.acui-actions .btn{min-height:31px;font-size:11px;padding:6px 10px}.acui-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;flex-wrap:wrap}.acui-check{display:inline-flex;align-items:center;gap:6px;color:#526e83;font-size:11px}.acui-check input{accent-color:#078c9d;width:14px;height:14px;flex:none}.acui-subtle{font-size:10px;color:#70859a}
      .acui-snapshot{width:100%;max-height:190px;object-fit:contain;border:1px solid #dce5ed;border-radius:6px;background:white;display:block;padding:7px}.acui-no-snapshot{display:grid;place-items:center;min-height:120px;background:repeating-linear-gradient(45deg,#f7fafc,#f7fafc 5px,#f1f6f9 5px,#f1f6f9 6px);border:1px dashed #c4d4e0;border-radius:7px;color:#718498;font-size:11px}.acui-raw-text{max-height:95px;overflow:auto;white-space:pre-wrap;word-break:break-word;margin:8px 0 0;padding:7px;background:#f5f8fb;border-radius:5px;font-family:Consolas,monospace;font-size:11px}.acui-facts{display:grid;grid-template-columns:auto 1fr;gap:5px 9px;font-size:10px;margin:9px 0 0}.acui-facts dt{color:#7a8a99}.acui-facts dd{margin:0;text-align:right;color:#36586e;overflow-wrap:anywhere}
      .acui-evaluation{margin-top:9px;padding:10px 12px;border-radius:7px;background:#f1f6fa;color:#587088;border:1px solid #dce6ee}.acui-evaluation strong{display:block;font-size:13px}.acui-evaluation.pass{background:#edf9f1;border-color:#b7e2c7;color:#1c7540}.acui-evaluation.fail,.acui-evaluation.invalid{background:#fff1f1;border-color:#f0c6c6;color:#a83b3b}.acui-evaluation small{display:block;margin-top:3px;font-size:10px}.acui-validation{padding:9px 11px;background:#fff7e7;border:1px solid #eddbac;color:#86611d;border-radius:7px;margin:0 0 10px;font-size:11px;white-space:pre-line}.acui-validation:empty{display:none}.acui-gdt{display:flex;flex-wrap:wrap;margin-top:8px}.acui-gdt span{border:1px solid #3d5263;padding:4px 8px;font-size:16px;min-width:27px;text-align:center;margin-right:-1px;background:#fff;font-family:"Segoe UI Symbol","Arial Unicode MS",Arial,sans-serif}.acui-gdt:empty{display:none}
      .acui-toolbar-buttons{display:flex;gap:5px;align-items:center}.acui-toolbar-buttons .btn{font-size:11px;padding:6px 9px}.acui-detail-open{width:100%;margin-bottom:12px;justify-content:space-between}.acui-review-count{display:block;font-size:10px;color:#71889a;font-weight:500}.acui-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:0 10px 8px}.acui-filters select{padding:5px 6px;font-size:10px;min-height:28px}.acui-list-summary{display:flex;justify-content:space-between;align-items:center;padding:0 11px 7px;color:#647c91;font-size:10px;gap:6px}.acui-list-summary button{background:transparent;border:0;color:#067f90;cursor:pointer;font:inherit;padding:2px}.acui-list-summary .acui-stats{display:flex;gap:8px;flex-wrap:wrap}.acui-list-summary strong{color:#153b51}
      .acui-table{table-layout:fixed;width:100%;min-width:905px;border-collapse:collapse}.acui-table th{position:sticky;top:0;z-index:1;background:#eff5f9;font-size:9px;letter-spacing:.3px;padding:7px 6px;border-bottom:1px solid #cfdee8;color:#597084;text-align:left}.acui-table td{font-size:10px;padding:6px;border-bottom:1px solid #e6edf3;color:#38546c;vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}.acui-table tr.is-selected td{background:#e5f5f8}.acui-table tr.acui-low-confidence td:first-child{border-left:3px solid #d89529}.acui-table tr:hover td{background:#f0f8fb}.acui-table td[data-editable]:hover{box-shadow:inset 0 -2px #2c9aa4}.acui-table td.acui-requirement{white-space:normal;line-height:1.35;overflow-wrap:anywhere}.acui-table .acui-snapshot-thumb{width:52px;height:30px;object-fit:contain;background:#fff;border:1px solid #dfe8ef;border-radius:3px}.acui-mini-btn{border:1px solid #d5e3ed;background:#fff;color:#087c8b;border-radius:5px;cursor:pointer;padding:3px 6px;font:10px inherit}.acui-status-pill{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;border-radius:12px;padding:3px 6px;background:#eaf0f6;font-size:9px;color:#57708a}.acui-status-pill.pass{background:#e4f5e9;color:#247645}.acui-status-pill.fail{background:#fde9e9;color:#a24242}.acui-quick-hint{padding:4px 11px 7px;font-size:9px;color:#8a9baa}.acui-inline-input{padding:3px 4px;min-height:27px;font-size:10px;border-radius:3px}.acui-empty{padding:30px!important;text-align:center!important;color:#7a8c9b!important}
      .list-panel.acui-expanded{position:fixed;z-index:800;inset:28px;display:flex;background:#fff;border:1px solid #bfd2e1;border-radius:13px;box-shadow:0 0 0 100vmax #07172a88,0 20px 60px #06172f44;overflow:hidden}.list-panel.acui-expanded .table-wrap{flex:1;max-height:none}.list-panel.acui-expanded .acui-filters{grid-template-columns:repeat(7,minmax(0,1fr));padding:0 14px 10px}.list-panel.acui-expanded .acui-table{min-width:1060px}.list-panel.acui-expanded .acui-table td{font-size:12px;padding:9px 7px}.list-panel.acui-expanded .acui-table th{font-size:10px;padding:10px 7px}.list-panel.acui-expanded .list-toolbar{padding:14px}.list-panel.acui-expanded .acui-list-summary{padding:0 15px 10px}.list-panel.acui-expanded .acui-quick-hint{padding:8px 15px}
      .acui-dock{position:fixed;bottom:0;left:12px;right:12px;z-index:90;background:#fff;border:1px solid #c5d8e3;border-radius:12px 12px 0 0;box-shadow:0 -6px 28px #0b314526;display:flex;flex-direction:column;max-height:75vh;transform:translateY(calc(100% - 42px));transition:transform .18s ease;overflow:hidden}.acui-dock:hover,.acui-dock:focus-within,.acui-dock.acui-pinned,.acui-dock.acui-expanded{transform:none}.acui-dock-handle{display:flex;justify-content:space-between;align-items:center;min-height:42px;flex-shrink:0;background:#edf8fa;padding:0 12px;gap:8px}.acui-dock-handle button{border:0;background:transparent;color:#087888;font-weight:700;cursor:pointer;padding:9px}.acui-dock-handle small{font-weight:400;margin-left:12px;color:#607b8a}.acui-dock .table-wrap{flex:0 1 auto;max-height:252px}.acui-dock:not(.acui-expanded) .acui-table tbody tr{height:44px}.acui-dock:not(.acui-expanded) .acui-table td{height:44px;max-height:44px;padding:4px 6px;white-space:nowrap}.acui-dock .acui-filters{grid-template-columns:repeat(7,minmax(0,1fr))}.acui-dock.acui-expanded{max-height:none;transform:none;bottom:28px}.acui-dock.acui-expanded .table-wrap{flex:1;max-height:none}.inspector{grid-template-rows:auto minmax(0,1fr)!important;padding-bottom:42px}.acui-audit-table{width:100%;border-collapse:collapse;font-size:11px}.acui-audit-table th,.acui-audit-table td{text-align:left;padding:8px;border-bottom:1px solid #e0e9f0;vertical-align:top}.acui-audit-table th{color:#648198;background:#f3f7fa}.acui-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.acui-kpi{padding:11px;border:1px solid #dbe6ed;border-radius:9px;background:#f6fafc}.acui-kpi strong{display:block;font-size:22px;line-height:1.2;color:#0b596c}.acui-kpi span{font-size:10px;color:#6b8193}.acui-dialog [hidden]{display:none!important}
      @media(max-width:900px){.acui-editor-layout{grid-template-columns:minmax(0,1fr) 190px}.acui-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.acui-toolbar-buttons .btn{font-size:10px}.acui-dialog{width:calc(100vw - 20px);max-height:calc(100vh - 20px)}.acui-content{padding:12px}.acui-head,.acui-foot{padding:12px}.list-panel.acui-expanded{inset:12px}.list-panel.acui-expanded .acui-filters{grid-template-columns:repeat(4,minmax(0,1fr))}}
      @media(max-width:620px){.acui-editor-layout{grid-template-columns:1fr}.acui-editor-aside{display:grid;grid-template-columns:1fr 1fr;gap:10px}.acui-editor-aside .acui-section{margin:0}.acui-kpis{grid-template-columns:repeat(2,1fr)}.acui-foot{flex-wrap:wrap}.acui-foot .acui-foot-note{width:100%}.acui-head h2{font-size:15px}}
    `;
    style.textContent += `
      #acuiEditor{width:min(1220px,calc(100vw - 28px))}
      #acuiEditor .acui-head{padding:12px 16px}#acuiEditor .acui-head h2{font-size:17px}
      #acuiEditor .acui-content{padding:14px;background:#f6f9fc}
      #acuiEditor .acui-editor-layout{grid-template-columns:minmax(0,1fr) 300px;gap:12px;align-items:start}
      #acuiEditor .acui-editor-main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:start}
      #acuiEditor .acui-editor-main>.acui-section{margin:0;padding:11px}
      #acuiEditor .acui-identity,#acuiEditor .acui-extra,#acuiEditor #acuiGdtSection,#acuiEditor #acuiValidation,#acuiEditor #acuiInformationCheck{grid-column:1/-1}
      #acuiEditor #acuiValidation,#acuiEditor #acuiInformationCheck{order:0;margin:0}
      #acuiEditor .acui-identity{order:1}#acuiEditor #acuiNumericSection,#acuiEditor #acuiControlSection{order:2}
      #acuiEditor #acuiGdtSection{order:3}#acuiEditor .acui-extra{order:4}
      #acuiEditor #acuiNumericSection .acui-grid,#acuiEditor #acuiControlSection .acui-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      #acuiEditor #acuiControlSection>.acui-grid>.acui-span2{grid-column:auto}
      #acuiEditor #acuiControlSection [data-characteristic-field="frequencyNote"]{font-size:11px}
      #acuiEditor .acui-grid{gap:7px 8px}#acuiEditor .acui-field>span{font-size:10px}
      #acuiEditor .acui-field input,#acuiEditor .acui-field select{min-height:32px;padding:5px 7px;font:12px/1.4 "Segoe UI",Arial,sans-serif}
      #acuiEditor .acui-field textarea{min-height:48px;font:12px/1.4 "Segoe UI",Arial,sans-serif}
      #acuiEditor .acui-editor-aside{position:sticky;top:0;min-width:0}
      #acuiEditor .acui-snapshot{height:160px;max-height:220px;padding:10px}
      #acuiEditor .acui-region-actions{display:grid;gap:6px;margin-top:10px}
      #acuiEditor .acui-region-actions .btn{min-height:33px;font-size:12px;justify-content:center}
      #acuiEditor .acui-information-check{padding:8px 10px;font-size:11px}
      #acuiEditor .acui-information-check p{display:none}#acuiEditor .acui-information-check ul{display:flex;flex-wrap:wrap;gap:5px 18px;margin:4px 0 0;padding-left:16px}
      .acui-secondary>summary{cursor:pointer;color:#31586f;font-size:11px;font-weight:650;padding:5px 0}
      .acui-secondary[open]>summary{margin-bottom:7px}.acui-secondary{margin-top:8px}
      .acui-region-dialog{width:min(1080px,calc(100vw - 28px))}.region-correction-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:20px;align-items:start}.acui-region-dialog .snapshot-stage{height:clamp(220px,40vh,400px);max-height:52vh}.acui-region-dialog .snapshot-stage canvas{max-height:100%;object-fit:contain}
      @media(max-width:760px){.region-correction-layout{grid-template-columns:1fr}}
      @media(max-width:1050px){#acuiEditor .acui-editor-main{grid-template-columns:1fr}#acuiEditor .acui-editor-layout{grid-template-columns:minmax(0,1fr) 260px}}
      @media(max-width:700px){#acuiEditor .acui-editor-layout{grid-template-columns:1fr}#acuiEditor .acui-editor-aside{position:static;display:block;grid-row:1}#acuiEditor .acui-snapshot{height:110px}#acuiEditor .acui-region-actions{grid-template-columns:1fr 1fr}#acuiEditor .acui-identity .acui-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    style.textContent+=`
      #acuiEditor .acui-editor-layout{grid-template-columns:minmax(0,1fr) 250px;gap:10px}
      #acuiEditor .acui-editor-main{gap:8px}#acuiEditor .acui-editor-main>.acui-section{padding:9px}
      #acuiEditor #acuiNumericSection{grid-column:1/-1;order:2}#acuiEditor #acuiNumericSection .acui-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
      #acuiEditor #acuiRolePlans{order:4;grid-column:1/-1}#acuiEditor #acuiGdtSection{order:3}
      #acuiEditor .acui-legacy{order:5;grid-column:1/-1;margin:0;border:1px solid #dbe6ed;border-radius:8px;padding:8px;background:white}#acuiEditor .acui-extra{order:6}
      #acuiEditor .acui-legacy #acuiControlSection{margin:0;border:0;padding:6px}#acuiEditor .acui-legacy #acuiControlSection>h3{display:none}
      #acuiEditor #acuiGeneralApply{display:flex;align-items:end;flex-wrap:wrap;gap:8px;padding:8px;background:#edf8fa;border-radius:7px;margin-bottom:8px}
      #acuiEditor #acuiGeneralApply .acui-field{flex:1;min-width:150px}#acuiEditor #acuiGeneralApply small{width:100%;font-size:11px;color:#526b7b}
      #acuiEditor .acui-section h3{margin:0 0 7px}#acuiEditor .acui-field input,#acuiEditor .acui-field select{min-height:29px;padding:4px 6px}
      #acuiEditor .acui-actions{gap:6px;margin-top:5px}#acuiEditor .acui-actions .btn{min-height:27px;padding:4px 7px;font-size:11px}#acuiEditor #acuiParsingNote{margin:4px 0 0;font-size:10px}
      #acuiEditor input[type=checkbox]{width:14px;height:14px;min-height:0;margin:0;vertical-align:middle;flex:none}#acuiEditor #acuiRolePlans legend label{display:flex;align-items:center;gap:6px}
      #acuiEditor .acui-snapshot{height:130px}#acuiEditor .acui-identity textarea{min-height:40px}
      @media(max-width:800px){#acuiEditor .acui-editor-layout{grid-template-columns:1fr}#acuiEditor .acui-editor-aside{position:static;grid-row:auto}#acuiEditor #acuiNumericSection .acui-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.append(style);
    const dockSizing = document.createElement("style");
    dockSizing.textContent = '.acui-dock{transform:translateY(calc(100% - 42px))!important}.acui-dock.acui-open{transform:none!important}.acui-dock:not(.acui-open)>:not(.acui-dock-handle){visibility:hidden}.acui-dock:not(.acui-expanded) .acui-table thead tr{height:32px}.acui-dock:not(.acui-expanded) .acui-table th{height:32px;padding:0 6px}.acui-dock:not(.acui-expanded) .acui-table td{box-sizing:border-box}.acui-frequency-quick{display:flex;gap:5px;flex-wrap:wrap}.acui-frequency-quick button{border:1px solid #c7dce5;border-radius:6px;background:#f2f9fb;color:#087888;padding:5px 8px;cursor:pointer}.acui-note-methods{grid-column:1/-1}.acui-dock .acui-table{min-width:1140px}@media(prefers-reduced-motion:reduce){.acui-dock{transition:none}}';
    document.head.append(dockSizing);
    const filterStyle=document.createElement('style');
    filterStyle.textContent=`
      .list-panel .acui-filters{display:block!important;padding:0 11px 7px!important}
      .acui-filter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
      .acui-filter-field{display:flex;flex-direction:column;gap:3px;min-width:0}.acui-filter-field>span{font-size:10px;font-weight:600;color:#587086}
      .acui-more-filters{margin-top:5px}.acui-more-filters summary{font-size:10px;color:#087c8b;cursor:pointer;width:fit-content;padding:3px 0}.acui-more-filters[open] summary{margin-bottom:4px}
      .acui-issue-button{display:block;max-width:100%;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid #ead6a8;border-radius:5px;background:#fff8e9;color:#805b18;font:inherit;font-size:10px;padding:4px 6px;cursor:pointer}
      .acui-information-check{background:#f4f9fb;border:1px solid #d9e7ed;border-radius:8px;padding:9px 11px;margin-bottom:10px;font-size:11px}.acui-information-check p{margin:3px 0;color:#617889}.acui-information-check ul{display:flex;flex-wrap:wrap;gap:4px 18px;margin:6px 0;padding-left:16px}.acui-information-check button{border:0;background:none;color:#8b6117;text-decoration:underline;cursor:pointer;font:inherit;padding:2px}
      @media(max-width:700px){.acui-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.acui-dock-handle small{display:none}}
    `;
    document.head.append(filterStyle);
    const listLayout=document.createElement('style');listLayout.textContent=`
      .acui-dock{max-height:min(72vh,540px);left:8px;right:8px}.acui-dock> :not(.table-wrap){flex-shrink:0}.acui-dock .table-wrap{min-height:100px;max-height:314px;flex:1 1 auto;overscroll-behavior:contain}
      .acui-dock:not(.acui-expanded) .acui-table tbody tr,.acui-dock:not(.acui-expanded) .acui-table td{height:56px;max-height:56px}.acui-dock .acui-table td{font-size:12px!important;padding:6px 8px!important}
      .acui-dock .acui-table{min-width:1370px}.acui-dock .acui-table th{font-size:10px!important}.acui-dock .acui-table .acui-snapshot-thumb{width:82px;height:42px}.acui-dock .acui-table .balloon-dot{font-size:13px}
      .acui-dock .acui-table .acui-measurement{font-weight:650;color:#133f52;font-variant-numeric:tabular-nums;white-space:normal;line-height:1.35}.acui-dock .acui-subtle{font-size:10px}.acui-dock .list-toolbar{padding:6px 10px;min-height:42px}.acui-dock .acui-list-summary{padding:3px 11px 5px}
      .acui-dock .acui-quick-hint{display:none}.acui-dock .acui-filters{max-height:150px;overflow:auto}.acui-dock .acui-filters[hidden],.acui-dock .acui-bulk-tools[hidden]{display:none!important}
      .acui-bulk-tools{display:flex;flex-wrap:wrap;gap:4px 12px;border-top:1px solid #dbe7ef;background:#f5fafc;padding:5px 10px;max-height:100px;overflow:auto}.acui-bulk-tools>div{padding:0!important;gap:6px!important}.acui-bulk-tools .btn{min-height:29px;font-size:11px;padding:4px 8px}.acui-bulk-tools input,.acui-bulk-tools select{min-height:28px;border:1px solid #cbdde6;border-radius:5px;font-size:11px}
      .acui-dock.acui-expanded{inset:12px;max-height:none}.acui-dock.acui-expanded .table-wrap{max-height:none;flex:1}.acui-dock .acui-list-summary{font-size:11px}.acui-dock .acui-filter-toggle{min-height:31px;font-size:11px;flex-shrink:0}
      @media(max-height:650px){.acui-dock:not(.acui-expanded){max-height:80vh}.acui-dock .acui-filters{max-height:100px}.acui-dock .acui-bulk-tools{max-height:72px}}
    `;document.head.append(listLayout);
  }

  function installToolbar() {
    const toolbar = $(".toolbar");
    if (!toolbar) return;
    const group = document.createElement("div");
    group.className = "tool-group acui-toolbar-buttons";
    group.innerHTML = `<button class="btn" type="button" id="acuiMetadataOpen">Çizim bilgileri</button><button class="btn" type="button" id="acuiCreateManual">+ Karakteristik</button><button class="btn" type="button" id="acuiCreateNote">+ Not</button>`;
    toolbar.insertBefore(group, $(".toolbar-spacer", toolbar));
    $("#acuiMetadataOpen").addEventListener("click", openMetadata);
    const gdt=document.createElement('button');gdt.id='acuiCreateGdt';gdt.type='button';gdt.className='btn';gdt.textContent='GD&T';group.append(gdt);
    gdt.onclick=async()=>{const annotation=await bridge.createManual?.({type:'GD&T'});if(annotation)openEditor(annotation.id);};
    $("#acuiCreateNote").addEventListener("click", async () => {
      const annotation = await bridge.createManual?.({type:'Not'});
      if(annotation)openEditor(annotation.id);
    });
    $("#acuiCreateManual").addEventListener("click", async () => {
      const created = await bridge.createManual?.();
      const annotation = created || bridge.selectedAnnotation?.();
      if (annotation) openEditor(annotation.id);
    });
  }

  function input(name, label, extra = "", attributes = "") {
    return `<label class="acui-field ${extra}"><span>${label}</span><input data-characteristic-field="${name}" ${attributes}></label>`;
  }

  function select(name, label, extra = "", content = "") {
    return `<label class="acui-field ${extra}"><span>${label}</span><select data-characteristic-field="${name}">${content}</select></label>`;
  }

  function installDialogs() {
    const editor = document.createElement("dialog");
    editor.id = "acuiEditor";
    editor.className = "acui-dialog asmach-modal";
    editor.setAttribute("aria-labelledby", "acuiEditorTitle");
    editor.innerHTML = `
      <header class="acui-head"><div><div class="acui-eyebrow">KARAKTERİSTİK KAYDI</div><h2 id="acuiEditorTitle">Karakteristik ayrıntıları</h2><p>Gereklilik, ölçüm ve izlenebilirlik bilgileri</p></div><button class="acui-close" type="button" data-close-dialog aria-label="Pencereyi kapat">×</button></header>
      <form id="acuiEditorForm" class="acui-content" novalidate><div class="acui-editor-layout"><div class="acui-editor-main">
        <div id="acuiValidation" class="acui-validation" role="status"></div>
        <div id="acuiInformationCheck" class="acui-information-check" aria-live="polite"></div>
        <section class="acui-section acui-identity"><h3>Kimlik ve gereklilik</h3><div class="acui-grid">
          ${input("number", "BALON NO", "", 'required maxlength="32"')}${input("page", "PDF SAYFASI", "", 'type="number" min="1" step="1"')}${input("sheetNo", "SHEET", "", 'placeholder="Örn. 1"')}${input("zone", "ZONE", "", 'placeholder="Örn. B3"')}
          ${select("type", "KARAKTERİSTİK TÜRÜ", "acui-full")}
          <label class="acui-field acui-full"><span>GEREKLİLİK / ÖLÇÜ METNİ</span><textarea data-characteristic-field="requirement" rows="2" placeholder="Örn. Ø25 +0.2 / −0.1; M6×1-6H; ⌖ | ⌀0.1 | A | B"></textarea></label>
        </div><div class="acui-actions"><label class="acui-check"><input id="acuiAutoParse" type="checkbox">Alanlardan otomatik oluştur</label><button class="btn" id="acuiParse" type="button">Gerekliliği oluştur ↻</button><button class="btn" id="acuiReadSource" type="button">OCR'den alanları yenile</button></div><p id="acuiParsingNote">Gerekliliği düzenlemek ölçü alanlarını değiştirmez. Manuel metin korunur.</p></section>
        <section class="acui-section" id="acuiNumericSection"><h3>Ölçü ve tolerans</h3><div class="acui-grid">
          ${input("nominalValue", "NOMİNAL", "", 'inputmode="decimal"')}${input("unit", "BİRİM", "", 'list="acuiUnits"')}${input("lowerTolerance", "ALT TOLERANS", "", 'inputmode="decimal" placeholder="−0.1"')}${input("upperTolerance", "ÜST TOLERANS", "", 'inputmode="decimal" placeholder="+0.1"')}
          ${input("lowerLimit", "ALT LİMİT", "", 'inputmode="decimal"')}${input("upperLimit", "ÜST LİMİT", "", 'inputmode="decimal"')}${input("toleranceStandard", "TOLERANS KAYNAĞI", "acui-span2", 'placeholder="Örn. ISO 2768-mK"')}
        </div><div class="acui-actions"><button class="btn" id="acuiRecalculateLimits" type="button">Limitleri toleranstan hesapla</button><span class="acui-subtle">Açıkça belirtilen tolerans önceliklidir.</span></div>
        <div class="acui-grid" id="acuiThreadFields" style="margin-top:9px">${input("threadPitch", "DİŞ ADIMI", "", 'inputmode="decimal"')}${input("threadClass", "DİŞ SINIFI")}${input("threadStandard", "DİŞ STANDARDI", "acui-span2", 'placeholder="OCR otomatik belirler"')}${input("fitClass", "GEÇME SINIFI", "acui-span2")}</div></section>
        <section class="acui-section" id="acuiGdtSection"><h3>GD&amp;T ve datum</h3><div class="acui-grid">${select("gdtSubtype", "GD&T TÜRÜ", "acui-span2", options(engine().gdtOptions?.() || []))}${input("datumRefs", "DATUM REFERANSLARI", "acui-span2", 'placeholder="A | B | C"')}</div><div id="acuiDatumColumns" class="acui-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:8px">${[0,1,2].map(i=>`<label class="acui-field"><span>${i+1}. DATUM</span><input data-datum-slot="${i}" placeholder="${['A','B','C'][i]}"></label>`).join('')}</div><p class="acui-subtle">Tür ve datum değişiklikleri rapor çerçevesine aktarılır. Kaynak görüntüsü değişmez.</p><div id="acuiGdtFrame" class="acui-gdt" aria-label="Geometrik tolerans çerçevesi"></div><img id="acuiGdtReportImage" alt="Üretilen rapor çerçevesi" style="height:28px;max-width:100%;object-fit:contain;object-position:left;margin-top:8px" hidden></section>
        <section class="acui-section" id="acuiControlSection"><h3>Değerlendirme / önceki kontrol bilgileri</h3><div class="acui-grid">
          ${select("inspectionMethod", "KONTROL YÖNTEMİ", "acui-span2")}${select("evaluationMethod", "DEĞERLENDİRME", "acui-span2", options([{ value: "VALUE", label: "Sayısal değer" }, { value: "OK_NOT_OK", label: "OK / NOT OK" }]))}
          <div id="acuiNoteMethods" class="acui-note-methods" hidden></div>
          ${select("inspectionFrequency", "KONTROL SIKLIĞI", "acui-span2", options(plan().FREQUENCIES))}${input("frequencyInterval", "PARÇA ARALIĞI (N)", "acui-span2", 'type="number" min="1" step="1" placeholder="Örn. 10"')}
          ${input("frequencyNote", "SIKLIK AÇIKLAMASI / ÖRNEKLEME PLANI", "acui-full", 'placeholder="Örn. her partiden 3 adet; plan referansı"')}
          <div class="acui-frequency-quick acui-full">${['EACH_PART','FIRST_PIECE','PER_LOT','PER_SHIFT'].map(value=>`<button type="button" data-frequency-quick="${value}">${escape(plan().FREQUENCIES.find(f=>f.value===value).label)}</button>`).join('')}</div>
        </div><details class="acui-secondary"><summary>Ölçüm kaydı / sonuç (isteğe bağlı)</summary><div class="acui-grid">
          ${select("status", "KAYIT DURUMU", "acui-span2")}
          <label class="acui-field acui-span2" id="acuiValueResult"><span>ÖLÇÜM SONUCU</span><input data-characteristic-field="result" inputmode="decimal" placeholder="Gerçek ölçüm değerini girin"></label>
          <label class="acui-field acui-span2" id="acuiBinaryResult"><span>KONTROL SONUCU</span><select id="acuiBinaryResultSelect"><option value="">Henüz değerlendirilmedi</option><option value="OK">OK — Uygun</option><option value="NOT_OK">NOT OK — Uygun değil</option></select></label>
          ${input("nonconformanceNo", "UYGUNSUZLUK NO", "acui-span2", 'placeholder="Örn. NCR-2026-001"')}
        </div><div id="acuiEvaluation" class="acui-evaluation" role="status"></div></details></section>
        <details class="acui-section acui-secondary acui-extra"><summary>Ek bilgiler ve kontrol notu</summary><div class="acui-grid">${input("specialDesignator", "ÖZEL KARAKTERİSTİK", "acui-span2", 'placeholder="Örn. kritik / anahtar / SC"')}
          <label class="acui-field acui-full"><span>AÇIKLAMA / KONTROL NOTU</span><textarea data-characteristic-field="comment" rows="2"></textarea></label>
        </div></details>
      </div><aside class="acui-editor-aside"><section class="acui-section"><h3>Seçilen çizim bölgesi</h3><img id="acuiSnapshot" class="acui-snapshot" alt="Karakteristiğin kaynak görüntüsü"><div id="acuiNoSnapshot" class="acui-no-snapshot">Manuel karakteristik</div><div class="acui-region-actions"><button type="button" class="btn primary" id="acuiEditRegion">Kutuyu düzelt</button><button type="button" class="btn" id="acuiReselectRegion">Çizimden yeniden seç</button></div><p id="acuiRegionNote">Kırpma, konum ve dönüşü düzenleyin. Ölçü alanları korunur.</p><details class="acui-secondary"><summary>Kaynak OCR ve algılama bilgisi</summary><pre id="acuiOcrRaw" class="acui-raw-text"></pre><dl id="acuiSourceFacts" class="acui-facts"></dl></details></section><details class="acui-section acui-secondary"><summary>İzlenebilirlik</summary><dl id="acuiAuditFacts" class="acui-facts"></dl><p>Konum ve kaynak görüntüsü proje dosyasında saklanır.</p></details><button class="btn" type="button" id="acuiFocusDrawing" style="width:100%;margin-top:10px;font-size:11px">Çizimde göster ↗</button></aside></div></form>
      <footer class="acui-foot"><span class="acui-foot-note" id="acuiEditorFootNote">Kayıt kapatılana kadar değişiklikler taslak olarak tutulur.</span><button class="btn danger" id="acuiDelete" type="button">Sil</button><button class="btn" type="button" data-close-dialog>Vazgeç</button><button class="btn primary" type="submit" form="acuiEditorForm">Karakteristiği kaydet</button></footer><datalist id="acuiUnits"><option value="mm"><option value="in"><option value="°"><option value="µm"><option value="N"><option value="Nm"><option value="HRC"></datalist>`;
    document.body.append(editor);
    const reviewWarnings=document.createElement('section');reviewWarnings.id='acuiWarningReview';reviewWarnings.className='acui-section';reviewWarnings.innerHTML='<h3>Algılama uyarılarını doğrula</h3><div id="acuiWarningText" style="white-space:pre-line;font-size:12px;line-height:1.6"></div><label style="display:flex;gap:8px;font-size:12px;margin-top:8px"><input id="acuiConfirmWarnings" type="checkbox">Kaynak resmi ve düzelttiğim değerleri kontrol ettim; aşağıdaki kaydı bu haliyle doğruluyorum.</label><small>Bu onay eksik toleransları veya çelişkili limitleri geçerli yapmaz. GD&T toleransı ± boyut sapması olarak değerlendirilmez.</small>';$('#acuiEditor .acui-editor-main').prepend(reviewWarnings);
    const legacy=document.createElement('details');legacy.className='acui-secondary acui-legacy';legacy.innerHTML='<summary>Önceki kontrol bilgileri / ölçüm sonucu</summary>';$('#acuiControlSection').before(legacy);legacy.append($('#acuiControlSection'));
    const general=document.createElement('div');general.id='acuiGeneralApply';general.innerHTML=`<label class="acui-field"><span>GENEL TOLERANS</span><select id="acuiRecordStandard">${window.ASMachCharacteristicEditing?.options(window.ASMachCharacteristicEditing.standards)||''}</select></label><label class="acui-field" id="acuiReferenceField" hidden><span>KISA KENAR (mm)</span><input id="acuiReferenceLength" type="number" min="0" step="any"></label><label class="acui-check"><input id="acuiReplaceTolerance" type="checkbox">Mevcut toleransları değiştir</label><button type="button" class="btn" id="acuiApplyGeneral">Genel toleransı uygula</button><small id="acuiGeneralMessage" role="status"></small>`;$('#acuiNumericSection').insertBefore(general,$('#acuiNumericSection').children[1]);
    $('#acuiApplyGeneral').onclick=()=>{const result=window.ASMachCharacteristicEditing.general(readEditor(),$('#acuiRecordStandard').value,bridge.parseRequirement,$('#acuiReferenceLength').value,$('#acuiReplaceTolerance').checked);if(!result.patch){$('#acuiGeneralMessage').textContent=result.reason;return;}Object.assign(parsedMetadata,result.patch);for(const [key,value] of Object.entries(result.patch)){if(field(key)){field(key).value=value??'';manualFields.delete(key);delete field(key).dataset.manual;}}enableEditorRequirementAuto();updateEditorDisplay();$('#acuiGeneralMessage').textContent='Toleranslar ve limitler hesaplandı. Kaydetmeden önce kontrol edin.';};
    bindDialog(editor);
    $('#acuiEditRegion').addEventListener('click',()=>editRegion(false));
    $('#acuiReselectRegion').addEventListener('click',()=>editRegion(true));
    editor.addEventListener('click',event=>{
      const frequency=event.target.dataset.frequencyQuick,method=event.target.dataset.noteMethod;
      if(frequency){field('inspectionFrequency').value=frequency;manualFields.add('inspectionFrequency');updateEditorDisplay();}
      if(method){bridge.ensureNoteMethods?.();field('inspectionMethod').innerHTML=options(methods(),method);field('inspectionMethod').value=method;manualFields.add('inspectionMethod');updateEditorDisplay();}
    });
    $("#acuiEditorForm").addEventListener("submit", saveEditor);
    $('#acuiEditor').addEventListener('input',e=>{if(e.target.id!=='acuiConfirmWarnings')$('#acuiConfirmWarnings').checked=false;});
    const regenerate = () => {
      if (engine().generateRequirement?.(readEditor()) == null) { bridge.toast?.('Metin oluşturmak için alanlar yeterli değil; gerekliliği elle girin.'); $('#acuiAutoParse').checked=false; return; }
      manualFields.delete('requirement');delete field('requirement').dataset.manual;
      $('#acuiAutoParse').checked=true;updateEditorDisplay();
    };
    $("#acuiParse").addEventListener("click", regenerate);
    $("#acuiReadSource").addEventListener("click", () => parseEditor(true));
    $("#acuiAutoParse").addEventListener("change", () => { if ($('#acuiAutoParse').checked) regenerate(); else updateEditorDisplay(); });
    $("#acuiRecalculateLimits").addEventListener("click", () => { recalculateLimits(true); enableEditorRequirementAuto(); updateEditorDisplay(); });
    $("#acuiBinaryResultSelect").addEventListener("change", event => { field("result").value = event.target.value; manualFields.add("result"); updateEditorDisplay(); });
    $("#acuiFocusDrawing").addEventListener("click", () => { closeDialog(editor); bridge.focusAnnotation?.(editorId); });
    $("#acuiDelete").addEventListener("click", () => { const id = editorId; closeDialog(editor); bridge.removeAnnotation?.(id); });
    editor.addEventListener("input", event => {
      if(event.target.dataset.datumSlot!==undefined){
        const values=engine().datumTokens(field('datumRefs').value),index=Number(event.target.dataset.datumSlot);
        while(values.length<=index)values.push('');values[index]=event.target.value.trim().toUpperCase();
        field('datumRefs').value=engine().datumTokens(values.join(' | ')).join(' | ');manualFields.add('datumRefs');enableEditorRequirementAuto();updateEditorDisplay();return;
      }
      const name = event.target.dataset.characteristicField;
      if (!name || parsing) return;
      manualFields.add(name);
      if(name==='type')transitionEditorType(event.target.value);
      if (name === 'gdtSubtype') {
        field('type').value = 'GD&T';
        manualFields.add('type');
      }
      if(name==='type'&&event.target.value==='Not'){
        field('evaluationMethod').value='OK_NOT_OK';manualFields.add('evaluationMethod');
        if(!['','OK','NOT_OK'].includes(field('result').value))field('result').value='';
      }
      event.target.dataset.manual = "true";
      if (name === 'requirement') $('#acuiAutoParse').checked=false;
      else if([...parsedFields,'specialDesignator'].includes(name))enableEditorRequirementAuto();
      if (["nominalValue", "lowerTolerance", "upperTolerance"].includes(name)) recalculateLimits(false);
      if (name === "evaluationMethod") {
        const raw = field("result").value;
        if (event.target.value === "OK_NOT_OK" && !["", "OK", "NOT_OK"].includes(raw)) field("result").value = "";
        if (event.target.value === "VALUE" && ["OK", "NOT_OK"].includes(raw)) field("result").value = "";
      }
      updateEditorDisplay();
    });

    const metadata = document.createElement("dialog");
    metadata.id = "acuiMetadata";
    metadata.className = "acui-dialog asmach-modal";
    metadata.style.width = "min(780px,calc(100vw - 36px))";
    metadata.setAttribute("aria-labelledby", "acuiMetadataTitle");
    const metadataField = (name, label, extra = "") => `<label class="acui-field ${extra}"><span>${label}</span><input data-metadata-field="${name}"></label>`;
    metadata.innerHTML = `<header class="acui-head"><div><div class="acui-eyebrow">PROJE BİLGİLERİ</div><h2 id="acuiMetadataTitle">Teknik resim ve genel tolerans</h2></div><button class="acui-close" data-close-dialog type="button" aria-label="Pencereyi kapat">×</button></header><form id="acuiMetadataForm" class="acui-content"><div class="acui-kpis" id="acuiMetadataKpis"></div><section class="acui-section"><h3>Çizim kimliği</h3><div class="acui-grid">${metadataField("drawingNo", "TEKNİK RESİM NO", "acui-span2")}${metadataField("drawingRevision", "ÇİZİM REVİZYONU")}${metadataField("partRevision", "PARÇA REVİZYONU")}${metadataField("partNo", "PARÇA NO", "acui-span2")}${metadataField("customer", "MÜŞTERİ", "acui-span2")}${metadataField("preparedBy", "HAZIRLAYAN", "acui-span2")}<label class="acui-field acui-span2"><span>ÇİZİM DURUMU</span><select data-metadata-field="status"><option value="draft">Taslak</option><option value="in_review">İncelemede</option><option value="approved">Onaylandı</option><option value="archived">Arşiv</option></select></label><label class="acui-field acui-full"><span>AÇIKLAMA</span><textarea rows="2" data-metadata-field="description"></textarea></label></div></section><section class="acui-section"><h3>Belirtilmemiş toleransların varsayılanı</h3><div class="acui-grid"><label class="acui-field acui-span2"><span>GENEL TOLERANS STANDARDI</span><select id="acuiGeneralStandard"><option value="">Otomatik tolerans uygulama</option>${["f", "m", "c", "v"].flatMap(linear => ["H", "K", "L"].map(geometric => `<option value="ISO 2768-${linear}${geometric}">ISO 2768-${linear}${geometric}</option>`)).join("")}<option value="ASME Y14.5-2018">ASME Y14.5-2018 · çizim alt/üst sapmaları</option><option value="ASME Y14.5-2009">ASME Y14.5-2009 · çizim alt/üst sapmaları</option><option value="CUSTOM">Özel alt / üst tolerans</option></select></label><label class="acui-field"><span>ÖZEL ALT TOLERANS</span><input id="acuiGeneralLower" inputmode="decimal" placeholder="−0.1"></label><label class="acui-field"><span>ÖZEL ÜST TOLERANS</span><input id="acuiGeneralUpper" inputmode="decimal" placeholder="+0.1"></label></div><p>ASME seçiminde evrensel sayısal tolerans atanmaz; çizimdeki doğrusal alt/üst sapmaları girin. Bu seçim yeni algılamalara uygulanır. Mevcut kayıtlar ve açıkça verilmiş toleranslar korunur. Geometrik H/K/L sınıfı sadece desteklenen özelliklere uygulanır.</p></section><section class="acui-section"><div class="acui-actions" style="margin:0"><div><h3 style="margin:0">İşlem geçmişi</h3><p>Projeyle birlikte kaydedilen yerel değişiklik günlüğü</p></div><button class="btn" type="button" id="acuiAuditOpen">Geçmişi görüntüle</button></div></section></form><footer class="acui-foot"><button class="btn" type="button" data-close-dialog>Vazgeç</button><button class="btn primary" type="submit" form="acuiMetadataForm">Bilgileri kaydet</button></footer>`;
    document.body.append(metadata);
    bindDialog(metadata);
    $("#acuiMetadataForm").addEventListener("submit", saveMetadata);
    $("#acuiGeneralStandard").addEventListener("change", updateGeneralFields);
    $("#acuiAuditOpen").addEventListener("click", openAudit);

    const audit = document.createElement("dialog");
    audit.id = "acuiAudit";
    audit.className = "acui-dialog asmach-modal";
    audit.setAttribute("aria-labelledby", "acuiAuditTitle");
    audit.innerHTML = `<header class="acui-head"><div><div class="acui-eyebrow">İZLENEBİLİRLİK</div><h2 id="acuiAuditTitle">Proje işlem geçmişi</h2><p>En yeni kayıtlar başta gösterilir.</p></div><button class="acui-close" type="button" data-close-dialog aria-label="Pencereyi kapat">×</button></header><div class="acui-content"><table class="acui-audit-table"><thead><tr><th>Tarih</th><th>İşlem</th><th>Karakteristik</th><th>Ayrıntı</th></tr></thead><tbody id="acuiAuditBody"></tbody></table></div><footer class="acui-foot"><button class="btn" type="button" data-close-dialog>Kapat</button></footer>`;
    document.body.append(audit);
    bindDialog(audit);
  }

  function bindDialog(dialog) {
    $$("[data-close-dialog]", dialog).forEach(button => button.addEventListener("click", () => closeDialog(dialog)));
    dialog.addEventListener("keydown", event => {
      // Keep application shortcuts (Delete, B, K, Ctrl+S) out of unsaved forms.
      event.stopPropagation();
    });
    dialog.addEventListener("close", () => {
      dialog.classList.remove("open");
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });
  }

  function showDialog(dialog) {
    dock?.close();
    opener = document.activeElement;
    dialog.classList.add("open");
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog(dialog) { if (dialog.open) dialog.close(); }

  function installInspector() {
    const form = bridge.elements.selectionForm || $("#selectionForm");
    if (!form) return;
    const button = document.createElement("button");
    button.id = "acuiDetailsOpen";
    button.className = "btn acui-detail-open";
    button.type = "button";
    button.innerHTML = `<span>Karakteristik ayrıntıları<span class="acui-review-count">Ölçüm sonucu · GD&amp;T · İzlenebilirlik</span></span><span aria-hidden="true">↗</span>`;
    button.addEventListener("click", () => { const selected = bridge.selectedAnnotation?.(); if (selected) openEditor(selected.id); });
    form.prepend(button);
    window.ASMachInspectorPanel?.mount(form,{
      onSettings:()=>document.getElementById('balloonSettingsButton')?.click(),
      onFrequency:()=>{const selected=bridge.selectedAnnotation?.();if(selected){openEditor(selected.id);document.getElementById('cwInspectorTab2')?.click();}}
    });
  }

  function installTable() {
    const body = bridge.elements.balloonTableBody || $("#balloonTableBody");
    if (!body) return;
    const table = body.closest("table");
    table.className = "acui-table";
    $("colgroup", table)?.remove();
    $("thead", table).innerHTML = `<tr><th style="width:48px">NO</th><th style="width:53px">SAYFA</th><th style="width:58px">SNAPSHOT</th><th style="width:70px">TÜR</th><th style="width:190px">GEREKLİLİK</th><th style="width:65px">ZONE</th><th style="width:95px">YÖNTEM</th><th style="width:110px">SIKLIK</th><th style="width:160px">BİLGİ KONTROLÜ</th><th style="width:62px">OCR</th><th style="width:65px">AYRINTI</th></tr>`;
    $("thead",table).innerHTML=$("thead",table).innerHTML.replace('<tr>','<tr><th style="width:34px"><input id="acuiBulkAll" type="checkbox" title="Filtrelenen tüm kayıtları seç" aria-label="Filtrelenen tüm kayıtları seç" /></th>');
    $('thead',table).innerHTML=$('thead',table).innerHTML.replace('width:58px">SNAPSHOT','width:94px">SNAPSHOT').replace('<th style="width:190px">GEREKLİLİK','<th style="width:174px">ÖLÇÜ / TOLERANS</th><th style="width:190px">GEREKLİLİK');
    const extraColumns=[['nominalValue','Nominal'],['unit','Birim'],['lowerTolerance','Alt tolerans'],['upperTolerance','Üst tolerans'],['lowerLimit','Alt limit'],['upperLimit','Üst limit'],['toleranceStandard','Tolerans kaynağı']];
    $('thead',table).innerHTML=$('thead',table).innerHTML.replace('</tr>',extraColumns.map(([key,label])=>`<th data-extra-column="${key}" hidden style="width:110px">${label}</th>`).join('')+'</tr>');
    const panel = table.closest(".list-panel");
    panel.classList.add('acui-readable','acui-essential-columns');
    if(window.ResizeObserver){const firstHeader=table.querySelector('th');const stickySizer=new window.ResizeObserver(()=>table.style.setProperty('--acui-select-width',`${firstHeader.getBoundingClientRect().width}px`));stickySizer.observe(firstHeader);}
    const columnsButton=document.createElement('button');columnsButton.type='button';columnsButton.className='btn';columnsButton.id='acuiColumnsToggle';columnsButton.textContent='Detay sütunları';columnsButton.setAttribute('aria-pressed','false');columnsButton.title='Kaynak görüntüsü, gereklilik metni ve OCR güven sütunlarını göster';
    (panel.querySelector('.list-toolbar')||panel).append(columnsButton);
    columnsButton.addEventListener('click',()=>{const essential=panel.classList.toggle('acui-essential-columns');columnsButton.setAttribute('aria-pressed',String(!essential));columnsButton.textContent=essential?'Detay sütunları':'Sade sütunlar';});
    const columnMenu=document.createElement('details');columnMenu.className='acui-column-menu';columnMenu.innerHTML='<summary class="btn">Sütunlar</summary><div>'+extraColumns.map(([key,label])=>`<label><input type="checkbox" data-show-column="${key}">${label}</label>`).join('')+'</div>';(panel.querySelector('.list-toolbar')||panel).append(columnMenu);
    columnMenu.addEventListener('change',()=>{for(const input of columnMenu.querySelectorAll('[data-show-column]'))table.querySelectorAll(`[data-extra-column="${input.dataset.showColumn}"]`).forEach(cell=>cell.hidden=!input.checked);const count=columnMenu.querySelectorAll('input:checked').length;table.style.minWidth=(panel.classList.contains('acui-essential-columns')?1120:1370)+count*110+'px';});
    const filterNode = document.createElement("div");
    filterNode.className = "acui-filters";
    filterNode.id='acuiFilterPanel';filterNode.hidden=true;
    const filterToggle=document.createElement('button');filterToggle.id='acuiFilterToggle';filterToggle.type='button';filterToggle.className='btn acui-filter-toggle';filterToggle.textContent='Filtreler';filterToggle.setAttribute('aria-controls','acuiFilterPanel');filterToggle.setAttribute('aria-expanded','false');
    (panel.querySelector('.list-toolbar')||panel).append(filterToggle);
    filterToggle.addEventListener('click',()=>{filterNode.hidden=!filterNode.hidden;filterToggle.setAttribute('aria-expanded',String(!filterNode.hidden));});
    const filterFields = items => items.map(([name,label])=>`<label class="acui-filter-field"><span>${label}</span><select data-acui-filter="${name}" aria-label="${label}"></select></label>`).join('');
    filterNode.innerHTML = `<div class="acui-filter-grid">${filterFields([["type","Karakteristik türü"],["method","Kontrol yöntemi"],["frequency","Kontrol sıklığı"],["completeness","Eksik bilgi / tutarlılık"]])}</div><details class="acui-more-filters"><summary>Diğer filtreler <span id="acuiExtraFilterCount"></span></summary><div class="acui-filter-grid">${filterFields([["page","Çizim sayfası"],["zone","Teknik resim bölgesi"],["confidence","OCR güveni"],["sort","Sıralama"]])}</div></details>`;
    const summary = document.createElement("div");
    summary.className = "acui-list-summary";
    summary.innerHTML = `<div class="acui-stats" id="acuiListStats"></div><div><button type="button" id="acuiClearFilters">Filtreleri temizle</button> · <button type="button" id="acuiExpandTable">Geniş görünüm ↗</button></div>`;
    const hint = document.createElement("div");
    hint.className = "acui-quick-hint";
    hint.textContent = "Satır: çizimde göster · Hücreye çift tıkla: hızlı düzenle · Enter: kaydet · Esc: iptal";
    panel.insertBefore(filterNode, table.closest(".table-wrap"));
    panel.insertBefore(summary, table.closest(".table-wrap"));
    const bulk = document.createElement("div");
    bulk.style.cssText="display:flex;align-items:center;gap:8px;padding:5px 11px 9px;flex-wrap:wrap;font-size:11px";
    bulk.innerHTML='<strong id="acuiBulkCount">0 seçili</strong><label>Kontrol yöntemi <select id="acuiBulkMethod" aria-label="Toplu kontrol yöntemi" style="padding:5px;border:1px solid #cedde5;border-radius:5px"></select></label><button id="acuiBulkApply" type="button" class="btn" style="padding:5px 8px;font-size:11px">Seçilenlere uygula</button><button id="acuiBulkClear" type="button" class="btn" style="padding:5px 8px;font-size:11px">Seçimi temizle</button>';
    const bulkTools=document.createElement('div');bulkTools.id='acuiBulkTools';bulkTools.className='acui-bulk-tools';bulkTools.hidden=true;bulkTools.append(bulk);
    panel.insertBefore(bulkTools,table.closest(".table-wrap"));
    const frequencyBulk=document.createElement('div');frequencyBulk.style.cssText=bulk.style.cssText;
    frequencyBulk.innerHTML=`<label>Sıklık <select id="acuiBulkFrequency" aria-label="Toplu kontrol sıklığı">${options(plan().FREQUENCIES)}</select></label><input id="acuiBulkInterval" type="number" min="1" step="1" placeholder="N parça" aria-label="Toplu parça aralığı" style="width:85px" hidden><input id="acuiBulkFrequencyNote" placeholder="Örnekleme / özel plan açıklaması" aria-label="Toplu sıklık açıklaması" style="width:220px"><button id="acuiBulkFrequencyApply" type="button" class="btn">Sıklığı seçilenlere uygula</button>`;
    bulkTools.append(frequencyBulk);
    $('#acuiBulkFrequency').addEventListener('change',()=>{$('#acuiBulkInterval').hidden=!['EVERY_N_PIECES','EVERY_N_HOURS'].includes($('#acuiBulkFrequency').value);});
    $('#acuiBulkFrequencyApply').addEventListener('click',applyBulkFrequency);
    $("#acuiBulkAll").addEventListener("change",event=>{visibleBulkIds.forEach(id=>event.target.checked?bulkSelection.add(id):bulkSelection.delete(id));bridge.renderAll();});
    $("#acuiBulkClear").addEventListener("click",()=>{bulkSelection.clear();bridge.renderAll();});
    const bulkDelete=document.createElement('button');bulkDelete.id='acuiBulkDelete';bulkDelete.type='button';bulkDelete.className='btn danger';bulkDelete.textContent='Seçilenleri sil';bulk.append(bulkDelete);
    const bulkEdit=document.createElement('button');bulkEdit.id='acuiBulkEdit';bulkEdit.type='button';bulkEdit.className='btn primary';bulkEdit.textContent='Seçilen bilgileri düzenle';bulk.prepend(bulkEdit);bulkEdit.onclick=()=>window.ASMachCharacteristicEditing?.open(bridge,selectionIds());
    bulkDelete.addEventListener('click',()=>bridge.removeAnnotations?.(selectionIds()));
    $("#acuiBulkApply").addEventListener("click",applyBulkMethod);
    // Keep the main selection bar small; retain quick method/frequency actions on demand.
    const selectionBar=document.createElement('div');selectionBar.className='acui-selection-bar';
    selectionBar.append($('#acuiBulkCount'),bulkEdit);
    const selectVisible=document.createElement('button');selectVisible.type='button';selectVisible.className='btn';selectVisible.textContent='Görünenleri seç';
    selectVisible.onclick=()=>{visibleBulkIds.forEach(id=>bulkSelection.add(id));bridge.renderAll();};
    const invertVisible=document.createElement('button');invertVisible.type='button';invertVisible.className='btn';invertVisible.textContent='Seçimi ters çevir';invertVisible.title='Yalnızca görünen satırların seçimini ters çevirir';
    invertVisible.onclick=()=>{visibleBulkIds.forEach(id=>bulkSelection.has(id)?bulkSelection.delete(id):bulkSelection.add(id));bridge.renderAll();};
    selectionBar.append(selectVisible,invertVisible,$('#acuiBulkClear'),bulkDelete);
    const quickActions=document.createElement('details');quickActions.className='acui-selection-quick';
    quickActions.innerHTML='<summary>Hızlı atama</summary>';quickActions.append(bulk,frequencyBulk);bulkTools.replaceChildren(selectionBar,quickActions);
    const selectionStyle=document.createElement('style');selectionStyle.textContent=`
      #acuiListStats{display:none!important}
      .acui-list-summary:has(#acuiListStats){display:none!important}
      #acuiBulkTools{display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:5px 8px;background:#f4f8fa;border-bottom:1px solid #cedde5}
      #acuiBulkTools[hidden]{display:none!important}
      #acuiBulkTools .acui-selection-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      #acuiBulkTools .btn{font-size:11px!important;padding:4px 8px!important;min-height:26px;border-radius:3px}
      #acuiBulkCount{font-size:11px;min-width:48px}
      #acuiBulkTools .acui-selection-quick{font-size:11px}
      #acuiBulkTools .acui-selection-quick summary{cursor:pointer;width:max-content;color:#315c73;padding:2px 0}
      #acuiBulkTools .acui-selection-quick>div{display:flex!important;padding:4px 0!important;gap:6px!important;align-items:center;flex-wrap:wrap}
      #acuiBulkTools select,#acuiBulkTools input{height:26px;padding:3px 6px!important;font-size:11px;border:1px solid #cedde5;border-radius:3px}
      #acuiBulkTools label{display:flex;align-items:center;gap:5px}
    `;document.head.append(selectionStyle);
    body.addEventListener("change",event=>{const input=event.target.closest('[data-bulk-id]');if(!input)return;input.checked?bulkSelection.add(input.dataset.bulkId):bulkSelection.delete(input.dataset.bulkId);bridge.renderAll();});
    panel.append(hint);
    panel.classList.add("acui-dock");
    const handle = document.createElement("div");
    handle.className = "acui-dock-handle";
    handle.innerHTML = `<button type="button" id="acuiDockToggle" aria-expanded="false">▴ Karakteristikleri yönet <small>Üzerine gelerek açın · En fazla 5 satır</small></button><div><button type="button" id="acuiDockPin" aria-pressed="false">Sabitle</button><button type="button" id="acuiDockExpand">Genişlet ↗</button><button type="button" id="acuiDockClose" aria-label="Karakteristik listesini kapat">Kapat ×</button></div>`;
    panel.prepend(handle);
    document.body.append(panel);
    dock=window.ASMachCharacteristicDock.attach(panel,{toggle:$('#acuiDockToggle'),pin:$('#acuiDockPin'),close:$('#acuiDockClose'),expand:[$('#acuiDockExpand'),$('#acuiExpandTable')]});
    filterNode.addEventListener("change", event => {
      const key = event.target.dataset.acuiFilter;
      if (!key) return;
      filters[key] = event.target.value;
      render();
    });
    $("#acuiClearFilters").addEventListener("click", () => {
      Object.keys(filters).forEach(key => filters[key] = key === "sort" ? "number" : "");
      state().search = "";
      if (bridge.elements.searchInput) bridge.elements.searchInput.value = "";
      render();
    });
    body.addEventListener("click", event => {
      if(event.target.closest('.acui-cell-dialog'))return;
      if(event.target.closest('.lc-group,[data-repeat-toggle]'))return;
      event.stopImmediatePropagation();
      if (event.target.closest("input,select,textarea")) return;
      const row = event.target.closest("tr[data-id]");
      if (!row) return;
      if (event.target.closest("[data-open-detail]")) { clearTimeout(rowClickTimer); void openTableInspector(row.dataset.id); return; }
      clearTimeout(rowClickTimer);
      rowClickTimer = setTimeout(() => {state().selectedId=row.dataset.id;bridge.renderAll();}, 230);
    }, true);
    body.addEventListener("dblclick", event => {
      if(event.target.closest('.acui-cell-dialog'))return;
      if(event.target.closest('[data-repeat-toggle]'))return;
      event.stopImmediatePropagation();
      if(event.target.closest('[data-bulk-id]'))return;
      clearTimeout(rowClickTimer);
      const cell = event.target.closest("td");
      if(cell){const key=({method:'inspectionMethod',frequency:'inspectionFrequency',measurement:'nominalValue',information:'inspectionFrequency'})[cell.dataset.column]||cell.dataset.column||cell.dataset.editable;const id=cell.closest('tr[data-id]')?.dataset.id;if(id)void openTableInspector(id,key);}
    }, true);
  }

  function render() {
    if (!initialized) return;
    const records = state().annotations || [];
    if(bulkRecords!==records){bulkSelection.clear();bulkRecords=records;}
    for(const id of bulkSelection)if(!records.some(r=>r.id===id))bulkSelection.delete(id);
    $("#acuiCreateManual").disabled = !state().fileData;
    refreshFilters(records);
    const issuesById = new Map(records.map(record=>[record.id,informationIssues(record)]));
    const query = searchText(state().search).trim().split(/\s+/).filter(Boolean);
    let visible = records.filter(record => {
      if (filters.type && record.type !== filters.type) return false;
      if (filters.page && text(record.page) !== filters.page) return false;
      if (filters.zone && (filters.zone==='__missing' ? text(record.zone).trim()!=='' : text(record.zone)!==filters.zone)) return false;
      if (filters.method && (filters.method==='__missing' ? !issuesById.get(record.id).some(i=>i.code==='method') : !(record.rolePlans?Object.values(record.rolePlans).some(p=>p.enabled&&p.inspectionMethod===filters.method):record.inspectionMethod===filters.method))) return false;
      if (filters.frequency && (filters.frequency==='__missing' ? !issuesById.get(record.id).some(i=>i.code==='frequency') : !(record.rolePlans?Object.values(record.rolePlans).some(p=>p.enabled&&p.inspectionFrequency===filters.frequency):record.inspectionFrequency===filters.frequency))) return false;
      const issues=issuesById.get(record.id);
      if(filters.completeness==='missing'&&!issues.length)return false;
      if(filters.completeness==='complete'&&issues.length)return false;
      if(filters.completeness&&!['missing','complete'].includes(filters.completeness)&&!issues.some(i=>i.code===filters.completeness))return false;
      const score = confidence(record);
      if (filters.confidence === "low" && (score === null || score >= 75)) return false;
      if (filters.confidence === "high" && (score === null || score < 75)) return false;
      if (filters.confidence === "manual" && score !== null) return false;
      const haystack=searchText([record.number,record.page,record.type,record.requirement,record.zone,record.datumRefs,record.specialDesignator,record.comment,record.nominalValue,record.fitClass,record.gdtSubtype,bridge.methodLabel?.(record.inspectionMethod),plan().label(record)].join(' '));
      if(!query.every(word=>haystack.includes(word)))return false;
      return true;
    }).sort((left, right) => {
      if(filters.sort==='missing')return issuesById.get(right.id).length-issuesById.get(left.id).length || text(left.number).localeCompare(text(right.number),'tr',{numeric:true});
      if (filters.sort === "confidence") return (confidence(left) ?? 101) - (confidence(right) ?? 101);
      if (filters.sort === "updated") return text(right.updatedAt).localeCompare(text(left.updatedAt));
      if (filters.sort === "zone") return text(left.zone).localeCompare(text(right.zone), "tr", { numeric: true }) || Number(left.page) - Number(right.page);
      return window.ASMachNumberOrder.records(left,right);
    });
    visible=window.ASMachTableActions?.transform(visible)||visible;
    visibleBulkIds=visible.map(r=>r.id);
    renderBulkControls();
    const body = bridge.elements.balloonTableBody || $("#balloonTableBody");
    const activeEdit = $(".acui-inline-input", body);
    if (!activeEdit) {
      body.innerHTML = visible.length ? visible.map(record => {
        const score = confidence(record);
        const issues = issuesById.get(record.id);
        const activePlans=record.rolePlans?Object.entries(record.rolePlans).filter(([,p])=>p.enabled):[];
        const methodText=record.rolePlans?activePlans.map(([role,p])=>`${window.ASMachRolePlans.roles[role]}: ${bridge.methodLabel?.(p.inspectionMethod)||p.inspectionMethod}`).join(' · '):(bridge.methodLabel?.(record.inspectionMethod)||record.inspectionMethod||'—');
        const frequencyText=record.rolePlans?activePlans.map(([role,p])=>`${window.ASMachRolePlans.roles[role]}: ${plan().label(p)}`).join(' · '):plan().label(record);
        const color = /^#[0-9a-f]{6}$/i.test(record.color) ? record.color : "#087f91";
        return `<tr data-id="${escape(record.id)}" class="${record.id === state().selectedId ? "is-selected " : ""}${score !== null && score < 75 ? "acui-low-confidence" : ""}">
          <td><input type="checkbox" data-bulk-id="${escape(record.id)}" ${bulkSelection.has(record.id)?'checked':''} aria-label="${escape(record.number)} numaralı karakteristiği seç" /></td>
          <td data-editable="number" title="Çift tıklayarak numarayı düzenle"><span class="balloon-dot" style="color:${color}">${escape(record.number)}</span></td>
          <td title="Sheet: ${escape(record.sheetNo || record.page)}">${escape(record.page)}<span class="acui-subtle"> / ${escape(record.sheetNo || record.page)}</span></td>
          <td>${dataImage(record.snapshot) ? `<img class="acui-snapshot-thumb" src="${escape(record.snapshot)}" alt="${escape(record.number)} kaynak görüntüsü" loading="lazy">` : "—"}</td>
          <td data-editable="type" title="${escape(record.type)}">${escape(record.type)}</td>
          <td class="acui-measurement" title="${escape(measurementSummary(record))}">${escape(measurementSummary(record))}</td>
          <td class="acui-requirement" data-editable="requirement" title="${escape(record.requirement)}">${record.type==='GD&T' ? window.ASMachGdtReport.markup(record) : escape(record.requirement || "—")}</td>
          <td data-editable="zone">${escape(record.zone || "—")}</td>
          <td data-editable="inspectionMethod" title="${escape(methodText)}">${escape(methodText)}</td>
          <td data-editable="inspectionFrequency" title="${escape(frequencyText)}">${escape(frequencyText)}</td>
          <td class="acui-information-cell">${issues.length ? `<button type="button" data-open-detail class="acui-issue-button" title="${escape(issues.map(i=>i.label).join('\n'))}" aria-label="${escape(record.number)}: ${escape(issues.map(i=>i.label).join('; '))}">${issues.length} bilgi kontrolü · ${escape(issues[0].label)}</button>` : '<span class="acui-subtle">Bilgiler tamam</span>'}</td>
          <td title="${escape(record.recognitionSource || "Kaynak bilgisi yok")}">${score === null ? "—" : `%${Math.round(score)}`}</td>
          <td><button class="acui-mini-btn" type="button" data-open-detail aria-label="${escape(record.number)} numaralı karakteristiği düzenle">Düzenle</button></td>${['nominalValue','unit','lowerTolerance','upperTolerance','lowerLimit','upperLimit','toleranceStandard'].map(k=>`<td data-extra-column="${k}" ${document.querySelector(`[data-show-column="${k}"]`)?.checked?'':'hidden'}>${escape(['nominalValue','lowerTolerance','upperTolerance','lowerLimit','upperLimit'].includes(k)?engine().displayNumber(record[k]??'—',record):record[k]??'—')}</td>`).join('')}</tr>`;
      }).join("") : `<tr><td class="acui-empty" colspan="13">${records.length ? "Filtrelere uyan karakteristik bulunamadı. Filtreleri temizleyerek tüm kayıtları görebilirsiniz." : "Henüz karakteristik yok. Kutu OCR ile ölçü seçin veya manuel kayıt ekleyin."}</td></tr>`;
    }
    window.ASMachListColumns?.apply();
    const missing=records.filter(r=>issuesById.get(r.id).length).length;
    const active=Object.entries(filters).filter(([key,value])=>key!=='sort'&&value).length+(query.length?1:0);
    $('#acuiClearFilters').hidden=!active&&!window.ASMachTableActions?.hasFilters?.();
    $('#acuiFilterToggle').textContent=active?`Filtreler (${active})`:'Filtreler';
    $('#acuiExtraFilterCount').textContent=[filters.page,filters.zone,filters.confidence].filter(Boolean).length ? `(${[filters.page,filters.zone,filters.confidence].filter(Boolean).length} etkin)` : '';
    $("#acuiListStats").innerHTML = `<span><strong>${visible.length}</strong> / ${records.length} kayıt</span><span>${missing} kayıtta eksik / tutarsız bilgi</span><span>${records.length-missing} kaydın bilgileri tamam</span>${active?`<strong>${active} etkin filtre</strong>`:''}`;
  }

  function renderBulkControls(){
    $('#acuiBulkTools').hidden=!bulkSelection.size;
    const all=$("#acuiBulkAll"),shown=visibleBulkIds.filter(id=>bulkSelection.has(id)).length;
    all.checked=visibleBulkIds.length>0&&shown===visibleBulkIds.length;all.indeterminate=shown>0&&shown<visibleBulkIds.length;all.disabled=!visibleBulkIds.length;
    const hidden=bulkSelection.size-shown;
    $("#acuiBulkCount").textContent=`${bulkSelection.size} seçili${hidden?` (${hidden} filtre dışında)`:''}`;
    const select=$("#acuiBulkMethod"),previous=select.value;
    if(document.activeElement!==select){select.innerHTML=options(methods(),previous,"Kontrol yöntemi seçin");select.value=methods().some(m=>m.value===previous)?previous:"";}
    $("#acuiBulkApply").disabled=!bulkSelection.size;
    $('#acuiBulkFrequencyApply').disabled=!bulkSelection.size;
    $("#acuiBulkClear").disabled=!bulkSelection.size;
    $('#acuiBulkDelete').disabled=!bulkSelection.size;
    $('#acuiBulkDelete').textContent=`Seçilenleri sil (${bulkSelection.size})`;
  }

  function applyBulkFrequency(){
    if(state().annotations.some(r=>bulkSelection.has(r.id)&&r.rolePlans)){window.ASMachCharacteristicEditing.open(bridge,[...bulkSelection]);bridge.toast?.('Kalite / operatör için değişecek sıklık alanını seçin. Ortak alanlara yazılmadı.');return;}
    const values={inspectionFrequency:$('#acuiBulkFrequency').value,frequencyInterval:$('#acuiBulkInterval').value.trim(),frequencyNote:$('#acuiBulkFrequencyNote').value.trim()};
    if(!['EVERY_N_PIECES','EVERY_N_HOURS'].includes(values.inspectionFrequency))values.frequencyInterval='';
    const error=plan().validate(values);if(error){bridge.toast?.(error,true);return;}
    const records=state().annotations.filter(r=>bulkSelection.has(r.id)&&Object.entries(values).some(([k,v])=>(r[k]||'')!==v));
    if(!records.length)return;
    bridge.checkpoint();for(const record of records){Object.assign(record,values);record.manualFields=[...new Set([...(record.manualFields||[]),...Object.keys(values)])];recordChange('Toplu kontrol sıklığı değiştirildi',record);}
    bridge.renderAll();bridge.toast?.(`${records.length} karakteristiğin kontrol sıklığı güncellendi.`);
  }

  function applyBulkMethod(){
    if(state().annotations.some(r=>bulkSelection.has(r.id)&&r.rolePlans)){window.ASMachCharacteristicEditing.open(bridge,[...bulkSelection]);bridge.toast?.('Kalite / operatör için değişecek yöntem alanını seçin. Ortak alanlara yazılmadı.');return;}
    const method=$("#acuiBulkMethod").value;
    if(!methods().some(m=>m.value===method)){bridge.toast?.("Önce kontrol yöntemi seçin.",true);return;}
    const records=state().annotations.filter(r=>bulkSelection.has(r.id)&&r.inspectionMethod!==method);
    if(!records.length){bridge.toast?.("Seçili kayıtlarda değişiklik gerekmiyor.");return;}
    bridge.checkpoint();
    for(const record of records){
      const apply=bridge.applyMethodStyle||bridge.applyMethodToAnnotation;
      if(apply)apply(record,method);else record.inspectionMethod=method;
      record.manualFields=[...new Set([...(record.manualFields||[]),"inspectionMethod"])];
      bridge.recordChange?.("Toplu kontrol yöntemi değiştirildi",record);
    }
    bridge.renderAll();
    bridge.toast?.(`${records.length} karakteristiğin kontrol yöntemi ve balon stili güncellendi.`);
  }

  function refreshFilters(records) {
    const distinct = key => [...new Set(records.map(record => text(record[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
    const datasets = {
      type: [distinct("type"), "Tüm türler"],
      page: [distinct("page").map(value => ({ value, label: `Sayfa ${value}` })), "Tüm sayfalar"],
      zone: [[{value:'__missing',label:'Zone belirtilmemiş'},...distinct("zone")], "Tüm zone'lar"],
      method: [[{value:'__missing',label:'Yöntem eksik / geçersiz'},...methods()], "Tüm yöntemler"],
      frequency: [[{value:'__missing',label:'Sıklık eksik / tamamlanmamış'},...plan().FREQUENCIES.filter(f=>f.value)], 'Tüm sıklıklar'],
      completeness: [[{value:'missing',label:'Eksik / tutarsız bilgi olanlar'},{value:'complete',label:'Bilgileri tamam olanlar'},...Object.entries({identity:'Numara / sayfa',type:'Karakteristik türü',requirement:'Gereklilik',method:'Kontrol yöntemi',frequency:'Kontrol sıklığı',nominal:'Nominal / limit ölçü',unit:'Birim',tolerance:'Tolerans / kabul sınırı',gdt:'GD&T türü',inconsistent:'Sayısal tutarsızlık'}).map(([value,label])=>({value,label:`Kontrol: ${label}`}))], 'Tüm bilgi kontrolleri'],
      confidence: [[{ value: "low", label: "Düşük güven (< %75)" }, { value: "high", label: "Güven ≥ %75" }, { value: "manual", label: "Güven puanı yok" }], "Tüm OCR güvenleri"],
      sort: [[{ value: "number", label: "Balon numarası" }, {value:'missing',label:'Bilgi eksiği fazla olanlar önce'}, { value: "confidence", label: "Düşük OCR güveni önce" }, { value: "updated", label: "Son düzenlenen önce" }, { value: "zone", label: "Zone sırası" }], ""],
    };
    Object.entries(datasets).forEach(([key, [items, label]]) => {
      const select = $(`[data-acui-filter="${key}"]`);
      if (!select || document.activeElement === select) return;
      const available = items.map(item => typeof item === "string" ? item : text(item.value));
      if (filters[key] && !available.includes(filters[key])) filters[key] = key === "sort" ? "number" : "";
      select.innerHTML = options(items, filters[key], label);
    });
  }

  async function openTableInspector(id,name){
    if(state().controlledDraft){bridge.toast('Önce sağ paneldeki kontrollü seçimi kaydedin veya iptal edin.');return;}
    await bridge.focusAnnotation?.(id);
    const tab=['inspectionMethod','inspectionFrequency','status','result'].includes(name)?'Denetleme':'Genel';
    [...document.querySelectorAll('#selectionForm .cw-tabs button')].find(b=>b.textContent===tab)?.click();
    const ids={classification:'characteristicClass',number:'balloonNumber',type:'characteristicType',requirement:'requirement',nominalValue:'nominalValue',unit:'measurementUnit',lowerTolerance:'lowerTolerance',upperTolerance:'upperTolerance',inspectionMethod:'inspectionMethod',inspectionFrequency:'ctFrequency',status:'balloonStatus',result:'ctResultValue'};
    let input=document.getElementById(ids[name]);
    const record=state().annotations.find(r=>r.id===id);
    if(tab==='Denetleme'){
      const role=record?.rolePlans?['operator','quality'].find(k=>record.rolePlans[k]?.enabled)||'operator':'common';
      document.querySelector('#ipControlPane .ct-tabs [data-role="'+role+'"]')?.click();
      if(role!=='common')input=document.querySelector('#ipControlPane [data-role="'+role+'"][data-key="'+name+'"]');
    }
    if(['lowerLimit','upperLimit'].includes(name))input=document.querySelector('#selectionForm [data-limit="'+name+'"]');
    if(name==='requirement')input=document.getElementById('requirement')?.previousElementSibling?.querySelector('.gt-rich')||input;
    if(input){for(let parent=input.parentElement;parent&&parent.id!=='selectionForm';parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;input.scrollIntoView({block:'nearest'});if(!input.disabled)input.focus({preventScroll:true});input.animate([{outline:'2px solid #0095a6'},{outline:'2px solid transparent'}],{duration:1500});}
  }
  function openEditor(id) {
    const record=state().annotations.find(item=>item.id===id);if(!record)return;
    state().selectedId=id;bridge.renderAll();
    document.getElementById('cwInspectorTab0')?.click();
    document.getElementById('characteristicType')?.focus({preventScroll:true});
  }
  function openInspectorPlan(){document.getElementById('cwInspectorTab2')?.click();document.getElementById('ciEditPlans')?.click();}

  async function editRegion(reselect) {
    if(regionEditing||!window.ASMachCharacteristicRegion)return;
    const dialog=$('#acuiEditor'),id=editorId,records=state().annotations;
    const draft=readEditor();
    regionEditing=true;
    closeDialog(dialog);
    try{
      const patch=await window.ASMachCharacteristicRegion.open(bridge,clone(draft),{reselect});
      if(patch&&records===state().annotations&&id===editorId){
        regionDraft={...regionDraft,...patch};
        if(patch.rolePlans!==undefined&&$('#acuiRolePlans'))rolePlanEditor=window.ASMachRolePlans.mount($('#acuiRolePlans'),{...draft,...patch},methods(),()=>state().metadata?.inspectionReport?.lotSize);
        for(const name of editableFields)if(patch[name]!==undefined&&field(name)){
          field(name).value=valueString(patch[name]);
          if(name==='requirement'&&patch.requirementMode==='auto')manualFields.delete(name);else manualFields.add(name);
          if(['lowerTolerance','upperTolerance'].includes(name)&&patch.toleranceExplicit===false)manualFields.delete(name);
        }
        if(patch.requirementMode)$('#acuiAutoParse').checked=patch.requirementMode==='auto';
        if(patch.ocrText!==undefined){$('#acuiOcrRaw').textContent=patch.ocrText;$('#acuiOcrRaw').hidden=!patch.ocrText;$('#acuiReadSource').disabled=!patch.ocrText;}
        field('page').value=String(patch.page);
        const image=$('#acuiSnapshot');image.src=patch.snapshot;image.hidden=false;
        $('#acuiNoSnapshot').hidden=true;$('#acuiEditRegion').disabled=false;
        $('#acuiSourceFacts').innerHTML=`<dt>Kaynak</dt><dd>${patch.ocrText!==undefined?'Yeniden seçimde doğrulanan ölçü':'Düzenlenmiş seçim · önceki OCR korundu'}</dd><dt>Seçim bölgesi</dt><dd>${Math.round(patch.selectionBox.w*100)}% × ${Math.round(patch.selectionBox.h*100)}%</dd>`;
        $('#acuiRegionNote').textContent=patch.nominalValue!==undefined?'Kutu ve doğrulanan ölçü alanları taslakta. Ana formu kaydederek uygulayın.':'Yeni kutu taslakta. Ölçü alanları korunuyor. Ana formu kaydederek uygulayın.';
        updateEditorDisplay();
      }
    }catch(error){bridge.toast?.(`Çizim bölgesi açılamadı: ${error.message||error}`,true);}
    finally{
      regionEditing=false;
      if(records===state().annotations&&id===editorId&&records.some(r=>r.id===id))showDialog(dialog);
    }
  }

  function enableEditorRequirementAuto() {
    manualFields.delete('requirement');delete field('requirement').dataset.manual;
    $('#acuiAutoParse').checked=true;
  }

  function transitionEditorType(type) {
    const previous=field('type').dataset.previousType;
    field('type').dataset.previousType=type;
    if(previous===type)return;
    const draft={...state().annotations.find(item=>item.id===editorId),...parsedMetadata,...regionDraft};
    editableFields.forEach(name=>{if(field(name))draft[name]=field(name).value.trim();});
    let cleaned=engine().transitionType({...draft,type:previous,manualFields:[...manualFields]},type);
    cleaned.unit=window.ASMachCharacteristicEditing.defaultUnitForType(type,state().generalTolerance?.unit);
    cleaned=window.ASMachCharacteristicEditing.refreshGeneral(cleaned,state().generalTolerance,bridge.parseRequirement);
    for(const name of [...parsedFields,'specialDesignator'])if(field(name)){field(name).value=valueString(cleaned[name]);if(String(draft[name]??'')!==String(cleaned[name]??''))manualFields.add(name);}
    for(const key of ['gdtFrame','callout','surfaceTexture','chamferAngle','chamferAngleTolerance','angleFormat','nominalSource','limitDimension','toleranceExplicit','lowerInclusive','upperInclusive']){parsedMetadata[key]=cleaned[key];regionDraft[key]=cleaned[key];}
    if(!cleaned.toleranceExplicit)for(const key of ['lowerTolerance','upperTolerance','lowerLimit','upperLimit'])manualFields.delete(key);
    $('#acuiReferenceLength').value=cleaned.referenceLength||'';
    const unit=window.ASMachCharacteristicEditing.defaultUnitForType(type,state().generalTolerance?.unit),control=field('unit');
    if(control.tagName==='SELECT'&&![...control.options].some(o=>o.value===unit))control.add(new Option(unit||'—',unit));
    control.value=unit;manualFields.add('unit');
    enableEditorRequirementAuto();
  }

  function readEditor() {
    const record = state().annotations.find(item => item.id === editorId);
    const updated = { ...record, ...parsedMetadata, ...regionDraft };
    if(rolePlanEditor)updated.rolePlans=rolePlanEditor.read();
    editableFields.forEach(name => { if (field(name)) updated[name] = field(name).value.trim(); });
    updated.page = Number(updated.page) || record?.page || 1;
    updated.referenceLength=Number($('#acuiReferenceLength').value)||0;
    if(manualFields.has('lowerTolerance')||manualFields.has('upperTolerance'))updated.toleranceExplicit=true;
    numericFields.forEach(name => { if (finiteNumber(updated[name])) updated[name] = normalizedNumber(updated[name]); });
    updated.requirementMode=$('#acuiAutoParse').checked?'auto':'manual';
    if(updated.type==='Not'){
      updated.autoParse=false;
      for(const name of [...numericFields,'unit','toleranceStandard'])updated[name]='';
      updated.toleranceExplicit=false;updated.evaluationMethod='OK_NOT_OK';
    }
    if(!['EVERY_N_PIECES','EVERY_N_HOURS'].includes(updated.inspectionFrequency))updated.frequencyInterval='';
    if(updated.type==='GD&T')updated.nominalValue='';
    if (updated.evaluationMethod === "VALUE" && finiteNumber(updated.result)) updated.result = normalizedNumber(updated.result);
    const framed = engine().withGdtSubtype ? engine().withGdtSubtype(updated) : updated;
    return engine().syncRequirement ? engine().syncRequirement({...framed, manualFields:[...manualFields]},false,{clearIncomplete:true}) : framed;
  }

  function parseEditor(explicit) {
    if (parsing) return;
    parsing = true;
    try {
      const source = regionDraft.ocrText ?? state().annotations.find(item => item.id === editorId)?.ocrText;
      if (!source) return;
      const parsed = bridge.parseRequirement?.(source);
      if (!parsed) return;
      let protectedCount = 0;
      if (!manualFields.has('gdtSubtype')) field('gdtSubtype').innerHTML = options(engine().gdtOptions?.(parsed.gdtSubtype) || [], parsed.gdtSubtype);
      parsedFields.forEach(name => {
        if (!field(name) || parsed[name] === undefined) return;
        if (manualFields.has(name)) { protectedCount++; return; }
        field(name).value = valueString(parsed[name]);
      });
      parsedMetadata = {
        measurementEvidence: parsed.measurementEvidence,
        nominalSource: manualFields.has('nominalValue')?'manual':parsed.nominalSource||'',
        limitDimension: parsed.limitDimension===true&&!manualFields.has('lowerTolerance')&&!manualFields.has('upperTolerance'),
        decimalPlaces: parsed.decimalPlaces,
        parseWarnings: parsed.parseWarnings || [],
        gdtFrame: parsed.gdtFrame || null,
        quantity: parsed.quantity || 1,
        chamferAngle: parsed.chamferAngle || "",
        chamferAngleTolerance: parsed.chamferAngleTolerance || "",
        lowerInclusive: parsed.lowerInclusive !== false,
        upperInclusive: parsed.upperInclusive !== false,
        toleranceExplicit: manualFields.has("lowerTolerance") || manualFields.has("upperTolerance") ? true : Boolean(parsed.toleranceExplicit),
      };
      if (parsed.specialDesignator !== undefined && !manualFields.has("specialDesignator")) field("specialDesignator").value = valueString(parsed.specialDesignator);
      if (["nominalValue", "lowerTolerance", "upperTolerance"].some(name => manualFields.has(name))) recalculateLimits(false);
      const warnings = Array.isArray(parsed.parseWarnings) ? parsed.parseWarnings : [];
      $("#acuiValidation").textContent = warnings.join("\n");
      $("#acuiParsingNote").textContent = protectedCount ? `${protectedCount} elle düzenlenmiş alan korundu. Gerekiyorsa bu değerleri doğrudan güncelleyebilirsiniz.` : "Ölçü türü, nominal ve tolerans alanları metinden algılandı. Kaydetmeden önce kontrol edin.";
      if (explicit) { enableEditorRequirementAuto();bridge.toast?.("Kaynak yeniden değerlendirildi; manuel ölçü alanları korundu ve gereklilik yenilendi."); }
      updateEditorDisplay();
    } finally { parsing = false; }
  }

  function recalculateLimits(force) {
    const nominal = field("nominalValue").value;
    const base={...state().annotations.find(r=>r.id===editorId),...parsedMetadata,...regionDraft};
    if(base.limitDimension&&!force&&!manualFields.has('lowerTolerance')&&!manualFields.has('upperTolerance')){
      if(manualFields.has('nominalValue')){
        parsedMetadata.nominalSource='manual';regionDraft.nominalSource='manual';
        for(const [tol,limit] of [['lowerTolerance','lowerLimit'],['upperTolerance','upperLimit']])field(tol).value=finiteNumber(nominal)&&finiteNumber(field(limit).value)?rounded(Number(field(limit).value)-Number(normalizedNumber(nominal))):'';
      }
      return;
    }
    if(base.limitDimension){parsedMetadata.limitDimension=false;parsedMetadata.nominalSource='';regionDraft.limitDimension=false;regionDraft.nominalSource='';field('toleranceStandard').value='Manuel düzenleme';}
    if (field("type").value === "GD&T") {
      const tolerance = field("upperTolerance").value;
      if (finiteNumber(tolerance)) {
        if (force || !manualFields.has("lowerLimit")) field("lowerLimit").value = "0";
        if (force || !manualFields.has("upperLimit")) field("upperLimit").value = normalizedNumber(tolerance);
        if (force) ["lowerLimit", "upperLimit"].forEach(name => { manualFields.delete(name); delete field(name).dataset.manual; });
      }
      return;
    }
    for (const [toleranceName, limitName] of [["lowerTolerance", "lowerLimit"], ["upperTolerance", "upperLimit"]]) {
      if (!force && manualFields.has(limitName)) continue;
      const tolerance = field(toleranceName).value;
      field(limitName).value = finiteNumber(nominal) && finiteNumber(tolerance) ? rounded(Number(normalizedNumber(nominal)) + Number(normalizedNumber(tolerance))) : "";
      if (force) {
        manualFields.delete(limitName);
        delete field(limitName).dataset.manual;
      }
    }
    const updated=window.ASMachCharacteristicEditing.preserveSurfaceBound(base,{...base,nominalValue:nominal,lowerTolerance:field('lowerTolerance').value,upperTolerance:field('upperTolerance').value,lowerLimit:field('lowerLimit').value,upperLimit:field('upperLimit').value});
    field('lowerLimit').value=updated.lowerLimit??'';field('upperLimit').value=updated.upperLimit??'';
  }

  function updateEditorDisplay() {
    const record = readEditor();
    const issues=informationIssues(record);
    const checks=$('#acuiInformationCheck');
    checks.innerHTML=`<strong>${issues.length?`${issues.length} bilgi kontrolü`:'Karakteristik bilgileri tamam'}</strong><p>Kontrol planı bilgilerini denetler; ölçüm sonucu veya onay durumu istemez. Eksik kayıtlar taslak olarak saklanabilir.</p>${issues.length?`<ul>${issues.map(i=>`<li><button type="button" data-information-field="${escape(i.field)}">${escape(i.label)}</button></li>`).join('')}</ul>`:''}`;
    checks.onclick=event=>{const name=event.target.dataset.informationField;if(name){field(name)?.scrollIntoView({block:'center'});field(name)?.focus();}};
    if ($('#acuiAutoParse').checked) field('requirement').value = record.requirement;
    $('#acuiParsingNote').textContent = $('#acuiAutoParse').checked ? 'Otomatik: tür, nominal, tolerans ve türe özel alanları takip eder.' : 'Manuel: metniniz korunur. Bir ölçü alanını değiştirirseniz gereklilik yeniden otomatik oluşturulur.';
    const profile = engine().fieldProfile?.(record.type);
    const textual = profile ? !profile.numeric : ["Not", "Teknik not", "Malzeme", "Proses", "Datum", "Görsel", "Diğer"].includes(record.type);
    field('frequencyInterval').closest('.acui-field').hidden=!['EVERY_N_PIECES','EVERY_N_HOURS'].includes(record.inspectionFrequency);
    const noteMethods=$('#acuiNoteMethods');noteMethods.hidden=record.type!=='Not';
    if(record.type==='Not'){
      field('evaluationMethod').value='OK_NOT_OK';
      noteMethods.innerHTML=`<span>Nota uygun yöntem önerileri — seçiminizle uygulanır:</span><div class="acui-frequency-quick">${plan().suggestions(record.requirement).map(m=>`<button type="button" data-note-method="${escape(m.value)}">${escape(m.label)}${m.recommended?' · Önerilen':''}</button>`).join('')}</div>`;
    }
    field('evaluationMethod').disabled=record.type==='Not';
    $("#acuiNumericSection").hidden = textual;
    $('#acuiGeneralApply').hidden=!['Uzunluk','Ölçü','Çap','Yarıçap','Pah','Açı'].includes(record.type)||!!record.fitClass;
    $('#acuiReferenceField').hidden=record.type!=='Açı';
    field("nominalValue").closest(".acui-field").hidden = profile ? !profile.nominal : record.type === "GD&T";
    $("#acuiGdtSection").hidden = !["GD&T", "Datum", "Tolerans"].includes(record.type) && !record.datumRefs;
    $('#acuiDatumColumns').hidden=record.type!=='GD&T';
    field('datumRefs').closest('.acui-field').hidden=record.type==='GD&T';
    const datums=engine().datumTokens(record.datumRefs);
    [0,1,2].forEach(i=>{const input=$(`[data-datum-slot="${i}"]`);if(document.activeElement!==input)input.value=datums[i]||'';});
    const report=window.ASMachGdtReport?.render(record),reportImage=$('#acuiGdtReportImage');reportImage.hidden=!report;if(report)reportImage.src=report.dataUrl;
    $("#acuiThreadFields").hidden = !["Diş", "Geçme"].includes(record.type) && !record.fitClass;
    for (const name of ['threadPitch', 'threadClass', 'threadStandard']) field(name).closest('.acui-field').hidden = record.type !== 'Diş';
    field('fitClass').closest('.acui-field').hidden = record.type === 'Diş';
    $("#acuiValueResult").hidden = record.evaluationMethod === "OK_NOT_OK";
    $("#acuiBinaryResult").hidden = record.evaluationMethod !== "OK_NOT_OK";
    $("#acuiBinaryResultSelect").value = ["OK", "NOT_OK"].includes(record.result) ? record.result : "";
    const result = evaluate(record);
    const evaluationNode = $("#acuiEvaluation");
    evaluationNode.className = `acui-evaluation ${["pass", "fail", "pending", "invalid"].includes(result.result) ? result.result : "pending"}`;
    evaluationNode.innerHTML = `<strong>${escape(result.label || "Sonuç bekleniyor")}</strong><small>${escape(result.note || result.reason || "Sonuç alt ve üst limitlere göre değerlendirilir.")}</small>`;
    field("nonconformanceNo").style.borderColor = result.result === "fail" ? "#de8a85" : "";
    const cells = engine().gdtCells ? engine().gdtCells(record) : text(record.requirement).split(/\|/).map(item => item.trim()).filter(Boolean);
    $("#acuiGdtFrame").innerHTML = record.type === "GD&T" ? window.ASMachGdtReport.markup(record,32) : "";
    window.ASMachEditorSections?.detail(record);
  }

  async function saveEditor(event) {
    event.preventDefault();
    const record = state().annotations.find(item => item.id === editorId);
    if (!record) return;
    const updated = readEditor();
    const verifiedWarnings=$('#acuiConfirmWarnings').checked?(engine().activeWarnings?.(updated)||updated.parseWarnings||[]):[];
    if(verifiedWarnings.some(w=>/Açı genel toleransı için kısa kenar/.test(w))){$('#acuiValidation').textContent='Açı için kısa kenar girip genel toleransı uygulayın veya resimdeki açık toleransı girin. Bu hesaplama gereksinimi onay kutusuyla giderilemez.';return;}
    const errors = [];
    errors.push(...(engine().consistencyErrors?.(updated)||[]));
    const frequencyError=plan().validate(updated);if(frequencyError)errors.push(frequencyError);
    if(updated.type==='Not'&&!updated.requirement)errors.push('Not gerekliliğini yazın.');
    if (!updated.number) errors.push("Balon numarası boş bırakılamaz.");
    if (!bridge.planNumberChange && state().annotations.some(item => item.id !== record.id && text(item.number) === updated.number)) errors.push("Bu balon numarası başka bir kayıtta kullanılıyor.");
    if (!Number.isInteger(updated.page) || updated.page < 1 || updated.page > Math.max(1, state().pageCount || 1)) errors.push("Belge içinde geçerli bir sayfa seçin.");
    if (finiteNumber(updated.lowerLimit) && finiteNumber(updated.upperLimit) && Number(normalizedNumber(updated.lowerLimit)) > Number(normalizedNumber(updated.upperLimit))) errors.push("Alt limit üst limitten büyük olamaz.");
    numericFields.forEach(name => { if (updated[name] && !finiteNumber(updated[name])) errors.push(`${field(name)?.previousElementSibling?.textContent || name} için geçerli bir sayı girin.`); });
    if (updated.evaluationMethod === "VALUE" && updated.result && !finiteNumber(updated.result)) errors.push("Ölçüm sonucu sayısal olmalıdır. Görsel kontroller için OK / NOT OK seçin.");
    if (errors.length) { $("#acuiValidation").textContent = errors.join("\n"); $("#acuiValidation").scrollIntoView({ block: "nearest" }); return; }
    let numberPlan=bridge.planNumberChange?.(record.id,updated.number);
    if(numberPlan?.conflict)numberPlan=await bridge.resolveNumberChange(record.id,updated.number);
    if(bridge.planNumberChange){
      if(!numberPlan)return;
      if(numberPlan.error||!bridge.validNumberChange(numberPlan)||!state().annotations.includes(record)){
        $('#acuiValidation').textContent=numberPlan.error||'Balon listesi değişti. Kaydetmeyi yeniden deneyin.';return;
      }
    }
    bridge.checkpoint();
    if(numberPlan)bridge.applyNumberChange(numberPlan);
    const oldMethod = record.inspectionMethod;
    Object.assign(record, updated);
    if(verifiedWarnings.length){record.parseWarnings=(record.parseWarnings||[]).filter(w=>!verifiedWarnings.includes(w));recordChange('Kaynak resim kontrol edilerek algılama uyarıları doğrulandı: '+verifiedWarnings.join(' · '),record);}
    record.manualFields = [...manualFields];
    // Parsing is an explicit edit-time action; saving must never overwrite entered values.
    if (manualFields.has("lowerTolerance") || manualFields.has("upperTolerance")) record.toleranceExplicit = true;
    if (oldMethod !== record.inspectionMethod) applyMethod(record, record.inspectionMethod);
    recordChange("Karakteristik güncellendi", record);
    state().selectedId = record.id;
    closeDialog($("#acuiEditor"));
    bridge.renderAll();
    bridge.toast?.(`#${record.number} karakteristiği kaydedildi.`);
  }

  async function openSafeCellEditor(cell){
    const id=cell.closest('tr[data-id]')?.dataset.id,record=state().annotations.find(r=>r.id===id);if(!record)return;
    const aliases={method:'inspectionMethod',frequency:'inspectionFrequency'},column=cell.dataset.column;
    const key=aliases[column]||column||cell.dataset.editable;
    const numeric=['nominalValue','lowerTolerance','upperTolerance','lowerLimit','upperLimit'];
    if(![...numeric,'type','classification','inspectionMethod','inspectionFrequency'].includes(key))return;
    state().selectedId=id;bridge.renderAll();
    if(record.rolePlans&&['inspectionMethod','inspectionFrequency'].includes(key)){void openTableInspector(id,key);return;}
    const sources={type:'#characteristicType',classification:'#characteristicClass',inspectionMethod:'#inspectionMethod'};
    const source=sources[key]?document.querySelector(sources[key]):null;
    document.querySelector('.acui-cell-dialog')?.close?.();
    const d=document.createElement('div');d.className='acui-cell-dialog acui-cell-inline';d.innerHTML='<form><strong hidden></strong><div data-control></div><footer><button type="button" data-cancel title="Vazgeç (Esc)">×</button><button type="submit" title="Uygula (Enter)">✓</button></footer></form>';
    d.querySelector('strong').textContent='Karakteristik #'+record.number+' · '+(cell.title||key);
    const input=document.createElement(numeric.includes(key)?'input':'select');input.setAttribute('aria-label','Yeni değer');
    if(source)for(const o of source.options)input.append(o.cloneNode(true));
    if(key==='inspectionFrequency')input.innerHTML=options(plan().FREQUENCIES,record[key]||'');
    input.value=record[key]??'';if(numeric.includes(key))input.inputMode='decimal';d.querySelector('[data-control]').append(input);
    const stamp=JSON.stringify(record);d.close=()=>{d.remove();bridge.renderAll();};d.querySelector('[data-cancel]').onclick=()=>d.close();
    d.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Escape'){ev.preventDefault();d.close();}else if(ev.key==='Enter'){ev.preventDefault();d.querySelector('form').requestSubmit();}});input.addEventListener('input',()=>input.setCustomValidity(''));
    d.querySelector('form').onsubmit=async ev=>{ev.preventDefault();if(JSON.stringify(record)!==stamp||state().selectedId!==id){d.close();return;}
      let value=input.value;const patch={[key]:value};
      if(numeric.includes(key)){const n=record.type==='Açı'?window.ASMachRequirements.parseAngle(value):value.trim()?Number(value.replace(',','.')):NaN;if(n==null||!Number.isFinite(n)){input.setCustomValidity('Geçerli sayısal değer girin.');input.reportValidity();return;}input.setCustomValidity('');patch[key]=String(n);const next={...record,...patch},fmt=n=>String(Number(n.toFixed(10)));
        if(key.endsWith('Limit')){const lo=Number(next.lowerLimit),hi=Number(next.upperLimit);if(!String(next.lowerLimit??'').trim()||!String(next.upperLimit??'').trim()||lo>hi){input.setCustomValidity('İki limit geçerli olmalı; alt limit üst limiti aşamaz.');input.reportValidity();return;}const mid=lo+(hi-lo)/2;Object.assign(patch,{nominalValue:fmt(mid),lowerTolerance:fmt(lo-mid),upperTolerance:fmt(hi-mid)});}else{for(const [tol,lim]of [['lowerTolerance','lowerLimit'],['upperTolerance','upperLimit']])patch[lim]=next.nominalValue!==''&&next[tol]!==''?fmt(Number(next.nominalValue)+Number(next[tol])):'';}
        patch.toleranceExplicit=true;patch.toleranceStandard='Manuel düzenleme';d.close();await window.ASMachCharacteristicEditing.confirmCorrection(bridge,record,patch);return;
      }
      d.close();if(key==='type'){await window.ASMachCharacteristicEditing.confirmCorrection(bridge,record,patch);return;}
      if(key==='inspectionFrequency'&&['CUSTOM','EVERY_N_PIECES','EVERY_N_HOURS'].includes(value)){openEditor(id);openInspectorPlan();return;}
      bridge.checkpoint();if(key==='inspectionMethod')bridge.applyMethodStyle(record,value);else record[key]=value;bridge.recordChange('Tablo alanı düzenlendi',record);bridge.renderAll();
    };
    const liveRow=[...document.querySelectorAll('.acui-table tr[data-id]')].find(r=>r.dataset.id===id);
    const liveCell=[...(liveRow?.querySelectorAll('td')||[])].find(c=>column?c.dataset.column===column:c.dataset.editable===key);if(!liveCell)return;
    liveCell.style.position='relative';liveCell.style.overflow='visible';liveCell.append(d);input.focus();if(input.select)input.select();
  }
  function startQuickEdit(cell) {
    if ($( ".acui-inline-input", cell)) return;
    const id = cell.closest("tr").dataset.id;
    const record = state().annotations.find(item => item.id === id);
    if (!record) return;
    const name = cell.dataset.editable;
    if(record.rolePlans&&['inspectionMethod','inspectionFrequency'].includes(name)){openEditor(id);openInspectorPlan();return;}
    const previous = text(record[name]);
    const selectItems = name === 'inspectionFrequency' ? plan().FREQUENCIES : name === "type" ? types() : name === "inspectionMethod" ? methods() : name === "status" ? statuses() : name === "result" && record.evaluationMethod === "OK_NOT_OK" ? [{ value: "", label: "Bekliyor" }, { value: "OK", label: "OK" }, { value: "NOT_OK", label: "NOT OK" }] : null;
    const input = document.createElement(selectItems ? "select" : "input");
    input.className = "acui-inline-input";
    input.setAttribute("aria-label", `${record.number} / ${name}`);
    if (selectItems) input.innerHTML = options(selectItems, previous);
    else input.value = previous;
    let finished = false;
    const commit = async save => {
      if (finished) return;
      finished = true;
      const value = input.value.trim();
      if(save&&name==='inspectionFrequency'&&['EVERY_N_PIECES','EVERY_N_HOURS','CUSTOM'].includes(value)){
        input.remove();openEditor(id);openInspectorPlan();return;
      }
      if (save && value !== previous) {
        if(name==='number'&&bridge.changeBalloonNumber){input.remove();await bridge.changeBalloonNumber(id,value);return;}
        if (name === "number" && (!value || state().annotations.some(item => item.id !== id && text(item.number) === value))) { bridge.toast?.("Balon numarası boş veya başka bir kayıtta kullanılıyor."); input.remove(); render(); return; }
        if (name === "result" && record.evaluationMethod !== "OK_NOT_OK" && value && !finiteNumber(value)) { bridge.toast?.("Geçerli bir sayısal ölçüm girin."); input.remove(); render(); return; }
        const previousType=record.type;
        bridge.checkpoint();
        record[name] = name === "result" && record.evaluationMethod !== "OK_NOT_OK" ? normalizedNumber(value) : value;
        if(name==='type'){
          Object.assign(record,engine().transitionType({...record,type:previousType},value));
          record.unit=window.ASMachCharacteristicEditing.defaultUnitForType(value,state().generalTolerance?.unit);
          Object.assign(record,window.ASMachCharacteristicEditing.refreshGeneral(record,state().generalTolerance,bridge.parseRequirement));
        }
        if (name === "inspectionMethod") applyMethod(record, value);
        if(name==='inspectionFrequency')record.frequencyInterval='';
        if(name==='type'&&value==='Not'){
          for(const key of [...numericFields,'unit','toleranceStandard'])record[key]='';
          record.evaluationMethod='OK_NOT_OK';record.autoParse=false;record.toleranceExplicit=false;
          if(!['','OK','NOT_OK'].includes(record.result))record.result='';
        }
        record.manualFields = [...new Set([...(record.manualFields || []), name])];
        if (name === 'requirement') record.requirementMode = 'manual';
        if (engine().syncRequirement) Object.assign(record, engine().syncRequirement(record,[...parsedFields,'specialDesignator'].includes(name)));
        // A quick requirement edit preserves existing nominal/tolerance overrides.
        recordChange(`Hızlı düzenleme: ${name}`, record);
        input.remove();
        bridge.renderAll();
      } else { input.remove(); render(); }
    };
    input.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.key === "Enter") { event.preventDefault(); commit(true); }
      if (event.key === "Escape") { event.preventDefault(); commit(false); }
    });
    input.addEventListener("blur", () => commit(true));
    if(name==='inspectionFrequency')input.addEventListener('change',()=>commit(true));
    cell.replaceChildren(input);
    input.focus();
    input.select?.();
  }

  function openMetadata() {
    const metadata = state().metadata || {};
    $$("[data-metadata-field]").forEach(element => { element.value = text(metadata[element.dataset.metadataField]); });
    const general = state().generalTolerance || {};
    const standard = general.standard || "";
    if (standard && ![...$("#acuiGeneralStandard").options].some(item => item.value === standard)) $("#acuiGeneralStandard").add(new Option(standard, standard));
    $("#acuiGeneralStandard").value = standard;
    $("#acuiGeneralLower").value = general.lower ?? "";
    $("#acuiGeneralUpper").value = general.upper ?? "";
    window.ASMachCharacteristicEditing.mountPrecisionRules($('#acuiGeneralUpper').closest('.acui-grid'),general);
    updateGeneralFields();
    const records = state().annotations;
    const pending = records.filter(record => ["needs_review", "pending_review", "KONTROL", "TASLAK"].includes(record.status)).length;
    const approved = records.filter(record => ["approved", "ONAYLI", "pass"].includes(record.status)).length;
    const measured = records.filter(record => !["", null, undefined].includes(record.result)).length;
    $("#acuiMetadataKpis").innerHTML = [[records.length, "Karakteristik"], [pending, "İnceleme bekliyor"], [approved, "Onaylanan"], [measured, "Ölçülen"]].map(([count, label]) => `<div class="acui-kpi"><strong>${count}</strong><span>${label}</span></div>`).join("");
    showDialog($("#acuiMetadata"));
  }

  function updateGeneralFields() {
    const custom = ($("#acuiGeneralStandard").value === "CUSTOM" || /^ASME Y14\.5-/.test($("#acuiGeneralStandard").value));
    $("#acuiGeneralLower").disabled = !custom;
    $("#acuiGeneralUpper").disabled = !custom;
    const rules=$('#acuiMetadata').querySelector('[data-precision-rules]');if(rules)rules.style.display=/^ASME/.test($('#acuiGeneralStandard').value)?'flex':'none';
  }

  function saveMetadata(event) {
    event.preventDefault();
    const standard = $("#acuiGeneralStandard").value;
    const lower = normalizedNumber($("#acuiGeneralLower").value);
    const upper = normalizedNumber($("#acuiGeneralUpper").value);
    const precision=window.ASMachCharacteristicEditing.readPrecisionRules($('#acuiMetadata'));
    if(/^ASME/.test(standard)&&precision.error){bridge.toast?.(precision.error);return;}
    if (!( /^ASME/.test(standard) && Object.keys(precision.rules||{}).length && !lower && !upper) && (standard === "CUSTOM" || /^ASME Y14\.5-/.test(standard)) && (!finiteNumber(lower) || !finiteNumber(upper) || Number(lower) > Number(upper))) { bridge.toast?.("Özel tolerans için geçerli alt ve üst sapma girin."); return; }
    bridge.checkpoint();
    const metadata = clone(state().metadata || {});
    $$("[data-metadata-field]").forEach(element => { metadata[element.dataset.metadataField] = element.value.trim(); });
    metadata.projectDefaults = { ...(metadata.projectDefaults || {}), toleranceStandard: standard };
    state().metadata = metadata;
    state().generalTolerance = { ...(state().generalTolerance || {}), standard, precisionRules:/^ASME/.test(standard)?precision.rules:{}, lower: (standard === "CUSTOM" || /^ASME Y14\.5-/.test(standard)) ? lower : "", upper: (standard === "CUSTOM" || /^ASME Y14\.5-/.test(standard)) ? upper : "", unit: state().generalTolerance?.unit || "mm" };
    recordChange("Çizim bilgileri ve genel tolerans güncellendi");
    closeDialog($("#acuiMetadata"));
    bridge.renderAll();
    bridge.toast?.("Çizim bilgileri kaydedildi.");
  }

  function openAudit() {
    const items = [...(state().auditLog || [])].reverse();
    $("#acuiAuditBody").innerHTML = items.length ? items.map(item => `<tr><td>${escape(dateLabel(item.at || item.timestamp || item.createdAt))}</td><td>${escape(item.action || item.type || "Güncelleme")}</td><td>${escape(item.number ? `#${item.number}` : item.annotationId || "Proje")}</td><td>${escape(typeof item.detail === "object" ? JSON.stringify(item.detail) : item.detail || item.description || item.message || "—")}</td></tr>`).join("") : `<tr><td colspan="4" class="acui-empty">Henüz işlem kaydı yok.</td></tr>`;
    showDialog($("#acuiAudit"));
  }

  function selectionIds(){if(!bridge)return [];if(bulkRecords!==state().annotations){bulkSelection.clear();bulkRecords=state().annotations;}return [...bulkSelection].filter(id=>state().annotations.some(r=>r.id===id));}
  function selectIds(ids,mode='replace'){
    if(!bridge)return [];
    bulkRecords=state().annotations;if(mode==='replace')bulkSelection.clear();
    for(const id of ids)if(bulkRecords.some(r=>r.id===id)){if(mode==='toggle'&&bulkSelection.has(id))bulkSelection.delete(id);else bulkSelection.add(id);}
    return selectionIds();
  }
  const cellStyle=document.createElement('style');cellStyle.textContent='.acui-cell-dialog{position:fixed;inset:0;margin:auto;width:340px;max-width:90vw;padding:14px;border:1px solid #b6c9d5;border-radius:6px;color:#24495d;background:white;font:12px Segoe UI}.acui-cell-dialog::backdrop{background:#15344525}.acui-cell-dialog strong{display:block;margin-bottom:12px}.acui-cell-dialog input,.acui-cell-dialog select{width:100%;height:34px;box-sizing:border-box;padding:5px;border:1px solid #b6c9d5;border-radius:4px}.acui-cell-dialog footer{display:flex;justify-content:flex-end;gap:7px;margin-top:12px}.acui-cell-dialog button{padding:6px 14px;border:1px solid #b6c9d5;border-radius:4px;background:#f4f8fa;color:#245069}.acui-table tbody tr[data-id]{cursor:default}.acui-table tbody tr[data-id]:hover{background:#eaf4f8}.acui-table tbody tr.is-selected{box-shadow:inset 3px 0 #008d9e}.acui-table td{font-variant-numeric:tabular-nums}';document.head.append(cellStyle);
  const inlineStyle=document.createElement('style');inlineStyle.textContent='.acui-table td:has(>.acui-cell-inline){overflow:visible!important;position:relative;z-index:5}.acui-cell-dialog.acui-cell-inline{position:absolute;inset:0 auto auto 0;margin:0;width:max(100%,220px);max-width:70vw;padding:2px;box-sizing:border-box;background:white;border:1px solid #008b9c;border-radius:3px;box-shadow:0 2px 7px #173c5022;z-index:10}.acui-cell-inline form{display:flex;align-items:center;gap:3px}.acui-cell-inline [data-control]{flex:1;min-width:0}.acui-cell-inline input,.acui-cell-inline select{height:28px;border:0}.acui-cell-inline footer{margin:0;gap:2px;flex-shrink:0}.acui-cell-inline button{padding:2px;width:24px;height:26px;min-height:0}.acui-cell-inline strong[hidden]{display:none}';document.head.append(inlineStyle);
  window.ASMachCharacteristicUI = { init, render, openEditor, openMetadata, openAudit, selectionIds, selectIds, get ready() { return initialized; } };
})();
