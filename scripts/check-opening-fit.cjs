const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const viewport of [{width:1450,height:950},{width:1900,height:1080},{width:1024,height:768}]){
   const page=await browser.newPage({viewport});
   await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
   for(const size of [[2200,1550],[1550,2200]]){
    await page.evaluate(async([width,height])=>{
     ASMachMessages.confirm=async()=>true;
     const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
     await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'fit.png',type:'image/png',dataUrl:canvas.toDataURL()},annotations:[]});
    },size);
    await page.waitForTimeout(600);
    const before=await page.evaluate(()=>({zoom:ASMachApp.state.zoom,expected:Math.min((ASMachApp.elements.viewer.clientWidth-2)/ASMachApp.elements.sourceCanvas.width,(ASMachApp.elements.viewer.clientHeight-2)/ASMachApp.elements.sourceCanvas.height,4)}));
    assert.ok(Math.abs(before.zoom-before.expected)<=0.011,JSON.stringify({viewport,size,before}));
    await page.locator('#fitButton').click();
    assert.equal(await page.evaluate(()=>ASMachApp.state.zoom),before.zoom,'Initial fit must match fit button');
    await page.evaluate(()=>ASMachApp.setZoom(0.8));
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>ASMachApp.state.zoom),0.8,'Manual zoom must remain available');
   }
   await page.close();
  }
  console.log('PASS initial/reopened drawing fits at three viewport sizes; manual zoom preserved');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
