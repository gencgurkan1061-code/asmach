'use strict';
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);await page.waitForFunction(()=>window.ASMachCharacteristicUI?.ready);
 await page.evaluate(()=>{const a=ASMachApp;a.state.fileData='fixture';a.state.fileName='Selection.png';a.state.pageCount=2;a.state.currentPage=1;a.state.mode='select';a.state.legend.enabled=false;const c=a.elements.sourceCanvas;c.width=800;c.height=500;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,800,500);a.elements.overlay.setAttribute('viewBox','0 0 800 500');a.elements.stage.style.width='800px';a.elements.stage.style.height='500px';a.state.annotations=[[.2,.2,1],[.35,.35,1],[.7,.3,1],[.2,.2,2]].map(([x,y,p],i)=>a.normalizeAnnotation({id:'s'+i,number:i+1,page:p,bubbleX:x,bubbleY:y,anchorX:x-.03,anchorY:y+.03,inspectionMethod:a.getMethods()[0].value}));a.renderAll();window.selectionBefore=JSON.stringify(a.state.annotations);});
 await page.evaluate(()=>{document.querySelector('#stageWrap').classList.add('is-visible');document.querySelector('#emptyState').style.display='none';});
 const overlay=page.locator('#overlay');let r=await overlay.boundingBox();
 const ids=()=>page.evaluate(()=>ASMachCharacteristicUI.selectionIds());
 async function drag(x1,y1,x2,y2){r=await overlay.boundingBox();await page.mouse.move(r.x+x1*r.width,r.y+y1*r.height);await page.mouse.down();await page.mouse.move(r.x+x2*r.width,r.y+y2*r.height,{steps:8});assert.ok(await page.evaluate(()=>!!ASMachApp.state.bulkDrag));await page.mouse.up();}
 await drag(.05,.05,.45,.45);assert.deepEqual(await ids(),['s0','s1']);assert.equal(await overlay.locator('.selected-ring').count(),2);
 await page.keyboard.down('Shift');await drag(.85,.45,.6,.15);await page.keyboard.up('Shift');assert.deepEqual(await ids(),['s0','s1','s2']);
 await page.mouse.click(r.x+r.width*.9,r.y+r.height*.85);assert.deepEqual(await ids(),[]);
 // Start in the padded area outside the paper and finish over the paper.
 await drag(-.02,.05,.45,.45);assert.deepEqual(await ids(),['s0','s1']);
 await page.mouse.move(r.x+r.width*.05,r.y+r.height*.05);await page.mouse.down();await page.mouse.move(r.x+r.width*.9,r.y+r.height*.9);await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await ids(),['s0','s1']);
 assert.equal(await page.evaluate(()=>JSON.stringify(ASMachApp.state.annotations)),await page.evaluate(()=>selectionBefore));
 await page.mouse.click(r.x+r.width*.2,r.y+r.height*.2,{button:'right'});assert.ok(await page.getByText('Seçilen balonları düzenle',{exact:false}).count()||await page.locator('dialog[open]').count());await page.keyboard.press('Escape');
 fs.mkdirSync('outputs/selection-qa',{recursive:true});await page.screenshot({path:'outputs/selection-qa/box-selection.png'});assert.deepEqual(errors,[]);console.log('Real mouse: box, reverse/additive box, page-margin start, cancel, highlight and bulk right-click passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
