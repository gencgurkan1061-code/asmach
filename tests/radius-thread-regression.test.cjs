'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, console, state: { generalTolerance: { standard: '', unit: 'mm' } } });
const html = fs.readFileSync(path.join(root, 'src/app.template.html'), 'utf8');
const start = html.indexOf('function parseTechnicalRequirement(rawText,');
assert.ok(start > 0);
vm.runInContext(html.slice(start, html.indexOf('function technicalTextScore(', start)), context);
vm.runInContext(fs.readFileSync(path.join(root, 'src/requirements-engine.js'), 'utf8'), context);
const api = context.window.ASMachRequirements;
const parse = (text, standard = '') => context.parseTechnicalRequirement(text, standard);
const oldThreadParser = () => ({ type: 'Diş', nominalValue: '16', unit: 'in', threadStandard: 'ISO 7-1', toleranceStandard: 'ISO 7-1', evaluationMethod: 'OK_NOT_OK', threadPitch: '', callout: { threadForm: 'R' } });

for (const [text, nominal, quantity = 1, unit = 'mm'] of [
  ['R16', '16'], ['R 16', '16'], ['R 1 6', '16'], ['r16', '16'],
  ['R\u00a016', '16'], ['R\u200b16', '16'], ['R１６', '16'],
  ['R1', '1'], ['R5', '5'], ['R6', '6'], ['R12.5', '12.5'],
  ['R 1 2 . 5', '12.5'], ['R 0 , 5', '0.5'], ['R.5', '0.5'],
  ['2 x R16', '16', 2], ['3 × R 16', '16', 3], ['R16 mm', '16'],
  ['R16 in', '16', 1, 'in'], ['R0.5 inch', '0.5', 1, 'in'],
  ['R0.5″', '0.5', 1, 'in'],
]) {
  test(`Bare radius is authoritative in standalone, host and legacy fallback: ${text}`, () => {
    for (const result of [api.parse(text), parse(text), api.parse(text, '', oldThreadParser)]) {
      assert.equal(result.type, 'Yarıçap');
      assert.equal(result.nominalValue, nominal);
      assert.equal(result.quantity, quantity);
      assert.equal(result.unit, unit);
      assert.equal(result.evaluationMethod, 'VALUE');
      for (const key of ['threadStandard', 'threadPitch', 'threadClass', 'toleranceStandard']) assert.equal(result[key] || '', '', key);
      assert.equal(result.callout?.threadForm, undefined);
      assert.match(api.generateRequirement(result), /R/);
    }
  });
}

for (const [text, standard, nominal, pitch] of [
  ['R1/8', 'ISO 7-1', '0.125', '28 TPI'],
  ['R 1 1/2', 'ISO 7-1', '1.5', '11 TPI'],
  ['2 x R1/8', 'ISO 7-1', '0.125', '28 TPI'],
  ['R1 LH', 'ISO 7-1', '1', '11 TPI'],
  ['R1 RH', 'ISO 7-1', '1', '11 TPI'],
  ['Rc1', 'ISO 7-1', '1', '11 TPI'],
  ['Rp1/8', 'ISO 7-1', '0.125', '28 TPI'],
  ['G1', 'ISO 228-1', '1', '11 TPI'],
  ['G1/2 A', 'ISO 228-1', '0.5', '14 TPI'],
  ['1/8-27 NPT', 'ASME B1.20.1', '0.125', '27 TPI'],
  ['1/8-27 NPTF', 'ASME B1.20.3', '0.125', '27 TPI'],
  ['1/2-14 BSPT', 'ISO 7-1', '0.5', '14 TPI'],
  ['M16', 'ISO 261', '16', ''],
  ['M16x1.5-6H', 'ISO 261 / ISO 965-1', '16', '1.5'],
  ['1/4-20 UNC-2B', 'ASME B1.1', '0.25', '20 TPI'],
  ['Tr20x4 LH', 'ISO 2902', '20', '4'],
]) {
  test(`Explicit thread evidence is preserved: ${text}`, () => {
    const result = parse(text);
    assert.equal(result.type, 'Diş');
    assert.equal(result.threadStandard, standard);
    assert.equal(result.nominalValue, nominal);
    assert.equal(result.threadPitch, pitch);
    assert.equal(api.repairAutoRadius({ ...result, ocrText: text }, parse).type, 'Diş');
  });
}

test('Explicit radius deviations, limit pairs and surface parameters keep their meaning', () => {
  for (const [text, nominal, lower, upper] of [
    ['R16 ±0.1', '16', '-0.1', '0.1'],
    ['R16 +0.2/-0.1', '16', '-0.1', '0.2'],
    ['R16 MAX R15 MIN', '15.5', '-0.5', '0.5'],
  ]) {
    const result = parse(text);
    assert.equal(result.type, 'Yarıçap', text);
    assert.equal(result.nominalValue, nominal, text);
    assert.equal(Number(result.lowerTolerance), Number(lower), text);
    assert.equal(Number(result.upperTolerance), Number(upper), text);
    assert.equal(result.toleranceExplicit, true);
  }
  for (const text of ['Ra 1.6 µm', 'Rz 16 µm', 'Rp 1 µm']) assert.equal(parse(text).type, 'Yüzey', text);
});

