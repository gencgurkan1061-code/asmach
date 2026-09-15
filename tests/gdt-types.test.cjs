'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/requirements-engine.js'), 'utf8'), context);
const api = context.window.ASMachRequirements;
const plain = value => JSON.parse(JSON.stringify(value));

test('All 14 GD&T types detect their symbol and retain total tolerance, diameter, modifiers and datums', () => {
  assert.equal(api.GDT_TYPES.length, 14);
  for (const type of api.GDT_TYPES) {
    const record = api.parse(`${type.symbol} | Ø0.138Ⓜ | A | BⓂ | C`);
    assert.equal(record.type, 'GD&T', type.name);
    assert.equal(record.gdtSubtype, type.value, type.name);
    assert.equal(record.nominalValue, '');
    assert.equal(record.lowerTolerance, '0');
    assert.equal(record.upperTolerance, '0.138');
    assert.deepEqual(plain(record.gdtFrame.cells), [type.symbol, 'Ø0.138Ⓜ', 'A', 'BⓂ', 'C']);
  }
});

test('Turkish, ASCII, English and alternate symbols resolve specific GD&T types', () => {
  const examples = [
    ['Paralellik', 'parallelism'], ['PARALELLİK', 'parallelism'], ['⫽', 'parallelism'], ['//', 'parallelism'],
    ['Diklik', 'perpendicularity'], ['⊥', 'perpendicularity'], ['Açısallık', 'angularity'],
    ['Düzlemsellik', 'flatness'], ['Dogr usallik'.replace(' ', ''), 'straightness'],
    ['Dairesellik', 'circularity'], ['Silindiriklik', 'cylindricity'],
    ['Yüzey profili', 'profile_surface'], ['PROFILE OF A SURFACE', 'profile_surface'],
    ['Çizgi profili', 'profile'], ['PROFILE OF A LINE', 'profile'],
    ['Toplam salgı', 'total_runout'], ['TOTAL RUN-OUT', 'total_runout'],
    ['Dairesel salgı', 'runout'], ['CIRCULAR RUNOUT', 'runout'],
    ['Simetriklik', 'symmetry'], ['Eş merkezlilik', 'concentricity'], ['EŞ EKSENLİLİK', 'concentricity'],
    ['Konum', 'position'], ['true position', 'position'],
  ];
  for (const [name, subtype] of examples) {
    const parsed = api.parse(`${name} | 0.2 | A`);
    assert.equal(parsed.gdtSubtype, subtype, name);
    assert.equal(parsed.upperTolerance, '0.2', name);
  }
});

test('Missing graphical symbol stays unknown; an extra OCR datum is capped and disclosed', () => {
  const record = api.parse('Ø1.38 | E | A | C | G');
  assert.equal(record.type, 'GD&T');
  assert.equal(record.gdtSubtype, 'unknown');
  assert.equal(record.gdtFrame.diameter, true);
  assert.equal(record.upperTolerance, '1.38');
  assert.deepEqual(plain(record.gdtFrame.cells), ['?', 'Ø1.38', 'E', 'A', 'C']);
  assert.deepEqual(plain(record.gdtFrame.datums.map(datum=>datum.reference)), ['E', 'A', 'C']);
  assert.equal(record.datumRefs,'E | A | C');
  assert.ok(record.parseWarnings.some(w => w.includes('sembol okunamadı')));
  assert.ok(record.parseWarnings.some(w => w.includes('Fazladan datum')));
  const known=api.parse('⌖ | Ø0.15 | B | C | D | E');
  assert.equal(known.gdtSubtype,'position');
  assert.deepEqual(plain(known.gdtFrame.cells),['⌖','Ø0.15','B','C','D']);
  assert.equal(known.datumRefs,'B | C | D');
  assert.ok(known.parseWarnings.some(w=>w.includes('Fazladan datum')));
  const changed=api.withGdtSubtype({...known,datumRefs:'A | BⓂ | C | D'},'position');
  assert.deepEqual(plain(changed.gdtFrame.cells),['⌖','Ø0.15','A','BⓂ','C']);
  assert.equal(changed.datumRefs,'A | BⓂ | C');
  for (const text of ['Ø27.3 0/-0.05', '27.3 ±0.1', '0.1', 'R5', 'M6', 'D2', '-0.05']) {
    assert.equal(api.detectGdt(text), null, text);
    assert.notEqual(api.parse(text).type, 'GD&T', text);
  }
});

test('Manual subtype updates frame without mutating OCR or losing datum modifiers and numeric edits', () => {
  const record = { ...api.parse('⌖ | Ø0.2Ⓜ | A | BⓂ'), requirement: '⌖ | Ø0.2Ⓜ | A | BⓂ' };
  const changed = api.withGdtSubtype({ ...record, upperTolerance: '0.3' }, 'parallelism');
  assert.equal(changed.gdtSubtype, 'parallelism');
  assert.equal(changed.specialDesignator, '∥');
  assert.deepEqual(plain(changed.gdtFrame.cells), ['∥', 'Ø0.3Ⓜ', 'A', 'BⓂ']);
  assert.equal(changed.requirement, record.requirement);
  assert.equal(record.gdtFrame.symbol, '⌖');
  assert.equal(api.withGdtSubtype(changed, '').gdtFrame.symbol, '?');
  const unknown = api.withGdtSubtype(api.parse('0.2 A'), 'flatness');
  assert.ok(!unknown.parseWarnings.some(w => w.includes('sembol okunamadı')));
});

test('Selectors preserve legacy values and share the same catalog', () => {
  assert.equal(api.gdtOptions().length, 15);
  assert.equal(api.gdtOptions('unknown').at(-1).value, 'unknown');
  assert.equal(api.gdtOptions('custom-old-subtype').at(-1).value, 'custom-old-subtype');
  assert.equal(api.gdtOptions('parallelism').length, 15);
  const html = fs.readFileSync(path.join(__dirname, '../src/app.template.html'), 'utf8');
  for (const id of ['ocrGdtSubtype', 'selectedGdtSubtype', 'ocrGdtFrame']) assert.match(html, new RegExp(`id="${id}"`));
});

test('Missing tolerance never consumes datums; clearing a zone does not restore stale frame data',()=>{
  const partial=api.parse('◎ | ? | A | ? | C');
  assert.equal(partial.upperTolerance,'');assert.equal(partial.datumRefs,'A |  | C');
  assert.deepEqual(plain(api.withGdtSubtype(partial).gdtFrame.cells),['◎','?','A','','C']);
  const record=api.parse('◎ | ±0.1 | A');
  assert.equal(record.upperTolerance,'0.1');assert.equal(record.lowerTolerance,'0');assert.equal(record.datumRefs,'A');
  const cleared=api.withGdtSubtype({...record,upperTolerance:''});
  assert.equal(cleared.gdtFrame.tolerance,'');assert.deepEqual(plain(cleared.gdtFrame.cells),['◎','?','A']);
  assert.equal(record.gdtFrame.tolerance,'0.1');
});
