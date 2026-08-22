import * as THREE from 'three';
import {
  createYunnanCourtyardPrototype,
  disposeYunnanCourtyardPrototype,
} from './YunnanCourtyardProduction.js';
import {
  createWeatheredEarthWallMaterial,
  createWeatheredTileMaterial,
} from './YunnanMaterialFactory.js';

/**
 * Reference-calibrated visual layer derived from the Dali, Wulong and Tuanjie
 * GLB studies.  It intentionally does not promote scan appearance to measured
 * construction data.  The layer is optional, deterministic and reversible.
 */
export const YUNNAN_REFERENCE_CALIBRATION_V543 = Object.freeze({
  schemaVersion: '5.4.3',
  id: 'YN-REFERENCE-CALIBRATION-V543',
  evidenceStatus: 'reference-calibrated',
  sources: [
    'data/evidence/yunnan_three_reference_roof_study_v5_4_3.json',
    'data/evidence/yunnan_three_reference_wall_masonry_study_v5_4_3.json',
    'data/evidence/yunnan_three_reference_glb_analysis_v5_4_3.json',
  ],
  roof: {
    visibleBuildUpMeters: 0.16,
    eaveProjectionMeters: 0.66,
    tileWeathering: 0.58,
    tileExposure: 0.72,
    repairRate: 0.028,
    heightOffsetsMeters: {
      'north-main-roof': 0.10,
      'west-ear-roof': -0.025,
      'east-ear-roof': -0.025,
      'front-gate-roof': -0.075,
      'shed-tile-roof': -0.12,
    },
    colorFamilies: [
      { id: 'cool-gray', color: '#686d6a' },
      { id: 'warm-gray', color: '#807970' },
      { id: 'brown-gray', color: '#746b61' },
      { id: 'pale-weathered-gray', color: '#8a877f' },
    ],
  },
  wall: {
    seed: 543,
    roughness: 0.94,
    weathering: 0.90,
    exposure: 0.58,
    repairOpacity: 0.30,
    colorFamilies: [
      { id: 'warm-red-brown', color: '#9a6a4e' },
      { id: 'warm-ochre', color: '#a57a57' },
      { id: 'gray-brown', color: '#886f5d' },
    ],
  },
  unresolved: [
    'measured tile lap and course spacing',
    'mud bedding and fastening',
    'ordinary dwelling ridge and eave closure',
    'measured wall thickness and batter by case',
    'repair chronology',
  ],
});

