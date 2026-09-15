const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const context={window:{},Intl};vm.runInNewContext(fs.readFileSync('src/number-order.js','utf8'),context);
const compare=context.window.ASMachNumberOrder.compare;
const input=['4.5','2','1.10','3','1.2','4.1','1.1','10','1','1.1.1'];
const expected=['1','1.1','1.1.1','1.2','1.10','2','3','4.1','4.5','10'];
assert.deepEqual([...input].sort(compare),expected);
assert.deepEqual([...input].sort((a,b)=>-compare(a,b)),[...expected].reverse());
assert.ok(compare('9007199254740992.1','9007199254740993.1')<0);
assert.equal(compare('01.02','1.2'),0);assert.ok(compare('', '1')>0);
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();await page.route(/^https?:/,r=>r.abort());
 await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 const result=await page.evaluate(({input})=>{
  const app=ASMachApp;
  app.state.annotations=input.map((number,i)=>app.normalizeAnnotation({id:'order-'+i,number,page:i%3+1,type:'Uzunluk',nominalValue:'5',requirement:'5',bubbleX:.5,bubbleY:.5}));
  const original=JSON.stringify(app.state.annotations.map(r=>[r.id,r.number]));
  app.state.selectedId=null;app.renderAll();
  const grouping=document.querySelector('#lcGrouping');grouping.value='';grouping.dispatchEvent(new Event('change',{bubbles:true}));
  const values=()=>[...document.querySelectorAll('#balloonTableBody tr[data-id]')].map(r=>app.state.annotations.find(a=>a.id===r.dataset.id).number);
  const initial=values();
  function sort(label){document.querySelector('th[data-column="number"] .ta-filter').click();[...document.querySelectorAll('#lcHeaderMenu button')].find(b=>b.textContent.includes(label)).click();return values();}
  const desc=sort('Azalan sırala'),asc=sort('Artan sırala');
  const custom=ASMachExcelCellTemplate.recordsFor('record.requirement',app.state).map(r=>r.number);
  const report=ASMachProduction.reportRecords(app.state,{mode:'fai'}).map(r=>r.number);
  return{initial,desc,asc,custom,report,unchanged:original===JSON.stringify(app.state.annotations.map(r=>[r.id,r.number]))};
 },{input});
 for(const key of ['initial','asc','custom','report'])assert.deepEqual(result[key],expected,key);
 assert.deepEqual(result.desc,[...expected].reverse());assert.ok(result.unchanged);
 console.log('PASS hierarchical labels, cross-page default order, ascending/descending table sort, custom Excel and report order; identifiers unchanged');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
