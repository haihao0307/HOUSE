import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  YUNNAN_COURTYARD_DEFAULTS,
  createYunnanCourtyardPrototype,
  disposeYunnanCourtyardPrototype,
} from '../../threejs/YunnanCourtyardProduction.js';
import {
  createYunnanCourtyardPrototype as createFrozenV544Runtime,
  disposeYunnanCourtyardPrototype as disposeFrozenV544Runtime,
} from '../../threejs/v544/YunnanCourtyardProduction.js';
import { V544_FROZEN_BASELINE } from '../../threejs/YunnanBaselineV544.js';
import { resolveSurfaceProfile } from '../../threejs/YunnanSurfaceProfiles.js';

const bootStarted = performance.now();
const seedUrl = new URL('../../data/production/yunnan_surface_weathering_seed_v5_5_0.json', import.meta.url);
const seedResponse = await fetch(seedUrl);
if (!seedResponse.ok) throw new Error(`Surface seed HTTP ${seedResponse.status}: ${seedUrl}`);
const seed = await seedResponse.json();

const CAMERA_PRESETS = Object.freeze({
  overview: { position: [17, 13, 20], target: [0, 2.6, 0] },
  ab: { position: [17, 13, 20], target: [0, 2.6, 0] },
  eave: { position: [7.4, 6.1, 8.1], target: [0.2, 5.1, 5.0] },
  roof: { position: [3.2, 23.5, 4.0], target: [0, 2.7, 0] },
  wall: { position: [8.0, 2.2, -10.5], target: [2.6, 1.35, -7.0] },
  stair: { position: [5.8, 4.2, -7.2], target: [-2.8, 1.65, -1.4] },
});

const LIGHT_CONTRACT = Object.freeze({
  background: 0x929a8e,
  hemisphere: [0xfff2d2, 0x41483d, 1.75],
  directional: [0xffdca5, 2.7, [-9, 16, -7]],
  shadows: false,
});

const SHARED_COMPARISON_OPTIONS = Object.freeze({
  seed: V544_FROZEN_BASELINE.comparisonSeed,
  ...V544_FROZEN_BASELINE.buildingParameters,
});
const V550_TILE_PROFILE = Object.freeze({
  tileProfileId: YUNNAN_COURTYARD_DEFAULTS.tileProfileId,
  tileWidth: YUNNAN_COURTYARD_DEFAULTS.tileWidth,
  tileLength: YUNNAN_COURTYARD_DEFAULTS.tileLength,
  tileCourse: YUNNAN_COURTYARD_DEFAULTS.tileCourse,
  tileThickness: YUNNAN_COURTYARD_DEFAULTS.tileThickness,
});

const views = [];
let syncingControls = false;
let firstFrameMs = null;
let frameCount = 0;
let productionRenderSerial = 0;
let fpsWindowStarted = performance.now();
let sampledFps = 0;
const FPS_SAMPLE_WINDOW_MS = 1500;
const fpsSamples = [];
let activePreset = 'museum1940sBalanced';
let tourTimer = null;
let visitorAnimationFrame = null;
let mode = 'complete';
let frozenV544RuntimeCache = null;
let activeCameraId = 'overview';
let activeCameraEvidence = null;
let qaRouteOverlay = null;
let qaDisplayTransaction = null;
let qaDisplaySummary = { mode: 'none', active: false };

function buildEnvironment(scene) {
  scene.background = new THREE.Color(LIGHT_CONTRACT.background);
  const hemi = new THREE.HemisphereLight(...LIGHT_CONTRACT.hemisphere);
  const sun = new THREE.DirectionalLight(LIGHT_CONTRACT.directional[0], LIGHT_CONTRACT.directional[1]);
  sun.position.fromArray(LIGHT_CONTRACT.directional[2]);
  sun.castShadow = LIGHT_CONTRACT.shadows;
  scene.add(hemi, sun);
}

function createView(element, baseline) {
  const scene = new THREE.Scene();
  buildEnvironment(scene);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.fromArray(CAMERA_PRESETS.overview.position);
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    depth: true,
    stencil: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  // Keep the two full-building canvases legible while bounding fill-rate cost
  // on software WebGL. Geometry, materials and interaction sampling remain at
  // full fidelity; only the internal drawing buffer is scaled.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 0.8));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  element.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.fromArray(CAMERA_PRESETS.overview.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();
  let model;
  let profile;

  function load(profileId = activePreset) {
    if (model) {
      scene.remove(model);
      disposeYunnanCourtyardPrototype(model);
    }
    profile = baseline
      ? { ...resolveSurfaceProfile(seed, 'baselineV544'), provenance: V544_FROZEN_BASELINE }
      : resolveSurfaceProfile(seed, profileId);
    model = baseline
      ? createYunnanCourtyardPrototype({
        ...SHARED_COMPARISON_OPTIONS,
        baselineV544: true,
        surfaceProfile: profile,
      })
      : createYunnanCourtyardPrototype({ ...SHARED_COMPARISON_OPTIONS, surfaceProfile: profile });
    model.userData.comparisonContract = {
      ...(model.userData.comparisonContract || {}),
      baselineVersion: '5.4.4',
      productionVersion: '5.5.0',
      sourceCommit: V544_FROZEN_BASELINE.sourceCommit,
      sharedSeed: true,
      sharedBuildingParameters: true,
      sharedCamera: true,
      sharedCanvasSize: true,
      sharedLighting: true,
      displayedBaselineRuntime: 'current-generator-baselineV544-branch',
      frozenRuntimeRole: 'provenance-evidence-only',
      baselineTileProfile: { ...V544_FROZEN_BASELINE.tileProfile },
      productionTileProfile: { ...V550_TILE_PROFILE },
    };
    scene.add(model);
    return model;
  }

  load();
  const view = {
    element, baseline, scene, camera, renderer, controls, load,
    needsRender: true,
    model: () => model,
    profile: () => profile,
  };
  views.push(view);
  return view;
}

const baselineView = createView(document.querySelector('#baseline'), true);
const productionView = createView(document.querySelector('#production'), false);

function synchronizeFrom(source) {
  if (syncingControls) return;
  syncingControls = true;
  views.forEach((view) => {
    view.needsRender = true;
    if (view === source) return;
    view.camera.position.copy(source.camera.position);
    view.camera.quaternion.copy(source.camera.quaternion);
    view.camera.zoom = source.camera.zoom;
    view.camera.updateProjectionMatrix();
    view.controls.target.copy(source.controls.target);
    view.controls.update();
  });
  syncingControls = false;
}

views.forEach((view) => view.controls.addEventListener('change', () => synchronizeFrom(view)));

function resize(view) {
  const width = Math.max(1, view.element.clientWidth);
  const height = Math.max(1, view.element.clientHeight);
  const size = view.renderer.getSize(new THREE.Vector2());
  if (Math.round(size.x) !== width || Math.round(size.y) !== height) {
    view.renderer.setSize(width, height, false);
    view.camera.aspect = width / height;
    view.camera.updateProjectionMatrix();
    view.needsRender = true;
    return true;
  }
  return false;
}

function renderFrame(now) {
  let renderedProduction = false;
  views.forEach((view) => {
    resize(view);
    view.controls.update();
    if (!view.baseline || view.needsRender) {
      view.renderer.render(view.scene, view.camera);
      view.needsRender = false;
      if (!view.baseline) {
        renderedProduction = true;
        productionRenderSerial += 1;
      }
    }
  });
  if (firstFrameMs === null) {
    firstFrameMs = now - bootStarted;
    fpsWindowStarted = now;
    frameCount = 0;
  }
  if (renderedProduction) frameCount += 1;
  const elapsed = now - fpsWindowStarted;
  if (elapsed >= FPS_SAMPLE_WINDOW_MS) {
    sampledFps = frameCount * 1000 / elapsed;
    fpsSamples.push({
      fps: Number(sampledFps.toFixed(4)),
      renderedFrames: frameCount,
      elapsedMs: Number(elapsed.toFixed(3)),
      pixelRatio: productionView.renderer.getPixelRatio(),
    });
    if (fpsSamples.length > 12) fpsSamples.shift();
    frameCount = 0;
    fpsWindowStarted = now;
    updateQuality();
  }
  requestAnimationFrame(renderFrame);
}
requestAnimationFrame(renderFrame);

function compactNumber(value) {
  return Math.round(value || 0).toLocaleString('zh-CN');
}

function updateMetrics(view, element) {
  const stored = view.model().userData.stats || {};
  const derived = deriveSceneStats(view.model());
  const stats = {
    triangleCount: stored.triangleCount ?? derived.triangleCount,
    instanceCount: stored.instanceCount ?? derived.instanceCount,
    meshCount: stored.meshCount ?? derived.meshCount,
    drawCallEstimate: stored.drawCallEstimate ?? derived.visibleDrawables,
  };
  const rows = [
    ['Draw calls', stats.drawCallEstimate],
    ['Instances', stats.instanceCount],
    ['Triangles', compactNumber(stats.triangleCount)],
    ['Meshes', stats.meshCount],
  ];
  element.replaceChildren(...rows.map(([label, value]) => {
    const wrapper = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = String(value);
    wrapper.append(dt, dd);
    return wrapper;
  }));
}

function updateQuality() {
  const stats = productionView.model().userData.stats;
  document.querySelector('#quality').textContent = `FPS ${sampledFps.toFixed(1)} · ${compactNumber(stats.triangleCount)} triangles · ${stats.instanceCount} instances · ${stats.drawCallEstimate} draw calls`;
}

function performanceEvidence() {
  // The first window includes shader compilation and scene warm-up. Require
  // two subsequent complete windows so acceptance reflects stable rendering.
  const steadySamples = fpsSamples.slice(1);
  const recentSteadySamples = steadySamples.slice(-2);
  const recentSteadyFps = recentSteadySamples.map((sample) => sample.fps);
  return {
    sampleWindowMs: FPS_SAMPLE_WINDOW_MS,
    sampleCount: fpsSamples.length,
    steadySampleCount: steadySamples.length,
    samples: fpsSamples.map((sample) => ({ ...sample })),
    recentSteadyFps,
    stableFps: recentSteadyFps.length === 2 ? Math.min(...recentSteadyFps) : 0,
    averageSteadyFps: recentSteadyFps.length
      ? recentSteadyFps.reduce((sum, value) => sum + value, 0) / recentSteadyFps.length
      : 0,
  };
}

function updateStatus() {
  updateMetrics(baselineView, document.querySelector('#baselineMetrics'));
  updateMetrics(productionView, document.querySelector('#productionMetrics'));
  const model = productionView.model();
  const roofSystem = deriveRoofEvidence(model);
  const wallSystem = deriveWallEvidence(model);
  document.querySelector('#status').textContent = `V5.5.0 已就绪，${roofSystem.roofUnitCount} 个真实屋面，${roofSystem.buildUp.length} 层屋面构造，${wallSystem.hostCount} 面墙体进入表面系统`;
  updateQuality();
}

function cameraBoundsEvidence(bounds) {
  return bounds?.isEmpty?.() === false
    ? [...bounds.min.toArray(), ...bounds.max.toArray()].map((value) => rounded(value, 5)) : null;
}

