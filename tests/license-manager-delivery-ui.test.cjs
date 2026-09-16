const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');

test('new licenses use online keys and manager shows TPM verification details',()=>{
 const html=fs.readFileSync('license-manager/index.html','utf8');
 const app=fs.readFileSync('license-manager/app.js','utf8');
 assert.match(html,/Çevrimiçi lisans · Anahtarla etkinleştir/);
 assert.doesNotMatch(html,/Çevrimdışı lisans · Kod veya lisans dosyası/);
 assert.match(html,/TPM bağlanırsa 90 gün çevrimdışı kullanılabilir/);
 assert.match(html,/id="codeValue"/);
 assert.match(app,/Çevrimiçi anahtarı göster/);
 assert.match(app,/Çevrimdışı kodu göster/);
 assert.match(app,/Lisans dosyasını indir/);
 assert.match(app,/showCode\('Çevrimdışı etkinleştirme kodu'/);
 assert.match(app,/TPM durumu:/);
 assert.match(app,/Son TPM doğrulaması:/);
 assert.match(app,/Çevrimdışı izin bitişi:/);
});
