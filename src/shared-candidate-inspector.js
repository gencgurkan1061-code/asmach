(function(root){
 'use strict';let form,home,ctx,current,observer,busy=false,drawingSelection=null;const drafts=new WeakMap(),baselines=new WeakMap();const signature=r=>JSON.stringify(['type','nominalValue','lowerTolerance','upperTolerance','unit','classification','requirement','ocrText','snapshot','selectionBox'].map(k=>r[k]));
 function park(){if(form&&home?.parentNode)home.after(form);const draft=ctx?.app.state.controlledDraft;if(draft?.candidateOwner&&current){const r=draft.record;if(baselines.has(current)&&baselines.get(current)!==signature(r))current.reviewStatus='corrected';baselines.set(current,signature(r));drafts.set(current,r);current.reviewed=JSON.parse(JSON.stringify(r));current.parsed={...current.reviewed};current.text=r.ocrText||r.requirement;current.box=r.selectionBox;current.snapshot=r.snapshot;current.sourceTextHeight=r.sourceTextHeight;current.plan={...current.plan,inspectionMethod:r.inspectionMethod,inspectionFrequency:r.inspectionFrequency,frequencyInterval:r.frequencyInterval,frequencyNote:r.frequencyNote,rolePlans:r.rolePlans};}}
 function release(){park();const app=ctx?.app,draft=app?.state.controlledDraft;current=null;if(draft?.candidateOwner){app.state.controlledDraft=null;if(app.state.selectedId===draft.record.id)app.state.selectedId=app.state.annotations.some(r=>r.id===drawingSelection)?drawingSelection:null;app.renderAll();}else if(app&&form?.parentNode===home?.parentNode)app.renderAll();}
 // A committed source correction replaces the cached inspector, not vice versa.
 function invalidate(c){drafts.delete(c);baselines.delete(c);if(current===c&&ctx?.app.state.controlledDraft?.candidateOwner){ctx.app.state.controlledDraft=null;current=null;}}
 function mount(editor,c,data){ctx=data;const app=data.app;if(!form){form=document.getElementById('selectionForm');home=document.createComment('Inspector home');form.before(home);const css=document.createElement('style');css.textContent='.wf-candidate-editor:has(#selectionForm){display:flex!important;flex-direction:column;padding:0!important;overflow:hidden!important;min-height:0}.wf-candidate-editor #selectionForm{display:flex!important;flex-direction:column;flex:1;min-height:0;height:100%}.wf-candidate-editor #selectionForm .ip-scroll{flex:1;min-height:0;overflow:auto}.wf-candidate-editor #selectionForm .ip-footer{flex-shrink:0}.wf-candidate-editor #selectionForm .ip-identity{flex-shrink:0}';document.head.append(css);}
  if(!current&&app.state.annotations.some(r=>r.id===app.state.selectedId))drawingSelection=app.state.selectedId;
  observer?.disconnect();const visible=()=>data.panel.classList.contains('open')&&!data.panel.classList.contains('wt-inactive')&&!data.panel.inert;let wasVisible=visible();observer=new MutationObserver(()=>{const shown=visible();if(shown===wasVisible)return;wasVisible=shown;if(busy)return;if(!shown)release();else data.refresh();});observer.observe(data.panel,{attributes:true,attributeFilter:['class','inert']});
  if(app.state.controlledDraft?.candidateOwner&&current)drafts.set(current,app.state.controlledDraft.record);
  current=c;if(c)c.originalText??=c.text;editor.replaceChildren();if(!c){release();editor.textContent='Düzenlemek için bir aday seçin.';return;}
  if(app.state.controlledDraft&&!app.state.controlledDraft.candidateOwner){editor.textContent='Önce kutu OCR seçimini sağ panelde kaydedin veya iptal edin.';return;}
  editor.append(form);
  if(c.addedId){app.state.controlledDraft=null;app.state.selectedId=c.addedId;}
  else{const prior=drafts.get(c),source=c.reviewed||c.parsed,b=c.box||{x:.4,y:.4,w:.1,h:.1},method=c.plan?.inspectionMethod||app.getMethods()[0]?.value,style=app.state.annotations.find(a=>a.inspectionMethod===method)||{};
   const r=prior||app.normalizeAnnotation({...source,...c.plan,id:crypto.randomUUID(),number:c.plannedNumber||root.ASMachBalloonNumbering.next(app.state.annotations),page:c.page,selectionBox:b,sourceTextHeight:c.sourceTextHeight,snapshot:c.snapshot||'',ocrText:c.text||'',inspectionMethod:method,color:style.color||'#087f91',shape:style.shape||'circle',anchorX:b.x+b.w/2,anchorY:b.y+b.h/2,bubbleX:Math.min(.95,b.x+b.w+.055),bubbleY:Math.max(.04,b.y-.04),autoDetected:true,detectionViewId:c.scanRegion?.id||''});
   if(!prior&&!c.reviewed){root.ASMachBalloonPlacement.applyNewDefaults(r);root.ASMachBalloonPlacement.autoStyle(r,c.pageImage?.width||app.elements.sourceCanvas.width,c.pageImage?.height||app.elements.sourceCanvas.height);root.ASMachAutomaticGeometry.place(r,c.pageImage?.width||app.elements.sourceCanvas.width,c.pageImage?.height||app.elements.sourceCanvas.height,app.state.annotations,c.ink);}
   baselines.set(c,signature(r));app.state.controlledDraft={source:app.state.fileData,record:r,candidateOwner:true,onAccepted:record=>{drafts.delete(c);data.onDraftSaved?.(c,record);},onDiscard:()=>{drafts.delete(c);}};app.state.selectedId=r.id;
  }
  busy=true;app.renderAll();busy=false;
 }
 function syncSource(){
  if(busy||!current||!ctx?.panel.classList.contains('open'))return;
  const draft=ctx.app.state.controlledDraft,r=current.addedId?ctx.app.state.annotations.find(a=>a.id===current.addedId):draft?.candidateOwner?draft.record:null;
  if(!r||current.snapshot===r.snapshot&&JSON.stringify(current.box)===JSON.stringify(r.selectionBox))return;
  current.snapshot=r.snapshot;current.sourceTextHeight=r.sourceTextHeight;current.box=r.selectionBox;current.text=r.ocrText||r.requirement;current.reviewed=JSON.parse(JSON.stringify(r));current.parsed={...current.reviewed};
  const context=ctx;queueMicrotask(()=>{if(ctx===context&&context.panel.classList.contains('open'))context.refresh();});
 }
 root.ASMachSharedCandidateInspector={mount,park,release,invalidate,syncSource,recordFor(c){if(c!==current)return null;return c.addedId?ctx.app.state.annotations.find(r=>r.id===c.addedId):ctx.app.state.controlledDraft?.candidateOwner?ctx.app.state.controlledDraft.record:null;}};
})(window);
