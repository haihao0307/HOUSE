'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const vec3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add3 = (a, b) => vec3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub3 = (a, b) => vec3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul3 = (a, s) => vec3(a.x * s, a.y * s, a.z * s);
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a, b) => vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len3 = (a) => Math.hypot(a.x, a.y, a.z);
const norm3 = (a) => { const n = len3(a) || 1; return mul3(a, 1 / n); };
const mix3 = (a, b, t) => vec3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));

class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    let x = this.s;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  range(a, b) { return lerp(a, b, this.next()); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(items) { return items[Math.floor(this.next() * items.length) % items.length]; }
}

function hashInt(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const tx = smooth(x - xi), ty = smooth(y - yi), tz = smooth(z - zi);
  const c = new Array(8);
  let k = 0;
  for (let dz = 0; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    c[k++] = hashInt(xi + dx, yi + dy, zi + dz, seed);
  }
  const x00 = lerp(c[0], c[1], tx), x10 = lerp(c[2], c[3], tx);
  const x01 = lerp(c[4], c[5], tx), x11 = lerp(c[6], c[7], tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}

function fbm3(x, y, z, seed, octaves = 3) {
  let value = 0, amp = 0.5, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise3(x * freq, y * freq, z * freq, seed + i * 1013) * amp;
    total += amp; amp *= 0.5; freq *= 2.03;
  }
  return value / total;
}

function sdRoundBox(p, b, r) {
  const qx = Math.abs(p.x) - b.x + r;
  const qy = Math.abs(p.y) - b.y + r;
  const qz = Math.abs(p.z) - b.z + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}

function sdSphere(p, c, r) { return len3(sub3(p, c)) - r; }

function sdCapsule(p, a, b, r) {
  const pa = sub3(p, a), ba = sub3(b, a);
  const h = clamp(dot3(pa, ba) / Math.max(dot3(ba, ba), 1e-8), 0, 1);
  return len3(sub3(pa, mul3(ba, h))) - r;
}

function normalizedDimensions(profile) {
  const ratio = profile.runtimeDNA.shapeRatio;
  const longest = Math.max(...ratio);
  const scale = 3.4 / longest;
  return vec3(ratio[0] * scale, ratio[1] * scale, ratio[2] * scale);
}

function buildDamage(profile, seed, level, dims) {
  const dna = profile.runtimeDNA;
  const rng = new RNG(seed ^ 0x9e3779b9);
  const b = mul3(dims, 0.5);
  const minD = Math.min(dims.x, dims.y, dims.z);
  const chips = [], pits = [], cracks = [];
  const chipCount = Math.max(1, Math.round(1 + dna.edgeFragility * 3 + level * 5));
  const pitCount = Math.max(1, Math.round(1 + dna.pitDensity * 3 + level * 4));
  const crackCount = level < 0.25 ? 0 : Math.max(1, Math.round(dna.crackAffinity * 1.8 + level * 1.8));
  const signs = [-1, 1];

  for (let i = 0; i < chipCount; i++) {
    const sx = rng.pick(signs), sy = rng.pick(signs), sz = rng.pick(signs);
    const mode = rng.next();
    let center;
    if (mode < 0.58) {
      center = vec3(
        sx * (b.x + rng.range(-0.05, 0.08) * minD),
        sy * (b.y + rng.range(-0.04, 0.08) * minD),
        sz * (b.z + rng.range(-0.05, 0.08) * minD)
      );
    } else if (mode < 0.79) {
      center = vec3(sx * (b.x + 0.02 * minD), rng.range(-0.65, 0.65) * b.y, sz * (b.z + 0.02 * minD));
    } else {
      center = vec3(rng.range(-0.75, 0.75) * b.x, sy * (b.y + 0.02 * minD), sz * (b.z + 0.02 * minD));
    }
    chips.push({ center, radius: rng.range(0.12, 0.25) * minD * (0.75 + level), irregular: rng.range(0.1, 0.32) });
  }

  const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  for (let i = 0; i < pitCount; i++) {
    const face = rng.pick(faces);
    const radius = rng.range(0.055, 0.13) * minD * (0.7 + level * 0.8);
    let center = vec3();
    if (face === 'px' || face === 'nx') {
      center = vec3((face === 'px' ? 1 : -1) * (b.x + radius * rng.range(0.18, 0.58)), rng.range(-0.78, 0.78) * b.y, rng.range(-0.82, 0.82) * b.z);
    } else if (face === 'py' || face === 'ny') {
      center = vec3(rng.range(-0.84, 0.84) * b.x, (face === 'py' ? 1 : -1) * (b.y + radius * rng.range(0.18, 0.55)), rng.range(-0.82, 0.82) * b.z);
    } else {
      center = vec3(rng.range(-0.84, 0.84) * b.x, rng.range(-0.76, 0.76) * b.y, (face === 'pz' ? 1 : -1) * (b.z + radius * rng.range(0.18, 0.58)));
    }
    pits.push({ center, radius, irregular: rng.range(0.05, 0.25) });
  }

  for (let i = 0; i < crackCount; i++) {
    const face = rng.pick(['px', 'nx', 'py', 'pz', 'nz']);
    const width = rng.range(0.016, 0.035) * minD * (0.7 + level);
    let a, c;
    if (face === 'px' || face === 'nx') {
      const x = (face === 'px' ? 1 : -1) * (b.x + width * 0.18);
      const y0 = rng.range(-0.55, 0.55) * b.y, z0 = rng.range(-0.65, 0.65) * b.z;
      a = vec3(x, y0, z0); c = vec3(x, clamp(y0 + rng.range(-0.75, 0.75) * b.y, -b.y, b.y), clamp(z0 + rng.range(-0.8, 0.8) * b.z, -b.z, b.z));
    } else if (face === 'py') {
      const y = b.y + width * 0.18;
      const x0 = rng.range(-0.65, 0.65) * b.x, z0 = rng.range(-0.65, 0.65) * b.z;
      a = vec3(x0, y, z0); c = vec3(clamp(x0 + rng.range(-0.75, 0.75) * b.x, -b.x, b.x), y, clamp(z0 + rng.range(-0.75, 0.75) * b.z, -b.z, b.z));
    } else {
      const z = (face === 'pz' ? 1 : -1) * (b.z + width * 0.18);
      const x0 = rng.range(-0.65, 0.65) * b.x, y0 = rng.range(-0.55, 0.55) * b.y;
      a = vec3(x0, y0, z); c = vec3(clamp(x0 + rng.range(-0.8, 0.8) * b.x, -b.x, b.x), clamp(y0 + rng.range(-0.75, 0.75) * b.y, -b.y, b.y), z);
    }
    cracks.push({ a, b: c, radius: width });
    if (rng.next() < 0.58) {
      const mid = mix3(a, c, rng.range(0.35, 0.72));
      const branch = add3(mid, vec3(rng.range(-0.2, 0.2) * dims.x, rng.range(-0.25, 0.25) * dims.y, rng.range(-0.2, 0.2) * dims.z));
      cracks.push({ a: mid, b: branch, radius: width * rng.range(0.55, 0.78) });
    }
  }
  return { chips, pits, cracks };
}

