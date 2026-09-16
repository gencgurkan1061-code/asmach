'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load() {
  // Test-only access to existing private helpers; production exports stay small.
  const source = fs.readFileSync('src/ocr-engine.js', 'utf8').replace('_test: Object.freeze({', '_test: Object.freeze({readCanvas, rawCacheKey, setMetrics:value=>readMetrics=value, setSource:(image,source)=>imageSources.set(image,source),');
  const context = vm.createContext({ Uint8Array, Uint32Array, ArrayBuffer, setTimeout, clearTimeout, atob });
  vm.runInContext(source, context);
  return context.ASMachOCR._test;
}

test('fresh read uses the same image identity and replaces a previous empty cached result', async () => {
  const api = load(), image = {}, settings = [0, false, '6', 'off'];
  api.setSource(image, 'data:image/png;base64,test-immutable-image');
  api.setMetrics({ forceFresh: false, enginePasses: 0, cacheHits: 0 });
  const key = api.rawCacheKey(image, settings);
  api.rememberRaw(key, { text: '', confidence: 0, blocks: [] });
  let calls = 0;
  const worker = { recognize: async () => { calls++; return { data: { text: '25.4', confidence: 97, words: [{ text: '25.4', bbox: { x0: 10, y0: 10, x1: 90, y1: 50 } }] } }; } };
  const before = await api.readCanvas(worker, {}, 'test', key);
  assert.equal(before.text, '');
  assert.equal(calls, 0);

  const freshMetrics = { forceFresh: true, enginePasses: 0, cacheHits: 0 };
  api.setMetrics(freshMetrics);
  assert.equal(api.rawCacheKey(image, settings), key, 'Forced read must retain replacement identity');
  const fresh = await api.readCanvas(worker, {}, 'test', key);
  assert.equal(fresh.text, '25.4');
  assert.equal(calls, 1);
  assert.equal(freshMetrics.cacheHits, 0);
  assert.equal(freshMetrics.enginePasses, 1);
  fresh.words[0].text = 'consumer mutation';

  const normalMetrics = { forceFresh: false, enginePasses: 0, cacheHits: 0 };
  api.setMetrics(normalMetrics);
  const normal = await api.readCanvas(worker, {}, 'test', key);
  assert.equal(normal.text, '25.4');
  assert.equal(normal.words[0].text, '25.4', 'Cached flat word output must be cloned, too');
  assert.equal(calls, 1);
  assert.equal(normalMetrics.cacheHits, 1);
  assert.equal(normalMetrics.enginePasses, 0);
});

test('worker failure never installs a new failed entry in the raw cache', async () => {
  const api = load();
  api.setMetrics({ forceFresh: true, enginePasses: 0, cacheHits: 0 });
  const worker = { recognize: async () => { throw new Error('Synthetic worker failure'); } };
  await assert.rejects(api.readCanvas(worker, {}, 'test', 'failed-new-key'), /Synthetic worker failure/);
  assert.equal(api.cachedRaw('failed-new-key'), null);
});