function legacyRecord(overrides = {}) {
  return {
    id: 'radius-45', number: '45', ...oldThreadParser(), status: 'needs_review',
    ocrText: 'R16', requirement: 'R 16', requirementMode: 'auto', autoParse: true,
    threadClass: '', lowerTolerance: '', upperTolerance: '', lowerLimit: '', upperLimit: '',
    selectionBox: { x: .2, y: .3, w: .1, h: .04, angleLocked: true, rotation: 0 },
    snapshot: 'data:image/png;base64,source', quantity: 2,
    manualFields: ['comment'], comment: 'Keep the inspection plan', operation: 'Op10',
    ...overrides,
  };
}

test('Old automatic R16 record is repaired in memory, with drawing tolerances and source preserved', () => {
  const source = legacyRecord(), before = JSON.stringify(source);
  const repaired = api.repairAutoRadius(source, text => parse(text, 'ISO 2768-mK'));
  assert.notEqual(repaired, source);
  assert.equal(JSON.stringify(source), before, 'No mutation or project rewrite');
  assert.equal(repaired.type, 'Yarıçap');
  assert.equal(repaired.unit, 'mm');
  assert.equal(repaired.evaluationMethod, 'VALUE');
  assert.equal(repaired.threadStandard, '');
  assert.equal(repaired.callout.threadForm, undefined);
  assert.match(repaired.toleranceStandard, /ISO 2768-mK/);
  assert.equal(Number(repaired.lowerTolerance), -.2);
  assert.equal(Number(repaired.upperTolerance), .2);
  assert.equal(Number(repaired.lowerLimit), 15.8);
  assert.equal(Number(repaired.upperLimit), 16.2);
  assert.equal(repaired.requirement, '2 × R16 ±0.2');
  assert.equal(repaired.ocrNeedsReview, true);
  assert.equal(repaired.originalOcrText, 'R16');
  for (const key of ['id', 'number', 'ocrText', 'quantity', 'comment', 'operation', 'snapshot', 'selectionBox', 'manualFields']) assert.deepEqual(repaired[key], source[key], key);
  assert.equal(api.repairAutoRadius(repaired, parse), repaired, 'Repair is idempotent');
});

test('Manual requirement wording and original OCR evidence survive safe automatic repair', () => {
  const source = legacyRecord({ requirementMode: 'manual', manualFields: ['requirement'], requirement: 'Onay bekleyen özel açıklama', originalOcrText: 'R 1 6' });
  const repaired = api.repairAutoRadius(source, parse);
  assert.equal(repaired.type, 'Yarıçap');
  assert.equal(repaired.requirement, source.requirement);
  assert.equal(repaired.originalOcrText, source.originalOcrText);
});

test('Intentional, approved, measured, ambiguous and real thread records are never migrated', () => {
  const protectedRecords = [
    ...['type', 'unit', 'nominalValue', 'threadPitch', 'threadClass', 'threadStandard', 'toleranceStandard', 'evaluationMethod', 'callout', 'lowerTolerance', 'upperLimit'].map(key => ({ manualFields: [key] })),
    ...['approved', 'rejected', 'measured', 'pass', 'fail', 'ONAYLI', 'OLCULDU'].map(status => ({ status })),
    ...['approved', 'corrected', 'rejected'].map(candidateReviewStatus => ({ candidateReviewStatus })),
    { autoParse: false }, { result: '16' }, { resultStatus: 'pass' }, { nominalSource: 'manual' },
    { threadPitch: '11 TPI' }, { threadClass: 'A' }, { toleranceExplicit: true },
    { callout: { threadForm: 'Rc' } }, { callout: { threadForm: 'R', threadHand: 'LH' } },
    { upperTolerance: '.1' }, { lowerTolerance: '0' }, { upperLimit: '16' },
    { ocrText: 'R1/8' }, { ocrText: 'R 1/6' }, { ocrText: 'R1 LH' },
    { ocrText: 'R16 / R20' }, { ocrText: 'R16 ±0.2' }, { ocrText: 'R?' },
    { originalOcrText: 'R1/6' }, { originalOcrText: 'Rc16' }, { originalOcrText: 'R12' },
    { nominalValue: '12' }, { threadStandard: 'ISO 261' }, { type: 'Çap' },
  ];
  for (const overrides of protectedRecords) {
    const source = legacyRecord(overrides);
    assert.equal(api.repairAutoRadius(source, () => { throw Error('Protected record must not be reparsed'); }), source, JSON.stringify(overrides));
  }
});

test('Drawing inch units are retained for radius, not mistaken for thread-family evidence', () => {
  context.state.generalTolerance = { standard: '', unit: 'in' };
  try {
    assert.equal(parse('R16').type, 'Yarıçap');
    assert.equal(api.repairAutoRadius(legacyRecord(), parse).unit, 'in');
    assert.equal(parse('R16 mm').unit, 'mm');
  } finally {
    context.state.generalTolerance = { standard: '', unit: 'mm' };
  }
});
