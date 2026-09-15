"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "ocr-engine.js"), "utf8");
const context = vm.createContext({ atob, Uint8Array, Uint32Array, ArrayBuffer, setTimeout, clearTimeout });
vm.runInContext(source, context);
const api = context.ASMachOCR._test;
assert.equal(api.normalize("Φ25,5 −0,1\n+0,2"), "Ø25.5 -0.1\n+0.2");
assert.ok(api.candidateScore({ text: "25 ±0.1", confidence: 85 }) > api.candidateScore({ text: "Z5 O.l", confidence: 90 }));
assert.ok(api.candidateScore({ text: "M6x1-6H", confidence: 85 }) > api.candidateScore({ text: "MEXI GH", confidence: 80 }));
assert.ok(api.candidateScore({ text: "", confidence: 100 }) < 0);
assert.deepEqual(Array.from(api.bytesFromBase64("YWJj")), [97, 98, 99]);

const target = { x: 0.2, y: 0.3, w: 0.25, h: 0.2 };
for (const angle of [0, 90, 180, 270]) {
  const W = 400, H = 240, pad = 28;
  const forward = (x, y) => {
    x *= W; y *= H;
    if (angle === 90) return [pad + H - y, pad + x];
    if (angle === 180) return [pad + W - x, pad + H - y];
    if (angle === 270) return [pad + y, pad + W - x];
    return [pad + x, pad + y];
  };
  const points = [forward(target.x, target.y), forward(target.x + target.w, target.y + target.h)];
  const bbox = { x0: Math.min(...points.map(p => p[0])), y0: Math.min(...points.map(p => p[1])), x1: Math.max(...points.map(p => p[0])), y1: Math.max(...points.map(p => p[1])) };
  const result = api.originalBox(bbox, { angle, pad, scaledWidth: W, scaledHeight: H });
  for (const key of Object.keys(target)) assert.ok(Math.abs(result[key] - target[key]) < 0.000001, `${angle}° ${key} coordinate incorrect`);
}
const regions = api.mergeRegions([
  { text: "25", confidence: 92, x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
  { text: "25", confidence: 52, x: 0.101, y: 0.1, w: 0.1, h: 0.1 },
  { text: "25", confidence: 91, x: 0.6, y: 0.6, w: 0.1, h: 0.1 }
]);
assert.equal(regions.length, 2, "Distinct locations must survive while repeated orientation results merge");
const histogram = new Uint32Array(256);
histogram[20] = 100;
histogram[245] = 900;
const threshold = api.otsuThreshold(histogram, 1000);
assert.ok(threshold > 20 && threshold < 245);

async function routingTest() {
  const calls = [];
  const worker = { fetch: async url => { calls.push(url); return { ok: true }; }, postMessage() {}, close() {}, addEventListener() {} };
  const workerContext = vm.createContext({ self: worker, setTimeout: () => 1, clearTimeout() {}, Error });
  vm.runInContext(api.bootstrapSource({ eng: "blob:language-eng", tur: "blob:language-tur", deu: "blob:language-deu" }), workerContext);
  await worker.fetch("https://asmach-offline.invalid/ocr/eng.traineddata.gz");
  await worker.fetch("https://asmach-offline.invalid/ocr/tur.traineddata.gz");
  await worker.fetch("https://asmach-offline.invalid/ocr/deu.traineddata.gz");
  await assert.rejects(() => worker.fetch("https://example.com/unexpected"), /paketinde/);
  assert.deepEqual(calls, ["blob:language-eng", "blob:language-tur", "blob:language-deu"]);
  console.log("OCR unit checks passed: technical ranking, coordinate mapping, deduplication, thresholding, offline routing.");
}
routingTest().catch(error => { console.error(error); process.exitCode = 1; });
