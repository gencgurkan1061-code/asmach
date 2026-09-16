'use strict';
// Test-only browser profile and local database; never edits app code or installer.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), http = require('node:http');
let pw;
try { pw = require(process.env.ASMACH_PLAYWRIGHT_MODULE || 'playwright'); }
catch (error) { if (process.env.ASMACH_PLAYWRIGHT_MODULE) throw error; pw = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const outputBase = path.join(root, 'outputs/confirmed-memory-tests'); fs.mkdirSync(outputBase, { recursive: true });
const output = fs.mkdtempSync(path.join(outputBase, 'run-'));
const manifestBytes = fs.readFileSync(path.join(root, 'tests/fixtures/ocr-100/manifest.json'));
const manifest = JSON.parse(manifestBytes);
const prototypePath = 'tests/helpers/confirmed-correction-memory.js';
const protectedFiles = ['src/ocr-engine.js', 'src/requirements-engine.js', 'src/app.template.html', 'src/candidate-correction.js',
  'ASMach_Teknik_Resim_Balonlama.html', 'ocr/technical-model/activation.json', 'package.json',
  ...['eng', 'tur', 'deu'].map(lang => `ocr/lang/${lang}.traineddata.gz`)];
const protectedHashes = () => Object.fromEntries(protectedFiles.map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
const before = protectedHashes(), appBytes = fs.readFileSync(path.join(root, 'ASMach_Teknik_Resim_Balonlama.html'));
// Renderer text is only the numeric cell for compound layouts. Reconstruct the
// complete approved reading from the authored drawing inputs, never OCR output
// or expected parsed fields. MAX/MIN and separators encode the drawn layout.
function authoredReading(c) {
  if (c.layout === 'stacked') return `${c.text} ${c.upper}/${c.lower}`;
  if (c.layout === 'limits') return `${c.prefix || ''}${c.text} MAX ${c.lower} MIN`;
  if (c.layout === 'gdt') {
    const symbols = { position: '⌖', flatness: '⏥', straightness: '⏤', perpendicularity: '⟂', parallelism: '∥',
      circularity: '○', concentricity: '◎', angularity: '∠', profile: '⌒', profile_surface: '⌓', runout: '↗' };
    if (!symbols[c.subtype]) throw Error('Missing authored GD&T symbol: ' + c.subtype);
    return [symbols[c.subtype], `${c.diameter ? 'Ø' : ''}${c.text}${c.mmc ? 'Ⓜ' : ''}`, ...c.datums].join(' | ');
  }
  return c.text;
}
const fixtures = manifest.cases.map((c, i) => {
  const bytes = fs.readFileSync(path.join(root, 'tests/fixtures/ocr-100', c.file));
  if (hash(bytes) !== c.sha256) throw Error('Fixture changed: ' + c.id);
  return { ...c, rendererText: c.text, text: authoredReading(c), base64: bytes.toString('base64'), context: { project: 'corpus-project', revision: 'A', document: hash(manifestBytes), page: i + 1,
    box: [.1, .2, .6, .4], rotation: c.rotation || 0, scope: 'all' } };
});
const results = [], blocked = [], pageErrors = []; let context, page, origin, server;
async function check(name, fn) {
  const start = Date.now();
  try { const details = await fn(); results.push({ name, passed: true, ms: Date.now() - start, details }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, ms: Date.now() - start, error: error.stack || String(error) }); console.log('FAIL ' + name + ': ' + error.message); }
}
async function start() {
  context = await pw.chromium.launchPersistentContext(path.join(output, 'browser-profile'), { channel: 'msedge', headless: true });
  await context.route(/^https?:/, route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    blocked.push(route.request().url()); return route.abort();
  });
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin + '/app');
  await page.waitForFunction(() => !!window.ASMachApp?.parseRequirement);
  await install(page);
}
async function install(target) {
  await target.addScriptTag({ content: fs.readFileSync(path.join(root, prototypePath), 'utf8') });
  await target.evaluate(cases => {
    window.cases = cases;
    window.bytes = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    window.cx = { ...cases[0].context, project: 'scenario-project' };
    window.img = bytes(cases[0].base64);
    window.eventFor = (text, revision = null) => ({ text, confirmed: true, labelKind: 'visual-transcription', expectedRevision: revision, originalOcrText: 'original-test-ocr' });
    window.must = (condition, message = 'Assertion failed') => { if (!condition) throw Error(message); };
    window.isStatus = (result, expected) => must(result.status === expected, JSON.stringify({ result, expected }));
    window.memory = new PilotCorrectionMemory({ databaseName: 'asmach-test-scenarios' });
    window.corpusMemory = new PilotCorrectionMemory({ databaseName: 'asmach-test-corpus' });
    window.lookupOrOcr = async (memory, context, image, fallback) => {
      const recalled = await memory.recall(context, image);
      if (recalled.status === 'hit') return { text: recalled.entry.text, source: 'confirmed-memory', memoryStatus: recalled.status };
      return { ...await fallback(), source: 'ocr', memoryStatus: recalled.status };
    };
  }, fixtures);
}
(async () => {
  server = http.createServer((req, res) => { if (req.url !== '/app') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(appBytes); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await start();
    await check('Bileşik çizim etiketleri tolerans, GD&T simgesi ve datumları içerir', async () => {
      const expectedReadings = { m009: '47.5 +0.12/-0.08', m011: '0.739 MAX 0.729 MIN', m020: 'Ø0.367 MAX 0.359 MIN', m075: '⌖ | Ø0.008Ⓜ | A' };
      for (const [id, text] of Object.entries(expectedReadings)) if (fixtures.find(c => c.id === id).text !== text) throw Error('Incomplete authored label: ' + id);
      return { expandedCompoundReadings: fixtures.filter(c => c.rendererText !== c.text).length, expectedFieldsUsedAsLabels: false };
    });
    await check('Kayıtsız görüntü hatırlanmış sayılmaz', () => page.evaluate(async () => isStatus(await memory.recall(cx, img), 'miss')));
    for (const kind of ['automatic-ocr', 'computed-nominal', 'requirement', 'type-change', 'tolerance-field']) {
      await check('Alan değişikliği öğrenilmez: ' + kind, () => page.evaluate(async kind => {
        isStatus(await memory.record(cx, img, { ...eventFor('25'), labelKind: kind }), 'rejected');
        isStatus(await memory.recall(cx, img), 'miss');
      }, kind));
    }
    for (const confirmed of [false, undefined, 'true', 1]) {
      await check('Açık onay olmadan kayıt yok: ' + String(confirmed), () => page.evaluate(async confirmed => {
        isStatus(await memory.record(cx, img, { ...eventFor('25'), confirmed }), 'rejected');
      }, confirmed));
    }
    await check('Onaylı metin, ham OCR ve Unicode simgeler birlikte korunur', () => page.evaluate(async () => {
      const text = '⌖ | Ø0.008Ⓜ | A\nRa 3.2 µm';
      isStatus(await memory.record(cx, img, eventFor(text)), 'saved');
      const r = await memory.recall(cx, img); isStatus(r, 'hit');
      must(r.entry.text === text && r.entry.originalOcrText === 'original-test-ocr' && r.entry.version === 1);
    }));
    const changes = [ ['proje', { project: 'another-project' }], ['revizyon', { revision: 'B' }], ['belge', { document: 'b'.repeat(64) }],
      ['sayfa', { page: 2 }], ['kutu konumu', { box: [.11, .2, .6, .4] }], ['kutu boyutu', { box: [.1, .2, .59, .4] }],
      ['döndürme', { rotation: 90 }], ['nominal seçimi', { scope: 'nominal' }], ['tolerans seçimi', { scope: 'tolerance' }] ];
    for (const [label, change] of changes) await check('Farklı ' + label + ' eski düzeltmeyi almaz', () => page.evaluate(async change => {
      isStatus(await memory.recall({ ...cx, ...change }, img), 'miss');
    }, change));
    await check('Görüntüde tek bayt değişince eşleşme reddedilir', () => page.evaluate(async () => { const changed = img.slice(); changed[changed.length - 1] ^= 1; isStatus(await memory.recall(cx, changed), 'miss'); }));
    await check('Okunan nesne değiştirilince kayıt bozulmaz', () => page.evaluate(async () => { const r = await memory.recall(cx, img); r.entry.text = '999'; r.entry.binding.project = 'other'; must((await memory.recall(cx, img)).entry.text.startsWith('⌖')); }));
    await check('Kaynak, görüntü ve metin işlem sürerken değiştirilemez', () => page.evaluate(async () => {
      const original = { ...cx, project: 'pending-project', box: [...cx.box] }, mutable = structuredClone(original), image = img.slice(), event = eventFor('0.205 MAX 0.198 MIN');
      const pending = memory.record(mutable, image, event); mutable.project = 'other'; mutable.box[0] = .4; image[0] ^= 1; event.text = '99';
      isStatus(await pending, 'saved'); must((await memory.recall(original, img)).entry.text === '0.205 MAX 0.198 MIN');
    }));
    await check('Geçersiz kaynaklar, boş metin ve aşırı boyutlar kayıt oluşturmaz', () => page.evaluate(async () => {
      const invalid = [{ project: '' }, { revision: '' }, { document: 'file-name.pdf' }, { page: 0 }, { page: 1.5 }, { box: [-.1, .2, .6, .4] },
        { box: [.8, .2, .6, .4] }, { box: [.1, .2, 0, .4] }, { box: [NaN, .2, .6, .4] }, { scope: 'all-fields' }, { rotation: NaN }];
      for (const change of invalid) isStatus(await memory.record({ ...cx, ...change }, img, eventFor('25')), 'invalid');
      for (const text of ['', ' \n ', 'a'.repeat(4097)]) isStatus(await memory.record(cx, img, eventFor(text)), 'rejected');
      for (const image of [new Uint8Array(), new Uint8Array(8 * 1024 * 1024 + 1), 'not-bytes']) isStatus(await memory.record(cx, image, eventFor('25')), 'invalid');
      isStatus(await memory.record(cx, img, { ...eventFor('25'), expectedRevision: undefined }), 'rejected');
      return { rejectedInputs: invalid.length + 7 };
    }));
    await check('Aynı kayda eşzamanlı iki ilk onaydan yalnız biri kaydedilir', () => page.evaluate(async () => {
      const c = { ...cx, project: 'concurrent-create' };
      const r = await Promise.all([memory.record(c, img, eventFor('10')), memory.record(c, img, eventFor('20'))]);
      must(r.filter(x => x.status === 'saved').length === 1 && r.filter(x => x.status === 'conflict').length === 1, JSON.stringify(r));
      const winner = r[0].status === 'saved' ? '10' : '20'; must((await memory.recall(c, img)).entry.text === winner);
    }));
    await check('Yeniden onaylanan düzeltme güncellenir, eski pencere yenisini ezemez', async () => {
      const other = await context.newPage(); await other.goto(origin + '/app'); await install(other);
      try {
        const staleRevision = await other.evaluate(async () => (await memory.recall(cx, img)).entry.revision);
        await page.evaluate(async revision => { isStatus(await memory.record(cx, img, eventFor('Ø25 ±0.1', revision)), 'saved'); }, staleRevision);
        await other.evaluate(async revision => { isStatus(await memory.record(cx, img, eventFor('Ø250 ±0.1', revision)), 'conflict'); must((await memory.recall(cx, img)).entry.text === 'Ø25 ±0.1'); }, staleRevision);
      } finally { await other.close(); }
    });
    await check('Eski silme isteği yeni onayı silemez; güncel istek silebilir', () => page.evaluate(async () => {
      const c = { ...cx, project: 'delete-project' }, first = await memory.record(c, img, eventFor('10'));
      const second = await memory.record(c, img, eventFor('11', first.revision));
      isStatus(await memory.forget(c, img, first.revision), 'conflict');
      isStatus(await memory.forget(c, img, second.revision), 'deleted'); isStatus(await memory.recall(c, img), 'miss');
      const third = await memory.record(c, img, eventFor('12')); isStatus(third, 'saved');
      isStatus(await memory.record(c, img, eventFor('99', first.revision)), 'conflict');
    }));
    await check('Proje hafızasını silmek diğer projeleri etkilemez', () => page.evaluate(async () => {
      const a = { ...cx, project: 'clear-this' }, b = { ...cx, project: 'keep-this' };
      isStatus(await memory.record(a, img, eventFor('11')), 'saved'); isStatus(await memory.record(b, img, eventFor('22')), 'saved');
      const r = await memory.clearProject('clear-this'); must(r.status === 'cleared' && r.count === 1);
      isStatus(await memory.recall(a, img), 'miss'); must((await memory.recall(b, img)).entry.text === '22');
    }));
    await check('Bozuk kayıt veya bilinmeyen şema yanlış değer olarak kullanılmaz', () => page.evaluate(async () => {
      const c = { ...cx, project: 'corrupt-project' }; await memory.record(c, img, eventFor('25'));
      const original = (await memory.recall(c, img)).entry;
      for (const change of [{ text: '999' }, { schema: 999 }, { checksum: '0'.repeat(64) }, { binding: { ...original.binding, page: 99 } }]) {
        await memory.transaction('readwrite', (rows, settings, done) => { rows.put({ ...original, ...change }); done(true); });
        isStatus(await memory.recall(c, img), 'corrupt');
        isStatus(await memory.record(c, img, eventFor('30', original.revision)), 'corrupt');
      }
      await memory.clearProject('corrupt-project'); return { corruptionsRejected: 4 };
    }));
    await check('Yazma yarıda kesilirse eski onaylı kayıt korunur', () => page.evaluate(async () => {
      const c = { ...cx, project: 'abort-project' }, first = await memory.record(c, img, eventFor('25'));
      const faulty = new PilotCorrectionMemory({ databaseName: 'asmach-test-scenarios', beforeCommit: () => { throw new DOMException('Injected interrupted write', 'AbortError'); } });
      isStatus(await faulty.record(c, img, eventFor('999', first.revision)), 'unavailable');
      must((await memory.recall(c, img)).entry.text === '25'); await faulty.close();
    }));
    await check('Depolama kotası hatasında kaydedildi denmez', () => page.evaluate(async () => {
      const c = { ...cx, project: 'quota-project' };
      const faulty = new PilotCorrectionMemory({ databaseName: 'asmach-test-scenarios', beforeCommit: () => { throw new DOMException('Injected quota error', 'QuotaExceededError'); } });
      const r = await faulty.record(c, img, eventFor('999')); must(r.status === 'unavailable' && r.reason === 'QuotaExceededError');
      isStatus(await memory.recall(c, img), 'miss'); await faulty.close();
    }));
    await check('Depolama kullanılamazsa normal OCR yoluna dönülür', () => page.evaluate(async () => {
      const faulty = new PilotCorrectionMemory({ databaseName: 'asmach-test-denied', databaseFactory: { open() { throw new DOMException('Injected storage denial', 'SecurityError'); } } });
      isStatus(await faulty.record(cx, img, eventFor('25')), 'unavailable'); let calls = 0;
      const r = await lookupOrOcr(faulty, cx, img, async () => { calls++; return { text: 'OCR fallback' }; });
      must(r.source === 'ocr' && r.memoryStatus === 'unavailable' && calls === 1);
    }));
    await check('Kapasite dolunca eski düzeltmeler atılmaz, mevcut kayıt güncellenebilir', () => page.evaluate(async () => {
      const m = new PilotCorrectionMemory({ databaseName: 'asmach-test-capacity', maximumEntries: 2 });
      const a = { ...cx, page: 1 }, b = { ...cx, page: 2 }, c = { ...cx, page: 3 };
      const first = await m.record(a, img, eventFor('1')); isStatus(await m.record(b, img, eventFor('2')), 'saved');
      isStatus(await m.record(c, img, eventFor('3')), 'full'); isStatus(await m.record(a, img, eventFor('1.1', first.revision)), 'saved');
      must((await m.recall(a, img)).entry.text === '1.1' && (await m.recall(b, img)).entry.text === '2'); await m.close();
    }));
    await check('Kapatma ayarı tüm pencerelerde okumayı ve öğrenmeyi durdurur', () => page.evaluate(async () => {
      isStatus(await memory.setEnabled(false), 'disabled');
      const second = new PilotCorrectionMemory({ databaseName: 'asmach-test-scenarios' });
      isStatus(await second.recall(cx, img), 'disabled'); isStatus(await second.record({ ...cx, page: 5 }, img, eventFor('25')), 'disabled');
      let calls = 0; const r = await lookupOrOcr(second, cx, img, async () => { calls++; return { text: 'normal OCR' }; });
      must(calls === 1 && r.source === 'ocr'); await second.close();
    }));
    let corpusBefore;
    await check('16 ölçü ailesinden 100 onaylı metin kalıcı hafızaya yazılır', async () => {
      corpusBefore = await page.evaluate(async () => {
        const result = [];
        for (const c of cases) {
          const written = await corpusMemory.record(c.context, bytes(c.base64), { ...eventFor(c.text), originalOcrText: 'simulated-pre-correction:' + c.id }); isStatus(written, 'saved');
          let parsed = ASMachApp.parseRequirement(c.text, c.generalTolerance || '');
          if (c.typeContext) { parsed = ASMachRequirements.transitionType(parsed, c.typeContext); parsed.type = c.typeContext; }
          result.push({ id: c.id, parsed, requirement: ASMachRequirements.generateRequirement({ ...parsed, requirementText: c.text }) });
        } return result;
      }); return { records: corpusBefore.length, families: Object.keys(manifest.families).length };
    });
    await check('1000 kayıt yükünde ek kayıtlar kaybolmadan saklanır', () => page.evaluate(async () => {
      const started = performance.now();
      for (let batch = 0; batch < 900; batch += 20) {
        const pending = Array.from({ length: 20 }, (_, i) => { const n = batch + i; return corpusMemory.record({ ...cx, project: 'load-project', page: n + 1 }, img, eventFor('LOAD ' + n)); });
        for (const r of await Promise.all(pending)) isStatus(r, 'saved');
      }
      const count = await corpusMemory.transaction('readonly', (rows, settings, done) => { const r = rows.count(); r.onsuccess = () => done(r.result); });
      must(count === 1000, String(count)); return { totalRecords: count, insertionMs: performance.now() - started };
    }));
    // Close the whole browser, not just a JS object: exercises actual disk persistence.
    await check('Tarayıcı tamamen kapatılıp aynı ayrı profille yeniden açılır', async () => { await context.close(); context = null; await start(); });
    await check('Hafızayı kapatma tercihi yeniden açılışta korunur', () => page.evaluate(async () => {
      isStatus(await memory.recall(cx, img), 'disabled');
      isStatus(await memory.setEnabled(true), 'enabled');
      must((await memory.recall(cx, img)).entry.text === 'Ø25 ±0.1');
      isStatus(await memory.recall({ ...cx, project: 'clear-this' }, img), 'miss');
    }));
    let corpusAfter;
    await check('Yeniden açılışta 100/100 metin, alan ve gereklilik aynı kalır', async () => {
      corpusAfter = await page.evaluate(async () => {
        const results = [];
        for (const c of cases) {
          const started = performance.now(), recalled = await corpusMemory.recall(c.context, bytes(c.base64)), lookupMs = performance.now() - started;
          isStatus(recalled, 'hit'); must(recalled.entry.text === c.text, c.id + ' text changed');
          must(recalled.entry.originalOcrText === 'simulated-pre-correction:' + c.id, c.id + ' evidence changed');
          let parsed = ASMachApp.parseRequirement(recalled.entry.text, c.generalTolerance || '');
          if (c.typeContext) { parsed = ASMachRequirements.transitionType(parsed, c.typeContext); parsed.type = c.typeContext; }
          const value = (o, key) => key.split('.').reduce((a, k) => a?.[k], o);
          const failures = Object.entries(c.expected).filter(([key, expected]) => {
            const actual = value(parsed, key);
            return typeof expected === 'number' ? String(actual ?? '').trim() === '' || !Number.isFinite(Number(actual)) || Math.abs(Number(actual) - expected) > 1e-9 : actual !== expected;
          }).map(([field, expected]) => ({ field, expected, actual: value(parsed, field) ?? null }));
          results.push({ id: c.id, family: c.family, lookupMs, parsed, requirement: ASMachRequirements.generateRequirement({ ...parsed, requirementText: recalled.entry.text }), failures });
        } return results;
      });
      for (const after of corpusAfter) {
        const before = corpusBefore.find(row => row.id === after.id);
        if (JSON.stringify(before.parsed) !== JSON.stringify(after.parsed) || before.requirement !== after.requirement) throw Error('Parsing changed after persistence: ' + after.id);
      }
      return { rememberedExactly: corpusAfter.length, fieldsAndRequirementUnchanged: corpusAfter.length, parserExactCases: corpusAfter.filter(r => !r.failures.length).length,
        parserFailures: corpusAfter.filter(r => r.failures.length).map(r => ({ id: r.id, failures: r.failures })) };
    });
    await check('Tam onaylı metinler mevcut ayrıştırıcıda beklenen 100 ölçüyle karşılaştırılır', async () => {
      const failed = (corpusAfter || []).filter(r => r.failures.length);
      if (!corpusAfter || corpusAfter.length !== 100 || failed.length) throw Error(JSON.stringify(failed.map(r => ({ id: r.id, failures: r.failures }))));
      return { exactCases: corpusAfter.length };
    });
    await check('Yük testindeki ek 900 kayıt da yeniden açılışta eksiksizdir', () => page.evaluate(async () => {
      let matched = 0;
      for (let n = 0; n < 900; n++) {
        const r = await corpusMemory.recall({ ...cx, project: 'load-project', page: n + 1 }, img);
        isStatus(r, 'hit'); must(r.entry.text === 'LOAD ' + n); matched++;
      }
      return { loadRecordsRetained: matched };
    }));
    await check('100 ölçüde 600 farklı kaynak bağlamı yanlış eşleşmez', () => page.evaluate(async () => {
      let misses = 0;
      for (const c of cases) for (const change of [{ project: 'other-corpus' }, { revision: 'B' }, { document: 'f'.repeat(64) }, { page: 1000 + c.context.page }, { scope: 'nominal' }, { box: [.11, .2, .6, .4] }]) {
        isStatus(await corpusMemory.recall({ ...c.context, ...change }, bytes(c.base64)), 'miss'); misses++;
      } return { mismatchesRejected: misses };
    }));
    await check('Silinmiş ölçü tarayıcı yeniden açılınca geri gelmez', () => page.evaluate(async () => {
      const m = new PilotCorrectionMemory({ databaseName: 'asmach-test-scenarios' });
      isStatus(await m.recall({ ...cx, project: 'clear-this' }, img), 'miss');
      must((await m.recall({ ...cx, project: 'keep-this' }, img)).entry.text === '22'); await m.close();
    }));
    await check('Hafıza metni HTML olarak çalıştırılmaz', () => page.evaluate(async () => {
      const c = { ...cx, project: 'plain-text' }, text = '<img src=x onerror="window.unwantedExecution=1">';
      isStatus(await memory.record(c, img, eventFor(text)), 'saved');
      const view = document.createElement('textarea'); view.value = (await memory.recall(c, img)).entry.text; document.body.append(view);
      must(view.value === text && window.unwantedExecution === undefined); view.remove();
    }));
    await check('Geciken sonuç başka seçime uygulanmaz: test bağlantısı', () => page.evaluate(async () => {
      let selection = 1, applied = null, release;
      const gate = new Promise(resolve => { release = resolve; });
      const captured = selection;
      const pending = (async () => { const result = await corpusMemory.recall(cases[0].context, bytes(cases[0].base64)); await gate;
        if (captured === selection && result.status === 'hit') applied = result.entry.text; })();
      selection = 2; release(); await pending; must(applied === null);
    }));
    await check('Onaylı aynı görüntü OCR motorunu tekrar çağırmaz; farklı görüntü çağırır', () => page.evaluate(async () => {
      const selected = ['m001', 'm014', 'm015', 'm038', 'm067', 'm075'].map(id => cases.find(c => c.id === id));
      let calls = 0; const readings = [];
      for (const c of selected) {
        const image = bytes(c.base64);
        const fallback = async () => { calls++; const started = performance.now(); const r = await ASMachOCR.recognize('data:image/png;base64,' + c.base64, { refresh: true, enhancement: 'auto' });
          if (r.error) throw Error(r.error); return { text: r.text, ocrMs: performance.now() - started }; };
        const saved = await lookupOrOcr(corpusMemory, c.context, image, fallback);
        must(saved.source === 'confirmed-memory' && saved.text === c.text);
        const fresh = await lookupOrOcr(corpusMemory, { ...c.context, revision: 'never-confirmed' }, image, fallback);
        must(fresh.source === 'ocr' && fresh.memoryStatus === 'miss'); readings.push({ id: c.id, remembered: saved.text, freshOcr: fresh.text, freshOcrMs: fresh.ocrMs });
      }
      must(calls === selected.length); await ASMachOCR.terminate(); return { memoryHits: selected.length, realOcrFallbacks: calls, readings };
    }));
    await check('Üretim kaynakları, OCR modeli ve etkinleştirme ayarı değişmedi', async () => {
      const after = protectedHashes(); if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Production artifacts changed');
      if (JSON.parse(fs.readFileSync(path.join(root, 'ocr/technical-model/activation.json'))).enabled) throw Error('Training candidate unexpectedly enabled');
      return { protectedFiles: protectedFiles.length, modelEnabled: false };
    });
    await check('Hiçbir veri harici ağa gönderilmedi', async () => { if (blocked.length) throw Error(JSON.stringify(blocked)); });
    const times = (corpusAfter || []).map(r => r.lookupMs).sort((a, b) => a - b), sum = times.reduce((n, t) => n + t, 0);
    const report = { schema: 1, createdAt: new Date().toISOString(), synthetic: true, realUserCorrections: 0, prototypeOnly: true,
      productionIntegrated: false, storage: 'IndexedDB in a new isolated headless Edge profile', outputDirectory: output,
      totalTests: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length,
      manifestSha256: hash(manifestBytes), prototypeSha256: hash(fs.readFileSync(path.join(root, prototypePath))), protectedHashes: before,
      labelSource: 'Full approved readings reconstructed from original renderer inputs (text, upper/lower, prefix, symbol, datums); not OCR results or expected fields',
      fixtureCorrection: 'Initial run used only the renderer text field and omitted 18 compound callouts. Those initial results are retained separately; the fixture adapter now includes every drawn cell.',
      lookupPerformance: { samples: times.length, meanMs: times.length ? sum / times.length : null, p50Ms: times[Math.floor(times.length / 2)], p95Ms: times[Math.ceil(times.length * .95) - 1], maxMs: times[times.length - 1],
        includes: 'image byte decoding, SHA-256, IndexedDB lookup and stored-row integrity verification; excludes PDF rendering' },
      blockedExternalRequests: blocked, pageErrors, results, corpusResults: corpusAfter };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    const parserExact = (corpusAfter || []).filter(r => !r.failures.length).length;
    const markdown = `# Onaylı düzeltme hafızası testi\n\nTarih: ${report.createdAt}. Yalnızca ayrı test profili/prototipi kullanıldı; çalışan uygulamaya veya kurulum paketine özellik eklenmedi.\n\n## Sonuç\n\n- Kontrol: **${report.passed}/${report.totalTests} başarılı**, ${report.failed} başarısız.\n- 16 ölçü ailesinden 100 sentetik, önceden doğru metni belirlenmiş örnek kullanıldı. Gerçek kullanıcı onayı toplanmadı; onay olayları testte simüle edildi.\n- 1000 kayıt yükü, tam tarayıcı kapatma/açma, onaylı metinlerin yeniden okunması ve 600 yanlış kaynak eşleşmesi kontrol edildi.\n- Kayıtlı doğru metnin mevcut ayrıştırıcıdan geçirilmesi: ${parserExact}/100 beklenen alanlarla eşleşti. Bu bir OCR tanıma başarı oranı değildir; hafıza testindeki metinler önceden doğru olarak verildi.\n- Ortalama hatırlama: ${report.lookupPerformance.meanMs?.toFixed(2)} ms; %95: ${report.lookupPerformance.p95Ms?.toFixed(2)} ms. Görüntü özeti ve veritabanı doğrulaması dahil, PDF görüntü oluşturma hariç. Tek bilgisayardaki pilot ölçümüdür.\n\n## Kontroller\n\n${results.map(r => `- ${r.passed ? 'GEÇTİ' : 'BAŞARISIZ'} — ${r.name}${r.passed ? '' : ': ' + r.error.split('\n')[0]}`).join('\n')}\n\n## Sınırlar\n\n- Hafıza aynı kaynak/görüntünün onaylı metnini hatırlar; yeni yazı tiplerini veya benzer görüntüleri öğrenmez.\n- Bozuk/kayıtsız/kapalı/depolaması kullanılamayan hafıza için normal OCR yolu test bağlantısında açık kalır. Depolama hataları ve yarıda kesilme kontrollü olarak enjekte edildi; elektrik kesintisi/disk arızası uygulanmadı.\n- Kalıcılık ayrı Edge/IndexedDB profilinde test edildi. Mevcut masaüstü uygulamasının SQLite deposuna entegrasyon, gerçek müşteri projeleri, kurulum/yükseltme/taşıma ve çok kullanıcılı kullanım henüz test edilmedi.\n- Arayüzde gerçek onay düğmesi, kalıcı kayıt yönetimi ve üretim bağlantısı yoktur. Düz metin gösterimi ile geciken seçimin elenmesi test bağlantısına aittir.\n- Veri bütünlüğü özeti yanlışlıkla bozulmayı yakalar; şifreleme veya kötü niyetli değişikliklere karşı imza değildir.\n- Görüntü yeniden kodlanır, kırpılır veya büyütülürse güvenli tarafta kalıp eşleşmeyebilir. Yalnız onaylanan kaynak metin saklanır; nominal/tolerans/gereklilik yeniden güncel kurallarla hesaplanır.\n\nAyrıntılar: aynı klasördeki report.json. Test veritabanı browser-profile altındadır ve yalnız sentetik test verileri içerir.\n`;
    const fixtureNote = '\n## Test etiketi düzeltmesi\n\nİlk denemede 18 bileşik çizim için yalnız ana sayı kullanıldığı fark edildi. Tam okuma; çizimi oluşturan özgün tolerans, simge, datum ve alt/üst satır verilerinden tamamlandı. Beklenen sonuç alanları veya OCR çıktısı etiket üretiminde kullanılmadı; önceki deneme ayrı klasörde korundu. MAX/MIN ve hücre ayırıcıları çizim yerleşiminin metinsel karşılığıdır, hesaplanan nominal etiket yapılmadı. Bu metinler model eğitimine aktarılmadı.\n';
    fs.writeFileSync(path.join(output, 'report.md'), markdown + fixtureNote);
    console.log(JSON.stringify({ output, passed: report.passed, failed: report.failed, lookupPerformance: report.lookupPerformance, parserExactCases: parserExact }, null, 2));
    if (report.failed) process.exitCode = 1;
  } finally { if (context) await context.close(); if (server) await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
