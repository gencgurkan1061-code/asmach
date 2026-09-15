const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage();await p.goto(require('url').pathToFileURL(require('path').resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=800;await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'test.png',type:'image/png',dataUrl:c.toDataURL()},annotations:[]});ASMachRibbon.open('drawing');document.getElementById('boxOcrModeButton').click();});
 for(const width of [1920,1600,1366,1280,1024,800]){
  await p.setViewportSize({width,height:800});await p.waitForTimeout(100);
  const layout=await p.evaluate(()=>{const panel=document.getElementById('rbPanel-drawing'),groups=[...panel.querySelectorAll('.rb-group')].filter(e=>e.getBoundingClientRect().width);return{tops:groups.map(e=>Math.round(e.getBoundingClientRect().top)),height:panel.offsetHeight,wrap:getComputedStyle(panel).flexWrap,tabWrap:getComputedStyle(document.querySelector('.rb-tabs')).flexWrap};});
  assert.equal(layout.wrap,'wrap');assert.equal(layout.tabWrap,'nowrap');
  const overflow=await p.locator('#rbPanel-drawing').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false,'Horizontal overflow at '+width);
  const defaults=await p.locator('.rd-defaults').boundingBox();assert.ok(defaults,'Defaults must be present');
  const tools=await p.locator('#rbPanel-drawing .rb-group:not(.rd-defaults)').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width).map(e=>e.getBoundingClientRect().bottom));assert.ok(defaults.y>=Math.max(...tools),'Defaults below commands at '+width);
  await p.locator('#viewNumberingButton').scrollIntoViewIfNeeded();const box=await p.locator('#viewNumberingButton').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
  console.log('PASS',width,layout.height);
 }
 await p.screenshot({path:'outputs/ribbon-responsive.png'});
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