function fitCameraToBounds(bounds, direction, padding = 1.25, targetOffset = new THREE.Vector3()) {
  const target = bounds.getCenter(new THREE.Vector3()).add(targetOffset);
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(0.45, size.length() * 0.5);
  const halfFov = THREE.MathUtils.degToRad(productionView.camera.fov * 0.5);
  const distance = Math.max(1.4, radius * padding / Math.tan(halfFov));
  const normalized = direction.clone().normalize();
  return { position: target.clone().addScaledVector(normalized, distance), target, distance, bounds: bounds.clone() };
}

function instanceWorldBounds(batch, indices = null) {
  const bounds = new THREE.Box3();
  const local = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  if (!batch.geometry?.boundingBox) batch.geometry?.computeBoundingBox?.();
  const geometryBounds = batch.geometry?.boundingBox;
  if (!geometryBounds) return bounds;
  const selected = indices || Array.from({ length: batch.count }, (_, index) => index);
  selected.forEach((index) => {
    batch.getMatrixAt(index, local);
    world.multiplyMatrices(batch.matrixWorld, local);
    bounds.union(geometryBounds.clone().applyMatrix4(world));
  });
  return bounds;
}

function resolveEaveQACamera() {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  const batches = [];
  model.traverse((object) => {
    if (!object.isInstancedMesh || ancestorValue(object, 'roofUnitId', model) !== 'mainHouseDoublePitch') return;
    const kind = object.userData?.instanceMap?.[0]?.kind;
    if (['pan', 'cover', 'drip', 'hook'].includes(kind)) batches.push(object);
  });
  const eaveGroups = new Map();
  batches.filter((batch) => ['drip', 'hook'].includes(batch.userData?.instanceMap?.[0]?.kind)).forEach((batch) => {
    const slopeId = batch.userData?.slopeId;
    if (!eaveGroups.has(slopeId)) eaveGroups.set(slopeId, new THREE.Box3());
    eaveGroups.get(slopeId).union(instanceWorldBounds(batch));
  });
  const selectedSlope = [...eaveGroups.entries()].sort((left, right) => (
    left[1].getCenter(new THREE.Vector3()).z - right[1].getCenter(new THREE.Vector3()).z
  ))[0]?.[0];
  const slopeBatches = batches.filter((batch) => batch.userData?.slopeId === selectedSlope);
  const columns = slopeBatches.flatMap((batch) => (batch.userData?.instanceMap || []).map((item) => item.columnIndex)).filter(Number.isInteger);
  const courses = slopeBatches.flatMap((batch) => (batch.userData?.instanceMap || []).map((item) => item.courseIndex)).filter(Number.isInteger);
  const middleColumn = columns.length ? (Math.min(...columns) + Math.max(...columns)) / 2 : 0;
  const eaveCourse = courses.length ? Math.max(...courses) : 0;
  const detailBounds = new THREE.Box3();
  slopeBatches.forEach((batch) => {
    const semantic = batch.userData?.instanceMap || [];
    const indices = semantic.map((item, index) => ({ item, index })).filter(({ item }) => (
      Math.abs(Number(item.columnIndex) - middleColumn) <= 2.1
      && Number(item.courseIndex) >= eaveCourse - 4
    )).map(({ index }) => index);
    if (indices.length) detailBounds.union(instanceWorldBounds(batch, indices));
  });
  const eaveBounds = eaveGroups.get(selectedSlope) || detailBounds;
  const eaveCenter = eaveBounds.getCenter(new THREE.Vector3());
  const detailCenter = detailBounds.getCenter(new THREE.Vector3());
  const downhill = eaveCenter.clone().sub(detailCenter).setY(0);
  if (downhill.lengthSq() < 1e-8) downhill.set(0, 0, -1);
  downhill.normalize();
  const across = new THREE.Vector3(-downhill.z, 0, downhill.x);
  const direction = downhill.clone().multiplyScalar(0.72)
    .addScaledVector(across, 0.38).add(new THREE.Vector3(0, 0.78, 0)).normalize();
  const camera = fitCameraToBounds(detailBounds, direction, 1.02, downhill.clone().multiplyScalar(-0.16).add(new THREE.Vector3(0, 0.03, 0)));
  return {
    ...camera,
    evidence: {
      source: 'live-main-house-eave-instance-world-bounds', slopeId: selectedSlope,
      selectedColumnCenter: rounded(middleColumn, 3), selectedCourseRange: [Math.max(0, eaveCourse - 4), eaveCourse],
      featureKinds: ['pan', 'cover', 'drip', 'hook'], bounds: cameraBoundsEvidence(detailBounds),
    },
  };
}

function resolveRidgeQACamera() {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  const features = [];
  model.traverse((object) => {
    if (!object.isMesh || ancestorValue(object, 'roofUnitId', model) !== 'mainHouseDoublePitch') return;
    if (object.userData?.ridgeSemantic) features.push(object);
  });
  const principal = features.filter((object) => object.userData.ridgeSemantic === 'principalRidge'
    && ancestorValue(object, 'roofUnitId', model) === 'mainHouseDoublePitch')
    .sort((a, b) => new THREE.Box3().setFromObject(b).getSize(new THREE.Vector3()).lengthSq()
      - new THREE.Box3().setFromObject(a).getSize(new THREE.Vector3()).lengthSq())[0];
  const ridgeBounds = principal ? new THREE.Box3().setFromObject(principal) : new THREE.Box3().setFromObject(model);
  const size = ridgeBounds.getSize(new THREE.Vector3());
  const axis = size.x >= size.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const endpoint = ridgeBounds.getCenter(new THREE.Vector3()).addScaledVector(axis, -Math.max(size.x, size.z) * 0.5);
  const nearbyBounds = new THREE.Box3().setFromCenterAndSize(endpoint, new THREE.Vector3(4.0, 3.5, 4.0));
  const featureBounds = new THREE.Box3();
  const semantics = new Set();
  features.forEach((object) => {
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.intersectsBox(nearbyBounds)) {
      featureBounds.union(bounds.intersect(nearbyBounds));
      semantics.add(object.userData.ridgeSemantic);
    }
  });
  if (featureBounds.isEmpty()) featureBounds.copy(nearbyBounds);
  const outward = axis.clone().negate();
  const side = new THREE.Vector3(-outward.z, 0, outward.x);
  const direction = outward.multiplyScalar(0.78).addScaledVector(side, 0.42).add(new THREE.Vector3(0, 0.72, 0));
  const camera = fitCameraToBounds(featureBounds, direction, 1.08);
  return {
    ...camera,
    evidence: {
      source: 'live-main-house-ridge-semantic-world-bounds',
      featureSemantics: [...semantics].sort(), endpoint: endpoint.toArray().map((value) => rounded(value, 5)),
      bounds: cameraBoundsEvidence(featureBounds),
    },
  };
}

function resolveWallAbutmentQACamera() {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  const abutments = [];
  model.traverse((object) => {
    if (object.isMesh && object.userData?.ridgeSemantic === 'wallAbutment') abutments.push(object);
  });
  const target = abutments.sort((a, b) => new THREE.Box3().setFromObject(a).getSize(new THREE.Vector3()).lengthSq()
    - new THREE.Box3().setFromObject(b).getSize(new THREE.Vector3()).lengthSq())[0];
  const bounds = target ? new THREE.Box3().setFromObject(target) : new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const along = size.x >= size.z ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const camera = fitCameraToBounds(bounds, along.add(new THREE.Vector3(0, 0.62, 0)), 0.95);
  return {
    ...camera,
    evidence: {
      source: 'live-wall-abutment-world-bounds', featureSemantics: ['wallAbutment'],
      roofUnitId: target ? ancestorValue(target, 'roofUnitId', model) : null,
      bounds: cameraBoundsEvidence(bounds),
    },
  };
}

function resolveStairQACamera() {
  const stair = productionView.model().getObjectByName('stair_STAIR-WEST-01');
  const bounds = stair ? new THREE.Box3().setFromObject(stair) : new THREE.Box3().setFromObject(productionView.model());
  const direction = new THREE.Vector3(1, 0.48, -0.82);
  const camera = fitCameraToBounds(bounds, direction, 0.96, new THREE.Vector3(0, 0.12, 0));
  return {
    ...camera,
    evidence: { source: 'live-stair-STair-west-01-world-bounds', stairId: 'STAIR-WEST-01', bounds: cameraBoundsEvidence(bounds) },
  };
}

function routeWorldPoints() {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  return (model.userData?.visitorRoute?.points || []).map((point) => (
    (point.isVector3 ? point.clone() : new THREE.Vector3().fromArray(point)).applyMatrix4(model.matrixWorld)
  ));
}

function resolveRouteQACamera() {
  const points = routeWorldPoints();
  const bounds = new THREE.Box3().setFromPoints(points);
  const camera = fitCameraToBounds(bounds, new THREE.Vector3(0.72, 1.35, -0.76), 1.12, new THREE.Vector3(0, 0.4, 0));
  return {
    ...camera,
    evidence: {
      source: 'actual-visitor-route-point-world-bounds', pointCount: points.length,
      routeFingerprint: fnv1a(points.map((point) => point.toArray().map((value) => rounded(value, 5)).join(','))),
      bounds: cameraBoundsEvidence(bounds),
    },
  };
}

function resolveOpeningsQACamera() {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  const assemblies = [];
  model.traverse((object) => { if (object.userData?.openingKind) assemblies.push(object); });
  const doors = assemblies.filter((object) => object.userData.openingKind === 'door');
  const windows = assemblies.filter((object) => object.userData.openingKind === 'window');
  const door = doors[0];
  const doorCenter = door ? new THREE.Box3().setFromObject(door).getCenter(new THREE.Vector3()) : new THREE.Vector3();
  const windowObject = windows.sort((a, b) => (
    new THREE.Box3().setFromObject(a).getCenter(new THREE.Vector3()).distanceToSquared(doorCenter)
      - new THREE.Box3().setFromObject(b).getCenter(new THREE.Vector3()).distanceToSquared(doorCenter)
  ))[0];
  const bounds = new THREE.Box3();
  [door, windowObject].filter(Boolean).forEach((object) => bounds.union(new THREE.Box3().setFromObject(object)));
  if (bounds.isEmpty()) bounds.setFromObject(model);
  const modelCenter = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  const outward = bounds.getCenter(new THREE.Vector3()).sub(modelCenter).setY(0);
  if (outward.lengthSq() < 1e-8) outward.set(0, 0, -1);
  const side = new THREE.Vector3(-outward.z, 0, outward.x).normalize();
  const camera = fitCameraToBounds(bounds, outward.normalize().multiplyScalar(0.9).addScaledVector(side, 0.24).add(new THREE.Vector3(0, 0.22, 0)), 0.92);
  return {
    ...camera,
    evidence: {
      source: 'live-nearest-door-window-assembly-world-bounds',
      componentIds: [door, windowObject].filter(Boolean).map((object) => object.userData.componentId),
      bounds: cameraBoundsEvidence(bounds),
    },
  };
}

