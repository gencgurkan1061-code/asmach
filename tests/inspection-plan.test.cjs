const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('src/inspection-plan.js','utf8'),ctx);const plan=ctx.window.ASMachInspectionPlan;
test('Frequency enum, custom migration, validation and display preserve a defined sampling plan',()=>{
  assert.equal(new Set(plan.FREQUENCIES.map(f=>f.value)).size,11);
  assert.equal(plan.normalize({}).inspectionFrequency,'');
  assert.equal(plan.normalize({inspectionFrequency:'Eski özel plan'}).frequencyNote,'Eski özel plan');
  for(const value of ['0','-1','1.5','abc','',Infinity])assert.ok(plan.validate({inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:value}));
  assert.equal(plan.validate({inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'10'}),'');
  assert.equal(plan.label({inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'10'}),'Her 10 parçada');
  assert.ok(plan.validate({inspectionFrequency:'CUSTOM',frequencyNote:' '}));
  assert.equal(plan.validate({inspectionFrequency:'CUSTOM',frequencyNote:'Partiden 3 adet'}),'');
});
test('Notes suggest relevant methods without choosing for the user',()=>{
  for(const [note,value] of [['Çapak olmayacak','GÖRSEL_KONTROL'],['Malzeme sertifikası','DOKÜMAN_KONTROLÜ'],['Isıl işlem uygulanacak','PROSES_DOĞRULAMA'],['Fonksiyon testi','FONKSİYON_KONTROLÜ']]){
    assert.equal(plan.suggestions(note)[0].value,value);assert.equal(plan.suggestions(note).filter(m=>m.recommended).length,1);
  }
});