function createSDF(profile, seed, level) {
  const dims = normalizedDimensions(profile);
  const b = mul3(dims, 0.5);
  const dna = profile.runtimeDNA;
  const minD = Math.min(dims.x, dims.y, dims.z);
  const radius = dna.edgeRadius * minD;
  const damage = buildDamage(profile, seed, level, dims);
  const macroAmp = dna.macroWarp * minD;
  const reliefAmp = dna.surfaceRelief * minD;
  const phase = new RNG(seed).range(-100, 100);

  const sdf = (p) => {
    const warpX = (fbm3(p.y * 0.72 + phase, p.z * 0.72, p.x * 0.24, seed + 17, 2) - 0.5) * macroAmp * 0.42;
    const warpY = (fbm3(p.x * 0.66, p.z * 0.66 + phase, p.y * 0.24, seed + 31, 2) - 0.5) * macroAmp;
    const warpZ = (fbm3(p.x * 0.72 + phase, p.y * 0.72, p.z * 0.24, seed + 47, 2) - 0.5) * macroAmp * 0.52;
    const q = vec3(p.x + warpX, p.y + warpY, p.z + warpZ);
    let d = sdRoundBox(q, b, radius);
    const grain = fbm3(p.x * dna.grainScale, p.y * dna.grainScale, p.z * dna.grainScale, seed + 71, 3) - 0.5;
    d += grain * reliefAmp;
    for (const chip of damage.chips) {
      const localWarp = (noise3(p.x * 15, p.y * 15, p.z * 15, seed + 101) - 0.5) * chip.irregular * chip.radius;
      d = Math.max(d, -(sdSphere(p, chip.center, chip.radius + localWarp)));
    }
    for (const pit of damage.pits) {
      const localWarp = (noise3(p.x * 22, p.y * 22, p.z * 22, seed + 211) - 0.5) * pit.irregular * pit.radius;
      d = Math.max(d, -(sdSphere(p, pit.center, pit.radius + localWarp)));
    }
    for (const crack of damage.cracks) d = Math.max(d, -sdCapsule(p, crack.a, crack.b, crack.radius));
    return d;
  };

  return { sdf, dims, b, damage, radius };
}

const cubeCorners = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
];
const tetrahedra = [
  [0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6],
  [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]
];
const tetraEdges = [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]];