function resolveCamera(id) {
  if (id === 'qaEave' || id === 'eave') return resolveEaveQACamera();
  if (id === 'qaRidge') return resolveRidgeQACamera();
  if (id === 'qaWallAbutment') return resolveWallAbutmentQACamera();
  if (id === 'qaStair' || id === 'stair') return resolveStairQACamera();
  if (id === 'qaRoute') return resolveRouteQACamera();
  if (id === 'qaOpenings') return resolveOpeningsQACamera();
  if (id === 'qaExploded') {
    const roof = productionView.model().children.find((child) => child.userData?.layer === 'roof-production');
    const bounds = roof ? new THREE.Box3().setFromObject(roof) : new THREE.Box3().setFromObject(productionView.model());
    const camera = fitCameraToBounds(bounds, new THREE.Vector3(0.88, 0.72, 1), 1.05);
    return { ...camera, evidence: { source: 'live-separated-roof-layer-world-bounds', bounds: cameraBoundsEvidence(bounds) } };
  }
  const preset = CAMERA_PRESETS[id];
  if (!preset) throw new Error(`Unknown camera preset: ${id}`);
  return {
    position: new THREE.Vector3().fromArray(preset.position),
    target: new THREE.Vector3().fromArray(preset.target),
    evidence: { source: 'declared-camera-preset', presetId: id },
  };
}

function restoreQADisplayState() {
  if (!qaDisplayTransaction) return { mode: 'none', active: false, restored: true, restoredObjectCount: 0 };
  qaDisplayTransaction.entries.forEach(({ object, visible, position }) => {
    object.visible = visible;
    object.position.copy(position);
  });
  const restoredObjectCount = qaDisplayTransaction.entries.length;
  qaDisplayTransaction = null;
  qaDisplaySummary = { mode: 'none', active: false, restored: true, restoredObjectCount };
  productionView.model().updateMatrixWorld(true);
  productionView.needsRender = true;
  return { ...qaDisplaySummary };
}

function setQADisplayState(mode = 'none') {
  restoreQADisplayState();
  if (mode === 'none') return { ...qaDisplaySummary };
  const model = productionView.model();
  const entries = [];
  const remember = (object) => {
    if (!entries.some((entry) => entry.object === object)) entries.push({ object, visible: object.visible, position: object.position.clone() });
  };
  if (mode === 'ridge') {
    model.traverse((object) => {
      if (!object.isGroup) return;
      const roofLayerId = object.userData?.roofLayerId;
      if (roofLayerId && roofLayerId !== 'ridgeAndClosures') {
        remember(object);
        object.visible = false;
      }
    });
  } else if (mode === 'stair') {
    const roof = model.children.find((child) => child.userData?.layer === 'roof-production');
    if (roof) { remember(roof); roof.visible = false; }
  } else if (mode === 'exploded') {
    const layerIndex = new Map(ROOF_LAYER_IDS.map((id, index) => [id, index]));
    model.traverse((object) => {
      if (!object.isGroup) return;
      const index = layerIndex.get(object.userData?.roofLayerId);
      if (index === undefined) return;
      remember(object);
      object.position.x += (index - 3) * 0.80;
      object.position.y += index * 2.00;
    });
  } else {
    throw new Error(`Unknown QA display state: ${mode}`);
  }
  qaDisplayTransaction = { mode, entries };
  model.updateMatrixWorld(true);
  const layerCenters = {};
  ROOF_LAYER_IDS.forEach((id) => {
    const bounds = new THREE.Box3();
    model.traverse((object) => { if (object.userData?.roofLayerId === id && object.visible) bounds.union(new THREE.Box3().setFromObject(object)); });
    if (!bounds.isEmpty()) layerCenters[id] = bounds.getCenter(new THREE.Vector3()).toArray().map((value) => rounded(value, 5));
  });
  const centers = Object.values(layerCenters).map((point) => new THREE.Vector3().fromArray(point));
  const visibleRidgeSemanticCounts = {};
  model.traverse((object) => {
    const semantic = object.userData?.ridgeSemantic;
    if (!semantic || !object.isMesh || !visibleInTree(object, model)) return;
    visibleRidgeSemanticCounts[semantic] = (visibleRidgeSemanticCounts[semantic] || 0) + (object.isInstancedMesh ? object.count : 1);
  });
  let minimumLayerCenterSeparationM = Infinity;
  for (let left = 0; left < centers.length; left += 1) for (let right = left + 1; right < centers.length; right += 1) {
    minimumLayerCenterSeparationM = Math.min(minimumLayerCenterSeparationM, centers[left].distanceTo(centers[right]));
  }
  qaDisplaySummary = {
    mode, active: true, affectedObjectCount: entries.length, hiddenObjectCount: entries.filter(({ object }) => !object.visible).length,
    visibleRoofLayerCount: Object.keys(layerCenters).length, layerCenters,
    visibleRidgeSemanticCounts,
    minimumLayerCenterSeparationM: rounded(minimumLayerCenterSeparationM, 5),
    geometryMutation: false, materialMutation: false,
  };
  productionView.needsRender = true;
  return { ...qaDisplaySummary };
}

function setCamera(id) {
  if (id !== 'qaRoute' && qaRouteOverlay) disposeQARouteOverlay();
  const preset = resolveCamera(id);
  views.forEach((view) => {
    view.camera.position.copy(preset.position);
    view.controls.target.copy(preset.target);
    view.controls.update();
    view.needsRender = true;
  });
  activeCameraId = id;
  activeCameraEvidence = {
    id, ...preset.evidence,
    position: preset.position.toArray().map((value) => rounded(value, 5)),
    target: preset.target.toArray().map((value) => rounded(value, 5)),
  };
  return id;
}

function disposeQARouteOverlay() {
  if (!qaRouteOverlay) return;
  productionView.scene.remove(qaRouteOverlay);
  (qaRouteOverlay.userData.ownedGeometries || []).forEach((geometry) => geometry.dispose());
  (qaRouteOverlay.userData.ownedMaterials || []).forEach((material) => material.dispose());
  qaRouteOverlay = null;
  productionView.needsRender = true;
}

function setQARouteEvidence(visible) {
  disposeQARouteOverlay();
  if (!visible) return { visible: false };
  const points = routeWorldPoints();
  const segmentGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  const markerGeometry = new THREE.SphereGeometry(1, 10, 8);
  const routeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd12e, depthTest: false, depthWrite: false });
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a2e, depthTest: false, depthWrite: false });
  const group = new THREE.Group();
  group.name = 'V550_qa_actual_visitor_route_overlay';
  group.userData = {
    qaEvidenceOnly: true, source: 'actual-visitor-route-points',
    ownedGeometries: [segmentGeometry, markerGeometry], ownedMaterials: [routeMaterial, markerMaterial],
  };
  const segments = new THREE.InstancedMesh(segmentGeometry, routeMaterial, Math.max(0, points.length - 1));
  const markers = new THREE.InstancedMesh(markerGeometry, markerMaterial, points.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const delta = end.clone().sub(start);
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    matrix.compose(start.clone().add(end).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.05, 0)), quaternion, new THREE.Vector3(0.035, delta.length(), 0.035));
    segments.setMatrixAt(index - 1, matrix);
  }
  points.forEach((point, index) => {
    const scale = index === points.length - 1 ? 0.18 : 0.095;
    matrix.compose(point.clone().add(new THREE.Vector3(0, 0.07, 0)), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
    markers.setMatrixAt(index, matrix);
  });
  segments.instanceMatrix.needsUpdate = true;
  markers.instanceMatrix.needsUpdate = true;
  segments.renderOrder = 1000;
  markers.renderOrder = 1001;
  segments.frustumCulled = false;
  markers.frustumCulled = false;
  group.add(segments, markers);
  productionView.scene.add(group);
  productionView.needsRender = true;
  qaRouteOverlay = group;
  return {
    visible: true, evidenceSource: group.userData.source, pointCount: points.length, segmentCount: Math.max(0, points.length - 1),
    routeFingerprint: fnv1a(points.map((point) => point.toArray().map((value) => rounded(value, 5)).join(','))),
    worldBounds: cameraBoundsEvidence(new THREE.Box3().setFromPoints(points)),
  };
}

function setPreset(id) {
  disposeQARouteOverlay();
  restoreQADisplayState();
  activePreset = id;
  productionView.load(id);
  productionView.needsRender = true;
  applyMode(mode);
  updateStatus();
  return inspect('production');
}

function setPressed(id, value) {
  document.querySelector(id)?.setAttribute('aria-pressed', String(Boolean(value)));
}

function setRoofExploded(value) {
  productionView.model().userData.actions.setRoofExploded(Boolean(value));
  setPressed('#explode', value);
  return inspect('production');
}

function applyMode(nextMode = 'complete') {
  mode = nextMode;
  const model = productionView.model();
  const rootLayers = Object.fromEntries(model.children.filter((child) => child.userData?.layer).map((child) => [child.userData.layer, child]));
  Object.values(rootLayers).forEach((layer) => { layer.visible = true; });
  model.getObjectByName('V550_wall_surface_system').visible = true;
  model.userData.actions.setWallLayerMode('complete');
  if (nextMode === 'roofOnly') {
    ['walls', 'timber-frame', 'stone-and-ground', 'doors-windows', 'visitor-route'].forEach((id) => { if (rootLayers[id]) rootLayers[id].visible = false; });
    model.getObjectByName('V550_wall_surface_system').visible = false;
  } else if (nextMode === 'wallOnly') {
    if (rootLayers['roof-production']) rootLayers['roof-production'].visible = false;
  } else if (nextMode === 'historyOnly') {
    if (rootLayers['roof-production']) rootLayers['roof-production'].visible = false;
    model.userData.actions.setWallLayerMode('historic');
  }
  setPressed('#roofOnly', nextMode === 'roofOnly');
  setPressed('#wallOnly', nextMode === 'wallOnly');
  setPressed('#historyOnly', nextMode === 'historyOnly');
  return nextMode;
}

function setOpenings(value) {
  const result = views.map((view) => {
    const action = view.model().userData.actions?.setOpenings;
    return typeof action === 'function' ? action(value) : { baselineStatic: true, progress: 0 };
  });
  setPressed('#openings', value > 0.5);
  return result;
}

function applyVisitorProgress(value) {
  if (value > 0.02 && views.some((view) => !view.baseline && Number(view.model().userData.runtimeState?.openingProgress || 0) < 0.999)) {
    setOpenings(1);
  }
  const result = views.map((view) => {
    const action = view.model().userData.actions?.setVisitor;
    return typeof action === 'function' ? action(value) : { baselineStatic: true, progress: 0 };
  });
  setPressed('#visitor', value > 0.5);
  return result;
}

function stopVisitorAnimation() {
  if (visitorAnimationFrame !== null) cancelAnimationFrame(visitorAnimationFrame);
  visitorAnimationFrame = null;
}

function setVisitor(value) {
  stopVisitorAnimation();
  return applyVisitorProgress(value);
}

function waitForProductionRender(afterSerial, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const probe = (now) => {
      if (productionRenderSerial > afterSerial) {
        resolve({ renderSerial: productionRenderSerial, renderedAtMs: now });
        return;
      }
      if (now - startedAt >= timeoutMs) {
        reject(new Error(`Production frame did not render within ${timeoutMs} ms after serial ${afterSerial}`));
        return;
      }
      requestAnimationFrame(probe);
    };
    requestAnimationFrame(probe);
  });
}

