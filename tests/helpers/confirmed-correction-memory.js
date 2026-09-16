/* Isolated test prototype. Never import into the production application/bundle. */
(function (root) {
  'use strict';
  const encoder = new TextEncoder();
  const sha = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  const clone = value => structuredClone(value);
  const isText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
  const hashPattern = /^[a-f0-9]{64}$/;
  function canonical(context) {
    if (!context || !isText(context.project) || !isText(context.revision) || !hashPattern.test(context.document || '') ||
        !Number.isSafeInteger(context.page) || context.page < 1 ||
        !Array.isArray(context.box) || context.box.length !== 4 || context.box.some(n => !Number.isFinite(n)) ||
        context.box[0] < 0 || context.box[1] < 0 || context.box[2] <= 0 || context.box[3] <= 0 ||
        context.box[0] + context.box[2] > 1 || context.box[1] + context.box[3] > 1 ||
        !Number.isFinite(context.rotation ?? 0) || !['all', 'nominal', 'tolerance'].includes(context.scope || 'all')) return null;
    return { project: context.project, revision: context.revision, document: context.document, page: context.page,
      box: [...context.box], rotation: context.rotation ?? 0, scope: context.scope || 'all' };
  }
  async function prepare(context, image) {
    // Copy before awaiting hashing: callers cannot change the pending selection.
    const binding = canonical(context);
    if (!binding || !(image instanceof Uint8Array) || !image.byteLength || image.byteLength > 8 * 1024 * 1024) return null;
    binding.imageSha256 = await sha(image.slice());
    return { binding, key: await sha(encoder.encode(JSON.stringify(binding))) };
  }
  async function seal(row) {
    const payload = { schema: row.schema, key: row.key, binding: row.binding, text: row.text,
      originalOcrText: row.originalOcrText, revision: row.revision, version: row.version,
      confirmed: row.confirmed, labelKind: row.labelKind, createdAt: row.createdAt, confirmedAt: row.confirmedAt };
    return sha(encoder.encode(JSON.stringify(payload)));
  }
  async function valid(row, identity) {
    if (!row || row.schema !== 1 || row.key !== identity.key || JSON.stringify(row.binding) !== JSON.stringify(identity.binding) ||
        row.confirmed !== true || row.labelKind !== 'visual-transcription' || typeof row.text !== 'string' || !row.text.trim() ||
        row.text.length > 4096 || typeof row.originalOcrText !== 'string' || row.originalOcrText.length > 4096 ||
        !isText(row.revision) || !Number.isSafeInteger(row.version) || row.version < 1 ||
        !Number.isFinite(row.createdAt) || !Number.isFinite(row.confirmedAt) || !hashPattern.test(row.checksum || '')) return false;
    // Accidental-corruption check only; this is not a cryptographic signature.
    return await seal(row) === row.checksum;
  }
  class ConfirmedCorrectionMemory {
    constructor({ databaseName, maximumEntries = 5000, databaseFactory = indexedDB, beforeCommit = null } = {}) {
      if (!/^asmach-test-[a-z0-9-]+$/.test(databaseName || '')) throw Error('A dedicated test database is required');
      if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 1) throw Error('Invalid test capacity');
      this.databaseName = databaseName; this.maximumEntries = maximumEntries;
      this.databaseFactory = databaseFactory; this.beforeCommit = beforeCommit; this.opening = null;
    }
    async open() {
      if (!this.opening) this.opening = new Promise((resolve, reject) => {
        const request = this.databaseFactory.open(this.databaseName, 1);
        request.onupgradeneeded = () => { request.result.createObjectStore('corrections', { keyPath: 'key' }); request.result.createObjectStore('settings'); };
        request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); this.opening = null; }; resolve(request.result); };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(Error('Storage upgrade blocked'));
      }).catch(error => { this.opening = null; throw error; });
      return this.opening;
    }
    async transaction(mode, work) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['corrections', 'settings'], mode);
        let result, failure;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(failure || tx.error || Error('Storage transaction aborted'));
        tx.onerror = () => {};
        const fail = error => { failure = error; try { tx.abort(); } catch { reject(error); } };
        try { work(tx.objectStore('corrections'), tx.objectStore('settings'), value => { result = value; }, fail); } catch (error) { fail(error); }
      });
    }
    async load(key) {
      return this.transaction('readonly', (rows, settings, done) => {
        const entry = rows.get(key), enabled = settings.get('enabled');
        let count = 0; const finish = () => { if (++count === 2) done({ row: entry.result, enabled: enabled.result !== false }); };
        entry.onsuccess = finish; enabled.onsuccess = finish;
      });
    }
    async recall(context, image) {
      try {
        const identity = await prepare(context, image);
        if (!identity) return { status: 'invalid' };
        const loaded = await this.load(identity.key);
        if (!loaded.enabled) return { status: 'disabled' };
        if (!loaded.row) return { status: 'miss' };
        if (!await valid(loaded.row, identity)) return { status: 'corrupt' };
        return { status: 'hit', entry: clone(loaded.row) };
      } catch (error) { return { status: 'unavailable', reason: error.name || 'StorageError' }; }
    }
    async record(context, image, event) {
      try {
        if (!event || event.confirmed !== true || event.labelKind !== 'visual-transcription' ||
            typeof event.text !== 'string' || !event.text.trim() || event.text.length > 4096 ||
            (event.originalOcrText !== undefined && (typeof event.originalOcrText !== 'string' || event.originalOcrText.length > 4096)) ||
            !(event.expectedRevision === null || isText(event.expectedRevision))) return { status: 'rejected' };
        const input = clone(event), identity = await prepare(context, image);
        if (!identity) return { status: 'invalid' };
        const loaded = await this.load(identity.key);
        if (!loaded.enabled) return { status: 'disabled' };
        if (loaded.row && !await valid(loaded.row, identity)) return { status: 'corrupt' };
        if ((loaded.row?.revision ?? null) !== input.expectedRevision) return { status: 'conflict' };
        const now = Date.now(), next = { schema: 1, ...identity, text: input.text,
          originalOcrText: input.originalOcrText ?? loaded.row?.originalOcrText ?? '',
          revision: crypto.randomUUID(), version: (loaded.row?.version || 0) + 1,
          confirmed: true, labelKind: 'visual-transcription', createdAt: loaded.row?.createdAt ?? now, confirmedAt: now };
        next.checksum = await seal(next);
        return await this.transaction('readwrite', (rows, settings, done, fail) => {
          const entry = rows.get(identity.key), enabled = settings.get('enabled'), count = rows.count();
          let ready = 0; const finish = () => {
            if (++ready !== 3) return;
            if (enabled.result === false) return done({ status: 'disabled' });
            if ((entry.result?.revision ?? null) !== input.expectedRevision || entry.result?.checksum !== loaded.row?.checksum) return done({ status: 'conflict' });
            if (!entry.result && count.result >= this.maximumEntries) return done({ status: 'full' });
            try {
              rows.put(next);
              if (this.beforeCommit) this.beforeCommit();
              done({ status: 'saved', revision: next.revision, version: next.version });
            } catch (error) { fail(error); }
          };
          entry.onsuccess = finish; enabled.onsuccess = finish; count.onsuccess = finish;
        });
      } catch (error) { return { status: 'unavailable', reason: error.name || 'StorageError' }; }
    }
    async forget(context, image, expectedRevision) {
      try {
        const identity = await prepare(context, image);
        if (!identity || !isText(expectedRevision)) return { status: 'invalid' };
        return await this.transaction('readwrite', (rows, settings, done) => {
          const request = rows.get(identity.key);
          request.onsuccess = () => {
            if (request.result?.revision !== expectedRevision) return done({ status: 'conflict' });
            rows.delete(identity.key); done({ status: 'deleted' });
          };
        });
      } catch (error) { return { status: 'unavailable', reason: error.name || 'StorageError' }; }
    }
    async clearProject(project) {
      if (!isText(project)) return { status: 'invalid' };
      try {
        return await this.transaction('readwrite', (rows, settings, done) => {
          let count = 0; const request = rows.openCursor();
          request.onsuccess = () => { const cursor = request.result; if (!cursor) return done({ status: 'cleared', count });
            if (cursor.value.binding?.project === project) { cursor.delete(); count++; } cursor.continue(); };
        });
      } catch (error) { return { status: 'unavailable', reason: error.name || 'StorageError' }; }
    }
    async setEnabled(enabled) {
      if (typeof enabled !== 'boolean') return { status: 'invalid' };
      try { return await this.transaction('readwrite', (rows, settings, done) => { settings.put(enabled, 'enabled'); done({ status: enabled ? 'enabled' : 'disabled' }); }); }
      catch (error) { return { status: 'unavailable', reason: error.name || 'StorageError' }; }
    }
    async close() { if (this.opening) { (await this.opening).close(); this.opening = null; } }
  }
  root.PilotCorrectionMemory = ConfirmedCorrectionMemory;
})(globalThis);
