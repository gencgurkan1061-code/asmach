const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route(/^https?:/,r=>r.abort());await p.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 for(const width of [1920,1440,900]){
  await p.setViewportSize({width,height:900});await p.locator('#balloonSettingsButton').click();
  const metrics=await p.evaluate(()=>{const t=document.querySelector('.toolbar'),m=t.querySelector('.wl-main'),c=document.querySelector('#balloonSettingsModal .settings-card');return{bottom:t.getBoundingClientRect().bottom,top:c.getBoundingClientRect().top,end:c.getBoundingClientRect().bottom,overflow:m.scrollWidth-m.clientWidth,body:document.body.scrollWidth-innerWidth,close:document.querySelector('#settingsCancelButton').getBoundingClientRect().top};});
  assert.ok(Math.abs(metrics.top-metrics.bottom)<=1,JSON.stringify(metrics));assert.ok(metrics.end<=901);assert.ok(metrics.overflow<=1,JSON.stringify(metrics));assert.ok(metrics.body<=1);assert.ok(metrics.close>=metrics.bottom);
  await p.locator('#settingsCancelButton').click();await p.evaluate(()=>ASMachReportCenter.open());
  const pos=await p.locator('#reportCenter').boundingBox();assert.ok(Math.abs(pos.y-metrics.bottom)<=1);await p.locator('#reportCenter [data-close]').click();
 }
 assert.deepEqual(errors,[]);console.log('PASS: fixed shell, no toolbar horizontal scrolling, contained pages and close controls at 1920 / 1440 / 900px.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