async function playVisitorRoute(durationMs = 5600) {
  stopVisitorAnimation();
  setOpenings(1);
  applyVisitorProgress(0);
  const duration = Math.max(1200, Number(durationMs) || 5600);
  const startedAt = performance.now();
  const requestedFrameCount = 33;
  const evidence = {
    evidenceSource: 'browser-render-serial-plus-generator-raycast',
    durationRequestedMs: duration,
    requestedFrameCount,
    frameCount: 0,
    renderedFrameCount: 0,
    uniquePositions: new Set(),
    stages: new Set(),
    frameFailures: [],
    frames: [],
    completed: false,
  };
  views.forEach((view) => {
    view.model().userData.runtimeState ||= {};
    view.model().userData.runtimeState.browserPlayback = {
      evidenceSource: evidence.evidenceSource, durationRequestedMs: duration,
      requestedFrameCount, frameCount: 0, renderedFrameCount: 0,
      uniquePositionCount: 0, stages: [], frameFailures: [], completed: false,
    };
  });
  for (let index = 0; index < requestedFrameCount; index += 1) {
    if (index > 0) {
      const scheduledAt = startedAt + duration * index / (requestedFrameCount - 1);
      const delayMs = scheduledAt - performance.now();
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const progress = index / (requestedFrameCount - 1);
    const renderSerialBefore = productionRenderSerial;
    const snapshots = applyVisitorProgress(progress);
    const productionSnapshot = snapshots[1] || snapshots[0];
    let renderEvidence = null;
    try {
      renderEvidence = await waitForProductionRender(renderSerialBefore);
      evidence.renderedFrameCount += 1;
    } catch (error) {
      evidence.frameFailures.push({ index, progress, type: error?.name || 'Error', message: String(error?.message || error) });
    }
    evidence.frameCount += 1;
    const productionModel = productionView.model();
    productionModel.updateMatrixWorld(true);
    const actor = productionModel.getObjectByName('visitor_route_actor');
    const position = actor?.getWorldPosition(new THREE.Vector3()).toArray() || null;
    if (Array.isArray(position) && position.length === 3 && position.every(Number.isFinite)) {
      evidence.uniquePositions.add(position.map((value) => rounded(value, 5)).join(','));
    } else {
      evidence.frameFailures.push({ index, progress, type: 'InvalidVisitorPosition', position });
    }
    if (productionSnapshot?.stage) evidence.stages.add(productionSnapshot.stage);
    const collisionCount = ['wallIntersectionCount', 'openingCollisionCount', 'railCollisionCount']
      .reduce((sum, key) => sum + Number(productionSnapshot?.[key] || 0), 0);
    if (collisionCount > 0) evidence.frameFailures.push({ index, progress, type: 'Collision', collisionIds: productionSnapshot?.collisionIds || [] });
    if (Number(productionSnapshot?.suspendedFrameCount || 0) > 0 || productionSnapshot?.supportId == null) {
      evidence.frameFailures.push({ index, progress, type: 'Unsupported', supportId: productionSnapshot?.supportId || null });
    }
    if (Number(productionSnapshot?.stuckFrameCount || 0) > 0) evidence.frameFailures.push({ index, progress, type: 'Stalled' });
    evidence.frames.push({
      index, progress: rounded(progress, 6), renderSerialBefore,
      renderSerialAfter: renderEvidence?.renderSerial ?? null,
      position: Array.isArray(position) ? position.map((value) => rounded(value, 6)) : null,
      reportedPosition: Array.isArray(productionSnapshot?.position)
        ? productionSnapshot.position.map((value) => rounded(value, 6)) : null,
      stage: productionSnapshot?.stage || null,
      supportId: productionSnapshot?.supportId || null,
    });
  }
  const finalSnapshot = views[1].model().userData.runtimeState?.visitorSnapshot;
  const finalVisitor = deriveVisitorEvidence(productionView.model());
  if (finalSnapshot?.complete !== true || finalVisitor?.complete !== true || finalVisitor?.reachedUpperFloor !== true) {
    evidence.frameFailures.push({ type: 'DestinationNotReached', finalSnapshot, finalVisitor });
  }
  const current = {
    evidenceSource: evidence.evidenceSource,
    durationRequestedMs: duration,
    elapsedMs: performance.now() - startedAt,
    requestedFrameCount,
    frameCount: evidence.frameCount,
    renderedFrameCount: evidence.renderedFrameCount,
    uniquePositionCount: evidence.uniquePositions.size,
    stages: [...evidence.stages],
    frameFailures: evidence.frameFailures,
    frames: evidence.frames,
    destination: null,
    completed: finalSnapshot?.complete === true
      && finalVisitor?.complete === true
      && finalVisitor?.reachedUpperFloor === true
      && evidence.frameFailures.length === 0
      && evidence.renderedFrameCount === requestedFrameCount,
  };
  current.destination = finalVisitor ? {
    ...finalVisitor,
    browserPlayback: {
      evidenceSource: current.evidenceSource,
      durationRequestedMs: current.durationRequestedMs,
      elapsedMs: current.elapsedMs,
      requestedFrameCount: current.requestedFrameCount,
      frameCount: current.frameCount,
      renderedFrameCount: current.renderedFrameCount,
      uniquePositionCount: current.uniquePositionCount,
      stages: [...current.stages],
      frameFailures: [...current.frameFailures],
      completed: current.completed,
    },
  } : null;
  views.forEach((view) => {
    view.model().userData.runtimeState ||= {};
    view.model().userData.runtimeState.browserPlayback = { ...current };
  });
  visitorAnimationFrame = null;
  setPressed('#visitor', true);
  return current;
}

function stopTour() {
  if (tourTimer) clearInterval(tourTimer);
  tourTimer = null;
  stopVisitorAnimation();
  setPressed('#tour', false);
}

function reset() {
  stopTour();
  restoreQADisplayState();
  setCamera('overview');
  setRoofExploded(false);
  setOpenings(0);
  setVisitor(0);
  applyMode('complete');
  document.querySelector('#preset').value = 'museum1940sBalanced';
  if (activePreset !== 'museum1940sBalanced') setPreset('museum1940sBalanced');
  return inspect('production');
}

document.querySelector('#preset').addEventListener('change', (event) => setPreset(event.target.value));
document.querySelectorAll('[data-camera]').forEach((button) => button.addEventListener('click', () => setCamera(button.dataset.camera)));
document.querySelector('#explode').addEventListener('click', (event) => setRoofExploded(event.currentTarget.getAttribute('aria-pressed') !== 'true'));
document.querySelector('#roofOnly').addEventListener('click', () => applyMode(mode === 'roofOnly' ? 'complete' : 'roofOnly'));
document.querySelector('#wallOnly').addEventListener('click', () => applyMode(mode === 'wallOnly' ? 'complete' : 'wallOnly'));
document.querySelector('#historyOnly').addEventListener('click', () => applyMode(mode === 'historyOnly' ? 'complete' : 'historyOnly'));
document.querySelector('#openings').addEventListener('click', (event) => setOpenings(event.currentTarget.getAttribute('aria-pressed') === 'true' ? 0 : 1));
document.querySelector('#visitor').addEventListener('click', (event) => {
  if (event.currentTarget.getAttribute('aria-pressed') === 'true') setVisitor(0);
  else playVisitorRoute();
});
document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#tour').addEventListener('click', () => {
  if (tourTimer) return stopTour();
  setPressed('#tour', true);
  const sequence = [
    () => { applyMode('complete'); setCamera('overview'); },
    () => { setCamera('eave'); },
    () => { setRoofExploded(true); setCamera('roof'); },
    () => { setRoofExploded(false); setCamera('wall'); },
    () => { setCamera('stair'); playVisitorRoute(2400); },
  ];
  let index = 0;
  sequence[index++]();
  tourTimer = setInterval(() => sequence[index++ % sequence.length](), 2600);
});

function countRenderable(group) {
  let count = 0;
  group.traverse((object) => {
    if (object.isMesh && object.visible) count += object.isInstancedMesh ? object.count : 1;
  });
  return count;
}

const ROOF_LAYER_IDS = Object.freeze([
  'purlins', 'rafters', 'roofUnderlay', 'panTileCourses', 'coverTileCourses',
  'eaveCapsAndDrips', 'ridgeAndClosures',
]);
const ROOF_UNIT_IDS = Object.freeze([
  'mainHouseDoublePitch', 'leftEarAsymmetricDoublePitch', 'rightEarAsymmetricDoublePitch',
  'entranceBlockDoublePitch', 'mainGalleryLeanTo', 'sideGalleryLeanTo', 'gatehouseSmallRoof',
]);
const ROOT_LAYER_IDS = Object.freeze([
  'stone-and-ground', 'walls', 'timber-frame', 'roof-production', 'doors-windows', 'visitor-route',
]);

function rounded(value, digits = 5) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function ancestorValue(object, key, stop = null) {
  let current = object;
  while (current) {
    if (current.userData?.[key] !== undefined) return current.userData[key];
    if (current === stop) break;
    current = current.parent;
  }
  return undefined;
}

function hasNamedAncestor(object, name) {
  let current = object;
  while (current) {
    if (current.name === name) return true;
    current = current.parent;
  }
  return false;
}

function boxSize(object) {
  const bounds = new THREE.Box3().setFromObject(object);
  return { bounds, size: bounds.getSize(new THREE.Vector3()) };
}

function visibleInTree(object, stop = null) {
  let current = object;
  while (current) {
    if (!current.visible) return false;
    if (current === stop) break;
    current = current.parent;
  }
  return true;
}

