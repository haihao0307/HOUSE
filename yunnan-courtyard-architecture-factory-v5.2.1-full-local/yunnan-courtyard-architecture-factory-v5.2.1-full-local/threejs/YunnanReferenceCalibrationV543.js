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
 * Optional visual calibration derived from the Dali, Wulong and Tuanjie GLBs.
 * It keeps every scan-derived adjustment reversible and evidence-gated.
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
  const result = [];
  root.traverse((object) => {
    if (!object.isGroup) return;
    const directTypes = new Set(object.children.map((child) => child.userData?.type));
    if (directTypes.has('板瓦-pan-tile') && directTypes.has('筒瓦-cover-tile')) result.push(object);
  });
  return result;
}

function courseRange(group) {
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

function registerMaterial(material, registry, metadata) {
  material.userData = { ...(material.userData || {}), ...metadata };
  registry.add(material);
  return material;
}

function createRoofPalette(unitId, index, calibration, registry) {
  const families = calibration.roof.colorFamilies;
  const seed = calibration.wall.seed + 37 + index * 31;
  const common = {
    weathering: calibration.roof.tileWeathering,
    exposure: calibration.roof.tileExposure,
  };
  const pan = registerMaterial(
    createWeatheredTileMaterial({ seed, color: families[index % families.length].color, ...common }),
    registry,
    { calibrationId: calibration.id, roofUnitId: unitId, materialRole: 'pan-tile', evidenceStatus: 'reference-calibrated' },
  );
  const cover = registerMaterial(
    createWeatheredTileMaterial({
      seed: seed + 13,
      color: families[(index + 1) % families.length].color,
      weathering: common.weathering + 0.035,
      exposure: common.exposure - 0.04,
    }),
    registry,
    { calibrationId: calibration.id, roofUnitId: unitId, materialRole: 'cover-tile', evidenceStatus: 'reference-calibrated' },
  );
  const repair = registerMaterial(
    createWeatheredTileMaterial({
      seed: seed + 71,
      color: families[(index + 2) % families.length].color,
      weathering: Math.min(1, common.weathering + 0.18),
      exposure: Math.max(0.25, common.exposure - 0.16),
    }),
    registry,
    { calibrationId: calibration.id, roofUnitId: unitId, materialRole: 'repair-tile', evidenceStatus: 'visual-calibration-only' },
  );
  return { pan, cover, repair, familyId: families[index % families.length].id };
}

function applyRoofCalibration(root, calibration, registry) {
  const groups = roofUnitGroups(root);
  groups.forEach((group, index) => {
    const roofType = group.userData?.type || `roof-unit-${index + 1}`;
    const unitId = `V543-ROOF-${String(index + 1).padStart(2, '0')}-${roofType}`;
    const offset = calibration.roof.heightOffsetsMeters[roofType] ?? 0;
    const range = courseRange(group);
    const palette = createRoofPalette(unitId, index, calibration, registry);
    group.position.y += offset;
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
        evidenceStatus: repair ? 'visual-calibration-only' : 'reference-calibrated',
        weatheringZone: course === range.min ? 'eave' : course === range.max ? 'ridge' : 'slope',
        colorFieldSeed: stableHash(key, calibration.wall.seed),
        repairAppearance: repair,
      };
    });
  });
  return groups;
}

function exteriorFace(type) {
  if (/west/.test(type)) return { axis: 'x', sign: -1 };
  if (/east/.test(type)) return { axis: 'x', sign: 1 };
  if (/south|front/.test(type)) return { axis: 'z', sign: -1 };
  return { axis: 'z', sign: 1 };
}

