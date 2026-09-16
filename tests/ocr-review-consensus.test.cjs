const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadEnhancement() {
  const head = { append() {} };
  const document = {
    head,
    body: {},
    createElement() { return { style: {}, append() {}, replaceChildren() {} }; },
    getElementById() { return null; },
    querySelector() { return null; },
  };
  const context = { console, document, MutationObserver: class { observe() {} disconnect() {} } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/requirements-engine.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('src/ocr-image-enhancement.js', 'utf8'), context);
  return context.ASMachOcrEnhancement;
}

test('equivalent OCR readings do not create a false review warning', () => {
  const enhancement = loadEnhancement();
  const best = { text: 'Ø13', confidence: 92 };
  const candidates = [best, { text: 'Ø 13', confidence: 86 }, { text: 'Ø13 ', confidence: 80 }, { text: 'Ø18', confidence: 70 }];
  assert.equal(enhancement.agrees(candidates, best), true);
  assert.equal(enhancement.compare(candidates, best), false);
});

test('repeated conflicting OCR readings still require review', () => {
  const enhancement = loadEnhancement();
  const best = { text: 'Ø13', confidence: 88 };
  const candidates = [best, { text: 'Ø18', confidence: 87 }, { text: 'Ø 18', confidence: 84 }];
  assert.equal(enhancement.compare(candidates, best), true);
});

test('diameter and fit readings do not disagree only because Ø was omitted', () => {
  const enhancement = loadEnhancement();
  const best = { text: 'Ø84 h6', confidence: 92 };
  const candidates = [best, { text: '84 h6', confidence: 89 }, { text: '84 h6 ', confidence: 86 }];
  assert.equal(enhancement.agrees(candidates, best), true);
  assert.equal(enhancement.compare(candidates, best), false);
  const different = [best, { text: 'Ø34 h6', confidence: 90 }, { text: 'Ø34 h6 ', confidence: 88 }];
  assert.equal(enhancement.compare(different, best), true);
});

test('new OCR reviews inherit the project general tolerance', () => {
  const source = fs.readFileSync('src/app.template.html', 'utf8');
  assert.match(source, /const projectTolerance=state\.generalTolerance\?\.standard\|\|'';/);
  assert.match(source, /elements\.ocrGeneralTolerance\.value=projectTolerance;/);
});
