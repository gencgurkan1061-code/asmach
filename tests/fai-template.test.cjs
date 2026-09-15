const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {xml2js}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/xml-js');
const {createCanvas}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const assets=require('../scripts/template-assets.cjs').load(),c={window:{ASMachFaiTemplateAssets:assets},atob,Uint8Array,DataView};
vm.runInNewContext(fs.readFileSync('src/fai-template.js','utf8'),c);const api=c.window.ASMachFaiTemplate;
const canvas=createCanvas(250,55),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,250,55);ctx.fillStyle='black';ctx.font='26px Arial';ctx.fillText('⊥ 0.10 A',12,38);const snapshot=canvas.toDataURL('image/png');
c.window.ASMachGdtReport={image:item=>item.type==='GD&T'?snapshot:null};
const state={metadata:{partNo:'TEST-001',drawingNo:'DWG-001',partRevision:'B',drawingRevision:'C',fai:{partName:'Test parça',fairIdentifier:'FAI-001',partType:'Detail',faiType:'Full FAI'}},annotations:Array.from({length:37},(_,n)=>({number:String(n+1),type:n%7===0?'GD&T':'Çap',requirement:'Ø27.3 (0/-0.05)',page:1,zone:'B2',result:n===1?'0':'',inspectionMethod:'Kumpas',snapshot}))};
module.exports={state,c,api,assets};
function cell(sheet,ref){return sheet.match(new RegExp('<c r="'+ref+'"[^>]*>([\\s\\S]*?)</c>'))?.[1];}
test('User FAI template preserves styles, logos and labels; maps fields and blank-safe live header links',()=>{
 const out=api.files(state);assert.ok(out['xl/styles.xml'].includes(assets['xl/styles.xml'].text.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)[1]));assert.equal(out['xl/sharedStrings.xml'],assets['xl/sharedStrings.xml'].text);
 for(const n of [1,2,3])assert.equal(Buffer.from(out[`xl/media/image${n}.png`]).toString('base64'),assets[`xl/media/image${n}.png`].base64);
 assert.match(cell(out['xl/worksheets/sheet1.xml'],'A4'),/TEST-001/);assert.match(cell(out['xl/worksheets/sheet1.xml'],'I14'),/>X</);
 assert.doesNotMatch(cell(out['xl/worksheets/sheet1.xml'],'A33'),/Test/);assert.match(cell(out['xl/worksheets/sheet2.xml'],'A4'),/<f>IF\(/);
 assert.match(cell(out['xl/worksheets/sheet3.xml'],'K8'),/Kumpas/);assert.match(cell(out['xl/worksheets/sheet3.xml'],'I9'),/<v>0<\/v>/);
 assert.equal(out['xl/calcChain.xml'],undefined);for(const [name,data] of Object.entries(out))if(/\.(xml|rels)$/.test(name))assert.doesNotThrow(()=>xml2js(data),name);
});
test('All characteristics survive pagination; print areas, images and cloned logos are connected',()=>{
 const out=api.files(state),workbook=xml2js(out['xl/workbook.xml'],{compact:true}).workbook;
 const sheets=workbook.sheets.sheet;assert.ok(sheets.length>3);let total=0;
 for(const s of sheets.filter(s=>s._attributes.name.startsWith('Form 3'))){const id=s._attributes.sheetId,raw=out[`xl/worksheets/sheet${id}.xml`];total+=[...raw.matchAll(/<c r="A(?:[89]|[12]\d|3[0-8])"[^>]*><is><t[^>]*>\d+<\/t>/g)].length;assert.ok(!raw.includes('r="1000"'));assert.match(out[`xl/drawings/drawing${id}.xml`],/Resim 1/);}
 assert.equal(total,37);const names=workbook.definedNames.definedName;assert.equal(names.length,sheets.length);names.forEach((v,i)=>assert.equal(+v._attributes.localSheetId,i));
 const media=Object.keys(out).filter(n=>n.includes('fai-snapshot'));assert.equal(media.length,6);assert.equal(Buffer.from(out[media[0]]).toString('base64'),snapshot.split(',')[1]);
 api.paginate(state.annotations,state.metadata,true).forEach(p=>assert.ok(p.reduce((n,r)=>n+r.height,0)<=325));
});
test('Material overflow continues on the original Form 2; snapshot opt-out and literal text are safe',()=>{
 const s={metadata:{},annotations:Array.from({length:15},(_,i)=>({number:String(i+1),type:'Malzeme',requirement:i===0?'=HYPERLINK("x")':`Material ${i}`,result:''}))};
 const out=api.files(s,{includeSnapshots:false});assert.match(out['xl/workbook.xml'],/Form 2 \(2\)/);assert.equal(Object.keys(out).filter(k=>k.includes('fai-snapshot')).length,0);
 assert.match(cell(out['xl/worksheets/sheet2.xml'],'A8'),/<is><t[^>]*>=HYPERLINK/);assert.match(cell(out['xl/worksheets/sheet3.xml'],'I8'),/<is><t[^>]*><\/t>/);
});
