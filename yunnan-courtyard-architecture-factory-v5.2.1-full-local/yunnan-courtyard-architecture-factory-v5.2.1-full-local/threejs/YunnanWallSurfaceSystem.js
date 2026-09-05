import * as THREE from 'three';

export const WALL_LAYERS = Object.freeze([
  'structure', 'plaster', 'exposedEarth', 'strawFibre', 'stonePlinth', 'brickCorner',
  'risingDamp', 'verticalRainStreak', 'surfaceLoss', 'crackNetwork', 'repairPatch', 'sootAndDirt',
]);

const UP = new THREE.Vector3(0, 1, 0);
const GRAVITY = new THREE.Vector3(0, -1, 0);

function clamp01(value) {
  return THREE.MathUtils.clamp(Number(value), 0, 1);
}
function seeded01(a, b, c = 0) {
  const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function makeMaterial(color, roughness = 0.92, opacity = 1, vertexColors = false) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    transparent: opacity < 1,
    opacity,
    vertexColors,
    side: THREE.DoubleSide,
    depthWrite: opacity >= 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  // These weathering overlays are geometrically thin and intentionally visible
  // from either side.  A transparent DoubleSide material otherwise renders two
  // passes in three.js, doubling their draw cost without changing the evidence.
  material.forceSinglePass = material.transparent && material.side === THREE.DoubleSide;
  return material;
}

function ownMaterial(system, item) {
  system.userData.ownedMaterials.push(item);
  return item;
}

function tintedMaterial(system, color, toward, amount, roughness, opacity = 1, vertexColors = false) {
  const tint = new THREE.Color(color).lerp(new THREE.Color(toward), clamp01(amount));
  return ownMaterial(system, makeMaterial(tint, roughness, opacity, vertexColors));
}

function layerGroup(id, category) {
  const group = new THREE.Group();
  group.name = `wallLayer_${id}`;
  group.userData = { type: 'wall-surface-layer', wallLayerId: id, wallLayerCategory: category };
  return group;
}

function addTagged(layer, item, type, data = {}) {
  item.userData = { ...(item.userData || {}), type, wallLayerId: layer.userData.wallLayerId, ...data };
  layer.add(item);
  return item;
}

const STATIC_BATCH_LAYER_IDS = Object.freeze([
  'structure', 'plaster', 'exposedEarth', 'stonePlinth', 'risingDamp',
  'verticalRainStreak', 'surfaceLoss', 'repairPatch', 'sootAndDirt',
]);

function enableBatchedVertexAlpha(material) {
  material.customProgramCacheKey = () => 'yunnan-wall-static-rgb-plus-alpha-batch-v2';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <color_pars_vertex>',
        '#include <color_pars_vertex>\nattribute float wallBatchAlpha;\nvarying float vWallBatchAlpha;',
      )
      .replace(
        '#include <color_vertex>',
        '#include <color_vertex>\nvWallBatchAlpha=wallBatchAlpha;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <color_pars_fragment>',
        '#include <color_pars_fragment>\nvarying float vWallBatchAlpha;',
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.a*=vWallBatchAlpha;',
      );
    material.userData.wallBatchCompiledShaderEvidence = {
      revision: 'yunnan-wall-static-rgb-plus-alpha-batch-v2',
      vertexAlphaAttribute: shader.vertexShader.includes('attribute float wallBatchAlpha'),
      fragmentAlphaApplied: shader.fragmentShader.includes('diffuseColor.a*=vWallBatchAlpha'),
      vertexColorAlphaSeparated: true,
      evidenceSource: 'actual-onBeforeCompile-transformed-shader-source',
    };
  };
  material.userData = {
    ...(material.userData || {}),
    wallBatchShaderRevision: 'yunnan-wall-static-rgb-plus-alpha-batch-v2',
  };
  material.needsUpdate = true;
  return material;
}

function batchedWallMaterial(system, layerId, sources) {
  const sourceMaterials = sources.flatMap((source) => (
    Array.isArray(source.material) ? source.material : [source.material]
  )).filter(Boolean);
  const transparent = sourceMaterials.some((material) => material.transparent || Number(material.opacity) < 1);
  const roughness = average(sourceMaterials.map((material) => Number(material.roughness)).filter(Number.isFinite));
  let material;
  if (layerId === 'structure') {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 1,
      vertexColors: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  } else {
    material = makeMaterial(0xffffff, roughness || 0.96, 1, true);
    material.transparent = transparent;
    material.depthWrite = !transparent;
  }
  material.forceSinglePass = material.transparent && material.side === THREE.DoubleSide;
  return ownMaterial(system, enableBatchedVertexAlpha(material));
}

