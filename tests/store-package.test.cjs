const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const manifest=fs.readFileSync('src-tauri/store/Package.appxmanifest.template.xml','utf8');
const script=fs.readFileSync('scripts/build-store-msix.ps1','utf8');
test('Store manifest is a full-trust desktop package with explicit identity placeholders',()=>{
 for(const value of ['{{IDENTITY_NAME}}','{{PUBLISHER}}','{{PUBLISHER_DISPLAY_NAME}}','{{VERSION}}','Windows.FullTrustApplication','runFullTrust'])assert.ok(manifest.includes(value));
 assert.ok(!manifest.includes('broadFileSystemAccess'));
});
test('Store build refuses guessed production identity and labels validation packages',()=>{
 for(const value of ['ASMACH_STORE_IDENTITY_NAME','ASMACH_STORE_PUBLISHER','ASMACH_STORE_PUBLISHER_DISPLAY_NAME','Store kimliği eksik'])assert.ok(script.includes(value));
 assert.ok(script.includes('_development-unsigned'));
 assert.ok(!script.includes('signtool'));
});
