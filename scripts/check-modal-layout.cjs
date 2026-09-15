'use strict';
const {chromium}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage();const failures=[],checked=[];
  await page.route(/^https?:/,route=>route.abort());
  try{
    await page.goto(pathToFileURL(path.join(root,'ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.waitForFunction(()=>window.ASMachApp&&document.getElementById('asmach-modal-layout-style'));
    await page.evaluate(()=>{
      const app=window.ASMachApp;app.state.fileData='fixture';app.state.fileName='Layout fixture.pdf';app.state.pageCount=1;
      const canvas=app.elements.sourceCanvas;canvas.width=1000;canvas.height=700;const g=canvas.getContext('2d');g.fillStyle='white';g.fillRect(0,0,1000,700);g.fillStyle='black';g.font='30px Arial';g.fillText('Ø20 +0.02/-0.05',300,300);
      const snapshot=canvas.toDataURL();app.state.annotations=[1,2].map(n=>app.normalizeAnnotation({id:'qa'+n,number:n,type:'Çap',nominalValue:'20',upperTolerance:'0.02',lowerTolerance:'-0.05',requirement:'Ø20 (+0.02/-0.05)',inspectionMethod:'CMM',selectionBox:{x:.3,y:.3,w:.2,h:.1},snapshot}));
      window.qaSnapshot=snapshot;
    });
    const cases=['confirmModal','methodModal','balloonSettingsModal','methodEditorModal','pdfExportModal','ocrReviewModal','automaticReviewModal','editor','metadata','audit','bulk','numbering','candidate','region','excel','pdf','rolePlans','inspectionReports'];
    for(const [width,height] of [[1440,900],[1366,768],[1024,600],[800,450],[390,640],[640,360]]){
      await page.setViewportSize({width,height});
      for(const name of cases){
        await page.evaluate(async name=>{
          document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelectorAll('.modal.is-visible').forEach(d=>d.classList.remove('is-visible'));document.querySelectorAll('.wf-dialog.open').forEach(d=>d.classList.remove('open'));
          const app=window.ASMachApp;
          if(name.endsWith('Modal')){const node=document.getElementById(name);node.classList.add(name==='automaticReviewModal'?'open':'is-visible');}
          if(name==='ocrReviewModal'){
            document.getElementById(name).classList.add('is-candidate-review');
            window.qaSnapshotEditor?.dispose();window.qaSnapshotEditor=window.ASMachSnapshots.mount(document.getElementById('ocrSnapshotEditor'),window.qaSnapshot,()=>{},()=>{},{initialRect:{x:.25,y:.32,w:.4,h:.12}});
            document.getElementById('ocrNominal').value='20';document.getElementById('ocrLowerTolerance').value='-0.05';document.getElementById('ocrUpperTolerance').value='+0.02';
          }
          if(name==='rolePlans')window.ASMachRolePlans.open(app,app.state.annotations[0],()=>{});if(name==='inspectionReports')window.ASMachInspectionReports.open();
          if(name==='editor')window.ASMachCharacteristicUI.openEditor('qa1');
          if(name==='metadata')window.ASMachCharacteristicUI.openMetadata();
          if(name==='audit')window.ASMachCharacteristicUI.openAudit();
          if(name==='bulk'){window.ASMachBulkPlan.open(['qa1','qa2']);document.getElementById('bulkPlanFrequency').value='CUSTOM';document.getElementById('bulkPlanFrequency').onchange();}
          if(name==='numbering')void window.ASMachBalloonNumbering.afterDelete();
          if(name==='candidate')window.ASMachCandidatePreview.open({candidate:{page:1,pageImage:app.elements.sourceCanvas,box:app.state.annotations[0].selectionBox,text:'Ø20 +0.02/-0.05',parsed:{type:'Çap'}},item:app.state.annotations[0],placed:true,onEdit:async()=>false,onApply(){}});
          if(name==='region')void window.ASMachCharacteristicRegion.open(app,app.state.annotations[0]);
          if(name==='excel')window.ASMachExcelReports.open(app);
          if(name==='pdf'){const pdf=new window.jspdf.jsPDF();pdf.text('Modal layout QA',20,20);void window.ASMachPdfPreview.open(pdf.output('blob'),{fileName:'Layout QA.pdf'});}
        },name);
        await page.waitForTimeout(120);
        const result=await page.evaluate(name=>{
          const native=[...document.querySelectorAll('dialog[open]')].at(-1);
          const layer=native||[...document.querySelectorAll('.modal.is-visible,.wf-dialog.open')].at(-1);
          if(!layer)return{error:'No open modal'};
          const card=native||layer.querySelector('.modal-card,.wf-card'),r=card.getBoundingClientRect();
          const foot=card.querySelector('.modal-actions,.acui-foot,.wf-foot,#bulkPlanForm>div:last-child');
          const head=card.querySelector('.modal-head,.acui-head,.wf-head')||card.firstElementChild;
          const hr=head.getBoundingClientRect(),hit=document.elementFromPoint(Math.min(innerWidth-15,hr.x+hr.width/2),Math.max(13,hr.y+Math.min(hr.height/2,20)));
          const errors=[];
          if(r.top< -1||r.bottom>innerHeight+1||r.left< -1||r.right>innerWidth+1)errors.push('Card outside viewport');
          if(!layer.contains(hit))errors.push('Header covered by another layer');
          if(foot){const f=foot.getBoundingClientRect();if(f.bottom>r.bottom+1||f.top<r.top-1)errors.push('Footer outside card');if(f.height<25)errors.push('Footer compressed');}
          const body=card.querySelector('.modal-body,.wf-body,.acui-content,#bulkPlanForm,#candidatePreviewImage,[data-pages]');
          if(body){body.scrollTop=body.scrollHeight;if(body.scrollHeight>body.clientHeight+2&&body.scrollTop===0)errors.push('Long content cannot scroll');}
          if(foot){foot.scrollTop=foot.scrollHeight;const buttons=[...foot.querySelectorAll('button,a.btn')].filter(b=>b.getClientRects().length);const button=buttons.at(-1);if(button){const b=button.getBoundingClientRect(),at=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);if(!button.contains(at))errors.push('Last footer action is covered');}}
          return{errors,rect:{x:r.x,y:r.y,w:r.width,h:r.height},footer:foot?.getBoundingClientRect().height};
        },name);
        checked.push({name,width,height,...result});if(result.error||result.errors.length)failures.push(checked.at(-1));
        if(['ocrReviewModal','automaticReviewModal'].includes(name)&&(width===800||width===390)){
          const folder=path.join(root,'outputs','modal-layout-qa');fs.mkdirSync(folder,{recursive:true});await page.screenshot({path:path.join(folder,`${name}-${width}x${height}.png`)});
        }
      }
    }
    const folder=path.join(root,'outputs','modal-layout-qa');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(checked,null,2));
    console.log(JSON.stringify({checked:checked.length,failures},null,2));if(failures.length)process.exitCode=1;
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
