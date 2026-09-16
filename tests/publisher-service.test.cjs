const {test}=require('node:test'),assert=require('node:assert/strict');
test('Publisher rejects unauthorized writes and preserves immutable artifact content',async()=>{
 const {default:worker}=await import('../publisher-service/worker.mjs');const entries=new Map();
 const bucket={async put(key,bytes){if(entries.has(key))return null;const item={size:bytes.length,customMetadata:arguments[2].customMetadata};entries.set(key,item);return item;},async head(k){return entries.get(k);}};
 const env={RELEASES:bucket,ADMIN_TOKEN:'test-only-token'},route='https://publisher.example/admin/artifact/11111111-1111-1111-1111-111111111111/part-0.bin';
 assert.equal((await worker.fetch(new Request(route,{method:'PUT',body:'abc'}),env)).status,401);
 const request=body=>new Request(route,{method:'PUT',headers:{Authorization:'Bearer test-only-token'},body});
 assert.equal((await worker.fetch(request('abc'),env)).status,200);
 assert.equal((await worker.fetch(request('abc'),env)).status,200);
 assert.equal((await worker.fetch(request('different'),env)).status,409);
 assert.equal(entries.size,1);
});
test('Publisher accepts the same immutable artifact through the free KV binding',async()=>{
 const {default:worker}=await import('../publisher-service/worker.mjs');const entries=new Map();
 const kv={async put(key,value,options={}){const bytes=value instanceof Uint8Array?value:new Uint8Array(value);entries.set(key,{value:bytes.slice().buffer,metadata:options.metadata||null});},async getWithMetadata(key,type){const item=entries.get(key);if(!item)return{value:null,metadata:null};return{value:type==='json'?JSON.parse(new TextDecoder().decode(item.value)):item.value,metadata:item.metadata};}};
 const env={RELEASES_KV:kv,ADMIN_TOKEN:'test-only-token'},route='https://publisher.example/admin/artifact/22222222-2222-2222-2222-222222222222/part-0.bin',request=body=>new Request(route,{method:'PUT',headers:{Authorization:'Bearer test-only-token'},body});
 assert.equal((await worker.fetch(request('abc'),env)).status,200);
 assert.equal((await worker.fetch(request('abc'),env)).status,200);
 assert.equal((await worker.fetch(request('different'),env)).status,409);
 const download=await worker.fetch(new Request(route.replace('/admin/artifact/','/downloads/')),env);assert.equal(await download.text(),'abc');
});
