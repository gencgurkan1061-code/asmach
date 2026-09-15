const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 const result=await page.evaluate(async()=>{
  const api=ASMachExcelCellTemplate,empty={metadata:{production:{}},annotations:[]},state={metadata:{partNo:'TEST-PART',production:{evidence:[{result:0},{result:15}]}},annotations:[{number:1,resultValue:0},{number:2,resultValue:15}]},passed=[];
  for(const preset of api.presets().filter(p=>p.format!=='fai837')){
   const blob=api.blob(preset,empty);blob.name=preset.name+'.xltx';const parsed=await ASMachExcelTemplateImport.read(blob);
   const output=ASMachExcelTemplateImport.files(parsed,state,false),blank=ASMachExcelTemplateImport.files(parsed,empty,false);
   for(const parts of [output,blank])for(const [name,value]of Object.entries(parts))if(/^xl\/worksheets\/.*xml$/.test(name)&&typeof value==='string'){
    if(value.includes('{{'))throw Error('Unresolved field: '+preset.name);
    if(new DOMParser().parseFromString(value,'application/xml').querySelector('parsererror'))throw Error('Invalid XML: '+preset.name);
   }
   passed.push(preset.name);
  }
  const shared={commonPlanEnabled:true,inspectionMethod:'COMMON',commonSampling:{sampleCount:'7'},rolePlans:{operator:{enabled:false,inspectionMethod:'PRIVATE'},quality:{enabled:false}}};
  const column={name:'Columns',direction:'columns',repeat:0,cells:{'0:0':{field:'record.result'}}};
  const blob=api.blob(column,empty);blob.name='columns.xltx';const t=await ASMachExcelTemplateImport.read(blob);t.direction='columns';const parts=ASMachExcelTemplateImport.files(t,state,false);
  const gdt={number:'7',type:'GD&T',gdtSubtype:'concentricity',upperTolerance:'0.1',lowerTolerance:'0',datumRefs:'A',specialDesignator:'◎',requirement:'◎ | 0.1 | A'};
  const visualPreset=api.presets()[0],visualBlob=api.blob(visualPreset,empty);visualBlob.name='gdt.xltx';const visualTemplate=await ASMachExcelTemplateImport.read(visualBlob),visual=ASMachExcelTemplateImport.files(visualTemplate,{metadata:{},annotations:[gdt]},false),drawing=Object.entries(visual).find(([name])=>/^xl\/drawings\/drawing\d+\.xml$/.test(name))?.[1]||'',sheet=visual['xl/worksheets/sheet1.xml'];
  let unknown=false;try{api.resolve('project.__proto__.secret',state,null);}catch{unknown=true;}
  return {passed,common:api.resolve('record.common.sampleCount',state,shared),operator:api.resolve('record.operator.inspectionMethod',state,shared),columns:parts['xl/worksheets/sheet1.xml'],unknown,gdtDesignator:api.resolve('record.specialDesignator',{metadata:{}},gdt),visualMedia:Object.keys(visual).some(name=>/^xl\/media\/asmach-gdt-\d+\.png$/.test(name)),visualDrawing:/görsel gerekliliği/.test(drawing),visualCell:!sheet.includes('◎ | 0.1 | A')};
 });
 assert.equal(result.passed.length,7);assert.equal(result.common,'7');assert.equal(result.operator,'COMMON');assert.equal(result.unknown,true);assert.match(result.columns,/r="B1"[^>]*><v>15<\/v>/);assert.equal(result.gdtDesignator,'');assert.equal(result.visualMedia,true);assert.equal(result.visualDrawing,true);assert.equal(result.visualCell,true);console.log('PASS 7 presets round-trip, empty data clears tokens, common plan isolation, repeated columns, visual GD&T and unknown field rejection');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
