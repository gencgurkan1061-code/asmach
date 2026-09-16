"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "src/app.template.html"), "utf8");
const start = html.indexOf("function parseTechnicalRequirementLegacy(");
const end = html.indexOf("function technicalTextScore(", start);
assert.ok(start >= 0 && end > start);
const context = vm.createContext({window: {}, console});
vm.runInContext(html.slice(start, end), context);
vm.runInContext(fs.readFileSync(path.join(root, "src/requirements-engine.js"), "utf8"), context);
const engine = context.window.ASMachRequirements;
context.window.ASMachRequirements = {...engine, parse: text => engine.parse(text, "", context.parseTechnicalRequirementLegacy)};
vm.runInContext(fs.readFileSync(path.join(root, "src/workflow.js"), "utf8"), context);
const workflow = context.window.ASMachWorkflow;
for(const text of ['1/8-27 NPT','"1 / 8"" - 27 NPT"','1 1/4-11.5 NPT']) assert.ok(workflow.technicalScore(text)>=35,text);
const word = (text, x, y = .1, w = .025, h = .02, extra = {}) => ({text, x, y, w, h, confidence: 95, ...extra});
for(const [text,lo,hi]of [['20.2° (+0.8/+0.3)',.3,.8],['20,2º +0,8+0,3',.3,.8],['120° +0.2/0',0,.2],['45° ±0.5',-.5,.5]]){const parsed=engine.parse(text);assert.equal(parsed.type,'Açı');assert.equal(Number(parsed.lowerTolerance),lo);assert.equal(Number(parsed.upperTolerance),hi);assert.ok(workflow.technicalScore(text)>=35,text);}
assert.equal(workflow.technicalScore('20° 30'),0,'Do not consume a neighbouring unsigned dimension');
assert.equal(engine.parse('0.5 × 45°').type,'Pah');
assert.equal(workflow.technicalScore('20° 75′'),0,'Invalid DMS minutes require review');
const angularGroups=workflow.candidateGroups([word('20.2',.1,.1,.06,.04),word('°',.162,.093,.008,.012),word('+0.8',.177,.092,.04,.022),word('+0.3',.177,.121,.04,.022)]);
assert.ok(angularGroups.some(g=>g.text.includes('20.2°')&&g.text.includes('+0.8')&&g.text.includes('+0.3')),'Detached degree and stacked deviations must remain one angle');
let checks = 0;
function expect(condition, message) { assert.ok(condition, message); checks++; }
function survivors(sources) {
  const accepted = [];
  for (const candidate of workflow.rankCandidates(sources)) {
    if (!accepted.some(previous => workflow.overlap(previous, candidate) > .6)) accepted.push(candidate);
  }
  return accepted;
}

for (const text of ["25 ±0.1", "25+0.2-0.1", "25 0/+0.1", "Ø25 H7", "Ø50 d6", "Ø5 0 d 6", "Ø25 H7/g6", "M6x1-6H", "1/4-20 UNC-2B", "2x45°", "30°±0.5°", "Ra ≤3.2", "⌖|Ø0.2Ⓜ|A|BⓂ|C", "25 MAX", "MIN 25", "24.9 /25.1", "4x Ø6"]) {
  expect(workflow.technicalScore(text) >= 35, `Whole requirement must rank: ${text}`);
}
for (const text of ["DATUM A", "MALZEME 42CrMo4", "HEAT TREAT 58 HRC", "ÇAPAKLARI ALIN", "UNLESS OTHERWISE", "AKSI BELIRTILMEDIKCE", "±0.1", "+0.2", "25 ±0.1 35", "±0.1 35 ±0.2", "25 ±0.1 35 ±0.2", "Ø25 Ø35", "25 35", "DRAWING", "CUSTOMER", "A", "SCALE 1:1", "⌖0.1 DRAWING"]) {
  expect(workflow.technicalScore(text) === 0, `Incomplete/merged/title text must not rank: ${text}`);
}
const adjacent = [word("25", .1, .1, .02), word("±0.1", .125, .1, .03), word("35", .158, .1, .02), word("±0.2", .18, .1, .03)];
let found = survivors(workflow.candidateGroups(adjacent, [word("25 ±0.1 35 ±0.2", .1, .1, .11)]));
expect(found.length === 2, "Adjacent dimensions create two candidates");
expect(found.some(item => item.text === "25 ±0.1"), "First adjacent dimension preserves its tolerance");
expect(found.some(item => item.text === "35 ±0.2"), "Second adjacent dimension preserves its tolerance");

