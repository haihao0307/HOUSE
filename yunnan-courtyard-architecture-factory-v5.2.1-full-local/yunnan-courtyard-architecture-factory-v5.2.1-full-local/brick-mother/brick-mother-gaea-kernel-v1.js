(() => {
'use strict';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / Math.max(b - a, 1e-8));
  return t * t * (3 - 2 * t);
};

const OPERATOR_FAMILIES = Object.freeze({
  primitives: ['multi-fractal', 'ridged-noise', 'cellular-plates', 'anisotropic-fibers'],
  warps: ['domain-warp', 'directional-warp', 'profile-recurve'],
  adjustments: ['autolevel', 'clarity', 'soft-clip', 'gamma', 'threshold', 'combine', 'multi-combine'],
  erosion: ['rugged-breakage', 'stratify', 'micro-erosion', 'flow-deposition'],
  data: ['slope', 'curvature-proxy', 'cavity', 'protrusion', 'rock-map', 'flow', 'separation-mask'],
  color: ['clut-5', 'quick-color', 'synth-palette', 'splat-weights', 'color-fx'],
  render: ['linear-srgb', 'correlated-roughness', 'micro-normal', 'ambient-occlusion']
});

const GRAPH_RECIPES = Object.freeze({
  firedBrick: [
    'multi-fractal', 'domain-warp', 'rugged-breakage', 'micro-erosion',
    'cavity+protrusion+flow masks', 'clut-5', 'splat-weights', 'color-fx', 'pbr-render'
  ],
  adobe: [
    'multi-fractal', 'directional-warp', 'fiber-inclusions', 'micro-erosion',
    'cavity+flow masks', 'synth-palette', 'splat-weights', 'pbr-render'
  ],
  stone: [
    'multi-fractal', 'domain-warp', 'rugged-breakage x2 low strength', 'stratify',
    'micro-erosion', 'rock-map+slope+curvature masks', 'clut-5', 'splat-weights', 'pbr-render'
  ]
});

function autoLevel(v, low = 0.12, high = 0.88) {
  return clamp((v - low) / Math.max(high - low, 1e-6));
}

function clarity(v, amount = 1) {
  const t = clamp(v);
  const local = t * t * (3 - 2 * t);
  return clamp(t + (t - local) * amount * 1.45);
}

function softClip(v, low = 0.06, high = 0.94) {
  const t = autoLevel(v, low, high);
  return t * t * (3 - 2 * t);
}

function gamma(v, power = 1) {
  return Math.pow(clamp(v), Math.max(power, 1e-4));
}

function combine(a, b, mode = 'blend', ratio = 0.5) {
  const t = clamp(ratio);
  if (mode === 'add') return clamp(a + b * t);
  if (mode === 'subtract') return clamp(a - b * t);
  if (mode === 'multiply') return clamp(lerp(a, a * b, t));
  if (mode === 'max') return lerp(a, Math.max(a, b), t);
  if (mode === 'min') return lerp(a, Math.min(a, b), t);
  if (mode === 'screen') return lerp(a, 1 - (1 - a) * (1 - b), t);
  if (mode === 'difference') return lerp(a, Math.abs(a - b), t);
  return lerp(a, b, t);
}

function separationMask(a, b, sharpness = 1) {
  return smoothstep(0.02, 0.38 / Math.max(sharpness, 0.1), Math.abs(a - b));
}

function normalizeGaeaDNA(dna = {}) {
  return {
    ruggedScale: Number(dna.ruggedScale ?? 6.2),
    strataFrequency: Number(dna.strataFrequency ?? 5.4),
    surfaceScale: Number(dna.surfaceScale ?? 34),
    ruggedDepth: Number(dna.ruggedDepth ?? 0.009),
    strataDepth: Number(dna.strataDepth ?? 0.0035),
    microErosionDepth: Number(dna.microErosionDepth ?? 0.0038),
    warpStrength: Number(dna.warpStrength ?? 0.22),
    strataTilt: Number(dna.strataTilt ?? 0.18),
    geometryStrength: Number(dna.geometryStrength ?? 1)
  };
}