function batchStaticWallLayer(system, group, layerId) {
  const sources = group.children.filter((child) => child.isMesh && child.geometry);
  if (!sources.length) return null;
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const alphas = [];
  const indices = [];
  const logicalPatches = [];
  let vertexOffset = 0;
  let triangleCount = 0;
  let sourceVertexCount = 0;
  const sourceLocalBounds = new THREE.Box3();

  sources.forEach((source) => {
    if (source.matrixAutoUpdate) source.updateMatrix();
    const geometry = source.geometry;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const matrix = source.matrix;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const point = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const material = Array.isArray(source.material) ? source.material[0] : source.material;
    const color = material?.color || new THREE.Color(0xffffff);
    const alpha = THREE.MathUtils.clamp(Number(material?.opacity ?? 1), 0, 1);
    const vertexStart = vertexOffset;
    const indexStart = indices.length;
    const sourceBounds = new THREE.Box3();
    const transformedPoints = [];
    sourceVertexCount += position.count;
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(matrix);
      transformedPoints.push(point.clone());
      sourceBounds.expandByPoint(point);
      // Accumulate the exact transformed source vertices. Transforming a
      // source AABB would conservatively enlarge rotated crack cylinders and
      // would not be comparable with the merged geometry's tight bounds.
      sourceLocalBounds.expandByPoint(point);
      positions.push(point.x, point.y, point.z);
      if (normal) {
        direction.fromBufferAttribute(normal, index).applyMatrix3(normalMatrix).normalize();
        normals.push(direction.x, direction.y, direction.z);
      } else {
        normals.push(0, 1, 0);
      }
      if (uv) uvs.push(uv.getX(index), uv.getY(index));
      else uvs.push(0, 0);
      // Keep RGB in Three's built-in vertex-color path and opacity in the
      // dedicated scalar attribute below. An RGBA color attribute would make
      // color_fragment multiply alpha once before the custom shader multiplies
      // wallBatchAlpha again, incorrectly squaring every source opacity.
      colors.push(color.r, color.g, color.b);
      alphas.push(alpha);
    }
    if (geometry.index) {
      for (let index = 0; index < geometry.index.count; index += 1) {
        indices.push(vertexOffset + geometry.index.getX(index));
      }
      triangleCount += geometry.index.count / 3;
    } else {
      for (let index = 0; index < position.count; index += 1) indices.push(vertexOffset + index);
      triangleCount += position.count / 3;
    }
    let sourceAreaM2 = 0;
    const triangle = new THREE.Triangle();
    const triangleCountForSource = geometry.index
      ? geometry.index.count / 3 : position.count / 3;
    for (let triangleIndex = 0; triangleIndex < triangleCountForSource; triangleIndex += 1) {
      const ia = geometry.index ? geometry.index.getX(triangleIndex * 3) : triangleIndex * 3;
      const ib = geometry.index ? geometry.index.getX(triangleIndex * 3 + 1) : triangleIndex * 3 + 1;
      const ic = geometry.index ? geometry.index.getX(triangleIndex * 3 + 2) : triangleIndex * 3 + 2;
      sourceAreaM2 += triangle.set(
        transformedPoints[ia], transformedPoints[ib], transformedPoints[ic],
      ).getArea();
    }
    const minY = Math.min(...transformedPoints.map((entry) => entry.y));
    const maxY = Math.max(...transformedPoints.map((entry) => entry.y));
    const tolerance = Math.max(1e-5, (maxY - minY) * 0.03);
    const averageAt = (target) => {
      const selected = transformedPoints.filter((entry) => Math.abs(entry.y - target) <= tolerance);
      return selected.reduce((sum, entry) => sum.add(entry), new THREE.Vector3())
        .multiplyScalar(1 / Math.max(1, selected.length));
    };
    const downward = averageAt(minY).sub(averageAt(maxY));
    logicalPatches.push({
      logicalIndex: logicalPatches.length,
      ...source.userData,
      materialColor: color.toArray(),
      materialOpacity: alpha,
      localBounds: sourceBounds.isEmpty()
        ? null : [...sourceBounds.min.toArray(), ...sourceBounds.max.toArray()],
      transformedAreaM2: sourceAreaM2,
      localDownwardDirection: downward.lengthSq() ? downward.normalize().toArray() : null,
      vertexStart,
      vertexCount: position.count,
      indexStart,
      indexCount: indices.length - indexStart,
    });
    vertexOffset += position.count;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('wallBatchAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const sourceLocalBoundsArray = sourceLocalBounds.isEmpty()
    ? null : [...sourceLocalBounds.min.toArray(), ...sourceLocalBounds.max.toArray()];
  const batchLocalBoundsArray = geometry.boundingBox
    ? [...geometry.boundingBox.min.toArray(), ...geometry.boundingBox.max.toArray()] : null;
  const localBoundsMaxDeltaM = sourceLocalBoundsArray && batchLocalBoundsArray
    ? Math.max(...sourceLocalBoundsArray.map((value, index) => Math.abs(value - batchLocalBoundsArray[index])))
    : null;
  const batchTriangleCount = geometry.index
    ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3;
  const material = batchedWallMaterial(system, layerId, sources);
  const batch = new THREE.Mesh(geometry, material);
  batch.name = `wallStaticBatch_${layerId}`;
  batch.matrixAutoUpdate = false;
  batch.userData = {
    type: 'wall-static-indexed-geometry-batch',
    wallLayerId: layerId,
    wallLayerCategory: group.userData.wallLayerCategory,
    batched: true,
    indexed: true,
    vertexColorChannels: 3,
    logicalPatchCount: logicalPatches.length,
    logicalPatches,
    triangleCount: batchTriangleCount,
    sourceTriangleCount: triangleCount,
    batchTriangleCount,
    sourceVertexCount,
    batchPositionCount: geometry.getAttribute('position').count,
    batchColorCount: geometry.getAttribute('color').count,
    batchColorItemSize: geometry.getAttribute('color').itemSize,
    batchAlphaCount: geometry.getAttribute('wallBatchAlpha').count,
    batchAlphaItemSize: geometry.getAttribute('wallBatchAlpha').itemSize,
    sourceLocalBounds: sourceLocalBoundsArray,
    batchLocalBounds: batchLocalBoundsArray,
    localBoundsMaxDeltaM,
  };
  sources.forEach((source) => {
    source.removeFromParent();
    source.geometry.dispose();
  });
  group.add(batch);
  return batch;
}

function batchStaticWallLayers(system, categoryGroups) {
  const sourceMaterials = new Set();
  STATIC_BATCH_LAYER_IDS.forEach((layerId) => {
    categoryGroups[layerId].traverse((object) => {
      if (Array.isArray(object.material)) object.material.forEach((material) => sourceMaterials.add(material));
      else if (object.material) sourceMaterials.add(object.material);
    });
  });
  const batches = STATIC_BATCH_LAYER_IDS.map((layerId) => (
    batchStaticWallLayer(system, categoryGroups[layerId], layerId)
  )).filter(Boolean);
  const retainedMaterials = new Set();
  system.traverse((object) => {
    if (Array.isArray(object.material)) object.material.forEach((material) => retainedMaterials.add(material));
    else if (object.material) retainedMaterials.add(object.material);
  });
  sourceMaterials.forEach((material) => {
    if (!retainedMaterials.has(material)) material.dispose?.();
  });
  system.userData.ownedMaterials = system.userData.ownedMaterials.filter((material) => (
    !sourceMaterials.has(material) || retainedMaterials.has(material)
  ));
  system.userData.staticBatching = {
    enabled: true,
    layerIds: [...STATIC_BATCH_LAYER_IDS],
    batchCount: batches.length,
    logicalPatchCount: batches.reduce((sum, batch) => sum + batch.userData.logicalPatchCount, 0),
    batches: batches.map((batch) => ({
      layerId: batch.userData.wallLayerId,
      logicalPatchCount: batch.userData.logicalPatchCount,
      triangleCount: batch.userData.triangleCount,
      sourceTriangleCount: batch.userData.sourceTriangleCount,
      batchTriangleCount: batch.userData.batchTriangleCount,
      sourceVertexCount: batch.userData.sourceVertexCount,
      batchPositionCount: batch.userData.batchPositionCount,
      batchColorCount: batch.userData.batchColorCount,
      batchColorItemSize: batch.userData.batchColorItemSize,
      batchAlphaCount: batch.userData.batchAlphaCount,
      batchAlphaItemSize: batch.userData.batchAlphaItemSize,
      sourceLocalBounds: batch.userData.sourceLocalBounds,
      batchLocalBounds: batch.userData.batchLocalBounds,
      localBoundsMaxDeltaM: batch.userData.localBoundsMaxDeltaM,
      indexed: batch.userData.indexed,
      vertexColorChannels: batch.userData.vertexColorChannels,
    })),
  };
  return batches;
}

function disposeSystem(system) {
  const geometries = new Set();
  const materials = new Set(system.userData?.ownedMaterials || []);
  system.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((entry) => materials.add(entry));
    else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((entry) => entry.dispose?.());
}

function hostSpec(host) {
  const dimensions = host.userData?.dimensionsM || {};
  const width = Math.max(0.08, Number(dimensions.width) || 0.08);
  const depth = Math.max(0.08, Number(dimensions.depth) || 0.08);
  const height = Math.max(0.08, Number(dimensions.height) || 0.08);
  const taper = Math.max(0, Number(dimensions.taper) || 0);
  const orientation = width >= depth ? 'x' : 'z';
  return {
    width,
    depth,
    height,
    taper,
    orientation,
    span: orientation === 'x' ? width : depth,
    wallDepth: orientation === 'x' ? depth : width,
  };
}

function facePoint(spec, sign, u, v, offset = 0) {
  const vv = clamp01(v);
  const alongHalf = Math.max(0.01, spec.span / 2 - spec.taper * vv);
  const normalHalf = Math.max(0.01, spec.wallDepth / 2 - spec.taper * vv);
  const along = THREE.MathUtils.lerp(-alongHalf, alongHalf, clamp01(u));
  const normal = sign * (normalHalf + offset);
  return spec.orientation === 'x'
    ? new THREE.Vector3(along, spec.height * vv, normal)
    : new THREE.Vector3(normal, spec.height * vv, along);
}

function irregularContour(centerU, centerV, scaleU, scaleV, patchSeed) {
  const halfU = Math.max(0.006, scaleU / 2);
  const halfV = Math.max(0.006, scaleV / 2);
  const u0 = THREE.MathUtils.clamp(centerU - halfU, 0.015, 0.985);
  const u1 = THREE.MathUtils.clamp(centerU + halfU, 0.015, 0.985);
  const v0 = THREE.MathUtils.clamp(centerV - halfV, 0.012, 0.988);
  const v1 = THREE.MathUtils.clamp(centerV + halfV, 0.012, 0.988);
  const width = Math.max(0.002, u1 - u0);
  const height = Math.max(0.002, v1 - v0);
  const jitter = (index) => 0.65 + seeded01(patchSeed, index, 17) * 0.30;
  return [
    new THREE.Vector2(u0 + width * 0.12 * jitter(0), v0),
    new THREE.Vector2(u1 - width * 0.15 * jitter(1), v0 + height * 0.025),
    new THREE.Vector2(u1, v0 + height * 0.22 * jitter(2)),
    new THREE.Vector2(u1 - width * 0.035, v1 - height * 0.18 * jitter(3)),
    new THREE.Vector2(u1 - width * 0.18 * jitter(4), v1),
    new THREE.Vector2(u0 + width * 0.20 * jitter(5), v1 - height * 0.025),
    new THREE.Vector2(u0, v1 - height * 0.25 * jitter(6)),
    new THREE.Vector2(u0 + width * 0.035, v0 + height * 0.20 * jitter(7)),
  ];
}

function mappedGeometry(spec, sign, contour, offset) {
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const positions = [];
  const uvs = [];
  contour.forEach((uv) => {
    const point = facePoint(spec, sign, uv.x, uv.y, offset);
    positions.push(point.x, point.y, point.z);
    uvs.push(uv.x, uv.y);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(faces.flatMap((face) => face));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function patchMesh(spec, sign, options, mat) {
  const contour = options.contour || irregularContour(
    options.centerU,
    options.centerV,
    options.scaleU,
    options.scaleV,
    options.patchSeed,
  );
  return new THREE.Mesh(mappedGeometry(spec, sign, contour, options.offset || 0), mat);
}

function placeOnHost(item, hostRelativeMatrix, localPosition = null, localQuaternion = null) {
  if (localPosition) item.position.copy(localPosition);
  if (localQuaternion) item.quaternion.copy(localQuaternion);
  item.updateMatrix();
  item.matrix.premultiply(hostRelativeMatrix);
  item.matrixAutoUpdate = false;
  return item;
}

function instanceTransformRecord(hostRelativeMatrix, position, quaternion, scale, semantic = {}) {
  const local = new THREE.Matrix4().compose(position, quaternion, scale);
  return { matrix: hostRelativeMatrix.clone().multiply(local), semantic };
}

function createInstanceBatch(records, geometry, material, data = {}) {
  if (!records.length) return null;
  const batch = new THREE.InstancedMesh(geometry, material, records.length);
  records.forEach((record, index) => batch.setMatrixAt(index, record.matrix));
  batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  batch.instanceMatrix.needsUpdate = true;
  batch.computeBoundingBox();
  batch.computeBoundingSphere();
  batch.userData = {
    ...data,
    instanceCount: records.length,
    instanceMap: records.map((record) => ({ ...record.semantic })),
    geometryEvidence: 'shared-buffer-geometry-with-actual-instance-matrices',
  };
  return batch;
}

/** Merge exact mapped fibre polygons after their host transforms. */
function createStaticPatchBatch(records, material, data = {}) {
  if (!records.length) return null;
  const positions = [];
  const normals = [];
  const uvs = [];
  const geometryMap = [];
  records.forEach((record, recordIndex) => {
    const mapped = record.geometry.clone().applyMatrix4(record.matrix);
    const transformed = mapped.index ? mapped.toNonIndexed() : mapped;
    const position = transformed.getAttribute('position');
    const normal = transformed.getAttribute('normal');
    const uv = transformed.getAttribute('uv');
    const vertexStart = positions.length / 3;
    for (let index = 0; index < position.count; index += 1) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      if (normal) normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
      if (uv) uvs.push(uv.getX(index), uv.getY(index));
    }
    geometryMap.push({
      elementIndex: recordIndex,
      vertexStart,
      vertexCount: position.count,
      ...record.semantic,
    });
    if (transformed !== mapped) mapped.dispose();
    transformed.dispose();
    record.geometry.dispose();
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const batch = new THREE.Mesh(geometry, material);
  batch.userData = {
    ...data,
    semanticElementCount: records.length,
    geometryMap,
    geometryEvidence: 'exact-host-mapped-polygons-statically-merged-by-vertex-range',
  };
  return batch;
}

function polygonArea(geometry) {
  const positions = geometry?.getAttribute?.('position');
  if (!positions) return 0;
  const index = geometry.index;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let area = 0;
  const triangleCount = index ? index.count / 3 : positions.count / 3;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const ia = index ? index.getX(triangle * 3) : triangle * 3;
    const ib = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
    const ic = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;
    a.fromBufferAttribute(positions, ia);
    b.fromBufferAttribute(positions, ib);
    c.fromBufferAttribute(positions, ic);
    area += new THREE.Triangle(a, b, c).getArea();
  }
  return area;
}

function geometryDirectionFromExtrema(object) {
  const positions = object.geometry?.getAttribute?.('position');
  if (!positions?.count) return null;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const bottom = new THREE.Vector3();
  const top = new THREE.Vector3();
  let bottomCount = 0;
  let topCount = 0;
  const epsilon = Math.max(1e-5, (maxY - minY) * 0.02);
  for (let index = 0; index < positions.count; index += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, index);
    if (Math.abs(point.y - minY) <= epsilon) {
      bottom.add(point);
      bottomCount += 1;
    }
    if (Math.abs(point.y - maxY) <= epsilon) {
      top.add(point);
      topCount += 1;
    }
  }
  if (!bottomCount || !topCount) return null;
  bottom.multiplyScalar(1 / bottomCount);
  top.multiplyScalar(1 / topCount);
  const direction = bottom.sub(top);
  object.updateWorldMatrix(true, false);
  return direction.transformDirection(object.matrixWorld).normalize();
}

function materialLuminance(mat) {
  const color = mat?.color;
  return color ? color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722 : 0;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function measureWallSystem(system) {
  const layerCounts = Object.fromEntries(WALL_LAYERS.map((id) => [id, 0]));
  const dampSamples = { bottom: [], middle: [], top: [] };
  const dampHeightRatios = [];
  const rainDots = [];
  const shelteredRain = [];
  const exposedRain = [];
  const rainLoads = [];
  const plasterLuminance = [];
  const plinthOutsets = [];
  const cornerOutsets = [];
  system.updateMatrixWorld(true);
  system.traverse((object) => {
    if (!object.isMesh && !object.isLine) return;
    const layerId = object.userData?.wallLayerId;
    if (layerId in layerCounts) {
      layerCounts[layerId] += object.isInstancedMesh
        ? object.count
        : Math.max(
          1,
          Number(object.userData?.logicalPatchCount)
            || Number(object.userData?.semanticElementCount)
            || 1,
        );
    }
    if (layerId === 'plaster') plasterLuminance.push(materialLuminance(object.material));
    if (layerId === 'risingDamp') {
      const level = object.userData?.dampSampleLevel;
      if (level in dampSamples) dampSamples[level].push(Number(object.material?.opacity) || 0);
      object.geometry?.computeBoundingBox?.();
      const top = object.geometry?.boundingBox?.max?.y;
      const hostHeight = Number(object.userData?.hostHeightM);
      if (Number.isFinite(top) && hostHeight > 0) dampHeightRatios.push(top / hostHeight);
    }
    if (layerId === 'verticalRainStreak') {
      const direction = geometryDirectionFromExtrema(object);
      if (direction) rainDots.push(direction.dot(GRAVITY));
      const hostArea = Math.max(0.01, Number(object.userData?.hostSurfaceAreaM2) || 0.01);
      const load = polygonArea(object.geometry) / hostArea * (Number(object.material?.opacity) || 1);
      rainLoads.push(load);
      if (Number(object.userData?.shelterFactor) >= 0.5) shelteredRain.push(load);
      else exposedRain.push(load);
    }
    if (layerId === 'stonePlinth') {
      object.geometry?.computeBoundingBox?.();
      const size = object.geometry?.boundingBox?.getSize(new THREE.Vector3());
      const normalSize = object.userData?.normalAxis === 'z' ? size?.z : size?.x;
      if (Number.isFinite(normalSize)) plinthOutsets.push(Math.max(0, normalSize - Number(object.userData.hostDepthM || 0)));
    }
    if (layerId === 'brickCorner') {
      const explicitOutset = Number(object.userData?.normalOutsetM);
      if (Number.isFinite(explicitOutset)) {
        cornerOutsets.push(explicitOutset);
        return;
      }
      object.geometry?.computeBoundingBox?.();
      const size = object.geometry?.boundingBox?.getSize(new THREE.Vector3());
      const normalSize = object.userData?.normalAxis === 'z' ? size?.z : size?.x;
      if (Number.isFinite(normalSize)) cornerOutsets.push(Math.max(0, normalSize - Number(object.userData.hostDepthM || 0)));
    }
  });
  const plasterRange = plasterLuminance.length
    ? [Math.min(...plasterLuminance), Math.max(...plasterLuminance)]
    : [0, 0];
  const rainRange = rainLoads.length ? [Math.min(...rainLoads), Math.max(...rainLoads)] : [0, 0];
  return {
    layerCounts,
    dampSamples: Object.fromEntries(Object.entries(dampSamples).map(([key, values]) => [key, average(values)])),
    physics: {
      maxDampHeightRatio: dampHeightRatios.length ? Math.max(...dampHeightRatios) : 0,
      minRainGravityDot: rainDots.length ? Math.min(...rainDots) : 0,
      shelteredRainMean: average(shelteredRain),
      exposedRainMean: average(exposedRain),
      rainStreakCount: rainLoads.length,
      rainLoadRange: rainRange,
      plasterLuminanceRange: plasterRange,
    },
    plinthThicknessM: average(plinthOutsets),
    cornerProtectionThicknessM: average(cornerOutsets),
  };
}

function createEnvironment(root, host, spec, sign, hostIndex, seed, sunDirection) {
  const localNormal = spec.orientation === 'x'
    ? new THREE.Vector3(0, 0, sign)
    : new THREE.Vector3(sign, 0, 0);
  const worldNormal = localNormal.clone().transformDirection(host.matrixWorld).normalize();
  const sunExposure = clamp01(worldNormal.dot(sunDirection));
  const center = host.getWorldPosition(new THREE.Vector3());
  const courtyardDirection = root.getWorldPosition(new THREE.Vector3()).sub(center).setY(0);
  if (courtyardDirection.lengthSq() > 1e-8) courtyardDirection.normalize();
  const courtyardFacing = clamp01(worldNormal.dot(courtyardDirection));
  const eaveProjection = Math.max(0.05, Number(root.userData?.options?.roofEave) || 0.58);
  const eaveRatio = eaveProjection / (eaveProjection + spec.height * 0.18);
  const gablePenalty = /gable/i.test(String(host.userData?.type)) ? 0.22 : 0;
  const shelterFactor = clamp01(0.16 + eaveRatio * 0.54 + courtyardFacing * 0.26 - gablePenalty);
  const drainageSeed = seeded01(seed + hostIndex * 13, sign, 41);
  const drainageMoisture = clamp01(0.24 + (1 - sunExposure) * 0.34 + (1 - shelterFactor) * 0.24 + drainageSeed * 0.18);
  return { worldNormal, sunExposure, courtyardFacing, shelterFactor, drainageMoisture };
}

export function applyYunnanWallSurfaces(
  root,
  profile = {},
  { seed = 401, sunDirection = [-0.48, 0.76, -0.43] } = {},
) {
  const old = root.getObjectByName('V550_wall_surface_system');
  if (old) {
    old.removeFromParent();
    disposeSystem(old);
  }
  const system = new THREE.Group();
  system.name = 'V550_wall_surface_system';
  system.userData = {
    type: 'wall-surface-production',
    profileId: profile.id,
    layers: [...WALL_LAYERS],
    gravityConstrained: true,
    eaveSheltered: true,
    ownedMaterials: [],
  };
  const categoryGroups = {
    structure: layerGroup('structure', 'structure'),
    plaster: layerGroup('plaster', 'material'),
    exposedEarth: layerGroup('exposedEarth', 'material'),
    strawFibre: layerGroup('strawFibre', 'material'),
    stonePlinth: layerGroup('stonePlinth', 'material'),
    brickCorner: layerGroup('brickCorner', 'material'),
    risingDamp: layerGroup('risingDamp', 'historic'),
    verticalRainStreak: layerGroup('verticalRainStreak', 'historic'),
    surfaceLoss: layerGroup('surfaceLoss', 'historic'),
    crackNetwork: layerGroup('crackNetwork', 'historic'),
    repairPatch: layerGroup('repairPatch', 'historic'),
    sootAndDirt: layerGroup('sootAndDirt', 'historic'),
  };
  Object.values(categoryGroups).forEach((group) => system.add(group));
  root.add(system);
  if (!profile.enabled) {
    system.visible = false;
    Object.assign(system.userData, measureWallSystem(system), { hostCount: 0, groundHostCount: 0 });
    return system;
  }

  const wallProfile = profile.wall || {};
  const plasterCoverage = clamp01(wallProfile.plasterCoverage ?? 0.64);
  const earthExposure = clamp01(wallProfile.earthExposure ?? 0.30);
  const dampAmount = clamp01(wallProfile.dampBand ?? 0.44);
  const rainAmount = clamp01(wallProfile.verticalRainWash ?? 0.34);
  const lossAmount = clamp01(wallProfile.surfaceLoss ?? 0.22);
  const crackAmount = clamp01(wallProfile.crackNetwork ?? 0.18);
  const repairAmount = clamp01(wallProfile.repairPatches ?? 0.14);
  const sootAmount = clamp01(wallProfile.sootAndDirt ?? 0.12);
  const roughness = clamp01(wallProfile.roughness ?? 0.88);
  const sun = new THREE.Vector3().fromArray(sunDirection).normalize();
  const shared = {
    structure: ownMaterial(system, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.035 })),
    stone: ownMaterial(system, makeMaterial(0x68685f, 0.98, 1)),
    brick: ownMaterial(system, makeMaterial(0x704b3a, 0.94, 1)),
    fibre: ownMaterial(system, makeMaterial(0xc3a46b, 0.92, 1)),
    crack: ownMaterial(system, makeMaterial(0x352f29, 1, 1)),
  };
  shared.structure.forceSinglePass = true;
  const hosts = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object.isMesh && object.userData?.semanticRole === 'wall-core') hosts.push(object);
  });
  const hostBounds = hosts.map((host) => new THREE.Box3().setFromObject(host));
  const groundBaseY = hostBounds.length ? Math.min(...hostBounds.map((bounds) => bounds.min.y)) : 0;
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const excludedGroundLayerHostIds = [];
  let groundHostCount = 0;
  const unitBrickGeometry = new THREE.BoxGeometry(1, 1, 1);
  const unitCrackGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  const crackRecords = [];
  const fibreRecords = [];

  hosts.forEach((host, hostIndex) => {
    const spec = hostSpec(host);
    const bounds = hostBounds[hostIndex];
    const hostId = host.userData.componentId || `WALL-${hostIndex + 1}`;
    const isGable = /gable/i.test(String(host.userData?.type));
    const groundConnected = host.userData?.foundationBearing !== false
      && !isGable && bounds.min.y <= groundBaseY + 0.32;
    if (groundConnected) groundHostCount += 1;
    else excludedGroundLayerHostIds.push(hostId);
    host.userData.surfaceHostId = hostId;
    const hostRelative = rootInverse.clone().multiply(host.matrixWorld);
    const structure = new THREE.Mesh(host.geometry.clone(), shared.structure);
    placeOnHost(structure, hostRelative);
    addTagged(categoryGroups.structure, structure, 'wall-structure-proxy', { hostId, groundConnected });

    if (groundConnected) {
      const plinthHeight = Math.min(0.58, spec.height * 0.16);
      const plinthOutset = 0.045 + dampAmount * 0.018;
      const plinthGeometry = new THREE.BoxGeometry(spec.width + plinthOutset * 2, plinthHeight, spec.depth + plinthOutset * 2);
      const plinth = new THREE.Mesh(plinthGeometry, shared.stone);
      placeOnHost(plinth, hostRelative, new THREE.Vector3(0, plinthHeight / 2, 0));
      addTagged(categoryGroups.stonePlinth, plinth, 'stone-plinth-with-thickness', {
        hostId, normalAxis: spec.orientation === 'x' ? 'z' : 'x', hostDepthM: spec.wallDepth, groundConnected,
      });
      const brickWidth = 0.24;
      const brickRecords = [];
      for (const endpoint of [-1, 1]) {
        for (let course = 0; course < 5; course += 1) {
          const depth = spec.wallDepth + 0.12;
          const along = endpoint * (spec.span / 2 - brickWidth / 2);
          const position = spec.orientation === 'x'
            ? new THREE.Vector3(along, 0.16 + course * 0.16, 0)
            : new THREE.Vector3(0, 0.16 + course * 0.16, along);
          const scale = spec.orientation === 'x'
            ? new THREE.Vector3(brickWidth, 0.15, depth)
            : new THREE.Vector3(depth, 0.15, brickWidth);
          brickRecords.push(instanceTransformRecord(
            hostRelative,
            position,
            new THREE.Quaternion(),
            scale,
            { hostId, endpoint, course },
          ));
        }
      }
      const brickBatch = createInstanceBatch(brickRecords, unitBrickGeometry, shared.brick, {
        hostId,
        normalAxis: spec.orientation === 'x' ? 'z' : 'x',
        hostDepthM: spec.wallDepth,
        normalOutsetM: 0.12,
        correspondence: 'one-instance-per-endpoint-and-masonry-course',
      });
      addTagged(categoryGroups.brickCorner, brickBatch, 'brick-corner-protection-instanced');
    }

    for (const sign of [-1, 1]) {
      const environment = createEnvironment(root, host, spec, sign, hostIndex, seed, sun);
      const faceSeed = seed + hostIndex * 37 + sign * 11;
      const faceData = {
        hostId,
        faceAxis: spec.orientation,
        faceSign: sign,
        sunExposure: environment.sunExposure,
        shelterFactor: environment.shelterFactor,
        drainageMoisture: environment.drainageMoisture,
        groundConnected,
      };
      const plasterMaterial = tintedMaterial(
        system, 0xb9a17f, 0xd8c9ad, environment.sunExposure * 0.34,
        roughness, 0.92 + plasterCoverage * 0.07,
      );
      const plaster = patchMesh(spec, sign, {
        centerU: 0.50, centerV: 0.54, scaleU: 0.96,
        scaleV: Math.min(0.88, 0.26 + plasterCoverage * 0.78),
        patchSeed: faceSeed, offset: 0.006,
      }, plasterMaterial);
      placeOnHost(plaster, hostRelative);
      addTagged(categoryGroups.plaster, plaster, 'bounded-plaster-zone', {
        ...faceData, correlation: 'large-continuous-zone', actualAreaM2: polygonArea(plaster.geometry),
      });

      const earthMaterial = tintedMaterial(system, 0x9d6545, 0xb98058, environment.sunExposure * 0.20, 0.97, 1);
      const exposed = patchMesh(spec, sign, {
        centerU: 0.25 + (hostIndex % 3) * 0.18, centerV: 0.43,
        scaleU: 0.16 + earthExposure * 0.43, scaleV: 0.15 + earthExposure * 0.42,
        patchSeed: faceSeed + 1, offset: 0.010,
      }, earthMaterial);
      placeOnHost(exposed, hostRelative);
      addTagged(categoryGroups.exposedEarth, exposed, 'bounded-exposed-earth-zone', {
        ...faceData, patchId: `${hostId}-EARTH-${sign}`, actualAreaM2: polygonArea(exposed.geometry),
      });

      const lossMaterial = tintedMaterial(system, 0x87573e, 0x6d4937, environment.drainageMoisture * 0.18, 0.98, 1);
      const loss = patchMesh(spec, sign, {
        centerU: 0.68, centerV: 0.63,
        scaleU: 0.11 + lossAmount * 0.40, scaleV: 0.10 + lossAmount * 0.36,
        patchSeed: faceSeed + 2, offset: 0.014,
      }, lossMaterial);
      placeOnHost(loss, hostRelative);
      addTagged(categoryGroups.surfaceLoss, loss, 'surface-loss-patch', {
        ...faceData, patchId: `${hostId}-LOSS-${sign}`, actualAreaM2: polygonArea(loss.geometry),
      });

      const repairMaterial = tintedMaterial(system, 0xc0ad8e, 0xd3c5ad, environment.sunExposure * 0.24, 0.86, 1);
      const repair = patchMesh(spec, sign, {
        centerU: 0.44, centerV: 0.33,
        scaleU: 0.13 + repairAmount * 0.44, scaleV: 0.14 + repairAmount * 0.38,
        patchSeed: faceSeed + 3, offset: 0.018,
      }, repairMaterial);
      placeOnHost(repair, hostRelative);
      addTagged(categoryGroups.repairPatch, repair, 'bounded-repair-patch', {
        ...faceData, patchId: `${hostId}-REPAIR-${sign}`, clusterId: `REPAIR-${hostIndex}`,
        actualAreaM2: polygonArea(repair.geometry),
      });

      if (groundConnected) {
        const dampScale = THREE.MathUtils.clamp(
          (0.075 + dampAmount * 0.18)
            * (1 - environment.sunExposure * 0.38)
            * (0.82 + environment.drainageMoisture * 0.38),
          0.06, 0.28,
        );
        const dampLevels = [
          { id: 'bottom', v0: 0.012, v1: dampScale * 0.45, intensity: dampAmount * (0.78 + environment.drainageMoisture * 0.22) },
          { id: 'middle', v0: 0.012, v1: dampScale * 0.78, intensity: dampAmount * 0.50 * (0.82 + environment.drainageMoisture * 0.18) },
          { id: 'top', v0: 0.012, v1: dampScale, intensity: dampAmount * 0.18 * (0.86 + environment.drainageMoisture * 0.14) },
        ];
        dampLevels.forEach((level, levelIndex) => {
          const intensity = clamp01(level.intensity);
          const opacity = 0.16 + intensity * 0.68;
          const dampMaterial = tintedMaterial(system, 0x615b4c, 0x353a32, intensity * 0.62, 1, opacity);
          const contour = irregularContour(
            0.50, (level.v0 + level.v1) / 2, 0.94 - levelIndex * 0.025,
            Math.max(0.012, level.v1 - level.v0), faceSeed + 10 + levelIndex,
          );
          const damp = patchMesh(spec, sign, { contour, offset: 0.022 + levelIndex * 0.001 }, dampMaterial);
          placeOnHost(damp, hostRelative);
          addTagged(categoryGroups.risingDamp, damp, 'rising-damp-band', {
            ...faceData, dampSampleLevel: level.id, visualIntensity: intensity,
            hostHeightM: spec.height, actualAreaM2: polygonArea(damp.geometry),
          });
        });
      }

      const sootMaterial = tintedMaterial(
        system, 0x514940, 0x302c28, sootAmount * (0.38 + environment.shelterFactor * 0.42),
        1, 0.32 + sootAmount * 0.54,
      );
      const soot = patchMesh(spec, sign, {
        centerU: 0.51, centerV: 0.22,
        scaleU: 0.09 + sootAmount * 0.33, scaleV: 0.11 + sootAmount * 0.29,
        patchSeed: faceSeed + 4, offset: 0.026,
      }, sootMaterial);
      placeOnHost(soot, hostRelative);
      addTagged(categoryGroups.sootAndDirt, soot, 'soot-and-dirt-zone', {
        ...faceData, sheltered: environment.shelterFactor >= 0.5, actualAreaM2: polygonArea(soot.geometry),
      });

      const rainCount = Math.max(1, Math.round(
        (2 + rainAmount * 8)
          * (1 - environment.shelterFactor * 0.48)
          * (0.84 + environment.drainageMoisture * 0.28),
      ));
      for (let index = 0; index < rainCount; index += 1) {
        const baseU = 0.10 + (index + 0.5) / rainCount * 0.80;
        const drainageFlow = clamp01(
          0.30
            + Math.abs(Math.sin((baseU * 7.0 + hostIndex * 0.41 + sign) * Math.PI)) * 0.46
            + environment.drainageMoisture * 0.24,
        );
        const heightScale = THREE.MathUtils.clamp(
          (0.20 + rainAmount * 0.46)
            * (1 - environment.shelterFactor * 0.58)
            * (0.72 + drainageFlow * 0.36),
          0.08, 0.58,
        );
        const topV = THREE.MathUtils.clamp(0.90 - environment.shelterFactor * 0.09, 0.72, 0.94);
        const bottomV = Math.max(0.05, topV - heightScale);
        const verticalLengthM = Math.max(0.01, (topV - bottomV) * spec.height);
        const maximumDriftU = Math.min(0.006, verticalLengthM * 0.06 / Math.max(0.08, spec.span));
        const drift = (seeded01(faceSeed, index, 61) - 0.5) * 2 * maximumDriftU;
        const requestedHalfTop = 0.004 + rainAmount * 0.007 + drainageFlow * 0.003;
        const halfTop = Math.min(requestedHalfTop, verticalLengthM * 0.10 / Math.max(0.08, spec.span));
        const halfBottom = halfTop * (0.42 + drainageFlow * 0.20);
        const contour = [
          new THREE.Vector2(baseU - halfTop, topV),
          new THREE.Vector2(baseU + halfTop, topV),
          new THREE.Vector2(baseU + drift + halfBottom, bottomV),
          new THREE.Vector2(baseU + drift - halfBottom, bottomV),
        ];
        const rainOpacity = THREE.MathUtils.clamp(
          0.18 + rainAmount * 0.48 + drainageFlow * 0.16 - environment.shelterFactor * 0.20,
          0.15, 0.78,
        );
        const rainMaterial = tintedMaterial(
          system, 0x62675b, 0x39453c,
          drainageFlow * 0.40 + (1 - environment.sunExposure) * 0.18,
          0.98, rainOpacity,
        );
        const streak = patchMesh(spec, sign, { contour, offset: 0.030 }, rainMaterial);
        placeOnHost(streak, hostRelative);
        addTagged(categoryGroups.verticalRainStreak, streak, 'vertical-rain-streak', {
          ...faceData, drainageFlow, hostSurfaceAreaM2: spec.span * spec.height,
          actualAreaM2: polygonArea(streak.geometry),
        });
      }

      const crackCount = Math.max(1, Math.round(1 + crackAmount * 5));
      for (let index = 0; index < crackCount; index += 1) {
        const u = 0.20 + (index + 0.5) / crackCount * 0.60;
        const startV = 0.36 + 0.14 * seeded01(hostIndex, index, 3);
        const endV = Math.max(0.08, startV - (0.11 + crackAmount * 0.18));
        const start = facePoint(spec, sign, u, startV, 0.034);
        const end = facePoint(spec, sign, u + 0.012 * sign, endV, 0.034);
        const delta = end.clone().sub(start);
        const length = delta.length();
        const radius = 0.010 + crackAmount * 0.005;
        crackRecords.push(instanceTransformRecord(
          hostRelative,
          start.clone().add(end).multiplyScalar(0.5),
          new THREE.Quaternion().setFromUnitVectors(UP, delta.clone().normalize()),
          new THREE.Vector3(radius, length, radius),
          {
            ...faceData,
            actualLengthM: length,
            gravityDot: Math.abs(start.y - end.y) / length,
          },
        ));
      }

      const fibreCount = Math.max(2, Math.round(earthExposure * 9));
      for (let index = 0; index < fibreCount; index += 1) {
        const fibre = patchMesh(spec, sign, {
          centerU: 0.19 + index / Math.max(1, fibreCount - 1) * 0.18,
          centerV: 0.45 + (seeded01(faceSeed, index, 71) - 0.5) * 0.08,
          scaleU: 0.032, scaleV: 0.006,
          patchSeed: faceSeed + 20 + index, offset: 0.038,
        }, shared.fibre);
        placeOnHost(fibre, hostRelative);
        fibreRecords.push({
          geometry: fibre.geometry,
          matrix: fibre.matrix.clone(),
          semantic: { ...faceData, actualAreaM2: polygonArea(fibre.geometry) },
        });
      }
    }
  });

  const crackBatch = createInstanceBatch(crackRecords, unitCrackGeometry, shared.crack, {
    correspondence: 'one-instance-per-deterministic-crack-segment',
  });
  if (crackBatch) addTagged(categoryGroups.crackNetwork, crackBatch, 'crack-network-segments-instanced');
  const fibreBatch = createStaticPatchBatch(fibreRecords, shared.fibre, {
    correspondence: 'one-explicit-vertex-range-per-deterministic-straw-fibre',
  });
  if (fibreBatch) addTagged(categoryGroups.strawFibre, fibreBatch, 'visible-straw-fibres-static-batch');

  const measuredBeforeStaticBatching = measureWallSystem(system);
  batchStaticWallLayers(system, categoryGroups);
  Object.assign(system.userData, measuredBeforeStaticBatching, {
    hostCount: hosts.length,
    groundHostCount,
    excludedGroundLayerHostIds,
    sunDirection: sun.toArray(),
  });
  return system;
}

