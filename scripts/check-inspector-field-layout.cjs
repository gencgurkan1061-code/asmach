const { chromium } = require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors=[];page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.evaluate(async () => {
      const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
      await ASMachApp.restoreProject({format:'asmach-ballooning-project',source:{name:'alan-kontrol.png',type:'image/png',dataUrl:canvas.toDataURL()},annotations:[{id:'a',number:'1',page:1,type:'Çap',nominalValue:'41',unit:'mm',lowerTolerance:'0',upperTolerance:'+0.1',lowerLimit:'41',upperLimit:'41.1',bubbleX:.4,bubbleY:.4,anchorX:.5,anchorY:.5}]});ASMachApp.state.selectedId='a';ASMachApp.renderAll();
    });
    const metrics=await page.evaluate(() => {
      const rect=id=>document.getElementById(id).getBoundingClientRect();
      const width=id=>rect(id).width;
      const pseudo=(selector,part)=>getComputedStyle(document.querySelector(selector),part).content;
      const field=document.getElementById('characteristicType').closest('.field'),label=field.querySelector('label'),input=document.getElementById('characteristicType');
      return {type:width('characteristicType'),classification:width('characteristicClass'),nominal:width('nominalValue'),upper:width('upperTolerance'),nominalLeft:rect('nominalValue').left,lowerToleranceLeft:rect('lowerTolerance').left,upperToleranceLeft:rect('upperTolerance').left,upperLimitLeft:document.querySelector('[data-limit=upperLimit]').getBoundingClientRect().left,lowerToleranceTop:rect('lowerTolerance').top,upperToleranceTop:rect('upperTolerance').top,pageLeft:rect('balloonPage').left,zoneLeft:rect('balloonZone').left,toleranceSourceLeft:rect('toleranceStandard').left,typeLeft:rect('characteristicType').left,classLeft:rect('characteristicClass').left,metadataParent:document.getElementById('balloonPage').closest('section')?.className,metadataInCharacteristic:document.getElementById('cwCharacteristicInfo').contains(document.getElementById('balloonPage'))&&document.getElementById('cwCharacteristicInfo').contains(document.getElementById('balloonZone'))&&document.getElementById('cwCharacteristicInfo').contains(document.getElementById('toleranceStandard')),sourceContainsMetadata:!!document.querySelector('.cw-source-info #balloonPage,.cw-source-info #balloonZone,.cw-source-info #toleranceStandard'),lowerParent:document.getElementById('lowerTolerance').parentElement.parentElement.className,upperParent:document.getElementById('upperTolerance').parentElement.parentElement.className,drawingStandardVisible:!!document.getElementById('cwDrawingStandard').getClientRects().length,heading:parseFloat(getComputedStyle(document.querySelector('#cwCharacteristicInfo>summary')).fontSize),label:parseFloat(getComputedStyle(label).fontSize),gap:input.getBoundingClientRect().left-label.getBoundingClientRect().right,ocrArrow:pseudo('#cwSourceToggle','::before'),characteristicArrow:pseudo('#cwCharacteristicInfo>summary','::before'),ocrArrowSize:getComputedStyle(document.querySelector('#cwSourceToggle'),'::before').fontSize,characteristicArrowSize:getComputedStyle(document.querySelector('#cwCharacteristicInfo>summary'),'::before').fontSize};
    });
    for(const key of ['type','classification','nominal','upper'])assert.ok(metrics[key]>=95,JSON.stringify(metrics));
    assert.ok(metrics.heading<=10&&metrics.label<=10&&metrics.gap<=6,JSON.stringify(metrics));
    assert.ok(Math.abs(metrics.nominalLeft-metrics.lowerToleranceLeft)<=1,JSON.stringify(metrics));
    assert.ok(Math.abs(metrics.upperLimitLeft-metrics.upperToleranceLeft)<=1,JSON.stringify(metrics));
    assert.ok(Math.abs(metrics.lowerToleranceTop-metrics.upperToleranceTop)<=1,JSON.stringify(metrics));
    assert.equal(metrics.metadataInCharacteristic,true,JSON.stringify(metrics));
    assert.equal(metrics.sourceContainsMetadata,false,JSON.stringify(metrics));
    assert.match(metrics.metadataParent,/cw-characteristic-meta/,JSON.stringify(metrics));
    assert.ok(Math.abs(metrics.pageLeft-metrics.typeLeft)<=1,JSON.stringify(metrics));
    assert.ok(Math.abs(metrics.zoneLeft-metrics.classLeft)<=1,JSON.stringify(metrics));
    assert.ok(Math.abs(metrics.toleranceSourceLeft-metrics.typeLeft)<=1,JSON.stringify(metrics));
    assert.equal(metrics.drawingStandardVisible,false,JSON.stringify(metrics));
    assert.ok(['"▸"','"▾"'].includes(metrics.ocrArrow)&&['"▸"','"▾"'].includes(metrics.characteristicArrow));
    assert.equal(metrics.ocrArrowSize,metrics.characteristicArrowSize);
    await page.screenshot({path:'outputs/inspector-field-layout.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS matching accordion arrows, smaller headings and wider two-column inputs.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
