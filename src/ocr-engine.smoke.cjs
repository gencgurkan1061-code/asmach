"use strict";
// Executes the actual browser bundles without browser automation or network access.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { Worker, isMainThread, parentPort, workerData } = require("node:worker_threads");

if (!isMainThread) {
  const sources = workerData.sources;
  const eventHandlers = [];
  let context;
  const world = {
    console, WebAssembly, TextDecoder, TextEncoder, URL, Uint8Array, Uint8ClampedArray,
    Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array,
    BigInt64Array, BigUint64Array, ArrayBuffer, SharedArrayBuffer, DataView,
    setTimeout, clearTimeout, setInterval, clearInterval, atob, btoa, Blob, Response,
    performance, navigator: { hardwareConcurrency: 2, userAgent: "ASMach offline test" },
    WorkerGlobalScope: function WorkerGlobalScope() {},
    location: { href: workerData.url },
    fetch: async input => {
      const url = typeof input === "string" ? input : input.url;
      if (!(url in sources)) throw new Error("Network forbidden in OCR smoke test: " + url);
      return new Response(sources[url]);
    },
    importScripts: (...urls) => {
      for (const url of urls) {
        const key = String(url).split("#")[0];
        if (!(key in sources)) throw new Error("Unknown embedded script: " + url);
        vm.runInContext(new TextDecoder().decode(sources[key]), context, { filename: url });
      }
    },
    postMessage: value => parentPort.postMessage(value),
    addEventListener: (type, handler) => { if (type === "message") eventHandlers.push(handler); },
    close: () => process.exit(0)
  };
  world.self = world;
  context = vm.createContext(world);
  vm.runInContext(new TextDecoder().decode(sources[workerData.url]), context, { filename: "embedded-ocr-worker.js" });
  parentPort.on("message", data => {
    const event = { data };
    for (const handler of eventHandlers) handler(event);
    if (typeof world.onmessage === "function") world.onmessage(event);
  });
} else {
  const canvasModule = process.env.ASMACH_CANVAS_MODULE || "C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas";
  const { createCanvas, CanvasElement, Image, loadImage } = require(canvasModule);
  Image.prototype.decode=async function(){if(this.complete)return;await new Promise((resolve,reject)=>{this.onload=resolve;this.onerror=reject;});};
  const blobMap = new Map();
  let nextBlobId = 0;
  let context;
  class OfflineURL extends URL {}
  OfflineURL.createObjectURL = blob => {
    const url = "blob:asmach-offline-test/" + (++nextBlobId);
    blobMap.set(url, blob);
    return url;
  };
  OfflineURL.revokeObjectURL = url => blobMap.delete(url);
  class BrowserWorker {
    constructor(url) {
      this.ended = false;
      this.ready = (async () => {
        const sources = {};
        for (const [key, blob] of blobMap) sources[key] = new Uint8Array(await blob.arrayBuffer());
        this.thread = new Worker(__filename, { workerData: { url, sources } });
        this.thread.on("message", data => {
          if (process.env.ASMACH_OCR_DEBUG && data.action === "recognize" && data.data && data.data.text) console.log("PASS", data.data.confidence, JSON.stringify(data.data.text));
          if (this.onmessage) this.onmessage({ data });
        });
        this.thread.on("error", error => { if (this.onerror) this.onerror(error); else console.error(error); });
        if (this.ended) await this.thread.terminate();
        return this.thread;
      })();
    }
    postMessage(message) { this.ready.then(thread => { if (!this.ended) thread.postMessage(message); }); }
    terminate() { this.ended = true; return this.ready.then(thread => thread.terminate()); }
  }
  class FileReader {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then(data => { this.result = data; if (this.onload) this.onload(); }, error => this.onerror && this.onerror({ target: { error } })); }
  }
  const world = {
    console, TextDecoder, TextEncoder, Uint8Array, Uint32Array, ArrayBuffer, WebAssembly,
    setTimeout, clearTimeout, setInterval, clearInterval, atob, btoa, Blob, File, FileReader,
    URL: OfflineURL, Worker: BrowserWorker, Image, HTMLElement: CanvasElement,
    location: { href: "file:///C:/ASMach_Teknik_Resim_Balonlama.html", protocol: "file:" },
    navigator: { hardwareConcurrency: 2 },
    document: {
      createElement: tag => {
        if (tag === "canvas") { const canvas = createCanvas(1, 1); canvas.tagName = "CANVAS"; return canvas; }
        if (tag === "script") return {};
        throw new Error("Unexpected test DOM element: " + tag);
      },
      head: { appendChild: script => {
        blobMap.get(script.src).text().then(source => {
          vm.runInContext(source, context, { filename: "embedded-tesseract-library.js" });
          script.onload();
        }).catch(error => { console.error(error); script.onerror(); });
      } }
    }
  };
  world.window = world;
  world.self = world;
  const ocrRoot = path.join(__dirname, "..", "ocr");
  const readAsset = relative => fs.readFileSync(path.join(ocrRoot, relative)).toString("base64");
  world.ASMachOcrAssets = {
    library: readAsset("tesseract.min.js"), worker: readAsset("worker.min.js"),
    core: readAsset("core/tesseract-core-lstm.wasm.js"),
    eng: readAsset("lang/eng.traineddata.gz"), tur: readAsset("lang/tur.traineddata.gz")
  };
  context = vm.createContext(world);
  let engineSource = fs.readFileSync(path.join(__dirname, "ocr-engine.js"), "utf8");
  if (process.env.ASMACH_OCR_PSM) engineSource = engineSource.replace('wholePage ? "11"', 'wholePage ? "' + Number(process.env.ASMACH_OCR_PSM) + '"');
  vm.runInContext(engineSource, context);
  context.window = context;
  for (const module of ["requirements-engine.js", "measurement-layout.js", "snapshot-tools.js", "gdt-vision.js", "diameter-vision.js", "automatic-symbols.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname,module),"utf8"),context);

  async function main() {
    const fixture = createCanvas(780, 160);
    const drawing = fixture.getContext("2d");
    drawing.fillStyle = "white"; drawing.fillRect(0, 0, 780, 160);
    drawing.fillStyle = "black"; drawing.font = "64px Arial";
    drawing.fillText("25 ±0.10", 80, 106);
    const statuses = new Set();
    const result = await world.ASMachOCR.recognize(fixture.toDataURL("image/png"), {
      onProgress: event => {
        if (!statuses.has(event.status)) { statuses.add(event.status); console.log(event.status); }
      }
    });
    console.log("Horizontal OCR:", result.text, result.confidence);
    assert.ok(!result.error, result.error);
    assert.match(result.text, /25/);
    assert.match(result.text, /±/);
    assert.match(result.text, /0\.10/);
    assert.ok(result.words.length >= 1);
    assert.ok(result.words.every(word => word.x >= 0 && word.y >= 0 && word.x + word.w <= 1.00001 && word.y + word.h <= 1.00001));

    const vertical = createCanvas(160, 780);
    const vctx = vertical.getContext("2d");
    vctx.translate(160, 0); vctx.rotate(Math.PI / 2); vctx.drawImage(fixture, 0, 0);
    const rotated = await world.ASMachOCR.recognize(vertical.toDataURL("image/png"));
    console.log("Vertical OCR:", rotated.text, rotated.confidence, rotated.angle);
    assert.ok(!rotated.error, rotated.error);
    assert.match(rotated.text, /25/);
    assert.match(rotated.text, /0\.10/);
    assert.equal(rotated.angle, 270);
    assert.ok(rotated.words.some(word => word.h * 780 > word.w * 160));

    const page = createCanvas(1200, 900);
    const pctx = page.getContext("2d");
    pctx.fillStyle = "white"; pctx.fillRect(0, 0, 1200, 900);
    pctx.fillStyle = "black"; pctx.font = "48px Arial";
    pctx.fillText("25 ±0.10", 100, 130);
    pctx.fillText("M6x1-6H", 400, 680);
    pctx.save(); pctx.translate(1050, 180); pctx.rotate(Math.PI / 2); pctx.fillText("R12.5", 0, 0); pctx.restore();
    const detection = await world.ASMachOCR.detect(page.toDataURL("image/png"));
    console.log("Page OCR:", detection.text);
    assert.ok(!detection.error, detection.error);
    assert.ok(detection.words.some(word => /25/.test(word.text)));
    assert.ok(detection.lines.some(line => /25\s*±\s*0\.10/.test(line.text)), "Sparse text must not consume the tolerance sign");
    assert.ok(detection.words.some(word => /R12/.test(word.text)));
    assert.ok(detection.words.some(word => /6H|M6/.test(word.text)));
    const fastProgress=[];
    const fast=await world.ASMachOCR.detect(page.toDataURL('image/png'),{angles:[0,90,270],detailed:false,recoverTolerance:true,onProgress:e=>fastProgress.push(e)});
    assert.ok(!fast.error,fast.error);assert.ok(fast.words.some(w=>/25/.test(w.text)));assert.ok(fast.evidenceWords.length>=fast.words.length);
    for(let i=1;i<fastProgress.length;i++)assert.ok(fastProgress[i].progress>=fastProgress[i-1].progress-1e-8,'Progress must not restart for every direction');
    assert.equal(fastProgress.at(-1).progress,1);assert.ok(fastProgress.some(p=>p.detail.includes('Yön 3/3')));
    assert.ok(fast.lines.some(w=>/25\s*±\s*0\.10/.test(w.text)),'Fast scan must retain tolerance signs, not turn 25 ±0.10 into 250.10');

    let rendered;
    const pdfDoc = { getPage: async () => ({
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
      render: options => { rendered = options; return { promise: Promise.resolve() }; }
    }) };
    const capture = await world.ASMachOCR.capture({ pdfDoc, page: 1, box: { x: 0.2, y: 0.25, w: 0.3, h: 0.1 }, dpi: 360 });
    assert.match(capture, /^data:image\/png;base64,/);
    assert.equal(rendered.viewport.width, 3000);
    assert.equal(rendered.transform[4], 24 - 600);
    assert.equal(rendered.transform[5], 24 - 1000);
    const gdtExample='C:/Users/gencg/AppData/Local/Temp/codex-clipboard-a2a60980-941f-4f31-8bf2-1cc6132b1774.png';
    if(fs.existsSync(gdtExample)){
      const image=await loadImage(gdtExample),frame=createCanvas(230,80);frame.getContext('2d').drawImage(image,65,417,230,80,0,0,230,80);
      const read=await world.ASMachGdtVision.recognize(frame.toDataURL(),(cell,options)=>world.ASMachOCR.recognize(cell,options));
      console.log('GD&T cell OCR:',read?.text);assert.equal(read?.text,'⌭ | 0.05');
      const parsed=world.ASMachRequirements.parse(read.text);assert.equal(parsed.type,'GD&T');assert.equal(parsed.upperTolerance,'0.05');assert.equal(parsed.lowerTolerance,'0');
    }
    const datumExample='C:/Users/gencg/AppData/Local/Temp/codex-clipboard-a1fc2d47-57b6-40b6-a67b-4c56d89c89d8.png';
    if(fs.existsSync(datumExample)){
      // Same concentricity / ±0.1 / A example, before UI handles obscure its borders.
      const image=await loadImage(datumExample),frame=createCanvas(235,65);frame.getContext('2d').drawImage(image,80,340,235,65,0,0,235,65);
      const read=await world.ASMachGdtVision.recognize(frame.toDataURL(),async (cell,options)=>{const r=await world.ASMachOCR.recognize(cell,options);console.log('Datum fixture cell:',r.text);return r;});
      console.log('GD&T datum frame:',read?.text);
      const parsed=world.ASMachRequirements.parse(read?.text||'');assert.equal(parsed.gdtSubtype,'concentricity');assert.equal(parsed.upperTolerance,'0.1');assert.equal(parsed.datumRefs,'A');
    }
    const automaticExample='C:/Users/gencg/AppData/Local/Temp/codex-clipboard-e2605476-9430-4b45-a950-6f6f76a6e55c.png';
    if(fs.existsSync(automaticExample)){
      const image=await loadImage(automaticExample),page=createCanvas(image.width*3,image.height*3);page.getContext('2d').drawImage(image,0,0,page.width,page.height);
      const frames=await world.ASMachAutomaticSymbols.enrich(page,[],{read:(cell,options)=>world.ASMachOCR.recognize(cell,options)});
      console.log('Automatic graphical GD&T:',frames.map(f=>f.text));
      assert.equal(frames.length,1,'Dimension boxes must not become GD&T frames');const parsed=world.ASMachRequirements.parse(frames[0].text);assert.equal(parsed.gdtSubtype,'concentricity');assert.equal(parsed.upperTolerance,'0.1');assert.equal(parsed.datumRefs,'A');
    }
    await world.ASMachOCR.terminate();
    console.log("Offline OCR smoke passed: real browser bundles, no network, horizontal/vertical measurements, whole-page detection, high-DPI PDF crop.");
  }
  main().catch(async error => {
    console.error(error);
    await world.ASMachOCR.terminate();
    process.exitCode = 1;
  });
}
