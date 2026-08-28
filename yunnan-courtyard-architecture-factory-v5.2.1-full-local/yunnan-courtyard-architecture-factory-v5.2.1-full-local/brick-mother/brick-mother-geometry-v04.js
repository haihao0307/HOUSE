(() => {
'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
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
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const tx = smoother(x - xi), ty = smoother(y - yi), tz = smoother(z - zi);
  const c = new Array(8);
  let k = 0;
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) c[k++] = hashInt(xi + dx, yi + dy, zi + dz, seed);
    }
  }
  const x00 = lerp(c[0], c[1], tx), x10 = lerp(c[2], c[3], tx);
  const x01 = lerp(c[4], c[5], tx), x11 = lerp(c[6], c[7], tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}

function fbm3(x, y, z, seed, octaves = 4, lacunarity = 2.03, gain = 0.5) {
  let value = 0, amp = 0.5, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise3(x * freq, y * freq, z * freq, seed + i * 1013) * amp;
    total += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return value / Math.max(total, 1e-6);
}

function ridgedFbm3(x, y, z, seed, octaves = 4) {
  let value = 0, amp = 0.55, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x * freq, y * freq, z * freq, seed + i * 809) * 2 - 1);
    value += n * n * amp;
    total += amp;
    amp *= 0.48;
    freq *= 2.11;
  }
  return value / Math.max(total, 1e-6);
}

function sdRoundBox(p, b, r) {
  const qx = Math.abs(p.x) - b.x + r;
  const qy = Math.abs(p.y) - b.y + r;
  const qz = Math.abs(p.z) - b.z + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}

function sdEllipsoid(p, center, radii) {
  const q = vec3((p.x - center.x) / radii.x, (p.y - center.y) / radii.y, (p.z - center.z) / radii.z);
  return (len3(q) - 1) * Math.min(radii.x, radii.y, radii.z);
}

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

const FACE_IDS = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

function facePoint(face, b, rng, inset = 0) {
  if (face === 'px' || face === 'nx') {
    return vec3((face === 'px' ? 1 : -1) * (b.x + inset), rng.range(-0.84, 0.84) * b.y, rng.range(-0.84, 0.84) * b.z);
  }
  if (face === 'py' || face === 'ny') {
    return vec3(rng.range(-0.86, 0.86) * b.x, (face === 'py' ? 1 : -1) * (b.y + inset), rng.range(-0.84, 0.84) * b.z);
  }
  return vec3(rng.range(-0.86, 0.86) * b.x, rng.range(-0.82, 0.82) * b.y, (face === 'pz' ? 1 : -1) * (b.z + inset));
}

function faceRadii(face, radius, depth, rng) {
  const a = radius * rng.range(0.72, 1.35);
  const c = radius * rng.range(0.68, 1.25);
  if (face === 'px' || face === 'nx') return vec3(depth, a, c);
  if (face === 'py' || face === 'ny') return vec3(a, depth, c);
  return vec3(a, c, depth);
}

