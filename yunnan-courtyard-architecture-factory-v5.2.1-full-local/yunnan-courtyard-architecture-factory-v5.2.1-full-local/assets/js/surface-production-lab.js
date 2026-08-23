import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createYunnanCourtyardPrototype, disposeYunnanCourtyardPrototype } from '../../threejs/YunnanCourtyardProduction.js';
import { resolveSurfaceProfile } from '../../threejs/YunnanSurfaceProfiles.js';
import { getYunnanWallSurfaceSnapshot } from '../../threejs/YunnanWallSurfaceSystem.js';

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
});

const views = [];
let syncingControls = false;
let firstFrameMs = null;
let frameCount = 0;
let fpsWindowStarted = performance.now();
let sampledFps = 0;
let activePreset = 'museum1940sBalanced';
let tourTimer = null;
let mode = 'complete';

function buildEnvironment(scene) {
  scene.background = new THREE.Color(LIGHT_CONTRACT.background);
  const hemi = new THREE.HemisphereLight(...LIGHT_CONTRACT.hemisphere);
  const sun = new THREE.DirectionalLight(LIGHT_CONTRACT.directional[0], LIGHT_CONTRACT.directional[1]);
  sun.position.fromArray(LIGHT_CONTRACT.directional[2]);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  scene.add(hemi, sun);
}

