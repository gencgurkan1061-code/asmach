/* One-time publisher connection. The generated admin token is never printed. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),configFile=path.join(root,'.release-admin','publisher.json');
if(fs.existsSync(configFile)&&!process.argv.includes('--rotate'))throw Error('Yayın bağlantısı zaten yapılandırılmış. Bilerek değiştirmek için --rotate kullanın.');
const token=crypto.randomBytes(32).toString('base64url');
const pnpx=path.join(process.env.USERPROFILE,'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','pnpm','bin','pnpx.cjs');
if(!fs.existsSync(pnpx))throw Error('Paket yönetim çalışma zamanı bulunamadı.');
const child=spawn(process.execPath,[pnpx,'wrangler@4','secret','put','ADMIN_TOKEN','--config','publisher-service/wrangler.jsonc'],{cwd:root,stdio:['pipe','inherit','inherit'],windowsHide:true});
child.stdin.end(token+'\n');
child.on('exit',async code=>{if(code!==0)process.exitCode=code;else{const {createReleases}=require('../license-manager/releases.cjs'),releases=createReleases(root);let error;for(let attempt=0;attempt<8;attempt++){try{await releases.configure({url:'https://asmach-release.licensing-service.workers.dev',token});console.log('Yayın deposu lisans yöneticisine güvenli biçimde bağlandı.');return;}catch(e){error=e;await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}}console.error(error?.message||'Yayın bağlantısı doğrulanamadı.');process.exitCode=1;}});