function geometryDisplacement(p, seeds, controls, inputDNA, noiseApi) {
  if (!noiseApi) return 0;
  const dna = normalizeGaeaDNA(inputDNA);
  const { fbm3, ridgedFbm3 } = noiseApi;
  const detailSeed = Number(seeds?.detail ?? seeds?.master ?? 17);
  const weatherSeed = Number(seeds?.weather ?? seeds?.master ?? 29);

  const wx = fbm3(p.y * 0.83, p.z * 0.79, p.x * 0.31, detailSeed + 1201, 3) - 0.5;
  const wy = fbm3(p.x * 0.76, p.z * 0.91, p.y * 0.27, detailSeed + 1217, 3) - 0.5;
  const wz = fbm3(p.x * 0.88, p.y * 0.82, p.z * 0.29, detailSeed + 1231, 3) - 0.5;
  const qx = p.x + wx * dna.warpStrength;
  const qy = p.y + wy * dna.warpStrength * 0.72;
  const qz = p.z + wz * dna.warpStrength;

  const ruggedA = ridgedFbm3(qx * dna.ruggedScale, qy * dna.ruggedScale * 0.88, qz * dna.ruggedScale, detailSeed + 1301, 4);
  const ruggedB = ridgedFbm3(
    (qx + wz * 0.17) * dna.ruggedScale * 0.54,
    (qy + wx * 0.11) * dna.ruggedScale * 0.54,
    (qz + wy * 0.15) * dna.ruggedScale * 0.54,
    detailSeed + 1327,
    3
  );
  const rugged = clarity(ruggedA * 0.68 + ruggedB * 0.32, 0.72);

  const strataPhase = (
    qy + qx * dna.strataTilt + qz * dna.strataTilt * 0.42 + wx * 0.22
  ) * dna.strataFrequency * Math.PI * 2;
  const strataWave = 1 - Math.abs(Math.sin(strataPhase));
  const strataGate = autoLevel(
    fbm3(qx * 2.3, qy * 2.0, qz * 2.3, weatherSeed + 1409, 3),
    0.27,
    0.82
  );
  const strata = softClip(strataWave * (0.36 + strataGate * 0.64), 0.18, 0.86);

  const microRidge = ridgedFbm3(
    qx * dna.surfaceScale,
    qy * dna.surfaceScale * 0.93,
    qz * dna.surfaceScale,
    weatherSeed + 1511,
    3
  );
  const microGate = autoLevel(
    fbm3(qx * 5.7, qy * 5.1, qz * 5.7, weatherSeed + 1523, 3),
    0.42,
    0.89
  );
  const microErosion = smoothstep(0.58, 0.94, microRidge) * microGate;

  const rockDetail = Number(controls?.rockDetail ?? 0.65);
  const strataStrength = Number(controls?.strata ?? 0.25);
  const microStrength = Number(controls?.microErosion ?? 0.62);

  const displacement =
    (rugged - 0.53) * dna.ruggedDepth * rockDetail +
    (strata - 0.43) * dna.strataDepth * strataStrength -
    microErosion * dna.microErosionDepth * microStrength;

  return displacement * dna.geometryStrength;
}