function fnv1a(parts) {
  let hash = 0x811c9dc5;
  const text = parts.join('|');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}:${text.length}`;
}

function geometryToken(geometry) {
  if (!geometry) return 'no-geometry';
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const position = geometry.getAttribute?.('position');
  const bounds = geometry.boundingBox;
  return JSON.stringify([
    geometry.type,
    position?.count || 0,
    geometry.index?.count || 0,
    bounds ? [...bounds.min.toArray(), ...bounds.max.toArray()].map((value) => rounded(value)) : [],
  ]);
}

function renderableTokens(root, include, includeMaterials = true) {
  root.updateMatrixWorld(true);
  const tokens = [];
  const instanceMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry || !include(object)) return;
    const common = [
      ancestorValue(object, 'layer', root) || '',
      ancestorValue(object, 'roofLayerId', root) || '',
      ancestorValue(object, 'wallLayerId', root) || '',
      object.userData?.type || object.type,
      geometryToken(object.geometry),
      object.visible ? 1 : 0,
      visibleInTree(object, root) ? 1 : 0,
    ];
    if (object.isInstancedMesh) {
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, instanceMatrix);
        worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        const worldBounds = object.geometry.boundingBox?.clone().applyMatrix4(worldMatrix);
        tokens.push(JSON.stringify([
          ...common, index,
          ...worldMatrix.elements.map((value) => rounded(value)),
          ...(worldBounds ? [...worldBounds.min.toArray(), ...worldBounds.max.toArray()].map((value) => rounded(value)) : []),
        ]));
      }
      const colors = object.instanceColor?.array;
      if (includeMaterials && colors) tokens.push(`colors:${Array.from(colors, (value) => rounded(value, 4)).join(',')}`);
    } else {
      const worldBounds = new THREE.Box3().setFromObject(object);
      tokens.push(JSON.stringify([
        ...common,
        ...object.matrixWorld.elements.map((value) => rounded(value)),
        ...[...worldBounds.min.toArray(), ...worldBounds.max.toArray()].map((value) => rounded(value)),
      ]));
    }
    if (includeMaterials) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((material) => {
        const channels = material.userData?.yunnanSurfaceChannels || {};
        const channelToken = Object.entries(channels).sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, typeof value === 'number' ? rounded(value, 6) : value]);
        tokens.push(JSON.stringify({
          type: material.type,
          color: material.color?.getHexString?.() || null,
          opacity: rounded(material.opacity, 5),
          roughness: rounded(material.roughness, 5),
          metalness: rounded(material.metalness, 5),
          transparent: Boolean(material.transparent),
          vertexColors: Boolean(material.vertexColors),
          side: material.side,
          yunnanProfile: material.userData?.yunnanProfile || null,
          yunnanMode: material.userData?.yunnanMode || null,
          yunnanSeed: material.userData?.yunnanSeed ?? null,
          yunnanOpeningRole: material.userData?.yunnanOpeningRole || null,
          shaderChannels: channelToken,
        }));
      });
    }
  });
  return tokens;
}

function geometryClosedShell(geometry) {
  const position = geometry?.getAttribute?.('position');
  if (!position || !geometry.index) return false;
  const edges = new Map();
  const index = geometry.index;
  for (let offset = 0; offset < index.count; offset += 3) {
    const triangle = [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)];
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      const a = triangle[edgeIndex];
      const b = triangle[(edgeIndex + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  return edges.size > 0 && [...edges.values()].every((count) => count === 2);
}

function tileCurvature(geometry) {
  const position = geometry?.getAttribute?.('position');
  if (!position || position.count < 12) return null;
  const row = Math.floor(position.count / 4);
  if (row < 3) return null;
  const center = Math.floor(row / 2);
  return rounded(position.getY(center) - (position.getY(0) + position.getY(row - 1)) / 2, 6);
}

function samplesFromBatch(batch) {
  const samples = [];
  const local = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const semantic = batch.userData?.instanceMap || [];
  for (let index = 0; index < batch.count; index += 1) {
    batch.getMatrixAt(index, local);
    world.multiplyMatrices(batch.matrixWorld, local);
    const across = new THREE.Vector3(world.elements[0], world.elements[1], world.elements[2]);
    const course = new THREE.Vector3(world.elements[8], world.elements[9], world.elements[10]);
    const courseScale = course.length();
    samples.push({
      ...(semantic[index] || {}),
      index,
      state: semantic[index]?.state || batch.userData?.state || 'aged',
      position: new THREE.Vector3().setFromMatrixPosition(world),
      acrossAxis: across.normalize(),
      courseAxis: course.normalize(),
      courseScale,
      geometry: batch.geometry,
    });
  }
  return samples;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function auditSlope(roof, slopeId) {
  const batches = [];
  roof.traverse((object) => {
    if (object.isInstancedMesh && object.userData?.slopeId === slopeId) batches.push(object);
  });
  const batchesOf = (prefix) => batches.filter((batch) => String(batch.userData?.type || '').startsWith(prefix));
  const panBatches = batchesOf('板瓦-pan-');
  const coverBatches = batchesOf('筒瓦-cover-');
  const dripBatches = batchesOf('滴水-pan-eave-drips');
  const hookBatches = batchesOf('勾头-cover-eave-hook-heads');
  const fallbackHookBatches = hookBatches.length ? hookBatches : batchesOf('勾头-cover-eave-hooks');
  const pans = panBatches.flatMap(samplesFromBatch);
  const covers = coverBatches.flatMap(samplesFromBatch);
  const drips = dripBatches.flatMap(samplesFromBatch);
  const hooks = fallbackHookBatches.flatMap(samplesFromBatch);
  const stablePans = pans.filter((sample) => sample.state !== 'broken');
  const stableCovers = covers.filter((sample) => sample.state !== 'broken');

  const numericMax = (items, key) => items.reduce((maximum, item) => Number.isInteger(item[key]) ? Math.max(maximum, item[key]) : maximum, -1);
  const panColumns = numericMax(pans, 'columnIndex') + 1;
  const coverColumns = numericMax(covers, 'columnIndex') + 1;
  const courseCount = Math.max(numericMax(pans, 'courseIndex'), numericMax(covers, 'courseIndex')) + 1;
  const byColumn = new Map();
  stablePans.forEach((sample) => {
    if (!Number.isInteger(sample.columnIndex) || !Number.isInteger(sample.courseIndex)) return;
    if (!byColumn.has(sample.columnIndex)) byColumn.set(sample.columnIndex, []);
    byColumn.get(sample.columnIndex).push(sample);
  });
  byColumn.forEach((path) => path.sort((a, b) => a.courseIndex - b.courseIndex));
  const longestPath = [...byColumn.values()].sort((a, b) => b.length - a.length)[0] || [];
  const downhill = longestPath.length > 1
    ? longestPath.at(-1).position.clone().sub(longestPath[0].position).normalize()
    : new THREE.Vector3();
  const downhillHorizontal = downhill.clone().setY(0);
  if (downhillHorizontal.lengthSq()) downhillHorizontal.normalize();
  let monotonicPathCount = 0;
  const spacings = [];
  const falls = [];
  byColumn.forEach((path) => {
    let monotonic = path.length > 1;
    for (let index = 1; index < path.length; index += 1) {
      const previous = path[index - 1];
      const current = path[index];
      const gap = Math.max(1, current.courseIndex - previous.courseIndex);
      const delta = current.position.clone().sub(previous.position);
      spacings.push(delta.length() / gap);
      falls.push((previous.position.y - current.position.y) / gap);
      if (current.position.y >= previous.position.y || delta.dot(downhill) <= 0) monotonic = false;
    }
    if (monotonic) monotonicPathCount += 1;
  });

  const panLookup = new Map(stablePans.map((sample) => [`${sample.courseIndex}:${sample.columnIndex}`, sample]));
  const seamErrors = [];
  const courseOffsets = [];
  stableCovers.forEach((cover) => {
    const left = panLookup.get(`${cover.courseIndex}:${cover.columnIndex}`);
    const right = panLookup.get(`${cover.courseIndex}:${cover.columnIndex + 1}`);
    if (!left || !right) return;
    const midpoint = left.position.clone().add(right.position).multiplyScalar(0.5);
    const delta = cover.position.clone().sub(midpoint);
    seamErrors.push(Math.abs(delta.dot(left.acrossAxis)));
    courseOffsets.push(Math.abs(delta.dot(downhillHorizontal)));
  });

  const dripByColumn = new Map(drips.filter((sample) => Number.isInteger(sample.columnIndex)).map((sample) => [sample.columnIndex, sample]));
  let eaveTerminationCount = 0;
  byColumn.forEach((path, column) => {
    const drip = dripByColumn.get(column);
    if (!drip || !path.length) return;
    const delta = drip.position.clone().sub(path.at(-1).position);
    if (drip.position.y < path.at(-1).position.y && delta.dot(downhill) > 0) eaveTerminationCount += 1;
  });
  const panGeometry = stablePans[0]?.geometry || pans[0]?.geometry;
  const coverGeometry = stableCovers[0]?.geometry || covers[0]?.geometry;
  if (panGeometry && !panGeometry.boundingBox) panGeometry.computeBoundingBox();
  const effectiveLength = panGeometry
    ? (panGeometry.boundingBox.max.z - panGeometry.boundingBox.min.z) * median(stablePans.map((sample) => sample.courseScale))
    : null;
  const spacing = median(spacings);
  const brokenTiles = [...pans, ...covers].filter((sample) => sample.state === 'broken').length;
  const repairTiles = [...pans, ...covers].filter((sample) => sample.state === 'repair').length;
  const expectedTiles = Math.max(0, panColumns * courseCount) + Math.max(0, coverColumns * courseCount);
  const missingTiles = Math.max(0, expectedTiles - pans.length - covers.length);
  const seamError = seamErrors.length ? Math.max(...seamErrors) : null;
  const courseOffset = courseOffsets.length ? Math.max(...courseOffsets) : null;
  const panCurve = tileCurvature(panGeometry);
  const coverCurve = tileCurvature(coverGeometry);
  const horizontalRun = Math.hypot(downhill.x, downhill.z);
  return {
    slopeId,
    evidenceSource: 'live-instance-matrices-buffer-geometry-and-world-bounds',
    panColumns,
    coverColumns,
    courseCount,
    panInstanceCount: pans.length,
    coverInstanceCount: covers.length,
    dripCount: drips.length,
    hookCount: hooks.length,
    panGeometryClosedShell: geometryClosedShell(panGeometry),
    coverGeometryClosedShell: geometryClosedShell(coverGeometry),
    panCrossSectionCurvatureM: panCurve,
    coverCrossSectionCurvatureM: coverCurve,
    panConcavity: panCurve < 0 ? 'up' : 'not-concave-up',
    coverConvexity: coverCurve > 0 ? 'up' : 'not-convex-up',
    coverBridgesPanSeams: seamErrors.length > 0 && seamError <= 0.004,
    seamSampleCount: seamErrors.length,
    seamAlignmentMaxErrorM: rounded(seamError, 7),
    coverCourseOffsetM: rounded(courseOffset, 7),
    drainagePathCount: byColumn.size,
    monotonicDrainagePathCount: monotonicPathCount,
    drainagePathsMonotonic: byColumn.size > 0 && monotonicPathCount === byColumn.size,
    eaveTerminationCount,
    drainagePathsEndAtEave: byColumn.size > 0 && eaveTerminationCount === byColumn.size,
    minimumCourseFallM: rounded(falls.length ? Math.min(...falls) : null, 6),
    downhillVector: downhill.toArray().map((value) => rounded(value, 6)),
    measuredPitch: horizontalRun > 1e-8 ? rounded(Math.abs(downhill.y) / horizontalRun, 5) : null,
    longitudinalOverlapM: effectiveLength === null || spacing === null ? null : rounded(effectiveLength - spacing, 6),
    tileBatchesAreInstanced: batches.length > 0 && [...panBatches, ...coverBatches, ...dripBatches, ...fallbackHookBatches].every((batch) => batch.isInstancedMesh),
    damage: { missingTiles, brokenTiles },
    repairs: { tiles: repairTiles },
    topologyFingerprint: fnv1a([
      ...panBatches.flatMap((batch) => renderableTokens(batch, () => true)),
      ...coverBatches.flatMap((batch) => renderableTokens(batch, () => true)),
      ...dripBatches.flatMap((batch) => renderableTokens(batch, () => true)),
      ...fallbackHookBatches.flatMap((batch) => renderableTokens(batch, () => true)),
    ]),
  };
}

function deriveRoofEvidence(model) {
  model.updateMatrixWorld(true);
  const roofUnits = [];
  model.traverse((roof) => {
    if (roof.userData?.isRoofUnit !== true) return;
    const layerCounts = Object.fromEntries(ROOF_LAYER_IDS.map((id) => [id, 0]));
    roof.traverse((child) => {
      if (!child.isMesh || !visibleInTree(child, roof)) return;
      const layerId = ancestorValue(child, 'roofLayerId', roof);
      if (ROOF_LAYER_IDS.includes(layerId)) layerCounts[layerId] += child.isInstancedMesh ? child.count : 1;
    });
    const slopeIds = [];
    let sectionCount = 0;
    roof.traverse((child) => {
      if (child.userData?.type === 'roof-slope' && child.userData?.slopeId) slopeIds.push(child.userData.slopeId);
      if (child.userData?.type === 'roof-section') sectionCount += 1;
    });
    const slopes = slopeIds.map((slopeId) => auditSlope(roof, slopeId));
    const { bounds, size } = boxSize(roof);
    const layerBounds = Object.fromEntries(ROOF_LAYER_IDS.map((id) => [id, new THREE.Box3()]));
    roof.traverse((child) => {
      if (!child.isMesh) return;
      const layerId = ancestorValue(child, 'roofLayerId', roof);
      if (layerBounds[layerId]) layerBounds[layerId].union(new THREE.Box3().setFromObject(child));
    });
    const layerFingerprints = Object.fromEntries(ROOF_LAYER_IDS.map((layerId) => [
      layerId,
      fnv1a(renderableTokens(roof, (child) => ancestorValue(child, 'roofLayerId', roof) === layerId)),
    ]));
    const ridgeMeshes = [];
    const ridgeSemanticCounts = {};
    const ridgeBounds = new THREE.Box3();
    roof.traverse((child) => {
      const semantic = child.userData?.ridgeSemantic;
      if (!child.isMesh || !semantic) return;
      ridgeMeshes.push(child);
      ridgeSemanticCounts[semantic] = (ridgeSemanticCounts[semantic] || 0)
        + (child.isInstancedMesh ? child.count : 1);
      ridgeBounds.union(new THREE.Box3().setFromObject(child));
    });
    const ridgeGeometryCount = ridgeMeshes.reduce(
      (sum, child) => sum + (child.isInstancedMesh ? child.count : 1),
      0,
    );
    const ridgeSize = ridgeBounds.isEmpty() ? new THREE.Vector3() : ridgeBounds.getSize(new THREE.Vector3());
    roofUnits.push({
      roofUnitId: roof.userData.roofUnitId,
      buildingUnitId: roof.userData.buildingUnitId,
      roofType: roof.userData.roofType,
      sectionCount,
      ridgeElevationM: layerBounds.ridgeAndClosures.isEmpty() ? null : rounded(layerBounds.ridgeAndClosures.max.y, 4),
      eaveElevationM: layerBounds.eaveCapsAndDrips.isEmpty() ? null : rounded(layerBounds.eaveCapsAndDrips.min.y, 4),
      actualRenderableCount: countRenderable(roof),
      bboxVolume: rounded(size.x * size.y * size.z, 5),
      worldBounds: [...bounds.min.toArray(), ...bounds.max.toArray()].map((value) => rounded(value, 4)),
      layerCounts,
      layerFingerprints,
      layerWorldBounds: Object.fromEntries(Object.entries(layerBounds).map(([id, box]) => [
        id,
        box.isEmpty() ? null : [...box.min.toArray(), ...box.max.toArray()].map((value) => rounded(value, 4)),
      ])),
      slopes,
      damage: {
        missingTiles: slopes.reduce((sum, slope) => sum + slope.damage.missingTiles, 0),
        brokenTiles: slopes.reduce((sum, slope) => sum + slope.damage.brokenTiles, 0),
      },
      repairs: { tiles: slopes.reduce((sum, slope) => sum + slope.repairs.tiles, 0) },
      ridgeTopology: (roof.userData.ridgeTopology || []).map((item) => ({ ...item })),
      ridgeAudit: {
        evidenceSource: 'live-ridge-mesh-world-bounds-and-semantics',
        geometryCount: ridgeGeometryCount,
        batchCount: ridgeMeshes.length,
        semanticCounts: ridgeSemanticCounts,
        worldBounds: ridgeBounds.isEmpty() ? null : [...ridgeBounds.min.toArray(), ...ridgeBounds.max.toArray()].map((value) => rounded(value, 5)),
        boundsSizeM: ridgeSize.toArray().map((value) => rounded(value, 5)),
        geometryFingerprint: fnv1a(renderableTokens(roof, (child) => Boolean(child.userData?.ridgeSemantic))),
      },
    });
  });
  roofUnits.sort((a, b) => String(a.roofUnitId).localeCompare(String(b.roofUnitId)));
  const actualIds = roofUnits.map((roof) => roof.roofUnitId);
  const complete = ROOF_UNIT_IDS.every((id) => actualIds.filter((actual) => actual === id).length === 1)
    && roofUnits.every((roof) => ROOF_LAYER_IDS.every((id) => roof.layerCounts[id] > 0));
  return {
    evidenceSource: 'live-scene-graph-parent-layers-and-world-bounds',
    roofUnitCount: roofUnits.length,
    actualRoofUnitIds: actualIds,
    missingRoofUnitIds: ROOF_UNIT_IDS.filter((id) => !actualIds.includes(id)),
    buildUp: [...ROOF_LAYER_IDS],
    complete,
    unitChecks: roofUnits.map((roof) => ({
      roofUnitId: roof.roofUnitId,
      ridgeTopology: roof.ridgeTopology,
      ridgeAudit: roof.ridgeAudit,
    })),
    roofUnits,
  };
}

function deriveWallEvidence(model) {
  model.updateMatrixWorld(true);
  const system = model.getObjectByName('V550_wall_surface_system');
  const hosts = [];
  model.traverse((object) => {
    if (object.isMesh && object.userData?.semanticRole === 'wall-core') hosts.push(object);
  });
  const hostBounds = new Map(hosts.map((host, index) => [host.userData?.surfaceHostId || host.userData?.componentId || `host-${index}`, new THREE.Box3().setFromObject(host)]));
  const layerCounts = {};
  const layerObjects = new Map();
  if (system) {
    system.traverse((object) => {
      if (!object.isMesh || !object.geometry) return;
      const layerId = ancestorValue(object, 'wallLayerId', system);
      if (!layerId) return;
      layerCounts[layerId] = (layerCounts[layerId] || 0) + (object.isInstancedMesh
        ? object.count
        : Math.max(1, Number(object.userData?.semanticElementCount) || 1));
      if (!layerObjects.has(layerId)) layerObjects.set(layerId, []);
      layerObjects.get(layerId).push(object);
    });
  }
  const hostFor = (object) => hostBounds.get(object.userData?.hostId) || null;
  const worldArea = (object) => {
    const position = object.geometry?.getAttribute?.('position');
    if (!position) return 0;
    const index = object.geometry.index;
    const count = index ? index.count / 3 : position.count / 3;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    let area = 0;
    for (let triangle = 0; triangle < count; triangle += 1) {
      const ia = index ? index.getX(triangle * 3) : triangle * 3;
      const ib = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
      const ic = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;
      a.fromBufferAttribute(position, ia).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(position, ib).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(position, ic).applyMatrix4(object.matrixWorld);
      area += new THREE.Triangle(a, b, c).getArea();
    }
    return area;
  };
  const downwardDot = (object) => {
    const position = object.geometry?.getAttribute?.('position');
    if (!position?.count) return null;
    const points = Array.from({ length: position.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const tolerance = Math.max(1e-5, (maxY - minY) * 0.03);
    const averageAt = (target) => {
      const selected = points.filter((point) => Math.abs(point.y - target) <= tolerance);
      return selected.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, selected.length));
    };
    const direction = averageAt(minY).sub(averageAt(maxY));
    return direction.lengthSq() ? direction.normalize().dot(new THREE.Vector3(0, -1, 0)) : null;
  };
  const luminance = (object) => {
    const color = object.material?.color;
    return color ? color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722 : null;
  };
  const dampMetrics = (layerObjects.get('risingDamp') || []).map((object) => {
    const host = hostFor(object);
    if (!host) return null;
    const patch = new THREE.Box3().setFromObject(object);
    const hostHeight = host.max.y - host.min.y || 1;
    return {
      bottomOffsetRatio: (patch.min.y - host.min.y) / hostHeight,
      topRatio: (patch.max.y - host.min.y) / hostHeight,
      heightRatio: (patch.max.y - patch.min.y) / hostHeight,
      level: object.userData?.dampSampleLevel,
      opacity: Number(object.material?.opacity),
    };
  }).filter(Boolean);
  const rainMetrics = (layerObjects.get('verticalRainStreak') || []).map((object) => {
    const { size } = boxSize(object);
    const host = hostFor(object);
    const hostSize = host?.getSize(new THREE.Vector3());
    const hostArea = hostSize ? Math.max(hostSize.x, hostSize.z) * hostSize.y : 1;
    return {
      verticalAspect: size.y / Math.max(size.x, size.z, 1e-8),
      gravityDot: downwardDot(object),
      load: worldArea(object) / Math.max(0.01, hostArea) * Number(object.material?.opacity || 1),
      sheltered: Number(object.userData?.shelterFactor) >= 0.5,
      drainageFlow: Number(object.userData?.drainageFlow),
    };
  });
  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const dampOpacity = Object.fromEntries(['bottom', 'middle', 'top'].map((level) => [
    level,
    average(dampMetrics.filter((item) => item.level === level).map((item) => item.opacity).filter(Number.isFinite)),
  ]));
  const shelteredLoads = rainMetrics.filter((item) => item.sheltered).map((item) => item.load);
  const exposedLoads = rainMetrics.filter((item) => !item.sheltered).map((item) => item.load);
  const drainageMedian = median(rainMetrics.map((item) => item.drainageFlow));
  const lowFlowLoads = rainMetrics.filter((item) => item.drainageFlow < drainageMedian).map((item) => item.load);
  const highFlowLoads = rainMetrics.filter((item) => item.drainageFlow >= drainageMedian).map((item) => item.load);
  const plasterMetrics = (layerObjects.get('plaster') || []).map((object) => ({
    sunExposure: Number(object.userData?.sunExposure),
    luminance: luminance(object),
  })).filter((item) => Number.isFinite(item.sunExposure) && Number.isFinite(item.luminance));
  const extensionFor = (object) => {
    const host = hostFor(object);
    if (!host) return null;
    const patchSize = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    const hostSize = host.getSize(new THREE.Vector3());
    return Math.max(patchSize.x - hostSize.x, patchSize.z - hostSize.z, 0);
  };
  const plinthExtensions = (layerObjects.get('stonePlinth') || []).map(extensionFor).filter(Number.isFinite);
  const cornerExtensions = (layerObjects.get('brickCorner') || []).map(extensionFor).filter(Number.isFinite);
  const boundedToHost = (object) => {
    const host = hostFor(object);
    if (!host) return false;
    const patch = new THREE.Box3().setFromObject(object);
    const expanded = host.clone().expandByScalar(0.08);
    return expanded.containsPoint(patch.getCenter(new THREE.Vector3())) && patch.min.y >= host.min.y - 0.02 && patch.max.y <= host.max.y + 0.02;
  };
  const repairs = layerObjects.get('repairPatch') || [];
  return {
    evidenceSource: 'live-wall-mesh-world-bounds',
    hostCount: hosts.length,
    layerCounts,
    dampGeometry: {
      bandCount: dampMetrics.length,
      maxBottomOffsetRatio: rounded(dampMetrics.length ? Math.max(...dampMetrics.map((item) => item.bottomOffsetRatio)) : null, 5),
      maxTopRatio: rounded(dampMetrics.length ? Math.max(...dampMetrics.map((item) => item.topRatio)) : null, 5),
      meanHeightRatio: rounded(median(dampMetrics.map((item) => item.heightRatio)), 5),
      opacityByLevel: Object.fromEntries(Object.entries(dampOpacity).map(([key, value]) => [key, rounded(value, 5)])),
    },
    rainGeometry: {
      streakCount: rainMetrics.length,
      minVerticalAspect: rounded(rainMetrics.length ? Math.min(...rainMetrics.map((item) => item.verticalAspect)) : null, 4),
      medianVerticalAspect: rounded(median(rainMetrics.map((item) => item.verticalAspect)), 4),
      minGravityDot: rounded(Math.min(...rainMetrics.map((item) => item.gravityDot).filter(Number.isFinite)), 5),
      shelteredLoadMean: rounded(average(shelteredLoads), 7),
      exposedLoadMean: rounded(average(exposedLoads), 7),
      lowDrainageLoadMean: rounded(average(lowFlowLoads), 7),
      highDrainageLoadMean: rounded(average(highFlowLoads), 7),
    },
    solarGeometry: {
      sampleCount: plasterMetrics.length,
      lowExposureLuminance: rounded(average(plasterMetrics.filter((item) => item.sunExposure < 0.35).map((item) => item.luminance)), 6),
      highExposureLuminance: rounded(average(plasterMetrics.filter((item) => item.sunExposure >= 0.35).map((item) => item.luminance)), 6),
    },
    plinthThicknessM: rounded(median(plinthExtensions), 5),
    cornerProtectionThicknessM: rounded(median(cornerExtensions), 5),
    repairGeometry: {
      patchCount: repairs.length,
      boundedToHostCount: repairs.filter(boundedToHost).length,
    },
    geometryFingerprint: fnv1a(renderableTokens(system || model, (object) => system ? hasNamedAncestor(object, system.name) : false)),
  };
}

function deriveStairEvidence(model) {
  let stairRoot = null;
  model.traverse((object) => { if (object.userData?.semanticRole === 'daily-use-dogleg-stair') stairRoot = object; });
  if (!stairRoot) return null;
  const treads = [];
  const landingTypes = new Set();
  const rails = [];
  stairRoot.traverse((object) => {
    if (object.userData?.type === 'stair-tread' && object.isMesh) treads.push(object);
    if (/^stair-(?:lower|intermediate|upper)-landing$/.test(object.userData?.type || '') && object.isMesh) landingTypes.add(object.userData.type);
    if ((object.userData?.semanticRole === 'stair-handrail' || object.userData?.type === 'continuous-stair-handrail') && object.isMesh) rails.push(object);
  });
  const flightCounts = [1, 2].map((flight) => treads.filter((tread) => tread.userData?.flight === flight).length);
  const riserSamples = [];
  for (const flight of [1, 2]) {
    const heights = treads.filter((tread) => tread.userData?.flight === flight)
      .map((tread) => tread.getWorldPosition(new THREE.Vector3()).y).sort((a, b) => a - b);
    for (let index = 1; index < heights.length; index += 1) riserSamples.push(heights[index] - heights[index - 1]);
  }
  const riserHeight = median(riserSamples);
  const railBounds = rails.map((rail) => new THREE.Box3().setFromObject(rail));
  const railFlights = [...new Set(rails.map((rail) => {
    const match = String(rail.userData?.componentId || '').match(/-F([12])-/);
    return match ? Number(match[1]) : Number(rail.userData?.flight);
  }).filter(Number.isFinite))].sort();
  const railLengths = rails.map((rail) => {
    if (!rail.geometry.boundingBox) rail.geometry.computeBoundingBox();
    const local = rail.geometry.boundingBox;
    const start = new THREE.Vector3(0, local.min.y, 0).applyMatrix4(rail.matrixWorld);
    const end = new THREE.Vector3(0, local.max.y, 0).applyMatrix4(rail.matrixWorld);
    return start.distanceTo(end);
  });
  return {
    evidenceSource: 'live-tread-landing-and-handrail-geometry',
    componentId: stairRoot.userData?.componentId,
    flightStepCounts: flightCounts,
    totalRisers: flightCounts.reduce((sum, count) => sum + count, 0),
    landingCount: landingTypes.size,
    landingTypes: [...landingTypes].sort(),
    riserHeightM: rounded(riserHeight, 6),
    totalRiseM: rounded(riserHeight === null ? null : riserHeight * flightCounts.reduce((sum, count) => sum + count, 0), 5),
    handrailCount: rails.length,
    handrailFlights: railFlights,
    minimumHandrailSegmentLengthM: rounded(railLengths.length ? Math.min(...railLengths) : null, 5),
    handrailVerticalCoverageM: rounded(railBounds.length ? Math.max(...railBounds.map((box) => box.max.y)) - Math.min(...railBounds.map((box) => box.min.y)) : null, 5),
    continuousHandrails: rails.length >= 8 && railFlights.length === 2 && railLengths.every((length) => length > 0.08),
  };
}

function deriveOpeningEvidence(model) {
  const result = {
    doorLeafCount: 0, windowLeafCount: 0, assemblyCount: 0, pivotCount: 0,
    progress: [], anglesRad: [], leafBounds: [], surfaceRoles: {},
    deterministicSeeds: [], materialChannelFingerprints: [],
  };
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    const role = object.userData?.openingSurfaceRole;
    if (!role || !object.isMesh) return;
    result.surfaceRoles[role] = (result.surfaceRoles[role] || 0) + 1;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      if (material.userData?.yunnanSeed !== undefined) result.deterministicSeeds.push(material.userData.yunnanSeed);
      result.materialChannelFingerprints.push(JSON.stringify({
        role,
        materialRole: material.userData?.yunnanOpeningRole || null,
        seed: material.userData?.yunnanSeed ?? null,
        channels: Object.entries(material.userData?.yunnanSurfaceChannels || {}).sort(([a], [b]) => a.localeCompare(b)),
      }));
    });
  });
  model.traverse((assembly) => {
    if (!assembly.userData?.openingKind) return;
    const pivots = (assembly.userData.pivots || []).filter((pivot) => pivot?.isObject3D);
    result.assemblyCount += 1;
    result.pivotCount += pivots.length;
    const maximum = Math.abs(assembly.userData?.maxAngleRad || 1);
    const ratios = pivots.map((pivot) => Math.min(1, Math.abs(pivot.rotation.y) / maximum));
    result.progress.push(rounded(ratios.length ? Math.max(...ratios) : 0, 5));
    result.anglesRad.push(...pivots.map((pivot) => rounded(Math.abs(pivot.rotation.y), 5)));
    pivots.forEach((pivot) => {
      const bounds = new THREE.Box3().setFromObject(pivot);
      result.leafBounds.push([...bounds.min.toArray(), ...bounds.max.toArray()].map((value) => rounded(value, 4)));
    });
    if (assembly.userData.openingKind === 'door') result.doorLeafCount += pivots.length;
    else result.windowLeafCount += pivots.length;
  });
  result.evidenceSource = 'live-pivot-rotations-and-leaf-world-bounds';
  return result;
}

function interpolatePolyline(points, progress) {
  const lengths = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = points[index].distanceTo(points[index - 1]);
    lengths.push(length);
    total += length;
  }
  let remaining = THREE.MathUtils.clamp(progress, 0, 1) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      return points[index].clone().lerp(points[index + 1], lengths[index] ? remaining / lengths[index] : 0);
    }
    remaining -= lengths[index];
  }
  return points.at(-1)?.clone() || new THREE.Vector3();
}

function nearestRouteProgress(points, position) {
  let total = 0;
  const lengths = [];
  for (let index = 1; index < points.length; index += 1) {
    const length = points[index].distanceTo(points[index - 1]);
    lengths.push(length);
    total += length;
  }
  let bestDistance = Infinity;
  let bestProgress = 0;
  let traversed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const start = points[index];
    const delta = points[index + 1].clone().sub(start);
    const fraction = delta.lengthSq() ? THREE.MathUtils.clamp(position.clone().sub(start).dot(delta) / delta.lengthSq(), 0, 1) : 0;
    const candidate = start.clone().addScaledVector(delta, fraction);
    const distance = candidate.distanceTo(position);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProgress = total ? (traversed + lengths[index] * fraction) / total : 0;
    }
    traversed += lengths[index];
  }
  return { progress: bestProgress, distance: bestDistance };
}

function deriveVisitorEvidence(model) {
  let actor = null;
  model.traverse((object) => { if (object.userData?.type === 'qa-visitor') actor = object; });
  const sourcePoints = model.userData?.visitorRoute?.points || [];
  const points = sourcePoints.map((point) => point.isVector3 ? point.clone() : new THREE.Vector3().fromArray(point));
  if (!actor || points.length < 2) return null;
  model.updateMatrixWorld(true);
  const actorPosition = actor.getWorldPosition(new THREE.Vector3());
  const nearest = nearestRouteProgress(points, actorPosition);
  const wallBoxes = [];
  const supportBoxes = [];
  model.traverse((object) => {
    if (!object.isMesh) return;
    if (object.userData?.semanticRole === 'wall-core') wallBoxes.push(new THREE.Box3().setFromObject(object));
    if (object.userData?.walkable === true) supportBoxes.push(new THREE.Box3().setFromObject(object));
  });
  const routeLengthM = points.slice(1).reduce((total, point, index) => total + point.distanceTo(points[index]), 0);
  const auditSampleCount = Math.max(300, Math.ceil(routeLengthM / 0.08) + 1);
  const samples = Array.from({ length: auditSampleCount }, (_, index) => interpolatePolyline(points, index / (auditSampleCount - 1)));
  const collides = (point) => wallBoxes.some((box) => {
    const radius = 0.14;
    return point.x >= box.min.x - radius && point.x <= box.max.x + radius
      && point.z >= box.min.z - radius && point.z <= box.max.z + radius
      && point.y + 1.18 >= box.min.y && point.y <= box.max.y;
  });
  const supportGap = (point) => {
    const gaps = supportBoxes.filter((box) => point.x >= box.min.x - 0.20 && point.x <= box.max.x + 0.20 && point.z >= box.min.z - 0.20 && point.z <= box.max.z + 0.20)
      .map((box) => Math.abs(point.y - box.max.y)).filter((gap) => gap <= 0.45);
    return gaps.length ? Math.min(...gaps) : Infinity;
  };
  const supportGaps = samples.map(supportGap);
  const wallIntersectionCount = samples.filter(collides).length;
  const suspendedFrameCount = supportGaps.filter((gap) => !Number.isFinite(gap) || gap > 0.34).length;
  const stuckFrameCount = points.slice(1).filter((point, index) => point.distanceTo(points[index]) <= 1e-6).length;
  const relativeUpperFloor = deriveStairEvidence(model)?.totalRiseM;
  let runtimeRouteAudit = model.userData?.runtimeState?.visitorRouteAudit || null;
  if (!runtimeRouteAudit && typeof model.userData?.actions?.auditVisitorRoute === 'function') {
    runtimeRouteAudit = model.userData.actions.auditVisitorRoute(auditSampleCount);
  }
  return {
    evidenceSource: runtimeRouteAudit?.evidenceSource || 'live-actor-position-route-polyline-wall-aabbs-and-walkable-aabbs',
    worldPosition: actorPosition.toArray().map((value) => rounded(value, 6)),
    progress: rounded(nearest.progress, 6),
    routeDeviationM: rounded(nearest.distance, 6),
    complete: nearest.progress >= 0.995 && nearest.distance <= 0.02,
    absoluteElevationM: rounded(actorPosition.y, 5),
    relativeUpperFloorM: rounded(relativeUpperFloor, 5),
    reachedUpperFloor: nearest.progress >= 0.995 && Math.abs(actorPosition.y - points.at(-1).y) <= 0.02,
    routeSampleCount: runtimeRouteAudit?.sampleCount ?? samples.length,
    routeLengthM: rounded(routeLengthM, 6),
    maximumRouteSampleSpacingM: rounded(routeLengthM / Math.max(1, (runtimeRouteAudit?.sampleCount ?? samples.length) - 1), 6),
    wallIntersectionCount: runtimeRouteAudit?.wallIntersectionCount ?? wallIntersectionCount,
    openingCollisionCount: runtimeRouteAudit?.openingCollisionCount ?? null,
    railCollisionCount: runtimeRouteAudit?.railCollisionCount ?? null,
    suspendedFrameCount: runtimeRouteAudit?.suspendedFrameCount ?? suspendedFrameCount,
    stuckFrameCount: runtimeRouteAudit?.stuckFrameCount ?? stuckFrameCount,
    maximumSupportGapM: rounded(runtimeRouteAudit?.maxSupportGapM ?? Math.max(...supportGaps.filter(Number.isFinite)), 5),
    maximumRequestedSupportGapM: rounded(runtimeRouteAudit?.maxRequestedSupportGapM, 5),
    maximumAnchorSupportGapM: rounded(runtimeRouteAudit?.maxAnchorSupportGapM, 8),
    unsupportedAnchorCount: runtimeRouteAudit?.unsupportedAnchorCount ?? null,
    mismatchedAnchorSupportCount: runtimeRouteAudit?.mismatchedAnchorSupportCount ?? null,
    unsupportedSampleCount: runtimeRouteAudit ? runtimeRouteAudit.suspendedFrameCount : supportGaps.filter((gap) => !Number.isFinite(gap)).length,
    currentCollision: collides(actorPosition),
    currentSupportGapM: rounded(supportGap(actorPosition), 5),
    auditedStages: runtimeRouteAudit?.stages || [],
    auditedSupportIds: runtimeRouteAudit?.supportIds || [],
    browserPlayback: { ...(model.userData?.runtimeState?.browserPlayback || {}) },
    routeFingerprint: fnv1a(points.map((point) => point.toArray().map((value) => rounded(value, 5)).join(','))),
  };
}

function deriveSceneStats(model) {
  const stats = { meshCount: 0, instanceCount: 0, vertexCount: 0, triangleCount: 0, visibleDrawables: 0 };
  model.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const multiplier = object.isInstancedMesh ? object.count : 1;
    const position = object.geometry.getAttribute?.('position');
    stats.meshCount += 1;
    stats.instanceCount += object.isInstancedMesh ? object.count : 0;
    stats.vertexCount += (position?.count || 0) * multiplier;
    stats.triangleCount += (object.geometry.index ? object.geometry.index.count / 3 : (position?.count || 0) / 3) * multiplier;
    if (visibleInTree(object, model)) stats.visibleDrawables += 1;
  });
  Object.keys(stats).forEach((key) => { stats[key] = Math.round(stats[key]); });
  return stats;
}

function sceneLightFingerprint(scene) {
  const tokens = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isLight) return;
    tokens.push(JSON.stringify([
      object.type, object.color?.getHexString(), rounded(object.intensity, 5),
      Boolean(object.castShadow),
      ...object.getWorldPosition(new THREE.Vector3()).toArray().map((value) => rounded(value, 5)),
    ]));
  });
  return fnv1a(tokens);
}

function frozenV544RuntimeEvidence() {
  if (frozenV544RuntimeCache) return frozenV544RuntimeCache;
  const frozen = createFrozenV544Runtime({
    seed: 401,
    siteWidth: 12.6,
    siteDepth: 15.3,
    wallHeight: 4.7,
    floorHeight: 2.73,
    wallThickness: 0.55,
    wallTaper: 0.12,
    plinthHeight: 0.45,
    courtyardWidth: 5.2,
    courtyardDepth: 5.4,
    galleryWidth: 1.1,
    roofPitch: 0.46,
    roofEave: 0.58,
    roofThickness: 0.10,
  });
  frozen.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(frozen);
  const stats = deriveSceneStats(frozen);
  frozenV544RuntimeCache = Object.freeze({
    evidenceSource: 'executed-v544-runtime-with-whitespace-normalized-material',
    executable: true,
    sourceCommit: '323a893a791b1d064a1591dcbd2063f2f6a172c1',
    generatorBlobSha: '7b254beeffde1325329101b50784e694249081bd',
    sourceMaterialBlobSha: 'd16baad4ff18c5a9e97f7796f9e68d45cd6f9ff9',
    materialBlobSha: '0bcf25b39ebf65047b2f4628ce4ee9306395aa45',
    materialNormalization: 'removed-one-trailing-blank-line-for-repository-whitespace-gate',
    structuralFingerprint: fnv1a(renderableTokens(frozen, () => true, false)),
    surfaceFingerprint: fnv1a(renderableTokens(frozen, () => true, true)),
    worldBounds: [...bounds.min.toArray(), ...bounds.max.toArray()].map((value) => rounded(value, 5)),
    stats,
    options: Object.fromEntries(Object.entries(frozen.userData?.options || {}).filter(([, value]) => typeof value !== 'object')),
  });
  disposeFrozenV544Runtime(frozen);
  return frozenV544RuntimeCache;
}

function inspect(viewName = 'production') {
  const view = viewName === 'baseline' ? baselineView : productionView;
  const model = view.model();
  model.updateMatrixWorld(true);
  const roofSystem = deriveRoofEvidence(model);
  const roofGeometryDiagnostics = model.userData.roofGeometryDiagnostics || null;
  const roofUnits = roofSystem.roofUnits;
  const walls = deriveWallEvidence(model);
  const interactionGeometry = typeof model.userData?.actions?.inspectInteractions === 'function'
    ? model.userData.actions.inspectInteractions()
    : model.userData?.interactionGeometry || null;
  const stairEvidence = deriveStairEvidence(model) || {};
  const stair = {
    ...stairEvidence,
    continuousHandrails: interactionGeometry?.stair?.continuousHandrails ?? stairEvidence.continuousHandrails,
    geometryAudit: interactionGeometry?.stair || null,
  };
  const openings = {
    ...deriveOpeningEvidence(model),
    geometryAudit: interactionGeometry?.openings || [],
    duplicateComponentIds: interactionGeometry?.duplicateComponentIds || [],
  };
  const visitor = deriveVisitorEvidence(model);
  const camera = {
    position: view.camera.position.toArray().map((value) => rounded(value, 5)),
    target: view.controls.target.toArray().map((value) => rounded(value, 5)),
    fov: rounded(view.camera.fov, 5),
  };
  const cameraFingerprint = JSON.stringify({
    position: camera.position.map((value) => value.toFixed(4)),
    target: camera.target.map((value) => value.toFixed(4)),
    fov: camera.fov,
  });
  const drawingBuffer = view.renderer.getDrawingBufferSize(new THREE.Vector2());
  const canvasFingerprint = JSON.stringify({
    cssWidth: view.element.clientWidth,
    cssHeight: view.element.clientHeight,
    drawingBufferWidth: drawingBuffer.x,
    drawingBufferHeight: drawingBuffer.y,
    pixelRatio: view.renderer.getPixelRatio(),
  });
  const structuralFingerprint = fnv1a(renderableTokens(model, (object) => {
    if (hasNamedAncestor(object, 'V550_wall_surface_system')) return false;
    const rootLayer = ancestorValue(object, 'layer', model);
    const roofLayer = ancestorValue(object, 'roofLayerId', model);
    if (['stone-and-ground', 'walls', 'timber-frame', 'doors-windows'].includes(rootLayer)) return true;
    return rootLayer === 'roof-production' && ['purlins', 'rafters', 'roofUnderlay'].includes(roofLayer);
  }, false));
  const surfaceFingerprint = fnv1a(renderableTokens(model, (object) => (
    (view.baseline && ancestorValue(object, 'layer', model) === 'walls')
    || (!view.baseline && hasNamedAncestor(object, 'V550_wall_surface_system'))
    || ['panTileCourses', 'coverTileCourses', 'eaveCapsAndDrips', 'ridgeAndClosures']
      .includes(ancestorValue(object, 'roofLayerId', model))
  )));
  const fullGeometryFingerprint = fnv1a(renderableTokens(model, () => true, false));
  const displayedRuntimeFingerprint = fnv1a(renderableTokens(model, () => true, true));
  const comparisonInputFingerprint = fnv1a([
    JSON.stringify(SHARED_COMPARISON_OPTIONS),
    cameraFingerprint,
    canvasFingerprint,
    sceneLightFingerprint(view.scene),
  ]);
  const rootLayers = Object.fromEntries(model.children.filter((child) => child.userData?.layer).map((child) => [child.userData.layer, child]));
  const completeBuilding = ROOT_LAYER_IDS.every((id) => rootLayers[id] && countRenderable(rootLayers[id]) > 0)
    && roofSystem.complete && walls.hostCount > 0 && stair?.totalRisers === 16;
  const cutaway = ROOT_LAYER_IDS.some((id) => rootLayers[id] && !rootLayers[id].visible);
  const sceneStats = deriveSceneStats(model);
  return {
    version: view.baseline ? '5.4.4' : '5.5.0',
    view: viewName,
    profileId: view.profile().id,
    evidenceContract: 'live-geometry-v1',
    completeBuilding,
    cutaway,
    structuralFingerprint,
    surfaceFingerprint,
    fullGeometryFingerprint,
    displayedRuntimeFingerprint,
    comparisonInputFingerprint,
    camera,
    cameraFingerprint,
    cameraPresetId: activeCameraId,
    cameraEvidence: activeCameraEvidence ? { ...activeCameraEvidence } : null,
    qaDisplayState: { ...qaDisplaySummary },
    canvasFingerprint,
    lightFingerprint: sceneLightFingerprint(view.scene),
    comparisonContract: { ...(model.userData.comparisonContract || {}) },
    baselineProvenance: view.baseline ? V544_FROZEN_BASELINE : null,
    frozenV544Runtime: frozenV544RuntimeEvidence(),
    roofSystem: { ...roofSystem, roofUnits: undefined },
    roofGeometryDiagnostics,
    roofUnits,
    walls,
    stair,
    openings,
    visitor,
    interactionGeometry,
    renderer: {
      depthBits: view.renderer.getContext().getParameter(view.renderer.getContext().DEPTH_BITS),
      antialias: Boolean(view.renderer.getContext().getContextAttributes()?.antialias),
      shadowsEnabled: Boolean(view.renderer.shadowMap.enabled),
      pixelRatio: view.renderer.getPixelRatio(),
      triangles: view.renderer.info.render.triangles,
      drawCalls: view.renderer.info.render.calls,
      instanceCount: sceneStats.instanceCount,
      meshCount: sceneStats.meshCount,
    },
    stats: sceneStats,
    timings: { loadMs: performance.now() - bootStarted, firstFrameMs },
    fps: sampledFps,
    performanceEvidence: performanceEvidence(),
    runtimeState: { ...(model.userData.runtimeState || {}) },
  };
}

updateStatus();
setTimeout(() => {
  window.__SURFACE_QA__.ready = true;
  updateStatus();
}, 300);

window.__SURFACE_QA__ = {
  ready: false,
  version: '5.5.0',
  seedUrl: seedUrl.href,
  inspect,
  setPreset,
  setCamera,
  setRoofExploded,
  setMode: applyMode,
  setOpeningsProgress: setOpenings,
  setVisitorProgress: setVisitor,
  playVisitorRoute,
  setQARouteEvidence,
  setQADisplayState,
  restoreQADisplayState,
  performanceEvidence,
  reset,
};
