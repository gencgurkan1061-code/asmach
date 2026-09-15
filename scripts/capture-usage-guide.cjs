'use strict';
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');

(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs','usage-guide');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,route=>route.abort());
  await page.goto(pathToFileURL(path.join(root,'ASMach_Teknik_Resim_Balonlama.html')).href);await page.waitForFunction(()=>window.ASMachApp&&window.ASMachRibbon&&window.ASMachAbout);
  const shot=async key=>{await page.waitForTimeout(180);await page.screenshot({path:path.join(out,key+'.png')});};
  await shot('start');
  await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=1200;c.height=760;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.strokeStyle='#283943';g.fillStyle='#283943';g.lineWidth=2;
   g.strokeRect(35,25,1130,700);g.strokeRect(870,585,270,115);g.beginPath();g.arc(310,315,145,0,Math.PI*2);g.arc(310,315,92,0,Math.PI*2);g.stroke();g.strokeRect(625,175,180,285);g.beginPath();g.moveTo(585,175);g.lineTo(845,175);g.moveTo(585,460);g.lineTo(845,460);g.moveTo(610,130);g.lineTo(610,500);g.moveTo(820,130);g.lineTo(820,500);g.stroke();
   g.font='18px Segoe UI';g.fillText('ÖN GÖRÜNÜŞ',245,495);g.fillText('A-A KESİTİ',670,520);g.font='20px Segoe UI';g.fillText('Ø 59.9  0 / -0.10',170,120);g.fillText('46.90 ±0.05',575,110);g.fillText('⌾ | 0.10 | A',600,565);g.font='14px Segoe UI';g.fillText('ÖRNEK TEKNİK RESİM — KULLANIM KILAVUZU',885,615);g.fillText('PARÇA NO: DEMO-001',885,642);g.fillText('REVİZYON: A',885,667);
   const a=ASMachApp,method=a.getMethods()[0].value,common={page:1,unit:'mm',inspectionMethod:method,inspectionFrequency:'PER_LOT'};
   if(window.ASMachFileActions)window.ASMachFileActions.confirmLeave=async()=>true;
   await a.restoreProject({format:'asmach-ballooning-project',source:{name:'DEMO-001.png',type:'image/png',dataUrl:c.toDataURL()},metadata:{partNo:'DEMO-001',drawingNo:'TR-001',revision:'A',customer:'Örnek müşteri',viewNumbering:{views:[{id:'front',name:'Ön görünüş',page:1,box:{x:.12,y:.17,w:.31,h:.53},order:'rows',enabled:true},{id:'section',name:'A-A kesiti',page:1,box:{x:.48,y:.13,w:.28,h:.58},order:'columns',enabled:true}]}},annotations:[
    {id:'a1',number:'1',type:'Çap',requirement:'Ø59.9 (0/-0.1)',nominalValue:'59.9',lowerTolerance:'-0.1',upperTolerance:'0',selectionBox:{x:.14,y:.12,w:.16,h:.04},bubbleX:.11,bubbleY:.14,...common},
    {id:'a2',number:'2',type:'Uzunluk',requirement:'46.90 ±0.05',nominalValue:'46.90',lowerTolerance:'-0.05',upperTolerance:'0.05',selectionBox:{x:.47,y:.11,w:.13,h:.04},bubbleX:.43,bubbleY:.13,...common},
    {id:'a3',number:'3',type:'GD&T',gdtSubtype:'position',requirement:'⌾ | 0.10 | A',upperTolerance:'0.10',datumRefs:'A',selectionBox:{x:.49,y:.72,w:.13,h:.04},bubbleX:.45,bubbleY:.74,...common}
   ]});a.state.selectedId='a2';a.renderAll();ASMachRibbon.open('format');
  });
  await shot('workspace');
  await page.evaluate(()=>{ASMachWorkspaceTabs?.activate('drawing');ASMachRibbon.open('recognition');document.getElementById('boxOcrModeButton')?.click();});await shot('extract');
  await page.evaluate(()=>{ASMachWorkspaceTabs?.activate('drawing');ASMachRibbon.open('format');ASMachApp.state.selectedId='a2';ASMachApp.renderAll();});await shot('review');
  await page.evaluate(()=>{ASMachRibbon.open('recognition');document.getElementById('autoDetectButton')?.click();});await page.waitForTimeout(250);await shot('automatic');
  await page.evaluate(()=>ASMachViewNumbering.open());await page.locator('.view-numbering-dialog').waitFor({state:'visible'});await shot('numbering');await page.keyboard.press('Escape');
  await page.evaluate(()=>ASMachApp.openBalloonSettings());await page.locator('#balloonSettingsModal').waitFor({state:'visible'});await shot('styles');
  await page.evaluate(()=>ASMachProduction.open('project'));await page.locator('#productionWorkspace').waitFor({state:'visible'});await shot('project');await page.keyboard.press('Escape');
  await page.evaluate(()=>ASMachReportCenter.open('excel'));await page.locator('#reportCenter').waitFor({state:'visible'});await shot('outputs');await page.locator('#reportCenter [data-close]').click();
  await page.evaluate(()=>ASMachApp.openDrawingPrint());await page.locator('.print-window').waitFor({state:'visible'});await page.waitForTimeout(500);await shot('print');await page.locator('.print-window [data-close]').click();
  await page.evaluate(()=>ASMachRibbon.open('view'));await page.locator('#desktopSettings').waitFor({state:'visible'});await shot('settings');
  await page.evaluate(()=>{ASMachRibbon.select('view');document.getElementById('ribbonAboutButton')?.click();});await page.locator('#aboutWorkspace').waitFor({state:'visible'});await shot('about');
  if(errors.length)throw new Error('Sayfa hataları: '+errors.join(' | '));console.log('Kılavuz için 11 güncel uygulama ekranı oluşturuldu.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
