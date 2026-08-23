export const ROOF_UNITS = Object.freeze([
  'mainHouseDoublePitch',
  'leftEarAsymmetricDoublePitch',
  'rightEarAsymmetricDoublePitch',
  'entranceBlockDoublePitch',
  'mainGalleryLeanTo',
  'sideGalleryLeanTo',
  'gatehouseSmallRoof',
]);

export const ROOF_BUILD_UP = Object.freeze([
  'purlins',
  'rafters',
  'roofUnderlay',
  'panTileCourses',
  'coverTileCourses',
  'eaveCapsAndDrips',
  'ridgeAndClosures',
]);

function containsGeometry(group) {
  let found = false;
  group.traverse((object) => {
    if (object.isMesh && object.geometry) found = true;
  });
  return found;
}

function layerRoots(roof) {
  const layers = new Map();
  roof.traverse((object) => {
    const id = object.userData?.roofLayerId;
    if (!id) return;
    if (!layers.has(id)) layers.set(id, []);
    layers.get(id).push(object);
  });
  return layers;
}

function roofStats(roof) {
  const stats = { meshCount: 0, instancedDrawCount: 0, instanceCount: 0, triangleCount: 0 };
  roof.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    stats.meshCount += 1;
    const multiplier = object.isInstancedMesh ? object.count : 1;
    if (object.isInstancedMesh) {
      stats.instancedDrawCount += 1;
      stats.instanceCount += object.count;
    }
    const position = object.geometry.getAttribute('position');
    const triangles = object.geometry.index ? object.geometry.index.count / 3 : (position?.count || 0) / 3;
    stats.triangleCount += triangles * multiplier;
  });
  return stats;
}

export function registerYunnanRoofSurfaces(root, profile = {}) {
  const candidates = [];
  root.traverse((object) => {
    if (object.isGroup && object.userData?.isRoofUnit === true) candidates.push(object);
  });
  const grouped = new Map();
  candidates.forEach((roof) => {
    const id = roof.userData.roofUnitId;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(roof);
  });
  const missingRoofUnitIds = ROOF_UNITS.filter((id) => !grouped.has(id));
  const duplicateRoofUnitIds = [...grouped.entries()].filter(([, values]) => values.length !== 1).map(([id]) => id);
  const roofs = ROOF_UNITS.map((id) => grouped.get(id)?.[0]).filter(Boolean);
  const strictTopology = profile.enabled !== false;
  const unitChecks = roofs.map((roof) => {
    const layers = layerRoots(roof);
    const missingLayers = ROOF_BUILD_UP.filter((id) => !(layers.get(id) || []).some(containsGeometry));
    const slopes = [];
    roof.traverse((object) => {
      if (object.userData?.type === 'roof-slope') slopes.push(object);
    });
    const topologyValid = slopes.length > 0 && slopes.every((slope) => {
      const topology = slope.userData.tileTopology;
      if (!topology) return false;
      if (!strictTopology) return topology.panColumns > 0 && topology.coverColumns > 0;
      return topology.coverColumns === topology.panColumns - 1
        && topology.coverBridgesPanSeams === true
        && topology.coverCourseOffsetM === 0
        && topology.seamAlignmentMaxErrorM <= 1e-6
        && topology.longitudinalOverlapM > 0
        && topology.dripCount === topology.panColumns
        && topology.hookCount === topology.coverColumns
        && topology.drainagePathsMonotonic === true
        && topology.drainagePathsEndAtEave === true
        && topology.tileBatchesAreInstanced === true;
    });
    const stats = roofStats(roof);
    const check = {
      roofUnitId: roof.userData.roofUnitId,
      sectionCount: roof.userData.sectionCount,
      slopeCount: slopes.length,
      missingLayers,
      topologyValid,
      hasRealGeometry: stats.meshCount > 0 && stats.instanceCount > 0,
      stats,
    };
    check.passed = missingLayers.length === 0 && check.slopeCount > 0 && check.hasRealGeometry && topologyValid;
    roof.userData.validation = check;
    return check;
  });
  const complete = missingRoofUnitIds.length === 0
    && duplicateRoofUnitIds.length === 0
    && roofs.length === ROOF_UNITS.length
    && unitChecks.every((check) => check.passed);
  root.userData.roofSurfaceSystem = {
    version: '5.5.0',
    expectedRoofUnitIds: [...ROOF_UNITS],
    actualRoofUnitIds: roofs.map((roof) => roof.userData.roofUnitId),
    roofUnitCount: roofs.length,
    missingRoofUnitIds,
    duplicateRoofUnitIds,
    buildUp: [...ROOF_BUILD_UP],
    profileId: profile.id || 'museum1940sBalanced',
    strictTopology,
    complete,
    unitChecks,
  };
  if (!complete) {
    throw new Error(`V5.5 roof contract failed: ${JSON.stringify({
      missingRoofUnitIds,
      duplicateRoofUnitIds,
      failedUnits: unitChecks.filter((check) => !check.passed).map((check) => check.roofUnitId),
    })}`);
  }
  return roofs;
}

export function setYunnanRoofLayerVisibility(root, layerId, visible) {
  if (!ROOF_BUILD_UP.includes(layerId)) throw new Error(`Unknown roof layer: ${layerId}`);
  let changed = 0;
  root.traverse((object) => {
    if (object.userData?.roofLayerId === layerId) {
      object.visible = Boolean(visible);
      changed += 1;
    }
  });
  return { layerId, visible: Boolean(visible), changed };
}

export function setYunnanRoofExploded(root, enabledOrDistance = true) {
  const distance = typeof enabledOrDistance === 'number' ? Math.max(0, enabledOrDistance) : enabledOrDistance ? 0.16 : 0;
  let changed = 0;
  root.traverse((object) => {
    const layerId = object.userData?.roofLayerId;
    if (!layerId || !object.isGroup) return;
    if (!object.userData.roofLayerBasePosition) object.userData.roofLayerBasePosition = object.position.toArray();
    const [x, y, z] = object.userData.roofLayerBasePosition;
    const order = ROOF_BUILD_UP.indexOf(layerId);
    object.position.set(x, y + distance * order, z);
    changed += 1;
  });
  if (root.userData?.roofSurfaceSystem) root.userData.roofSurfaceSystem.explodeDistanceM = distance;
  return { enabled: distance > 0, distanceM: distance, changed };
}