function buildDamage(profile, seed, level, dims) {
  const dna = profile.runtimeDNA;
  const nd = profile.noiseDNA || {};
  const rng = new RNG(seed ^ 0x9e3779b9);
  const b = mul3(dims, 0.5);
  const minD = Math.min(dims.x, dims.y, dims.z);
  const chips = [], pits = [], poreClusters = [], cracks = [];
  const chipCount = Math.max(1, Math.round(1 + dna.edgeFragility * 3.4 + level * 5.4));
  const pitCount = Math.max(1, Math.round(1 + dna.pitDensity * 3.0 + level * 4.2));
  const poreCount = Math.max(2, Math.round((nd.geometryPoreCount ?? 5) * (0.72 + level * 0.82)));
  const crackCount = level < 0.22 ? 0 : Math.max(1, Math.round(dna.crackAffinity * 1.6 + level * 1.7));
  const signs = [-1, 1];

  for (let i = 0; i < chipCount; i++) {
    const sx = rng.pick(signs), sy = rng.pick(signs), sz = rng.pick(signs);
    const mode = rng.next();
    let center;
    if (mode < 0.62) {
      center = vec3(
        sx * (b.x + rng.range(-0.05, 0.08) * minD),
        sy * (b.y + rng.range(-0.04, 0.08) * minD),
        sz * (b.z + rng.range(-0.05, 0.08) * minD)
      );
    } else if (mode < 0.82) {
      center = vec3(sx * (b.x + 0.025 * minD), rng.range(-0.72, 0.72) * b.y, sz * (b.z + 0.025 * minD));
    } else {
      center = vec3(rng.range(-0.78, 0.78) * b.x, sy * (b.y + 0.025 * minD), sz * (b.z + 0.025 * minD));
    }
    const r = rng.range(0.105, 0.235) * minD * (0.72 + level * 0.95);
    chips.push({
      center,
      radii: vec3(r * rng.range(0.7, 1.35), r * rng.range(0.62, 1.12), r * rng.range(0.72, 1.3)),
      irregular: rng.range(0.08, 0.28)
    });
  }

  for (let i = 0; i < pitCount; i++) {
    const face = rng.pick(FACE_IDS);
    const radius = rng.range(0.055, 0.125) * minD * (0.72 + level * 0.76);
    const depth = radius * rng.range(0.42, 0.78);
    pits.push({
      face,
      center: facePoint(face, b, rng, depth * rng.range(0.12, 0.48)),
      radii: faceRadii(face, radius, depth, rng),
      irregular: rng.range(0.04, 0.18)
    });
  }

  for (let i = 0; i < poreCount; i++) {
    const face = rng.pick(FACE_IDS);
    const radius = rng.range(0.018, 0.052) * minD * (0.65 + level * 0.68);
    const depth = radius * rng.range(0.32, 0.7);
    poreClusters.push({
      face,
      center: facePoint(face, b, rng, depth * rng.range(0.05, 0.38)),
      radii: faceRadii(face, radius, depth, rng),
      irregular: rng.range(0.02, 0.12)
    });
  }

  for (let i = 0; i < crackCount; i++) {
    const face = rng.pick(['px', 'nx', 'py', 'pz', 'nz']);
    const width = rng.range(0.012, 0.029) * minD * (0.68 + level * 0.9);
    let a, c;
    if (face === 'px' || face === 'nx') {
      const x = (face === 'px' ? 1 : -1) * (b.x + width * 0.12);
      const y0 = rng.range(-0.58, 0.58) * b.y, z0 = rng.range(-0.68, 0.68) * b.z;
      a = vec3(x, y0, z0);
      c = vec3(x, clamp(y0 + rng.range(-0.78, 0.78) * b.y, -b.y, b.y), clamp(z0 + rng.range(-0.86, 0.86) * b.z, -b.z, b.z));
    } else if (face === 'py') {
      const y = b.y + width * 0.12;
      const x0 = rng.range(-0.7, 0.7) * b.x, z0 = rng.range(-0.68, 0.68) * b.z;
      a = vec3(x0, y, z0);
      c = vec3(clamp(x0 + rng.range(-0.8, 0.8) * b.x, -b.x, b.x), y, clamp(z0 + rng.range(-0.78, 0.78) * b.z, -b.z, b.z));
    } else {
      const z = (face === 'pz' ? 1 : -1) * (b.z + width * 0.12);
      const x0 = rng.range(-0.7, 0.7) * b.x, y0 = rng.range(-0.58, 0.58) * b.y;
      a = vec3(x0, y0, z);
      c = vec3(clamp(x0 + rng.range(-0.86, 0.86) * b.x, -b.x, b.x), clamp(y0 + rng.range(-0.78, 0.78) * b.y, -b.y, b.y), z);
    }
    cracks.push({ a, b: c, radius: width });
    if (rng.next() < 0.64) {
      const mid = mix3(a, c, rng.range(0.34, 0.72));
      const branch = add3(mid, vec3(rng.range(-0.18, 0.18) * dims.x, rng.range(-0.22, 0.22) * dims.y, rng.range(-0.18, 0.18) * dims.z));
      cracks.push({ a: mid, b: branch, radius: width * rng.range(0.48, 0.74) });
    }
  }

  return { chips, pits, poreClusters, cracks };
}