const splitSign = [word("Ø25", .1, .1, .035), word("±", .14, .1, .012), word("0.1", .156, .1, .02)];
found = survivors(workflow.candidateGroups(splitSign));
expect(found.length === 1 && found[0].text === "Ø25 ± 0.1", "Split ± sign attaches to nominal");
const stacked = [word("25", .1, .1, .03, .028), word("+0.2", .135, .089, .04, .015), word("-0.1", .135, .114, .04, .015)];
found = survivors(workflow.candidateGroups(stacked));
expect(found.length === 1 && found[0].text.includes("+0.2 / -0.1"), "Stacked signed deviations share the correct nominal");
expect(context.window.ASMachRequirements.parse(found[0].text).lowerLimit === "24.9", "Stacked lower limit remains correct");
const oneSidedStack = [word("25", .1, .1, .03, .028), word("+0.2", .135, .089, .04, .015), word("0", .135, .114, .02, .015)];
found = survivors(workflow.candidateGroups(oneSidedStack));
expect(found.length === 1 && found[0].text.includes("+0.2 / 0"), "An unsigned zero belongs to the one-sided stack, not a new characteristic");
// Right-aligned zero sits at the END of a longer signed lower deviation.
const rightAligned=[word('Ø27.3',.1,.1,.07,.025),word('0',.224,.088,.009,.014),word('-0.05',.18,.112,.053,.014)];
for(const angle of [0,90,180,270]){
  const rotated=rightAligned.map(w=>angle===90?{...w,x:w.y,y:1-w.x-w.w,w:w.h,h:w.w,angle}:angle===180?{...w,x:1-w.x-w.w,y:1-w.y-w.h,angle}:angle===270?{...w,x:1-w.y-w.h,y:w.x,w:w.h,h:w.w,angle}:{...w,angle});
  const result=survivors(workflow.candidateGroups(rotated)).find(w=>w.text.includes('27.3'));
  expect(result&&result.text.includes('0 / -0.05'),`${angle}: Right-aligned zero and negative tolerance stay with diameter`);
  const parsed=context.window.ASMachRequirements.parse(result.text);
  expect(parsed.upperTolerance==='0'&&parsed.lowerTolerance==='-0.05',`${angle}: explicit zero upper / negative lower deviations`);
  expect(result.retainBounds===true,`${angle}: Tolerance stack cannot be trimmed back to nominal`);
}
found = survivors(workflow.candidateGroups([word("Ø25", .1, .1, .035), word("g6", .14, .1, .02)]));
expect(found.length === 1 && found[0].text === "Ø25 g6", "Unsupported fit still groups for review instead of losing its class");

const vertical = [word("25", .3, .7, .02, .03, {angle: 90, lineId: "r1"}), word("±0.1", .3, .653, .02, .04, {angle: 90, lineId: "r1"})];
const confirmed=word('Ø27.3',.09,.1,.08,.025,{visualDiameter:true,readingAngle:0});
const full=word('27.3 0 / -0.05',.1,.088,.133,.038,{retainBounds:true});
const ranked=survivors([confirmed,full]);
expect(ranked.length===1&&ranked[0].text==='Ø27.3 0 / -0.05','Graphical diameter proof must not suppress the complete tolerance pair');
expect(ranked[0].x===.09&&ranked[0].w>=.143-1e-8,'Final box contains prefix and both deviations');
found = survivors(workflow.candidateGroups(vertical));
expect(found.length === 1 && found[0].text === "25 ±0.1", "Rotated text groups in its reading direction");
const separateLines = [word("25", .1, .1, .02, .02, {lineId: "line-1"}), word("±0.1", .125, .115, .04, .02, {lineId: "line-2"})];
expect(!workflow.candidateGroups(separateLines).some(item => item.text === "25 ±0.1"), "Separate OCR lines do not accidentally merge");

const frameWords = [word("⌖", .1, .1, .015), word("Ø0.2", .12, .1, .03), word("A", .155, .1, .012), word("BⓂ", .172, .1, .017), word("C", .195, .1, .012)];
found = survivors(workflow.candidateGroups(frameWords));
expect(found.length === 1 && found[0].text === "⌖ Ø0.2 A BⓂ C", "GD&T datum order wins over incomplete subframes");

(async function () {
  let ocrCalls = 0;
  const hybridWords = [word("DRAWING", .1), word("SHEET", .2), word("1", .3), word("CUSTOMER", .4), word("REV", .5), word("2", .6)];
  context.window.ASMachOCR = {detect: async () => {ocrCalls++; return {words: [word("Ø8", .4, .6)], lines: []};}};
  const hybrid = await workflow.pageSources(hybridWords, "data:image/png;base64,test", () => {});
  expect(ocrCalls === 1, "Hybrid PDFs always run OCR even with searchable headings");
  expect(hybrid.sources.some(item => item.text === "Ø8" && item.source === "Yerel OCR"), "Raster measurement candidates are retained beside PDF text");
  context.window.ASMachOCR = {detect: async () => ({words: [], lines: [], error: "OCR unavailable"})};
  const fallback = await workflow.pageSources([word("Ø25", .1)], "snapshot", () => {});
  expect(fallback.sources.some(item => item.text === "Ø25") && fallback.warning, "PDF candidates survive OCR errors with a visible warning");
  await assert.rejects(workflow.pageSources([], "snapshot", () => {}), /OCR unavailable/);
  checks++;
  console.log(`Workflow detection: ${checks} full-text, grouping, rotation and hybrid-PDF checks passed.`);
})().catch(error => {console.error(error); process.exitCode = 1;});
