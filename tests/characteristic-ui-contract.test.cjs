const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../src/characteristic-ui.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(source, context);
const ui = context.window.ASMachCharacteristicUI;
assert.ok(ui, "UI module can load before document initialization");
for (const name of ["init", "render", "openEditor", "openMetadata", "openAudit"]) {
  assert.equal(typeof ui[name], "function", `Public bridge method ${name} exists`);
}
assert.equal(ui.ready, false, "Module starts inert before the application bridge is ready");
ui.render();

// Every static DOM lookup must refer to a node created by this independent module.
const ids = new Set([...source.matchAll(/id="(acui[^"]+)"/g)].map(match => match[1]));
for (const match of source.matchAll(/\.id = "(acui[^"]+)"/g)) ids.add(match[1]);
for (const match of source.matchAll(/\$\("#(acui[^"]+)"/g)) {
  assert.ok(ids.has(match[1]), `Referenced UI control ${match[1]} is present in its templates`);
}
assert.ok(ids.size > 30);
console.log(`Characteristic UI bridge and ${ids.size} DOM references validated.`);
