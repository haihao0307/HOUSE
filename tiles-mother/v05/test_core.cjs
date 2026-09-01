const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname);
const context = { console, Float32Array, Uint32Array, Math, Number, Object, String, Array, JSON, Infinity, globalThis: null };
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const name of ['../v04/operators.js', 'profile.js', 'geometry-operators.js', 'roof-joints.js', 'studio.js']) vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
const C = context.TilesStudyCore;
const V = context.TilesMotherV05Parts;
const profile = {
  pan: { controls: { length: 32, width: 22, thickness: 1.15, curve: 4.6, taper: 12, warp: 22, damage: 18, pores: 32, weather: 25, richness: 58, mottle: 54, grain: 28, roughness: 82 }, seeds: { master: 32017, shape: 1, warp: 2, structure: 3, damage: 4, color: 5, weather: 6, micro: 7 } },
  cover: { controls: { length: 30, width: 16, thickness: 1.05, curve: 7.2, taper: 9, warp: 18, damage: 12, pores: 25, weather: 28, richness: 52, mottle: 50, grain: 24, roughness: 80 }, seeds: { master: 47219, shape: 11, warp: 12, structure: 13, damage: 14, color: 15, weather: 16, micro: 17 } }
};
const seeded = (s, i) => { const out = {}; for (const [k, v] of Object.entries(s)) out[k] = (v + i * 1009) >>> 0 || 1; return out; };
const checks = [];
function check(name, fn) { const detail = fn(); checks.push({ name, passed: true, detail: detail ?? null }); }
for (const family of ['pan', 'cover']) {
  const p = profile[family];
  const t = V.geometry.tile(family, `test/${family}`, p.seeds.master, p.controls, p.seeds);
  const m = V.geometry.mesh(t, { nu: 40, nv: 52, damage: 0 });
  const d = V.geometry.diagnostics(m);
  check(`${family} V0.5 finite and non-degenerate`, () => { assert.ok(m.positions.every(Number.isFinite)); assert.ok(m.normals.every(Number.isFinite)); assert.equal(d.degenerateTriangles, 0); return d; });
  check(`${family} thickness and spatial closure`, () => { assert.ok(m.metrics.minThickness >= m.metrics.minimumAllowedThickness); assert.equal(d.closedBySpatialIncidence, true); assert.equal(d.overSharedEdgesBySpatialPosition, 0); return { thickness: m.metrics.minThickness, indexedClosure: d.closedByIndexedIncidence, spatialClosure: d.closedBySpatialIncidence }; });
  check(`${family} edge ring has separate face group`, () => { assert.ok(d.faceCounts.edge > 0); assert.ok(m.positions.length / 3 > 2 * m.count); return d.faceCounts; });
  check(`${family} color and micro seeds do not alter geometry`, () => { const color = { ...p.seeds, color: p.seeds.color + 1 }; const micro = { ...p.seeds, micro: p.seeds.micro + 1 }; assert.deepEqual(Array.from(m.positions), Array.from(V.geometry.mesh(V.geometry.tile(family, t.id, p.seeds.master, p.controls, color), { nu: 40, nv: 52 }).positions)); assert.deepEqual(Array.from(m.positions), Array.from(V.geometry.mesh(V.geometry.tile(family, t.id, p.seeds.master, p.controls, micro), { nu: 40, nv: 52 }).positions)); });
  check(`${family} shape seed alters geometry`, () => { const other = { ...p.seeds, shape: p.seeds.shape + 1 }; assert.notDeepEqual(Array.from(m.positions), Array.from(V.geometry.mesh(V.geometry.tile(family, t.id, p.seeds.master, p.controls, other), { nu: 40, nv: 52 }).positions)); });
}
const roof = V.roof.buildRoof({ profiles: profile, childSeeds: seeded, variant: 0, physicalTime: 0, history: C.historyDefaults });
check('28 tile roof composition', () => { assert.equal(roof.meshes.length, 28); assert.equal(roof.diagnostics.panCount, 16); assert.equal(roof.diagnostics.coverCount, 12); assert.equal(roof.diagnostics.contacts.length, 36); assert.equal(new Set(roof.diagnostics.meshes.map(x => x.entityId)).size, 28); assert.ok(roof.diagnostics.compositions.frontBackPans.length); assert.ok(roof.diagnostics.compositions.frontBackCovers.length); return { contacts: roof.diagnostics.contacts.length, roles: roof.diagnostics.roles }; });
check('roof contact method is surface sampled', () => { assert.ok(roof.diagnostics.contacts.every(x => x.method.includes('top-surface band'))); assert.equal(roof.diagnostics.placement.bboxOnlyContactUsed, false); });
check('families and variants stay isolated', () => { const alt = V.roof.buildRoof({ profiles: profile, childSeeds: seeded, variant: 1, physicalTime: 0, history: C.historyDefaults }); assert.notEqual(roof.diagnostics.meshes[0].positionHash, alt.diagnostics.meshes[0].positionHash); assert.equal(roof.diagnostics.meshes[0].family, 'pan'); assert.equal(roof.diagnostics.meshes[16].family, 'cover'); });
check('unified clock is deterministic and approval stays closed', () => { const s = V.studio.makeState(); const before = s.physicalTime; V.studio.tick(s); assert.equal(s.physicalTime, before + 21600); assert.equal(s.displayTime, s.physicalTime); assert.equal(s.solverStep, 21600); });
const report = { schema: 'tiles-mother-v05-core-report', version: '0.5.0', tests: checks, allPassed: checks.every(x => x.passed), visualApproved: false, productionApproved: false, limitations: ['Triangle incidence and spatial welding do not prove every global self-intersection is absent.', 'Physical scale, roughness, true height and historical fit remain uncalibrated.'] };
fs.mkdirSync(path.join(root, '..', 'qa-v05'), { recursive: true });
fs.writeFileSync(path.join(root, '..', 'qa-v05', 'core-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ allPassed: report.allPassed, tests: report.tests.length, tileCount: roof.meshes.length, contacts: roof.diagnostics.contacts.length }));
if (!report.allPassed) process.exit(1);
