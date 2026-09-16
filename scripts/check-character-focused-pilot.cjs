'use strict';
// Whole-measurement evaluation of a glyph-only advisory helper, no second OCR.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { pathToFileURL } = require('node:url');
let pw; try { pw = require(process.env.ASMACH_PLAYWRIGHT_MODULE || 'playwright'); }
catch (error) { if (process.env.ASMACH_PLAYWRIGHT_MODULE) throw error; pw = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, 'outputs/character-focused-pilot-v1');
const read = p => JSON.parse(fs.readFileSync(p)), hash = b => crypto.createHash('sha256').update(b).digest('hex');
const training = read(path.join(out, 'training-report.json')), modelText = fs.readFileSync(path.join(out, 'model.json'), 'utf8');
if (hash(modelText) !== training.modelSha256) throw Error('Model changed after training');
const reportFile = path.join(out, 'application-evaluation.json'); if (fs.existsSync(reportFile)) throw Error('Completed test exists; preserve it');
const frozenBytes = fs.readFileSync(path.join(root, 'tests/fixtures/ocr-100/manifest.json')), frozen = JSON.parse(frozenBytes), fresh = read(path.join(out, 'new-measurements.json'));
if (fresh.frozen100Sha256 !== hash(frozenBytes)) throw Error('Frozen corpus changed');
const sets = { previous100: frozen.cases.map(c => ({ ...c, filePath: path.join(root, 'tests/fixtures/ocr-100', c.file) })), new40: fresh.cases.map(c => ({ ...c, filePath: path.join(out, 'new-measurements', c.file) })) };
const protectedFiles = ['src/ocr-engine.js', 'src/requirements-engine.js', 'src/measurement-layout.js', 'src/technical-glyph-model.js', 'src/app.template.html',
  'ASMach_Teknik_Resim_Balonlama.html', 'ocr/technical-model/activation.json', 'ocr/experimental-model/technical-glyph-v1.json', 'package.json',
  ...['eng', 'tur', 'deu'].map(lang => `ocr/lang/${lang}.traineddata.gz`)];
