/* Research-only: character suggestions, never automatic production edits. */
(function (root) {
  'use strict';
  const normalize = s => String(s || '').replace(/[−–]/g, '-').replace(/[⌀∅]/g, 'Ø').replace(/\s/g, '');
  const groups = ['0OØ', '1Il', '5S', '8B', '2Z', '6G', '0689', '+±', '.,'];
  const related = (a, b) => a !== b && groups.some(g => g.includes(a) && g.includes(b));
  function allowedProposal(a, b) {
    // Pre-existing v1 advisory cutoffs, not tuned to this holdout. These are
    // review-suggestion thresholds, NOT an automatic-acceptance guarantee.
    return a.label === b.label && a.label !== '<reject>' && a.score >= .95 && b.score >= .95 && a.margin >= .9 && b.margin >= .9;
  }
  function binarize(pixels) {
    const out = { width: pixels.width, height: pixels.height, data: new Uint8ClampedArray(pixels.data) }, hist = new Uint32Array(256);
    for (let i = 0; i < pixels.data.length; i += 4) hist[Math.round((pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3)]++;
    const total = pixels.width * pixels.height; let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let weight = 0, partial = 0, best = -1, threshold = 128;
    for (let i = 0; i < 255; i++) {
      weight += hist[i]; partial += i * hist[i]; if (!weight || weight === total) continue;
      const variance = weight * (total - weight) * Math.pow(partial / weight - (sum - partial) / (total - weight), 2);
      if (variance > best) { best = variance; threshold = i; }
    }
    for (let i = 0; i < out.data.length; i += 4) { const gray = (out.data[i] + out.data[i + 1] + out.data[i + 2]) / 3; out.data[i] = out.data[i + 1] = out.data[i + 2] = gray <= threshold ? 0 : 255; out.data[i + 3] = 255; }
    return out;
  }
  async function analyze(snapshot, primary, classifier, options = {}) {
    const start = performance.now(), originalText = primary.text || '', checks = [], edits = [];
    const finish = (reason, proposedText = null) => ({ originalText, text: originalText, proposedText, requiresConfirmation: !!proposedText,
      automaticallyChanged: false, reason, checks, edits, extraMs: performance.now() - start });
    const meaning = root.ASMachRequirements.assessReading(originalText);
    if (options.textMode || options.numericScope || primary.visualGdt || primary.measurementKind === 'gdt' || meaning.kind === 'gdt') return finish('excluded-gdt-or-prose');
    if (!primary.needsReview && primary.confidence >= 90 && meaning.valid) return finish('reliable-primary');
    if (!primary.words?.length) return finish('no-observed-character-boxes');
    let image = snapshot;
    if (typeof image === 'string') { image = new Image(); image.src = snapshot; await image.decode(); }
    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
    const words = structuredClone(primary.words), layout = root.ASMachMeasurementLayout;
    const before = layout.reconstruct(words, { width, height, ocr: true, details: true });
    const layoutMeaning = root.ASMachRequirements.assessReading(before.text || '');
    const layoutMatches = normalize(before.text) === normalize(originalText) || meaning.valid && layoutMeaning.valid && meaning.signature === layoutMeaning.signature;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    for (let wordIndex = 0; wordIndex < words.length && checks.length < 32; wordIndex++) {
      const word = words[wordIndex], angle = ((Number(word.angle ?? primary.angle) || 0) % 360 + 360) % 360;
      // Never classify sideways/upside-down boxes with a horizontal-only model.
      if (Math.min(angle, 360 - angle) > 4.5) continue;
      const symbols = word.symbols || [];
      if (!symbols.length || normalize(symbols.map(s => s.text).join('')) !== normalize(word.text)) continue;
      const heights = symbols.filter(s => /^[0-9A-ZØ]$/.test(s.text)).map(s => s.h * height).filter(v => v >= 5).sort((a, b) => a - b);
      const referenceHeight = heights.length ? heights[Math.floor(heights.length / 2)] : word.h * height;
      for (let symbolIndex = 0; symbolIndex < symbols.length && checks.length < 32; symbolIndex++) {
        const symbol = symbols[symbolIndex], observed = normalize(symbol.text);
        if (observed.length !== 1 || !classifier.labels.includes(observed)) continue;
        if (![symbol.x, symbol.y, symbol.w, symbol.h].every(Number.isFinite) || symbol.w <= 0 || symbol.h <= 0) continue;
        const x = Math.max(0, Math.floor(symbol.x * width) - 1), y = Math.max(0, Math.floor(symbol.y * height) - 1);
        const w = Math.min(width - x, Math.ceil((symbol.x + symbol.w) * width) + 1 - x), h = Math.min(height - y, Math.ceil((symbol.y + symbol.h) * height) + 1 - y);
        if (w < 2 || h < 2 || w * h > 100000 || referenceHeight < 6) continue;
        canvas.width = w; canvas.height = h; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, w, h); ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
        const pixels = ctx.getImageData(0, 0, w, h), gray = classifier.inferPixels(pixels, { referenceHeight }), binary = classifier.inferPixels(binarize(pixels), { referenceHeight });
        const acceptedForReview = allowedProposal(gray, binary), differs = gray.label !== observed;
        const check = { wordIndex, symbolIndex, observed, label: gray.label, binaryLabel: binary.label, score: gray.score, margin: gray.margin,
          binaryScore: binary.score, acceptedForReview, differs, box: { x, y, w, h }, referenceHeight };
        checks.push(check);
        if (acceptedForReview && related(observed, gray.label)) { edits.push({ wordIndex, symbolIndex, observed, proposed: gray.label }); symbol.text = gray.label; }
      }
      word.text = symbols.map(s => s.text).join('');
    }
    if (!edits.length) return finish(checks.length ? 'no-supported-change' : 'no-supported-segmentation');
    if (!layoutMatches) return finish('original-layout-not-equivalent');
    if (edits.length > 1) return finish('multiple-uncertain-characters');
    const after = layout.reconstruct(words, { width, height, ocr: true, details: true });
    if (!after.text || after.ambiguousSpacing || after.missingDigits) return finish('ambiguous-reconstructed-layout');
    const proposed = root.ASMachRequirements.assessReading(after.text);
    if (!proposed.valid || proposed.errors.length) return finish('proposal-fails-whole-measurement-validation');
    if (meaning.valid && proposed.signature === meaning.signature) return finish('no-semantic-change');
    return finish('review-suggestion-only', after.text);
  }
  const api = { analyze, _test: { normalize, related, allowedProposal, binarize } };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.PilotCharacterVerifier = api;
})(globalThis);
