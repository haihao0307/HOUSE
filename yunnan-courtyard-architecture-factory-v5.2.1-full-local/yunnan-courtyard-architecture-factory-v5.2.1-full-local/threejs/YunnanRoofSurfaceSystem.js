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

export const ROOF_SLOPE_COUNTS = Object.freeze({
  mainHouseDoublePitch: 2,
  leftEarAsymmetricDoublePitch: 2,
  rightEarAsymmetricDoublePitch: 2,
  entranceBlockDoublePitch: 2,
  mainGalleryLeanTo: 1,
  sideGalleryLeanTo: 3,
  gatehouseSmallRoof: 2,
});

const EXPECTED_TOTAL_SLOPE_COUNT = Object.values(ROOF_SLOPE_COUNTS)
  .reduce((sum, count) => sum + count, 0);

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

function forEachActualInstance(object, callback) {
  const count = object.isInstancedMesh ? object.count : 1;
  const local = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  for (let index = 0; index < count; index += 1) {
    if (object.isInstancedMesh) object.getMatrixAt(index, local);
    else local.identity();
    world.multiplyMatrices(object.matrixWorld, local);
    callback(world, index);
  }
}

function boundsAudit(bounds) {
  if (bounds.isEmpty()) return null;
  const size = bounds.getSize(new THREE.Vector3());
  return {
    min: bounds.min.toArray(),
    max: bounds.max.toArray(),
    centerM: bounds.getCenter(new THREE.Vector3()).toArray(),
    sizeM: size.toArray(),
    volumeM3: size.x * size.y * size.z,
  };
}

function newRidgeTransformAudit() {
  return {
    instanceCount: 0,
    finiteMatrixCount: 0,
    geometryBackedCount: 0,
    nonEmptyWorldBoundsCount: 0,
    horizontalRunCount: 0,
    horizontalRunDirectionCount: 0,
    horizontalRunSpanAlignedCount: 0,
    slopedRunCount: 0,
    slopedRunDirectionCount: 0,
    slopedRunAcrossSpanCount: 0,
    vergeRunCount: 0,
    vergeRunDownhillCount: 0,
    slopedVerticalComponentMin: null,
    slopedVerticalComponentMax: null,
  };
}

function appendRidgeTransformAudit(audit, object, semantic, expectedSpanDirection) {
  if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
  const position = object.geometry.getAttribute('position');
  const triangleCount = object.geometry.index
    ? object.geometry.index.count / 3
    : (position?.count || 0) / 3;
  const hasGeometry = (position?.count || 0) > 0
    && triangleCount > 0
    && object.geometry.boundingBox
    && !object.geometry.boundingBox.isEmpty();
  const isHorizontalRun = semantic === 'principalRidge'
    || semantic === 'wallAbutment'
    || semantic === 'highEdgeClosure';
  const isSlopedRun = semantic === 'vergeClosure'
    || semantic === 'verticalRidge'
    || semantic === 'verticalRidgeEndClosure';
  const axisIndex = semantic === 'vergeClosure' || isHorizontalRun ? 1 : 2;
  forEachActualInstance(object, (world) => {
    audit.instanceCount += 1;
    const finite = world.elements.every(Number.isFinite);
    if (finite) audit.finiteMatrixCount += 1;
    if (hasGeometry) audit.geometryBackedCount += 1;
    if (!finite || !object.geometry.boundingBox) return;
    const instanceBounds = object.geometry.boundingBox.clone().applyMatrix4(world);
    const size = instanceBounds.getSize(new THREE.Vector3());
    if (size.x > 0 && size.y > 0 && size.z > 0) audit.nonEmptyWorldBoundsCount += 1;
    if (!isHorizontalRun && !isSlopedRun) return;
    const axis = new THREE.Vector3().setFromMatrixColumn(world, axisIndex);
    if (!(axis.lengthSq() > 0)) return;
    axis.normalize();
    const verticalComponent = Math.abs(axis.y);
    if (isHorizontalRun) {
      audit.horizontalRunCount += 1;
      if (verticalComponent <= 1e-6) audit.horizontalRunDirectionCount += 1;
      if (Math.abs(axis.dot(expectedSpanDirection)) >= 0.999999) audit.horizontalRunSpanAlignedCount += 1;
    }
    if (isSlopedRun) {
      audit.slopedRunCount += 1;
      if (verticalComponent > 0.05 && verticalComponent < 0.95) audit.slopedRunDirectionCount += 1;
      const horizontal = axis.clone().setY(0);
      if (horizontal.lengthSq() > 0
        && Math.abs(horizontal.normalize().dot(expectedSpanDirection)) <= 1e-6) {
        audit.slopedRunAcrossSpanCount += 1;
      }
      if (semantic === 'vergeClosure') {
        audit.vergeRunCount += 1;
        if (axis.y < -0.05) audit.vergeRunDownhillCount += 1;
      }
      audit.slopedVerticalComponentMin = audit.slopedVerticalComponentMin == null
        ? verticalComponent
        : Math.min(audit.slopedVerticalComponentMin, verticalComponent);
      audit.slopedVerticalComponentMax = audit.slopedVerticalComponentMax == null
        ? verticalComponent
        : Math.max(audit.slopedVerticalComponentMax, verticalComponent);
    }
  });
}

