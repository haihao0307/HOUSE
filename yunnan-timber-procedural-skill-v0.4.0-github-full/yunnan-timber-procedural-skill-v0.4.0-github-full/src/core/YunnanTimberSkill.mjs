/**
 * Yunnan Timber Procedural Skill v0.4.0
 * Renderer independent presets, axis contracts, profile contracts and seeds.
 */

export const SKILL_VERSION = "0.4.0";

export const TIMBER_PROFILE_CODES = Object.freeze({
  rectangular: 0,
  round: 1,
  plank: 2
});

export const TIMBER_PRESETS = Object.freeze({
  dark_aged: Object.freeze({
    id: "dark_aged",
    label: "深色旧木",
    description: "深褐与烟熏胡桃色，适合主柱、梁、枋和檩。",
    dark: [0.095, 0.052, 0.029],
    mid: [0.300, 0.165, 0.087],
    light: [0.475, 0.300, 0.172],
    weather: [0.245, 0.225, 0.192],
    freshCut: [0.525, 0.355, 0.220],
    roughness: [0.70, 0.90],
    lacquer: 0.015,
    contrast: 0.32,
    relief: 0.82,
    poreScale: 0.92
  }),
  warm_medium: Object.freeze({
    id: "warm_medium",
    label: "暖褐中木",
    description: "温暖棕褐与柔和金棕色，适合门窗、楼板和次要构件。",
    dark: [0.145, 0.083, 0.043],
    mid: [0.405, 0.245, 0.128],
    light: [0.620, 0.425, 0.245],
    weather: [0.365, 0.330, 0.275],
    freshCut: [0.690, 0.500, 0.295],
    roughness: [0.63, 0.84],
    lacquer: 0.035,
    contrast: 0.30,
    relief: 0.76,
    poreScale: 0.86
  }),
  light_weathered: Object.freeze({
    id: "light_weathered",
    label: "浅色风化",
    description: "日晒后的灰暖浅褐色，适合檐下木板、旧门板和外露次构件。",
    dark: [0.245, 0.165, 0.095],
    mid: [0.555, 0.420, 0.270],
    light: [0.765, 0.650, 0.465],
    weather: [0.590, 0.575, 0.520],
    freshCut: [0.805, 0.690, 0.485],
    roughness: [0.75, 0.94],
    lacquer: 0.0,
    contrast: 0.27,
    relief: 0.70,
    poreScale: 0.82
  }),
  lacquered_chestnut: Object.freeze({
    id: "lacquered_chestnut",
    label: "栗褐上漆",
    description: "克制的栗红褐旧漆，适合厅堂门窗、栏板和维护较好的构件。",
    dark: [0.105, 0.035, 0.021],
    mid: [0.375, 0.120, 0.060],
    light: [0.610, 0.260, 0.128],
    weather: [0.285, 0.190, 0.140],
    freshCut: [0.585, 0.330, 0.175],
    roughness: [0.34, 0.60],
    lacquer: 0.58,
    contrast: 0.28,
    relief: 0.48,
    poreScale: 0.60
  })
});

export const RELIEF_LEVELS = Object.freeze({
  building: Object.freeze({
    id: "building",
    microNormal: true,
    parallaxSteps: 0,
    vertexDisplacement: false,
    normalStrength: 0.10,
    parallaxDepthMeters: 0,
    displacementMeters: 0
  }),
  close: Object.freeze({
    id: "close",
    microNormal: true,
    parallaxSteps: 6,
    vertexDisplacement: false,
    normalStrength: 0.145,
    parallaxDepthMeters: 0.0045,
    displacementMeters: 0
  }),
  inspection: Object.freeze({
    id: "inspection",
    microNormal: true,
    parallaxSteps: 10,
    vertexDisplacement: true,
    normalStrength: 0.175,
    parallaxDepthMeters: 0.0065,
    displacementMeters: 0.0045
  })
});

export function hashString32(input) {
  const text = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function randomGenerationSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const data = new Uint32Array(1);
    globalThis.crypto.getRandomValues(data);
    return data[0] >>> 0;
  }
  return (Math.random() * 0x100000000) >>> 0;
}

export function deriveSourceTimberSeed({
  generationSeed,
  buildingId,
  floorId = "0",
  sourceTimberId,
  materialRevision = "1"
}) {
  return hashString32(
    `${generationSeed >>> 0}|${buildingId}|${floorId}|${sourceTimberId}|${materialRevision}`
  );
}

