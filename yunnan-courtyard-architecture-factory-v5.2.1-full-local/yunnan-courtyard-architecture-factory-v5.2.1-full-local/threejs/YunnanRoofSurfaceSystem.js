import * as THREE from 'three';

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

function layerGeometryCounts(roof) {
  const counts = Object.fromEntries(ROOF_BUILD_UP.map((id) => [id, 0]));
  roof.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const id = object.userData?.roofLayerId;
    if (!id || !(id in counts)) return;
    counts[id] += object.isInstancedMesh ? object.count : 1;
  });
  return counts;
}

function appendObjectWorldBounds(target, object) {
  if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
  if (!object.geometry.boundingBox) return;
  if (!object.isInstancedMesh) {
    target.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    return;
  }
  const local = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  for (let index = 0; index < object.count; index += 1) {
    object.getMatrixAt(index, local);
    world.multiplyMatrices(object.matrixWorld, local);
    target.union(object.geometry.boundingBox.clone().applyMatrix4(world));
  }
}

function boundsAudit(bounds) {
  if (bounds.isEmpty()) return null;
  const size = bounds.getSize(new THREE.Vector3());
  return {
    min: bounds.min.toArray(),
    max: bounds.max.toArray(),
    sizeM: size.toArray(),
    volumeM3: size.x * size.y * size.z,
  };
}

function inspectActualRidgeGeometry(roof) {
  const ridgeCounts = {
    principalRidge: 0,
    wallAbutment: 0,
    vergeClosure: 0,
    endClosure: 0,
    verticalRidge: 0,
    verticalRidgeEndClosure: 0,
  };
  const ridgeBounds = new THREE.Box3();
  const sections = new Map();
  let ridgeDrawCount = 0;
  let ridgeGeometryCount = 0;
  const sectionFor = (id) => {
    if (!sections.has(id)) {
      sections.set(id, {
        sectionId: id,
        counts: {
          principalRidge: 0,
          wallAbutment: 0,
          vergeClosure: 0,
          endClosure: 0,
          verticalRidge: 0,
          verticalRidgeEndClosure: 0,
        },
        verticalRidgeRuns: new Set(),
        bounds: new THREE.Box3(),
      });
    }
    return sections.get(id);
  };
  roof.traverse((object) => {
    const semantic = object.userData?.ridgeSemantic;
    if (!object.isMesh || !object.geometry || !semantic) return;
    const multiplier = object.isInstancedMesh ? object.count : 1;
    const section = sectionFor(object.userData.sectionId || 'unassigned');
    ridgeDrawCount += 1;
    ridgeGeometryCount += multiplier;
    ridgeCounts[semantic] = (ridgeCounts[semantic] || 0) + multiplier;
    section.counts[semantic] = (section.counts[semantic] || 0) + multiplier;
    appendObjectWorldBounds(ridgeBounds, object);
    appendObjectWorldBounds(section.bounds, object);
    if (semantic === 'verticalRidge') {
      const instances = object.userData.instanceMap || [];
      if (instances.length) {
        instances.forEach((entry) => section.verticalRidgeRuns.add(`${entry.slopeId}:${entry.edge}`));
      } else {
        section.verticalRidgeRuns.add(object.uuid);
      }
    }
  });
  return {
    evidenceSource: 'actual-ridge-meshes-instance-matrices-and-world-bounds',
    ridgeCounts,
    ridgeDrawCount,
    ridgeGeometryCount,
    bounds: boundsAudit(ridgeBounds),
    sections: [...sections.values()].map((section) => ({
      sectionId: section.sectionId,
      counts: section.counts,
      verticalRidgeRunCount: section.verticalRidgeRuns.size,
      bounds: boundsAudit(section.bounds),
    })),
  };
}