export function setYunnanWallLayerVisibility(root, layerId, visible) {
  if (!WALL_LAYERS.includes(layerId)) throw new Error(`Unknown wall layer: ${layerId}`);
  let changed = 0;
  root.traverse((object) => {
    if (object.userData?.wallLayerId === layerId) {
      object.visible = Boolean(visible);
      changed += 1;
    }
  });
  return { layerId, visible: Boolean(visible), changed };
}

export function setYunnanWallLayerMode(root, mode = 'complete') {
  const valid = ['complete', 'structure', 'material', 'historic', 'off'];
  if (!valid.includes(mode)) throw new Error(`Unknown wall layer mode: ${mode}`);
  root.traverse((object) => {
    const category = object.userData?.wallLayerCategory;
    if (category) object.visible = mode === 'complete' || mode === category;
    if (object.userData?.semanticRole === 'wall-core') object.visible = mode !== 'off' && mode !== 'historic';
  });
  const system = root.getObjectByName('V550_wall_surface_system');
  if (system) system.userData.activeMode = mode;
  return { mode };
}

export function getYunnanWallSurfaceSnapshot(root) {
  const system = root.getObjectByName('V550_wall_surface_system');
  if (!system) return null;
  const measured = measureWallSystem(system);
  Object.assign(system.userData, measured);
  return {
    profileId: system.userData.profileId,
    hostCount: system.userData.hostCount || 0,
    groundHostCount: system.userData.groundHostCount || 0,
    excludedGroundLayerHostIds: [...(system.userData.excludedGroundLayerHostIds || [])],
    layerCounts: { ...measured.layerCounts },
    physics: { ...measured.physics },
    dampSamples: { ...measured.dampSamples },
    plinthThicknessM: measured.plinthThicknessM,
    cornerProtectionThicknessM: measured.cornerProtectionThicknessM,
    staticBatching: system.userData.staticBatching ? {
      ...system.userData.staticBatching,
      layerIds: [...system.userData.staticBatching.layerIds],
      batches: system.userData.staticBatching.batches.map((batch) => ({ ...batch })),
    } : null,
  };
}
