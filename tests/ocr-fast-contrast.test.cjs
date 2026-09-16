'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Pixel-component tests, not an OCR accuracy claim. Load the production pure
// geometry helper without mounting the enhancement panel or starting a worker.
const engineSource = fs.readFileSync('src/ocr-engine.js', 'utf8');
const enhancementSource = fs.readFileSync('src/ocr-image-enhancement.js', 'utf8');
const context = vm.createContext({ Uint8Array, Uint32Array, ArrayBuffer, setTimeout, clearTimeout, atob });
vm.runInContext(engineSource, context);
vm.runInContext(enhancementSource.slice(enhancementSource.indexOf(' function measurementInkRows('), enhancementSource.indexOf(' function measurementRegions(')), context);
const geometry = context.ASMachOCR._test.plainNumericGeometry;

function fixture() {
  const width = 240, height = 100;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  function rect(x, y, w, h, gray = 0) {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
      const offset = (row * width + col) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = gray;
    }
  }
  // The three digit bodies and baseline decimal of a hypothetical "25.4".
  rect(20, 20, 20, 40); rect(44, 20, 20, 40); rect(68, 55, 5, 5); rect(77, 20, 20, 40);
  const canvas = { width, height, getContext: () => ({ getImageData: () => ({ data: pixels }) }) };
  const rows = threshold => context.measurementInkRows(canvas, threshold);
  const fast = () => geometry({ text: '25.4', confidence: 98 }, rows()) && geometry({ text: '25.4', confidence: 98 }, rows(245));
  return { rect, rows, fast };
}

test('clean dark digits remain eligible at both contrast thresholds', () => {
  const image = fixture();
  assert.equal(image.rows().length, 1);
  assert.equal(image.rows()[0].parts.length, 4);
  assert.equal(image.rows(245)[0].parts.length, 4);
  assert.equal(image.fast(), true);
});

test('a faint tolerance cannot be hidden behind two agreeing dark-nominal reads', () => {
  for (const gray of [185, 205, 225, 240]) {
    const image = fixture();
    // Faint plus/minus and tolerance glyph bodies outside the dark nominal.
    image.rect(107, 30, 18, 3, gray); image.rect(114, 23, 3, 16, gray); image.rect(107, 44, 18, 3, gray);
    image.rect(130, 20, 10, 20, gray); image.rect(144, 37, 3, 3, gray); image.rect(151, 20, 10, 20, gray);
    assert.equal(geometry({ text: '25.4', confidence: 98 }, image.rows()), true, 'Old dark-only proof overlooks pale ink at ' + gray);
    assert.equal(image.fast(), false, 'Pale tolerance must trigger recovery at ' + gray);
  }
});

test('a faint leading minus or detached decimal blocks early success', () => {
  for (const mark of ['minus', 'dot']) {
    const image = fixture();
    if (mark === 'minus') image.rect(3, 37, 12, 3, 220);
    else image.rect(102, 55, 4, 4, 220);
    assert.equal(geometry({ text: '25.4', confidence: 98 }, image.rows()), true);
    assert.equal(image.fast(), false, mark);
  }
});

test('production fast gate invokes both thresholds before the second OCR read', () => {
  const start = engineSource.indexOf('const proof=prepare(');
  const gate = engineSource.slice(start, engineSource.indexOf('if(eligible)', start));
  assert.match(gate, /plainNumericGeometry\(result,root\.ASMachOcrEnhancement\.measurementInkRows\(proof\.canvas\)\)/);
  assert.match(gate, /&&plainNumericGeometry\(result,root\.ASMachOcrEnhancement\.measurementInkRows\(proof\.canvas,245\)\)/);
});
