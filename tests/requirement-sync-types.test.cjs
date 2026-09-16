'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, console });
const html = fs.readFileSync(path.join(root, 'src/app.template.html'), 'utf8');
const host = /function (?:legacyParseTechnicalRequirement|parseTechnicalRequirementLegacy)\(rawText, generalToleranceStandard = ""\) \{/.exec(html) || /function parseTechnicalRequirement\(rawText, generalToleranceStandard = ""\) \{/.exec(html);
assert.ok(host, 'Existing numeric parser is available');
vm.runInContext(html.slice(host.index, html.indexOf('function technicalTextScore(', host.index)), context);
vm.runInContext(fs.readFileSync(path.join(root, 'src/requirements-engine.js'), 'utf8'), context);
const api = context.window.ASMachRequirements;
const parse = text => api.parse(text, '', context[host[0].match(/function (\w+)/)[1]]);
const generated = record => api.syncRequirement({ requirementMode: 'auto', ...record }, true).requirement;

test('All numeric families and datum regenerate from their structured fields', () => {
  const cases = [
    [{ type: 'Uzunluk', nominalValue: '10', lowerTolerance: '-.1', upperTolerance: '.1' }, '10 ±0.1'],
    [{ type: 'Çap', nominalValue: '10', lowerTolerance: '-.05', upperTolerance: '0' }, 'Ø10 (0/-0.05)'],
    [{ type: 'Yarıçap', nominalValue: '5' }, 'R5'],
    [{ type: 'Açı', nominalValue: '30', upperTolerance: '.5' }, '30° (üst +0.5)'],
    [{ type: 'Açı', nominalValue: '30.5', angleFormat: 'dms' }, '30° 30′ 0″'],
    [{ type: 'Geçme', nominalValue: '20', fitClass: 'H7', lowerTolerance: '0', upperTolerance: '.021' }, '20 H7 (+0.021/0)'],
    [{ type: 'Pah', nominalValue: '2', chamferAngle: '45', chamferAngleTolerance: '1' }, '2 × 45° ±1°'],
    [{ type: 'Tolerans', nominalValue: '', lowerTolerance: '-.1', upperTolerance: '.1' }, '±0.1'],
    [{ type: 'Tolerans', nominalValue: '', upperTolerance: '.2' }, '(üst +0.2)'],
    [{ type: 'Yüzey', nominalValue: '1.6', specialDesignator: 'Rz', unit: 'µm', upperTolerance: '.1' }, 'Rz 1.6 (üst +0.1) µm'],
    [{ type: 'Datum', datumRefs: 'B' }, 'Datum B'],
  ];
  for (const [record, expected] of cases) {
    assert.equal(generated({ ...record, requirement: 'Eski gereklilik', ocrText: 'Eski OCR' }), expected, record.type);
  }
});

test('Thread quantities and shared hole details survive every supported thread family', () => {
  for (const [text, expected] of [
    ['3 x M12x1.25-6H', '3 × M12 × 1.25-6H'],
    ['2 x 1/4-20 UNC-2B', '2 × 1/4-20 UNC-2B'],
    ['2 x 1/8-27 NPT', '2 × 1/8-27 NPT'],
    ['2 x 1/8-27 NPTF', '2 × 1/8-27 NPTF'],
    ['2 x G1/2 A', '2 × G 1/2 A'],
    ['2 x R1/8', '2 × R 1/8'],
    ['2 x Rc1/8', '2 × Rc 1/8'],
    ['2 x Rp1/8', '2 × Rp 1/8'],
    ['2 x 1/2-14 BSPP', '2 × 1/2-14 BSPP'],
    ['2 x Tr20x4 LH', '2 × Tr20 × 4 LH'],
  ]) {
    const record = parse(text);
    assert.equal(record.type, 'Diş', text);
    assert.equal(generated(record), expected, text);
    assert.equal(generated({ ...record, callout: { ...record.callout, depth: '12' } }), expected + ' x 12 DEEP', text + ' depth');
  }
  for (const record of [
    { nominalValue: '1', unit: 'in', threadPitch: '20 TPI' },
    { nominalValue: '10', callout: { threadForm: 'UNC' } },
    { nominalValue: '10', callout: { threadForm: 'Tr' }, threadPitch: '' },
    { nominalValue: '10', threadPitch: '0' },
    { nominalValue: '10', threadPitch: 'l.25' },
  ]) assert.equal(generated({ type: 'Diş', ...record, requirement: 'M8' }), '', 'Incomplete or invalid thread never becomes fabricated M size');
});

test('R without explicit pipe evidence remains radius; fractional pipe markers remain threads', () => {
  for (const text of ['R5', 'R12.5', 'R 12.5', 'R1', 'R 3.2', 'R 1 2 . 5', '2 x R5']) {
    const result = parse(text);
    assert.equal(result.type, 'Yarıçap', text);
    assert.equal(result.threadStandard || '', '', text);
  }
  for (const text of ['R1/8', 'R 1 1/4', 'Rc1', 'Rp1/8', 'G1', 'R1 LH']) assert.equal(parse(text).type, 'Diş', text);
  assert.equal(parse('Rp 1 µm').type, 'Yüzey', 'Explicit roughness unit retains the surface parameter');
});

test('Type changes remove stale families without re-reading or changing original OCR', () => {
  const dirty = {
    type: 'Diş', nominalValue: '12', lowerTolerance: '-.1', upperTolerance: '.2', lowerLimit: '11.9', upperLimit: '12.2',
    threadPitch: '1.25', threadClass: '6H', threadStandard: 'ISO 261 / ISO 965-1', fitClass: 'H7',
    specialDesignator: 'Ra', surfaceTexture: { parameter: 'Ra' }, chamferAngle: '45', angleFormat: 'dms',
    gdtSubtype: 'position', gdtFrame: { symbol: '⌖' }, datumRefs: 'A | B', cells: ['⌖'],
    requirement: 'M12 × 1.25-6H', requirementMode: 'auto', ocrText: 'M12x1.25-6H',
    callout: { threadForm: 'M', threadHand: 'LH', depth: '10', countersinkAngle: '90', basic: true },
  };
  const radius = api.transitionType(dirty, 'Yarıçap');
  assert.equal(radius.nominalValue, '12');
  for (const key of ['threadPitch', 'threadClass', 'threadStandard', 'fitClass', 'specialDesignator', 'datumRefs', 'chamferAngle', 'upperTolerance', 'lowerLimit']) assert.equal(radius[key], '', key);
  assert.equal(radius.gdtFrame, null);
  assert.equal(radius.callout.threadForm, undefined);
  assert.equal(radius.callout.depth, undefined);
  assert.equal(generated(radius), '[ R12 ]');
  assert.equal(radius.ocrText, dirty.ocrText);
  assert.equal(dirty.threadClass, '6H', 'Pure transition must not mutate original');
  assert.equal(dirty.callout.threadForm, 'M');
  const converted = api.transitionType({ type: 'Çap', nominalValue: '12', lowerTolerance: '-.1', upperTolerance: '.1' }, 'Yarıçap');
  assert.equal(generated(converted), 'R12 ±0.1', 'Compatible size deviations survive');
  assert.equal(api.transitionType({ type: 'GD&T', upperTolerance: '.1' }, 'Uzunluk').upperTolerance, '');
  assert.equal(api.transitionType({ type: 'Çap', nominalValue: '10' }, 'GD&T').nominalValue, '');
  assert.equal(api.transitionType({ type: 'Not', nominalValue: '99' }, 'Uzunluk').nominalValue, '');
});

test('Type-specific requirement generation ignores incompatible metadata even in legacy records', () => {
  const stale = { fitClass: 'H7', callout: { spherical: true, threadForm: 'M', depth: '10', holeForm: 'counterbore', basic: true } };
  assert.equal(generated({ ...stale, type: 'Açı', nominalValue: '30' }), '[ 30° ]');
  assert.equal(generated({ ...stale, type: 'Yüzey', nominalValue: '1.6', unit: 'µm', specialDesignator: 'Ra' }), 'Ra 1.6 µm');
  assert.equal(generated({ ...stale, type: 'Datum', datumRefs: 'A' }), 'Datum A');
});

test('Corrected free text becomes the automatic requirement for every nonnumeric family', () => {
  for (const type of ['Not', 'Malzeme', 'Proses', 'Görsel', 'Diğer']) {
    const record = { type, requirement: 'Eski metin', ocrText: '  Yeni koşul  ', requirementMode: 'auto' };
    assert.equal(api.syncRequirement(record).requirement, 'Yeni koşul', type);
    const manual = { ...record, requirementMode: 'manual', manualFields: ['requirement'], requirement: 'Elle onaylı ifade' };
    assert.equal(api.syncRequirement(manual).requirement, 'Elle onaylı ifade');
    assert.equal(generated(manual), 'Yeni koşul');
  }
});

test('Explicit structured edits clear an incomplete numeric requirement but ordinary loading preserves source', () => {
  const record = { type: 'Çap', nominalValue: '', requirementMode: 'auto', requirement: 'Ø50', ocrText: 'Ø50' };
  assert.equal(api.syncRequirement(record).requirement, 'Ø50');
  assert.equal(api.syncRequirement(record, true).requirement, '');
  assert.equal(api.syncRequirement(record, false, { clearIncomplete: true }).requirement, '');
  const manual = { ...record, requirementMode: 'manual', manualFields: ['requirement'] };
  assert.equal(api.syncRequirement(manual, false, { clearIncomplete: true }).requirement, 'Ø50');
});

test('Small deviations remain nonzero and unequal deviations never display as symmetric', () => {
  const record = { type: 'Uzunluk', nominalValue: '1', lowerTolerance: '-0.0000000001', upperTolerance: '0.0000000002' };
  assert.equal(generated(record), '1 (+0.0000000002/-0.0000000001)');
  assert.equal(generated({ ...record, upperTolerance: '.0000000001' }), '1 ±0.0000000001');
  assert.equal(api.displayNumber('.0000000000001', { decimalPlaces: 3 }), '0.0000000000001');
});

test('Limit dimensions keep authoritative bounds while midpoint is refreshed after edits', () => {
  const record = { ...parse('0.596 MAX 0.586 MIN'), upperLimit: '.598' };
  const updated = api.syncRequirement(record, true);
  assert.equal(updated.nominalValue, '.592'.replace(/^\./, '0.'));
  assert.equal(updated.requirement, '0.586–0.598');
  assert.equal(generated({ type: 'Açı', lowerLimit: '89', upperLimit: '90', limitDimension: true }), '89.0–90.0°');
});