function inspectActualRidgeGeometry(roof) {
  const ridgeCounts = {
    principalRidge: 0,
    wallAbutment: 0,
    highEdgeClosure: 0,
    vergeClosure: 0,
    endClosure: 0,
    verticalRidge: 0,
    verticalRidgeEndClosure: 0,
  };
  const ridgeBounds = new THREE.Box3();
  const sections = new Map();
  const sectionSpanDirections = new Map();
  roof.traverse((object) => {
    if (object.userData?.type !== 'roof-section') return;
    const rotationY = Number(object.userData?.sectionTransform?.rotationY || 0);
    sectionSpanDirections.set(
      object.userData.sectionId,
      new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY).normalize(),
    );
  });
  let ridgeDrawCount = 0;
  let ridgeGeometryCount = 0;
  const sectionFor = (id) => {
    if (!sections.has(id)) {
      sections.set(id, {
        sectionId: id,
        counts: {
          principalRidge: 0,
          wallAbutment: 0,
          highEdgeClosure: 0,
          vergeClosure: 0,
          endClosure: 0,
          verticalRidge: 0,
          verticalRidgeEndClosure: 0,
        },
        verticalRidgeRuns: new Set(),
        bounds: new THREE.Box3(),
        semanticBounds: Object.fromEntries(Object.keys(ridgeCounts).map((semantic) => [semantic, new THREE.Box3()])),
        transformAudit: newRidgeTransformAudit(),
        expectedSpanDirection: sectionSpanDirections.get(id) || new THREE.Vector3(1, 0, 0),
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
    appendObjectWorldBounds(section.semanticBounds[semantic], object);
    appendRidgeTransformAudit(section.transformAudit, object, semantic, section.expectedSpanDirection);
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
      semanticBounds: Object.fromEntries(Object.entries(section.semanticBounds)
        .map(([semantic, bounds]) => [semantic, boundsAudit(bounds)])),
      transformAudit: {
        ...section.transformAudit,
        expectedSpanDirectionWorld: section.expectedSpanDirection.toArray(),
      },
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

  const requiredArcSegments = Math.max(5, Math.round(Number(roof.userData?.tileArcSegments) || 6));
  const minimumClosedShellTriangles = requiredArcSegments * 8 + 4;

  const expectedPitch = Math.abs(topology.drainageVectorLocal?.[1] || 0)
    / Math.max(1e-12, Math.hypot(topology.drainageVectorLocal?.[0] || 0, topology.drainageVectorLocal?.[2] || 0));
  const expectedVerticalComponent = Math.sin(Math.atan(expectedPitch));
  const worldBounds = audit.worldBounds?.all;
  failUnless(audit.rotationComposition === 'Qy*Qx', 'wrong-rotation-composition');
  failUnless(audit.allInstanceMatricesFinite === true && audit.instanceMatrixCount > 0, 'invalid-instance-matrix');
  failUnless(worldBounds?.volumeM3 > 0 && worldBounds.sizeM?.every((value) => value > 0), 'invalid-world-bounds');
  failUnless(audit.panGeometryClosedShell === true, 'pan-geometry-not-closed');
  failUnless(audit.coverGeometryClosedShell === true, 'cover-geometry-not-closed');
  failUnless(audit.panTransverseArcSegments === requiredArcSegments
    && audit.coverTransverseArcSegments === requiredArcSegments, 'tile-arc-segment-profile-mismatch');
  failUnless(audit.panGeometryTriangleCount >= minimumClosedShellTriangles
    && audit.coverGeometryTriangleCount >= minimumClosedShellTriangles, 'tile-shell-triangle-count-too-low');
  failUnless(audit.panCrossSectionCurvatureM < 0, 'pan-not-concave');
  failUnless(audit.coverCrossSectionCurvatureM > 0, 'cover-not-convex');
  failUnless(Number.isFinite(audit.panCrossSectionRiseM)
    && Math.abs(audit.panCrossSectionCurvatureM + audit.panCrossSectionRiseM) <= 1e-6,
  'pan-rise-not-backed-by-geometry');
  failUnless(Number.isFinite(audit.coverCrossSectionRiseM)
    && Math.abs(audit.coverCrossSectionCurvatureM - audit.coverCrossSectionRiseM) <= 1e-6,
  'cover-rise-not-backed-by-geometry');
  failUnless(Number.isFinite(audit.panUnderlayClearanceM) && audit.panUnderlayClearanceM > 0.002,
    'pan-shell-buried-in-underlay');
  failUnless(Number.isFinite(audit.coverUnderlayClearanceM) && audit.coverUnderlayClearanceM > 0.002,
    'cover-shell-buried-in-underlay');
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
    panUnderlayClearanceM: audit.panUnderlayClearanceM,
    coverUnderlayClearanceM: audit.coverUnderlayClearanceM,
    normalProjectionEvidence: audit.normalProjectionEvidence,
    tileGeometry: {
      requiredArcSegments,
      minimumClosedShellTriangles,
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
        failUnless(actual.transformAudit.instanceCount > 0
          && actual.transformAudit.finiteMatrixCount === actual.transformAudit.instanceCount,
          'ridge-instance-matrix-invalid');
        failUnless(actual.transformAudit.geometryBackedCount === actual.transformAudit.instanceCount,
          'ridge-instance-missing-buffer-geometry');
        failUnless(actual.transformAudit.nonEmptyWorldBoundsCount === actual.transformAudit.instanceCount,
          'ridge-instance-has-empty-world-bounds');
        failUnless(actual.transformAudit.horizontalRunCount > 0
          && actual.transformAudit.horizontalRunDirectionCount === actual.transformAudit.horizontalRunCount,
          'ridge-or-abutment-long-axis-not-horizontal');
        failUnless(actual.transformAudit.horizontalRunSpanAlignedCount === actual.transformAudit.horizontalRunCount,
          'ridge-or-abutment-not-aligned-to-section-span');
        failUnless(actual.transformAudit.slopedRunCount > 0
          && actual.transformAudit.slopedRunDirectionCount === actual.transformAudit.slopedRunCount,
          'verge-or-vertical-ridge-long-axis-not-sloped');
        failUnless(actual.transformAudit.slopedRunAcrossSpanCount === actual.transformAudit.slopedRunCount,
          'verge-or-vertical-ridge-not-across-section-span');
        failUnless(actual.transformAudit.vergeRunCount > 0
          && actual.transformAudit.vergeRunDownhillCount === actual.transformAudit.vergeRunCount,
          'verge-long-axis-not-directed-ridge-to-eave');
        failUnless(actual.counts.vergeClosure >= 2, 'missing-verge-closures');
        failUnless(actual.counts.endClosure === 2, 'ridge-end-closure-count-mismatch');
        failUnless(
          actual.counts.principalRidge === contract.principalRidgeCount
          && actual.counts.wallAbutment === contract.wallAbutmentCount
          && actual.counts.highEdgeClosure === contract.highEdgeClosureCount
          && actual.counts.principalRidge + actual.counts.wallAbutment + actual.counts.highEdgeClosure === 1,
          'roof-form-ridge-mismatch',
        );
        failUnless(
          contract.roofForm === 'gable'
            ? actual.counts.principalRidge === 1
              && actual.counts.wallAbutment === 0
              && actual.counts.highEdgeClosure === 0
            : actual.counts.principalRidge === 0
              && actual.counts.wallAbutment + actual.counts.highEdgeClosure === 1,
          'ridge-semantic-does-not-match-independent-roof-form',
        );
        failUnless(
          contract.wallAbutmentCount === 0 || Boolean(contract.abutmentHostComponentId),
          'wall-abutment-missing-explicit-host',
        );
        failUnless(
          contract.highEdgeClosureCount === 0 || !contract.abutmentHostComponentId,
          'unhosted-high-edge-closure-declares-wall-host',
        );
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
      expectedSlopeCount: ROOF_SLOPE_COUNTS[roof.userData.roofUnitId],
      slopeCount: slopes.length,
      slopeCountMatchesExpected: slopes.length === ROOF_SLOPE_COUNTS[roof.userData.roofUnitId],
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
      && check.slopeCountMatchesExpected
      && check.hasRealGeometry
      && topologyValid
      && patchTotalsValid
      && ridgeValid;
    roof.userData.validation = check;
    return check;
  });
  const actualTotalSlopeCount = unitChecks.reduce((sum, check) => sum + check.slopeCount, 0);
  const complete = missingRoofUnitIds.length === 0
    && duplicateRoofUnitIds.length === 0
    && roofs.length === ROOF_UNITS.length
    && actualTotalSlopeCount === EXPECTED_TOTAL_SLOPE_COUNT
    && unitChecks.every((check) => check.passed);
  const viewBounds = {
    roof: new THREE.Box3(),
    eave: new THREE.Box3(),
    ridge: new THREE.Box3(),
  };
  roofs.forEach((roof) => roof.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    appendObjectWorldBounds(viewBounds.roof, object);
    if (object.userData?.roofLayerId === 'eaveCapsAndDrips') appendObjectWorldBounds(viewBounds.eave, object);
    if (object.userData?.ridgeSemantic) appendObjectWorldBounds(viewBounds.ridge, object);
  }));
  const viewTargets = Object.fromEntries(Object.entries(viewBounds).map(([name, bounds]) => {
    const audit = boundsAudit(bounds);
    return [name, audit ? {
      evidenceSource: 'actual-buffer-geometry-instance-matrices-and-world-bounds',
      ...audit,
      framingRadiusM: Math.max(...audit.sizeM) * 0.5,
    } : null];
  }));
  const framingTarget = (audit, evidenceSource) => audit ? {
    evidenceSource,
    ...audit,
    centerM: audit.centerM || audit.min.map((value, index) => (value + audit.max[index]) * 0.5),
    framingRadiusM: Math.max(...audit.sizeM) * 0.5,
  } : null;
  const primaryRoof = unitChecks.find((check) => check.roofUnitId === 'mainHouseDoublePitch');
  const galleryLeanToRoof = unitChecks.find((check) => check.roofUnitId === 'mainGalleryLeanTo');
  viewTargets.primaryEaveCloseup = framingTarget(
    primaryRoof?.slopeAudits?.[0]?.worldBounds?.eaveDetail,
    'actual-main-roof-central-five-columns-last-three-courses-and-eave-instances',
  );
  viewTargets.primaryRidgeCloseup = framingTarget(
    primaryRoof?.sectionRidgeAudits?.[0]?.semanticBounds?.principalRidge,
    'actual-main-roof-principal-ridge-instance-matrices-and-world-bounds',
  );
  viewTargets.leanToWallAbutmentCloseup = framingTarget(
    galleryLeanToRoof?.sectionRidgeAudits?.find((audit) => audit.semanticBounds?.wallAbutment)?.semanticBounds?.wallAbutment,
    'actual-main-gallery-lean-to-wall-abutment-instance-matrices-and-world-bounds',
  );
  root.userData.roofSurfaceSystem = {
    version: '5.5.0',
    evidenceSource: 'actual-geometry-instance-matrices-and-world-bounds',
    rotationComposition: 'Qy*Qx',
    expectedRoofUnitIds: [...ROOF_UNITS],
    expectedSlopeCounts: { ...ROOF_SLOPE_COUNTS },
    expectedTotalSlopeCount: EXPECTED_TOTAL_SLOPE_COUNT,
    actualTotalSlopeCount,
    actualRoofUnitIds: roofs.map((roof) => roof.userData.roofUnitId),
    roofUnitCount: roofs.length,
    missingRoofUnitIds,
    duplicateRoofUnitIds,
    buildUp: [...ROOF_BUILD_UP],
    profileId: profile.id || 'museum1940sBalanced',
    strictTopology,
    complete,
    viewTargets,
    unitChecks,
  };
  root.userData.roofGeometryDiagnostics = {
    version: '5.5.0',
    evidenceSource: 'actual-geometry-instance-matrices-and-world-bounds',
    rotationComposition: 'Qy*Qx',
    roofUnitCount: roofs.length,
    expectedSlopeCounts: { ...ROOF_SLOPE_COUNTS },
    expectedTotalSlopeCount: EXPECTED_TOTAL_SLOPE_COUNT,
    actualTotalSlopeCount,
    allRoofUnitsPassed: complete,
    viewTargets,
    units: unitChecks.map((check) => ({
      roofUnitId: check.roofUnitId,
      rotationComposition: check.rotationComposition,
      layerCounts: { ...check.layerCounts },
      expectedSlopeCount: check.expectedSlopeCount,
      slopeCount: check.slopeCount,
      slopeCountMatchesExpected: check.slopeCountMatchesExpected,
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
  const distance = typeof enabledOrDistance === 'number' ? Math.max(0, enabledOrDistance) : enabledOrDistance ? 0.42 : 0;
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
