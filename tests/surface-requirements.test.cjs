const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(fs.readFileSync('src/requirements-engine.js','utf8'),c);const api=c.ASMachRequirements;
for(const [text,expected]of [
 ['ISO 21920 Ra 1,6 µm',{specialDesignator:'Ra',nominalValue:'1.6',unit:'µm'}],
 ['U Rz 6.3',{upperLimit:'6.3',lowerLimit:'0'}],
 ['L Rq 0.8',{lowerLimit:'0.8',upperLimit:''}],
 ['U Ra 3.2\nL Ra 0.8',{lowerLimit:'0.8',upperLimit:'3.2'}],
 ['Ra 0.8-1.6 µm',{lowerLimit:'0.8',upperLimit:'1.6',nominalValue:''}],
 ['Ra 1.6 ±0.2',{lowerTolerance:'-0.2',upperLimit:'1.8',lowerLimit:'1.4'}],
 ['Ra 1.6 (+0.4/-0.2)',{lowerLimit:'1.4',upperLimit:'2'}],
 ['ASME B46.1 Ra 63 µin MAX',{unit:'µin',upperLimit:'63'}],
 ['ASME B46.1 Ra 63',{unit:'',upperLimit:''}],
 ['JIS B 0601 RzJIS 6.3',{specialDesignator:'RzJIS'}],
 ['Rt <12.5 nm',{unit:'nm',upperInclusive:false,upperLimit:'12.5'}],
 ['Sa ≥0.2 µm',{specialDesignator:'Sa',lowerLimit:'0.2'}],
 ['SURFACE[required] 3.2',{specialDesignator:'',nominalValue:'',upperLimit:''}],
 ['SURFACE[prohibited] Ra 0.8',{specialDesignator:'Ra',nominalValue:'0.8'}],
 ['Ra 1.6 Rz 6.3',{nominalValue:'',upperLimit:''}],
 ['Ra 1.6-0.8',{lowerLimit:'',upperLimit:''}],
]){const r=api.parse(text,'ISO 2768-mK');assert.equal(r.type,'Yüzey',text);for(const [k,v]of Object.entries(expected))assert.equal(r[k],v,text+' '+k);}
for(const t of ['R 3.2','Radius 6','M6','45°','3.2'])assert.notEqual(api.parse(t).type,'Yüzey',t);
assert.equal(api.generateRequirement(api.parse('Ra 0.8-1.6 µm')),'Ra 0.8–1.6 µm');
assert.equal(api.generateRequirement(api.parse('Rq >0.8 µm')),'Rq >0.8 µm');
console.log('PASS surface parameters, standards, units, limits, deviations and ambiguity guards');