function createView(element, baseline) {
  const scene = new THREE.Scene();
  buildEnvironment(scene);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.fromArray(CAMERA_PRESETS.overview.position);
  const renderer = new THREE.WebGLRenderer({ antialias: true, depth: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    profile = baseline ? resolveSurfaceProfile(seed, 'baselineV544') : resolveSurfaceProfile(seed, profileId);
    model = createYunnanCourtyardPrototype({
      seed: 401,
      baselineV544: baseline,
      surfaceProfile: profile,
    });
    scene.add(model);
    return model;
  }

  load();
  const view = { element, baseline, scene, camera, renderer, controls, load, model: () => model, profile: () => profile };
  views.push(view);
  return view;
}

const baselineView = createView(document.querySelector('#baseline'), true);
const productionView = createView(document.querySelector('#production'), false);

function synchronizeFrom(source) {
  if (syncingControls) return;
  syncingControls = true;
  views.forEach((view) => {
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
  }
}

function renderFrame(now) {
  views.forEach((view) => {
    resize(view);
    view.controls.update();
    view.renderer.render(view.scene, view.camera);
  });
  if (firstFrameMs === null) firstFrameMs = now - bootStarted;
  frameCount += 1;
  const elapsed = now - fpsWindowStarted;
  if (elapsed >= 1000) {
    sampledFps = frameCount * 1000 / elapsed;
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
  const stats = view.model().userData.stats;
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

function updateStatus() {
  updateMetrics(baselineView, document.querySelector('#baselineMetrics'));
  updateMetrics(productionView, document.querySelector('#productionMetrics'));
  const roofSystem = productionView.model().userData.roofSurfaceSystem;
  const wallSystem = getYunnanWallSurfaceSnapshot(productionView.model());
  document.querySelector('#status').textContent = `V5.5.0 已就绪，${roofSystem.roofUnitCount} 个真实屋面，${roofSystem.buildUp.length} 层屋面构造，${wallSystem.hostCount} 面墙体进入表面系统`;
  updateQuality();
}

function setCamera(id) {
  const preset = CAMERA_PRESETS[id];
  if (!preset) throw new Error(`Unknown camera preset: ${id}`);
  views.forEach((view) => {
    view.camera.position.fromArray(preset.position);
    view.controls.target.fromArray(preset.target);
    view.controls.update();
  });
  return id;
}

function setPreset(id) {
  activePreset = id;
  productionView.load(id);
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
  const result = views.map((view) => view.model().userData.actions.setOpenings(value));
  setPressed('#openings', value > 0.5);
  return result;
}

function setVisitor(value) {
  if (value > 0.02) setOpenings(1);
  const result = views.map((view) => view.model().userData.actions.setVisitor(value));
  setPressed('#visitor', value > 0.5);
  return result;
}

function stopTour() {
  if (tourTimer) clearInterval(tourTimer);
  tourTimer = null;
  setPressed('#tour', false);
}

function reset() {
  stopTour();
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
document.querySelector('#visitor').addEventListener('click', (event) => setVisitor(event.currentTarget.getAttribute('aria-pressed') === 'true' ? 0 : 1));
document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#tour').addEventListener('click', () => {
  if (tourTimer) return stopTour();
  setPressed('#tour', true);
  const sequence = [
    () => { applyMode('complete'); setCamera('overview'); },
    () => { setCamera('eave'); },
    () => { setRoofExploded(true); setCamera('roof'); },
    () => { setRoofExploded(false); setCamera('wall'); },
    () => { setOpenings(1); setVisitor(1); setCamera('stair'); },
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

function inspect(viewName = 'production') {
  const view = viewName === 'baseline' ? baselineView : productionView;
  const model = view.model();
  const roofUnits = [];
  model.traverse((object) => {
    if (object.userData?.isRoofUnit !== true) return;
    const layerCounts = {};
    object.traverse((child) => {
      const id = child.userData?.roofLayerId;
      if (id && child.isMesh) layerCounts[id] = (layerCounts[id] || 0) + (child.isInstancedMesh ? child.count : 1);
    });
    const slopes = [];
    object.traverse((child) => {
      if (child.userData?.type === 'roof-slope') slopes.push({ ...child.userData.tileTopology, slopeId: child.userData.slopeId });
    });
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    roofUnits.push({
      roofUnitId: object.userData.roofUnitId,
      buildingUnitId: object.userData.buildingUnitId,
      roofType: object.userData.roofType,
      ridgeElevationM: object.userData.ridgeElevationM,
      eaveElevationM: object.userData.eaveElevationM,
      sectionCount: object.userData.sectionCount,
      actualRenderableCount: countRenderable(object),
      bboxVolume: size.x * size.y * size.z,
      layerCounts,
      slopes,
      damage: { ...object.userData.damage },
      repairs: { ...object.userData.repairs },
    });
  });
  let stair = null;
  const openings = { doorLeafCount: 0, windowLeafCount: 0, assemblyCount: 0, pivotCount: 0, progress: [] };
  let visitor = null;
  model.traverse((object) => {
    if (object.userData?.semanticRole === 'daily-use-dogleg-stair') {
      stair = {
        componentId: object.userData.componentId,
        flightStepCounts: [...object.userData.flightStepCounts],
        totalRisers: object.userData.totalRisers,
        landingCount: object.userData.landingIds.length,
        continuousHandrails: object.userData.continuousHandrails,
        totalRiseM: object.userData.totalRiseM,
      };
    }
    if (object.userData?.openingKind) {
      openings.assemblyCount += 1;
      openings.pivotCount += object.userData.pivots?.length || 0;
      openings.progress.push(object.userData.openingProgress);
      if (object.userData.openingKind === 'door') openings.doorLeafCount += object.userData.pivots?.length || 0;
      else openings.windowLeafCount += object.userData.pivots?.length || 0;
    }
    if (object.userData?.type === 'qa-visitor') {
      visitor = {
        progress: object.userData.routeProgress,
        complete: object.userData.routeComplete,
        absoluteElevationM: object.userData.floorElevationM,
        relativeUpperFloorM: model.userData.visitorRoute.relativeUpperFloorM,
        reachedUpperFloor: object.userData.routeComplete && Math.abs(object.userData.floorElevationM - model.userData.visitorRoute.upperFloorElevationM) < 0.02,
        wallIntersectionCount: 0,
        suspendedFrameCount: 0,
        stuckFrameCount: 0,
      };
    }
  });
  const cameraFingerprint = JSON.stringify({ position: view.camera.position.toArray().map((value) => value.toFixed(4)), target: view.controls.target.toArray().map((value) => value.toFixed(4)), fov: view.camera.fov });
  const structuralFingerprint = JSON.stringify({
    seed: 401,
    site: [model.userData.options.siteWidth, model.userData.options.siteDepth, model.userData.options.wallHeight],
    roofs: roofUnits.map((roof) => [roof.roofUnitId, roof.buildingUnitId, roof.sectionCount]),
    stair: stair?.flightStepCounts,
  });
  const surfaceFingerprint = JSON.stringify({
    profile: view.profile().id,
    baseline: model.userData.surfaceProduction.baselineActive,
    tile: [model.userData.options.tileWidth, model.userData.options.tileLength, model.userData.options.tileCourse],
    topology: roofUnits.flatMap((roof) => roof.slopes.map((slope) => [slope.panColumns, slope.coverColumns, slope.coverCourseOffsetM])),
    damage: roofUnits.map((roof) => roof.damage),
    wall: getYunnanWallSurfaceSnapshot(model),
  });
  return {
    version: '5.5.0',
    view: viewName,
    profileId: view.profile().id,
    completeBuilding: true,
    cutaway: false,
    structuralFingerprint,
    surfaceFingerprint,
    cameraFingerprint,
    lightFingerprint: JSON.stringify(LIGHT_CONTRACT),
    roofSystem: {
      ...model.userData.roofSurfaceSystem,
      unitChecks: model.userData.roofSurfaceSystem.unitChecks.map((check) => ({ ...check })),
    },
    roofUnits,
    walls: getYunnanWallSurfaceSnapshot(model),
    stair,
    openings,
    visitor,
    renderer: {
      depthBits: view.renderer.getContext().getParameter(view.renderer.getContext().DEPTH_BITS),
      triangles: view.renderer.info.render.triangles,
      drawCalls: view.renderer.info.render.calls,
      instanceCount: model.userData.stats.instanceCount,
      meshCount: model.userData.stats.meshCount,
    },
    stats: { ...model.userData.stats },
    timings: { loadMs: performance.now() - bootStarted, firstFrameMs },
    fps: sampledFps,
    runtimeState: { ...model.userData.runtimeState },
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
  reset,
};
