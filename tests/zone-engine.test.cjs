'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};vm.runInNewContext(fs.readFileSync('src/zone-engine.js','utf8'),context);
const z=context.window.ASMachZones;
const label=(text,x,y)=>({text,x:x-.005,y:y-.005,w:.01,h:.01});
const words=[];
for(let i=0;i<5;i++){words.push(label(String(5-i),.1+i*.2,.025));words.push(label(String(5-i),.1+i*.2,.975));}
for(let i=0;i<4;i++){words.push(label('DCBA'[i],.025,.125+i*.25));words.push(label('DCBA'[i],.975,.125+i*.25));}
words.push(label('9',.5,.5),label('25',.4,.4));
const grid=z.infer(words);
assert.equal(z.lookup(grid,.51,.51),'B3');
assert.equal(z.lookup(grid,.11,.1),'D5');
assert.equal(z.lookup(grid,.91,.9),'A1');
assert.equal(z.isLabel(grid,words[0]),true);
assert.equal(z.isLabel(grid,label('9',.5,.5)),false);
assert.equal(z.lookup(z.infer([label('1',.1,.02),label('25',.5,.02),label('9',.9,.02)]),.5,.5),'');
const record={anchorX:.11,anchorY:.1,selectionBox:{x:.5,y:.5,w:.02,h:.02}};
z.assign(record,grid);assert.equal(record.zone,'B3');assert.equal(record.zoneSource,'auto');
record.zone='MANUEL';record.manualFields=['zone'];z.assign(record,grid);assert.equal(record.zone,'MANUEL');
assert.equal(z.lookup({horizontal:grid.horizontal},.4,.4),'');
console.log('Zone tests passed: reversed axes, both borders, interior dimensions retained, incomplete grids and manual overrides.');