function polygonizeTetra(points, values, sdf, epsilon, positions, normals, maxVertices) {
  const hits = [];
  for (const [ia, ib] of tetraEdges) {
    const va = values[ia], vb = values[ib];
    if ((va < 0) === (vb < 0)) continue;
    const t = clamp(va / (va - vb), 0, 1);
    hits.push(mix3(points[ia], points[ib], t));
  }
  if (hits.length !== 3 && hits.length !== 4) return;
  let ordered = hits;
  if (hits.length === 4) {
    const center = mul3(hits.reduce((acc, p) => add3(acc, p), vec3()), 0.25);
    const gn = gradientSDF(sdf, center, epsilon);
    const axis = Math.abs(gn.y) < 0.85 ? vec3(0, 1, 0) : vec3(1, 0, 0);
    const u = norm3(cross3(axis, gn));
    const v = norm3(cross3(gn, u));
    ordered = hits.slice().sort((a, b) => {
      const da = sub3(a, center), db = sub3(b, center);
      return Math.atan2(dot3(da, v), dot3(da, u)) - Math.atan2(dot3(db, v), dot3(db, u));
    });
  }
  const tris = hits.length === 3 ? [[ordered[0], ordered[1], ordered[2]]] : [[ordered[0], ordered[1], ordered[2]], [ordered[0], ordered[2], ordered[3]]];
  for (let tri of tris) {
    if (positions.length / 3 + 3 > maxVertices) return;
    const ns = tri.map((p) => gradientSDF(sdf, p, epsilon));
    const face = cross3(sub3(tri[1], tri[0]), sub3(tri[2], tri[0]));
    const avg = norm3(add3(add3(ns[0], ns[1]), ns[2]));
    if (dot3(face, avg) < 0) { tri = [tri[0], tri[2], tri[1]]; [ns[1], ns[2]] = [ns[2], ns[1]]; }
    for (let i = 0; i < 3; i++) {
      positions.push(tri[i].x, tri[i].y, tri[i].z);
      normals.push(ns[i].x, ns[i].y, ns[i].z);
    }
  }
}

function gradientSDF(sdf, p, e) {
  const dx = sdf(vec3(p.x + e, p.y, p.z)) - sdf(vec3(p.x - e, p.y, p.z));
  const dy = sdf(vec3(p.x, p.y + e, p.z)) - sdf(vec3(p.x, p.y - e, p.z));
  const dz = sdf(vec3(p.x, p.y, p.z + e)) - sdf(vec3(p.x, p.y, p.z - e));
  return norm3(vec3(dx, dy, dz));
}

function buildMesh(profile, seed, level, quality = 1) {
  const field = createSDF(profile, seed, level);
  const dims = field.dims, minD = Math.min(dims.x, dims.y, dims.z);
  const margin = minD * 0.38;
  const size = vec3(dims.x + margin * 2, dims.y + margin * 2, dims.z + margin * 2);
  const longest = Math.max(size.x, size.y, size.z);
  const target = Math.round(42 * quality);
  const nx = clamp(Math.round(target * size.x / longest), 18, target);
  const ny = clamp(Math.round(target * size.y / longest), 14, target);
  const nz = clamp(Math.round(target * size.z / longest), 16, target);
  const min = vec3(-size.x / 2, -size.y / 2, -size.z / 2);
  const step = vec3(size.x / (nx - 1), size.y / (ny - 1), size.z / (nz - 1));
  const grid = new Float32Array(nx * ny * nz);
  const gi = (x, y, z) => x + nx * (y + ny * z);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    grid[gi(x, y, z)] = field.sdf(vec3(min.x + x * step.x, min.y + y * step.y, min.z + z * step.z));
  }
  const positions = [], normals = [];
  const maxVertices = 210000;
  const epsilon = Math.min(step.x, step.y, step.z) * 0.42;
  const cp = new Array(8), cv = new Array(8);
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    let allIn = true, allOut = true;
    for (let c = 0; c < 8; c++) {
      const o = cubeCorners[c], gx = x + o[0], gy = y + o[1], gz = z + o[2];
      cp[c] = vec3(min.x + gx * step.x, min.y + gy * step.y, min.z + gz * step.z);
      cv[c] = grid[gi(gx, gy, gz)];
      if (cv[c] < 0) allOut = false; else allIn = false;
    }
    if (allIn || allOut) continue;
    for (const tet of tetrahedra) {
      const tp = tet.map((i) => cp[i]), tv = tet.map((i) => cv[i]);
      polygonizeTetra(tp, tv, field.sdf, epsilon, positions, normals, maxVertices);
      if (positions.length / 3 >= maxVertices) break;
    }
    if (positions.length / 3 >= maxVertices) break;
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    triangles: positions.length / 9,
    vertices: positions.length / 3,
    dims,
    damage: field.damage,
    seed,
    level,
    profileId: profile.id,
    grid: [nx, ny, nz]
  };
}

const BrickMotherGeometry = { clamp, lerp, smooth, vec3, add3, sub3, mul3, dot3, cross3, len3, norm3, mix3, RNG, noise3, fbm3, sdRoundBox, sdSphere, sdCapsule, normalizedDimensions, buildDamage, createSDF, buildMesh };
if (typeof window !== 'undefined') window.BrickMotherGeometry = BrickMotherGeometry;
if (typeof module !== 'undefined' && module.exports) module.exports = BrickMotherGeometry;
