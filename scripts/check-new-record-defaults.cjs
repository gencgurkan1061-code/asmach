const fs=require('node:fs');let fixture=fs.readFileSync('scripts/check-characteristic-info.cjs','utf8').split('\n').slice(0,4).join('\n');fixture+=`
await p.locator('#rbTab-format').click();
const before=await p.evaluate(()=>JSON.stringify(ASMachApp.state.annotations));
for(const [key,value]of [['size','32'],['fontSize','14'],['arrowEnabled','false'],['boxLineStyle','none']])await p.locator('#rd-'+key).selectOption(value);
assert.equal(await p.evaluate(()=>JSON.stringify(ASMachApp.state.annotations)),before,'existing records unchanged');
const result=await p.evaluate(()=>{const a=ASMachBalloonPlacement,records=['Uzunluk','GD&T','Diş','Not'].map(type=>{const r=ASMachApp.normalizeAnnotation({type,number:'18',size:60,fontSize:30,sourceTextHeight:80});a.applyNewDefaults(r);a.autoStyle(r,1000,1000);return ASMachRoleAppearance.effective(ASMachApp.state,r);});return records;});
for(const r of result){assert.equal(r.size,32);assert.equal(r.fontSize,14);assert.equal(r.arrowEnabled,false);assert.equal(r.boxLineStyle,'none');}
await p.locator('#rd-size').selectOption('');assert.equal(await p.evaluate(()=>ASMachApp.state.metadata.projectDefaults.newRecordAppearance.size),undefined);
await p.evaluate(()=>document.querySelector('[data-tab="format"]')?.click());
await p.screenshot({path:'outputs/new-record-defaults.png'});assert.deepEqual(errors,[]);console.log('PASS new-record overrides across types; existing records unchanged; inherit reset');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});`;eval(fixture);
