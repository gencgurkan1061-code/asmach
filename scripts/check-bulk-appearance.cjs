const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1300,height:950}});await page.route(/^https?:/,r=>r.abort());await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 const result=await page.evaluate(()=>{
  const app=ASMachApp;app.elements.sourceCanvas.width=1200;app.elements.sourceCanvas.height=1000;
  app.state.annotations=[0,1,2].map(i=>app.normalizeAnnotation({id:'bulk-'+i,number:String(i+1),page:1,selectionBox:{x:.3,y:.2+i*.25,w:.12,h:.04},bubbleX:.2,bubbleY:.22+i*.25}));app.state.currentPage=1;app.state.selectedId='bulk-0';app.renderAll();ASMachCharacteristicUI.selectIds(['bulk-0','bulk-1']);document.querySelector('#rbPanel-format [data-mode=style]').onclick();
  const untouched=JSON.stringify(app.state.annotations[2]),errors=[];
  const values={size:54,fontSize:18,opacity:65,color:'#123456',shape:'hexagon',balloonFill:'#ffeecc',balloonOpacity:75,balloonLineWidth:3.2,balloonLineStyle:'dotted',fontWeight:'400',textColor:'#554433',textOpacity:55,boxPadding:7,boxColor:'#654321',boxFill:'#dddddd',boxFillOpacity:25,boxOpacity:85,boxLineWidth:2.6,boxLineStyle:'dashed',arrowEnabled:'false',arrowStyle:'diamond',arrowSize:15,leaderColor:'#334455',leaderOpacity:45,leaderLineWidth:4.2,leaderLineStyle:'dotted',boxDirection:'right',boxGap:24};
  for(const [key,value]of Object.entries(values)){
   const field=document.querySelector('[data-style-field="'+key+'"]');if(!field){errors.push(key+': missing');continue;}field.value=String(value);field.dispatchEvent(new Event('change',{bubbles:true}));
   const expected=key==='arrowEnabled'?value==='true':field.type==='number'?Number(value)/(key==='opacity'||key.endsWith('Opacity')?100:1):key==='fontWeight'?Number(value):value;
   for(const record of app.state.annotations.slice(0,2)){
    const effective=ASMachRoleAppearance.effective(app.state,record),restored=ASMachRoleAppearance.effective(app.state,app.normalizeAnnotation(record));
    if(effective[key]!==expected||restored[key]!==expected)errors.push(key+': '+effective[key]+' / restored '+restored[key]+' expected '+expected+'; '+document.querySelector('#formatToolWindow .fr-status').textContent);
   }
  }
  const snapshots=JSON.stringify(app.state.annotations);const failed=ASMachFormatRibbon.apply({boxGap:500},app.state.annotations.slice(0,2));
  return {errors,untouched:untouched===JSON.stringify(app.state.annotations[2]),fixed:app.state.annotations.slice(0,2).every(r=>r.balloonStyleMode==='fixed'&&!r.balloonStyleMethod),fields:Object.keys(values).length,atomic:!failed.error||snapshots===JSON.stringify(app.state.annotations),padding:app.state.annotations[0].selectionBox.w>.12};
 });assert.deepEqual(result.errors,[]);assert.ok(result.untouched);assert.ok(result.fixed);assert.ok(result.atomic);assert.ok(result.padding);console.log('PASS',result);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
