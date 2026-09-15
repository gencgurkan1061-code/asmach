const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),{pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();await page.route(/^https?:/,r=>r.abort());await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
 const results=await page.evaluate(async()=>{
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',parse=s=>new DOMParser().parseFromString(s,'application/xml'),xml=d=>new XMLSerializer().serializeToString(d);
  const state={metadata:{},annotations:[{number:'1.1',page:1,nominalValue:'10.1',lowerTolerance:'-0,2',upperTolerance:'+0.3',lowerLimit:'9,9',upperLimit:'10.4',resultValue:'10,12'}]};
  const base=await ASMachExcelTemplateImport.read(new File([ASMachExcelCellTemplate.blob(ASMachExcelCellTemplate.presets()[0],state)],'numbers.xltx'));
  const fields=['nominalValue','lowerTolerance','upperTolerance','lowerLimit','upperLimit','number','resultValue'];const result=[];
  for(const separator of ['auto','dot','comma']){
   const parts=Object.fromEntries(Object.entries(base.parts).map(([k,v])=>[k,v.text??Uint8Array.from(atob(v.base64),c=>c.charCodeAt(0))]));
   const styles=parse(parts['xl/styles.xml']),xfs=styles.getElementsByTagNameNS(ns,'cellXfs')[0],xf=xfs.children[0].cloneNode(true),style=xfs.children.length;xf.setAttribute('numFmtId','49');xf.setAttribute('quotePrefix','1');xfs.append(xf);xfs.setAttribute('count',String(xfs.children.length));parts['xl/styles.xml']=xml(styles);
   parts[base.sourceSheets[0].path]=`<worksheet xmlns="${ns}"><sheetData><row r="1">${fields.map((f,i)=>`<c r="${String.fromCharCode(65+i)}1" s="${style}" t="inlineStr"><is><t>{{record.${f}}}</t></is></c>`).join('')}</row><row r="3"><c r="A3"><f>SUM(A1:C1)</f><v>0</v></c><c r="B3"><f>COUNT(A1:E1)</f><v>0</v></c><c r="C3" t="b"><f>ISNUMBER(A1)</f><v>0</v></c><c r="D3"><f>A1+B1</f><v>0</v></c></row></sheetData></worksheet>`;
   parts['docProps/custom.xml']=`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="ASMachDecimalSeparator"><vt:lpwstr>${separator}</vt:lpwstr></property></Properties>`;
   const ct=parse(parts['[Content_Types].xml']);if(![...ct.documentElement.children].some(n=>n.getAttribute('PartName')==='/docProps/custom.xml')){const n=ct.createElementNS(ct.documentElement.namespaceURI,'Override');n.setAttribute('PartName','/docProps/custom.xml');n.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.custom-properties+xml');ct.documentElement.append(n);}parts['[Content_Types].xml']=xml(ct);
   const rel=parse(parts['_rels/.rels']),link=rel.createElementNS(rel.documentElement.namespaceURI,'Relationship');link.setAttribute('Id','decimalFixture');link.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties');link.setAttribute('Target','docProps/custom.xml');rel.documentElement.append(link);parts['_rels/.rels']=xml(rel);
   const t=await ASMachExcelTemplateImport.read(new File([ASMachWorkflow.zipStored(parts)],'decimal.xltx')),out=ASMachExcelTemplateImport.files(t,state,false),sheet=parse(out[t.sourceSheets[0].path]),cells=fields.map((f,i)=>{const c=sheet.querySelector(`c[r="${String.fromCharCode(65+i)}1"]`);return{type:c.getAttribute('t'),value:c.textContent,style:c.getAttribute('s')};});
   const savedStyles=parse(out['xl/styles.xml']),aStyle=savedStyles.getElementsByTagNameNS(ns,'cellXfs')[0].children[Number(cells[0].style)];
   const bytes=new Uint8Array(await ASMachWorkflow.zipStored(out).arrayBuffer());let encoded='';for(const byte of bytes)encoded+=String.fromCharCode(byte);
   result.push({separator,read:t.decimalSeparator,cells,numFmt:aStyle.getAttribute('numFmtId'),quote:aStyle.getAttribute('quotePrefix'),base64:btoa(encoded)});
  }
  const resolve=ASMachExcelCellTemplate.resolve;
  const cases=[['record.nominalValue','0',0],['record.lowerTolerance','−0,25',-.25],['record.upperTolerance','1.2e-3',.0012],['record.nominalValue','', ''],['record.nominalValue','10 mm','10 mm'],['record.number','1.10','1.10'],['project.partNo','00123','00123']];
  for(const [field,input,expected] of cases){const actual=resolve(field,{metadata:{partNo:input}},{[field.split('.')[1]]:input});if(actual!==expected)throw Error(field+': '+actual);}
  if(resolve('record.nominalValue',{}, {nominalValue:'1.234,56'},'comma')!==1234.56||resolve('record.nominalValue',{}, {nominalValue:'1,234.56'},'dot')!==1234.56)throw Error('Grouped decimals failed');
  return result;
 });
 fs.mkdirSync('outputs/decimal-tests',{recursive:true});
 for(const r of results){assert.equal(r.read,r.separator);for(const i of [0,1,2,3,4,6])assert.equal(r.cells[i].type,'n');assert.deepEqual(r.cells.map(c=>c.value),['10.1','-0.2','0.3','9.9','10.4','1.1','10.12']);assert.equal(r.cells[5].type,'inlineStr');assert.equal(r.numFmt,'0');assert.equal(r.quote,'0');fs.writeFileSync('outputs/decimal-tests/'+r.separator+'.xlsx',Buffer.from(r.base64,'base64'));}
 console.log('PASS numeric cells in all separator modes; text styles cleared only on numeric fields; blanks, units, IDs preserved. Formula fixtures written.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
