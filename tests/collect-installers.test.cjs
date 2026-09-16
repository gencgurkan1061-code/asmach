'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectInstallers } = require('../scripts/collect-installers.cjs');

test('installer collection keeps distinct builds and is idempotent', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asmach-installers-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '3.0.4' }));
  const sourceDir = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
  fs.mkdirSync(sourceDir, { recursive: true });
  const source = path.join(sourceDir, 'ASMach Inspection_3.0.4_x64-setup.exe');
  fs.writeFileSync(source, 'first build');
  const first = collectInstallers(root);
  assert.equal(first.length, 1);
  assert.ok(first[0].path.includes(path.join('3.0.4', 'Yerel Derleme')));
  assert.equal(fs.readFileSync(first[0].path, 'utf8'), 'first build');
  assert.deepEqual(collectInstallers(root), first);
  fs.writeFileSync(source, 'second build');
  const second = collectInstallers(root);
  assert.notEqual(second[0].path, first[0].path);
  assert.equal(fs.readFileSync(first[0].path, 'utf8'), 'first build');
  assert.equal(fs.readFileSync(second[0].path, 'utf8'), 'second build');
  assert.deepEqual(collectInstallers(root, '3.0.4'), second);
});
