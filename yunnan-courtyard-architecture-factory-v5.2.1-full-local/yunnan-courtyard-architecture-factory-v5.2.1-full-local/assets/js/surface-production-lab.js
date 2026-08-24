import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  YUNNAN_COURTYARD_DEFAULTS,
  createYunnanCourtyardPrototype,
  disposeYunnanCourtyardPrototype,
} from '../../threejs/YunnanCourtyardProduction.js';
import {
  createYunnanCourtyardPrototype as createFrozenV544Courtyard,
  disposeYunnanCourtyardPrototype as disposeFrozenV544Courtyard,
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
const V544_COMPARISON_OPTIONS = Object.freeze({
  ...SHARED_COMPARISON_OPTIONS,
  ...V544_FROZEN_BASELINE.tileProfile,
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
let fpsWindowStarted = performance.now();
let sampledFps = 0;
let activePreset = 'museum1940sBalanced';
let tourTimer = null;
let visitorAnimationFrame = null;
let mode = 'complete';
let frozenV544RuntimeCache = null;

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
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
      if (baseline) disposeFrozenV544Courtyard(model);
      else disposeYunnanCourtyardPrototype(model);
    }
    profile = baseline
      ? { ...resolveSurfaceProfile(seed, 'baselineV544'), provenance: V544_FROZEN_BASELINE }
      : resolveSurfaceProfile(seed, profileId);
    model = baseline
      ? createFrozenV544Courtyard(V544_COMPARISON_OPTIONS)
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
      if (!view.baseline) renderedProduction = true;
    }
  });
  if (firstFrameMs === null) {
    firstFrameMs = now - bootStarted;
    fpsWindowStarted = now;
    frameCount = 0;
  }
  if (renderedProduction) frameCount += 1;
  const elapsed = now - fpsWindowStarted;
  if (elapsed >= 1500) {
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

function updateStatus() {
  updateMetrics(baselineView, document.querySelector('#baselineMetrics'));
  updateMetrics(productionView, document.querySelector('#productionMetrics'));
  const model = productionView.model();
  const roofSystem = deriveRoofEvidence(model);
  const wallSystem = deriveWallEvidence(model);
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

function playVisitorRoute(durationMs = 5600) {
  stopVisitorAnimation();
  setOpenings(1);
  applyVisitorProgress(0);
  const duration = Math.max(1200, Number(durationMs) || 5600);
  const startedAt = performance.now();
  const evidence = {
    evidenceSource: 'browser-requestAnimationFrame-plus-generator-raycast',
    durationRequestedMs: duration,
    frameCount: 0,
    uniquePositions: new Set(),
    stages: new Set(),
    completed: false,
  };
  views.forEach((view) => {
    view.model().userData.runtimeState ||= {};
    view.model().userData.runtimeState.browserPlayback = {
      evidenceSource: evidence.evidenceSource, durationRequestedMs: duration,
      frameCount: 0, uniquePositionCount: 0, stages: [], completed: false,
    };
  });
  return new Promise((resolve) => {
    const tick = (now) => {
      const progress = THREE.MathUtils.clamp((now - startedAt) / duration, 0, 1);
      const snapshots = applyVisitorProgress(progress);
      const productionSnapshot = snapshots[1] || snapshots[0];
      evidence.frameCount += 1;
      if (productionSnapshot?.position) {
        evidence.uniquePositions.add(productionSnapshot.position.map((value) => rounded(value, 4)).join(','));
      }
      if (productionSnapshot?.stage) evidence.stages.add(productionSnapshot.stage);
      const current = {
        evidenceSource: evidence.evidenceSource,
        durationRequestedMs: duration,
        elapsedMs: now - startedAt,
        frameCount: evidence.frameCount,
        uniquePositionCount: evidence.uniquePositions.size,
        stages: [...evidence.stages],
        completed: progress >= 1 && productionSnapshot?.complete === true,
      };
      views.forEach((view) => {
        view.model().userData.runtimeState ||= {};
        view.model().userData.runtimeState.browserPlayback = { ...current };
      });
      if (progress >= 1) {
        visitorAnimationFrame = null;
        setPressed('#visitor', true);
        resolve(current);
        return;
      }
      visitorAnimationFrame = requestAnimationFrame(tick);
    };
    visitorAnimationFrame = requestAnimationFrame(tick);
  });
}

function stopTour() {
  if (tourTimer) clearInterval(tourTimer);
  tourTimer = null;
  stopVisitorAnimation();
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
      if (colors) tokens.push(`colors:${Array.from(colors, (value) => rounded(value, 4)).join(',')}`);
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
      ridgeSemanticCounts[semantic] = (ridgeSemanticCounts[semantic] || 0) + 1;
      ridgeBounds.union(new THREE.Box3().setFromObject(child));
    });
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
        geometryCount: ridgeMeshes.length,
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
      layerCounts[layerId] = (layerCounts[layerId] || 0) + (object.isInstancedMesh ? object.count : 1);
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
  const samples = Array.from({ length: 193 }, (_, index) => interpolatePolyline(points, index / 192));
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
    runtimeRouteAudit = model.userData.actions.auditVisitorRoute(193);
  }
  return {
    evidenceSource: runtimeRouteAudit?.evidenceSource || 'live-actor-position-route-polyline-wall-aabbs-and-walkable-aabbs',
    progress: rounded(nearest.progress, 6),
    routeDeviationM: rounded(nearest.distance, 6),
    complete: nearest.progress >= 0.995 && nearest.distance <= 0.02,
    absoluteElevationM: rounded(actorPosition.y, 5),
    relativeUpperFloorM: rounded(relativeUpperFloor, 5),
    reachedUpperFloor: nearest.progress >= 0.995 && Math.abs(actorPosition.y - points.at(-1).y) <= 0.02,
    routeSampleCount: runtimeRouteAudit?.sampleCount ?? samples.length,
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
  const frozen = createFrozenV544Courtyard({
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
    evidenceSource: 'executed-exact-v544-git-blob-modules',
    executable: true,
    sourceCommit: '323a893a791b1d064a1591dcbd2063f2f6a172c1',
    generatorBlobSha: '7b254beeffde1325329101b50784e694249081bd',
    materialBlobSha: 'd16baad4ff18c5a9e97f7796f9e68d45cd6f9ff9',
    structuralFingerprint: fnv1a(renderableTokens(frozen, () => true, false)),
    surfaceFingerprint: fnv1a(renderableTokens(frozen, () => true, true)),
    worldBounds: [...bounds.min.toArray(), ...bounds.max.toArray()].map((value) => rounded(value, 5)),
    stats,
    options: Object.fromEntries(Object.entries(frozen.userData?.options || {}).filter(([, value]) => typeof value !== 'object')),
  });
  disposeFrozenV544Courtyard(frozen);
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
  const cameraFingerprint = JSON.stringify({ position: view.camera.position.toArray().map((value) => value.toFixed(4)), target: view.controls.target.toArray().map((value) => value.toFixed(4)), fov: view.camera.fov });
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
  const surfaceFingerprint = fnv1a(renderableTokens(model, (object) => view.baseline
    ? ancestorValue(object, 'layer', model) === 'roof-tiles' || ancestorValue(object, 'layer', model) === 'walls'
    : hasNamedAncestor(object, 'V550_wall_surface_system')
      || ['panTileCourses', 'coverTileCourses', 'eaveCapsAndDrips', 'ridgeAndClosures'].includes(ancestorValue(object, 'roofLayerId', model))));
  const fullGeometryFingerprint = fnv1a(renderableTokens(model, () => true, false));
  const displayedRuntimeFingerprint = fnv1a(renderableTokens(model, () => true, true));
  const comparisonInputFingerprint = fnv1a([
    JSON.stringify(SHARED_COMPARISON_OPTIONS),
    cameraFingerprint,
    canvasFingerprint,
    sceneLightFingerprint(view.scene),
  ]);
  const rootLayers = Object.fromEntries(model.children.filter((child) => child.userData?.layer).map((child) => [child.userData.layer, child]));
  const completeBuilding = view.baseline
    ? ['stone-and-ground', 'walls', 'timber-frame', 'roof-tiles', 'doors-windows']
      .every((id) => rootLayers[id] && countRenderable(rootLayers[id]) > 0)
      && deriveSceneStats(model).meshCount > 100
    : ROOT_LAYER_IDS.every((id) => rootLayers[id] && countRenderable(rootLayers[id]) > 0)
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
    cameraFingerprint,
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
  reset,
};