function createRepairPatch(wall, type, index, calibration, registry) {
  wall.geometry?.computeBoundingBox?.();
  const bounds = wall.geometry?.boundingBox;
  if (!bounds) return null;
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const face = exteriorFace(type);
  const horizontal = face.axis === 'x' ? size.z : size.x;
  const width = Math.max(0.25, horizontal * (0.18 + stableUnit(type, 601) * 0.14));
  const height = Math.max(0.22, size.y * (0.10 + stableUnit(type, 607) * 0.12));
  const material = registerMaterial(
    new THREE.MeshStandardMaterial({
      color: stableUnit(type, 613) > 0.5 ? '#c2b7a3' : '#6e5545',
      roughness: 0.98,
      metalness: 0,
      transparent: true,
      opacity: calibration.wall.repairOpacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    registry,
    { calibrationId: calibration.id, layer: 'repair-surface', evidenceStatus: 'visual-calibration-only' },
  );
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  const vertical = Math.max(height * 0.65, size.y * (0.18 + stableUnit(type, 619) * 0.45));
  const along = (stableUnit(type, 631) - 0.5) * Math.max(0, horizontal - width) * 0.68;
  if (face.axis === 'z') {
    patch.position.set(along, vertical, face.sign * (size.z / 2 + 0.006));
    if (face.sign < 0) patch.rotation.y = Math.PI;
  } else {
    patch.rotation.y = face.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    patch.position.set(face.sign * (size.x / 2 + 0.006), vertical, along);
  }
  patch.userData = {
    type: 'reference-calibrated-repair-patch',
    wallType: type,
    patchIndex: index,
    calibrationId: calibration.id,
    evidenceStatus: 'visual-calibration-only',
  };
  wall.add(patch);
  return patch;
}

function applyWallCalibration(root, calibration, registry) {
  const walls = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    const type = String(object.userData?.type || '');
    if (!/(wall|gable)/.test(type) || type.includes('opening') || type.includes('repair-patch')) return;
    walls.push({ object, type });
  });
  return walls.map(({ object, type }, index) => {
    const family = calibration.wall.colorFamilies[index % calibration.wall.colorFamilies.length];
    const material = registerMaterial(
      createWeatheredEarthWallMaterial({
        seed: calibration.wall.seed + index * 23,
        color: family.color,
        roughness: calibration.wall.roughness,
        weathering: calibration.wall.weathering,
        exposure: calibration.wall.exposure,
        heightMeters: Math.max(2.4, root.userData?.options?.wallHeight || 4.7),
      }),
      registry,
      { calibrationId: calibration.id, colorFamilyId: family.id, evidenceStatus: 'reference-calibrated' },
    );
    object.material = material;
    object.userData = {
      ...(object.userData || {}),
      calibrationId: calibration.id,
      colorFieldSeed: calibration.wall.seed + index * 23,
      evidenceStatus: 'reference-calibrated',
      wallAssemblyLayers: [
        { layer: 'core-mass', status: 'typology-or-measured-rule' },
        { layer: 'visible-finish', status: 'reference-calibrated' },
        { layer: 'stone-or-brick-base', status: 'case-dependent' },
        { layer: 'corner-and-opening-edge', status: 'class-dependent' },
        { layer: 'repair', status: 'visual-calibration-only' },
        { layer: 'weathering', status: 'reference-calibrated' },
      ],
    };
    const patch = createRepairPatch(object, type, index, calibration, registry);
    return { type, colorFamilyId: family.id, repairPatch: !!patch };
  });
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
  const {
    referenceCalibration = {},
    materials: userMaterials = {},
    ...prototypeOptions
  } = userOptions;
  const model = createYunnanCourtyardPrototype({
    ...prototypeOptions,
    seed: prototypeOptions.seed ?? YUNNAN_REFERENCE_CALIBRATION_V543.wall.seed,
    roofEave: prototypeOptions.roofEave ?? YUNNAN_REFERENCE_CALIBRATION_V543.roof.eaveProjectionMeters,
    roofThickness: prototypeOptions.roofThickness ?? YUNNAN_REFERENCE_CALIBRATION_V543.roof.visibleBuildUpMeters,
    materials: {
      wall: {
        color: YUNNAN_REFERENCE_CALIBRATION_V543.wall.colorFamilies[0].color,
        weathering: YUNNAN_REFERENCE_CALIBRATION_V543.wall.weathering,
        exposure: YUNNAN_REFERENCE_CALIBRATION_V543.wall.exposure,
        ...(userMaterials.wall || {}),
      },
      tilePan: {
        weathering: YUNNAN_REFERENCE_CALIBRATION_V543.roof.tileWeathering,
        exposure: YUNNAN_REFERENCE_CALIBRATION_V543.roof.tileExposure,
        ...(userMaterials.tilePan || {}),
      },
      tileCover: {
        weathering: YUNNAN_REFERENCE_CALIBRATION_V543.roof.tileWeathering + 0.035,
        exposure: YUNNAN_REFERENCE_CALIBRATION_V543.roof.tileExposure - 0.04,
        ...(userMaterials.tileCover || {}),
      },
      timber: userMaterials.timber || {},
      stone: userMaterials.stone || {},
      opening: userMaterials.opening || {},
    },
  });
  return applyYunnanReferenceCalibrationV543(model, referenceCalibration);
}

export function disposeReferenceCalibratedYunnanCourtyardPrototype(root) {
  if (!root) return;
  const registry = root.userData?.referenceCalibrationMaterials;
  if (registry) registry.forEach((material) => material?.dispose?.());
  disposeYunnanCourtyardPrototype(root);
}
