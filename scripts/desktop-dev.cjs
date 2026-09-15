'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist-desktop'),clients=new Set();let timer;
function build(){execFileSync(process.execPath,[path.join(__dirname,'build-desktop.cjs'),'--dev'],{stdio:'inherit'});}
build();
const server=http.createServer((req,res)=>{
 if(req.url==='/__desktop_events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write(': connected\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;}
 let decoded;try{decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const file=path.resolve(dist,'.'+(decoded==='/'?'/index.html':decoded));
 if(!file.startsWith(dist+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(e,body)=>{if(e){res.writeHead(404).end();return;}const ext=path.extname(file);res.writeHead(200,{'Content-Type':ext==='.js'?'text/javascript; charset=utf-8':ext==='.html'?'text/html; charset=utf-8':'application/octet-stream','Cache-Control':'no-store'});res.end(body);});
});
server.listen(1420,'127.0.0.1',()=>console.log('Tauri live development: http://localhost:1420 (loopback only)'));
for(const folder of ['src','scripts'])fs.watch(path.join(root,folder),{recursive:true},(_,name)=>{if(!name||/^(tauri-bridge|.*\.(js|cjs|html|css|svg))$/.test(name)===false)return;clearTimeout(timer);timer=setTimeout(()=>{try{build();for(const client of clients)client.write('data: reload\n\n');}catch(e){console.error('Rebuild failed; previous preview remains available.',e.message);}},350);});
process.on('SIGINT',()=>{server.close();process.exit();});
