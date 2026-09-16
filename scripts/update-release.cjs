/* Owner-only release signing. Never distribute .release-admin/update-private.pem. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const privateDir = path.join(root, '.release-admin');
const privateFile = path.join(privateDir, 'update-private.pem');
const publicFile = path.join(privateDir, 'update-public.txt');
const siteDir = path.join(root, 'publisher-site');
const manifestFile = path.join(siteDir, 'update.json');
const releaseFile = path.join(siteDir, 'release.json');
const packageFile = path.join(root, 'package.json');

function fail(message) { throw new Error(message); }
function writeNew(file, data) { fs.writeFileSync(file, data, { flag: 'wx', mode: 0o600 }); }
function keygen() {
  fs.mkdirSync(privateDir, { recursive: true });
  if (fs.existsSync(privateFile) || fs.existsSync(publicFile)) fail('Güncelleme anahtarı zaten var; mevcut anahtar korunuyor.');
  const pair = crypto.generateKeyPairSync('ed25519');
  writeNew(privateFile, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const jwk = pair.publicKey.export({ format: 'jwk' });
  writeNew(publicFile, Buffer.from(jwk.x, 'base64url').toString('base64') + '\n');
  console.log('Güncelleme imza anahtarı oluşturuldu. Özel anahtarı güvenli biçimde yedekleyin.');
}
function privateKey() {
  if (!fs.existsSync(privateFile)) fail('Önce keygen komutunu çalıştırın.');
  return crypto.createPrivateKey(fs.readFileSync(privateFile));
}
function envelope(payload) {
  const bytes = Buffer.from(JSON.stringify(payload));
  return { payload: bytes.toString('base64'), signature: crypto.sign(null, bytes, privateKey()).toString('base64') };
}
function version() { return JSON.parse(fs.readFileSync(packageFile, 'utf8')).version; }
function save(payload) {
  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(envelope(payload), null, 2) + '\n');
  fs.writeFileSync(releaseFile, JSON.stringify({
    product: 'ASMach Inspection', platform: 'windows', version: payload.version,
    status: payload.available ? 'available' : 'preparing', downloadUrl: payload.downloadUrl
  }, null, 2) + '\n');
}
function pause() {
  save({ schema: 1, product: 'asmach-inspection', version: version(), available: false,
    publishedAt: new Date().toISOString(), target: 'windows', arch: 'x86_64',
    downloadUrl: null, chunks: [], sha256: null, size: null, notes: 'İmzalı güncelleme paketi hazırlanıyor.' });
  console.log('İmzalı, indirmeye kapalı güncelleme bildirimi hazırlandı.');
}
function publish(installer, notes) {
  const source = path.resolve(installer || '');
  if (!fs.statSync(source, { throwIfNoEntry: false })?.isFile() || path.extname(source).toLowerCase() !== '.exe') fail('Geçerli bir Windows .exe kurulum dosyası verin.');
  const current = version(), downloads = path.join(siteDir, 'downloads'), bytes = fs.readFileSync(source);
  if (!bytes.length || bytes.length > 256 * 1024 * 1024) fail('Kurulum dosyası 256 MB güvenlik sınırının dışında.');
  fs.mkdirSync(downloads, { recursive: true });
  const name = `ASMach-Inspection-${current}-setup.exe`;
  let destination = path.join(downloads, name), downloadUrl = null, chunks = [];
  const chunkLimit = 20 * 1024 * 1024;
  if (bytes.length <= chunkLimit) {
    fs.writeFileSync(destination, bytes);
    downloadUrl = `https://asmach-release.licensing-service.workers.dev/downloads/${name}`;
  } else {
    const versionDir = path.join(downloads, current);
    fs.mkdirSync(versionDir, { recursive: true });
    for (const entry of fs.readdirSync(versionDir)) if (/^part-\d{3}\.bin$/.test(entry)) fs.rmSync(path.join(versionDir, entry));
    for (let offset = 0, number = 1; offset < bytes.length; offset += chunkLimit, number++) {
      const chunk = bytes.subarray(offset, Math.min(offset + chunkLimit, bytes.length));
      const partName = `part-${String(number).padStart(3, '0')}.bin`;
      fs.writeFileSync(path.join(versionDir, partName), chunk);
      chunks.push({
        url: `https://asmach-release.licensing-service.workers.dev/downloads/${current}/${partName}`,
        sha256: crypto.createHash('sha256').update(chunk).digest('hex'), size: chunk.length
      });
    }
    destination = versionDir;
  }
  save({ schema: 1, product: 'asmach-inspection', version: current, available: true,
    publishedAt: new Date().toISOString(), target: 'windows', arch: 'x86_64',
    downloadUrl, chunks,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length,
    notes: notes || `${current} sürümü güvenli güncellemesi.` });
  console.log(JSON.stringify({ prepared: true, version: current, file: destination, bytes: bytes.length, chunks: chunks.length }));
}

try {
  const [command, installer, ...noteParts] = process.argv.slice(2);
  if (command === 'keygen') keygen();
  else if (command === 'pause') pause();
  else if (command === 'publish') publish(installer, noteParts.join(' '));
  else fail('Kullanım: node scripts/update-release.cjs keygen|pause|publish <kurulum.exe> [sürüm notu]');
} catch (error) { console.error(error.message); process.exitCode = 1; }
