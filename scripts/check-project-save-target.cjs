const fs=require('node:fs');let fixture=fs.readFileSync('scripts/check-characteristic-info.cjs','utf8').split('\n').slice(0,4).join('\n');fixture+=`
await p.evaluate(()=>{const payload=JSON.stringify(ASMachApp.projectPayload());window.saveWrites=[];window.savePickCount=0;window.openedHandle={name:'Kayitli.balloon.json',getFile:async()=>new File([payload],'Kayitli.balloon.json',{type:'application/json'}),createWritable:async()=>({write:async blob=>saveWrites.push(JSON.parse(await blob.text())),close:async()=>{}})};window.showOpenFilePicker=async()=>[openedHandle];window.showSaveFilePicker=async()=>{savePickCount++;throw new DOMException('Cancelled','AbortError');};window.ASMachFileActions={...ASMachFileActions,confirmLeave:async()=>true};});
await p.locator('#loadProjectButton').click();await p.waitForFunction(()=>document.querySelector('[data-project-file]')?.textContent==='Kayitli.balloon.json');
const result=await p.evaluate(async()=>{ASMachApp.state.annotations[0].comment='Güncel';const first=await ASMachApp.saveProject(),second=await ASMachApp.saveProject(),cancelled=await ASMachApp.saveProjectAs(),third=await ASMachApp.saveProject();return{first,second,cancelled,third,pickers:savePickCount,writes:saveWrites.map(p=>p.annotations[0].comment)};});assert.deepEqual(result,{first:true,second:true,cancelled:false,third:true,pickers:1,writes:['Güncel','Güncel','Güncel']});assert.deepEqual(errors,[]);console.log('PASS opened project writes original file repeatedly; cancelled Save As preserves original target');
const local=await p.evaluate(async()=>{
 const payload=ASMachApp.projectPayload();
 await ASMachStartScreen.remember(payload,{saved:true,savedId:'existing-project',name:'Mevcut proje'});
 await ASMachApp.restoreProject(payload,{id:'existing-project',name:'Mevcut proje'});
 ASMachApp.state.annotations[0].comment='Yerel güncelleme';
 const first=await ASMachApp.saveProject(),second=await ASMachApp.saveProject();
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('asmach-recent-work',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const rows=await new Promise(resolve=>{const r=db.transaction('saved').objectStore('saved').getAll();r.onsuccess=()=>resolve(r.result);});db.close();
 return{first,second,pickers:savePickCount,matches:rows.filter(r=>r.id==='existing-project').map(r=>r.payload.annotations[0].comment),duplicates:rows.filter(r=>r.name==='Mevcut proje').length};
});assert.deepEqual(local,{first:true,second:true,pickers:1,matches:['Yerel güncelleme'],duplicates:1});assert.deepEqual(errors,[]);console.log('PASS saved local project updates same entry without picker or duplicate');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});`;eval(fixture);
