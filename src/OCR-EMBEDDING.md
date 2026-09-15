# Offline OCR embedding

The delivered artifact needs only one HTML file. No server, CDN, worker folder, or online recognition API is used at runtime.

Before `ocr-engine.js`, embed a registry:

```js
window.ASMachOcrAssets = {
  library: "BASE64_OF_ocr/tesseract.min.js",
  worker: "BASE64_OF_ocr/worker.min.js",
  core: "BASE64_OF_ocr/core/tesseract-core-lstm.wasm.js",
  eng: "BASE64_OF_ocr/lang/eng.traineddata.gz",
  tur: "BASE64_OF_ocr/lang/tur.traineddata.gz",
  deu: "BASE64_OF_ocr/lang/deu.traineddata.gz"
};
```

Each value must be the base64 of the exact bytes on disk. An object `{base64: "..."}` is also accepted. If Tesseract is already included as an inline script, `library` may be omitted. The portable LSTM core embeds its own WebAssembly and works without SIMD; the two SIMD assets are not needed. Preserve third-party license notices when bundling.

The controller creates a worker from its embedded JavaScript, imports the embedded core from a Blob URL, and routes language fetches to embedded gzip Blob URLs. The `https://asmach-offline.invalid/ocr` language path is a lookup key inside that worker and is never requested from the network. Unmapped non-Blob/data fetches fail closed. Using normal `eng+tur` language names avoids the language-object initialization mismatch present in Tesseract 7's worker implementation.

## API

```js
await ASMachOCR.recognize(snapshotDataUrl, { onProgress, forceAll: false });
// {text, confidence, source, angle, words, lines, alternatives, error?}

await ASMachOCR.detect(pageSnapshotDataUrl, { onProgress });
// {text, confidence, source, words, lines, error?}

await ASMachOCR.capture({pdfDoc, page: 1, canvas, box: {x,y,w,h}, dpi: 360});
// PNG data URL; uses a direct PDF render for high-resolution selected text.

await ASMachOCR.terminate();
```

`onProgress` receives `{status, progress, detail}`, with `progress` in [0,1]. Each OCR pass reports its own progress. `words` and `lines` contain `{text, confidence, x, y, w, h, angle, lineId?}`. Coordinates refer to the **original input snapshot**, normalized to [0,1], even when recognition rotates or rescales it. A crop snapshot contains 24 pixels of white padding; whole-page capture does not. Map whole-page candidates directly to drawing coordinates. Recognition requests are queued so the singleton engine cannot receive competing parameter changes.

Selected-area OCR tries rotated gray images and, if needed, an Otsu binary image. Whole-page detection uses sparse-text segmentation in all four right-angle directions and merges overlapping results. Every automatic candidate still requires user review: OCR confidence is not measurement conformance.

## Validation

The worker now initializes `eng+tur+deu` together. German uses the Apache-2.0
Tesseract `tessdata_fast` model from https://github.com/tesseract-ocr/tessdata_fast.
Bundled gzip SHA-256: `f5bb2017edf9026b96f6eaf19520051bdd7527041b5cde7744c82c43b31dd13e`.
No recognition data leaves the device. Low-confidence prose receives a binary
retry; wide single-line images also receive raw-line segmentation, without
technical-number scoring. Technical crops retain block parsing for stacked
tolerances and use the raw-line fallback only on wide, low-confidence crops.
`node scripts/check-multilingual-ocr.cjs` runs nine real OCR fixtures across
Turkish, German and English with Arial, Times New Roman and Courier New,
including accented characters and blocked network requests. These synthetic
fixtures are regression checks, not a guarantee for every font or scan quality.

`node src/ocr-engine.test.cjs` verifies normalization, candidate ranking, four-direction coordinate inversion, duplicate suppression, thresholding and embedded worker language routing. `node src/ocr-engine.smoke.cjs` additionally executes the actual browser Tesseract bundle in worker-thread-backed VM contexts with network blocked and local raster fixtures (requires the optional native canvas runtime supplied by `ASMACH_CANVAS_MODULE`). This test does not automate or operate a browser.
