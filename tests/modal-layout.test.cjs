'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/modal-layout.js','utf8'),html=fs.readFileSync('src/app.template.html','utf8');
test('All modal families share viewport limits, scrolling bodies, nonshrinking actions and layers above the toolbar',()=>{
  const context={window:{}};vm.runInNewContext(source,context);const css=context.window.ASMachModalLayout.css;
  for(const selector of ['.modal-card','.wf-card','dialog.asmach-modal','.modal-body','.wf-body','.acui-content','.modal-actions','.wf-foot','.acui-foot','#bulkPlanForm','#candidatePreviewImage'])assert.ok(css.includes(selector),selector);
  assert.match(css,/100dvh - 24px/);assert.match(css,/flex-shrink:0!important/);assert.match(css,/min-height:0!important/);assert.match(css,/overflow:auto/);
  const layer=Number(css.match(/\.modal\{z-index:(\d+)/)[1]),confirm=Number(css.match(/#confirmModal\{z-index:(\d+)/)[1]);assert.ok(layer>3100,'Dialogs must sit above ribbon and toolbar menus');assert.ok(confirm>layer,'Confirmation must sit above editor');
  assert.match(html,/ASMachModalLayout\?\.mount\(\)/);assert.match(fs.readFileSync('scripts/build-single.cjs','utf8'),/modules.push\('modal-layout'\)/);assert.match(fs.readFileSync('src/bulk-plan.js','utf8'),/asmach-modal bulk-plan-dialog/);
});
test('Modal layout mount is idempotent and does not modify dialog contents or event handlers',()=>{
  let added=0,style;const c={window:{},document:{getElementById:()=>style,createElement:()=>({}),head:{append:node=>{style=node;added++;}}}};
  vm.runInNewContext(source,c);c.window.ASMachModalLayout.mount();c.window.ASMachModalLayout.mount();assert.equal(added,1);assert.equal(style.id,'asmach-modal-layout-style');
});
