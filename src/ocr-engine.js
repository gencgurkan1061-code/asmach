/* ASMach offline OCR. Tesseract.js 7.0.0; embedded assets are supplied by the HTML bundler. */
(function (root) {
  "use strict";

  const MAX_JOB_MS = 120000;
  let worker = null;
  let workerPromise = null;
  let progressHandler = null;
  let progressRange = null;
  let queue = Promise.resolve();
  let assetUrls = [];
  let libraryPromise = null;
  const pendingDeadlines = new Set();

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const messageOf = error => String(error && error.message || error || "Metin algılanamadı.");
  const normalize = text => String(text || "")
    .replace(/[\u2212\u2012\u2013\u2014]/g, "-").replace(/[∅Φφ⌀øФфϕ]/g, "Ø")
    .replace(/(\d),(?=\d)/g, "$1.")
    .replace(/(^|\d\s*)[£土士]\s*(?=\d)/g, "$1±")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  function emit(status, progress, detail) {
    if (typeof progressHandler === "function") {
      const local=clamp(Number(progress)||0,0,1),value=progressRange?progressRange.start+local*progressRange.span:local;
      try { progressHandler({ status, progress:value, detail: progressRange?.detail ? `${progressRange.detail} · ${detail||status}` : detail || status }); } catch (_) {}
    }
  }

  function bytesFromBase64(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (value && typeof value === "object") value = value.base64;
    if (typeof value !== "string" || !value) throw new Error("Gömülü OCR dosyası eksik. Tek dosya HTML paketini yeniden oluşturun.");
    const binary = root.atob(value.replace(/^data:[^,]*,/, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function makeUrl(content, type) {
    const url = root.URL.createObjectURL(new root.Blob([content], { type }));
    assetUrls.push(url);
    return url;
  }

  function bootstrapSource(languageUrls) {
    // The language paths are only local lookup keys. Unmapped fetches fail instead of using a network.
    return `"use strict";\nconst __asmachLanguageUrls=${JSON.stringify(languageUrls)};\n` +
      `const __asmachFetch=self.fetch.bind(self);\n` +
      `self.fetch=function(input,options){const url=typeof input==='string'?input:input.url;` +
      `const match=/\\/(eng|tur|deu)\\.traineddata(?:\\.gz)?(?:[?#].*)?$/.exec(url);` +
      `if(match&&__asmachLanguageUrls[match[1]]){const value=__asmachLanguageUrls[match[1]];if(!/^blob:|^data:/.test(value)){const binary=atob(value);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return Promise.resolve(new Response(bytes));}return __asmachFetch(value,options);}` +
      `if(/^blob:|^data:/.test(url))return __asmachFetch(input,options);` +
      `return Promise.reject(new Error('OCR çevrimdışı paketinde bulunmayan dosya: '+url));};\n` +
      // A failed initialization cannot retain an inaccessible worker forever.
      `let __asmachWatchdog=setTimeout(()=>self.close(),${MAX_JOB_MS + 10000});\n` +
      `const __asmachPostMessage=self.postMessage.bind(self);self.postMessage=function(data,...rest){if(data&&(data.status==='resolve'||data.status==='reject'))clearTimeout(__asmachWatchdog);return __asmachPostMessage(data,...rest);};\n` +
      `self.addEventListener('message',()=>{clearTimeout(__asmachWatchdog);__asmachWatchdog=setTimeout(()=>self.close(),${MAX_JOB_MS + 10000});});\n`;
  }

  async function ensureLibrary() {
    if (root.Tesseract && root.Tesseract.createWorker) return root.Tesseract;
    if (!libraryPromise) {
      libraryPromise = new Promise((resolve, reject) => {
        const assets = root.ASMachOcrAssets || {};
        const script = root.document.createElement("script");
        script.src = makeUrl(bytesFromBase64(assets.library), "text/javascript");
        script.onload = () => root.Tesseract ? resolve(root.Tesseract) : reject(new Error("OCR motoru başlatılamadı."));
        script.onerror = () => reject(new Error("Gömülü OCR motoru yüklenemedi."));
        root.document.head.appendChild(script);
      }).catch(error => { libraryPromise = null; throw error; });
    }
    return libraryPromise;
  }

  function deadline(promise, milliseconds, detail) {
    let timer;
    let cancel;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        cancel = () => reject(new Error("OCR iptal edildi. Metni elle girebilir veya tekrar deneyebilirsiniz."));
        pendingDeadlines.add(cancel);
        timer = setTimeout(() => reject(new Error(detail)), milliseconds);
      })
    ]).finally(() => { clearTimeout(timer); pendingDeadlines.delete(cancel); });
  }

  async function ensureWorker() {
    if (worker) return worker;
    if (workerPromise) return workerPromise;
    workerPromise = (async () => {
      emit("OCR motoru hazırlanıyor", 0);
      const tesseract = await ensureLibrary();
      const assets = root.ASMachOcrAssets || {};
      // Decode language files within their own worker, without cross-worker blob fetches.
      const languageUrls = {eng:assets.eng,tur:assets.tur,deu:assets.deu};
      if(!assets.deu)throw new Error('Almanca OCR dil paketi eksik. Uygulama paketini yeniden oluşturun.');
      // Load the core in the worker itself. A fragment on a blob:null URL cannot
      // reliably be resolved by importScripts when the standalone HTML uses file:.
      const coreSource = new root.TextDecoder().decode(bytesFromBase64(assets.core));
      const workerBytes = bytesFromBase64(assets.worker);
      const workerSource = new root.TextDecoder().decode(workerBytes);
      const workerUrl = makeUrl(bootstrapSource(languageUrls) + coreSource + "\n;self.TesseractCore=TesseractCore;\n" + workerSource, "text/javascript");
      let abandoned = false;
      const creation = tesseract.createWorker("eng+tur+deu", 1, {
        workerPath: workerUrl,
        workerBlobURL: false,
        corePath: "embedded-core.js",
        langPath: "https://asmach-offline.invalid/ocr",
        cacheMethod: "none",
        gzip: true,
        logger: event => {
          const labels = {
            "loading tesseract core": "OCR motoru yükleniyor",
            "loading language traineddata": "Türkçe, Almanca ve İngilizce tanıma hazırlanıyor",
            "initializing api": "OCR başlatılıyor",
            "recognizing text": "Metin tanınıyor"
          };
          emit(labels[event.status] || "OCR hazırlanıyor", event.progress);
        },
        errorHandler: () => {}
      });
      creation.then(created => { if (abandoned) created.terminate(); }, () => {});
      try {
        worker = await deadline(creation, 45000, "OCR 45 saniyede başlatılamadı. Metni elle girebilir veya yeniden deneyebilirsiniz.");
        await deadline(worker.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "360" }), 10000, "OCR ayarları uygulanamadı.");
        return worker;
      } catch (error) {
        abandoned = true;
        throw error;
      }
    })().catch(async error => { await disposeWorker(); throw error; });
    return workerPromise;
  }

  async function disposeWorker() {
    for (const cancel of [...pendingDeadlines]) cancel();
    const current = worker;
    worker = null;
    workerPromise = null;
    if (current) { try { await current.terminate(); } catch (_) {} }
    assetUrls.forEach(url => root.URL.revokeObjectURL(url));
    assetUrls = [];
  }

  function exclusive(operation, onProgress) {
    const task = queue.then(async () => {
      progressHandler = onProgress || null;
      try { return await operation(); } finally { progressHandler = null; }
    });
    queue = task.catch(() => {});
    return task;
  }

  async function loadImage(snapshot) {
    if (snapshot && typeof snapshot !== "string" && snapshot.width && snapshot.height) return snapshot;
    return deadline(new Promise((resolve, reject) => {
      const image = new root.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Seçilen alanın görüntüsü okunamadı."));
      image.src = snapshot;
    }), 20000, "Seçilen görüntü yüklenemedi.");
  }

  function makeCanvas(width, height) {
    const canvas = root.document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    return canvas;
  }

  function otsuThreshold(histogram, count) {
    let sum = 0;
    for (let index = 0; index < 256; index++) sum += index * histogram[index];
    let weightBackground = 0, sumBackground = 0, maxVariance = -1, threshold = 160;
    for (let index = 0; index < 256; index++) {
      weightBackground += histogram[index];
      if (!weightBackground) continue;
      const weightForeground = count - weightBackground;
      if (!weightForeground) break;
      sumBackground += index * histogram[index];
      const difference = sumBackground / weightBackground - (sum - sumBackground) / weightForeground;
      const variance = weightBackground * weightForeground * difference * difference;
      if (variance > maxVariance) { maxVariance = variance; threshold = index; }
    }
    return clamp(threshold, 45, 235);
  }

  function prepare(image, angle, thresholded, wholePage) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const limit = wholePage ? 4800 : 3000;
    const scale = Math.min(wholePage ? 1 : 2, limit / Math.max(width, height));
    const scaledWidth = width * scale, scaledHeight = height * scale;
    const pad = wholePage ? 12 : 28;
    const sideways = angle === 90 || angle === 270;
    const canvas = makeCanvas((sideways ? scaledHeight : scaledWidth) + 2 * pad, (sideways ? scaledWidth : scaledHeight) + 2 * pad);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    if (angle === 90) context.translate(pad + scaledHeight, pad);
    else if (angle === 180) context.translate(pad + scaledWidth, pad + scaledHeight);
    else if (angle === 270) context.translate(pad, pad + scaledWidth);
    else context.translate(pad, pad);
    context.rotate(angle * Math.PI / 180);
    context.drawImage(image, 0, 0, scaledWidth, scaledHeight);
    context.restore();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const histogram = new Uint32Array(256);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = Math.round(pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114);
      pixels.data[index] = gray;
      histogram[gray]++;
    }
    const cutoff = otsuThreshold(histogram, pixels.data.length / 4);
    // Preserve antialiasing in the first pass; a separate binary pass recovers pale drawing text.
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = thresholded ? (pixels.data[index] <= cutoff ? 0 : 255) : pixels.data[index];
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = gray;
      pixels.data[index + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    return { canvas, width, height, scaledWidth, scaledHeight, scale, angle, pad };
  }

  function originalBox(bbox, variant) {
    const { angle, pad, scaledWidth: width, scaledHeight: height } = variant;
    const inverse = (x, y) => {
      x -= pad; y -= pad;
      if (angle === 90) return [y / width, (height - x) / height];
      if (angle === 180) return [(width - x) / width, (height - y) / height];
      if (angle === 270) return [(width - y) / width, x / height];
      return [x / width, y / height];
    };
    const points = [inverse(bbox.x0, bbox.y0), inverse(bbox.x1, bbox.y0), inverse(bbox.x1, bbox.y1), inverse(bbox.x0, bbox.y1)];
    const x = clamp(Math.min(...points.map(point => point[0])), 0, 1);
    const y = clamp(Math.min(...points.map(point => point[1])), 0, 1);
    const endX = clamp(Math.max(...points.map(point => point[0])), 0, 1);
    const endY = clamp(Math.max(...points.map(point => point[1])), 0, 1);
    return { x, y, w: Math.max(0, endX - x), h: Math.max(0, endY - y) };
  }

  function extractResults(data, variant, pass) {
    const words = [], lines = [];
    let lineNumber = 0;
    for (const block of data.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const line of paragraph.lines || []) {
          const lineId = `${pass}:${lineNumber++}`;
          if (line.bbox && normalize(line.text)) lines.push({ text: normalize(line.text), confidence: Number(line.confidence) || 0, ...originalBox(line.bbox, variant), angle: variant.angle, lineId });
          for (const word of line.words || []) {
            if (!word.bbox || !normalize(word.text)) continue;
            words.push({ text: normalize(word.text), confidence: Number(word.confidence) || 0, ...originalBox(word.bbox, variant), angle: variant.angle, lineId, symbols:(word.symbols||[]).filter(s=>s.bbox).map(s=>({text:String(s.text||''),...originalBox(s.bbox,variant)})) });
          }
        }
      }
    }
    // Older compatible builds expose a flat words array.
    if (!words.length && Array.isArray(data.words)) {
      for (const word of data.words) if (word.bbox && normalize(word.text)) words.push({ text: normalize(word.text), confidence: Number(word.confidence) || 0, ...originalBox(word.bbox, variant), angle: variant.angle });
    }
    return { text: normalize(data.text), confidence: Number(data.confidence) || 0, words, lines, source: "Yerel OCR · Türkçe / İngilizce", angle: variant.angle };
  }

  function candidateScore(candidate) {
    const text = normalize(candidate.text);
    if (!text) return -1000;
    let score = clamp(Number(candidate.confidence) || 0, 0, 100) * 0.45;
    const digits = (text.match(/\d/g) || []).length;
    score += digits ? 6 : 0;
    if(candidate.layout?.missingDigits)score-=80;
    if(candidate.layout?.ambiguousSpacing)score-=40;
    if(candidate.alternateRawText?.includes('±')&&!text.includes('±'))score-=45;
    if(candidate.visualToleranceSign)score+=12;
    if(candidate.symbolRecovery)score+=18;
    if(candidate.layout?.structured&&!candidate.layout.missingDigits)score+=30;
    if(candidate.enhancement==='strong'&&candidate.confidence<90)score-=5;
    const meaning=root.ASMachRequirements?.assessReading?.(text);
    if(meaning?.valid){score+=12;if(meaning.tolerance==='limits')score+=18;}
    if(meaning?.errors.length)score-=35;
    if(/^[ØR]?\s*0\d/.test(text))score-=18;
    if(/[+−-]\s*0\d/.test(text))score-=25;
    if (/\d\s*(?:±|\+\s*\/?\s*-)\s*\d/.test(text)) score += 44;
    if (/\d[\d.]*\s*[+\-]\s*\d[\d.]*\s*\/?\s*[+\-]\s*\d/.test(text)) score += 38;
    if (/(?:Ø|[Rr])\s*\d|\bM\s*\d|\b\d[\d.]*\s*[HhGgFfKkPp]\d\b/.test(text)) score += 30;
    if (/\bR[azq]\s*\d|\d\s*(?:°|deg)|\d\s*[x×]\s*\d/i.test(text)) score += 24;
    if (/^[ØRM]?\s*\d+(?:\.\d+)?(?:\s*(?:mm|in|°))?$/i.test(text)) score += 16;
    if (!digits) score -= 12;
    score -= Math.min(35, (text.match(/[^\p{L}\p{N}\s.,+\-±Ø°×/()|%:'"⏥⌖⏤⌓⊥∥]/gu) || []).length * 5);
    if (text.length > 180) score -= (text.length - 180) * 0.1;
    return score;
  }

  function overlapRatio(first, second) {
    const area = Math.max(0, Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x)) * Math.max(0, Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y));
    return area / Math.max(0.0000001, Math.min(first.w * first.h, second.w * second.h));
  }

  function mergeRegions(regions) {
    const ordered = regions.slice().sort((a, b) => candidateScore(b) - candidateScore(a));
    const kept = [];
    for (const region of ordered) {
      if (region.w <= 0 || region.h <= 0) continue;
      if (kept.some(other => overlapRatio(region, other) > 0.65 && (normalize(other.text).toLowerCase() === normalize(region.text).toLowerCase() || Math.max(region.w * region.h, other.w * other.h) / Math.max(0.0000001, Math.min(region.w * region.h, other.w * other.h)) < 2.5))) continue;
      kept.push(region);
    }
    return kept.sort((a, b) => a.y - b.y || a.x - b.x);
  }

  async function runPass(image, angle, thresholded, wholePage, pass, segmentation, cellLocal=false, enhancement='off',preview=false) {
    const engine = await ensureWorker();
    const variant = prepare(image, angle, thresholded, wholePage);
    if(enhancement!=='off'&&root.ASMachOcrEnhancement){const original=variant.canvas;variant.canvas=root.ASMachOcrEnhancement.process(original,enhancement);original.width=original.height=1;}
    try {
      await engine.setParameters({ tessedit_pageseg_mode: segmentation || (wholePage ? "11" : "6") });
      emit("Metin tanınıyor", 0, `${angle}° yön · ${thresholded ? "siyah beyaz" : "gri ton"}`);
      const response = await deadline(engine.recognize(variant.canvas, {}, { text: true, blocks: true }), MAX_JOB_MS, "Metin tanıma süresi aşıldı. Daha küçük bir alan seçin.");
      const result = extractResults(response.data || {}, variant, pass);
      if (!wholePage && !cellLocal && root.ASMachMeasurementLayout) {
        recoverToleranceSigns(result,variant);
        const layout = root.ASMachMeasurementLayout.reconstruct(result.words, {width:variant.width,height:variant.height,ocr:true,details:true});
        result.rawText=result.text;result.layout=layout||null;
        if(layout?.text&&!layout.missingDigits&&(layout.structured||candidateScore({...result,text:layout.text})>=candidateScore(result)))result.text=layout.text;
        result.text = root.ASMachRequirements.normalize(normalize(result.text));
        // Layout and Tesseract can disagree on a tiny sign. Keep a valid raw
        // reading in contention rather than irrevocably replacing its meaning.
        const raw=root.ASMachRequirements.normalize(normalize(result.rawText)),rawMeaning=root.ASMachRequirements.assessReading?.(raw);
        if(raw!==result.text&&rawMeaning?.valid&&!rawMeaning.errors.length)result.alternateRawText=raw;
      }
      result.enhancement=enhancement;
      if(preview)result.previewImage=variant.canvas.toDataURL('image/png');
      return result;
    } finally {
      variant.canvas.width = variant.canvas.height = 1;
    }
  }
  function recoverToleranceSigns(result,variant){
    const evidence=root.ASMachOcrEnhancement?.toleranceSigns?.(variant.canvas)||[];let changed=false;
    for(const sign of evidence){const box=originalBox({x0:sign.x,y0:sign.y,x1:sign.x+sign.w,y1:sign.y+sign.h},variant);
      for(const word of result.words){
        if(word.symbols?.length&&word.symbols.map(s=>s.text).join('')===word.text){
          let offset=0;for(const symbol of word.symbols){if(/^[+*£土士]$/.test(symbol.text)&&overlapRatio(symbol,box)>.6){word.text=word.text.slice(0,offset)+'±'+word.text.slice(offset+symbol.text.length);changed=true;}offset+=symbol.text.length;}
        }
        if(overlapRatio(word,box)<.6||Math.abs(word.x-box.x)>Math.max(box.w*.5,.006))continue;
        const text=word.text.trim();if(!/^[+*£土士±]+(?:\s*(?:\d|[.,])|$)/.test(text))continue;
        if(!text.startsWith('±')){word.text=text.replace(/^[+*£土士]+/,'±');changed=true;}
      }
    }
    if(changed){result.visualToleranceSign=true;result.needsReview=true;}
  }
  async function readSpacedLine(image,angle){
    const variant=prepare(image,angle,false,false);let spaced,prefix;
    try{
      const rows=root.ASMachOcrEnhancement?.measurementInkRows?.(variant.canvas);if(rows?.length!==1)return [];
      const detected=root.ASMachGdtVision?.zonePrefix?.(variant.canvas);if(detected?.prefix==='Ø')prefix=detected;else if(detected)detected.image.width=detected.image.height=1;
      const source=prefix?.image||variant.canvas,offset=prefix?variant.canvas.width-prefix.image.width:0;
      spaced=root.ASMachOcrEnhancement?.spacingVariant?.(source);if(!spaced&&!prefix)return [];
      const engine=await ensureWorker(),readings=[];
      for(const mode of ['7','13']){
        await engine.setParameters({tessedit_pageseg_mode:mode});const response=await deadline(engine.recognize(spaced?.canvas||source,{}, {text:true,blocks:true}),MAX_JOB_MS,'Aralıklı ölçü okuma süresi aşıldı.');const data=response.data||{};
        const shift=node=>{if(node.bbox)for(const key of ['x0','x1','y0','y1'])node.bbox[key]=(key[0]==='x'?(spaced?spaced.mapX(node.bbox[key]):node.bbox[key])+offset:(spaced?spaced.mapY(node.bbox[key]):node.bbox[key]));for(const key of ['blocks','paragraphs','lines','words','symbols'])for(const child of node[key]||[])shift(child);};shift(data);
        const result=extractResults(data,variant,'spacing-'+mode);result.rawText=result.text;result.text=root.ASMachRequirements.normalize(result.text);result.enhancement='spacing';result.source='Yerel OCR · karakter aralığı kontrollü okuma';result.needsReview=true;
        recoverToleranceSigns(result,variant);
        if(prefix&&/^(?:\d|\.\d)/.test(result.text)){result.text='Ø'+result.text;result.words.unshift({text:'Ø',confidence:90,angle,...originalBox({x0:rows[0].x,y0:rows[0].y,x1:offset,y1:rows[0].y+rows[0].h},variant)});result.symbolRecovery='Çap simgesi kaynak görüntüden doğrulandı';}
        const layout=root.ASMachMeasurementLayout?.reconstruct(result.words,{width:variant.width,height:variant.height,ocr:true,details:true});result.layout=layout||null;
        if((layout?.structured||result.visualToleranceSign)&&!layout?.missingDigits&&!layout?.ambiguousSpacing)result.text=root.ASMachRequirements.normalize(normalize(layout.text));
        readings.push(result);
      }
      return readings;
    }finally{variant.canvas.width=variant.canvas.height=1;if(spaced)spaced.canvas.width=spaced.canvas.height=1;if(prefix)prefix.image.width=prefix.image.height=1;}
  }

  async function readSeparated(image,angle){
    const variant=prepare(image,angle,false,false),regions=root.ASMachOcrEnhancement.regions(variant.canvas);
    try{if(regions.length!==2)return null;const engine=await ensureWorker(),parts=[];
      for(const [index,box]of regions.entries()){
        const crop=makeCanvas(box.w,box.h);crop.getContext('2d').drawImage(variant.canvas,box.x,box.y,box.w,box.h,0,0,box.w,box.h);
        try{await engine.setParameters({tessedit_pageseg_mode:index===0?'7':'6'});const response=await deadline(engine.recognize(crop,{}, {text:true,blocks:true}),MAX_JOB_MS,'Bölge okuma süresi aşıldı.');const data=response.data||{};
          const shift=node=>{if(node.bbox)for(const k of ['x0','x1','y0','y1'])node.bbox[k]+=k[0]==='x'?box.x:box.y;for(const key of ['blocks','paragraphs','lines','words','symbols'])for(const child of node[key]||[])shift(child);};shift(data);
          const part=extractResults(data,variant,'region-'+index);recoverToleranceSigns(part,variant);parts.push(part);
        }finally{crop.width=crop.height=1;}
      }
      if(parts.some(p=>!p.text))return null;
      // A separate numeric read is only given a diameter prefix with visual evidence.
      if(/^[0OØΦφ⌀©]$/i.test(parts[0].text.trim())&&/^\d+(?:\.\d+)?$/.test(parts[1].text.trim())&&root.ASMachDiameterVision){
        const evidence=await root.ASMachDiameterVision.inspect(variant.canvas.toDataURL(),parts[1].text.trim()).catch(()=>({diameter:false}));
        if(evidence.diameter){parts[0].text='Ø';if(parts[0].words.length===1)parts[0].words[0].text='Ø';}
      }
      const words=parts.flatMap(p=>p.words),layout=root.ASMachMeasurementLayout.reconstruct(words,{width:variant.width,height:variant.height,ocr:true,details:true});
      if(!layout?.structured||layout.missingDigits)return {text:parts.map(p=>p.text).join('\n'),rawText:parts.map(p=>p.text).join('\n'),confidence:Math.min(...parts.map(p=>p.confidence)),words,lines:[],layout,angle,source:'Yerel OCR · bölgesel kontrol',enhancement:'regions'};
      return {text:layout.text,rawText:parts.map(p=>p.text).join('\n'),confidence:Math.min(...parts.map(p=>p.confidence)),words,lines:parts.flatMap(p=>p.lines),layout,angle,source:'Yerel OCR · ayrı nominal / sembol / tolerans okuması',enhancement:'regions',visualToleranceSign:parts.some(p=>p.visualToleranceSign),needsReview:parts.some(p=>p.needsReview)};
    }finally{variant.canvas.width=variant.canvas.height=1;}
  }
  async function readMeasurementRows(image,angle){
    const variant=prepare(image,angle,false,false);let wholePrefix;
    try{
      let regions=root.ASMachOcrEnhancement?.measurementRegions?.(variant.canvas)||[];
      const detected=root.ASMachGdtVision?.zonePrefix?.(variant.canvas);
      if(detected?.prefix==='Ø'){
        const rows=root.ASMachOcrEnhancement?.measurementRegions?.(detected.image)||[];
        if(rows.length===2&&Math.min(rows[0].h,rows[1].h)/Math.max(rows[0].h,rows[1].h)>.72&&Math.abs(rows[0].x-rows[1].x)<Math.max(rows[0].h,rows[1].h)*.5){wholePrefix=detected;const offset=variant.canvas.width-detected.image.width;regions=rows.map(r=>({...r,x:r.x+offset}));}
        else detected.image.width=detected.image.height=1;
      }else if(detected)detected.image.width=detected.image.height=1;
      if(!regions.length)return null;
      const engine=await ensureWorker(),parts=[];let conflicting=false;
      for(const [index,region]of regions.entries()){
        const box={x:Math.max(0,region.x-3),y:Math.max(0,region.y-3)};box.w=Math.min(variant.canvas.width,region.x+region.w+3)-box.x;box.h=Math.min(variant.canvas.height,region.y+region.h+3)-box.y;
        const scale=Math.min(4,Math.max(1,48/box.h)),pad=24,crop=makeCanvas(box.w*scale+pad*2,box.h*scale+pad*2),ctx=crop.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,crop.width,crop.height);ctx.drawImage(variant.canvas,box.x,box.y,box.w,box.h,pad,pad,box.w*scale,box.h*scale);
        const detectedPrefix=root.ASMachGdtVision?.zonePrefix?.(crop);let prefix=detectedPrefix?.prefix==='Ø'?detectedPrefix:null;
        if(!prefix&&region.leadingSign==='-'){const start=Math.ceil(pad+(region.signEnd-box.x)*scale+1),image=makeCanvas(crop.width-start,crop.height);image.getContext('2d').drawImage(crop,start,0,image.width,image.height,0,0,image.width,image.height);prefix={prefix:'-',image};}
        const offset=prefix?crop.width-prefix.image.width:0,readingImage=prefix?.image||crop;
        const readings=[];
        try{for(const mode of ['7','13']){
          await engine.setParameters({tessedit_pageseg_mode:mode});const response=await deadline(engine.recognize(readingImage,{}, {text:true,blocks:true}),MAX_JOB_MS,'Ölçü satırı okuma süresi aşıldı.');const data=response.data||{};
          const shift=node=>{if(node.bbox)for(const key of ['x0','x1','y0','y1'])node.bbox[key]=(node.bbox[key]-pad+(key[0]==='x'?offset:0))/scale+(key[0]==='x'?box.x:box.y);for(const key of ['blocks','paragraphs','lines','words'])for(const child of node[key]||[])shift(child);};shift(data);const result=extractResults(data,variant,'row-'+index+'-'+mode);
          if(prefix&&/^\d+(?:\.\d+)?$/.test(result.text.trim())){result.text=prefix.prefix+result.text.trim();result.words.unshift({text:prefix.prefix,confidence:90,angle,...originalBox({x0:box.x,y0:box.y,x1:box.x+(offset-pad)/scale,y1:box.y+box.h},variant)});}
          readings.push(result);
        }}finally{crop.width=crop.height=1;if(detectedPrefix)detectedPrefix.image.width=detectedPrefix.image.height=1;if(prefix)prefix.image.width=prefix.image.height=1;}
        const valid=r=>/^(?:Ø|R)?\s*[+−-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*(?:mm|in|°))?$/.test(root.ASMachRequirements.normalize(r.text));
        const score=r=>r.confidence-(/^[+−-]?0\d/.test(r.text.trim())?25:0);
        readings.sort((a,b)=>Number(valid(b))-Number(valid(a))||score(b)-score(a));const selected=readings[0];if(!selected.text)return null;
        conflicting ||= new Set(readings.filter(valid).map(r=>root.ASMachRequirements.normalize(r.text))).size>1;parts.push(selected);
      }
      const words=parts.flatMap(p=>p.words),layout=root.ASMachMeasurementLayout.reconstruct(words,{width:variant.width,height:variant.height,ocr:true,details:true});
      if(!layout?.structured||layout.missingDigits)return null;
      if(wholePrefix&&layout.limitDimension&&!/^Ø/.test(layout.text))layout.text='Ø'+layout.text;
      return {text:layout.text,rawText:parts.map(p=>p.text).join('\n'),confidence:Math.min(...parts.map(p=>p.confidence)),words,lines:parts.flatMap(p=>p.lines),layout,angle,source:'Yerel OCR · bağımsız ölçü satırları',enhancement:'regions',needsReview:conflicting,...(wholePrefix?{symbolRecovery:'Çap simgesi kaynak görüntüden doğrulandı'}:{})};
    }finally{variant.canvas.width=variant.canvas.height=1;if(wholePrefix)wholePrefix.image.width=wholePrefix.image.height=1;}
  }
  function recognize(snapshot, options = {}) {
    // Comparison uses exactly the normal recognition pipeline, not a single PSM-6 pass.
    if(['off','mild','strong'].includes(options.previewPass))options={...options,enhancement:options.previewPass,diagnostics:true};
    // Dispatch outside the worker lock: individual frame cells use this same worker.
    if(!options.skipGdt&&!options.gdtCell&&!options.textMode&&!options.numericScope&&root.ASMachGdtVision){
      return (async()=>{
        try{
          const framed=await root.ASMachGdtVision.recognize(snapshot,(cell,cellOptions)=>recognize(cell,{...options,...cellOptions,skipGdt:true,previewPass:undefined}));
          if(framed)return {...framed,enhancement:options.enhancement||'auto'};
        }catch{/* A frame detection failure must not prevent ordinary OCR. */}
        return recognize(snapshot,{...options,skipGdt:true});
      })();
    }
    return exclusive(async () => {
      try {
        const image = await loadImage(snapshot);
        if(['nominal','tolerance'].includes(options.numericScope)){
          // Explicit N/T selection is a numeric region, unlike generic prose.
          // Keep it upright and preserve signs using the same visual evidence.
          const numeric='(?:\\d+(?:\\.\\d+)?|\\.\\d+)',nominal=new RegExp('^(?:Ø|R)?[+-]?'+numeric+'(?:°)?$'),tolerance=new RegExp('^'+(options.gdtTolerance?'(?:Ø)?':'')+'(?:±|[+-])?'+numeric+'(?:°)?(?:[ /]+[+-]?'+numeric+'(?:°)?)?$');
          const clean=text=>{let value=root.ASMachRequirements.normalize(normalize(text));if(options.numericScope==='nominal'&&/^(?:Ø|R)?\s*\d(?:\s+\d)+\s*$/.test(value))value=value.replace(/\s+/g,'');return value;};
          const valid=r=>(options.numericScope==='nominal'?nominal:tolerance).test(clean(r.text));
          const primary=['off','mild','strong'].includes(options.enhancement)?options.enhancement:'off';
          const candidates=[];for(const [index,mode]of ['7','13','6'].entries())candidates.push(await runPass(image,0,false,false,'numeric-'+index,mode,false,primary));
          if(!['off','mild','strong'].includes(options.enhancement)&&!candidates.some(r=>valid(r)&&r.confidence>=90))candidates.push(await runPass(image,0,false,false,'numeric-mild','7',false,'mild'));
          candidates.push(...await readSpacedLine(image,0));
          for(const reading of [...candidates])if(reading.alternateRawText)candidates.push({...reading,text:reading.alternateRawText,layout:null,alternateRawText:undefined});
          for(const reading of candidates){
            const rows=String(reading.rawText||'').split(/\r?\n/).map(line=>clean(line)).filter(Boolean),signed=new RegExp('^[+-]'+numeric+'$'),zero=/^0(?:\.0+)?$/;
            if(options.numericScope==='tolerance'&&rows.length===2&&rows.some(row=>signed.test(row))&&rows.every(row=>signed.test(row)||zero.test(row))){reading.text=rows.join(' / ');reading.scopeRows=true;}
            else reading.text=clean(reading.text);
          }
          const score=r=>Number(valid(r))*100+r.confidence+(r.visualToleranceSign?20:0)+(r.scopeRows?25:0)-(r.layout?.ambiguousSpacing&&options.numericScope!=='nominal'?40:0);
          candidates.sort((a,b)=>score(b)-score(a));const best=candidates[0],distinct=new Set(candidates.filter(valid).map(r=>r.text.replace(/\s/g,'')));
          return {...best,numericScope:options.numericScope,needsReview:!!best.needsReview||!!best.layout?.ambiguousSpacing||!!best.layout?.missingDigits||!valid(best)||distinct.size>1,alternatives:candidates.filter(r=>r.text&&r.text!==best.text).map(r=>({text:r.text,confidence:r.confidence,angle:r.angle})).slice(0,5)};
        }
        if(options.textMode){
          const enhancement=['mild','strong'].includes(options.enhancement)?options.enhancement:'off';
          const candidates=[await runPass(image,0,false,false,0,'6',true,enhancement)];
          if(!candidates[0].text||candidates[0].confidence<85){
            candidates.push(await runPass(image,0,true,false,1,'6',true,enhancement));
            const ratio=(image.naturalWidth||image.width)/(image.naturalHeight||image.height);
            if(ratio>4)candidates.push(await runPass(image,0,false,false,2,'13',true,enhancement));
          }
          // Prose is ranked by OCR confidence, never by technical-number bonuses.
          candidates.sort((a,b)=>Number(!!b.text)-Number(!!a.text)||b.confidence-a.confidence);
          emit('Not metni tanındı',1);return {...candidates[0],alternatives:candidates.slice(1).map(r=>({text:r.text,confidence:r.confidence,angle:r.angle}))};
        }
        if(options.gdtCell){
          // Frame geometry already deskewed these cells. Rotating a datum can turn B into 8.
          // Do not use a digit whitelist or whole-dimension reconstruction to invent a value.
          const valid=text=>options.gdtCell==='modifier'?/^[MLSPFT]$/.test(text):options.gdtCell==='datum'?/^(?:[A-Z](?:-[A-Z])?[ⓂⓁⓈⓅⒻ]*|CZ|SZ|P\s*\d+(?:\.\d+)?)$/.test(text):/^(?:Ø)?(?:±)?(?:\d+(?:\.\d+)?|\.\d+)[ⓂⓁⓈⓅⒻⓉ]*$/.test(text);
          const clean=text=>root.ASMachRequirements.normalize(text).replace(/\s+/g,'');
          const candidates=[];
          const levels=['off','mild','strong'].includes(options.enhancement)?[options.enhancement]:['off','mild','strong'];
          for(const level of levels)for(const [index,mode] of ['7','13'].entries()){
            const result=await runPass(image,0,false,false,index,mode,true,level);candidates.push(result);
            if(valid(clean(result.text))&&result.confidence>=80)break;
          }
          candidates.sort((a,b)=>Number(valid(clean(b.text)))-Number(valid(clean(a.text)))||b.confidence-a.confidence);
          const distinct=new Set(candidates.filter(r=>valid(clean(r.text))).map(r=>clean(r.text)));
          emit('Hücre tanıma tamamlandı',1);return {...candidates[0],needsReview:distinct.size>1};
        }
        const tall = (image.naturalHeight || image.height) > (image.naturalWidth || image.width) * 1.4;
        const angles = tall ? [90, 270, 0, 180] : [0, 180, 90, 270];
        const candidates = [];
        for (let index = 0; index < angles.length; index++) {
          const result = await runPass(image, angles[index], false, false, index);
          candidates.push(result);
          // A plain number may be a fragment; only a confident complete technical pattern permits an early finish.
          if (!options.forceAll && candidateScore(result) >= 114 && result.confidence >= 75) break;
        }
        candidates.sort((a, b) => candidateScore(b) - candidateScore(a));
        const bestAngle = candidates[0] ? candidates[0].angle : 0;
        if (options.forceAll || !candidates[0] || candidateScore(candidates[0]) < 112) candidates.push(await runPass(image, bestAngle, true, false, 5));
        // Raw-line segmentation bypasses word-spacing assumptions for condensed,
        // monospaced and technical lettering. Keep stacked tolerances in block mode.
        const ratio=(image.naturalWidth||image.width)/(image.naturalHeight||image.height);
        const lineRatio=bestAngle===90||bestAngle===270?1/ratio:ratio;
        if(lineRatio>4&&(options.forceAll||candidates[0].confidence<85))candidates.push(await runPass(image,bestAngle,false,false,6,'13'));
        candidates.sort((a, b) => candidateScore(b) - candidateScore(a));
        const enhancement=root.ASMachOcrEnhancement?.mode(options)||'off';
        // Geometry-first row reads must not inherit a mistaken whole-block angle.
        // Rotations with no separate text rows exit before invoking the OCR worker.
        for(const angle of angles){const separated=await readMeasurementRows(image,angle);if(separated)candidates.push(separated);}
        candidates.sort((a,b)=>candidateScore(b)-candidateScore(a));
        if(enhancement!=='off'){
          const passes=enhancement==='auto'?['mild','strong']:[enhancement];
          // A bad whole-block read must not lock every recovery pass to the wrong orientation.
          const recoveryAngles=[...new Set([angles[0],bestAngle])];
          for(const angle of recoveryAngles){
            for(const strength of passes)candidates.push(await runPass(image,angle,false,false,'enhanced-'+angle+'-'+strength,'6',false,strength));
            const separated=await readSeparated(image,angle);if(separated)candidates.push(separated);
          }
          candidates.sort((a,b)=>candidateScore(b)-candidateScore(a));
        }
        // Repeated glyph spacing gets its own reversible reading copy. Original
        // coordinates and every original reading remain available for review.
        for(const angle of [...new Set([angles[0],bestAngle])])candidates.push(...await readSpacedLine(image,angle));
        for(const result of [...candidates])if(result.alternateRawText)candidates.push({...result,text:result.alternateRawText,layout:result.layout?.ambiguousSpacing?{ambiguousSpacing:true}:null,alternateRawText:undefined,source:result.source+' · ham okuma',needsReview:true});
        candidates.sort((a,b)=>candidateScore(b)-candidateScore(a));
        // Shared by normal recognition and all three comparison variants.
        if(root.ASMachDiameterVision?.recover){
          const W=image.naturalWidth||image.width,H=image.naturalHeight||image.height,k=Math.min(1,1200/Math.max(W,H)),source=makeCanvas(Math.round(W*k),Math.round(H*k));source.getContext('2d').drawImage(image,0,0,source.width,source.height);
          try{const evidence={...root.ASMachDiameterVision.detect(source),width:W,height:H};for(let i=0;i<candidates.length;i++)candidates[i]=root.ASMachDiameterVision.recover(candidates[i],evidence);candidates.sort((a,b)=>candidateScore(b)-candidateScore(a));}catch{/* Keep OCR readings if optional visual inspection fails. */}finally{source.width=source.height=1;}
        }
        const best = candidates[0] || { text: "", confidence: 0, words: [], lines: [] };
        const meaning=root.ASMachRequirements?.assessReading?.(best.text);
        if(meaning){
          best.measurementKind=meaning.kind;best.toleranceKind=meaning.tolerance;
          const conflict=meaning.valid&&candidates.some(other=>other!==best&&other.confidence>=60&&candidateScore(other)>=candidateScore(best)-12&&(()=>{const next=root.ASMachRequirements.assessReading(other.text);return next.valid&&next.signature!==meaning.signature;})());
          if(conflict||meaning.errors.length){best.needsReview=true;best.reviewReason=conflict?'Yakın güçteki okumalar ölçü türü, nominal veya tolerans konusunda uyuşmuyor. Kaynakla karşılaştırın.':meaning.errors.join(' · ');}
        }
        if(root.ASMachOcrEnhancement&&(enhancement!=='off'||!root.ASMachApp?.state.pdfDoc)&&(root.ASMachOcrEnhancement.compare(candidates,best)||best.layout?.missingDigits||best.layout?.ambiguousSpacing||/^[ØR]?\s*0\d/.test(best.text))){best.needsReview=true;best.confidence=Math.min(best.confidence,45);best.reviewReason='Okumalar farklı veya rakam yerleşimi şüpheli. Nominal ve toleransları kaynak görüntüyle karşılaştırın.';}
        if(best.layout?.missingDigits||best.layout?.ambiguousSpacing){best.needsReview=true;best.confidence=Math.min(best.confidence,45);best.reviewReason='Karakter aralıkları belirsiz veya okuma rakam kaybediyor. Kaynak görüntüyü kontrol edin.';}
        if(enhancement!=='off')root.ASMachOcrEnhancement.report(best);
        emit("Metin tanıma tamamlandı", 1);
        const alternatives=candidates.filter((candidate,index,all)=>candidate.text&&candidate.text!==best.text&&all.findIndex(other=>other.text===candidate.text)===index).slice(0,5).map(candidate=>({text:candidate.text,confidence:candidate.confidence,angle:candidate.angle,enhancement:candidate.enhancement}));
        const result={...best,alternatives};
        if(options.diagnostics&&root.ASMachOcrEnhancement)result.previewImage=root.ASMachOcrEnhancement.diagnostic(image,result);
        return result;
      } catch (error) {
        await disposeWorker();
        return { text: "", confidence: 0, words: [], lines: [], source: "Yerel OCR", error: messageOf(error) };
      }
    }, options.onProgress);
  }

  function detect(snapshot, options = {}) {
    return exclusive(async () => {
      try {
        if(options.shouldCancel?.())return{words:[],lines:[],cancelled:true};
        progressRange={start:0,span:.08,detail:'OCR hazırlanıyor'};
        const image = await loadImage(snapshot);
        await ensureWorker();
        const results = [];
        const enhancement=root.ASMachOcrEnhancement?.mode(options)||'off';
        const angles = options.angles || [0, 90, 270, 180];
        const recoverTolerance=options.detailed!==false||options.recoverTolerance===true;
        for (let index = 0; index < angles.length; index++) {
          if(options.shouldCancel?.())break;
          const start=.08+.9*index/angles.length,span=.9/angles.length;
          progressRange={start,span:recoverTolerance?span/2:span,detail:`Yön ${index+1}/${angles.length} (${angles[index]}°)`};
          emit("Sayfa taranıyor",0);
          const sparse = await runPass(image, angles[index], false, true, index);
          results.push(sparse);
          if(enhancement!=='off'&&!options.shouldCancel?.())results.push(await runPass(image,angles[index],false,true,'enhanced-'+index,'11',false,enhancement==='strong'?'strong':'mild'));
          // Sparse segmentation sometimes consumes the ± sign between adjacent numbers.
          // A block pass in a direction that already contains measurements recovers the full requirement.
          if (!options.shouldCancel?.() && recoverTolerance && sparse.words.some(word => /\d{2}|[RMØ]\s*\d/i.test(word.text) && word.confidence >= 30)) {
            progressRange={start:start+span/2,span:span/2,detail:`Yön ${index+1}/${angles.length} · ikinci geçiş`};
            results.push(await runPass(image, angles[index], false, true, `block-${index}`, "6"));
          }
        }
        if (!options.shouldCancel?.() && options.detailed !== false && !results.some(result => result.words.some(word => /\d/.test(word.text) && word.confidence >= 35))) results.push(await runPass(image, 0, true, true, 5));
        const words = mergeRegions(results.flatMap(result => result.words).filter(word => word.confidence >= 15));
        const lines = mergeRegions(results.flatMap(result => result.lines).filter(line => line.confidence >= 15));
        if(enhancement!=='off'){
          const conflicts=(region,all)=>all.some(other=>other.angle===region.angle&&other.confidence>=40&&overlapRatio(region,other)>.7&&normalize(other.text).replace(/\s/g,'')!==normalize(region.text).replace(/\s/g,''));
          for(const word of words)if(conflicts(word,results.flatMap(r=>r.words))){word.needsReview=true;word.confidence=Math.min(word.confidence,45);}
          for(const line of lines)if(conflicts(line,results.flatMap(r=>r.lines))){line.needsReview=true;line.confidence=Math.min(line.confidence,45);}
          root.ASMachOcrEnhancement.report({needsReview:words.some(w=>w.needsReview)||lines.some(l=>l.needsReview)});
        }
        progressRange=null;emit("Sayfa taraması tamamlandı", 1);
        return { words, lines, evidenceWords:results.flatMap(r=>r.words),evidenceLines:results.flatMap(r=>r.lines), text: lines.map(line => line.text).join("\n"), confidence: words.length ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length : 0, source: "Yerel OCR · Türkçe / İngilizce" };
      } catch (error) {
        await disposeWorker();
        return { text: "", confidence: 0, words: [], lines: [], source: "Yerel OCR", error: messageOf(error) };
      } finally {progressRange=null;}
    }, options.onProgress);
  }

  async function capture({ pdfDoc, page = 1, canvas, box = { x: 0, y: 0, w: 1, h: 1 }, dpi = 360, padding }) {
    const x = clamp(Number(box.x) || 0, 0, 1), y = clamp(Number(box.y) || 0, 0, 1);
    const w = clamp(Number(box.w) || 0, 0, 1 - x), h = clamp(Number(box.h) || 0, 0, 1 - y);
    if (!w || !h) throw new Error("Metin tanımak için bir alan seçin.");
    const whole = x === 0 && y === 0 && w === 1 && h === 1;
    const pad = padding === 0 ? 0 : whole ? 0 : 24;
    const maxPixels = whole ? 14000000 : 8500000;
    if (pdfDoc) {
      const pdfPage = typeof page === "object" ? page : await pdfDoc.getPage(page);
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(clamp(Number(dpi) || 360, 150, 600) / 72, Math.sqrt(maxPixels / (base.width * w * base.height * h)));
      const viewport = pdfPage.getViewport({ scale });
      const result = makeCanvas(viewport.width * w + 2 * pad, viewport.height * h + 2 * pad);
      const context = result.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, result.width, result.height);
      await pdfPage.render({ canvasContext: context, viewport, transform: [1, 0, 0, 1, pad - x * viewport.width, pad - y * viewport.height], background: "#ffffff" }).promise;
      return result.toDataURL("image/png");
    }
    if (!canvas || !canvas.width || !canvas.height) throw new Error("Önce Yeni Proje oluşturun.");
    const sourceWidth = canvas.width * w, sourceHeight = canvas.height * h;
    const scale = Math.min(whole ? 1 : 3, Math.sqrt(maxPixels / (sourceWidth * sourceHeight)));
    const result = makeCanvas(sourceWidth * scale + 2 * pad, sourceHeight * scale + 2 * pad);
    const context = result.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, result.width, result.height);
    context.drawImage(canvas, x * canvas.width, y * canvas.height, sourceWidth, sourceHeight, pad, pad, sourceWidth * scale, sourceHeight * scale);
    return result.toDataURL("image/png");
  }

  root.ASMachOCR = Object.freeze({ recognize, detect, capture, terminate: disposeWorker,
    _test: Object.freeze({ normalize, candidateScore, originalBox, mergeRegions, otsuThreshold, bytesFromBase64, bootstrapSource }) });
})(typeof window !== "undefined" ? window : globalThis);