function validateComputedSlope(slope, roof, strictTopology) {
  const topology = slope.userData?.tileTopology;
  const audit = slope.userData?.geometryAudit;
  const failures = [];
  const failUnless = (condition, name) => {
    if (!condition) failures.push(name);
  };
  failUnless(Boolean(topology), 'missing-tile-topology');
  failUnless(audit?.evidenceSource === 'actual-instance-matrices-buffer-geometry-and-world-bounds', 'missing-computed-geometry-audit');
  if (!topology || !audit) return { passed: false, failures, audit: audit || null };

  const expectedPitch = Math.abs(topology.drainageVectorLocal?.[1] || 0)
    / Math.max(1e-12, Math.hypot(topology.drainageVectorLocal?.[0] || 0, topology.drainageVectorLocal?.[2] || 0));
  const expectedVerticalComponent = Math.sin(Math.atan(expectedPitch));
  const worldBounds = audit.worldBounds?.all;
  failUnless(audit.rotationComposition === 'Qy*Qx', 'wrong-rotation-composition');
  failUnless(audit.allInstanceMatricesFinite === true && audit.instanceMatrixCount > 0, 'invalid-instance-matrix');
  failUnless(worldBounds?.volumeM3 > 0 && worldBounds.sizeM?.every((value) => value > 0), 'invalid-world-bounds');
  failUnless(audit.panGeometryClosedShell === true, 'pan-geometry-not-closed');
  failUnless(audit.coverGeometryClosedShell === true, 'cover-geometry-not-closed');
  failUnless(audit.panTransverseArcSegments >= 6 && audit.coverTransverseArcSegments >= 6, 'tile-arc-under-segmented');
  failUnless(audit.panGeometryTriangleCount >= 52 && audit.coverGeometryTriangleCount >= 52, 'tile-shell-triangle-count-too-low');
  failUnless(audit.panCrossSectionCurvatureM < 0, 'pan-not-concave');
  failUnless(audit.coverCrossSectionCurvatureM > 0, 'cover-not-convex');
  failUnless(audit.hookHeadFrontPlate === true && audit.hookHeadVertexCount >= 20, 'hook-head-not-physical-front-plate');
  failUnless(Number.isFinite(audit.measuredPitch) && Math.abs(audit.measuredPitch - expectedPitch) <= 1e-6, 'instance-pitch-mismatch');
  failUnless(audit.drainageDirectionDot >= 0.999999, 'instance-drainage-direction-mismatch');
  failUnless(audit.minTileSlopeAlignment >= 0.999, 'tile-instance-not-aligned-to-slope');
  failUnless(Number.isFinite(audit.minTileVerticalComponent)
    && Math.abs(audit.minTileVerticalComponent - expectedVerticalComponent) <= 1e-6, 'tile-vertical-component-mismatch');
  failUnless(audit.courseSpacingSampleCount > 0, 'missing-course-spacing-samples');
  failUnless(audit.longitudinalOverlapM > 0, 'non-positive-longitudinal-overlap');
  failUnless(audit.dripInstanceCount === topology.panColumns, 'drip-column-count-mismatch');
  failUnless(audit.hookHeadInstanceCount === topology.coverColumns, 'hook-column-count-mismatch');
  failUnless(audit.verticalRidgeTileInstanceCount >= topology.courseCount * 2, 'missing-discrete-vertical-ridge-tiles');
  failUnless(audit.drainagePathCount === topology.panColumns, 'drainage-path-count-mismatch');
  failUnless(audit.monotonicDrainagePathCount === audit.drainagePathCount && audit.minimumCourseFallM > 0, 'non-monotonic-instance-drainage');
  failUnless(audit.eaveTerminationCount === audit.drainagePathCount, 'drainage-path-does-not-reach-eave');
  failUnless(audit.eaveCrossAlignmentMaxErrorM <= 1e-6, 'drip-not-aligned-with-pan-channel');
  failUnless(topology.tileBatchesAreInstanced === true, 'tile-batch-not-instanced');

  if (strictTopology) {
    failUnless(topology.coverColumns === topology.panColumns - 1, 'cover-column-count-not-pan-minus-one');
    failUnless(audit.seamSampleCount > 0, 'missing-seam-matrix-samples');
    failUnless(audit.seamAlignmentMaxErrorM <= 1e-6, 'cover-not-centered-on-pan-seam');
    failUnless(audit.coverCourseOffsetMaxM <= 1e-6, 'cover-course-shifted-down-slope');
  }

  const entries = (roof.userData.instanceMap || []).filter((entry) => entry.slopeId === slope.userData.slopeId);
  const localDamage = entries.filter((entry) => entry.state === 'missing' || entry.state === 'broken');
  const localRepair = entries.filter((entry) => entry.state === 'repair');
  failUnless(slope.userData.damagePatch?.tileCount === localDamage.length, 'damage-patch-count-not-slope-local');
  failUnless(slope.userData.repairPatch?.tileCount === localRepair.length, 'repair-patch-count-not-slope-local');
  failUnless((slope.userData.damagePatch?.tileIds || []).every((id) => localDamage.some((entry) => entry.tileId === id)), 'damage-patch-contains-foreign-tile');
  failUnless((slope.userData.repairPatch?.tileIds || []).every((id) => localRepair.some((entry) => entry.tileId === id)), 'repair-patch-contains-foreign-tile');
  return {
    slopeId: slope.userData.slopeId,
    sectionId: slope.userData.sectionId,
    sectionRotationY: slope.userData.sectionRotationY,
    passed: failures.length === 0,
    failures,
    expectedPitch,
    measuredPitch: audit.measuredPitch,
    expectedTileVerticalComponent: expectedVerticalComponent,
    minTileVerticalComponent: audit.minTileVerticalComponent,
    minTileSlopeAlignment: audit.minTileSlopeAlignment,
    drainageDirectionDot: audit.drainageDirectionDot,
    seamAlignmentMaxErrorM: audit.seamAlignmentMaxErrorM,
    coverCourseOffsetMaxM: audit.coverCourseOffsetMaxM,
    longitudinalOverlapM: audit.longitudinalOverlapM,
    drainagePathCount: audit.drainagePathCount,
    verticalRidgeTileInstanceCount: audit.verticalRidgeTileInstanceCount,
    hookHeadDimensionsM: audit.hookHeadDimensionsM,
    hookHeadVertexCount: audit.hookHeadVertexCount,
    tileGeometry: {
      panVertices: audit.panGeometryVertexCount,
      panTriangles: audit.panGeometryTriangleCount,
      panArcSegments: audit.panTransverseArcSegments,
      coverVertices: audit.coverGeometryVertexCount,
      coverTriangles: audit.coverGeometryTriangleCount,
      coverArcSegments: audit.coverTransverseArcSegments,
    },
    worldBounds: audit.worldBounds,
    damagePatchCount: localDamage.length,
    repairPatchCount: localRepair.length,
  };
}