function createSDF(profile, seed, level) {
  const dims = normalizedDimensions(profile);
  const b = mul3(dims, 0.5);
  const dna = profile.runtimeDNA;
  const nd = profile.noiseDNA || {};
  const minD = Math.min(dims.x, dims.y, dims.z);
  const radius = dna.edgeRadius * minD * (nd.edgeRoundnessScale ?? 0.68);
  const damage = buildDamage(profile, seed, level, dims);
  const macroAmp = dna.macroWarp * minD * (nd.geometryWarp ?? 0.9);
  const reliefAmp = dna.surfaceRelief * minD * (nd.geometryRelief ?? 0.72);
  const phase = new RNG(seed).range(-100, 100);

  const sdf = (p) => {
    const warpScale = nd.domainWarpScale ?? 0.78;
    const wx = fbm3(p.y * warpScale + phase, p.z * warpScale, p.x * 0.23, seed + 17, 3) - 0.5;
    const wy = fbm3(p.x * warpScale, p.z * warpScale + phase, p.y * 0.23, seed + 31, 3) - 0.5;
    const wz = fbm3(p.x * warpScale + phase, p.y * warpScale, p.z * 0.23, seed + 47, 3) - 0.5;
    const q = vec3(p.x + wx * macroAmp * 0.48, p.y + wy * macroAmp, p.z + wz * macroAmp * 0.56);
    let d = sdRoundBox(q, b, radius);

    const broad = fbm3(p.x * 1.7, p.y * 1.45, p.z * 1.7, seed + 71, 4) - 0.5;
    const ridge = ridgedFbm3(p.x * 4.8, p.y * 4.1, p.z * 4.8, seed + 103, 3) - 0.5;
    d += (broad * 0.68 + ridge * 0.32) * reliefAmp;

    for (const chip of damage.chips) {
      const irregular = (noise3(p.x * 12, p.y * 12, p.z * 12, seed + 131) - 0.5) * chip.irregular * minD;
      const radii = vec3(
        Math.max(0.004, chip.radii.x + irregular),
        Math.max(0.004, chip.radii.y + irregular * 0.72),
        Math.max(0.004, chip.radii.z + irregular * 0.88)
      );
      d = Math.max(d, -sdEllipsoid(p, chip.center, radii));
    }

    for (const pit of damage.pits) {
      const irregular = (noise3(p.x * 18, p.y * 18, p.z * 18, seed + 211) - 0.5) * pit.irregular * minD;
      const radii = vec3(
        Math.max(0.003, pit.radii.x + irregular),
        Math.max(0.003, pit.radii.y + irregular),
        Math.max(0.003, pit.radii.z + irregular)
      );
      d = Math.max(d, -sdEllipsoid(p, pit.center, radii));
    }

    for (const pore of damage.poreClusters) {
      const irregular = (noise3(p.x * 29, p.y * 29, p.z * 29, seed + 257) - 0.5) * pore.irregular * minD;
      const radii = vec3(
        Math.max(0.002, pore.radii.x + irregular),
        Math.max(0.002, pore.radii.y + irregular),
        Math.max(0.002, pore.radii.z + irregular)
      );
      d = Math.max(d, -sdEllipsoid(p, pore.center, radii));
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

function gradientSDF(sdf, p, e) {
  const dx = sdf(vec3(p.x + e, p.y, p.z)) - sdf(vec3(p.x - e, p.y, p.z));
  const dy = sdf(vec3(p.x, p.y + e, p.z)) - sdf(vec3(p.x, p.y - e, p.z));
  const dz = sdf(vec3(p.x, p.y, p.z + e)) - sdf(vec3(p.x, p.y, p.z - e));
  return norm3(vec3(dx, dy, dz));
}

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

  const tris = hits.length === 3
    ? [[ordered[0], ordered[1], ordered[2]]]
    : [[ordered[0], ordered[1], ordered[2]], [ordered[0], ordered[2], ordered[3]]];

  for (let tri of tris) {
    if (positions.length / 3 + 3 > maxVertices) return;
    const ns = tri.map((p) => gradientSDF(sdf, p, epsilon));
    const face = cross3(sub3(tri[1], tri[0]), sub3(tri[2], tri[0]));
    const avg = norm3(add3(add3(ns[0], ns[1]), ns[2]));
    if (dot3(face, avg) < 0) {
      tri = [tri[0], tri[2], tri[1]];
      [ns[1], ns[2]] = [ns[2], ns[1]];
    }
    for (let i = 0; i < 3; i++) {
      positions.push(tri[i].x, tri[i].y, tri[i].z);
      normals.push(ns[i].x, ns[i].y, ns[i].z);
    }
  }
}

function buildMesh(profile, seed, level, quality = 1) {
  const field = createSDF(profile, seed, level);
  const dims = field.dims, minD = Math.min(dims.x, dims.y, dims.z);
  const margin = minD * 0.34;
  const size = vec3(dims.x + margin * 2, dims.y + margin * 2, dims.z + margin * 2);
  const longest = Math.max(size.x, size.y, size.z);
  const target = Math.round(50 * quality);
  const nx = clamp(Math.round(target * size.x / longest), 22, target);
  const ny = clamp(Math.round(target * size.y / longest), 18, target);
  const nz = clamp(Math.round(target * size.z / longest), 20, target);
  const min = vec3(-size.x / 2, -size.y / 2, -size.z / 2);
  const step = vec3(size.x / (nx - 1), size.y / (ny - 1), size.z / (nz - 1));
  const grid = new Float32Array(nx * ny * nz);
  const gi = (x, y, z) => x + nx * (y + ny * z);

  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        grid[gi(x, y, z)] = field.sdf(vec3(min.x + x * step.x, min.y + y * step.y, min.z + z * step.z));
      }
    }
  }

  const positions = [], normals = [];
  const maxVertices = 360000;
  const epsilon = Math.min(step.x, step.y, step.z) * 0.38;
  const cp = new Array(8), cv = new Array(8);

  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
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
    grid: [nx, ny, nz],
    noiseVersion: 'v0.4-multiband'
  };
}

window.BrickMotherGeometryV04 = {
  clamp, lerp, smooth, smoother, vec3, add3, sub3, mul3, dot3, cross3, len3, norm3, mix3,
  RNG, noise3, fbm3, ridgedFbm3, sdRoundBox, sdEllipsoid, sdCapsule,
  normalizedDimensions, buildDamage, createSDF, buildMesh
};
})();
