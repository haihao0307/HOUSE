import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  seedDNA, deepPoreBrokenControls, evaluateFields, geometryOffset,
  firedMaterialRegions, materialChannels, validateFiniteObject
} from './v26_transfer_kernel.mjs';
import { buildV26Events, subtractV26Events, V26_EVENT_LIBRARY } from './v26_event_geometry_kernel.mjs';

const preset=JSON.parse(fs.readFileSync(new URL('../REFERENCE_PRESET.json',import.meta.url),'utf8'));
const seeds=seedDNA(preset.runtimeDNA.seedBase,preset.runtimeDNA.seedBase%997,preset.childSeedOffset);
const controls=deepPoreBrokenControls(preset.baseCompositeDefaults);
const args={dimensions:preset.runtimeDNA.shapeRatio,runtimeDNA:preset.runtimeDNA,noiseDNA:preset.noiseDNA,controls,seeds,damageLevel:preset.damageLevel};
const a=buildV26Events(args),b=buildV26Events(args);
assert.deepEqual(a,b,'deterministic event descriptors');
assert.ok(a.deepPores.length>=3,'deep pores exist');
assert.ok(a.poreRimChips.length>=a.deepPores.length*2,'rim breakup exists');
for(const p of a.deepPores)assert.ok(p.a&&p.b&&p.mouthCenter&&p.mouthRadii&&p.radius>0,'bore and mouth required');

const colorSeeds={...seeds,color:seeds.color+99991};
const colorEvents=buildV26Events({...args,seeds:colorSeeds});
assert.deepEqual(a,colorEvents,'color seed must not change geometry events');
const poreSeeds={...seeds,pore:seeds.pore+113};
const poreEvents=buildV26Events({...args,seeds:poreSeeds});
assert.notDeepEqual(a.deepPores,poreEvents.deepPores,'pore seed must change pores');

let colorChanged=false,maxGeom=0;
for(let i=0;i<1000;i++){
 const p=[Math.sin(i*.37)*1.3,Math.cos(i*.19)*.42,Math.sin(i*.23)*.84];
 const fa=evaluateFields(p,seeds,{...preset.noiseDNA,...preset.gaeaDNA});
 const fb=evaluateFields(p,colorSeeds,{...preset.noiseDNA,...preset.gaeaDNA});
 const ga=geometryOffset(fa,{...preset.gaeaDNA,...controls});
 const gb=geometryOffset(fb,{...preset.gaeaDNA,...controls});
 assert.equal(ga,gb,'color seed must not change continuous geometry');
 const ma=materialChannels(fa,firedMaterialRegions(fa,p,seeds,preset.noiseDNA),preset.noiseDNA);
 const mb=materialChannels(fb,firedMaterialRegions(fb,p,colorSeeds,preset.noiseDNA),preset.noiseDNA);
 if(JSON.stringify(ma.regions)!==JSON.stringify(mb.regions))colorChanged=true;
 validateFiniteObject(ma);validateFiniteObject(mb);
 const d=subtractV26Events(.1,p,a);assert.ok(Number.isFinite(d));maxGeom=Math.max(maxGeom,Math.abs(d-.1));
}
assert.ok(colorChanged,'color seed changes material regions');
assert.ok(maxGeom>1e-4,'negative events change geometry');

const counts=Object.fromEntries(Object.entries(a).map(([k,v])=>[k,v.length]));
console.log(JSON.stringify({pass:true,continuousKernel:'pass',eventLibrary:V26_EVENT_LIBRARY.version,deterministic:'pass',colorSeedGeometryIsolation:'pass',poreSeedMutation:'pass',counts,maxGeometryDifference:maxGeom},null,2));