export function registerYunnanRoofSurfaces(root, profile = {}) {
  root.updateMatrixWorld(true);
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
    const slopeAudits = slopes.map((slope) => validateComputedSlope(slope, roof, strictTopology));
    const topologyValid = slopes.length > 0 && slopeAudits.every((audit) => audit.passed);
    const patchTotals = slopeAudits.reduce((total, audit) => ({
      damageTiles: total.damageTiles + audit.damagePatchCount,
      repairTiles: total.repairTiles + audit.repairPatchCount,
    }), { damageTiles: 0, repairTiles: 0 });
    const patchTotalsValid = patchTotals.damageTiles === (roof.userData.damage?.missingTiles || 0) + (roof.userData.damage?.brokenTiles || 0)
      && patchTotals.repairTiles === (roof.userData.repairs?.tiles || 0);
    const ridgeGeometryAudit = inspectActualRidgeGeometry(roof);
    const ridgeTopology = roof.userData.ridgeTopology || [];
    const ridgeTopologyBySection = new Map(ridgeTopology.map((section) => [section.sectionId, section]));
    const sectionRidgeAudits = ridgeGeometryAudit.sections.map((actual) => {
      const contract = ridgeTopologyBySection.get(actual.sectionId);
      const failures = [];
      const failUnless = (condition, name) => {
        if (!condition) failures.push(name);
      };
      failUnless(Boolean(contract), 'missing-ridge-section-contract');
      if (contract) {
        failUnless(actual.bounds?.volumeM3 > 0 && actual.bounds.sizeM?.every((value) => value > 0), 'ridge-section-has-no-world-bounds');
        failUnless(actual.counts.vergeClosure >= 2, 'missing-verge-closures');
        failUnless(actual.counts.endClosure === 2, 'ridge-end-closure-count-mismatch');
        failUnless(contract.roofForm === 'gable'
          ? actual.counts.principalRidge === 1 && actual.counts.wallAbutment === 0
          : actual.counts.wallAbutment === 1 && actual.counts.principalRidge === 0, 'roof-form-ridge-mismatch');
        failUnless(contract.verticalRidgeApplicable === true, 'vertical-ridge-applicability-not-derived');
        failUnless(actual.counts.verticalRidge > 0, 'missing-vertical-ridge-geometry');
        failUnless(actual.verticalRidgeRunCount === contract.verticalRidgeRunCount, 'vertical-ridge-run-count-mismatch');
        failUnless(actual.counts.verticalRidge === contract.verticalRidgeCount, 'vertical-ridge-tile-count-mismatch');
        failUnless(actual.counts.verticalRidgeEndClosure === contract.verticalRidgeEndClosureCount, 'vertical-ridge-end-closure-count-mismatch');
        failUnless(contract.geometryAudit?.evidenceSource === 'actual-ridge-geometry-instance-matrices-and-world-bounds', 'missing-ridge-geometry-audit');
      }
      return {
        ...actual,
        roofForm: contract?.roofForm,
        verticalRidgeRequirement: contract?.verticalRidgeReason,
        passed: failures.length === 0,
        failures,
      };
    });
    const ridgeValid = ridgeTopology.length === roof.userData.sectionCount
      && sectionRidgeAudits.length === roof.userData.sectionCount
      && sectionRidgeAudits.every((audit) => audit.passed)
      && ridgeGeometryAudit.bounds?.volumeM3 > 0;
    const stats = roofStats(roof);
    const layerCounts = layerGeometryCounts(roof);
    const allLayersHaveOwnGeometryIds = ROOF_BUILD_UP.every((id) => layerCounts[id] > 0);
    const check = {
      roofUnitId: roof.userData.roofUnitId,
      sectionCount: roof.userData.sectionCount,
      slopeCount: slopes.length,
      missingLayers,
      topologyValid,
      ridgeValid,
      ridgeCounts: ridgeGeometryAudit.ridgeCounts,
      ridgeGeometryCount: ridgeGeometryAudit.ridgeGeometryCount,
      ridgeDrawCount: ridgeGeometryAudit.ridgeDrawCount,
      ridgeBoundsM: ridgeGeometryAudit.bounds?.sizeM || [0, 0, 0],
      ridgeTopology: ridgeTopology.map((section) => ({ ...section })),
      ridgeGeometryAudit,
      sectionRidgeAudits,
      slopeAudits,
      patchTotals,
      patchTotalsValid,
      layerCounts,
      allLayersHaveOwnGeometryIds,
      rotationComposition: roof.userData.rotationComposition,
      hasRealGeometry: stats.meshCount > 0 && stats.instanceCount > 0,
      stats,
    };
    check.passed = missingLayers.length === 0
      && allLayersHaveOwnGeometryIds
      && check.slopeCount > 0
      && check.hasRealGeometry
      && topologyValid
      && patchTotalsValid
      && ridgeValid;
    roof.userData.validation = check;
    return check;
  });
  const complete = missingRoofUnitIds.length === 0
    && duplicateRoofUnitIds.length === 0
    && roofs.length === ROOF_UNITS.length
    && unitChecks.every((check) => check.passed);
  root.userData.roofSurfaceSystem = {
    version: '5.5.0',
    evidenceSource: 'actual-geometry-instance-matrices-and-world-bounds',
    rotationComposition: 'Qy*Qx',
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
  root.userData.roofGeometryDiagnostics = {
    version: '5.5.0',
    evidenceSource: 'actual-geometry-instance-matrices-and-world-bounds',
    rotationComposition: 'Qy*Qx',
    roofUnitCount: roofs.length,
    allRoofUnitsPassed: complete,
    units: unitChecks.map((check) => ({
      roofUnitId: check.roofUnitId,
      rotationComposition: check.rotationComposition,
      layerCounts: { ...check.layerCounts },
      patchTotals: { ...check.patchTotals },
      patchTotalsValid: check.patchTotalsValid,
      slopeAudits: check.slopeAudits.map((audit) => ({ ...audit })),
      ridgeGeometryAudit: { ...check.ridgeGeometryAudit },
      sectionRidgeAudits: check.sectionRidgeAudits.map((audit) => ({ ...audit })),
    })),
  };
  if (!complete) {
    throw new Error(`V5.5 roof contract failed: ${JSON.stringify({
      missingRoofUnitIds,
      duplicateRoofUnitIds,
      failedUnits: unitChecks.filter((check) => !check.passed).map((check) => ({
        roofUnitId: check.roofUnitId,
        missingLayers: check.missingLayers,
        layerCounts: check.layerCounts,
        ridgeValid: check.ridgeValid,
        failedSlopes: check.slopeAudits.filter((audit) => !audit.passed),
        failedRidgeSections: check.sectionRidgeAudits.filter((audit) => !audit.passed),
      })),
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
