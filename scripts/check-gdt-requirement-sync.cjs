const fs=require('node:fs');let fixture=fs.readFileSync('scripts/check-characteristic-info.cjs','utf8').split('\n').slice(0,4).join('\n');fixture+=`
await p.evaluate(()=>{
 const r=ASMachApp.selectedAnnotation(),raw='⌖ | Ø0.005Ⓜ | A';
 Object.assign(r,ASMachRequirements.parse(raw),{ocrText:raw,requirement:raw,requirementMode:'manual',manualFields:['requirement']});
 window.ASMachMessages={...ASMachMessages,confirm:async()=>true};ASMachApp.renderAll();
});
await p.locator('#cwGdtRef1').fill('B');await p.locator('#cwGdtRef1').dispatchEvent('change');
await p.waitForFunction(()=>ASMachApp.selectedAnnotation().requirement.includes(' | B'));
await p.evaluate(async()=>{const r=ASMachApp.selectedAnnotation();await ASMachCharacteristicEditing.confirmCorrection(ASMachApp,r,{upperTolerance:'0.008',upperLimit:'0.008'});});
await p.waitForFunction(()=>ASMachApp.selectedAnnotation().requirement.includes('0.008'));
const result=await p.evaluate(()=>{const r=ASMachApp.selectedAnnotation();return{requirement:r.requirement,ocr:r.ocrText,cells:ASMachGdtReport.render(r).cells,field:document.querySelector('#requirement').value};});
assert.ok(result.requirement.includes('Ø0.008Ⓜ | A | B'));assert.equal(result.ocr,'⌖ | Ø0.005Ⓜ | A');assert.equal(result.field,result.requirement);assert.deepEqual(result.cells,['⌖','Ø0.008Ⓜ','A','B']);
await p.locator('#cwGdtRef1').fill('');await p.locator('#cwGdtRef1').dispatchEvent('change');
assert.equal(await p.evaluate(()=>ASMachApp.selectedAnnotation().requirement.includes(' | B')),false);
await p.locator('#cwGdtZone').selectOption('');await p.locator('#cwGdtMaterial').selectOption('Ⓛ');
assert.ok(await p.evaluate(()=>{const text=ASMachApp.selectedAnnotation().requirement;return !text.includes('Ø')&&text.includes('0.008Ⓛ');}));
await p.evaluate(()=>{const select=document.querySelector('#selectedGdtSubtype');select.selectedIndex=[...select.options].findIndex(o=>o.value&&o.value!==select.value&&o.value!=='unknown');select.dispatchEvent(new Event('change',{bubbles:true}));});
assert.ok(await p.evaluate(()=>{const r=ASMachApp.selectedAnnotation();return r.requirement.startsWith(r.gdtFrame.symbol+' | ')&&r.ocrText==='⌖ | Ø0.005Ⓜ | A';}));
assert.deepEqual(errors,[]);console.log('PASS GD&T datum, tolerance, zone, material and subtype edits synchronize requirement, report and field; OCR unchanged');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});`;eval(fixture);
