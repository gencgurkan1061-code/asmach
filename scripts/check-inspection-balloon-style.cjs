const { chromium } = require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:920}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
  const initial=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=900;canvas.height=650;
   await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'stil.png',type:'image/png',dataUrl:canvas.toDataURL()},annotations:[]});
   const methods=ASMachApp.getMethods().slice(0,3);ASMachApp.state.methodStyles[methods[0].value].color='#1166aa';ASMachApp.state.methodStyles[methods[1].value].color='#aa2233';ASMachApp.state.methodStyles[methods[2].value].color='#228844';
   const blank=ASMachRolePlans.blank(),record=ASMachApp.normalizeAnnotation({id:'style-1',number:'12',page:1,type:'Çap',inspectionMethod:methods[0].value,commonPlanEnabled:false,rolePlans:{operator:{...blank,enabled:true,inspectionMethod:methods[0].value},quality:{...blank,enabled:true,inspectionMethod:methods[1].value,inspectionFrequency:'PER_LOT'}}});
   ASMachApp.state.annotations=[record];ASMachApp.state.selectedId=record.id;ASMachApp.renderAll();
   const source=ASMachRoleAppearance.source(ASMachApp.state,record),shown=ASMachRoleAppearance.effective(ASMachApp.state,record);
   const common=ASMachRoleAppearance.source(ASMachApp.state,{...record,commonPlanEnabled:true,inspectionMethod:methods[0].value});
   const operator=ASMachRoleAppearance.source(ASMachApp.state,{...record,rolePlans:{operator:{...blank,enabled:true,inspectionMethod:methods[0].value},quality:{...blank,enabled:false}}});
   return{methods,source,common,operator,color:shown.color,mode:record.balloonStyleMode};
  });
  assert.equal(initial.common.role,'common');assert.equal(initial.source.role,'quality');assert.equal(initial.operator.role,'operator');assert.equal(initial.color,'#aa2233');assert.equal(initial.mode,'auto');
  await page.getByRole('tab',{name:'Denetleme',exact:true}).click();
  await page.locator('#ctBalloonAppearance').waitFor();
  assert.match(await page.locator('.ct-appearance-head span').textContent(),/Kalite/);
  assert.equal(await page.locator('[data-balloon-mode]').inputValue(),'auto');
  assert.deepEqual(await page.locator('[data-balloon-mode] option').allTextContents(),['Sabit stil','Operatör stilini al','Kalite stilini al','Kontrol planına göre otomatik']);
  await page.locator('[data-balloon-mode]').selectOption('quality');
  const linked=await page.evaluate(()=>{const r=ASMachApp.selectedAnnotation();r.rolePlans.quality.inspectionMethod=ASMachApp.getMethods()[2].value;ASMachApp.renderAll();return{source:ASMachRoleAppearance.source(ASMachApp.state,r),color:ASMachRoleAppearance.effective(ASMachApp.state,r).color};});
  assert.equal(linked.source.mode,'quality');assert.equal(linked.source.method,initial.methods[2].value);assert.equal(linked.color,'#228844');
  await page.locator('[data-balloon-mode]').selectOption('fixed');
  const fixed=await page.evaluate(()=>{const r=ASMachApp.selectedAnnotation(),before=ASMachRoleAppearance.source(ASMachApp.state,r);r.rolePlans.quality.inspectionMethod=ASMachApp.getMethods()[0].value;ASMachApp.renderAll();return{before,after:ASMachRoleAppearance.source(ASMachApp.state,r),color:ASMachRoleAppearance.effective(ASMachApp.state,r).color,round:ASMachApp.normalizeAnnotation(JSON.parse(JSON.stringify(r)))};});
  assert.equal(fixed.before.mode,'fixed');assert.equal(fixed.after.method,initial.methods[2].value);assert.equal(fixed.color,'#228844');assert.equal(fixed.round.balloonStyleMode,'fixed');assert.equal(fixed.round.balloonStyleMethod,initial.methods[2].value);
  await page.locator('[data-balloon-mode]').selectOption('auto');
  const automatic=await page.evaluate(()=>{const r=ASMachApp.selectedAnnotation();return{source:ASMachRoleAppearance.source(ASMachApp.state,r),color:ASMachRoleAppearance.effective(ASMachApp.state,r).color};});
  assert.equal(automatic.source.role,'quality');assert.equal(automatic.source.method,initial.methods[0].value);assert.equal(automatic.color,'#1166aa');
  const defaults=await page.evaluate(()=>{const methods=ASMachApp.getMethods(),blank=ASMachRolePlans.blank(),value={'Çap':{operator:blank,quality:blank,common:{inspectionMethod:methods[0].value,balloonStyleMethod:methods[1].value,inspectionFrequency:'',frequencyInterval:'',frequencyNote:''}}};ASMachPreferences.setItem('asmach.type-inspection-defaults.v1',JSON.stringify(value));const fresh=ASMachApp.normalizeAnnotation({id:'new-style',type:'Çap'});ASMachTypeInspectionDefaults.apply(fresh);const panel=ASMachTypeInspectionDefaults.panel(ASMachApp);return{mode:fresh.balloonStyleMode,method:fresh.balloonStyleMethod,control:!!panel.querySelector('[data-common="balloonStyleMethod"]')};});
  assert.equal(defaults.mode,'fixed');assert.equal(defaults.method,initial.methods[1].value);assert.equal(defaults.control,true);
  await page.evaluate(()=>{const r=ASMachApp.selectedAnnotation();r.commonPlanEnabled=true;r.inspectionMethod=ASMachApp.getMethods()[1].value;ASMachApp.renderAll();});
  assert.deepEqual(await page.locator('[data-balloon-mode] option').allTextContents(),['Sabit stil','Ortak stilini al','Kontrol planına göre otomatik']);
  await page.locator('[data-balloon-mode]').selectOption('common');
  assert.equal((await page.evaluate(()=>ASMachRoleAppearance.source(ASMachApp.state,ASMachApp.selectedAnnotation()))).role,'common');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'outputs/inspection-balloon-style.png'});
  console.log('PASS single balloon auto priority, fixed style preservation, roundtrip and compact inspection preview.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