const glsl = String.raw`
float valueNoise3(vec3 p);
float gradientNoise3(vec3 p);
float fbmGradient(vec3 p);
float ridgedFbm(vec3 p);
float fbmValueFast(vec3 p);
float turbulence(vec3 p);
vec2 worley3(vec3 p);
vec3 domainWarp(vec3 p);

float bmSaturate(float v) {
  return clamp(v, 0.0, 1.0);
}

float bmAutoLevel(float v, float low, float high) {
  return bmSaturate((v - low) / max(high - low, 0.00001));
}

float bmClarity(float v, float amount) {
  float t = bmSaturate(v);
  float local = t * t * (3.0 - 2.0 * t);
  return bmSaturate(t + (t - local) * amount * 1.45);
}

float bmSoftClip(float v, float low, float high) {
  float t = bmAutoLevel(v, low, high);
  return t * t * (3.0 - 2.0 * t);
}

float bmMaskSharp(float v, float sharpness) {
  float width = mix(0.30, 0.035, bmSaturate(sharpness / 1.6));
  return smoothstep(0.5 - width, 0.5 + width, v);
}

float bmCombine(float a, float b, float mode, float ratio) {
  float r = bmSaturate(ratio);
  if (mode < 0.5) return mix(a, b, r);
  if (mode < 1.5) return bmSaturate(a + b * r);
  if (mode < 2.5) return bmSaturate(mix(a, a * b, r));
  if (mode < 3.5) return mix(a, max(a, b), r);
  if (mode < 4.5) return mix(a, min(a, b), r);
  if (mode < 5.5) return mix(a, 1.0 - (1.0 - a) * (1.0 - b), r);
  return mix(a, abs(a - b), r);
}

vec3 bmClut5(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4) {
  float x = bmSaturate(t) * 4.0;
  if (x < 1.0) return mix(c0, c1, x);
  if (x < 2.0) return mix(c1, c2, x - 1.0);
  if (x < 3.0) return mix(c2, c3, x - 2.0);
  return mix(c3, c4, x - 3.0);
}

vec4 bmSplatWeights(float a, float b, float c, float d, float sharpness) {
  float power = 1.0 + bmSaturate(sharpness / 1.6) * 5.0;
  vec4 w = pow(max(vec4(a, b, c, d), vec4(0.00001)), vec4(power));
  return w / max(dot(w, vec4(1.0)), 0.00001);
}

struct BMGaeaFields {
  float rugged;
  float strata;
  float microErosion;
  float rockMap;
  float flow;
  float protrusion;
  float cavity;
  float separation;
};

BMGaeaFields bmGaeaEvaluate(
  vec3 p,
  vec3 n,
  vec3 seedV,
  float ruggedScale,
  float strataFrequency,
  float surfaceScale,
  float maskSharpness
) {
  vec3 q = p + domainWarp(p * 0.73 + seedV * 0.21) * 0.22;
  float ruggedA = ridgedFbm(q * ruggedScale + seedV * 0.67);
  float ruggedB = ridgedFbm((q + domainWarp(q * 1.31)) * ruggedScale * 0.53 + seedV * 1.19);
  float rugged = bmClarity(ruggedA * 0.68 + ruggedB * 0.32, 0.74);

  vec2 cells = worley3(q * ruggedScale * 0.76 + seedV * 0.89);
  float plateEdge = 1.0 - smoothstep(0.026, 0.17, cells.y - cells.x);

  float strataPhaseNoise = fbmValueFast(q * 3.7 + seedV * 1.91) - 0.5;
  float strataPhase = (
    q.y + q.x * 0.18 + q.z * 0.075 + strataPhaseNoise * 0.18
  ) * strataFrequency * 6.2831853 + seedV.x;
  float strataWave = sin(strataPhase) * 0.5 + 0.5;
  float strataGate = bmAutoLevel(fbmValueFast(q * 2.65 + seedV * 1.43), 0.27, 0.82);
  float strataBreak = bmAutoLevel(fbmValueFast(q * 5.1 + seedV * 2.11), 0.33, 0.81);
  float strata = bmMaskSharp(
    strataWave * (0.20 + strataGate * 0.58) * (0.38 + strataBreak * 0.62),
    maskSharpness
  );

  float microBase = ridgedFbm(q * surfaceScale + seedV * 1.77);
  float microGate = bmAutoLevel(turbulence(q * surfaceScale * 0.31 + seedV * 2.13), 0.31, 0.86);
  float microErosion = smoothstep(0.58, 0.93, microBase) * microGate;

  float slope = 1.0 - abs(n.y);
  float rockMap = bmMaskSharp(
    mix(plateEdge, rugged, 0.62) * (0.34 + slope * 0.66),
    maskSharpness
  );

  float vertical = bmAutoLevel(1.0 - (p.y + 0.5), 0.08, 0.92);
  float flowNoise = bmAutoLevel(fbmValueFast(vec3(q.x * 2.1, q.y * 0.57, q.z * 2.1) + seedV * 2.47), 0.48, 0.86);
  float flow = bmMaskSharp(vertical * flowNoise * (0.38 + slope * 0.62), maskSharpness * 0.74);

  float protrusion = bmSaturate(rugged * 0.58 + strata * 0.22 + (1.0 - plateEdge) * 0.20);
  float cavity = bmSaturate(plateEdge * 0.49 + microErosion * 0.31 + (1.0 - rugged) * 0.20);
  float separation = bmMaskSharp(
    bmSaturate(abs(rugged - strata) * 0.68 + abs(rockMap - flow) * 0.46),
    maskSharpness * 0.68
  );

  BMGaeaFields result;
  result.rugged = rugged;
  result.strata = strata;
  result.microErosion = microErosion;
  result.rockMap = rockMap;
  result.flow = flow;
  result.protrusion = protrusion;
  result.cavity = cavity;
  result.separation = separation;
  return result;
}
`;

window.BrickMotherGaeaV1 = Object.freeze({
  version: '1.1.0',
  lineage: 'independent field-graph implementation distilled from documented Gaea workflow concepts',
  operatorFamilies: OPERATOR_FAMILIES,
  graphRecipes: GRAPH_RECIPES,
  autoLevel,
  clarity,
  softClip,
  gamma,
  combine,
  separationMask,
  normalizeGaeaDNA,
  geometryDisplacement,
  glsl
});
})();
