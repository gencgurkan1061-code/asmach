'use strict';
const fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path');
// Read the supplied XLSX at build time. No ZIP loader or network is needed in the HTML.
function load(){
 const bytes=fs.readFileSync(path.join(__dirname,'../reference/FAI-FORM.xlsx')),out={};
 let end=bytes.length-22;while(end>=0&&bytes.readUInt32LE(end)!==0x06054b50)end--;
 if(end<0)throw new Error('FAI template ZIP directory missing');
 let p=bytes.readUInt32LE(end+16);const count=bytes.readUInt16LE(end+10);
 for(let i=0;i<count;i++){
  if(bytes.readUInt32LE(p)!==0x02014b50)throw new Error('Invalid FAI template directory');
  const method=bytes.readUInt16LE(p+10),size=bytes.readUInt32LE(p+20),nl=bytes.readUInt16LE(p+28),el=bytes.readUInt16LE(p+30),cl=bytes.readUInt16LE(p+32),offset=bytes.readUInt32LE(p+42),name=bytes.subarray(p+46,p+46+nl).toString('utf8');
  const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28),packed=bytes.subarray(start,start+size);
  const data=method===8?zlib.inflateRawSync(packed):method===0?packed:null;if(!data)throw new Error('Unsupported FAI compression');
  out[name]=/\.(xml|rels)$/.test(name)?{text:data.toString('utf8')}:{base64:data.toString('base64')};p+=46+nl+el+cl;
 }
 return out;
}
module.exports={load};
