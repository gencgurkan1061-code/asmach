'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function collectInstallers(root = path.resolve(__dirname, '..'), requestedVersion) {
  const version = requestedVersion || JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Geçersiz uygulama sürümü.');
  const sourceDir = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
  const destinationDir = path.join(root, 'Kurulum Paketleri', version, 'Yerel Derleme');
  const names = fs.readdirSync(sourceDir).filter(name =>
    name.startsWith(`ASMach Inspection_${version}_`) && /setup\.exe$/i.test(name) &&
    fs.statSync(path.join(sourceDir, name)).isFile());
  if (!names.length) throw new Error(`${version} kurulum dosyası bulunamadı: ${sourceDir}`);
  fs.mkdirSync(destinationDir, { recursive: true });
  const results = [];
  for (const name of names) {
    const source = path.join(sourceDir, name);
    const hash = sha256(source);
    let destination = path.join(destinationDir, name);
    if (fs.existsSync(destination) && sha256(destination) !== hash) {
      destination = path.join(destinationDir, name.replace(/\.exe$/i, `-${hash.slice(0, 8)}.exe`));
    }
    if (fs.existsSync(destination)) {
      if (sha256(destination) !== hash) throw new Error(`Farklı paket üzerine yazılmayacak: ${destination}`);
    } else {
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
      if (sha256(destination) !== hash) throw new Error(`Kopyalanan paket doğrulanamadı: ${destination}`);
    }
    results.push({ path: destination, sha256: hash });
  }
  return results;
}

if (require.main === module) {
  try {
    for (const result of collectInstallers(undefined, process.argv[2])) console.log(`Kurulum paketi: ${result.path} (SHA-256 ${result.sha256})`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { collectInstallers };
