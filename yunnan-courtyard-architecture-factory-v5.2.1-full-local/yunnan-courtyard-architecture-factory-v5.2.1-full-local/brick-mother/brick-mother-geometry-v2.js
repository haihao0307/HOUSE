(() => {
'use strict';

const GAEA = window.BrickMotherGaeaV1 || null;

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
  constructor(seed) { this.s = (Number(seed) >>> 0) || 1; }
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



function sdOrientedRoundBox(p, center, halfSize, direction, radius = 0.02) {
  const u = norm3(vec3(direction.x, direction.y, 0));
  const v = vec3(-u.y, u.x, 0);
  const d = sub3(p, center);
  const q = vec3(dot3(d, u), dot3(d, v), d.z);
  return sdRoundBox(q, halfSize, Math.min(radius, Math.min(halfSize.x, halfSize.y, halfSize.z) * 0.72));
}

function specimenDimensions(profile, controls) {
  if ((controls?.benchmarkSlab ?? 0) < 0.5) return normalizedDimensions(profile);
  const richness = clamp((controls.shapeVariation ?? 0.9) - 0.9, -0.6, 0.8);
  if (profile.family === 'STONE') return vec3(3.12 + richness * 0.10, 3.04 - richness * 0.03, 1.12 + richness * 0.05);
  if (profile.family === 'ADOBE') return vec3(3.18 + richness * 0.09, 3.00 - richness * 0.02, 1.08 + richness * 0.05);
  return vec3(3.16 + richness * 0.08, 3.02 - richness * 0.03, 1.10 + richness * 0.05);
}

const FORMATION_EVENT_TYPES = Object.freeze({
  macroPlateLoss: 1,
  shearBand: 2,
  beddingLayer: 3,
  delaminationPlate: 4,
  undercutShelf: 5,
  cavityCluster: 6,
  fractureBranch: 7,
  edgeSpall: 8,
  fiberBundle: 9,
  fiberPulloutChannel: 10,
  compactionFlake: 11,
  mineralSeam: 12
});

function frontDirection(angle) {
  return norm3(vec3(Math.cos(angle), Math.sin(angle), 0));
}

function frontEventPoint(b, rng, xRange = 0.70, yRange = 0.70, zOffset = 0) {
  return vec3(rng.range(-xRange, xRange) * b.x, rng.range(-yRange, yRange) * b.y, b.z + zOffset);
}

function buildFormationEvents(profile, seedDNA, controls, dims) {
  if ((controls.benchmarkSlab ?? 0) < 0.5) return [];
  const seeds = normalizeSeedDNA(seedDNA, profile);
  const rng = new RNG(seeds.damage ^ seeds.detail ^ 0x6a09e667);
  const inclusionRng = new RNG(seeds.inclusion ^ 0xbb67ae85);
  const b = mul3(dims, 0.5);
  const minD = Math.min(dims.x, dims.y, dims.z);
  const events = [];
  const add = (type, center, size, angle, strength = 1, phase = rng.next()) => {
    events.push({
      type,
      typeCode: FORMATION_EVENT_TYPES[type],
      center,
      size,
      direction: frontDirection(angle),
      strength,
      phase
    });
  };

  const commonAngle = rng.range(-0.82, 0.82);
  add('macroPlateLoss', frontEventPoint(b, rng, 0.58, 0.62, -0.035 * minD), vec3(0.72 * minD, 0.40 * minD, 0.24 * minD), commonAngle, 1.0);
  add('macroPlateLoss', frontEventPoint(b, rng, 0.72, 0.72, -0.025 * minD), vec3(0.48 * minD, 0.29 * minD, 0.20 * minD), commonAngle + rng.range(-0.55, 0.55), 0.78);

  const cavityCount = profile.family === 'FIRED_CLAY' ? 4 : 3;
  for (let i = 0; i < cavityCount; i++) {
    const large = i === 0 || (profile.family === 'FIRED_CLAY' && i === 1);
    add(
      'cavityCluster',
      frontEventPoint(b, rng, 0.72, 0.72, -rng.range(0.03, 0.10) * minD),
      vec3(
        rng.range(large ? 0.17 : 0.09, large ? 0.30 : 0.18) * minD,
        rng.range(large ? 0.13 : 0.07, large ? 0.25 : 0.16) * minD,
        rng.range(0.20, large ? 0.42 : 0.31) * minD
      ),
      rng.range(-Math.PI, Math.PI),
      large ? 1.18 : 0.88,
      rng.next()
    );
  }

  for (let i = 0; i < 2; i++) {
    add(
      'fractureBranch',
      frontEventPoint(b, rng, 0.62, 0.60, -0.018 * minD),
      vec3(rng.range(0.46, 0.82) * minD, rng.range(0.018, 0.036) * minD, rng.range(0.045, 0.085) * minD),
      rng.range(-1.15, 1.15),
      rng.range(0.72, 1.10),
      rng.next()
    );
  }

  const edgeAnchors = [
    vec3(-b.x * 0.96, b.y * rng.range(-0.72, 0.78), b.z * 0.94),
    vec3(b.x * 0.96, b.y * rng.range(-0.76, 0.74), b.z * 0.94),
    vec3(b.x * rng.range(-0.74, 0.74), -b.y * 0.97, b.z * 0.92)
  ];
  for (const center of edgeAnchors) {
    add('edgeSpall', center, vec3(rng.range(0.18, 0.34) * minD, rng.range(0.14, 0.29) * minD, rng.range(0.20, 0.36) * minD), rng.range(-Math.PI, Math.PI), rng.range(0.72, 1.12));
  }

  if (profile.family === 'STONE') {
    const shearAngle = rng.range(-0.66, -0.36);
    add('shearBand', vec3(0, rng.range(-0.04, 0.16) * b.y, b.z - 0.06 * minD), vec3(1.22 * minD, 0.095 * minD, 0.16 * minD), shearAngle, 1.25);
    for (let i = 0; i < 4; i++) {
      const y = lerp(-0.56, 0.56, i / 3) * b.y + rng.range(-0.10, 0.10) * minD;
      add('beddingLayer', vec3(rng.range(-0.12, 0.12) * b.x, y, b.z + rng.range(0.010, 0.045) * minD), vec3(rng.range(0.78, 1.22) * minD, rng.range(0.055, 0.12) * minD, rng.range(0.020, 0.052) * minD), shearAngle + rng.range(-0.18, 0.18), rng.range(0.62, 1.05));
    }
    for (let i = 0; i < 2; i++) {
      add('undercutShelf', frontEventPoint(b, rng, 0.48, 0.52, -0.045 * minD), vec3(rng.range(0.48, 0.82) * minD, rng.range(0.045, 0.085) * minD, rng.range(0.10, 0.18) * minD), shearAngle + rng.range(-0.22, 0.22), 1.10);
      add('mineralSeam', frontEventPoint(b, rng, 0.58, 0.58, 0.018 * minD), vec3(rng.range(0.52, 0.92) * minD, rng.range(0.012, 0.025) * minD, rng.range(0.012, 0.025) * minD), shearAngle + rng.range(-0.30, 0.30), 0.76);
    }
  } else if (profile.family === 'ADOBE') {
    const flakeAngle = rng.range(-0.50, 0.50);
    for (let i = 0; i < 4; i++) {
      add('compactionFlake', frontEventPoint(b, rng, 0.62, 0.68, rng.range(0.010, 0.045) * minD), vec3(rng.range(0.38, 0.78) * minD, rng.range(0.19, 0.38) * minD, rng.range(0.020, 0.052) * minD), flakeAngle + rng.range(-0.72, 0.72), rng.range(0.72, 1.12));
    }
    for (let i = 0; i < 3; i++) {
      add('fiberBundle', frontEventPoint(b, inclusionRng, 0.66, 0.72, rng.range(0.025, 0.060) * minD), vec3(inclusionRng.range(0.44, 0.86) * minD, inclusionRng.range(0.010, 0.021) * minD, inclusionRng.range(0.010, 0.022) * minD), inclusionRng.range(-1.25, 1.25), inclusionRng.range(0.80, 1.20), inclusionRng.next());
    }
    for (let i = 0; i < 2; i++) {
      add('fiberPulloutChannel', frontEventPoint(b, inclusionRng, 0.62, 0.68, -0.022 * minD), vec3(inclusionRng.range(0.30, 0.66) * minD, inclusionRng.range(0.012, 0.026) * minD, inclusionRng.range(0.030, 0.070) * minD), inclusionRng.range(-1.35, 1.35), 0.92, inclusionRng.next());
    }
    add('undercutShelf', frontEventPoint(b, rng, 0.44, 0.52, -0.040 * minD), vec3(0.58 * minD, 0.070 * minD, 0.13 * minD), flakeAngle, 0.90);
  } else {
    const plateAngle = rng.range(-0.58, 0.58);
    add('shearBand', frontEventPoint(b, rng, 0.32, 0.36, -0.040 * minD), vec3(0.92 * minD, 0.070 * minD, 0.13 * minD), plateAngle + rng.range(-0.38, 0.38), 0.75);
    for (let i = 0; i < 3; i++) {
      add('delaminationPlate', frontEventPoint(b, rng, 0.64, 0.66, rng.range(0.018, 0.055) * minD), vec3(rng.range(0.36, 0.70) * minD, rng.range(0.18, 0.34) * minD, rng.range(0.018, 0.045) * minD), plateAngle + rng.range(-0.78, 0.78), rng.range(0.72, 1.10));
    }
    for (let i = 0; i < 2; i++) {
      add('undercutShelf', frontEventPoint(b, rng, 0.52, 0.56, -0.045 * minD), vec3(rng.range(0.40, 0.72) * minD, rng.range(0.045, 0.080) * minD, rng.range(0.10, 0.17) * minD), plateAngle + rng.range(-0.48, 0.48), 1.02);
    }
    add('mineralSeam', frontEventPoint(b, rng, 0.60, 0.60, 0.018 * minD), vec3(0.64 * minD, 0.016 * minD, 0.018 * minD), plateAngle + rng.range(-0.50, 0.50), 0.70);
  }

  const limits = profile.family === 'STONE'
    ? { macroPlateLoss: 1, cavityCluster: 2, fractureBranch: 1, edgeSpall: 1, shearBand: 1, beddingLayer: 4, undercutShelf: 2, mineralSeam: 2 }
    : profile.family === 'ADOBE'
      ? { macroPlateLoss: 1, cavityCluster: 1, fractureBranch: 1, edgeSpall: 1, compactionFlake: 4, fiberBundle: 3, fiberPulloutChannel: 2, undercutShelf: 1 }
      : { macroPlateLoss: 2, cavityCluster: 3, fractureBranch: 2, edgeSpall: 2, shearBand: 1, delaminationPlate: 2, undercutShelf: 1, mineralSeam: 1 };
  const used = {};
  return events.filter((event) => {
    const limit = limits[event.type] || 0;
    const count = used[event.type] || 0;
    used[event.type] = count + 1;
    return count < limit;
  }).slice(0, 14);
}

function orientedEventEllipsoid(p, center, radii, direction) {
  const u = norm3(vec3(direction.x, direction.y, 0));
  const v = vec3(-u.y, u.x, 0);
  const delta = sub3(p, center);
  const q = vec3(dot3(delta, u), dot3(delta, v), delta.z);
  return sdEllipsoid(q, vec3(0, 0, 0), radii);
}

function applyFormationEventSDF(distance, p, event, seeds, minD) {
  const type = event.type;
  const dir = norm3(vec3(event.direction.x, event.direction.y, 0));
  const side = vec3(-dir.y, dir.x, 0);
  let d = distance;

  if (type === 'macroPlateLoss') {
    const center = add3(event.center, vec3(0, 0, event.size.z * 0.43 + 0.020 * minD));
    const radii = vec3(event.size.x * 0.31, event.size.y * 0.43, event.size.z * 0.22);
    const cut = orientedEventEllipsoid(p, center, radii, dir);
    return Math.max(d, -cut);
  }

  if (type === 'edgeSpall') {
    const center = add3(event.center, vec3(0, 0, event.size.z * 0.34 + 0.012 * minD));
    const radii = vec3(event.size.x * 0.39, event.size.y * 0.50, event.size.z * 0.27);
    return Math.max(d, -orientedEventEllipsoid(p, center, radii, dir));
  }

  if (type === 'cavityCluster') {
    const center = add3(event.center, vec3(0, 0, event.size.z * 0.45 + 0.018 * minD));
    const radii = vec3(event.size.x * 0.28, event.size.y * 0.38, event.size.z * 0.22);
    const along = mul3(dir, event.size.x * 0.19);
    const across = mul3(side, Math.sin(event.phase * 6.2831853) * event.size.y * 0.16);
    d = Math.max(d, -orientedEventEllipsoid(p, add3(center, across), radii, dir));
    d = Math.max(
      d,
      -orientedEventEllipsoid(
        p,
        add3(center, add3(along, mul3(across, -0.45))),
        vec3(radii.x * 0.52, radii.y * 0.62, radii.z * 0.58),
        dir
      )
    );
    return d;
  }

  if (type === 'fractureBranch' || type === 'shearBand' || type === 'fiberPulloutChannel') {
    const center = add3(event.center, vec3(0, 0, event.size.z * 0.66 + 0.008 * minD));
    const halfLength = event.size.x * (type === 'shearBand' ? 0.64 : 0.58);
    const radius = Math.max(
      0.0045 * minD,
      event.size.y * (type === 'shearBand' ? 0.30 : type === 'fractureBranch' ? 0.34 : 0.42)
    );
    const a = add3(center, mul3(dir, -halfLength));
    const b = add3(center, mul3(dir, halfLength));
    d = Math.max(d, -sdCapsule(p, a, b, radius));
    if (type === 'fractureBranch') {
      const branchDir = norm3(add3(mul3(dir, 0.72), mul3(side, event.phase > 0.5 ? 0.70 : -0.70)));
      const branchA = add3(center, mul3(dir, halfLength * 0.08));
      const branchB = add3(branchA, mul3(branchDir, halfLength * 0.34));
      d = Math.max(d, -sdCapsule(p, branchA, branchB, radius * 0.52));
    }
    return d;
  }

  if (type === 'undercutShelf') {
    const center = add3(event.center, vec3(0, 0, event.size.z * 0.48 + 0.012 * minD));
    const radii = vec3(event.size.x * 0.50, event.size.y * 0.42, event.size.z * 0.30);
    return Math.max(d, -orientedEventEllipsoid(p, center, radii, dir));
  }

  return d;
}

function normalizedDimensions(profile) {
  const ratio = profile.runtimeDNA.shapeRatio;
  const longest = Math.max(...ratio);
  const scale = 3.4 / longest;
  return vec3(ratio[0] * scale, ratio[1] * scale, ratio[2] * scale);
}

function seedValue(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? (Math.round(n) >>> 0) || fallback : fallback;
}

function normalizeSeedDNA(seedDNA, profile) {
  const baseFallback = seedValue(profile?.runtimeDNA?.seedBase, 1001);
  const source = typeof seedDNA === 'number' ? { master: seedDNA } : (seedDNA || {});
  const master = seedValue(source.master, baseFallback);
  const derive = (key, salt) => seedValue(source[key], (master + salt) >>> 0);
  return {
    master,
    shape: derive('shape', 101),
    damage: derive('damage', 211),
    pore: derive('pore', 307),
    color: derive('color', 401),
    water: derive('water', 503),
    weather: derive('weather', 601),
    inclusion: derive('inclusion', 701),
    detail: derive('detail', 809)
  };
}

function normalizeControls(controls = {}) {
  const number = (key, fallback, min, max) => clamp(Number.isFinite(Number(controls[key])) ? Number(controls[key]) : fallback, min, max);
  return {
    damage: number('damage', 0.72, 0, 1.6),
    poreDepth: number('poreDepth', 0.9, 0, 1.8),
    weathering: number('weathering', 0.72, 0, 1.6),
    shapeVariation: number('shapeVariation', 0.9, 0.2, 1.7),
    inclusion: number('inclusion', 0.8, 0, 1.6),
    colorRichness: number('colorRichness', 1.15, 0.35, 1.9),
    waterStain: number('waterStain', 0.72, 0, 1.6),
    rockDetail: number('rockDetail', 0.68, 0, 1.6),
    strata: number('strata', 0.28, 0, 1.6),
    microErosion: number('microErosion', 0.64, 0, 1.6),
    colorClarity: number('colorClarity', 0.92, 0, 1.6),
    colorGamut: number('colorGamut', 1.08, 0, 1.6),
    maskSharpness: number('maskSharpness', 0.92, 0, 1.6),
    poreDensity: number('poreDensity', 1.18, 0.20, 2.20),
    poreVariety: number('poreVariety', 1.08, 0.20, 1.80),
    benchmarkSlab: number('benchmarkSlab', 1.0, 0, 1)
  };
}

const FACE_IDS = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

function faceNormal(face) {
  if (face === 'px') return vec3(1, 0, 0);
  if (face === 'nx') return vec3(-1, 0, 0);
  if (face === 'py') return vec3(0, 1, 0);
  if (face === 'ny') return vec3(0, -1, 0);
  if (face === 'pz') return vec3(0, 0, 1);
  return vec3(0, 0, -1);
}

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

function faceTangentOffset(face, rng, spread) {
  if (face === 'px' || face === 'nx') return vec3(0, rng.range(-spread, spread), rng.range(-spread, spread));
  if (face === 'py' || face === 'ny') return vec3(rng.range(-spread, spread), 0, rng.range(-spread, spread));
  return vec3(rng.range(-spread, spread), rng.range(-spread, spread), 0);
}

function buildDamage(profile, seedDNA, controlsInput, level, dims) {
  const dna = profile.runtimeDNA;
  const nd = profile.noiseDNA || {};
  const controls = normalizeControls(controlsInput);
  const seeds = normalizeSeedDNA(seedDNA, profile);
  const damageRng = new RNG(seeds.damage ^ 0x9e3779b9);
  const poreRng = new RNG(seeds.pore ^ 0x85ebca6b);
  const weatherRng = new RNG(seeds.weather ^ 0xc2b2ae35);
  const inclusionRng = new RNG(seeds.inclusion ^ 0x27d4eb2d);
  const b = mul3(dims, 0.5);
  const minD = Math.min(dims.x, dims.y, dims.z);
  const chips = [], pits = [], poreClusters = [], deepPores = [], poreRimChips = [], collapsedPores = [],
    cracks = [], erosionBites = [], inclusionVoids = [];
  const compositeDamage = clamp(level * 0.78 + controls.damage * 0.62, 0, 1.75);
  const poreDensity = controls.poreDensity;
  const poreVariety = controls.poreVariety;
  const densityScale = 0.72 + poreDensity * 0.58;
  const varietyScale = 0.70 + poreVariety * 0.42;
  const chipCount = Math.max(2, Math.round(1.4 + dna.edgeFragility * 3.2 + compositeDamage * 5.1));
  const pitCount = Math.max(4, Math.round((2.0 + dna.pitDensity * 3.7 + compositeDamage * 4.3) * densityScale));
  const poreCount = Math.max(8, Math.round(
    (nd.geometryPoreCount ?? 5) * (0.66 + level * 0.50 + controls.poreDepth * 0.39) * densityScale
  ));
  const deepPoreCount = Math.max(3, Math.round(
    (nd.geometryDeepPoreCount ?? 2.5) * (0.50 + controls.poreDepth * 0.74 + level * 0.29) *
    (0.78 + poreDensity * 0.44)
  ));
  const crackCount = compositeDamage < 0.28 ? 0 : Math.max(1, Math.round(dna.crackAffinity * 1.4 + compositeDamage * 1.45));
  const erosionCount = Math.max(0, Math.round(controls.weathering * (0.9 + dna.edgeFragility * 1.7) + level * 1.2));
  const inclusionVoidCount = profile.family === 'ADOBE'
    ? Math.max(4, Math.round((2.5 + controls.inclusion * 6.0 + level * 2.5) * (0.82 + poreDensity * 0.22)))
    : 0;
  const anchorCount = Math.max(3, Math.round(2.6 + poreDensity * 1.8));
  const poreAnchors = [];
  for (let i = 0; i < anchorCount; i++) {
    const face = poreRng.pick(FACE_IDS);
    poreAnchors.push({
      face,
      center: facePoint(face, b, poreRng, 0),
      spread: poreRng.range(0.10, 0.28) * minD * varietyScale
    });
  }
  const signs = [-1, 1];

  for (let i = 0; i < chipCount; i++) {
    const sx = damageRng.pick(signs), sy = damageRng.pick(signs), sz = damageRng.pick(signs);
    const mode = damageRng.next();
    let center;
    if (mode < 0.58) {
      center = vec3(
        sx * (b.x + damageRng.range(-0.05, 0.09) * minD),
        sy * (b.y + damageRng.range(-0.04, 0.09) * minD),
        sz * (b.z + damageRng.range(-0.05, 0.09) * minD)
      );
    } else if (mode < 0.82) {
      center = vec3(sx * (b.x + 0.025 * minD), damageRng.range(-0.72, 0.72) * b.y, sz * (b.z + 0.025 * minD));
    } else {
      center = vec3(damageRng.range(-0.78, 0.78) * b.x, sy * (b.y + 0.025 * minD), sz * (b.z + 0.025 * minD));
    }
    const r = damageRng.range(0.105, 0.238) * minD * (0.58 + compositeDamage * 0.68);
    chips.push({
      center,
      radii: vec3(r * damageRng.range(0.7, 1.38), r * damageRng.range(0.62, 1.14), r * damageRng.range(0.72, 1.34)),
      irregular: damageRng.range(0.08, 0.30)
    });
  }

  for (let i = 0; i < pitCount; i++) {
    const clustered = poreRng.next() < 0.62;
    const anchor = clustered ? poreRng.pick(poreAnchors) : null;
    const face = anchor ? anchor.face : poreRng.pick(FACE_IDS);
    const scaleClass = poreRng.next();
    const baseRadius = scaleClass < 0.56
      ? poreRng.range(0.030, 0.070)
      : (scaleClass < 0.90 ? poreRng.range(0.070, 0.145) : poreRng.range(0.145, 0.225));
    const radius = baseRadius * minD * (0.64 + compositeDamage * 0.34) * varietyScale;
    const depthRatio = scaleClass < 0.56
      ? poreRng.range(0.32, 0.72)
      : (scaleClass < 0.90 ? poreRng.range(0.48, 1.02) : poreRng.range(0.64, 1.20));
    const depth = radius * depthRatio * (0.58 + controls.poreDepth * 0.46);
    const center = anchor
      ? add3(anchor.center, faceTangentOffset(face, poreRng, anchor.spread))
      : facePoint(face, b, poreRng, depth * poreRng.range(0.02, 0.34));
    pits.push({
      face,
      center,
      radii: faceRadii(face, radius, depth, poreRng),
      irregular: poreRng.range(0.06, 0.28) * varietyScale,
      scaleClass
    });
    if (scaleClass > 0.80 && poreRng.next() < 0.36 + poreVariety * 0.20) {
      const collapseRadius = radius * poreRng.range(0.72, 1.18);
      collapsedPores.push({
        face,
        center: add3(center, faceTangentOffset(face, poreRng, radius * 0.55)),
        radii: faceRadii(
          face,
          collapseRadius * poreRng.range(1.10, 1.65),
          depth * poreRng.range(0.42, 0.76),
          poreRng
        ),
        irregular: poreRng.range(0.12, 0.34)
      });
    }
  }

  for (let i = 0; i < poreCount; i++) {
    const clustered = poreRng.next() < 0.70;
    const anchor = clustered ? poreRng.pick(poreAnchors) : null;
    const face = anchor ? anchor.face : poreRng.pick(FACE_IDS);
    const scaleClass = poreRng.next();
    const baseRadius = scaleClass < 0.74
      ? poreRng.range(0.012, 0.036)
      : poreRng.range(0.036, 0.078);
    const radius = baseRadius * minD *
      (0.66 + controls.poreDepth * 0.28 + level * 0.12) * varietyScale;
    const depth = radius * poreRng.range(0.34, scaleClass < 0.74 ? 0.78 : 1.08) *
      (0.58 + controls.poreDepth * 0.46);
    const center = anchor
      ? add3(anchor.center, faceTangentOffset(face, poreRng, anchor.spread * 0.82))
      : facePoint(face, b, poreRng, depth * poreRng.range(-0.02, 0.26));
    poreClusters.push({
      face,
      center,
      radii: faceRadii(face, radius, depth, poreRng),
      irregular: poreRng.range(0.035, 0.18) * varietyScale
    });
  }

  for (let i = 0; i < deepPoreCount; i++) {
    const face = poreRng.pick(['px', 'nx', 'py', 'pz', 'nz']);
    const normal = faceNormal(face);
    const scaleClass = poreRng.next();
    const baseRadius = scaleClass < 0.58
      ? poreRng.range(0.045, 0.090)
      : (scaleClass < 0.90 ? poreRng.range(0.090, 0.155) : poreRng.range(0.155, 0.235));
    const radius = baseRadius * minD * (0.74 + controls.poreDepth * 0.40) * varietyScale;
    const depth = poreRng.range(0.18, scaleClass > 0.88 ? 0.58 : 0.45) * minD *
      (0.54 + controls.poreDepth * 0.76);
    const matchingAnchors = poreAnchors.filter((item) => item.face === face);
    const anchor = matchingAnchors.length && poreRng.next() < 0.52 ? poreRng.pick(matchingAnchors) : null;
    const surface = anchor
      ? add3(anchor.center, faceTangentOffset(face, poreRng, anchor.spread * 0.62))
      : facePoint(face, b, poreRng, radius * 0.06);
    const drift = vec3(
      poreRng.range(-0.060, 0.060) * minD,
      poreRng.range(-0.060, 0.060) * minD,
      poreRng.range(-0.060, 0.060) * minD
    );
    const inside = add3(add3(surface, mul3(normal, -depth)), drift);
    const bore = {
      face,
      a: add3(surface, mul3(normal, radius * 0.46)),
      b: inside,
      radius,
      mouthCenter: add3(surface, mul3(normal, -radius * 0.08)),
      mouthRadii: faceRadii(
        face,
        radius * poreRng.range(1.10, 1.62),
        radius * poreRng.range(0.72, 1.06),
        poreRng
      ),
      irregular: poreRng.range(0.12, 0.34) * varietyScale,
      scaleClass
    };
    deepPores.push(bore);

    const rimCount = Math.max(2, Math.round(poreRng.range(1.8, 3.8) + poreVariety * 0.95));
    for (let j = 0; j < rimCount; j++) {
      const rimRadius = radius * poreRng.range(0.30, 0.68);
      const tangent = faceTangentOffset(face, poreRng, radius * poreRng.range(0.72, 1.36));
      poreRimChips.push({
        face,
        center: add3(add3(bore.mouthCenter, tangent), mul3(normal, radius * poreRng.range(-0.10, 0.10))),
        radii: faceRadii(face, rimRadius, rimRadius * poreRng.range(0.38, 0.72), poreRng),
        irregular: poreRng.range(0.12, 0.36)
      });
    }
  }

  for (let i = 0; i < crackCount; i++) {
    const face = damageRng.pick(['px', 'nx', 'py', 'pz', 'nz']);
    const width = damageRng.range(0.012, 0.031) * minD * (0.58 + compositeDamage * 0.65);
    let a, c;
    if (face === 'px' || face === 'nx') {
      const x = (face === 'px' ? 1 : -1) * (b.x + width * 0.12);
      const y0 = damageRng.range(-0.58, 0.58) * b.y, z0 = damageRng.range(-0.68, 0.68) * b.z;
      a = vec3(x, y0, z0);
      c = vec3(x, clamp(y0 + damageRng.range(-0.78, 0.78) * b.y, -b.y, b.y), clamp(z0 + damageRng.range(-0.86, 0.86) * b.z, -b.z, b.z));
    } else if (face === 'py') {
      const y = b.y + width * 0.12;
      const x0 = damageRng.range(-0.7, 0.7) * b.x, z0 = damageRng.range(-0.68, 0.68) * b.z;
      a = vec3(x0, y, z0);
      c = vec3(clamp(x0 + damageRng.range(-0.8, 0.8) * b.x, -b.x, b.x), y, clamp(z0 + damageRng.range(-0.78, 0.78) * b.z, -b.z, b.z));
    } else {
      const z = (face === 'pz' ? 1 : -1) * (b.z + width * 0.12);
      const x0 = damageRng.range(-0.7, 0.7) * b.x, y0 = damageRng.range(-0.58, 0.58) * b.y;
      a = vec3(x0, y0, z);
      c = vec3(clamp(x0 + damageRng.range(-0.86, 0.86) * b.x, -b.x, b.x), clamp(y0 + damageRng.range(-0.78, 0.78) * b.y, -b.y, b.y), z);
    }
    cracks.push({ a, b: c, radius: width });
    if (damageRng.next() < 0.68) {
      const mid = mix3(a, c, damageRng.range(0.3, 0.74));
      const branch = add3(mid, vec3(damageRng.range(-0.18, 0.18) * dims.x, damageRng.range(-0.22, 0.22) * dims.y, damageRng.range(-0.18, 0.18) * dims.z));
      cracks.push({ a: mid, b: branch, radius: width * damageRng.range(0.46, 0.76) });
    }
  }

  for (let i = 0; i < erosionCount; i++) {
    const face = weatherRng.pick(['py', 'py', 'px', 'nx', 'pz', 'nz']);
    const radius = weatherRng.range(0.11, 0.25) * minD * (0.55 + controls.weathering * 0.48);
    const depth = radius * weatherRng.range(0.22, 0.52);
    erosionBites.push({
      face,
      center: facePoint(face, b, weatherRng, depth * weatherRng.range(0.1, 0.48)),
      radii: faceRadii(face, radius, depth, weatherRng),
      irregular: weatherRng.range(0.08, 0.22)
    });
  }

  for (let i = 0; i < inclusionVoidCount; i++) {
    const face = inclusionRng.pick(['py', 'py', 'px', 'nx', 'pz', 'nz']);
    const normal = faceNormal(face);
    const surface = facePoint(face, b, inclusionRng, 0);
    const angle = inclusionRng.range(0, Math.PI * 2);
    let tangent;
    if (face === 'px' || face === 'nx') tangent = vec3(0, Math.cos(angle), Math.sin(angle));
    else if (face === 'py' || face === 'ny') tangent = vec3(Math.cos(angle), 0, Math.sin(angle));
    else tangent = vec3(Math.cos(angle), Math.sin(angle), 0);
    const halfLength = inclusionRng.range(0.055, 0.17) * minD * (0.72 + controls.inclusion * 0.34);
    const radius = inclusionRng.range(0.008, 0.019) * minD * (0.72 + controls.inclusion * 0.28);
    const depth = inclusionRng.range(0.12, 0.46) * radius;
    const center = add3(surface, mul3(normal, -depth));
    inclusionVoids.push({
      face,
      a: add3(center, mul3(tangent, -halfLength)),
      b: add3(center, mul3(tangent, halfLength)),
      radius,
      irregular: inclusionRng.range(0.08, 0.24)
    });
  }

  const formationEvents = buildFormationEvents(profile, seeds, controls, dims);
  return { chips, pits, poreClusters, deepPores, poreRimChips, collapsedPores, cracks, erosionBites, inclusionVoids, formationEvents };
}

function createSDF(profile, seedDNA, controlsInput, level) {
  const seeds = normalizeSeedDNA(seedDNA, profile);
  const controls = normalizeControls(controlsInput);
  const dims = specimenDimensions(profile, controls);
  const b = mul3(dims, 0.5);
  const dna = profile.runtimeDNA;
  const nd = profile.noiseDNA || {};
  const minD = Math.min(dims.x, dims.y, dims.z);
  const radius = dna.edgeRadius * minD * (nd.edgeRoundnessScale ?? 0.68);
  const damage = buildDamage(profile, seeds, controls, level, dims);
  const macroAmp = dna.macroWarp * minD * (nd.geometryWarp ?? 0.9) * controls.shapeVariation;
  const reliefAmp = dna.surfaceRelief * minD * (nd.geometryRelief ?? 0.72) * (0.65 + controls.shapeVariation * 0.45);
  const phase = new RNG(seeds.shape).range(-100, 100);
  const gaeaDNA = profile.gaeaDNA || {};
  const gaeaNoiseApi = GAEA ? { noise3, fbm3, ridgedFbm3 } : null;
  const structureRng = new RNG(seeds.damage ^ seeds.detail ^ 0x510e527f);
  const structureAngle = profile.family === 'STONE'
    ? structureRng.range(-0.72, -0.28)
    : structureRng.range(-0.48, 0.48);
  const structureCos = Math.cos(structureAngle);
  const structureSin = Math.sin(structureAngle);

  const sdf = (p) => {
    const warpScale = nd.domainWarpScale ?? 0.78;
    const wx = fbm3(p.y * warpScale + phase, p.z * warpScale, p.x * 0.23, seeds.shape + 17, 3) - 0.5;
    const wy = fbm3(p.x * warpScale, p.z * warpScale + phase, p.y * 0.23, seeds.shape + 31, 3) - 0.5;
    const wz = fbm3(p.x * warpScale + phase, p.y * warpScale, p.z * 0.23, seeds.shape + 47, 3) - 0.5;
    const q = vec3(p.x + wx * macroAmp * 0.48, p.y + wy * macroAmp, p.z + wz * macroAmp * 0.56);
    let d = sdRoundBox(q, b, radius);

    const broad = fbm3(p.x * 1.7, p.y * 1.45, p.z * 1.7, seeds.detail + 71, 4) - 0.5;
    const ridge = ridgedFbm3(p.x * 4.8, p.y * 4.1, p.z * 4.8, seeds.detail + 103, 3) - 0.5;
    const crust = fbm3(p.x * 10.8, p.y * 8.6, p.z * 10.8, seeds.weather + 109, 3) - 0.5;
    d += (broad * 0.80 + ridge * 0.16 + crust * 0.035 * controls.weathering) * reliefAmp;
    if (GAEA) {
      const familyScale = profile.family === 'STONE' ? 1.18 : profile.family === 'ADOBE' ? 0.92 : 1.0;
      d += GAEA.geometryDisplacement(p, seeds, controls, gaeaDNA, gaeaNoiseApi) * minD * familyScale;
    }

    const frontT = clamp((p.z / Math.max(b.z, 0.001) - 0.12) / 0.88, 0, 1);
    const frontGate = smooth(frontT);
    const formationBroad = fbm3(p.x * 0.92, p.y * 0.84, p.z * 0.34, seeds.damage + 907, 3) - 0.5;
    const formationMeso = ridgedFbm3(p.x * 2.25, p.y * 1.92, p.z * 0.48, seeds.detail + 991, 3) - 0.5;
    let formationRelief = 0;
    if (profile.family === 'STONE') {
      const su = p.x * structureCos + p.y * structureSin;
      const sv = -p.x * structureSin + p.y * structureCos;
      const strata = ridgedFbm3(su * 0.86, sv * 3.65, p.z * 0.42, seeds.damage + 1031, 3) - 0.5;
      const fault = fbm3(su * 1.35, sv * 0.72, p.z * 0.30, seeds.damage + 1063, 3) - 0.5;
      formationRelief = (formationBroad * 0.070 + strata * 0.058 + fault * 0.030 + formationMeso * 0.014) * minD;
    } else if (profile.family === 'ADOBE') {
      const clump = fbm3(p.x * 1.10, p.y * 1.02, p.z * 0.36, seeds.inclusion + 1091, 3) - 0.5;
      const flake = ridgedFbm3(p.x * 2.35, p.y * 2.05, p.z * 0.45, seeds.weather + 1123, 3) - 0.5;
      formationRelief = (formationBroad * 0.052 + clump * 0.064 + flake * 0.028) * minD;
    } else {
      const kilnPlate = fbm3(p.x * 1.18, p.y * 1.05, p.z * 0.38, seeds.damage + 1151, 3) - 0.5;
      const crustPlate = ridgedFbm3(p.x * 2.55, p.y * 2.15, p.z * 0.48, seeds.weather + 1171, 3) - 0.5;
      formationRelief = (formationBroad * 0.055 + kilnPlate * 0.060 + crustPlate * 0.020) * minD;
    }
    d += frontGate * formationRelief;

    for (const event of damage.formationEvents) d = applyFormationEventSDF(d, p, event, seeds, minD);

    for (const chip of damage.chips) {
      const irregular = (noise3(p.x * 12, p.y * 12, p.z * 12, seeds.damage + 131) - 0.5) * chip.irregular * minD;
      const radii = vec3(
        Math.max(0.004, chip.radii.x + irregular),
        Math.max(0.004, chip.radii.y + irregular * 0.72),
        Math.max(0.004, chip.radii.z + irregular * 0.88)
      );
      d = Math.max(d, -sdEllipsoid(p, chip.center, radii));
    }

    for (const pit of damage.pits) {
      const irregular = (noise3(p.x * 18, p.y * 18, p.z * 18, seeds.pore + 211) - 0.5) * pit.irregular * minD;
      const radii = vec3(
        Math.max(0.003, pit.radii.x + irregular),
        Math.max(0.003, pit.radii.y + irregular),
        Math.max(0.003, pit.radii.z + irregular)
      );
      d = Math.max(d, -sdEllipsoid(p, pit.center, radii));
    }

    for (const pore of damage.poreClusters) {
      const irregular = (noise3(p.x * 29, p.y * 29, p.z * 29, seeds.pore + 257) - 0.5) * pore.irregular * minD;
      const radii = vec3(
        Math.max(0.002, pore.radii.x + irregular),
        Math.max(0.002, pore.radii.y + irregular),
        Math.max(0.002, pore.radii.z + irregular)
      );
      d = Math.max(d, -sdEllipsoid(p, pore.center, radii));
    }

    for (const collapse of damage.collapsedPores) {
      const irregular = (noise3(p.x * 21, p.y * 21, p.z * 21, seeds.pore + 293) - 0.5) * collapse.irregular * minD;
      const radii = vec3(
        Math.max(0.003, collapse.radii.x + irregular),
        Math.max(0.003, collapse.radii.y + irregular * 0.84),
        Math.max(0.003, collapse.radii.z + irregular)
      );
      d = Math.max(d, -sdEllipsoid(p, collapse.center, radii));
    }

    for (const rim of damage.poreRimChips) {
      const irregular = (noise3(p.x * 26, p.y * 26, p.z * 26, seeds.pore + 317) - 0.5) * rim.irregular * minD;
      const radii = vec3(
        Math.max(0.0025, rim.radii.x + irregular),
        Math.max(0.0025, rim.radii.y + irregular * 0.78),
        Math.max(0.0025, rim.radii.z + irregular)
      );
      d = Math.max(d, -sdEllipsoid(p, rim.center, radii));
    }

    for (const bore of damage.deepPores) {
      const boreNoise = (noise3(p.x * 24, p.y * 24, p.z * 24, seeds.pore + 337) - 0.5) * bore.irregular;
      const radiusWobble = Math.max(0.004, bore.radius * (1 + boreNoise));
      d = Math.max(d, -sdCapsule(p, bore.a, bore.b, radiusWobble));
      d = Math.max(d, -sdEllipsoid(p, bore.mouthCenter, bore.mouthRadii));
    }

    for (const crack of damage.cracks) d = Math.max(d, -sdCapsule(p, crack.a, crack.b, crack.radius));

    for (const inclusionVoid of damage.inclusionVoids) {
      const wobble = (noise3(p.x * 37, p.y * 37, p.z * 37, seeds.inclusion + 557) - 0.5) * inclusionVoid.irregular;
      const radius = Math.max(0.0015, inclusionVoid.radius * (1 + wobble));
      d = Math.max(d, -sdCapsule(p, inclusionVoid.a, inclusionVoid.b, radius));
    }

    for (const bite of damage.erosionBites) {
      const irregular = (noise3(p.x * 15, p.y * 15, p.z * 15, seeds.weather + 419) - 0.5) * bite.irregular * minD;
      const radii = vec3(
        Math.max(0.003, bite.radii.x + irregular),
        Math.max(0.003, bite.radii.y + irregular * 0.75),
        Math.max(0.003, bite.radii.z + irregular)
      );
      d = Math.max(d, -sdEllipsoid(p, bite.center, radii));
    }
    return d;
  };

  return { sdf, dims, b, damage, radius, seeds, controls };
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

function buildMesh(profile, seedDNA, controlsInput, level, quality = 1) {
  const field = createSDF(profile, seedDNA, controlsInput, level);
  const dims = field.dims, minD = Math.min(dims.x, dims.y, dims.z);
  const margin = minD * 0.38;
  const size = vec3(dims.x + margin * 2, dims.y + margin * 2, dims.z + margin * 2);
  const longest = Math.max(size.x, size.y, size.z);
  const benchmark = (field.controls.benchmarkSlab ?? 0) > 0.5;
  const target = Math.round(52 * quality);
  const nx = clamp(Math.round(target * size.x / longest), benchmark ? 38 : 24, target);
  const ny = clamp(Math.round(target * size.y / longest), benchmark ? 38 : 20, target);
  const nz = clamp(Math.round(target * size.z / longest), benchmark ? 24 : 22, target);
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
  const maxVertices = 420000;
  const epsilon = Math.min(step.x, step.y, step.z) * 0.36;
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
    seedDNA: field.seeds,
    controls: field.controls,
    level,
    profileId: profile.id,
    grid: [nx, ny, nz],
    noiseVersion: 'v2.7.2-continuous-formation-field-alpha1'
  };
}

window.BrickMotherGeometryV2 = {
  clamp, lerp, smooth, smoother, vec3, add3, sub3, mul3, dot3, cross3, len3, norm3, mix3,
  RNG, noise3, fbm3, ridgedFbm3, sdRoundBox, sdEllipsoid, sdCapsule,
  normalizedDimensions, specimenDimensions, normalizeSeedDNA, normalizeControls, FORMATION_EVENT_TYPES, buildFormationEvents, buildDamage, createSDF, buildMesh
};
})();