export function deriveMemberSeed(sourceSeed, memberId) {
  return hashString32(`${sourceSeed >>> 0}|${memberId}`);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function length3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize(v, fallback = [1, 0, 0]) {
  const len = length3(v);
  return len > 1e-8 ? [v[0] / len, v[1] / len, v[2] / len] : [...fallback];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function multiplyScalar(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

/**
 * Returns a stable right handed basis.
 * Canonical X is the length and fibre axis.
 * Canonical Y and Z form the cross section plane.
 */
export function canonicalTimberBasis(
  geometryLengthAxis = [1, 0, 0],
  radialAxisHint = [0, 1, 0]
) {
  const x = normalize(geometryLengthAxis, [1, 0, 0]);
  let y = subtract(radialAxisHint, multiplyScalar(x, dot(radialAxisHint, x)));

  if (length3(y) < 1e-5) {
    const fallback = Math.abs(x[1]) < 0.85 ? [0, 1, 0] : [0, 0, 1];
    y = subtract(fallback, multiplyScalar(x, dot(fallback, x)));
  }

  y = normalize(y, [0, 1, 0]);
  const z = normalize(cross(x, y), [0, 0, 1]);
  y = normalize(cross(z, x), y);
  return Object.freeze({ x, y, z });
}

export function toCanonicalTimberPoint(point, basis) {
  return [dot(point, basis.x), dot(point, basis.y), dot(point, basis.z)];
}

export function classifyTimberFace(
  localNormal,
  geometryLengthAxis = [1, 0, 0],
  endThreshold = 0.86
) {
  const n = normalize(localNormal, [0, 1, 0]);
  const axis = normalize(geometryLengthAxis, [1, 0, 0]);
  return Math.abs(dot(n, axis)) >= endThreshold ? "end_grain" : "longitudinal";
}

export function resolveProfileCode(profile = "rectangular") {
  if (!(profile in TIMBER_PROFILE_CODES)) {
    throw new Error(`Unknown timber profile: ${profile}`);
  }
  return TIMBER_PROFILE_CODES[profile];
}

export function chooseReliefMode(distanceMeters, qualityCap = "inspection") {
  const rank = { building: 0, close: 1, inspection: 2 };
  const cap = rank[qualityCap] ?? 2;
  const target = distanceMeters > 28 ? 0 : distanceMeters > 7 ? 1 : 2;
  return [RELIEF_LEVELS.building, RELIEF_LEVELS.close, RELIEF_LEVELS.inspection][
    Math.min(cap, target)
  ];
}

export function createMemberMaterialSpec({
  generationSeed,
  buildingId,
  floorId = "0",
  memberId,
  sourceTimberId = memberId,
  materialRevision = "1",
  presetId = "dark_aged",
  profile = "rectangular",
  geometryLengthAxis = [1, 0, 0],
  radialAxisHint = [0, 1, 0],
  grainOffset = [0, 0, 0],
  weathering = 0.34,
  toolMarks = 0.28,
  qualityCap = "inspection"
}) {
  if (!memberId) throw new Error("memberId is required");
  if (!buildingId) throw new Error("buildingId is required");
  const preset = TIMBER_PRESETS[presetId];
  if (!preset) throw new Error(`Unknown presetId: ${presetId}`);

  const sourceSeed = deriveSourceTimberSeed({
    generationSeed,
    buildingId,
    floorId,
    sourceTimberId,
    materialRevision
  });
  const memberSeed = deriveMemberSeed(sourceSeed, memberId);
  const basis = canonicalTimberBasis(geometryLengthAxis, radialAxisHint);
  const profileCode = resolveProfileCode(profile);

  return Object.freeze({
    skillVersion: SKILL_VERSION,
    generationSeed: generationSeed >>> 0,
    buildingId,
    floorId,
    memberId,
    sourceTimberId,
    sourceSeed,
    memberSeed,
    materialRevision,
    presetId,
    profile,
    profileCode,
    geometryLengthAxis: [...geometryLengthAxis],
    radialAxisHint: [...radialAxisHint],
    canonicalBasis: basis,
    grainOffset: [...grainOffset],
    weathering,
    toolMarks,
    qualityCap
  });
}

export function serializeBuildingTimberState({
  generationSeed,
  defaultPresetId = "dark_aged",
  members
}) {
  return {
    skill: "yunnan_timber_procedural",
    skillVersion: SKILL_VERSION,
    generationSeed: generationSeed >>> 0,
    defaultPresetId,
    members: members.map((member) => ({
      memberId: member.memberId,
      sourceTimberId: member.sourceTimberId,
      presetId: member.presetId,
      profile: member.profile,
      geometryLengthAxis: member.geometryLengthAxis,
      radialAxisHint: member.radialAxisHint,
      grainOffset: member.grainOffset,
      weathering: member.weathering,
      toolMarks: member.toolMarks,
      qualityCap: member.qualityCap
    }))
  };
}
