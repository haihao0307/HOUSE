export const SURFACE_SEED_URL = 'data/production/yunnan_surface_weathering_seed_v5_5_0.json';

export const UNRESOLVED_SURFACE_EVIDENCE = Object.freeze([
  'panTileLongitudinalOverlap', 'tileCourseCenterSpacing', 'coverTileSeamOverlap',
  'underlayMaterialAndFixing', 'residentialRidgeClosure', 'exactWallCoreMaterialBySample',
  'repairChronologyByBuilding', 'historicMossDistributionByYear',
]);

const BASELINE_ROOF = Object.freeze({
  baseFiringTone: 0.50, orientationExposure: 0.12, dust: 0.06, moss: 0,
  rainWash: 0.04, damage: 0, repair: 0, repairAgeTone: 0, edgeWear: 0.05,
});

const BASELINE_WALL = Object.freeze({
  plasterCoverage: 0, earthExposure: 0, cornerProtection: 0, dampBand: 0,
  verticalRainWash: 0, surfaceLoss: 0, crackNetwork: 0, repairPatches: 0,
  sootAndDirt: 0,
});

export const BASELINE_PROFILE = Object.freeze({
  id: 'baselineV544', label: 'V5.4.4 基线', enabled: false,
  schemaVersion: '5.4.4', roof: BASELINE_ROOF, wall: BASELINE_WALL,
  unresolved: UNRESOLVED_SURFACE_EVIDENCE,
});

function numericCopy(source = {}) {
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, typeof value === 'number' ? Number(value) : value]));
}

function fingerprint(profile) {
  const canonical = {
    id: profile.id,
    roof: Object.fromEntries(Object.entries(profile.roof || {}).filter(([, value]) => typeof value === 'number').sort(([a], [b]) => a.localeCompare(b))),
    wall: Object.fromEntries(Object.entries(profile.wall || {}).filter(([, value]) => typeof value === 'number' || typeof value === 'string').sort(([a], [b]) => a.localeCompare(b))),
  };
  return JSON.stringify(canonical);
}

export function resolveSurfaceProfile(seed, name = 'museum1940sBalanced') {
  if (name === 'baselineV544') return BASELINE_PROFILE;
  const roofPresets = seed?.roofSurfaceSchema?.presets || {};
  const wallPresets = seed?.wallSurfaceSchema?.presets || {};
  const wallNames = {
    museum1940sBalanced: 'yikeyin1940sBalanced',
    wulongWeathered: 'wulongLongWeathering',
    daliMaintained: 'daliMaintainedWall',
  };
  const roof = numericCopy(roofPresets[name] || roofPresets.museum1940sBalanced || {});
  const wall = numericCopy(wallPresets[wallNames[name] || name] || wallPresets.yikeyin1940sBalanced || {});
  const profile = {
    id: name,
    label: roof.label || name,
    enabled: true,
    roof,
    wall,
    schemaVersion: seed?.schemaVersion || '5.5.0',
    unresolved: [...UNRESOLVED_SURFACE_EVIDENCE],
  };
  profile.fingerprint = fingerprint(profile);
  return profile;
}

export function listSurfaceProfiles(seed) {
  return ['museum1940sBalanced', 'wulongWeathered', 'daliMaintained'].map((id) => resolveSurfaceProfile(seed, id));
}