function stableHash(value, seed = 543) {
  const text = `${value ?? ''}:${seed}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableUnit(value, seed = 543) {
  return stableHash(value, seed) / 0xffffffff;
}

function roofUnitGroups(root) {
  const groups = [];
  root.traverse((object) => {
    if (!object.isGroup) return;
    let hasPan = false;
    let hasCover = false;
    object.children.forEach((child) => {
      if (child.userData?.type === '板瓦-pan-tile') hasPan = true;
      if (child.userData?.type === '筒瓦-cover-tile') hasCover = true;
    });
    if (hasPan && hasCover) groups.push(object);
  });
  return groups;
}

function collectCourseRange(group) {
  let min = Infinity;
  let max = -Infinity;
  group.traverse((object) => {
    const course = Number(object.userData?.course);
    if (!Number.isFinite(course)) return;
    min = Math.min(min, course);
    max = Math.max(max, course);
  });
  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
  };
}

function createRoofPalette(unitId, unitIndex, calibration, registry) {
  const family = calibration.roof.colorFamilies[unitIndex % calibration.roof.colorFamilies.length];
  const seed = calibration.wall.seed + 37 + unitIndex * 31;
  const pan = createWeatheredTileMaterial({
    seed,
    color: family.color,
    weathering: calibration.roof.tileWeathering,
    exposure: calibration.roof.tileExposure,
  });
  const cover = createWeatheredTileMaterial({
    seed: seed + 13,
    color: calibration.roof.colorFamilies[(unitIndex + 1) % calibration.roof.colorFamilies.length].color,
    weathering: calibration.roof.tileWeathering + 0.035,
    exposure: calibration.roof.tileExposure - 0.04,
  });
  const repair = createWeatheredTileMaterial({
    seed: seed + 71,
    color: calibration.roof.colorFamilies[(unitIndex + 2) % calibration.roof.colorFamilies.length].color,
    weathering: Math.min(1, calibration.roof.tileWeathering + 0.18),
    exposure: Math.max(0.25, calibration.roof.tileExposure - 0.16),
  });
  [pan, cover, repair].forEach((material, index) => {
    material.userData = {
      ...(material.userData || {}),
      calibrationId: calibration.id,
      roofUnitId: unitId,
      materialRole: ['pan-tile', 'cover-tile', 'repair-tile'][index],
      evidenceStatus: 'reference-calibrated',
    };
    registry.add(material);
  });
  return { pan, cover, repair, familyId: family.id };
}

function applyRoofCalibration(root, calibration, registry) {
  const groups = roofUnitGroups(root);
  groups.forEach((group, unitIndex) => {
    const roofType = group.userData?.type || `roof-unit-${unitIndex + 1}`;
    const unitId = `V543-ROOF-${String(unitIndex + 1).padStart(2, '0')}-${roofType}`;
    const offset = calibration.roof.heightOffsetsMeters[roofType] ?? 0;
    group.position.y += offset;
    const palette = createRoofPalette(unitId, unitIndex, calibration, registry);
    const courseRange = collectCourseRange(group);
    group.userData = {
      ...(group.userData || {}),
      roofUnitId: unitId,
      calibrationId: calibration.id,
      calibrationHeightOffsetMeters: offset,
      colorFamilyId: palette.familyId,
      evidenceStatus: 'reference-calibrated',
      visibleLayerBuildUp: [
        { layer: 'rafters-or-support', status: 'existing-visible-geometry' },
        { layer: 'underlay', status: 'visual-calibration-only' },
        { layer: 'bedding', status: 'unresolved-placeholder' },
        { layer: 'pan-and-cover-tiles', status: 'semantic-topology' },
        { layer: 'eave-and-ridge-closure', status: 'case-dependent-unresolved' },
      ],
    };
    group.traverse((object) => {
      if (!object.isMesh) return;
      const type = object.userData?.type;
      if (type !== '板瓦-pan-tile' && type !== '筒瓦-cover-tile') return;
      const key = `${unitId}:${object.userData?.roofSide}:${object.userData?.course}:${object.userData?.tileIndex}`;
      const repair = stableUnit(key, calibration.wall.seed) < calibration.roof.repairRate;
      object.material = repair ? palette.repair : type === '板瓦-pan-tile' ? palette.pan : palette.cover;
      const course = Number(object.userData?.course) || 0;
      object.userData = {
        ...(object.userData || {}),
        roofUnitId: unitId,
        calibrationId: calibration.id,
        evidenceStatus: repair ? 'reference-calibrated-repair-appearance' : 'reference-calibrated',
        weatheringZone: course === courseRange.min ? 'eave' : course === courseRange.max ? 'ridge' : 'slope',
        colorFieldSeed: stableHash(key, calibration.wall.seed),
        repairAppearance: repair,
      };
    });
  });
  return groups;
}

function exteriorFaceForWall(type) {
  if (/west/.test(type)) return { axis: 'x', sign: -1 };
  if (/east/.test(type)) return { axis: 'x', sign: 1 };
  if (/south|front/.test(type)) return { axis: 'z', sign: -1 };
  return { axis: 'z', sign: 1 };
}

function createRepairPatch(wall, type, index, calibration, registry) {
  const geometry = wall.geometry;
  if (!geometry?.boundingBox) geometry?.computeBoundingBox?.();
  const box = geometry?.boundingBox;
  if (!box) return null;
  const size = new THREE.Vector3();
  box.getSize(size);
  const face = exteriorFaceForWall(type);
  const horizontal = face.axis === 'x' ? size.z : size.x;
  const patchWidth = Math.max(0.25, horizontal * (0.18 + stableUnit(type, 601) * 0.14));
  const patchHeight = Math.max(0.22, size.y * (0.10 + stableUnit(type, 607) * 0.12));
  const material = new THREE.MeshStandardMaterial({
    color: stableUnit(type, 613) > 0.5 ? '#c2b7a3' : '#6e5545',
    roughness: 0.98,
    metalness: 0,
    transparent: true,
    opacity: calibration.wall.repairOpacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  material.userData = {
    calibrationId: calibration.id,
    layer: 'repair-surface',
    evidenceStatus: 'visual-calibration-only',
  };
  registry.add(material);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(patchWidth, patchHeight), material);
  const vertical = Math.max(patchHeight * 0.65, size.y * (0.18 + stableUnit(type, 619) * 0.45));
  const along = (stableUnit(type, 631) - 0.5) * Math.max(0, horizontal - patchWidth) * 0.68;
  if (face.axis === 'z') {
    patch.position.set(along, vertical, face.sign * (size.z / 2 + 0.006));
    if (face.sign < 0) patch.rotation.y = Math.PI;
  } else {
    patch.rotation.y = face.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    patch.position.set(face.sign * (size.x / 2 + 0.006), vertical, along);
  }
  patch.userData = {
    type: 'reference-calibrated-wall-repair-patch',
    wallType: type,
    patchIndex: index,
    calibrationId: calibration.id,
    evidenceStatus: 'visual-calibration-only',
  };
  wall.add(patch);
  return patch;
}

function applyWallCalibration(root, calibration, registry) {
  let wallIndex = 0;
  const wallRecords = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    const type = String(object.userData?.type || '');
    if (!/(wall|gable)/.test(type) || type.includes('opening')) return;
    const family = calibration.wall.colorFamilies[wallIndex % calibration.wall.colorFamilies.length];
    const material = createWeatheredEarthWallMaterial({
      seed: calibration.wall.seed + wallIndex * 23,
      color: family.color,
      roughness: calibration.wall.roughness,
      weathering: calibration.wall.weathering,
      exposure: calibration.wall.exposure,
      heightMeters: Math.max(2.4, root.userData?.options?.wallHeight || 4.7),
    });
    material.userData = {
      ...(material.userData || {}),
      calibrationId: calibration.id,
      colorFamilyId: family.id,
      evidenceStatus: 'reference-calibrated',
    };
    registry.add(material);
    object.material = material;
    object.userData = {
      ...(object.userData || {}),
      wallAssemblyLayers: [
        { layer: 'core-mass', status: 'typology-or-measured-rule' },
        { layer: 'visible-finish', status: 'reference-calibrated' },
        { layer: 'stone-or-brick-base', status: 'case-dependent' },
        { layer: 'corner-and-opening-edge', status: 'class-dependent' },
        { layer: 'repair', status: 'visual-calibration-only' },
        { layer: 'weathering', status: 'reference-calibrated' },
      ],
      calibrationId: calibration.id,
      colorFieldSeed: calibration.wall.seed + wallIndex * 23,
      evidenceStatus: 'reference-calibrated',
    };
    const patch = createRepairPatch(object, type, wallIndex, calibration, registry);
    wallRecords.push({ type, colorFamilyId: family.id, repairPatch: !!patch });
    wallIndex += 1;
  });
  return wallRecords;
}

export function applyYunnanReferenceCalibrationV543(root, options = {}) {
  if (!root) throw new Error('A Yunnan courtyard root is required');
  const calibration = {
    ...YUNNAN_REFERENCE_CALIBRATION_V543,
    ...options,
    roof: { ...YUNNAN_REFERENCE_CALIBRATION_V543.roof, ...(options.roof || {}) },
    wall: { ...YUNNAN_REFERENCE_CALIBRATION_V543.wall, ...(options.wall || {}) },
  };
  const registry = root.userData.referenceCalibrationMaterials || new Set();
  const roofUnits = applyRoofCalibration(root, calibration, registry);
  const wallRecords = applyWallCalibration(root, calibration, registry);
  root.userData.referenceCalibrationMaterials = registry;
  root.userData.referenceCalibrationV543 = {
    id: calibration.id,
    schemaVersion: calibration.schemaVersion,
    evidenceStatus: calibration.evidenceStatus,
    sourceRecords: calibration.sources,
    roofUnitCount: roofUnits.length,
    wallCount: wallRecords.length,
    roofOffsetsMeters: calibration.roof.heightOffsetsMeters,
    visibleRoofBuildUpMeters: calibration.roof.visibleBuildUpMeters,
    unresolved: calibration.unresolved,
  };
  return root;
}

export function createReferenceCalibratedYunnanCourtyardPrototype(userOptions = {}) {
  const calibration = userOptions.referenceCalibration || {};
  const model = createYunnanCourtyardPrototype({
    seed: YUNNAN_REFERENCE_CALIBRATION_V543.wall.seed,
    roofEave: YUNNAN_REFERENCE_CALIBRATION_V543.roof.eaveProjectionMeters,
    roofThickness: YUNNAN_REFERENCE_CALIBRATION_V543.roof.visibleBuildUpMeters,
    materials: {
      wall: {
        color: YUNNAN_REFERENCE_CALIBRATION_V543.wall.colorFamilies[0].color,
        weathering: YUNNAN_REFERENCE_CALIBRATION_V543.wall.weathering,
        exposure: YUNNAN_REFERENCE_CALIBRATION_V543.wall.exposure,
      },
      tilePan: {
        weathering: YUNNAN_REFERENCE_CALIBRATION_V543.roof.tileWeathering,
        exposure: YUNNAN_REFERENCE_CALIBRATION_V543.roof.tileExposure,
      },
      tileCover: {
        weathering: YUNNAN_REFERENCE_CALIBRATION_V543.roof.tileWeathering + 0.035,
        exposure: YUNNAN_REFERENCE_CALIBRATION_V543.roof.tileExposure - 0.04,
      },
      ...(userOptions.materials || {}),
    },
    ...userOptions,
  });
  return applyYunnanReferenceCalibrationV543(model, calibration);
}

export function disposeReferenceCalibratedYunnanCourtyardPrototype(root) {
  if (!root) return;
  const registry = root.userData?.referenceCalibrationMaterials;
  if (registry) registry.forEach((material) => material?.dispose?.());
  disposeYunnanCourtyardPrototype(root);
}
