/* Rebuild the standalone deliverable. No network or external runtime dependencies. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name));
const assets = {
  library: 'ocr/tesseract.min.js',
  worker: 'ocr/worker.min.js',
  core: 'ocr/core/tesseract-core-lstm.wasm.js',
  eng: 'ocr/lang/eng.traineddata.gz',
  tur: 'ocr/lang/tur.traineddata.gz',
  deu: 'ocr/lang/deu.traineddata.gz'
};
const registry = Object.fromEntries(Object.entries(assets).map(([key, name]) => [key, read(name).toString('base64')]));
const guideDir = path.join(root, 'outputs', 'usage-guide');
const guideScreenshots = {};
if (fs.existsSync(guideDir)) for (const file of fs.readdirSync(guideDir)) {
  const match = /^([a-z-]+)\.png$/i.exec(file);
  if (match) guideScreenshots[match[1]] = 'data:image/png;base64,' + fs.readFileSync(path.join(guideDir, file)).toString('base64');
}
const modules = ['requirements-engine', 'measurement-layout', 'zone-engine', 'ocr-engine', 'ocr-image-enhancement', 'diameter-vision', 'gdt-vision', 'gdt-report', 'auto-selection', 'balloon-placement', 'balloon-appearance', 'appearance-settings', 'snapshot-tools', 'automatic-geometry', 'automatic-symbols', 'candidate-preview', 'pdf-preview', 'fai-template', 'excel-reports', 'inspection-plan', 'bulk-plan', 'ocr-review-controls', 'characteristic-dock', 'inspector-panel', 'characteristic-ui', 'dimension-filter', 'workflow', 'workspace-layout'];
modules.unshift('number-order','message-dialog');
modules.push('report-delivery','report-workbench');
modules.splice(modules.indexOf('characteristic-ui'),0,'characteristic-region');
modules.splice(modules.indexOf('characteristic-region'),0,'region-measurements');
modules.splice(modules.indexOf('characteristic-ui'),0,'balloon-numbering');
modules.splice(modules.indexOf('candidate-preview'),0,'candidate-correction');
modules.push('modal-layout');
modules.push('role-plans','inspection-reports');
modules.push('view-numbering');
modules.push('report-brand');
modules.push('characteristic-editing');
modules.push('project-recovery');
modules.push('desktop-ui');
modules.push('project-workspace');
modules.push('production-workspace');
modules.push('project-ocr');
modules.push('editor-sections');
modules.push('list-columns');
modules.push('candidate-source','candidate-dashboard');
modules.push('characteristic-inspector');
modules.push('inspector-compact');
modules.push('candidate-table');
modules.push('table-actions');
modules.push('quick-tools');
modules.push('role-appearance','report-center','application-shell','keyboard-navigation','workspace-tabs','usage-guide','manual-tools','ribbon','repeated-characteristics','report-templates','ribbon-defaults');
modules.unshift('preferences');
modules.push('characteristic-workbench');
modules.push('characteristic-classification');
modules.push('control-workbench');
modules.push('measure-components');
modules.push('inspection-inline');
modules.push('shared-candidate-inspector','technical-symbol-ui');
modules.push('gdt-text-editor');
modules.push('type-inspection-defaults');
modules.push('settings-compact');
modules.push('report-output-settings');
modules.push('excel-cell-template');
modules.push('fai837-assets','fai837-template');
modules.push('excel-template-pages');
modules.push('excel-sample-pages');
modules.push('excel-template-import');
modules.push('format-ribbon');
modules.push('pdf-view-tools');
modules.push('start-screen');
modules.push('desktop-window-theme');
modules.push('settings-tree');
modules.push('file-actions');
modules.push('brand-settings');
modules.push('edit-ribbon-layout');
modules.push('license-center');
modules.push('about-app');
const scripts = modules.map(name => {
  const code = read(`src/${name}.js`).toString('utf8');
  new vm.Script(code, { filename: `${name}.js` });
  return `<script id="asmach-${name}">\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`;
});
scripts.unshift(`<script>window.ASMachBuildVersion=${JSON.stringify(JSON.parse(read('package.json').toString('utf8')).version)};</script>`);
scripts.unshift(`<script>window.ASMachGuideScreenshots=${JSON.stringify(guideScreenshots)};</script>`);
scripts.unshift(`<script>window.ASMachOcrIcons=${JSON.stringify(Object.fromEntries(['nominal','tolerance','compare','original','strong','text'].map(k=>[k,'data:image/svg+xml;base64,'+read('src/assets/ocr-'+k+'.svg').toString('base64')])))};</script>`);
scripts.unshift(`<script>window.ASMachEditIcons=${JSON.stringify(Object.fromEntries(['balloon','brush','list','settings','license','about','help','template'].map(k=>[k,'data:image/svg+xml;base64,'+read('src/assets/ribbon-'+k+'.svg').toString('base64')])))};</script>`);
scripts.unshift(`<script>window.ASMachFileIcons=${JSON.stringify(Object.fromEntries(['add','edit'].map(k=>[k,'data:image/svg+xml;base64,'+read('src/assets/'+k+'-image.svg').toString('base64')])))};</script>`);
scripts.unshift(`<script>window.ASMachBrandLogo="data:image/svg+xml;base64,${read('src/assets/asmach-inspection-icon.svg').toString('base64')}";</script>`);
const template = read('src/app.template.html').toString('utf8').replaceAll('__ASMACH_BRAND_LOGO__','data:image/svg+xml;base64,'+read('src/assets/asmach-inspection-icon.svg').toString('base64'));
const main = template.match(/<script id="asmach-app">([\s\S]*?)<\/script>/);
if (!main) throw new Error('Main application script missing');
new vm.Script(main[1], { filename: 'asmach-app.js' });
if ((template.match(/<!-- ASMACH_BUNDLED_MODULES -->/g) || []).length !== 1) throw new Error('Bundle marker missing or duplicated');
const notice = '<!-- Standalone build: PDF.js (Apache-2.0), jsPDF (MIT), Tesseract.js/Tesseract.js-core/Tesseract traineddata (Apache-2.0). OCR assets are embedded for offline local processing. -->';
const faiAssets=JSON.stringify(require('./template-assets.cjs').load()).replace(/<\/script/gi,'<\\/script');
scripts.unshift(`<script>window.ASMachReportLogo="data:image/png;base64,${read('src/assets/report-logo.png').toString('base64')}";</script>`);
const output = template.replace('<!-- ASMACH_BUNDLED_MODULES -->', () => `${notice}\n<script id="asmach-ocr-assets">window.ASMachOcrAssets=${JSON.stringify(registry)};</script>\n<script id="asmach-fai-assets">window.ASMachFaiTemplateAssets=${faiAssets};</script>\n${scripts.join('\n')}`);
if ((output.match(/id="asmach-app"/g) || []).length !== 1) throw new Error('Duplicate main script');
if (/<script\b[^>]*\bsrc\s*=\s*["'](?:https?:|ocr\/)/i.test(output)) throw new Error('External script dependency remains');
const file = path.join(root, 'ASMach_Teknik_Resim_Balonlama.html');
fs.writeFileSync(file, output, 'utf8');
console.log(JSON.stringify({ file, bytes: Buffer.byteLength(output), modules, offlineAssets: Object.keys(registry) }, null, 2));
