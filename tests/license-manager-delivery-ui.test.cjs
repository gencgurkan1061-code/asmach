const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');

test('license manager exposes online key, offline code and license file delivery',()=>{
 const html=fs.readFileSync('license-manager/index.html','utf8');
 const app=fs.readFileSync('license-manager/app.js','utf8');
 assert.match(html,/Çevrimiçi lisans · Anahtarla etkinleştir/);
 assert.match(html,/Çevrimdışı lisans · Kod veya lisans dosyası/);
 assert.match(html,/id="codeValue"/);
 assert.match(app,/Çevrimiçi anahtarı göster/);
 assert.match(app,/Çevrimdışı kodu göster/);
 assert.match(app,/Lisans dosyasını indir/);
 assert.match(app,/showCode\('Çevrimdışı etkinleştirme kodu'/);
});