const snapshot = () => Object.fromEntries(protectedFiles.map(p => [p, hash(fs.readFileSync(path.join(root, p)))]));
const before = snapshot(), rows = [], blocked = [], errors = [];
const normalize = s => String(s || '').normalize('NFC').replace(/[−–]/g, '-').replace(/\s+/g, ' ').trim().toUpperCase();
const get = (o, key) => key.split('.').reduce((v, k) => v?.[k], o);
function failures(c, record, text) {
  const list = Object.entries(c.expected).filter(([key, expected]) => { const actual = get(record, key); return typeof expected === 'number'
    ? String(actual ?? '').trim() === '' || !Number.isFinite(Number(actual)) || Math.abs(Number(actual) - expected) > 1e-9 : actual !== expected;
  }).map(([field, expected]) => ({ field, expected, actual: get(record, field) ?? null }));
  if (c.textMode && normalize(text) !== normalize(c.text)) list.push({ field: 'text', expected: c.text, actual: text }); return list;
}
function timings(values) { const sorted = [...values].sort((a, b) => a - b); return { meanMs: values.reduce((a, b) => a + b, 0) / values.length, medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1] }; }
function summarize(data) {
  return { cases: data.length, baselineExact: data.filter(r => r.baselineOk).length, hypotheticalSuggestionExact: data.filter(r => r.suggestionOk).length,
    suggestions: data.filter(r => r.advice.proposedText).length, fixes: data.filter(r => !r.baselineOk && r.suggestionOk).map(r => r.id),
    regressionsIfApproved: data.filter(r => r.baselineOk && !r.suggestionOk).map(r => r.id),
    incorrectSuggestions: data.filter(r => r.advice.proposedText && !r.suggestionOk).map(r => r.id),
    checkedCharacters: data.reduce((n, r) => n + r.advice.checks.length, 0),
    baseline: timings(data.map(r => r.ocrMs)), withCharacterCheck: timings(data.map(r => r.totalMs)), additional: timings(data.map(r => r.advice.extraMs)),
    reasons: Object.fromEntries([...new Set(data.map(r => r.advice.reason))].map(reason => [reason, data.filter(r => r.advice.reason === reason).length])) };
}
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.route(/^https?:/, route => { blocked.push(route.request().url()); return route.abort(); });
    await page.goto(pathToFileURL(path.join(root, 'ASMach_Teknik_Resim_Balonlama.html')).href);
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'src/technical-glyph-model.js'), 'utf8') });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'tests/helpers/character-focused-verifier.js'), 'utf8') });
    const modelSetupMs = await page.evaluate(text => { const t = performance.now(); window.pilotClassifier = ASMachTechnicalGlyphModel.create(JSON.parse(text)); return performance.now() - t; }, modelText);
    const glyphFixtures = read(path.join(out, 'glyph-fixtures.json')), parity = [];
    for (const f of glyphFixtures.fixtures) {
      const snapshot = 'data:image/png;base64,' + fs.readFileSync(path.join(out, 'glyph-holdout', f.file)).toString('base64');
      const result = await page.evaluate(async ({ f, snapshot }) => {
        const im = new Image(); im.src = snapshot; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(im, 0, 0); const pixels = ctx.getImageData(0, 0, c.width, c.height);
        const vector = ASMachTechnicalGlyphModel.extractPixels(pixels, { referenceHeight: f.referenceHeight }).vector;
        const difference = Math.max(...Array.from(vector, (v, i) => Math.abs(v - f.features[i]))), r = pilotClassifier.inferPixels(pixels, { referenceHeight: f.referenceHeight });
        return { difference, label: r.label, correct: r.label === f.label, accepted: r.accepted, score: r.score };
      }, { f, snapshot }); parity.push({ file: f.file, expected: f.label, ...result });
    }
    const maxDifference = Math.max(...parity.map(r => r.difference)); if (maxDifference >= 1e-6) throw Error('Python/JS feature mismatch: ' + maxDifference);
    const coldOcrMs = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 180; c.height = 75; const g = c.getContext('2d'); g.fillStyle = 'white'; g.fillRect(0, 0, 180, 75); g.fillStyle = 'black'; g.font = '32px Arial'; g.fillText('123.456', 8, 48); const t = performance.now(); await ASMachOCR.recognize(c.toDataURL(), { refresh: true }); return performance.now() - t; });
    for (const [set, cases] of Object.entries(sets)) for (let i = 0; i < cases.length; i++) {
      const c = cases[i], bytes = fs.readFileSync(c.filePath); if (hash(bytes) !== c.sha256) throw Error('Fixture changed: ' + c.id);
      // Inference sees only pixels and normal OCR options. No expected fields,
      // family or authored text are provided to the character helper.
      const r = await page.evaluate(async ({ image, options }) => {
        const t = performance.now(); const primary = await ASMachOCR.recognize(image, { refresh: true, enhancement: 'auto', textMode: options.textMode });
        const ocrMs = performance.now() - t, untouched = JSON.stringify(primary);
        const advice = await PilotCharacterVerifier.analyze(image, primary, pilotClassifier, options);
        const totalMs = performance.now() - t;
        if (JSON.stringify(primary) !== untouched || advice.text !== primary.text || advice.automaticallyChanged) throw Error('Primary OCR was modified');
        const parse = text => { let p = ASMachApp.parseRequirement(text, options.generalTolerance || ''); if (options.typeContext) { p = ASMachRequirements.transitionType(p, options.typeContext); p.type = options.typeContext; } return p; };
        return { text: primary.text, rawText: primary.rawText, confidence: primary.confidence, needsReview: !!primary.needsReview, error: primary.error,
          baselineParsed: parse(primary.text), suggestionParsed: parse(advice.proposedText || primary.text), advice, ocrMs, totalMs };
      }, { image: 'data:image/png;base64,' + bytes.toString('base64'), options: { textMode: !!c.textMode, generalTolerance: c.generalTolerance || '', typeContext: c.typeContext || '' } });
      const baselineFailures = failures(c, r.baselineParsed, r.text), suggestionFailures = failures(c, r.suggestionParsed, r.advice.proposedText || r.text);
      if (r.error) { baselineFailures.push({ field: 'ocrError', actual: r.error }); suggestionFailures.push({ field: 'ocrError', actual: r.error }); }
      rows.push({ id: c.id, set, family: c.family, quality: c.quality, ...r, baselineFailures, suggestionFailures, baselineOk: !baselineFailures.length, suggestionOk: !suggestionFailures.length });
      if ((i + 1) % 10 === 0) { fs.writeFileSync(path.join(out, 'application-progress.json'), JSON.stringify(rows, null, 2)); console.log(JSON.stringify({ set, tested: i + 1, of: cases.length, summary: summarize(rows.filter(r => r.set === set)) })); }
    }
    const after = snapshot(); if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Production artifact changed');
    const summaries = Object.fromEntries(Object.keys(sets).map(set => [set, summarize(rows.filter(r => r.set === set))]));
    const calibrationGatePassed = training.thresholds.scoreMin < 1;
    const report = { createdAt: new Date().toISOString(), synthetic: true, productionIntegrated: false, secondOcrEngineUsed: false, autoCorrections: 0,
      modelSha256: training.modelSha256, baselineModelSha256: before['ocr/lang/eng.traineddata.gz'], protectedHashes: before, productionUnchanged: true,
      calibrationGatePassed, automaticActivationAllowed: false, advisoryThresholds: { scoreMin: .95, marginMin: .9, twoViewsMustAgree: true, source: 'fixed existing v1 review cutoff, not tuned on test' },
      modelSetupMs, coldOcrMs, blockedRequests: blocked, pageErrors: errors,
      parity: { fixtures: parity.length, maxFeatureDifference: maxDifference, pass: maxDifference < 1e-6, rows: parity }, summaries,
      gdTUnchanged: rows.filter(r => r.family === 'GD&T').every(r => !r.advice.proposedText && r.advice.checks.length === 0), rows };
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, protectedHashes: undefined, parity: { ...report.parity, rows: undefined }, rows: undefined }, null, 2));
    await page.evaluate(() => ASMachOCR.terminate());
    if (blocked.length || errors.length || !report.gdTUnchanged) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
