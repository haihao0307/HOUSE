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

const RESPONSIVE_RENDER_QUALITY = Object.freeze(window.innerWidth <= 520
  ? {
    profileId: 'mobile-closed-shell-5-span',
    tileArcSegments: 5,
    viewportRule: 'window.innerWidth<=520-css-px',
  }
  : {
    profileId: 'desktop-closed-shell-5-span',
    tileArcSegments: 5,
    viewportRule: 'window.innerWidth>520-css-px',
  });

const SHARED_COMPARISON_OPTIONS = Object.freeze({
  seed: V544_FROZEN_BASELINE.comparisonSeed,
  ...V544_FROZEN_BASELINE.buildingParameters,
  tileArcSegments: RESPONSIVE_RENDER_QUALITY.tileArcSegments,
  renderQualityProfileId: RESPONSIVE_RENDER_QUALITY.profileId,
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
let sustainedFpsEvidence = null;
let activePreset = 'museum1940sBalanced';
let tourTimer = null;
let visitorPlaybackState = null;
let lastCompletedVisitorPlayback = null;
let mode = 'complete';
let frozenV544RuntimeCache = null;
let activeCameraId = 'overview';
let activeCameraEvidence = null;
let qaRouteOverlay = null;
let qaDisplayTransaction = null;
let qaDisplaySummary = { mode: 'none', active: false };
let qaRoofIsolation = null;
let qaRoofLayerIsolation = null;
let qaAbutmentIsolation = null;
let activeLightingMode = 'default';
let qaCapturePixelRatio = null;
let qaFeatureCalloutState = null;

function defaultPixelRatioCap() {
  // The complete scene is fill-rate bound under SwiftShader even after
  // static wall batching. Keep every live mesh, roof layer, material,
  // weathering path and interaction while bounding the larger desktop
  // renderbuffer to 20% CSS resolution and the compact mobile buffer to 30%.
  // The five-segment closed tile shell remains the topology-proven quality
  // floor on both branches. QA evidence closeups and the dedicated mobile
  // layout capture explicitly switch to DPR 1.
  return window.innerWidth > 520 ? 0.2 : 0.3;
}

function buildEnvironment(scene) {
  scene.background = new THREE.Color(LIGHT_CONTRACT.background);
  const hemi = new THREE.HemisphereLight(...LIGHT_CONTRACT.hemisphere);
  const sun = new THREE.DirectionalLight(LIGHT_CONTRACT.directional[0], LIGHT_CONTRACT.directional[1]);
  sun.position.fromArray(LIGHT_CONTRACT.directional[2]);
  sun.castShadow = LIGHT_CONTRACT.shadows;
  scene.add(hemi, sun);
}

function qaLightingEvidence() {
  return activeLightingMode === 'raking'
    ? {
      mode: 'raking', hemisphereIntensity: 0.92, directionalIntensity: 4.1,
      // Negative X lights both the closed north-window face and the same
      // physical shutter after it swings into the courtyard; the prior +X
      // light put the open leaf's visible face entirely in backlight.
      directionalPosition: [-7.5, 8.5, -11.5], toneMappingExposure: 1.14,
      intent: 'real-geometry-and-material-raking-light-without-material-mutation',
    }
    : {
      mode: 'default', hemisphereIntensity: LIGHT_CONTRACT.hemisphere[2],
      directionalIntensity: LIGHT_CONTRACT.directional[1],
      directionalPosition: [...LIGHT_CONTRACT.directional[2]], toneMappingExposure: 1,
      intent: 'shared-default-A-B-light-contract',
    };
}

function setQACapturePixelRatio(value = null) {
  const requested = value === null ? null : Number(value);
  if (requested !== null && (!Number.isFinite(requested) || requested < 0.2 || requested > 2)) {
    throw new Error(`Invalid QA capture pixel ratio: ${value}`);
  }
  qaCapturePixelRatio = requested;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const defaultCap = defaultPixelRatioCap();
  const target = Math.min(devicePixelRatio, requested ?? defaultCap);
  views.forEach((view) => {
    view.renderer.setPixelRatio(target);
    view.renderer.setSize(
      Math.max(1, view.element.clientWidth),
      Math.max(1, view.element.clientHeight),
      false,
    );
    view.camera.aspect = Math.max(1, view.element.clientWidth) / Math.max(1, view.element.clientHeight);
    view.camera.updateProjectionMatrix();
    if (view.model()?.userData?.runtimeState) {
      view.model().userData.runtimeState.qaCaptureResolution = {
        mode: requested === null ? 'default-interactive' : 'high-resolution-visual-evidence',
        requestedPixelRatio: requested,
        appliedPixelRatio: target,
        defaultInteractivePixelRatioCap: defaultCap,
      };
    }
    view.needsRender = true;
  });
  return {
    mode: requested === null ? 'default-interactive' : 'high-resolution-visual-evidence',
    requestedPixelRatio: requested,
    appliedPixelRatio: target,
    defaultInteractivePixelRatioCap: defaultCap,
    devicePixelRatio,
  };
}

function setQALighting(modeId = 'default') {
  if (!['default', 'raking'].includes(modeId)) throw new Error(`Unknown QA lighting mode: ${modeId}`);
  activeLightingMode = modeId;
  const evidence = qaLightingEvidence();
  views.forEach((view) => {
    const hemisphere = view.scene.children.find((object) => object.isHemisphereLight);
    const directional = view.scene.children.find((object) => object.isDirectionalLight);
    if (hemisphere) hemisphere.intensity = evidence.hemisphereIntensity;
    if (directional) {
      directional.intensity = evidence.directionalIntensity;
      directional.position.fromArray(evidence.directionalPosition);
    }
    view.renderer.toneMappingExposure = evidence.toneMappingExposure;
    if (view.model()?.userData?.runtimeState) view.model().userData.runtimeState.qaLighting = { ...evidence };
    view.needsRender = true;
  });
  return { ...evidence };
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
  const qualityPixelRatio = defaultPixelRatioCap();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityPixelRatio));
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
      sharedRenderQuality: true,
      renderQuality: { ...RESPONSIVE_RENDER_QUALITY },
      displayedBaselineRuntime: 'shared-current-structure-with-executed-frozen-v544-material-factory',
      frozenRuntimeRole: 'displayed-material-runtime-and-independent-full-generator-provenance',
      baselineMaterialFactory: 'threejs/v544/YunnanMaterialFactory.js',
      productionMaterialFactory: 'threejs/YunnanMaterialFactory.js',
      baselineTileProfile: { ...V544_FROZEN_BASELINE.tileProfile },
      productionTileProfile: { ...V550_TILE_PROFILE },
    };
    if (model.userData.runtimeState) model.userData.runtimeState.qaLighting = qaLightingEvidence();
    scene.add(model);
    // All building matrices are static between explicit interaction actions.
    // Cache them here rather than traversing the complete model before every
    // renderer.render; live opening and visitor actions update their matrices.
    scene.updateMatrixWorld(true);
    return model;
  }

  load();
  scene.matrixWorldAutoUpdate = false;
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
  prepareVisitorPlaybackFrame(now);
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
        captureVisitorPlaybackFrame(now);
      }
    }
  });
  updateQAFeatureCallouts();
  if (firstFrameMs === null && renderedProduction) {
    const firstProductionRenderCompletedAt = performance.now();
    firstFrameMs = firstProductionRenderCompletedAt - bootStarted;
    fpsWindowStarted = firstProductionRenderCompletedAt;
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
  const fps = sustainedFpsEvidence?.fps ?? sampledFps;
  const label = sustainedFpsEvidence ? 'Sustained FPS' : 'FPS';
  document.querySelector('#quality').textContent = `${label} ${fps.toFixed(1)} · ${compactNumber(stats.triangleCount)} triangles · ${stats.instanceCount} instances · ${stats.drawCallEstimate} draw calls`;
}

function measureProductionFps(sampleMs = 5000, warmupMs = 1200) {
  const duration = Math.max(2500, Number(sampleMs) || 5000);
  const warmup = Math.max(0, Number(warmupMs) || 0);
  return new Promise((resolve) => {
    const requestedAt = performance.now();
    let sampleStartedAt = null;
    let startingSerial = null;
    const probe = (now) => {
      if (sampleStartedAt === null) {
        if (now - requestedAt < warmup) {
          requestAnimationFrame(probe);
          return;
        }
        sampleStartedAt = now;
        startingSerial = productionRenderSerial;
      }
      const elapsedMs = now - sampleStartedAt;
      if (elapsedMs < duration) {
        requestAnimationFrame(probe);
        return;
      }
      const renderedFrames = productionRenderSerial - startingSerial;
      const result = {
        evidenceSource: 'production-render-serial-over-requestAnimationFrame-timestamps',
        warmupMs: rounded(sampleStartedAt - requestedAt, 4),
        elapsedMs: rounded(elapsedMs, 4),
        startRenderFrameId: startingSerial,
        endRenderFrameId: productionRenderSerial,
        renderedFrames,
        fps: rounded(renderedFrames * 1000 / elapsedMs, 5),
      };
      sustainedFpsEvidence = result;
      sampledFps = result.fps;
      productionView.model().userData.runtimeState ||= {};
      productionView.model().userData.runtimeState.sustainedFpsEvidence = { ...result };
      updateQuality();
      resolve(result);
    };
    requestAnimationFrame(probe);
  });
}

function waitForNextProductionRender(timeoutMs = 15000) {
  const afterRenderFrameId = productionRenderSerial;
  const startedAt = performance.now();
  productionView.needsRender = true;
  return new Promise((resolve, reject) => {
    const probe = (now) => {
      if (productionRenderSerial > afterRenderFrameId) {
        resolve({
          capturedAfterProductionRender: true,
          previousRenderFrameId: afterRenderFrameId,
          renderFrameId: productionRenderSerial,
          timestampMs: rounded(now, 4),
        });
        return;
      }
      if (now - startedAt >= timeoutMs) {
        reject(new Error(`Production render did not advance after frame ${afterRenderFrameId}`));
        return;
      }
      requestAnimationFrame(probe);
    };
    requestAnimationFrame(probe);
  });
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

function worldVertexProjectionEvidence(object, axis, indices = null) {
  const position = object.geometry?.getAttribute?.('position');
  if (!position?.count || !axis?.isVector3 || axis.lengthSq() <= 1e-12) return null;
  const projectionAxis = axis.clone().normalize();
  const local = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const point = new THREE.Vector3();
  const selected = object.isInstancedMesh
    ? (indices || Array.from({ length: object.count }, (_, index) => index)) : [null];
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let sampleCount = 0;
  selected.forEach((instanceIndex) => {
    if (object.isInstancedMesh) {
      object.getMatrixAt(instanceIndex, local);
      world.multiplyMatrices(object.matrixWorld, local);
    } else world.copy(object.matrixWorld);
    for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
      const projection = point.fromBufferAttribute(position, vertexIndex)
        .applyMatrix4(world).dot(projectionAxis);
      minimum = Math.min(minimum, projection);
      maximum = Math.max(maximum, projection);
      sampleCount += 1;
    }
  });
  return Number.isFinite(minimum) && Number.isFinite(maximum)
    ? { minimum, maximum, sampleCount } : null;
}

function instanceColorEvidence(batch, index) {
  const attribute = batch.instanceColor;
  if (!attribute || index < 0 || index >= attribute.count) return null;
  return [attribute.getX(index), attribute.getY(index), attribute.getZ(index)]
    .map((value) => rounded(value, 6));
}

function materialShaderEvidence(material) {
  const resolved = Array.isArray(material) ? material[0] : material;
  if (!resolved?.isMaterial) return null;
  const compiled = resolved.userData?.yunnanCompiledShaderEvidence;
  const liveShader = resolved.userData?.yunnanShader;
  const liveFragmentShader = liveShader?.fragmentShader || '';
  let runtimeProgramCacheKey = null;
  try {
    runtimeProgramCacheKey = resolved.customProgramCacheKey?.() || null;
  } catch (_error) {
    runtimeProgramCacheKey = null;
  }
  return {
    shaderRevision: resolved.userData?.yunnanShaderRevision || null,
    programCacheKey: resolved.userData?.yunnanProgramCacheKey || null,
    runtimeProgramCacheKey,
    runtimeBranch: resolved.userData?.yunnanRuntimeBranch || null,
    runtimeSource: resolved.userData?.yunnanRuntimeSource || null,
    frozenV544CompiledShaderEvidence: liveShader ? {
      fragmentUsesLegacySineHash: liveFragmentShader.includes('fract(sin(dot('),
      fragmentUsesFourOctaveFbm: liveFragmentShader.includes('for(int i=0;i<4;i++)'),
      fragmentUsesCurrentSineFreeHash: liveFragmentShader.includes('uvec3 yunnanHashBits'),
      evidenceSource: 'actual-onBeforeCompile-populated-live-shader-source',
    } : null,
    compiledShaderEvidence: compiled ? {
      revision: compiled.revision || null,
      mode: compiled.mode || null,
      programCacheKey: compiled.programCacheKey || null,
      fragmentHasExpectedModeBranch: compiled.fragmentHasExpectedModeBranch === true,
      fragmentHasOpeningGrainGroove: compiled.fragmentHasOpeningGrainGroove === true,
      fragmentHasOpeningRunoffColumn: compiled.fragmentHasOpeningRunoffColumn === true,
      fragmentHasTileBranch: compiled.fragmentHasTileBranch === true,
      fragmentUsesSineFreeHash: compiled.fragmentUsesSineFreeHash === true,
      fragmentFbmOctaveCount: compiled.fragmentFbmOctaveCount ?? null,
      vertexHasInstanceWorldTransform: compiled.vertexHasInstanceWorldTransform === true,
      evidenceSource: compiled.evidenceSource || null,
    } : null,
  };
}

function deriveMaterialShaderPrograms(model) {
  const materialsByMode = new Map();
  model.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      const modeId = material.userData?.yunnanMode;
      if (!modeId) return;
      if (!materialsByMode.has(modeId)) materialsByMode.set(modeId, new Map());
      materialsByMode.get(modeId).set(material.uuid, material);
    });
  });
  const modes = Object.fromEntries([...materialsByMode.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([modeId, materials]) => {
      const items = [...materials.values()].map((material) => ({
        materialUuid: material.uuid,
        mode: material.userData?.yunnanMode || null,
        ...materialShaderEvidence(material),
      }));
      return [modeId, {
        materialCount: items.length,
        programCacheKeys: [...new Set(items.map((item) => item.runtimeProgramCacheKey).filter(Boolean))].sort(),
        shaderRevisions: [...new Set(items.map((item) => item.shaderRevision).filter(Boolean))].sort(),
        runtimeBranches: [...new Set(items.map((item) => item.runtimeBranch).filter(Boolean))].sort(),
        runtimeSources: [...new Set(items.map((item) => item.runtimeSource).filter(Boolean))].sort(),
        compiledMaterialCount: items.filter((item) => item.compiledShaderEvidence).length,
        compiledEvidence: items.map((item) => item.compiledShaderEvidence).filter(Boolean),
        frozenV544CompiledMaterialCount: items.filter(
          (item) => item.frozenV544CompiledShaderEvidence,
        ).length,
        frozenV544CompiledEvidence: items.map(
          (item) => item.frozenV544CompiledShaderEvidence,
        ).filter(Boolean),
      }];
    }));
  const modeProgramCacheKeys = Object.fromEntries(Object.entries(modes)
    .map(([modeId, evidence]) => [modeId, evidence.programCacheKeys]));
  const uniqueKeys = new Set(Object.values(modeProgramCacheKeys).flat());
  return {
    evidenceSource: 'live-render-material-userData-populated-after-actual-onBeforeCompile',
    modes,
    modeProgramCacheKeys,
    keysUniqueAcrossModes: uniqueKeys.size === Object.keys(modeProgramCacheKeys).length,
  };
}

function resolveRoofWeatheringQACamera() {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  const samplesBySlope = new Map();
  model.traverse((object) => {
    if (!object.isInstancedMesh || !['pan', 'cover'].includes(object.userData?.tileKind)) return;
    if (ancestorValue(object, 'roofUnitId', model) !== 'mainHouseDoublePitch') return;
    const semantics = object.userData?.instanceMap || [];
    semantics.forEach((semantic, index) => {
      const color = instanceColorEvidence(object, index);
      if (!color) return;
      const slopeId = semantic.slopeId || object.userData.slopeId;
      if (!samplesBySlope.has(slopeId)) samplesBySlope.set(slopeId, []);
      samplesBySlope.get(slopeId).push({ batch: object, index, color, ...semantic });
    });
  });
  const roofUnit = model.getObjectByName('roofUnit_mainHouseDoublePitch');
  const declaredBySlope = new Map();
  (roofUnit?.userData?.instanceMap || []).forEach((semantic) => {
    if (!declaredBySlope.has(semantic.slopeId)) declaredBySlope.set(semantic.slopeId, []);
    declaredBySlope.get(semantic.slopeId).push(semantic);
  });
  const gridDistance = (left, right) => (
    Math.abs(Number(left.columnIndex) - Number(right.columnIndex))
    + Math.abs(Number(left.courseIndex) - Number(right.courseIndex))
  );
  const evidenceTriple = (samples, declared) => {
    const repairs = samples.filter((sample) => sample.state === 'repair');
    const broken = samples.filter((sample) => sample.state === 'broken');
    const missing = declared.filter((sample) => sample.state === 'missing');
    if (!repairs.length || !broken.length || !missing.length) return null;
    return repairs.map((repair) => {
      const nearestBroken = [...broken].sort((left, right) => gridDistance(repair, left) - gridDistance(repair, right))[0];
      const nearestMissing = [...missing].sort((left, right) => gridDistance(repair, left) - gridDistance(repair, right))[0];
      const points = [repair, nearestBroken, nearestMissing];
      const columns = points.map((point) => Number(point.columnIndex));
      const courses = points.map((point) => Number(point.courseIndex));
      const width = Math.max(...columns) - Math.min(...columns) + 1;
      const height = Math.max(...courses) - Math.min(...courses) + 1;
      return { repair, broken: nearestBroken, missing: nearestMissing, area: width * height, width, height };
    }).sort((left, right) => left.area - right.area)[0];
  };
  const candidateGroups = [...samplesBySlope.entries()].map(([slopeId, samples]) => {
    const nonAged = samples.filter((sample) => sample.state !== 'aged');
    const declared = declaredBySlope.get(slopeId) || [];
    const triple = evidenceTriple(samples, declared);
    return { slopeId, samples, declared, nonAged, triple };
  }).filter((group) => group.triple).sort((left, right) => left.triple.area - right.triple.area);
  const selectedGroup = candidateGroups[0];
  if (!selectedGroup) return resolveEaveQACamera();
  const selection = selectedGroup.triple;
  const selectionPoints = [selection.repair, selection.broken, selection.missing];
  const columnRange = [
    Math.min(...selectionPoints.map((sample) => Number(sample.columnIndex))) - 1,
    Math.max(...selectionPoints.map((sample) => Number(sample.columnIndex))) + 1,
  ];
  const courseRange = [
    Math.min(...selectionPoints.map((sample) => Number(sample.courseIndex))) - 1,
    Math.max(...selectionPoints.map((sample) => Number(sample.courseIndex))) + 1,
  ];
  const insideSelection = (sample) => (
    Number(sample.columnIndex) >= columnRange[0] && Number(sample.columnIndex) <= columnRange[1]
    && Number(sample.courseIndex) >= courseRange[0] && Number(sample.courseIndex) <= courseRange[1]
  );
  const selectedSamples = selectedGroup.samples.filter(insideSelection);
  const selectedDeclared = selectedGroup.declared.filter(insideSelection);
  const indicesByBatch = new Map();
  selectedSamples.forEach((sample) => {
    if (!indicesByBatch.has(sample.batch)) indicesByBatch.set(sample.batch, []);
    indicesByBatch.get(sample.batch).push(sample.index);
  });
  const detailBounds = new THREE.Box3();
  indicesByBatch.forEach((indices, batch) => detailBounds.union(instanceWorldBounds(batch, indices)));
  if (detailBounds.isEmpty()) detailBounds.setFromObject(roofUnit || model);
  const center = detailBounds.getCenter(new THREE.Vector3());
  const modelCenter = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  const outward = center.clone().sub(modelCenter).setY(0);
  if (outward.lengthSq() < 1e-8) outward.set(0, 0, -1);
  outward.normalize();
  const across = new THREE.Vector3(-outward.z, 0, outward.x);
  const direction = outward.multiplyScalar(0.74).addScaledVector(across, 0.62)
    .add(new THREE.Vector3(0, 0.62, 0)).normalize();
  const camera = fitCameraToBounds(detailBounds, direction, 1.16, new THREE.Vector3(0, 0.02, 0));
  const colors = selectedSamples.map((sample) => sample.color);
  const stateCounts = selectedDeclared.reduce((counts, sample) => {
    counts[sample.state] = (counts[sample.state] || 0) + 1;
    return counts;
  }, {});
  const channelRanges = [0, 1, 2].map((channel) => {
    const values = colors.map((color) => color[channel]);
    return rounded(Math.max(...values) - Math.min(...values), 6);
  });
  const luminances = colors.map((color) => color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722);
  const distinctColors = new Set(colors.map((color) => color.map((value) => Math.round(value * 255)).join(',')));
  const materialColors = [...new Set(selectedSamples.map((sample) => sample.batch.material?.color?.getHexString?.()).filter(Boolean))];
  const materialPrograms = [...new Map(selectedSamples.map((sample) => {
    const material = Array.isArray(sample.batch.material) ? sample.batch.material[0] : sample.batch.material;
    return [material?.uuid, {
      tileKind: sample.batch.userData?.tileKind || sample.tileKind || null,
      mode: material?.userData?.yunnanMode || null,
      ...materialShaderEvidence(material),
    }];
  }).filter(([uuid]) => uuid)).values()];
  return {
    ...camera,
    evidence: {
      source: 'live-wulong-main-roof-instance-color-damage-repair-patch-world-bounds',
      profileId: activePreset,
      roofUnitId: 'mainHouseDoublePitch',
      slopeId: selectedGroup.slopeId,
      selectionContract: 'minimum-grid-area-union-of-real-rendered-repair-broken-and-declared-missing-on-one-slope',
      selectionGridArea: selection.area,
      selectedCourseRange: courseRange,
      selectedColumnRange: columnRange,
      featureTiles: Object.fromEntries(['repair', 'broken', 'missing'].map((state) => [state, {
        tileId: selection[state].tileId,
        courseIndex: selection[state].courseIndex,
        columnIndex: selection[state].columnIndex,
      }])),
      selectedTileCount: selectedSamples.length,
      selectedTileIds: selectedSamples.map((sample) => sample.tileId).filter(Boolean).slice(0, 80),
      stateCounts,
      nonAgedTileCount: selectedDeclared.filter((sample) => sample.state !== 'aged').length,
      missingTileCount: Number(stateCounts.missing || 0),
      brokenTileCount: Number(stateCounts.broken || 0),
      repairTileCount: Number(stateCounts.repair || 0),
      instanceColorAttribute: selectedSamples.every((sample) => Boolean(sample.batch.instanceColor)),
      instanceColorItemSize: selectedSamples[0]?.batch.instanceColor?.itemSize || null,
      distinctInstanceColorCount: distinctColors.size,
      instanceColorChannelRanges: channelRanges,
      instanceColorLuminanceRange: rounded(Math.max(...luminances) - Math.min(...luminances), 6),
      materialColors,
      materialUsesInstanceColorShaderPath: selectedSamples.every((sample) => Boolean(sample.batch.instanceColor && sample.batch.material?.isMaterial)),
      materialPrograms,
      damageSummary: roofUnit?.userData?.damage || null,
      repairSummary: roofUnit?.userData?.repairs || null,
      framingIntent: 'real-dark-broken-light-repair-and-missing-tile-neighborhood',
      bounds: cameraBoundsEvidence(detailBounds),
    },
  };
}

function resolveOverviewQACamera() {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const camera = fitCameraToBounds(
    bounds,
    new THREE.Vector3(0.82, 1.08, -1.15),
    1.06,
    new THREE.Vector3(0, 0.25, 0),
  );
  return {
    ...camera,
    evidence: {
      source: 'live-complete-building-world-bounds-from-south-entry-side',
      entranceSide: '-z',
      occlusionIntent: 'elevated-entry-side-courtyard-readable',
      bounds: cameraBoundsEvidence(bounds),
    },
  };
}

function resolveEaveQACamera() {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  const batches = [];
  const fascias = [];
  model.traverse((object) => {
    if (!object.isMesh || ancestorValue(object, 'roofUnitId', model) !== 'mainHouseDoublePitch') return;
    if (!object.isInstancedMesh && object.userData?.type === 'eave-fascia') {
      fascias.push(object);
      return;
    }
    if (!object.isInstancedMesh) return;
    const kind = object.userData?.instanceMap?.[0]?.kind;
    if (kind === 'hook' && (
      object.userData?.type !== '勾头-cover-eave-hook-heads'
      || object.geometry?.userData?.frontPlate !== true
    )) return;
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
  const middleColumn = columns.length ? Math.floor((Math.min(...columns) + Math.max(...columns)) / 2) : 0;
  const eaveCourse = courses.length ? Math.max(...courses) : 0;
  const detailBounds = new THREE.Box3();
  const featureBounds = {};
  const featureSelections = {};
  slopeBatches.forEach((batch) => {
    const semantic = batch.userData?.instanceMap || [];
    const indices = semantic.map((item, index) => ({ item, index })).filter(({ item }) => (
      Math.abs(Number(item.columnIndex) - middleColumn) <= 1.1
      && Number(item.courseIndex) >= eaveCourse - 2
    )).map(({ index }) => index);
    if (indices.length) detailBounds.union(instanceWorldBounds(batch, indices));
    ['pan', 'cover', 'drip', 'hook'].forEach((kind) => {
      const kindIndices = semantic.map((item, index) => ({ item, index })).filter(({ item }) => (
        item.kind === kind
        && Math.abs(Number(item.columnIndex) - middleColumn) <= 1.1
        && Number(item.courseIndex) >= eaveCourse - 2
      )).map(({ index }) => index);
      if (!kindIndices.length) return;
      featureBounds[kind] ||= new THREE.Box3();
      featureBounds[kind].union(instanceWorldBounds(batch, kindIndices));
      featureSelections[kind] ||= [];
      featureSelections[kind].push({ object: batch, indices: kindIndices });
    });
  });
  const fascia = fascias.find((object) => object.userData?.slopeId === selectedSlope) || null;
  const fasciaWorldBounds = fascia ? new THREE.Box3().setFromObject(fascia) : null;
  if (fasciaWorldBounds && !detailBounds.isEmpty()) {
    const visibleWindow = detailBounds.clone().expandByVector(new THREE.Vector3(0.22, 0.35, 0.28));
    const visibleFasciaBounds = fasciaWorldBounds.clone().intersect(visibleWindow);
    if (!visibleFasciaBounds.isEmpty()) {
      featureBounds.fascia = visibleFasciaBounds;
      detailBounds.union(visibleFasciaBounds);
    }
  }
  const eaveBounds = eaveGroups.get(selectedSlope) || detailBounds;
  const eaveCenter = eaveBounds.getCenter(new THREE.Vector3());
  const detailCenter = detailBounds.getCenter(new THREE.Vector3());
  const downhill = eaveCenter.clone().sub(detailCenter).setY(0);
  if (downhill.lengthSq() < 1e-8) downhill.set(0, 0, -1);
  downhill.normalize();
  const across = new THREE.Vector3(-downhill.z, 0, downhill.x);
  const direction = downhill.clone().multiplyScalar(0.98)
    .addScaledVector(across, 0.48).add(new THREE.Vector3(0, -0.12, 0)).normalize();
  const camera = fitCameraToBounds(detailBounds, direction, 0.93, new THREE.Vector3(0, -0.025, 0));
  const slopeAudit = deriveRoofEvidence(productionView.model()).roofUnits
    ?.find((unit) => unit.roofUnitId === 'mainHouseDoublePitch')?.slopes
    ?.find((audit) => audit.slopeId === selectedSlope) || null;
  const downhillProjectionAxis = new THREE.Vector3().fromArray(slopeAudit?.downhillVector || [0, 0, -1]);
  downhillProjectionAxis.y = 0;
  if (downhillProjectionAxis.lengthSq() <= 1e-12) downhillProjectionAxis.set(0, 0, -1);
  downhillProjectionAxis.normalize();
  const projectionFor = (kind) => {
    const samples = (featureSelections[kind] || [])
      .map(({ object, indices }) => worldVertexProjectionEvidence(object, downhillProjectionAxis, indices))
      .filter(Boolean);
    return samples.length ? {
      minimum: Math.min(...samples.map((item) => item.minimum)),
      maximum: Math.max(...samples.map((item) => item.maximum)),
      sampleCount: samples.reduce((sum, item) => sum + item.sampleCount, 0),
    } : null;
  };
  const fasciaProjection = fascia
    ? worldVertexProjectionEvidence(fascia, downhillProjectionAxis) : null;
  const dripProjection = projectionFor('drip');
  const hookProjection = projectionFor('hook');
  const dripTerminalBeyondFasciaM = fasciaProjection && dripProjection
    ? dripProjection.maximum - fasciaProjection.maximum : null;
  const hookTerminalBeyondFasciaM = fasciaProjection && hookProjection
    ? hookProjection.maximum - fasciaProjection.maximum : null;
  return {
    ...camera,
    evidence: {
      source: 'live-main-house-eave-instance-world-bounds', slopeId: selectedSlope,
      framingIntent: 'low-eave-exterior-oblique-view-of-pan-trough-cover-bridge-drip-hook-fascia-and-overlap',
      selectedColumnCenter: rounded(middleColumn, 3), selectedCourseRange: [Math.max(0, eaveCourse - 2), eaveCourse],
      featureKinds: Object.keys(featureBounds).sort(),
      featureBounds: Object.fromEntries(Object.entries(featureBounds).map(([kind, bounds]) => [kind, cameraBoundsEvidence(bounds)])),
      featureChecks: {
        panConcavity: slopeAudit?.panConcavity || null,
        coverConvexity: slopeAudit?.coverConvexity || null,
        coverBridgesPanSeams: slopeAudit?.coverBridgesPanSeams === true,
        longitudinalOverlapM: rounded(slopeAudit?.longitudinalOverlapM, 6),
        dripCount: slopeAudit?.dripCount ?? null,
        hookCount: slopeAudit?.hookCount ?? null,
        drainagePathsEndAtEave: slopeAudit?.drainagePathsEndAtEave === true,
        eaveTerminationCount: slopeAudit?.eaveTerminationCount ?? null,
        fasciaPresent: Boolean(fascia),
        fasciaDimensionsM: fascia?.userData?.dimensionsM || null,
        fasciaWorldBounds: cameraBoundsEvidence(fasciaWorldBounds),
        eaveFasciaThicknessM: rounded(fascia?.userData?.dimensionsM?.[1], 6),
        eaveFasciaDepthM: rounded(fascia?.userData?.dimensionsM?.[2], 6),
        terminalClearanceEvidenceSource: 'live-buffer-vertices-times-instance-and-world-matrices-projected-on-horizontal-downhill-axis',
        downhillProjectionAxis: downhillProjectionAxis.toArray().map((value) => rounded(value, 7)),
        fasciaExteriorDownhillProjectionM: rounded(fasciaProjection?.maximum, 7),
        dripTerminalDownhillProjectionM: rounded(dripProjection?.maximum, 7),
        hookTerminalDownhillProjectionM: rounded(hookProjection?.maximum, 7),
        dripTerminalBeyondFasciaM: rounded(dripTerminalBeyondFasciaM, 7),
        hookTerminalBeyondFasciaM: rounded(hookTerminalBeyondFasciaM, 7),
        terminalProjectionSampleCounts: {
          fascia: fasciaProjection?.sampleCount || 0,
          drip: dripProjection?.sampleCount || 0,
          hook: hookProjection?.sampleCount || 0,
        },
        hookSelectionContract: 'independent-front-plate-batch-and-selected-instance-membership-only',
        hookHeadBatchTypes: (featureSelections.hook || []).map(({ object }) => object.userData?.type),
        hookHeadGeometryFrontPlate: (featureSelections.hook || []).every(
          ({ object }) => object.geometry?.userData?.frontPlate === true,
        ),
      },
      bounds: cameraBoundsEvidence(detailBounds),
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
  const nearbyBounds = new THREE.Box3().setFromCenterAndSize(endpoint, new THREE.Vector3(1.32, 1.32, 1.32));
  const featureBounds = new THREE.Box3();
  const semanticBounds = {};
  const semantics = new Set();
  features.forEach((object) => {
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.intersectsBox(nearbyBounds)) {
      const clipped = bounds.intersect(nearbyBounds);
      const semantic = object.userData.ridgeSemantic;
      featureBounds.union(clipped);
      semanticBounds[semantic] ||= new THREE.Box3();
      semanticBounds[semantic].union(clipped);
      semantics.add(semantic);
    }
  });
  if (featureBounds.isEmpty()) featureBounds.copy(nearbyBounds);
  const outward = axis.clone().negate();
  const side = new THREE.Vector3(-outward.z, 0, outward.x);
  // Look chiefly along the ridge axis so the projecting terminal cap is a
  // true first visible surface; a small side/elevation component keeps the
  // principal run and diagonal verge legible in the same composition.
  const direction = outward.multiplyScalar(1.0).addScaledVector(side, 0.18).add(new THREE.Vector3(0, 0.34, 0));
  const camera = fitCameraToBounds(featureBounds, direction, 1.02, new THREE.Vector3(0, 0.06, 0));
  return {
    ...camera,
    evidence: {
      source: 'live-main-house-ridge-semantic-world-bounds',
      featureSemantics: [...semantics].sort(), endpoint: endpoint.toArray().map((value) => rounded(value, 5)),
      featureBounds: Object.fromEntries(Object.entries(semanticBounds)
        .map(([semantic, bounds]) => [semantic, cameraBoundsEvidence(bounds)])),
      framingIntent: 'tight-principal-ridge-verge-and-terminal-cap-junction-against-sky',
      bounds: cameraBoundsEvidence(featureBounds),
    },
  };
}

function resolveAbutmentQACamera() {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  const abutments = [];
  model.traverse((object) => {
    if (object.isMesh && object.userData?.ridgeSemantic === 'wallAbutment') abutments.push(object);
  });
  const selected = abutments.find((object) => (
    ancestorValue(object, 'roofUnitId', model) === 'sideGalleryLeanTo'
    && (object.userData?.abutmentHostComponentId
      || object.userData?.instanceMap?.some((item) => item.abutmentHostComponentId))
  )) || null;
  const selectedBounds = selected ? new THREE.Box3().setFromObject(selected) : new THREE.Box3().setFromObject(model);
  const roofUnitId = selected ? ancestorValue(selected, 'roofUnitId', model) : null;
  const selectedSemantic = selected?.userData?.instanceMap?.find((item) => item.abutmentHostComponentId)
    || selected?.userData?.instanceMap?.[0] || {};
  const sectionId = selectedSemantic.sectionId || null;
  const hostComponentId = selected?.userData?.abutmentHostComponentId
    || selectedSemantic.abutmentHostComponentId || null;
  let host = null;
  model.traverse((object) => {
    if (!host && object.userData?.componentId === hostComponentId
      && object.userData?.semanticRole === 'roof-abutment-host') host = object;
  });
  const hostBounds = host ? new THREE.Box3().setFromObject(host) : new THREE.Box3();
  const hostInstanceSemantics = host?.userData?.instanceMap || [];
  const hostMemberCounts = hostInstanceSemantics.reduce((counts, item) => {
    counts[item.member] = (counts[item.member] || 0) + 1;
    return counts;
  }, {});
  const hostInstanceBounds = hostInstanceSemantics.map((item, index) => ({
    index, item, bounds: instanceWorldBounds(host, [index]),
  }));
  const headPlateIndex = host?.userData?.instanceMap?.findIndex((item) => item.member === 'head-plate') ?? -1;
  const hostHeadPlateBounds = host && headPlateIndex >= 0
    ? instanceWorldBounds(host, [headPlateIndex]) : new THREE.Box3();

  const selectedIndex = selected?.userData?.instanceMap?.findIndex((item) => (
    item.abutmentHostComponentId === hostComponentId || item.kind === 'wall-abutment'
  )) ?? -1;
  const localMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  let axisStart = null;
  let axisEnd = null;
  if (selected?.isInstancedMesh && selectedIndex >= 0) {
    selected.getMatrixAt(selectedIndex, localMatrix);
    worldMatrix.multiplyMatrices(selected.matrixWorld, localMatrix);
    if (!selected.geometry.boundingBox) selected.geometry.computeBoundingBox();
    const localBounds = selected.geometry.boundingBox;
    axisStart = new THREE.Vector3(0, localBounds.min.y, 0).applyMatrix4(worldMatrix);
    axisEnd = new THREE.Vector3(0, localBounds.max.y, 0).applyMatrix4(worldMatrix);
  }
  const contactSampleCount = 33;
  const contactSamples = axisStart && axisEnd && !hostHeadPlateBounds.isEmpty()
    ? Array.from({ length: contactSampleCount }, (_, index) => {
      const axisPoint = axisStart.clone().lerp(axisEnd, index / (contactSampleCount - 1));
      const contactPoint = axisPoint.clone();
      contactPoint.y = selectedBounds.min.y;
      const gapM = hostHeadPlateBounds.distanceToPoint(contactPoint);
      return { contactPoint, gapM };
    }) : [];
  const maximumContactGapM = contactSamples.length
    ? Math.max(...contactSamples.map((sample) => sample.gapM)) : null;
  const requiredMaximumContactGapM = 0.01;
  const contactCoverage = contactSamples.length
    ? contactSamples.filter((sample) => sample.gapM <= requiredMaximumContactGapM).length / contactSamples.length : 0;
  const openBayEvidence = [1, 2, 3].map((bay) => {
    const jambs = hostInstanceBounds.filter((record) => record.item.member === 'open-bay-jamb' && record.item.bay === bay)
      .sort((left, right) => left.bounds.getCenter(new THREE.Vector3()).z - right.bounds.getCenter(new THREE.Vector3()).z);
    const lintel = hostInstanceBounds.find((record) => record.item.member === 'open-bay-lintel' && record.item.bay === bay);
    if (jambs.length !== 2 || !lintel) return { bay, complete: false };
    const clearMinZ = jambs[0].bounds.max.z;
    const clearMaxZ = jambs[1].bounds.min.z;
    const clearMinY = hostBounds.min.y;
    const clearMaxY = lintel.bounds.min.y;
    const epsilon = 0.002;
    const clearBounds = new THREE.Box3(
      new THREE.Vector3(hostBounds.min.x - epsilon, clearMinY + epsilon, clearMinZ + epsilon),
      new THREE.Vector3(hostBounds.max.x + epsilon, clearMaxY - epsilon, clearMaxZ - epsilon),
    );
    const blockingInstances = hostInstanceBounds.filter((record) => record.bounds.intersectsBox(clearBounds));
    return {
      bay,
      complete: clearMaxZ > clearMinZ && clearMaxY > clearMinY,
      jambInstanceIndices: jambs.map((record) => record.index),
      lintelInstanceIndex: lintel.index,
      clearWidthM: rounded(clearMaxZ - clearMinZ, 6),
      clearHeightM: rounded(clearMaxY - clearMinY, 6),
      clearWorldBounds: cameraBoundsEvidence(clearBounds),
      blockingInstanceCount: blockingInstances.length,
      blockingInstanceIndices: blockingInstances.map((record) => record.index),
      evidenceSource: 'live-instance-matrix-world-bounds-between-inner-jamb-faces-and-lintel-bottom',
    };
  });
  const centralBayRecords = hostInstanceBounds.filter((record) => record.item.bay === 2);
  const centralBayBounds = new THREE.Box3();
  centralBayRecords.forEach((record) => centralBayBounds.union(record.bounds));
  const centralBayPosts = hostInstanceBounds.filter((record) => (
    record.item.member === 'post'
    && !centralBayBounds.isEmpty()
    && record.bounds.max.z >= centralBayBounds.min.z - 0.16
    && record.bounds.min.z <= centralBayBounds.max.z + 0.16
  ));
  const hostDetailRecords = [...centralBayRecords, ...centralBayPosts];
  const hostDetailBounds = new THREE.Box3();
  hostDetailRecords.forEach((record) => hostDetailBounds.union(record.bounds));
  let hostHeadPlateDetailBounds = new THREE.Box3();
  if (!hostHeadPlateBounds.isEmpty() && !hostDetailBounds.isEmpty()) {
    hostHeadPlateDetailBounds = hostHeadPlateBounds.clone().intersect(new THREE.Box3(
      new THREE.Vector3(hostHeadPlateBounds.min.x, hostHeadPlateBounds.min.y, hostDetailBounds.min.z - 0.08),
      new THREE.Vector3(hostHeadPlateBounds.max.x, hostHeadPlateBounds.max.y, hostDetailBounds.max.z + 0.08),
    ));
    if (!hostHeadPlateDetailBounds.isEmpty()) hostDetailBounds.union(hostHeadPlateDetailBounds);
  }
  const boundsForMembers = (members) => {
    const bounds = new THREE.Box3();
    hostDetailRecords.filter((record) => members.includes(record.item.member))
      .forEach((record) => bounds.union(record.bounds));
    return bounds;
  };
  const lowerPanelDetailBounds = boundsForMembers(['lower-panel']);
  const upperLatticeDetailBounds = boundsForMembers(['upper-lattice-horizontal', 'upper-lattice-vertical']);
  const wallAbutmentDetailBounds = !selectedBounds.isEmpty() && !hostDetailBounds.isEmpty()
    ? selectedBounds.clone().intersect(new THREE.Box3(
      new THREE.Vector3(selectedBounds.min.x, selectedBounds.min.y, hostDetailBounds.min.z),
      new THREE.Vector3(selectedBounds.max.x, selectedBounds.max.y, hostDetailBounds.max.z),
    )) : new THREE.Box3();
  const selectedCenter = selectedBounds.getCenter(new THREE.Vector3());
  const selectedSize = selectedBounds.getSize(new THREE.Vector3());
  const detailSize = selectedSize.clone();
  if (detailSize.x >= detailSize.z) detailSize.x = Math.min(detailSize.x, 2.35);
  else detailSize.z = Math.min(detailSize.z, 2.35);
  detailSize.y = Math.max(detailSize.y, 1.25);
  const nearbyBounds = new THREE.Box3().setFromCenterAndSize(selectedCenter, detailSize).expandByScalar(0.22);
  const featureBounds = new THREE.Box3();
  const semantics = new Set();
  model.traverse((object) => {
    if (!object.isMesh || !visibleInTree(object, model)) return;
    if (roofUnitId && ancestorValue(object, 'roofUnitId', model) !== roofUnitId) return;
    const bounds = new THREE.Box3().setFromObject(object);
    if (!bounds.intersectsBox(nearbyBounds)) return;
    featureBounds.union(bounds.intersect(nearbyBounds));
    if (object.userData?.ridgeSemantic) semantics.add(object.userData.ridgeSemantic);
  });
  if (featureBounds.isEmpty()) featureBounds.copy(selectedBounds);
  const hostContextBounds = hostDetailBounds.clone();
  if (!hostContextBounds.isEmpty()) featureBounds.union(hostContextBounds);
  const modelCenter = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  const inward = modelCenter.sub(featureBounds.getCenter(new THREE.Vector3())).setY(0);
  if (inward.lengthSq() < 1e-8) inward.set(-1, 0, -0.2);
  const side = new THREE.Vector3(-inward.z, 0, inward.x).normalize();
  const direction = inward.normalize().multiplyScalar(1.0)
    .addScaledVector(side, 0.42).add(new THREE.Vector3(0, 0.12, 0));
  const camera = fitCameraToBounds(featureBounds, direction, 0.98, new THREE.Vector3(0, -0.12, 0));
  return {
    ...camera,
    evidence: {
      source: 'live-east-xiaoxia-wall-abutment-instance-axis-to-declared-timber-host-contact-sweep',
      roofUnitId,
      sectionId,
      abutmentHostComponentId: hostComponentId,
      hostSemanticRole: host?.userData?.semanticRole || null,
      hostSourceRule: host?.userData?.sourceRule || null,
      hostOpenGalleryPreserved: host?.userData?.openGalleryPreserved === true,
      hostInstanceCount: host?.count ?? null,
      hostDimensionsM: host?.userData?.dimensionsM || null,
      hostWallKind: host?.userData?.wallKind || null,
      hostMaterialKind: host?.userData?.materialKind || null,
      hostContinuousSolidInfill: host?.userData?.continuousSolidInfill,
      hostOpenBayCount: host?.userData?.openBayCount ?? null,
      hostLiveMaterialMode: host?.material?.userData?.yunnanMode || null,
      hostLiveMaterialProfile: host?.material?.userData?.yunnanProfile || null,
      hostMemberCounts,
      hostMemberCountSum: Object.values(hostMemberCounts).reduce((sum, count) => sum + count, 0),
      openBayEvidence,
      hostDetailMemberIndices: [...new Set([
        ...hostDetailRecords.map((record) => record.index),
        ...(headPlateIndex >= 0 ? [headPlateIndex] : []),
      ])].sort((a, b) => a - b),
      hostDetailMemberTypes: [...new Set([
        ...hostDetailRecords.map((record) => record.item.member),
        ...(headPlateIndex >= 0 ? ['head-plate'] : []),
      ])].sort(),
      hostDetailWorldBounds: cameraBoundsEvidence(hostDetailBounds),
      featureBounds: {
        wallAbutment: cameraBoundsEvidence(wallAbutmentDetailBounds),
        headPlate: cameraBoundsEvidence(hostHeadPlateDetailBounds),
        lowerPanel: cameraBoundsEvidence(lowerPanelDetailBounds),
        upperLattice: cameraBoundsEvidence(upperLatticeDetailBounds),
      },
      featureSemantics: [...semantics].sort(),
      fullAbutmentBounds: cameraBoundsEvidence(selectedBounds),
      hostWorldBounds: cameraBoundsEvidence(hostBounds),
      hostHeadPlateWorldBounds: cameraBoundsEvidence(hostHeadPlateBounds),
      hostContextBounds: cameraBoundsEvidence(hostContextBounds),
      closureInstanceCount: selected?.count ?? null,
      closureInstanceIndex: selectedIndex,
      axisWorldStart: axisStart?.toArray().map((value) => rounded(value, 6)) || null,
      axisWorldEnd: axisEnd?.toArray().map((value) => rounded(value, 6)) || null,
      axisLengthM: axisStart && axisEnd ? rounded(axisStart.distanceTo(axisEnd), 6) : null,
      contactEvidenceSource: '33-live-instance-axis-points-lowered-to-closure-shell-bottom-and-distance-to-live-host-head-plate-world-bounds',
      contactSampleCount: contactSamples.length,
      maximumContactGapM: rounded(maximumContactGapM, 6),
      requiredMaximumContactGapM,
      contactCoverage: rounded(contactCoverage, 6),
      minimumRequiredContactCoverage: 0.9,
      contactGapSamplesM: contactSamples.map((sample) => rounded(sample.gapM, 6)),
      isolatedRoofUnitId: qaRoofIsolation,
      framingIntent: 'low-courtyard-side-x-less-than-3.15-oblique-detail-with-contact-line-full-central-open-bay-skirt-and-lattice',
      bounds: cameraBoundsEvidence(featureBounds),
    },
  };
}

function resolveExplodedQACamera() {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  const layerBounds = Object.fromEntries(ROOF_LAYER_IDS.map((layerId) => [layerId, new THREE.Box3()]));
  model.traverse((object) => {
    if (!object.isMesh || ancestorValue(object, 'roofUnitId', model) !== 'mainHouseDoublePitch') return;
    const layerId = ancestorValue(object, 'roofLayerId', model);
    if (layerBounds[layerId]) layerBounds[layerId].union(new THREE.Box3().setFromObject(object));
  });
  const completeBounds = new THREE.Box3();
  Object.values(layerBounds).forEach((bounds) => {
    if (!bounds.isEmpty()) completeBounds.union(bounds);
  });
  if (completeBounds.isEmpty()) completeBounds.setFromObject(model);
  const layerCentersY = Object.fromEntries(ROOF_LAYER_IDS.map((layerId) => [
    layerId,
    layerBounds[layerId].isEmpty() ? null : rounded(layerBounds[layerId].getCenter(new THREE.Vector3()).y, 5),
  ]));
  const sortedCentersY = Object.values(layerCentersY).filter(Number.isFinite).sort((a, b) => a - b);
  const minimumLayerCenterSeparationM = sortedCentersY.length > 1
    ? Math.min(...sortedCentersY.slice(1).map((value, index) => value - sortedCentersY[index])) : 0;
  const camera = fitCameraToBounds(
    completeBounds,
    new THREE.Vector3(1.05, 0.24, -1.12),
    1.10,
    new THREE.Vector3(0, 0.08, 0),
  );
  return {
    ...camera,
    evidence: {
      source: 'live-exploded-main-house-seven-layer-world-bounds',
      roofUnitId: 'mainHouseDoublePitch',
      explodeDistanceM: rounded(model.userData?.roofSurfaceSystem?.explodeDistanceM, 5),
      isolatedRoofUnitId: qaRoofIsolation,
      isolationActive: qaRoofIsolation === 'mainHouseDoublePitch',
      composition: 'main-house-only-roof-system-low-oblique-separated-layer-stack',
      layerIds: ROOF_LAYER_IDS.filter((layerId) => !layerBounds[layerId].isEmpty()),
      layerCentersY,
      minimumLayerCenterSeparationM: rounded(minimumLayerCenterSeparationM, 5),
      layerBounds: Object.fromEntries(ROOF_LAYER_IDS.map((layerId) => [layerId, cameraBoundsEvidence(layerBounds[layerId])])),
      bounds: cameraBoundsEvidence(completeBounds),
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

function actualVisitorRouteManifestEvidence(model = productionView.model()) {
  model.updateMatrixWorld(true);
  const route = model.userData?.visitorRoute || {};
  const toWorldArray = (value) => {
    const point = value?.isVector3 ? value.clone() : new THREE.Vector3().fromArray(value || [0, 0, 0]);
    return point.applyMatrix4(model.matrixWorld).toArray().map((component) => rounded(component, 6));
  };
  const anchors = (route.anchors || []).map((anchor) => ({
    id: anchor.id || null,
    supportId: anchor.supportId || null,
    stage: anchor.stage || null,
    worldPosition: toWorldArray(anchor.position),
  }));
  const worldPoints = (route.points || []).map(toWorldArray);
  const manifest = canonicalManifestValue({
    anchors,
    worldPoints,
    entersThroughDoor: route.entersThroughDoor === true,
    stairId: route.stairId || null,
    collisionContract: route.collisionContract || null,
    reachesUpperFloor: route.reachesUpperFloor === true,
    upperFloorElevationM: route.upperFloorElevationM,
    relativeUpperFloorM: route.relativeUpperFloorM,
  });
  const anchorFingerprint = fnv1a([JSON.stringify(manifest.anchors)]);
  const pointFingerprint = fnv1a([JSON.stringify(manifest.worldPoints)]);
  return {
    contract: 'canonical-live-visitor-route-anchors-supports-stages-and-world-points-v1',
    anchorCount: anchors.length,
    pointCount: worldPoints.length,
    anchorFingerprint,
    pointFingerprint,
    manifestFingerprint: fnv1a([anchorFingerprint, pointFingerprint, JSON.stringify(manifest)]),
    manifest,
  };
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

function openingStaticEvidenceBounds(assembly) {
  const aperture = assembly?.userData?.apertureM || {};
  const width = Math.max(0.32, Number(aperture.width) || 0.5);
  const height = Math.max(0.38, Number(aperture.height) || 0.5);
  const depth = Math.max(0.28, width * 0.24);
  const bounds = new THREE.Box3(
    new THREE.Vector3(-width / 2 - 0.11, -0.09, -depth),
    new THREE.Vector3(width / 2 + 0.11, height + 0.13, depth),
  );
  return bounds.applyMatrix4(assembly.matrixWorld);
}

function resolveOpeningQACamera(kind) {
  const model = productionView.model();
  model.updateMatrixWorld(true);
  const assemblies = [];
  model.traverse((object) => { if (object.userData?.openingKind) assemblies.push(object); });
  const preferredId = kind === 'door' ? 'GATE-SOUTH-01' : 'WINDOW-NORTH-LEFT';
  const assembly = assemblies.find((object) => object.userData.componentId === preferredId)
    || assemblies.find((object) => object.userData.openingKind === kind);
  const bounds = assembly ? openingStaticEvidenceBounds(assembly) : new THREE.Box3().setFromObject(model);
  const outward = preferredId === 'GATE-SOUTH-01'
    ? new THREE.Vector3(0, 0, -1) : preferredId.startsWith('WINDOW-NORTH')
      ? new THREE.Vector3(0, 0, -1)
      : bounds.getCenter(new THREE.Vector3()).sub(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3())).setY(0);
  if (outward.lengthSq() < 1e-8) outward.set(0, 0, -1);
  outward.normalize();
  const across = new THREE.Vector3(-outward.z, 0, outward.x);
  const direction = outward.multiplyScalar(kind === 'door' ? 0.92 : 1)
    .addScaledVector(across, kind === 'door' ? 0.30 : -0.32)
    .add(new THREE.Vector3(0, kind === 'door' ? 0.18 : -0.06, 0)).normalize();
  const camera = kind === 'door'
    ? fitCameraToBounds(bounds, direction, 1.12, new THREE.Vector3(0, -0.02, 0))
    : {
      position: bounds.getCenter(new THREE.Vector3()).addScaledVector(direction, 0.92),
      target: bounds.getCenter(new THREE.Vector3()),
      distance: 0.92,
      bounds: bounds.clone(),
    };
  const roleCounts = {};
  const surfaceMaterials = {};
  const surfaceRoleBounds = {};
  const components = [];
  assembly?.traverse((object) => {
    const role = object.userData?.openingSurfaceRole;
    if (role) {
      roleCounts[role] = (roleCounts[role] || 0) + 1;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      surfaceMaterials[role] ||= {
        baseColor: material?.color?.getHexString?.() || null,
        openingRole: material?.userData?.yunnanOpeningRole || null,
        profile: material?.userData?.yunnanProfile || null,
        weatheringShaderMode: material?.userData?.yunnanMode || null,
        deterministicChannelNames: [...(material?.userData?.yunnanDeterministicChannels || [])],
        channels: { ...(material?.userData?.yunnanSurfaceChannels || {}) },
        surfaceFingerprint: material?.userData?.yunnanSurfaceFingerprint || null,
        ...materialShaderEvidence(material),
      };
      if (object.isMesh) {
        surfaceRoleBounds[role] ||= new THREE.Box3();
        surfaceRoleBounds[role].union(new THREE.Box3().setFromObject(object));
      }
    }
    if (object.userData?.componentId) components.push(object.userData.componentId);
  });
  return {
    ...camera,
    evidence: {
      source: 'live-single-operable-opening-static-envelope-closeup',
      openingKind: kind,
      componentId: assembly?.userData?.componentId || null,
      componentIds: components.sort(),
      openingProgress: rounded(assembly?.userData?.openingProgress, 5),
      openingState: assembly?.userData?.openingState || null,
      apertureM: assembly?.userData?.apertureM || null,
      pivotAnglesRad: (assembly?.userData?.pivots || []).map((pivot) => rounded(pivot.userData?.currentAngleRad, 6)),
      surfaceRoleCounts: roleCounts,
      surfaceMaterials,
      surfaceRoleBounds: Object.fromEntries(Object.entries(surfaceRoleBounds)
        .map(([role, roleBounds]) => [role, cameraBoundsEvidence(roleBounds)])),
      framingIntent: 'fixed-envelope-oblique-hinge-leaf-frame-sill-or-replacement-detail',
      viewSide: kind === 'window' ? 'courtyard-side-below-eave' : 'exterior-entry-side',
      bounds: cameraBoundsEvidence(bounds),
    },
  };
}

function resolveCamera(id) {
  if (id === 'overview' || id === 'ab') return resolveOverviewQACamera();
  if (id === 'qaEave' || id === 'eave') return resolveEaveQACamera();
  if (id === 'qaRoofWeathering') return resolveRoofWeatheringQACamera();
  if (id === 'qaRidge') return resolveRidgeQACamera();
  if (id === 'qaAbutment' || id === 'qaWallAbutment') return resolveAbutmentQACamera();
  if (id === 'qaExploded') return resolveExplodedQACamera();
  if (id === 'qaStair' || id === 'stair') return resolveStairQACamera();
  if (id === 'qaRoute') return resolveRouteQACamera();
  if (id === 'qaDoor' || id === 'qaOpenings') return resolveOpeningQACamera('door');
  if (id === 'qaWindow') return resolveOpeningQACamera('window');
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

function clearQAFeatureCallouts() {
  qaFeatureCalloutState?.overlay?.remove?.();
  qaFeatureCalloutState = null;
}

function calloutHitClassification(hit) {
  if (!hit?.object) return null;
  const object = hit.object;
  const instance = object.isInstancedMesh && Number.isInteger(hit.instanceId)
    ? object.userData?.instanceMap?.[hit.instanceId] || null : null;
  return instance?.kind || instance?.member || object.userData?.ridgeSemantic
    || object.userData?.openingSurfaceRole || object.userData?.type || null;
}

function calloutHitMatches(featureId, hit) {
  const classification = calloutHitClassification(hit);
  if (classification === featureId) return true;
  const semanticAliases = {
    principalRidge: ['principal-ridge'],
    vergeClosure: ['verge-closure'],
    endClosure: ['end-closure', 'ridge-end-closure'],
    wallAbutment: ['wall-abutment'],
  };
  if (semanticAliases[featureId]?.includes(classification)) return true;
  if (featureId === 'fascia') return classification === 'eave-fascia';
  if (featureId === 'headPlate') return classification === 'head-plate';
  if (featureId === 'lowerPanel') return classification === 'lower-panel';
  if (featureId === 'upperLattice') return ['upper-lattice-horizontal', 'upper-lattice-vertical'].includes(classification);
  if (featureId === 'wallAbutment') return hit?.object?.userData?.ridgeSemantic === 'wallAbutment';
  return false;
}

function calloutMemberToken(object, instanceId = null) {
  return `${object.uuid}:${Number.isInteger(instanceId) ? instanceId : 'mesh'}`;
}

function calloutAllowedMembers(featureId, targetBounds) {
  const model = productionView.model();
  const expanded = targetBounds.clone().expandByScalar(0.003);
  const tokens = new Set();
  const descriptors = [];
  const eligible = (object, instanceId = null) => {
    if (!calloutHitMatches(featureId, { object, instanceId })) return false;
    if (featureId === 'hook') {
      return object.userData?.type === '勾头-cover-eave-hook-heads'
        && object.geometry?.userData?.frontPlate === true;
    }
    return true;
  };
  model.traverse((object) => {
    if (!object.isMesh || !visibleInTree(object, model) || !object.geometry) return;
    if (object.isInstancedMesh) {
      for (let instanceId = 0; instanceId < object.count; instanceId += 1) {
        if (!eligible(object, instanceId)) continue;
        const bounds = instanceWorldBounds(object, [instanceId]);
        // Long ridge/verge instances can legitimately cross the clipped
        // feature envelope while their centre lies outside it.  Membership
        // is therefore the exact live instance world-AABB intersection, not
        // an aggregate-object or centre-point proxy.
        if (!bounds.intersectsBox(expanded)) continue;
        tokens.add(calloutMemberToken(object, instanceId));
        descriptors.push({
          objectName: object.name || null,
          objectType: object.userData?.type || object.type,
          instanceId,
          classification: calloutHitClassification({ object, instanceId }),
        });
      }
      return;
    }
    if (!eligible(object) || !new THREE.Box3().setFromObject(object).intersectsBox(expanded)) return;
    tokens.add(calloutMemberToken(object));
    descriptors.push({
      objectName: object.name || null,
      objectType: object.userData?.type || object.type,
      instanceId: null,
      classification: calloutHitClassification({ object }),
    });
  });
  const canonical = descriptors.map((item) => JSON.stringify(item)).sort();
  return {
    tokens,
    count: tokens.size,
    fingerprint: fnv1a(canonical),
    descriptors: canonical.map((item) => JSON.parse(item)),
  };
}

function calloutVisibilityEvidence(featureId, boundsArray) {
  const bounds = new THREE.Box3(
    new THREE.Vector3(boundsArray[0], boundsArray[1], boundsArray[2]),
    new THREE.Vector3(boundsArray[3], boundsArray[4], boundsArray[5]),
  );
  const allowedMembers = calloutAllowedMembers(featureId, bounds);
  const width = Math.max(1, productionView.element.clientWidth);
  const height = Math.max(1, productionView.element.clientHeight);
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  productionView.model().updateMatrixWorld(true);
  productionView.camera.updateMatrixWorld(true);
  const projectedCorners = corners.map((corner) => corner.clone().project(productionView.camera));
  const ndcMinX = Math.min(...projectedCorners.map((point) => point.x));
  const ndcMaxX = Math.max(...projectedCorners.map((point) => point.x));
  const ndcMinY = Math.min(...projectedCorners.map((point) => point.y));
  const ndcMaxY = Math.max(...projectedCorners.map((point) => point.y));
  const clippedMinX = Math.max(-1, ndcMinX);
  const clippedMaxX = Math.min(1, ndcMaxX);
  const clippedMinY = Math.max(-1, ndcMinY);
  const clippedMaxY = Math.min(1, ndcMaxY);
  const viewportIntersectionAreaPx = Math.max(0, clippedMaxX - clippedMinX) * width * 0.5
    * Math.max(0, clippedMaxY - clippedMinY) * height * 0.5;
  const raycaster = new THREE.Raycaster();
  // Include near-face samples so narrow jambs, caps and eave terminals cannot
  // be falsely classified from the empty centre of their aggregate AABB.
  const fractions = [0.5, 0.03, 0.97, 0.12, 0.88];
  const candidates = fractions.flatMap((fx) => fractions.flatMap((fy) => fractions.map((fz) => (
    new THREE.Vector3(
      THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, fx),
      THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, fy),
      THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, fz),
    )
  ))));
  let chosen = null;
  let firstObserved = null;
  for (const candidate of candidates) {
    const projected = candidate.clone().project(productionView.camera);
    if (projected.x < -1 || projected.x > 1 || projected.y < -1 || projected.y > 1
      || projected.z < -1 || projected.z > 1) continue;
    raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), productionView.camera);
    const firstHit = raycaster.intersectObject(productionView.model(), true)
      .find((hit) => visibleInTree(hit.object, productionView.model())) || null;
    firstObserved ||= firstHit;
    if (calloutHitMatches(featureId, firstHit)
      && allowedMembers.tokens.has(calloutMemberToken(firstHit.object, firstHit.instanceId))) {
      chosen = { candidate, projected, hit: firstHit };
      break;
    }
  }
  const observed = chosen?.hit || firstObserved;
  const projected = chosen?.projected || bounds.getCenter(new THREE.Vector3()).project(productionView.camera);
  const firstHitMatchesFeature = Boolean(chosen);
  return {
    visible: firstHitMatchesFeature
      && viewportIntersectionAreaPx >= 16
      && projected.x >= -1 && projected.x <= 1
      && projected.y >= -1 && projected.y <= 1
      && projected.z >= -1 && projected.z <= 1,
    worldPosition: chosen?.hit?.point?.clone() || chosen?.candidate || bounds.getCenter(new THREE.Vector3()),
    projectedNdc: projected.toArray().map((value) => rounded(value, 6)),
    projectedBoundsNdc: [ndcMinX, ndcMinY, ndcMaxX, ndcMaxY].map((value) => rounded(value, 6)),
    viewportIntersectionAreaPx: rounded(viewportIntersectionAreaPx, 3),
    firstHitMatchesFeature,
    firstHitSelectedRenderableMembershipMatches: Boolean(chosen),
    allowedSelectedRenderableCount: allowedMembers.count,
    allowedSelectedRenderableFingerprint: allowedMembers.fingerprint,
    selectedRenderableContract: 'exact-object-and-instance-membership-derived-from-live-target-bounds',
    firstHitClassification: calloutHitClassification(observed),
    firstHitObjectName: observed?.object?.name || null,
    firstHitInstanceId: Number.isInteger(observed?.instanceId) ? observed.instanceId : null,
    evidenceSource: 'live-camera-selected-renderable-instance-membership-and-first-visible-raycast-hit',
  };
}

function updateQAFeatureCallouts() {
  if (!qaFeatureCalloutState) return;
  const { overlay, targets } = qaFeatureCalloutState;
  const width = Math.max(1, productionView.element.clientWidth);
  const height = Math.max(1, productionView.element.clientHeight);
  productionView.camera.updateMatrixWorld();
  targets.forEach((target) => {
    const projected = target.worldPosition.clone().project(productionView.camera);
    const visible = target.visibility.visible === true
      && projected.x >= -1 && projected.x <= 1
      && projected.y >= -1 && projected.y <= 1
      && projected.z >= -1 && projected.z <= 1;
    target.element.hidden = !visible;
    if (!visible) return;
    const x = THREE.MathUtils.clamp((projected.x * 0.5 + 0.5) * width, 8, width - 8);
    const y = THREE.MathUtils.clamp((-projected.y * 0.5 + 0.5) * height, 8, height - 8);
    target.element.style.left = `${x}px`;
    target.element.style.top = `${y}px`;
  });
  overlay.hidden = false;
}

function setQAFeatureCallouts(kind = null) {
  clearQAFeatureCallouts();
  if (kind === null) return { active: false };
  const contracts = {
    eave: [
      ['pan', 'PAN · concave drainage trough', [-152, -92]],
      ['cover', 'COVER · convex seam bridge', [36, -112]],
      ['drip', 'DRIP · drainage endpoint', [-150, 34]],
      ['hook', 'HOOK · independent end plate', [34, 30]],
      ['fascia', 'FASCIA · 0.16 m thick eave edge', [-78, 88]],
    ],
    ridge: [
      ['principalRidge', 'PRINCIPAL RIDGE', [32, -72]],
      ['vergeClosure', 'DIAGONAL VERGE CLOSURE', [20, 52]],
      ['endClosure', 'RIDGE END CAP', [32, 22]],
    ],
    door: [
      ['doorLeaf', 'DOOR LEAF · patina 0.58', [-164, -58]],
      ['openingFrame', 'FRAME · patina 0.46', [18, 18]],
      ['replacementPart', 'LATER REPLACEMENT · age 0.86', [34, 28]],
    ],
    window: [
      ['windowLeaf', 'SHUTTER · sun/rain weathering', [-190, -56]],
      ['openingFrame', 'FRAME · patina 0.46', [-180, 20]],
      ['openingSill', 'SILL · rain 0.76 / edge wear 0.56', [10, 40]],
    ],
    abutment: [
      ['wallAbutment', 'CERAMIC WALL-ABUTMENT CLOSURE', [-120, -14]],
      ['headPlate', 'TIMBER HEAD PLATE · live contact', [28, 20]],
      ['lowerPanel', 'LOWER SKIRT PANEL', [-176, 48]],
      ['upperLattice', 'UPPER LATTICE', [-176, -54]],
    ],
  };
  const contract = contracts[kind];
  const featureBounds = activeCameraEvidence?.featureBounds
    || activeCameraEvidence?.surfaceRoleBounds || {};
  if (!contract) throw new Error(`Unknown QA callout contract: ${kind}`);
  const overlay = document.createElement('div');
  overlay.dataset.qaFeatureCallouts = kind;
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, {
    position: 'absolute', inset: '0', zIndex: '4', pointerEvents: 'none', overflow: 'hidden',
  });
  const targets = contract.map(([featureId, label, offset]) => {
    const bounds = featureBounds[featureId];
    if (!Array.isArray(bounds) || bounds.length !== 6) {
      throw new Error(`Missing live world bounds for ${kind} callout ${featureId}`);
    }
    const visibility = calloutVisibilityEvidence(featureId, bounds);
    const worldPosition = visibility.worldPosition;
    const element = document.createElement('div');
    Object.assign(element.style, {
      position: 'absolute', transform: `translate(${offset[0]}px, ${offset[1]}px)`,
      color: '#fff6d7', background: 'rgba(15, 18, 14, .88)', border: '1px solid #f2c86f',
      borderRadius: '4px', padding: '4px 7px', font: '700 10px/1.2 system-ui, sans-serif',
      letterSpacing: '.02em', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,.45)',
    });
    element.textContent = label;
    const marker = document.createElement('i');
    Object.assign(marker.style, {
      position: 'absolute', left: `${-offset[0] - 4}px`, top: `${-offset[1] - 4}px`,
      width: '9px', height: '9px', borderRadius: '50%', background: '#ffdc82',
      border: '2px solid #1a1d17', boxShadow: '0 0 0 1px #ffdc82',
    });
    element.append(marker);
    overlay.append(element);
    return { featureId, label, bounds: [...bounds], worldPosition, visibility, element };
  });
  productionView.element.append(overlay);
  qaFeatureCalloutState = { kind, overlay, targets };
  const evidence = {
    active: true,
    kind,
    source: 'live-feature-world-bounds-selected-renderable-membership-and-first-visible-model-raycast-hit',
    targets: targets.map((target) => ({
      featureId: target.featureId,
      label: target.label,
      worldBounds: target.bounds,
      worldPosition: target.worldPosition.toArray().map((value) => rounded(value, 5)),
      ...Object.fromEntries(Object.entries(target.visibility).filter(([key]) => key !== 'worldPosition')),
    })),
  };
  activeCameraEvidence = { ...(activeCameraEvidence || {}), callouts: evidence };
  productionView.model().userData.runtimeState ||= {};
  productionView.model().userData.runtimeState.qaFeatureCallouts = evidence;
  productionView.needsRender = true;
  updateQAFeatureCallouts();
  return evidence;
}

function measureQAFeaturePixels(featureId) {
  const target = qaFeatureCalloutState?.targets?.find((item) => item.featureId === featureId);
  if (!target?.visibility?.visible) throw new Error(`QA feature is not first-hit visible: ${featureId}`);
  const renderer = productionView.renderer;
  const gl = renderer.getContext();
  const drawingBuffer = renderer.getDrawingBufferSize(new THREE.Vector2());
  // preserveDrawingBuffer intentionally remains disabled for production.
  // Render synchronously and read before returning control to the compositor,
  // so the evidence is the same real production scene/camera/material path.
  renderer.render(productionView.scene, productionView.camera);
  productionRenderSerial += 1;
  productionView.needsRender = false;
  const [ndcX, ndcY] = target.visibility.projectedNdc;
  const [minNdcX, minNdcY, maxNdcX, maxNdcY] = target.visibility.projectedBoundsNdc;
  const centerX = (ndcX * 0.5 + 0.5) * drawingBuffer.x;
  const centerY = (ndcY * 0.5 + 0.5) * drawingBuffer.y;
  const projectedWidth = Math.max(1, (Math.min(1, maxNdcX) - Math.max(-1, minNdcX)) * 0.5 * drawingBuffer.x);
  const projectedHeight = Math.max(1, (Math.min(1, maxNdcY) - Math.max(-1, minNdcY)) * 0.5 * drawingBuffer.y);
  const halfWidth = Math.max(8, Math.min(72, projectedWidth * 0.18));
  const halfHeight = Math.max(8, Math.min(72, projectedHeight * 0.18));
  const x = Math.max(0, Math.floor(centerX - halfWidth));
  const y = Math.max(0, Math.floor(centerY - halfHeight));
  const width = Math.max(1, Math.min(drawingBuffer.x - x, Math.ceil(halfWidth * 2)));
  const height = Math.max(1, Math.min(drawingBuffer.y - y, Math.ceil(halfHeight * 2)));
  const pixels = new Uint8Array(width * height * 4);
  gl.finish();
  gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const count = width * height;
  const sums = [0, 0, 0];
  const squareSums = [0, 0, 0];
  const colors = new Set();
  let luminanceSum = 0;
  let luminanceSquareSum = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const rgb = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    rgb.forEach((value, channel) => {
      sums[channel] += value;
      squareSums[channel] += value * value;
    });
    const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    luminanceSum += luminance;
    luminanceSquareSum += luminance * luminance;
    colors.add(rgb.join(','));
  }
  const means = sums.map((sum) => sum / count);
  const standardDeviations = squareSums.map((sum, channel) => (
    Math.sqrt(Math.max(0, sum / count - means[channel] ** 2))
  ));
  const luminanceMean = luminanceSum / count;
  const luminanceStandardDeviation = Math.sqrt(Math.max(0, luminanceSquareSum / count - luminanceMean ** 2));
  return {
    featureId,
    source: 'webgl-readPixels-centered-on-live-first-hit-projected-feature-without-DOM-callout-overlay',
    renderFrameId: productionRenderSerial,
    firstHitClassification: target.visibility.firstHitClassification,
    projectedNdc: [...target.visibility.projectedNdc],
    drawingBuffer: { width: drawingBuffer.x, height: drawingBuffer.y },
    roi: { x, y, width, height },
    sampleCount: count,
    meanRgb: means.map((value) => rounded(value, 4)),
    standardDeviationRgb: standardDeviations.map((value) => rounded(value, 4)),
    luminanceMean: rounded(luminanceMean, 4),
    luminanceStandardDeviation: rounded(luminanceStandardDeviation, 4),
    uniqueRgbColorCount: colors.size,
  };
}

function setCamera(id) {
  clearQAFeatureCallouts();
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
  const playback = lastCompletedVisitorPlayback;
  const frames = Array.isArray(playback?.frames) ? playback.frames : [];
  const renderFrameIds = frames.map((frame) => frame.renderFrameId);
  const strictlyIncreasingRenderFrameIds = renderFrameIds.length >= 36
    && renderFrameIds.every((value) => Number.isInteger(value) && value > 0)
    && renderFrameIds.slice(1).every((value, index) => value > renderFrameIds[index]);
  const renderedPoints = (playback?.frames || [])
    .filter((frame) => frame.capturedAfterProductionRender === true
      && Array.isArray(frame.worldPosition) && frame.worldPosition.length === 3
      && frame.worldPosition.every(Number.isFinite))
    .map((frame) => new THREE.Vector3().fromArray(frame.worldPosition));
  const currentManifest = actualStructureManifestEvidence(productionView.model(), false);
  const captureManifestFingerprint = playback?.captureActualStructureManifestFingerprint || null;
  const currentManifestFingerprint = currentManifest.manifestFingerprint;
  const manifestFingerprintMatches = Boolean(captureManifestFingerprint
    && captureManifestFingerprint === currentManifestFingerprint);
  const currentRouteManifest = actualVisitorRouteManifestEvidence(productionView.model());
  const captureRouteManifestFingerprint = playback?.captureRouteManifestFingerprint || null;
  const currentRouteManifestFingerprint = currentRouteManifest.manifestFingerprint;
  const routeManifestFingerprintMatches = Boolean(captureRouteManifestFingerprint
    && captureRouteManifestFingerprint === currentRouteManifestFingerprint);
  const currentProfileId = productionView.profile().id;
  const currentSurfaceFingerprint = surfaceFingerprintForView(productionView);
  const profileAndSurfaceMatch = Boolean(
    playback?.captureProfileId === currentProfileId
    && playback?.captureSurfaceFingerprint
    && playback.captureSurfaceFingerprint === currentSurfaceFingerprint,
  );
  const validPlayback = playback?.completed === true
    && playback?.evidenceSource === 'production-raf-post-render-world-position-plus-generator-raycast'
    && frames.length >= 36
    && renderedPoints.length === frames.length
    && Number(playback?.uniquePositionCount || 0) >= 25
    && strictlyIncreasingRenderFrameIds
    && playback?.captureManifestMatchesCompletion === true
    && manifestFingerprintMatches
    && playback?.captureRouteMatchesCompletion === true
    && routeManifestFingerprintMatches
    && playback?.captureSurfaceMatchesCompletion === true
    && profileAndSurfaceMatch;
  if (!validPlayback) {
    throw new Error(`QA route evidence requires a completed live post-render playback with matching structure, route, profile and surface: ${JSON.stringify({
      completed: playback?.completed === true,
      frameCount: frames.length,
      renderedPointCount: renderedPoints.length,
      uniquePositionCount: playback?.uniquePositionCount || 0,
      strictlyIncreasingRenderFrameIds,
      captureManifestFingerprint,
      currentManifestFingerprint,
      captureManifestMatchesCompletion: playback?.captureManifestMatchesCompletion === true,
      manifestFingerprintMatches,
      captureRouteManifestFingerprint,
      currentRouteManifestFingerprint,
      captureRouteMatchesCompletion: playback?.captureRouteMatchesCompletion === true,
      routeManifestFingerprintMatches,
      captureProfileId: playback?.captureProfileId || null,
      currentProfileId,
      captureSurfaceFingerprint: playback?.captureSurfaceFingerprint || null,
      currentSurfaceFingerprint,
      captureSurfaceMatchesCompletion: playback?.captureSurfaceMatchesCompletion === true,
      profileAndSurfaceMatch,
    })}`);
  }
  const points = renderedPoints;
  const evidenceSource = 'actual-rendered-visitor-world-positions';
  const segmentGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  const markerGeometry = new THREE.SphereGeometry(1, 10, 8);
  const routeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd12e, depthTest: false, depthWrite: false });
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a2e, depthTest: false, depthWrite: false });
  const group = new THREE.Group();
  group.name = 'V550_qa_actual_visitor_route_overlay';
  group.userData = {
    qaEvidenceOnly: true, source: evidenceSource,
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
    capturedAfterProductionRender: true,
    renderFrameIds,
    strictlyIncreasingRenderFrameIds,
    captureActualStructureManifestFingerprint: captureManifestFingerprint,
    currentActualStructureManifestFingerprint: currentManifestFingerprint,
    actualStructureManifestFingerprintMatches: manifestFingerprintMatches,
    routeManifestContract: currentRouteManifest.contract,
    captureRouteManifestFingerprint,
    currentRouteManifestFingerprint,
    routeManifestFingerprintMatches,
    captureRoutePointFingerprint: playback.captureRoutePointFingerprint,
    currentRoutePointFingerprint: currentRouteManifest.pointFingerprint,
    captureRouteAnchorFingerprint: playback.captureRouteAnchorFingerprint,
    currentRouteAnchorFingerprint: currentRouteManifest.anchorFingerprint,
    captureRouteMatchesCompletion: playback.captureRouteMatchesCompletion === true,
    captureProfileId: playback.captureProfileId,
    currentProfileId,
    captureSurfaceFingerprint: playback.captureSurfaceFingerprint,
    currentSurfaceFingerprint,
    profileAndSurfaceMatch,
    routeFingerprint: fnv1a(points.map((point) => point.toArray().map((value) => rounded(value, 5)).join(','))),
    worldBounds: cameraBoundsEvidence(new THREE.Box3().setFromPoints(points)),
  };
}

function setPreset(id) {
  disposeQARouteOverlay();
  stopVisitorAnimation('surface preset reload');
  lastCompletedVisitorPlayback = null;
  restoreQADisplayState();
  setQAAbutmentIsolation(false);
  qaRoofIsolation = null;
  qaRoofLayerIsolation = null;
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
  const requested = typeof value === 'number' ? Math.max(0, value) : Boolean(value);
  productionView.model().userData.actions.setRoofExploded(requested);
  productionView.model().updateMatrixWorld(true);
  setPressed('#explode', typeof requested === 'number' ? requested > 0 : requested);
  return inspect('production');
}

function setQARoofIsolation(roofUnitId = null) {
  const model = productionView.model();
  const requested = typeof roofUnitId === 'string' && roofUnitId.length ? roofUnitId : null;
  const roofUnits = [];
  model.traverse((object) => {
    if (object.isGroup && object.userData?.isRoofUnit === true) roofUnits.push(object);
  });
  if (requested && !roofUnits.some((roof) => roof.userData.roofUnitId === requested)) {
    throw new Error(`Unknown QA roof unit: ${requested}`);
  }
  roofUnits.forEach((roof) => { roof.visible = requested === null || roof.userData.roofUnitId === requested; });
  qaRoofIsolation = requested;
  const state = {
    active: requested !== null,
    isolatedRoofUnitId: requested,
    visibleRoofUnitIds: roofUnits.filter((roof) => roof.visible).map((roof) => roof.userData.roofUnitId).sort(),
    hiddenRoofUnitIds: roofUnits.filter((roof) => !roof.visible).map((roof) => roof.userData.roofUnitId).sort(),
    generatedRoofUnitCount: roofUnits.length,
    evidenceContract: 'visibility-only-QA-isolation-all-roof-units-remain-generated',
  };
  model.userData.runtimeState.qaRoofIsolation = state;
  productionView.needsRender = true;
  return state;
}

function setQARoofLayerIsolation(layerIds = null) {
  const model = productionView.model();
  const requested = Array.isArray(layerIds) && layerIds.length ? [...new Set(layerIds)] : null;
  if (requested && requested.some((layerId) => !ROOF_LAYER_IDS.includes(layerId))) {
    throw new Error(`Unknown QA roof layer: ${requested.filter((layerId) => !ROOF_LAYER_IDS.includes(layerId)).join(',')}`);
  }
  const layerGroups = [];
  model.traverse((object) => {
    if (object.isGroup && ROOF_LAYER_IDS.includes(object.userData?.roofLayerId)) layerGroups.push(object);
  });
  layerGroups.forEach((layer) => { layer.visible = requested === null || requested.includes(layer.userData.roofLayerId); });
  qaRoofLayerIsolation = requested ? [...requested].sort() : null;
  const state = {
    active: requested !== null,
    visibleLayerIds: requested ? [...requested].sort() : [...ROOF_LAYER_IDS].sort(),
    hiddenLayerIds: requested ? ROOF_LAYER_IDS.filter((layerId) => !requested.includes(layerId)).sort() : [],
    generatedLayerIds: [...new Set(layerGroups.map((layer) => layer.userData.roofLayerId))].sort(),
    generatedLayerGroupCount: layerGroups.length,
    evidenceContract: 'visibility-only-QA-layer-isolation-all-seven-build-up-layers-remain-generated',
  };
  model.userData.runtimeState.qaRoofLayerIsolation = state;
  productionView.needsRender = true;
  return state;
}

function setQAAbutmentIsolation(enabled = false) {
  if (qaAbutmentIsolation?.records) {
    qaAbutmentIsolation.records.forEach(({ object, visible }) => { object.visible = visible; });
    qaAbutmentIsolation = null;
  }
  const model = productionView.model();
  if (!enabled) {
    const state = {
      active: false,
      evidenceContract: 'explicit-QA-diagnostic-restored-all-non-host-timber-renderables',
    };
    model.userData.runtimeState.qaAbutmentIsolation = state;
    productionView.needsRender = true;
    return state;
  }
  let host = null;
  model.traverse((object) => {
    if (!host && object.userData?.semanticRole === 'roof-abutment-host'
      && object.userData?.componentId === 'FRAME-EAST-EAR-INNER-HIGH-EDGE') host = object;
  });
  if (!host) throw new Error('Missing declared east-xiaoxia roof-abutment host');
  const records = [];
  const frameRoot = model.children.find((child) => child.userData?.layer === 'timber-frame');
  frameRoot?.traverse((object) => {
    if (!object.isMesh || object === host) return;
    records.push({ object, visible: object.visible });
    object.visible = false;
  });
  qaAbutmentIsolation = { records, host };
  const state = {
    active: true,
    isolatedRoofUnitId: qaRoofIsolation,
    preservedHostComponentId: host.userData.componentId,
    preservedHostSemanticRole: host.userData.semanticRole,
    preservedHostVisible: host.visible,
    hiddenNonHostTimberRenderableCount: records.length,
    hiddenScope: 'non-host-renderables-under-timber-frame-root-only',
    wallsPreserved: model.children.find((child) => child.userData?.layer === 'walls')?.visible === true,
    allRoofUnitsRemainGenerated: deriveRoofEvidence(model).roofUnitCount === 7,
    evidenceContract: 'explicit-visibility-only-QA-isolation-preserves-declared-host-and-restores-after-screenshot',
  };
  model.userData.runtimeState.qaAbutmentIsolation = state;
  productionView.needsRender = true;
  return state;
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
    const snapshot = typeof action === 'function'
      ? action(value) : { baselineStatic: true, progress: 0 };
    view.needsRender = true;
    return snapshot;
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
    const snapshot = typeof action === 'function'
      ? action(value) : { baselineStatic: true, progress: 0 };
    view.needsRender = true;
    return snapshot;
  });
  setPressed('#visitor', value > 0.5);
  return result;
}

function publishVisitorPlayback(state, completed = false) {
  const elapsedMs = Math.max(0, (state.lastTimestampMs ?? performance.now()) - (state.clockStartedAtMs ?? state.startedAtMs));
  const current = {
    evidenceSource: state.evidenceSource,
    clockSource: state.clockSource,
    captureContract: state.captureContract,
    durationRequestedMs: state.durationRequestedMs,
    elapsedMs,
    durationSatisfied: elapsedMs >= state.durationRequestedMs,
    requestedFrameCount: state.requestedFrameCount,
    minimumFrameCount: state.minimumFrameCount,
    frameCount: state.frames.length,
    renderedFrameCount: state.frames.length,
    uniquePositionCount: state.uniquePositions.size,
    stages: [...state.stages],
    frameFailures: [...state.frameFailures],
    frames: [...state.frames],
    wallIntersectionCount: state.wallIntersectionCount,
    openingCollisionCount: state.openingCollisionCount,
    railCollisionCount: state.railCollisionCount,
    suspendedFrameCount: state.suspendedFrameCount,
    stuckFrameCount: state.stuckFrameCount,
    captureActualStructureManifestFingerprint: state.captureActualStructureManifestFingerprint,
    completionActualStructureManifestFingerprint: state.completionActualStructureManifestFingerprint || null,
    captureManifestMatchesCompletion: state.captureManifestMatchesCompletion === true,
    routeManifestContract: state.captureRouteManifest?.contract || null,
    captureRouteManifestFingerprint: state.captureRouteManifest?.manifestFingerprint || null,
    completionRouteManifestFingerprint: state.completionRouteManifest?.manifestFingerprint || null,
    captureRoutePointFingerprint: state.captureRouteManifest?.pointFingerprint || null,
    completionRoutePointFingerprint: state.completionRouteManifest?.pointFingerprint || null,
    captureRouteAnchorFingerprint: state.captureRouteManifest?.anchorFingerprint || null,
    completionRouteAnchorFingerprint: state.completionRouteManifest?.anchorFingerprint || null,
    captureRouteManifest: state.captureRouteManifest?.manifest || null,
    captureRouteMatchesCompletion: state.captureRouteMatchesCompletion === true,
    captureProfileId: state.captureProfileId,
    completionProfileId: state.completionProfileId || null,
    captureSurfaceFingerprint: state.captureSurfaceFingerprint,
    completionSurfaceFingerprint: state.completionSurfaceFingerprint || null,
    captureSurfaceMatchesCompletion: state.captureSurfaceMatchesCompletion === true,
    completed,
  };
  views.forEach((view) => {
    view.model().userData.runtimeState ||= {};
    view.model().userData.runtimeState.browserPlayback = current;
  });
  return current;
}

function stopVisitorAnimation(reason = 'stopped') {
  if (!visitorPlaybackState) return;
  const state = visitorPlaybackState;
  visitorPlaybackState = null;
  state.frameFailures.push({ type: 'PlaybackInterrupted', reason });
  const result = publishVisitorPlayback(state, false);
  state.resolve?.(result);
}

function setVisitor(value) {
  stopVisitorAnimation('setVisitorProgress invoked');
  return applyVisitorProgress(value);
}

function prepareVisitorPlaybackFrame(now) {
  const state = visitorPlaybackState;
  if (!state || state.pendingFrame || state.finalProgressApplied) return;
  if (state.clockStartedAtMs === null) state.clockStartedAtMs = now;
  const index = state.nextFrameIndex;
  const clockElapsedMs = Math.max(0, now - state.clockStartedAtMs);
  const clockProgress = THREE.MathUtils.clamp(clockElapsedMs / state.durationRequestedMs, 0, 1);
  const frameFloorProgress = THREE.MathUtils.clamp(index / (state.minimumFrameCount - 1), 0, 1);
  const progress = Math.min(clockProgress, frameFloorProgress);
  const renderSerialBefore = productionRenderSerial;
  const snapshots = applyVisitorProgress(progress);
  const productionSnapshot = snapshots[1] || snapshots[0] || null;
  state.pendingFrame = {
    index, progress, clockElapsedMs, clockProgress, frameFloorProgress,
    renderSerialBefore, requestedAtMs: now, productionSnapshot,
  };
  state.nextFrameIndex += 1;
  state.finalProgressApplied = progress >= 1;
  productionView.needsRender = true;
}

function captureVisitorPlaybackFrame(now) {
  const state = visitorPlaybackState;
  if (!state?.pendingFrame) return;
  const pending = state.pendingFrame;
  state.pendingFrame = null;
  const snapshot = pending.productionSnapshot || {};
  const model = productionView.model();
  const actor = model.getObjectByName('visitor_route_actor');
  actor?.updateWorldMatrix(true, false);
  const worldPosition = actor?.getWorldPosition(new THREE.Vector3()) || null;
  const position = worldPosition?.toArray() || null;
  const roundedPosition = Array.isArray(position)
    ? position.map((value) => rounded(value, 6)) : null;
  const positionKey = roundedPosition?.map((value) => rounded(value, 5)).join(',') || null;
  const previousFrame = state.frames.at(-1);
  const reportedPosition = Array.isArray(snapshot.position)
    ? new THREE.Vector3().fromArray(snapshot.position).applyMatrix4(model.matrixWorld) : null;
  const reportDeviationM = worldPosition && reportedPosition
    ? worldPosition.distanceTo(reportedPosition) : Number.POSITIVE_INFINITY;
  const routePoints = state.routeWorldPoints;
  const nearest = worldPosition ? nearestRouteProgress(routePoints, worldPosition) : null;
  const supportGapM = snapshot.supportGapM;
  const supportSnapOffsetM = Number.isFinite(snapshot.requestedElevationM) && worldPosition
    ? Math.abs(worldPosition.y - snapshot.requestedElevationM) : Number.POSITIVE_INFINITY;
  const allowedRouteDeviationM = Math.max(
    0.02,
    Number.isFinite(snapshot.requestedSupportGapM) ? snapshot.requestedSupportGapM + 0.002 : 0.02,
  );
  const suspended = snapshot.suspendedFrameCount > 0 || snapshot.supportId == null
    || !Number.isFinite(supportGapM) || supportGapM > 0.03;
  const repeatedPosition = Boolean(previousFrame && roundedPosition
    && previousFrame.progress < pending.progress
    && new THREE.Vector3().fromArray(previousFrame.worldPosition).distanceTo(worldPosition) <= 1e-5);
  const stuck = Number(snapshot.stuckFrameCount || 0) > 0 || repeatedPosition;
  const frame = {
    index: pending.index,
    renderFrameId: productionRenderSerial,
    capturedAfterProductionRender: true,
    timestampMs: rounded(now, 4),
    progress: rounded(pending.progress, 8),
    clockElapsedMs: rounded(pending.clockElapsedMs, 4),
    clockProgress: rounded(pending.clockProgress, 8),
    minimumFrameProgress: rounded(pending.frameFloorProgress, 8),
    worldPosition: roundedPosition,
    reportedWorldPosition: reportedPosition?.toArray().map((value) => rounded(value, 6)) || null,
    reportedPositionDeviationM: rounded(reportDeviationM, 8),
    routeProgressFromWorldPosition: rounded(nearest?.progress, 8),
    routeDeviationM: rounded(nearest?.distance, 8),
    allowedRouteDeviationM: rounded(allowedRouteDeviationM, 8),
    supportSnapOffsetM: rounded(supportSnapOffsetM, 8),
    stage: snapshot.stage || null,
    supportId: snapshot.supportId || null,
    supportGapM: rounded(supportGapM, 8),
    requestedSupportGapM: rounded(snapshot.requestedSupportGapM, 8),
    wallIntersectionCount: Number(snapshot.wallIntersectionCount || 0),
    openingCollisionCount: Number(snapshot.openingCollisionCount || 0),
    railCollisionCount: Number(snapshot.railCollisionCount || 0),
    suspended,
    stuck,
  };
  const frameFailures = [];
  if (!roundedPosition || !roundedPosition.every(Number.isFinite)) frameFailures.push('invalid-world-position');
  if (!Number.isFinite(frame.reportedPositionDeviationM) || frame.reportedPositionDeviationM > 1e-5) frameFailures.push('reported-world-position-mismatch');
  if (!Number.isFinite(frame.routeDeviationM) || frame.routeDeviationM > allowedRouteDeviationM) frameFailures.push('outside-route-plus-support-snap-envelope');
  if (frame.wallIntersectionCount > 0) frameFailures.push('wall-intersection');
  if (frame.openingCollisionCount > 0) frameFailures.push('opening-collision');
  if (frame.railCollisionCount > 0) frameFailures.push('rail-collision');
  if (suspended) frameFailures.push('unsupported-or-suspended');
  if (stuck) frameFailures.push('continuous-stall');
  if (previousFrame && frame.renderFrameId <= previousFrame.renderFrameId) frameFailures.push('non-increasing-render-frame-id');
  if (previousFrame && frame.timestampMs <= previousFrame.timestampMs) frameFailures.push('non-increasing-raf-timestamp');
  if (previousFrame && frame.progress <= previousFrame.progress) frameFailures.push('non-increasing-progress');
  if (frameFailures.length) state.frameFailures.push({
    index: frame.index, renderFrameId: frame.renderFrameId, failures: frameFailures, frame,
  });
  state.frames.push(frame);
  if (positionKey) state.uniquePositions.add(positionKey);
  if (frame.stage) state.stages.add(frame.stage);
  state.wallIntersectionCount += frame.wallIntersectionCount;
  state.openingCollisionCount += frame.openingCollisionCount;
  state.railCollisionCount += frame.railCollisionCount;
  state.suspendedFrameCount += suspended ? 1 : 0;
  state.stuckFrameCount += stuck ? 1 : 0;
  state.lastTimestampMs = now;
  publishVisitorPlayback(state, false);

  const clockElapsedMs = now - state.clockStartedAtMs;
  if (pending.progress < 1 || state.frames.length < state.minimumFrameCount || clockElapsedMs < state.durationRequestedMs) return;
  const finalSnapshot = model.userData.runtimeState?.visitorSnapshot;
  const finalVisitorWithPlayback = deriveVisitorEvidence(model);
  // The destination is a point-in-time generator/raycast result.  Keeping the
  // in-progress browserPlayback object here both contradicts the final result
  // and recursively duplicates every captured frame in the JSON report.
  const { browserPlayback: _discardedPlayback, ...finalVisitor } = finalVisitorWithPlayback;
  const reachedDestination = finalSnapshot?.complete === true
    && finalVisitor?.complete === true && finalVisitor?.reachedUpperFloor === true;
  if (!reachedDestination) state.frameFailures.push({
    type: 'DestinationNotReached', finalSnapshot, finalVisitor,
  });
  const completionManifest = actualStructureManifestEvidence(model, false);
  state.completionActualStructureManifestFingerprint = completionManifest.manifestFingerprint;
  state.captureManifestMatchesCompletion = Boolean(state.captureActualStructureManifestFingerprint
    && state.captureActualStructureManifestFingerprint === state.completionActualStructureManifestFingerprint);
  if (!state.captureManifestMatchesCompletion) state.frameFailures.push({
    type: 'ActualStructureManifestChangedDuringPlayback',
    captureActualStructureManifestFingerprint: state.captureActualStructureManifestFingerprint,
    completionActualStructureManifestFingerprint: state.completionActualStructureManifestFingerprint,
  });
  state.completionRouteManifest = actualVisitorRouteManifestEvidence(model);
  state.captureRouteMatchesCompletion = Boolean(
    state.captureRouteManifest?.manifestFingerprint
    && state.captureRouteManifest.manifestFingerprint
      === state.completionRouteManifest.manifestFingerprint,
  );
  state.completionProfileId = productionView.profile().id;
  state.completionSurfaceFingerprint = surfaceFingerprintForView(productionView);
  state.captureSurfaceMatchesCompletion = Boolean(
    state.captureProfileId === state.completionProfileId
    && state.captureSurfaceFingerprint
    && state.captureSurfaceFingerprint === state.completionSurfaceFingerprint,
  );
  if (!state.captureRouteMatchesCompletion) state.frameFailures.push({
    type: 'VisitorRouteManifestChangedDuringPlayback',
    captureRouteManifestFingerprint: state.captureRouteManifest?.manifestFingerprint || null,
    completionRouteManifestFingerprint: state.completionRouteManifest.manifestFingerprint,
  });
  if (!state.captureSurfaceMatchesCompletion) state.frameFailures.push({
    type: 'SurfaceOrProfileChangedDuringPlayback',
    captureProfileId: state.captureProfileId,
    completionProfileId: state.completionProfileId,
    captureSurfaceFingerprint: state.captureSurfaceFingerprint,
    completionSurfaceFingerprint: state.completionSurfaceFingerprint,
  });
  const completed = reachedDestination
    && state.frames.length >= 36
    && state.uniquePositions.size >= 25
    && clockElapsedMs >= state.durationRequestedMs
    && state.frameFailures.length === 0;
  const result = {
    ...publishVisitorPlayback(state, completed),
    elapsedMs: clockElapsedMs,
    durationSatisfied: clockElapsedMs >= state.durationRequestedMs,
    destination: finalVisitor,
    finalSnapshot,
  };
  views.forEach((view) => {
    view.model().userData.runtimeState.browserPlayback = result;
  });
  if (completed) lastCompletedVisitorPlayback = result;
  visitorPlaybackState = null;
  setPressed('#visitor', true);
  state.resolve?.(result);
}

function playVisitorRoute(durationMs = 5600) {
  stopVisitorAnimation('superseded by a new playback');
  lastCompletedVisitorPlayback = null;
  setOpenings(1);
  applyVisitorProgress(0);
  const duration = Math.max(1200, Number(durationMs) || 5600);
  const minimumFrameCount = 36;
  const captureRouteManifest = actualVisitorRouteManifestEvidence(productionView.model());
  const captureProfileId = productionView.profile().id;
  const captureSurfaceFingerprint = surfaceFingerprintForView(productionView);
  return new Promise((resolve) => {
    visitorPlaybackState = {
      evidenceSource: 'production-raf-post-render-world-position-plus-generator-raycast',
      clockSource: 'requestAnimationFrame-timestamp-duration-gated-by-minimum-rendered-frames',
      captureContract: 'timestamp-progress-applied-before-and-world-position-read-after-same-production-render',
      durationRequestedMs: duration,
      requestedFrameCount: minimumFrameCount,
      minimumFrameCount,
      startedAtMs: performance.now(),
      clockStartedAtMs: null,
      lastTimestampMs: null,
      nextFrameIndex: 0,
      pendingFrame: null,
      finalProgressApplied: false,
      routeWorldPoints: routeWorldPoints(),
      captureActualStructureManifestFingerprint: actualStructureManifestEvidence(
        productionView.model(), false,
      ).manifestFingerprint,
      completionActualStructureManifestFingerprint: null,
      captureManifestMatchesCompletion: false,
      captureRouteManifest,
      completionRouteManifest: null,
      captureRouteMatchesCompletion: false,
      captureProfileId,
      completionProfileId: null,
      captureSurfaceFingerprint,
      completionSurfaceFingerprint: null,
      captureSurfaceMatchesCompletion: false,
      frames: [],
      uniquePositions: new Set(),
      stages: new Set(),
      frameFailures: [],
      wallIntersectionCount: 0,
      openingCollisionCount: 0,
      railCollisionCount: 0,
      suspendedFrameCount: 0,
      stuckFrameCount: 0,
      resolve,
    };
    publishVisitorPlayback(visitorPlaybackState, false);
  });
}

function visitorPlayback() {
  return { ...(productionView.model().userData?.runtimeState?.browserPlayback || {}) };
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
  setQAAbutmentIsolation(false);
  setQALighting('default');
  setQARoofIsolation(null);
  setQARoofLayerIsolation(null);
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

function numericAttributeToken(attribute, digits = 5) {
  if (!attribute?.array) return 'none';
  let hash = 0x811c9dc5;
  const scale = 10 ** digits;
  for (let index = 0; index < attribute.array.length; index += 1) {
    const quantized = Math.round(Number(attribute.array[index]) * scale) | 0;
    for (let shift = 0; shift < 32; shift += 8) {
      hash ^= (quantized >>> shift) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}:${attribute.count}x${attribute.itemSize}`;
}

const geometryStructureTokenCache = new WeakMap();

function geometryToken(geometry) {
  if (!geometry) return 'no-geometry';
  if (geometryStructureTokenCache.has(geometry)) return geometryStructureTokenCache.get(geometry);
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const position = geometry.getAttribute?.('position');
  const bounds = geometry.boundingBox;
  const token = JSON.stringify([
    geometry.type,
    position?.count || 0,
    geometry.index?.count || 0,
    `position:${numericAttributeToken(position, 5)}`,
    `index:${numericAttributeToken(geometry.index, 0)}`,
    bounds ? [...bounds.min.toArray(), ...bounds.max.toArray()].map((value) => rounded(value)) : [],
  ]);
  geometryStructureTokenCache.set(geometry, token);
  return token;
}

const STRUCTURE_SEMANTIC_KEYS = Object.freeze([
  'buildingUnitId', 'roofUnitId', 'sectionId', 'componentId', 'hostId',
  'openingId', 'openingKind', 'apertureM', 'flight', 'flightId', 'step',
  'landing', 'landingId', 'landingIds', 'supportId', 'stairRole',
  'semanticRole', 'collisionRole', 'memberType', 'bay', 'slopeId',
]);

function canonicalManifestValue(value) {
  if (typeof value === 'number') return rounded(value, 6);
  if (Array.isArray(value)) return value.map(canonicalManifestValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonicalManifestValue(value[key])]));
  return value;
}

function ancestorUserDataValue(object, key, root) {
  let current = object;
  while (current) {
    if (Object.prototype.hasOwnProperty.call(current.userData || {}, key)) return current.userData[key];
    if (current === root) break;
    current = current.parent;
  }
  return undefined;
}

function structuralManifestObjectName(object, root) {
  // The two comparison roots intentionally carry version-facing display
  // names.  That label is not building structure; every descendant name,
  // component ID, transform, bound and geometry token remains unmodified.
  return object === root ? 'YunnanCourtyard_ComparisonStructure' : (object.name || null);
}

function manifestIdentity(object, root) {
  return {
    name: structuralManifestObjectName(object, root),
    objectType: object.type || null,
    semanticType: object.userData?.type || null,
    layer: object.userData?.layer || null,
    roofLayerId: object.userData?.roofLayerId || null,
    wallLayerId: object.userData?.wallLayerId || null,
    buildingUnitId: object.userData?.buildingUnitId || null,
    roofUnitId: object.userData?.roofUnitId || null,
    sectionId: object.userData?.sectionId || null,
    componentId: object.userData?.componentId || null,
    openingId: object.userData?.openingId || null,
    visible: object.visible === true,
  };
}

function ancestorIdentityVisibility(object, root) {
  const chain = [];
  let current = object;
  while (current) {
    const identity = manifestIdentity(current, root);
    if (current === object || current === root || Object.values(identity).some((value) => (
      value !== null && value !== '' && value !== true
    ))) chain.push(identity);
    if (current === root) break;
    current = current.parent;
  }
  return {
    selfVisible: object.visible === true,
    visibleInTree: visibleInTree(object, root),
    chain,
  };
}

function structuralSemanticContext(object, root, instanceIndex = null) {
  const inherited = {};
  STRUCTURE_SEMANTIC_KEYS.forEach((key) => {
    const value = ancestorUserDataValue(object, key, root);
    if (value !== undefined && value !== null) inherited[key] = canonicalManifestValue(value);
  });
  const instance = Number.isInteger(instanceIndex)
    ? object.userData?.instanceMap?.[instanceIndex] : null;
  const instanceSemantic = {};
  if (instance) STRUCTURE_SEMANTIC_KEYS.forEach((key) => {
    if (instance[key] !== undefined && instance[key] !== null) {
      instanceSemantic[key] = canonicalManifestValue(instance[key]);
    }
  });
  const parentLayerVisibility = [];
  let parent = object.parent;
  while (parent) {
    const layerEvidence = {
      name: structuralManifestObjectName(parent, root),
      layer: parent.userData?.layer || null,
      roofLayerId: parent.userData?.roofLayerId || null,
      wallLayerId: parent.userData?.wallLayerId || null,
      type: parent.userData?.type || null,
      buildingUnitId: parent.userData?.buildingUnitId || null,
      roofUnitId: parent.userData?.roofUnitId || null,
      sectionId: parent.userData?.sectionId || null,
      componentId: parent.userData?.componentId || null,
      visible: parent.visible === true,
    };
    if (layerEvidence.layer || layerEvidence.roofLayerId || layerEvidence.wallLayerId
      || layerEvidence.type || parent === root) parentLayerVisibility.push(layerEvidence);
    if (parent === root) break;
    parent = parent.parent;
  }
  return { inherited, instance: instanceSemantic, parentLayerVisibility };
}

function structuralRenderableIncluded(model, object) {
  if (hasNamedAncestor(object, 'V550_wall_surface_system')) return false;
  const rootLayer = ancestorValue(object, 'layer', model);
  const roofLayer = ancestorValue(object, 'roofLayerId', model);
  if (['stone-and-ground', 'walls', 'timber-frame', 'doors-windows'].includes(rootLayer)) return true;
  return rootLayer === 'roof-production' && ['purlins', 'rafters', 'roofUnderlay'].includes(roofLayer);
}

function actualStructureManifestEvidence(model, includeRecords = false) {
  model.updateMatrixWorld(true);
  const records = [];
  const instanceMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  const boundsArray = (bounds, digits = 6) => bounds?.isEmpty?.() === false
    ? [...bounds.min.toArray(), ...bounds.max.toArray()].map((value) => rounded(value, digits)) : null;
  const matrixArray = (matrix) => matrix.elements.map((value) => rounded(value, 6));
  const compactRenderable = (object) => ({
    componentId: object.userData?.componentId || null,
    semanticType: object.userData?.type || null,
    semanticRole: object.userData?.semanticRole || null,
    supportId: object.userData?.supportId || null,
    worldBounds: boundsArray(new THREE.Box3().setFromObject(object)),
    worldMatrix: matrixArray(object.matrixWorld),
    geometryFingerprint: object.geometry ? fnv1a([geometryToken(object.geometry)]) : null,
    ancestorIdentityVisibility: ancestorIdentityVisibility(object, model),
  });

  model.traverse((object) => {
    if (!object.isMesh || !object.geometry || !structuralRenderableIncluded(model, object)) return;
    const record = (matrix, worldBounds, instanceIndex = null) => ({
      rootLayer: ancestorValue(object, 'layer', model) || null,
      roofLayerId: ancestorValue(object, 'roofLayerId', model) || null,
      wallLayerId: ancestorValue(object, 'wallLayerId', model) || null,
      renderableType: object.userData?.type || object.type,
      instanced: object.isInstancedMesh === true,
      instanceIndex,
      semantic: structuralSemanticContext(object, model, instanceIndex),
      ancestorIdentityVisibility: ancestorIdentityVisibility(object, model),
      geometryFingerprint: fnv1a([geometryToken(object.geometry)]),
      worldMatrix: matrixArray(matrix),
      worldBounds: boundsArray(worldBounds),
    });
    if (object.isInstancedMesh) {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, instanceMatrix);
        worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
        const bounds = object.geometry.boundingBox.clone().applyMatrix4(worldMatrix);
        records.push(record(worldMatrix, bounds, index));
      }
    } else {
      records.push(record(object.matrixWorld, new THREE.Box3().setFromObject(object)));
    }
  });

  const structuralRoofLayerIds = ['purlins', 'rafters', 'roofUnderlay'];
  const roofRoots = [];
  model.traverse((object) => {
    if (object.userData?.isRoofUnit === true) roofRoots.push(object);
  });
  const roofBoundsById = new Map();
  const roofUnits = roofRoots.map((roof) => {
    const slopeSectionIds = new Map();
    const sectionRoots = [];
    roof.traverse((object) => {
      if (object.userData?.type === 'roof-section' && object.userData?.sectionId) sectionRoots.push(object);
      if (object.userData?.type === 'roof-slope' && object.userData?.slopeId && object.userData?.sectionId) {
        slopeSectionIds.set(object.userData.slopeId, object.userData.sectionId);
      }
    });
    const layerEvidence = (sectionId = null) => Object.fromEntries(structuralRoofLayerIds.map((layerId) => {
      let actualCount = 0;
      const layerBounds = new THREE.Box3();
      roof.traverse((object) => {
        if (!object.isMesh || !object.geometry || ancestorValue(object, 'roofLayerId', roof) !== layerId) return;
        const objectSectionId = object.userData?.sectionId
          || slopeSectionIds.get(object.userData?.slopeId) || null;
        if (object.isInstancedMesh) {
          const semantic = object.userData?.instanceMap || [];
          const indices = Array.from({ length: object.count }, (_, index) => index).filter((index) => {
            const instanceSectionId = semantic[index]?.sectionId || objectSectionId;
            return sectionId === null || instanceSectionId === sectionId;
          });
          if (indices.length) {
            actualCount += indices.length;
            layerBounds.union(instanceWorldBounds(object, indices));
          }
        } else if (sectionId === null || objectSectionId === sectionId) {
          actualCount += 1;
          layerBounds.union(new THREE.Box3().setFromObject(object));
        }
      });
      return [layerId, {
        actualRenderableCount: actualCount,
        worldBounds: boundsArray(layerBounds),
      }];
    }));
    const sections = sectionRoots.map((section) => {
      const structuralLayers = layerEvidence(section.userData.sectionId);
      const structuralBounds = new THREE.Box3();
      Object.values(structuralLayers).forEach((layer) => {
        if (!Array.isArray(layer.worldBounds)) return;
        structuralBounds.union(new THREE.Box3(
          new THREE.Vector3().fromArray(layer.worldBounds.slice(0, 3)),
          new THREE.Vector3().fromArray(layer.worldBounds.slice(3, 6)),
        ));
      });
      return {
        sectionId: section.userData.sectionId,
        roofUnitId: roof.userData.roofUnitId,
        structuralLayers,
        structuralRenderableCount: Object.values(structuralLayers)
          .reduce((sum, layer) => sum + layer.actualRenderableCount, 0),
        structuralWorldBounds: boundsArray(structuralBounds),
        sectionTransform: canonicalManifestValue(section.userData?.sectionTransform || null),
        ancestorIdentityVisibility: ancestorIdentityVisibility(section, model),
      };
    }).sort((left, right) => left.sectionId.localeCompare(right.sectionId));
    const structuralLayers = layerEvidence();
    const structuralBounds = new THREE.Box3();
    Object.values(structuralLayers).forEach((layer) => {
      if (!Array.isArray(layer.worldBounds)) return;
      structuralBounds.union(new THREE.Box3(
        new THREE.Vector3().fromArray(layer.worldBounds.slice(0, 3)),
        new THREE.Vector3().fromArray(layer.worldBounds.slice(3, 6)),
      ));
    });
    roofBoundsById.set(roof.userData.roofUnitId, structuralBounds);
    return {
      roofUnitId: roof.userData.roofUnitId,
      buildingUnitId: roof.userData.buildingUnitId,
      roofType: roof.userData.roofType,
      sectionCount: sections.length,
      sections,
      structuralLayers,
      structuralRenderableCount: Object.values(structuralLayers)
        .reduce((sum, layer) => sum + layer.actualRenderableCount, 0),
      structuralWorldBounds: boundsArray(structuralBounds),
      ancestorIdentityVisibility: ancestorIdentityVisibility(roof, model),
    };
  }).sort((left, right) => left.roofUnitId.localeCompare(right.roofUnitId));

  const buildingIds = [...new Set(roofUnits.map((roof) => roof.buildingUnitId).filter(Boolean))].sort();
  const buildingUnits = buildingIds.map((buildingUnitId) => {
    const units = roofUnits.filter((roof) => roof.buildingUnitId === buildingUnitId);
    const bounds = new THREE.Box3();
    units.forEach((unit) => {
      const unitBounds = roofBoundsById.get(unit.roofUnitId);
      if (unitBounds && !unitBounds.isEmpty()) bounds.union(unitBounds);
    });
    return {
      buildingUnitId,
      roofUnitCount: units.length,
      roofUnitIds: units.map((unit) => unit.roofUnitId).sort(),
      structuralWorldBounds: boundsArray(bounds),
    };
  });

  const wallHosts = [];
  const wallOpeningHosts = [];
  model.traverse((object) => {
    if (object.userData?.semanticRole === 'opening-host') {
      const descendantComponentIds = [];
      object.traverse((child) => {
        if (child.isMesh && child.userData?.semanticRole === 'wall-core'
          && child.userData?.componentId) descendantComponentIds.push(child.userData.componentId);
      });
      wallOpeningHosts.push({
        componentId: object.userData?.componentId || null,
        openingIds: [...(object.userData?.openingIds || [])].sort(),
        descendantWallComponentIds: descendantComponentIds.sort(),
        worldBounds: boundsArray(new THREE.Box3().setFromObject(object)),
        ancestorIdentityVisibility: ancestorIdentityVisibility(object, model),
      });
    }
    if (!object.isMesh || (object.userData?.semanticRole !== 'wall-core'
      && object.userData?.collisionRole !== 'partition-wall')) return;
    wallHosts.push({
      componentId: object.userData?.componentId || null,
      hostId: object.userData?.surfaceHostId || object.userData?.componentId || null,
      facadeId: object.userData?.facadeId || null,
      semanticRole: object.userData?.semanticRole || null,
      collisionRole: object.userData?.collisionRole || null,
      surfaceHostKind: object.userData?.surfaceHostKind || null,
      openingIds: [...(object.userData?.openingIds || [])].sort(),
      dimensionsM: canonicalManifestValue(object.userData?.dimensionsM || null),
      actualElementCount: object.isInstancedMesh ? object.count : 1,
      instanceComponentIds: object.isInstancedMesh
        ? (object.userData?.instanceMap || []).map((item) => item.componentId).filter(Boolean).sort() : [],
      worldBounds: boundsArray(new THREE.Box3().setFromObject(object)),
      geometryFingerprint: fnv1a([geometryToken(object.geometry)]),
      ancestorIdentityVisibility: ancestorIdentityVisibility(object, model),
    });
  });
  wallHosts.sort((left, right) => String(left.componentId).localeCompare(String(right.componentId)));
  wallOpeningHosts.sort((left, right) => String(left.componentId).localeCompare(String(right.componentId)));

  const openings = [];
  model.traverse((assembly) => {
    if (!assembly.userData?.openingKind) return;
    const pivots = [];
    const frames = [];
    const leaves = [];
    const replacementParts = [];
    assembly.traverse((object) => {
      if (object.userData?.semanticRole === 'opening-hinge') {
        pivots.push({
          componentId: object.userData?.componentId || null,
          openingId: object.userData?.openingId || null,
          axisLocal: canonicalManifestValue(object.userData?.axisLocal || null),
          angleRangeRad: canonicalManifestValue(object.userData?.angleRangeRad || null),
          currentAngleRad: rounded(object.rotation.y, 6),
          worldMatrix: matrixArray(object.matrixWorld),
          worldBounds: boundsArray(new THREE.Box3().setFromObject(object)),
          ancestorIdentityVisibility: ancestorIdentityVisibility(object, model),
        });
      }
      if (!object.isMesh) return;
      const record = compactRenderable(object);
      record.openingSurfaceRole = object.userData?.openingSurfaceRole || null;
      if (object.userData?.semanticRole === 'opening-leaf') leaves.push(record);
      if (['openingFrame', 'openingSill'].includes(object.userData?.openingSurfaceRole)) frames.push(record);
      if (object.userData?.openingSurfaceRole === 'replacementPart') replacementParts.push(record);
    });
    const byComponent = (left, right) => String(left.componentId).localeCompare(String(right.componentId));
    openings.push({
      componentId: assembly.userData.componentId,
      kind: assembly.userData.openingKind,
      hostId: assembly.userData.hostId || null,
      apertureM: canonicalManifestValue(assembly.userData.apertureM || null),
      openingEnvelopeLocal: canonicalManifestValue(assembly.userData.openingEnvelopeLocal || null),
      worldBounds: boundsArray(new THREE.Box3().setFromObject(assembly)),
      worldMatrix: matrixArray(assembly.matrixWorld),
      pivots: pivots.sort(byComponent),
      frames: frames.sort(byComponent),
      leaves: leaves.sort(byComponent),
      replacementParts: replacementParts.sort(byComponent),
      ancestorIdentityVisibility: ancestorIdentityVisibility(assembly, model),
    });
  });
  openings.sort((left, right) => left.componentId.localeCompare(right.componentId));

  const stairs = [];
  model.traverse((stairRoot) => {
    if (stairRoot.userData?.semanticRole !== 'daily-use-dogleg-stair') return;
    const steps = [];
    const landings = [];
    const supports = [];
    stairRoot.traverse((object) => {
      if (!object.isMesh) return;
      const record = compactRenderable(object);
      if (object.userData?.type === 'stair-tread') {
        steps.push({ ...record, flight: object.userData.flight, step: object.userData.step });
      }
      if (object.userData?.semanticRole === 'walkable-stair-landing') {
        landings.push({ ...record, landing: object.userData.landing });
      }
      if (['stair-stringer-support', 'stair-support-post'].includes(object.userData?.type)) {
        supports.push({ ...record, flight: object.userData.flight || null });
      }
    });
    const upperExit = [];
    model.traverse((object) => {
      if (!object.isMesh || !['STAIR-WEST-01-UPPER-TURN', 'STAIR-WEST-01-UPPER-CONNECTOR']
        .includes(object.userData?.componentId)) return;
      upperExit.push(compactRenderable(object));
    });
    const componentOrder = (left, right) => String(left.componentId).localeCompare(String(right.componentId));
    const flights = [1, 2].map((flight) => {
      const flightSteps = steps.filter((step) => step.flight === flight)
        .sort((left, right) => left.step - right.step);
      return {
        flight,
        actualStepCount: flightSteps.length,
        exactStepIds: flightSteps.map((step) => step.componentId),
        steps: flightSteps,
      };
    });
    stairs.push({
      componentId: stairRoot.userData.componentId,
      stairType: stairRoot.userData.type,
      flightCount: flights.length,
      flights,
      landingCount: landings.length,
      landings: landings.sort(componentOrder),
      supportCount: supports.length,
      supports: supports.sort(componentOrder),
      upperExit: upperExit.sort(componentOrder),
      routeAnchors: canonicalManifestValue(stairRoot.userData?.routeAnchors || []),
      worldBounds: boundsArray(new THREE.Box3().setFromObject(stairRoot)),
      ancestorIdentityVisibility: ancestorIdentityVisibility(stairRoot, model),
    });
  });
  stairs.sort((left, right) => left.componentId.localeCompare(right.componentId));

  const canonicalRecords = records.map((item) => JSON.stringify(item)).sort();
  const manifest = canonicalManifestValue({
    buildingUnits: { count: buildingUnits.length, units: buildingUnits },
    roofUnits: { count: roofUnits.length, structuralLayerIds: structuralRoofLayerIds, units: roofUnits },
    walls: {
      hostCount: wallHosts.length,
      openingHostCount: wallOpeningHosts.length,
      hosts: wallHosts,
      openingHosts: wallOpeningHosts,
    },
    openings: { count: openings.length, assemblies: openings },
    stairs: { count: stairs.length, assemblies: stairs },
  });
  const recordFingerprint = fnv1a(canonicalRecords);
  const manifestFingerprint = fnv1a([recordFingerprint, JSON.stringify(manifest)]);
  const evidence = {
    contract: 'canonical-live-structural-renderables-plus-explicit-building-roof-wall-opening-stair-manifest-v3-root-display-name-normalized',
    normalizedRootIdentity: {
      name: 'YunnanCourtyard_ComparisonStructure',
      excludedNonStructuralField: 'version-facing root.name display label only',
      descendantNamesAndStructuralIdentityRetained: true,
      materialSurfaceAndVersionProfileExcluded: true,
    },
    renderableInstanceCount: canonicalRecords.length,
    recordFingerprint,
    manifest,
    manifestFingerprint,
  };
  if (includeRecords) evidence.records = canonicalRecords.map((item) => JSON.parse(item));
  return evidence;
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
      JSON.stringify(structuralSemanticContext(object, root)),
    ];
    if (object.isInstancedMesh) {
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, instanceMatrix);
        worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        const worldBounds = object.geometry.boundingBox?.clone().applyMatrix4(worldMatrix);
        tokens.push(JSON.stringify([
          ...common, index,
          JSON.stringify(structuralSemanticContext(object, root, index)),
          ...worldMatrix.elements.map((value) => rounded(value)),
          ...(worldBounds ? [...worldBounds.min.toArray(), ...worldBounds.max.toArray()].map((value) => rounded(value)) : []),
        ]));
      }
      const colors = object.instanceColor?.array;
      if (includeMaterials && colors) tokens.push(`instanceColors:${numericAttributeToken(object.instanceColor, 5)}`);
    } else {
      const worldBounds = new THREE.Box3().setFromObject(object);
      tokens.push(JSON.stringify([
        ...common,
        ...object.matrixWorld.elements.map((value) => rounded(value)),
        ...[...worldBounds.min.toArray(), ...worldBounds.max.toArray()].map((value) => rounded(value)),
      ]));
    }
    if (includeMaterials) {
      const vertexColors = object.geometry.getAttribute?.('color');
      if (vertexColors) tokens.push(`vertexColors:${numericAttributeToken(vertexColors, 5)}`);
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
          yunnanShaderRevision: material.userData?.yunnanShaderRevision || null,
          yunnanProgramCacheKey: material.userData?.yunnanProgramCacheKey || null,
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
    // Cover tiles are lifted along the roof normal.  That clearance has a
    // horizontal projection, so a plan-only axis reports a false course
    // shift.  Measure the live displacement on the actual sloped drainage
    // tangent, matching the production geometry audit.
    courseOffsets.push(Math.abs(delta.dot(downhill)));
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
      const logicalCount = Number(object.userData?.logicalPatchCount)
        || (Array.isArray(object.userData?.logicalPatches) ? object.userData.logicalPatches.length : 0)
        || Number(object.userData?.semanticElementCount)
        || (object.isInstancedMesh ? object.count : 1);
      layerCounts[layerId] = (layerCounts[layerId] || 0) + logicalCount;
      if (!layerObjects.has(layerId)) layerObjects.set(layerId, []);
      layerObjects.get(layerId).push(object);
    });
  }
  const metricPart = (object, logicalPatch = null) => {
    const position = object.geometry?.getAttribute?.('position');
    const index = object.geometry?.index;
    const vertexStart = logicalPatch ? Number(logicalPatch.vertexStart || 0) : 0;
    const vertexCount = logicalPatch
      ? Number(logicalPatch.vertexCount || 0) : Number(position?.count || 0);
    const points = [];
    const bounds = new THREE.Box3();
    for (let offset = 0; offset < vertexCount; offset += 1) {
      const point = new THREE.Vector3()
        .fromBufferAttribute(position, vertexStart + offset).applyMatrix4(object.matrixWorld);
      points.push(point);
      bounds.expandByPoint(point);
    }
    const indexStart = logicalPatch ? Number(logicalPatch.indexStart || 0) : 0;
    const indexCount = logicalPatch
      ? Number(logicalPatch.indexCount || 0) : Number(index?.count || position?.count || 0);
    let area = 0;
    const triangle = new THREE.Triangle();
    for (let offset = 0; offset < indexCount; offset += 3) {
      const ia = index ? index.getX(indexStart + offset) : vertexStart + offset;
      const ib = index ? index.getX(indexStart + offset + 1) : vertexStart + offset + 1;
      const ic = index ? index.getX(indexStart + offset + 2) : vertexStart + offset + 2;
      const a = new THREE.Vector3().fromBufferAttribute(position, ia).applyMatrix4(object.matrixWorld);
      const b = new THREE.Vector3().fromBufferAttribute(position, ib).applyMatrix4(object.matrixWorld);
      const c = new THREE.Vector3().fromBufferAttribute(position, ic).applyMatrix4(object.matrixWorld);
      area += triangle.set(a, b, c).getArea();
    }
    const minY = points.length ? Math.min(...points.map((point) => point.y)) : null;
    const maxY = points.length ? Math.max(...points.map((point) => point.y)) : null;
    const tolerance = minY === null ? 0 : Math.max(1e-5, (maxY - minY) * 0.03);
    const averageAt = (target) => {
      const selected = points.filter((point) => Math.abs(point.y - target) <= tolerance);
      return selected.reduce((sum, point) => sum.add(point), new THREE.Vector3())
        .multiplyScalar(1 / Math.max(1, selected.length));
    };
    const direction = minY === null ? new THREE.Vector3()
      : averageAt(minY).sub(averageAt(maxY));
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const materialColor = Array.isArray(logicalPatch?.materialColor)
      ? new THREE.Color().fromArray(logicalPatch.materialColor) : material?.color || null;
    return {
      object,
      userData: logicalPatch || object.userData || {},
      bounds,
      size: bounds.isEmpty() ? new THREE.Vector3() : bounds.getSize(new THREE.Vector3()),
      area,
      gravityDot: direction.lengthSq()
        ? direction.normalize().dot(new THREE.Vector3(0, -1, 0)) : null,
      materialColor,
      materialOpacity: Number(logicalPatch?.materialOpacity ?? material?.opacity ?? 1),
      source: logicalPatch
        ? 'live-merged-index-and-explicit-logical-vertex-range'
        : 'live-mesh-buffer-geometry',
    };
  };
  const metricParts = (layerId) => (layerObjects.get(layerId) || []).flatMap((object) => {
    const logicalPatches = object.userData?.logicalPatches;
    return object.userData?.batched === true && Array.isArray(logicalPatches)
      ? logicalPatches.map((patch) => metricPart(object, patch))
      : [metricPart(object)];
  });
  const hostFor = (part) => hostBounds.get(part.userData?.hostId) || null;
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
  const dampMetrics = metricParts('risingDamp').map((part) => {
    const host = hostFor(part);
    if (!host) return null;
    const patch = part.bounds;
    const hostHeight = host.max.y - host.min.y || 1;
    return {
      bottomOffsetRatio: (patch.min.y - host.min.y) / hostHeight,
      topRatio: (patch.max.y - host.min.y) / hostHeight,
      heightRatio: (patch.max.y - patch.min.y) / hostHeight,
      level: part.userData?.dampSampleLevel,
      opacity: part.materialOpacity,
      evidenceSource: part.source,
    };
  }).filter(Boolean);
  const rainMetrics = metricParts('verticalRainStreak').map((part) => {
    const { size } = part;
    const host = hostFor(part);
    const hostSize = host?.getSize(new THREE.Vector3());
    const hostArea = hostSize ? Math.max(hostSize.x, hostSize.z) * hostSize.y : 1;
    return {
      verticalAspect: size.y / Math.max(size.x, size.z, 1e-8),
      gravityDot: part.gravityDot,
      load: part.area / Math.max(0.01, hostArea) * part.materialOpacity,
      sheltered: Number(part.userData?.shelterFactor) >= 0.5,
      drainageFlow: Number(part.userData?.drainageFlow),
      evidenceSource: part.source,
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
  const plasterMetrics = metricParts('plaster').map((part) => ({
    sunExposure: Number(part.userData?.sunExposure),
    luminance: part.materialColor
      ? part.materialColor.r * 0.2126 + part.materialColor.g * 0.7152
        + part.materialColor.b * 0.0722 : null,
  })).filter((item) => Number.isFinite(item.sunExposure) && Number.isFinite(item.luminance));
  const extensionFor = (part) => {
    const host = hostFor(part);
    if (!host) return null;
    const patchSize = part.size;
    const hostSize = host.getSize(new THREE.Vector3());
    return Math.max(patchSize.x - hostSize.x, patchSize.z - hostSize.z, 0);
  };
  const plinthExtensions = metricParts('stonePlinth').map(extensionFor).filter(Number.isFinite);
  const cornerExtensions = metricParts('brickCorner').map(extensionFor).filter(Number.isFinite);
  const boundedToHost = (part) => {
    const host = hostFor(part);
    if (!host) return false;
    const patch = part.bounds;
    const expanded = host.clone().expandByScalar(0.08);
    return expanded.containsPoint(patch.getCenter(new THREE.Vector3())) && patch.min.y >= host.min.y - 0.02 && patch.max.y <= host.max.y + 0.02;
  };
  const repairs = metricParts('repairPatch');
  const liveStaticBatches = [];
  system?.traverse((object) => {
    if (!object.isMesh || object.userData?.batched !== true || !object.geometry) return;
    const position = object.geometry.getAttribute?.('position');
    const color = object.geometry.getAttribute?.('color');
    const alpha = object.geometry.getAttribute?.('wallBatchAlpha');
    const bounds = new THREE.Box3().setFromObject(object);
    const sourceLocalBounds = object.userData.sourceLocalBounds;
    const sourceWorldBounds = Array.isArray(sourceLocalBounds) && sourceLocalBounds.length === 6
      ? new THREE.Box3(
        new THREE.Vector3().fromArray(sourceLocalBounds.slice(0, 3)),
        new THREE.Vector3().fromArray(sourceLocalBounds.slice(3, 6)),
      ).applyMatrix4(object.matrixWorld) : null;
    const worldBoundsMaxDeltaM = sourceWorldBounds
      ? Math.max(...cameraBoundsEvidence(sourceWorldBounds).map((value, index) => Math.abs(value - cameraBoundsEvidence(bounds)[index])))
      : null;
    liveStaticBatches.push({
      layerId: object.userData.wallLayerId,
      logicalPatchCount: Number(object.userData.logicalPatchCount || 0),
      declaredTriangleCount: Number(object.userData.triangleCount || 0),
      actualTriangleCount: object.geometry.index ? object.geometry.index.count / 3 : (position?.count || 0) / 3,
      indexed: Boolean(object.geometry.index && object.userData.indexed === true),
      indexCount: object.geometry.index?.count || 0,
      positionCount: position?.count || 0,
      colorCount: color?.count || 0,
      vertexColorChannels: color?.itemSize || 0,
      alphaCount: alpha?.count || 0,
      alphaItemSize: alpha?.itemSize || 0,
      alphaShaderRevision: object.material?.userData?.wallBatchShaderRevision || null,
      alphaCompiledShaderEvidence:
        object.material?.userData?.wallBatchCompiledShaderEvidence || null,
      logicalPatchesPresent: Array.isArray(object.userData.logicalPatches)
        && object.userData.logicalPatches.length === Number(object.userData.logicalPatchCount || 0),
      sourceTriangleCount: object.userData.sourceTriangleCount,
      batchTriangleCount: object.userData.batchTriangleCount,
      sourceVertexCount: object.userData.sourceVertexCount,
      batchPositionCount: object.userData.batchPositionCount,
      batchColorCount: object.userData.batchColorCount,
      batchColorItemSize: object.userData.batchColorItemSize,
      batchAlphaCount: object.userData.batchAlphaCount,
      batchAlphaItemSize: object.userData.batchAlphaItemSize,
      sourceLocalBounds: object.userData.sourceLocalBounds,
      batchLocalBounds: object.userData.batchLocalBounds,
      localBoundsMaxDeltaM: object.userData.localBoundsMaxDeltaM,
      sourceWorldBounds: cameraBoundsEvidence(sourceWorldBounds),
      worldBounds: cameraBoundsEvidence(bounds),
      worldBoundsMaxDeltaM: rounded(worldBoundsMaxDeltaM, 8),
    });
  });
  const specializedBatchEvidence = (layerId, expectedKind) => {
    const objects = layerObjects.get(layerId) || [];
    return objects.map((object) => {
      const position = object.geometry?.getAttribute?.('position');
      const geometryMap = object.userData?.geometryMap || [];
      const instanceMap = object.userData?.instanceMap || [];
      const mappedVertexCount = geometryMap.reduce((sum, item) => sum + Number(item.vertexCount || 0), 0);
      let expectedVertexStart = 0;
      const contiguousGeometryMap = geometryMap.every((item) => {
        const contiguous = Number(item.vertexStart) === expectedVertexStart;
        expectedVertexStart += Number(item.vertexCount || 0);
        return contiguous;
      });
      return {
        layerId,
        expectedKind,
        objectType: object.type,
        instanced: object.isInstancedMesh === true,
        instanceCount: object.isInstancedMesh ? object.count : 0,
        instanceMapCount: instanceMap.length,
        semanticElementCount: Number(object.userData?.semanticElementCount || 0),
        geometryMapCount: geometryMap.length,
        mappedVertexCount,
        contiguousGeometryMap,
        positionCount: position?.count || 0,
        indexed: Boolean(object.geometry?.index),
        triangleCount: object.geometry?.index
          ? object.geometry.index.count / 3 : (position?.count || 0) / 3,
        geometryEvidence: object.userData?.geometryEvidence || null,
        geometryFingerprint: fnv1a([geometryToken(object.geometry)]),
        worldBounds: cameraBoundsEvidence(new THREE.Box3().setFromObject(object)),
      };
    });
  };
  const specializedBatches = {
    crackNetwork: specializedBatchEvidence('crackNetwork', 'single-instanced-shared-geometry-batch'),
    strawFibre: specializedBatchEvidence('strawFibre', 'single-static-exact-vertex-range-batch'),
  };
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
    staticBatching: {
      ...(system?.userData?.staticBatching || {}),
      liveBatchCount: liveStaticBatches.length,
      liveBatches: liveStaticBatches.sort((left, right) => left.layerId.localeCompare(right.layerId)),
    },
    specializedBatches,
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
    if (object.userData?.semanticRole === 'wall-core'
      || object.userData?.collisionRole === 'partition-wall') {
      if (object.isInstancedMesh && object.userData?.collisionRole === 'partition-wall') {
        for (let index = 0; index < object.count; index += 1) wallBoxes.push(instanceWorldBounds(object, [index]));
      } else wallBoxes.push(new THREE.Box3().setFromObject(object));
    }
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
    maximumWorldPositionDeltaM: rounded(runtimeRouteAudit?.maximumWorldPositionDeltaM, 6),
    collisionEvidenceSource: runtimeRouteAudit?.collisionEvidenceSource || null,
    collisionSampleCount: runtimeRouteAudit?.collisionSampleCount ?? null,
    maximumCollisionSampleSpacingM: rounded(runtimeRouteAudit?.maximumCollisionSampleSpacingM, 6),
    requiredMaximumCollisionSampleSpacingM: rounded(runtimeRouteAudit?.requiredMaximumCollisionSampleSpacingM, 6),
    auditObjectCounts: { ...(runtimeRouteAudit?.auditObjectCounts || {}) },
    endpointWallIntersectionCount: runtimeRouteAudit?.endpointWallIntersectionCount ?? null,
    endpointOpeningCollisionCount: runtimeRouteAudit?.endpointOpeningCollisionCount ?? null,
    endpointRailCollisionCount: runtimeRouteAudit?.endpointRailCollisionCount ?? null,
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

function sceneLightEvidence(scene, renderer) {
  const lights = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isLight) return;
    object.updateMatrixWorld(true);
    const target = object.target?.isObject3D ? object.target : null;
    target?.updateMatrixWorld?.(true);
    lights.push({
      type: object.type,
      name: object.name || null,
      color: object.color?.getHexString?.() || null,
      groundColor: object.groundColor?.getHexString?.() || null,
      intensity: rounded(object.intensity, 7),
      castShadow: object.castShadow === true,
      worldPosition: object.getWorldPosition(new THREE.Vector3()).toArray()
        .map((value) => rounded(value, 7)),
      worldQuaternion: object.getWorldQuaternion(new THREE.Quaternion()).toArray()
        .map((value) => rounded(value, 7)),
      matrixWorld: object.matrixWorld.elements.map((value) => rounded(value, 7)),
      target: target ? {
        worldPosition: target.getWorldPosition(new THREE.Vector3()).toArray()
          .map((value) => rounded(value, 7)),
        worldQuaternion: target.getWorldQuaternion(new THREE.Quaternion()).toArray()
          .map((value) => rounded(value, 7)),
        matrixWorld: target.matrixWorld.elements.map((value) => rounded(value, 7)),
      } : null,
    });
  });
  lights.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const evidence = {
    contract: 'live-light-and-render-output-transform-v2',
    lights,
    background: scene.background?.isColor ? scene.background.getHexString() : null,
    renderer: {
      toneMapping: renderer.toneMapping,
      toneMappingExposure: rounded(renderer.toneMappingExposure, 7),
      outputColorSpace: renderer.outputColorSpace || null,
      shadowEnabled: renderer.shadowMap.enabled === true,
      shadowType: renderer.shadowMap.type,
    },
  };
  return { ...evidence, fingerprint: fnv1a([JSON.stringify(evidence)]) };
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

function actualStructureManifest(viewName = 'production', includeRecords = true) {
  const view = viewName === 'baseline' ? baselineView : productionView;
  return actualStructureManifestEvidence(view.model(), includeRecords === true);
}

function surfaceFingerprintForView(view) {
  const model = view.model();
  return fnv1a(renderableTokens(model, (object) => {
    const rootLayer = ancestorValue(object, 'layer', model);
    return rootLayer === 'doors-windows'
      || rootLayer === 'walls'
      || (!view.baseline && hasNamedAncestor(object, 'V550_wall_surface_system'))
      || ['panTileCourses', 'coverTileCourses', 'eaveCapsAndDrips', 'ridgeAndClosures']
        .includes(ancestorValue(object, 'roofLayerId', model));
  }));
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
  view.camera.updateProjectionMatrix();
  view.camera.updateMatrixWorld(true);
  const camera = {
    position: view.camera.position.toArray().map((value) => rounded(value, 5)),
    target: view.controls.target.toArray().map((value) => rounded(value, 5)),
    quaternion: view.camera.quaternion.toArray().map((value) => rounded(value, 7)),
    up: view.camera.up.toArray().map((value) => rounded(value, 7)),
    zoom: rounded(view.camera.zoom, 7),
    aspect: rounded(view.camera.aspect, 7),
    near: rounded(view.camera.near, 7),
    far: rounded(view.camera.far, 7),
    fov: rounded(view.camera.fov, 5),
    projectionType: view.camera.type,
    projectionMatrix: view.camera.projectionMatrix.elements.map((value) => rounded(value, 7)),
    matrixWorld: view.camera.matrixWorld.elements.map((value) => rounded(value, 7)),
    matrixWorldInverse: view.camera.matrixWorldInverse.elements.map((value) => rounded(value, 7)),
  };
  const cameraFingerprint = fnv1a([JSON.stringify(camera)]);
  const lightEvidence = sceneLightEvidence(view.scene, view.renderer);
  const drawingBuffer = view.renderer.getDrawingBufferSize(new THREE.Vector2());
  const canvasFingerprint = JSON.stringify({
    cssWidth: view.element.clientWidth,
    cssHeight: view.element.clientHeight,
    drawingBufferWidth: drawingBuffer.x,
    drawingBufferHeight: drawingBuffer.y,
    pixelRatio: view.renderer.getPixelRatio(),
  });
  const structuralRenderableFingerprint = fnv1a(renderableTokens(model, (object) => {
    if (hasNamedAncestor(object, 'V550_wall_surface_system')) return false;
    const rootLayer = ancestorValue(object, 'layer', model);
    const roofLayer = ancestorValue(object, 'roofLayerId', model);
    if (['stone-and-ground', 'walls', 'timber-frame', 'doors-windows'].includes(rootLayer)) return true;
    return rootLayer === 'roof-production' && ['purlins', 'rafters', 'roofUnderlay'].includes(roofLayer);
  }, false));
  const structureManifest = actualStructureManifestEvidence(model, false);
  const structuralFingerprint = fnv1a([
    structuralRenderableFingerprint,
    structureManifest.manifestFingerprint,
  ]);
  const surfaceFingerprint = surfaceFingerprintForView(view);
  const fullGeometryFingerprint = fnv1a(renderableTokens(model, () => true, false));
  const displayedRuntimeFingerprint = fnv1a(renderableTokens(model, () => true, true));
  const comparisonInputFingerprint = fnv1a([
    JSON.stringify(SHARED_COMPARISON_OPTIONS),
    cameraFingerprint,
    canvasFingerprint,
    lightEvidence.fingerprint,
  ]);
  const rootLayers = Object.fromEntries(model.children.filter((child) => child.userData?.layer).map((child) => [child.userData.layer, child]));
  const completeBuilding = ROOT_LAYER_IDS.every((id) => rootLayers[id] && countRenderable(rootLayers[id]) > 0)
    && roofSystem.complete && walls.hostCount > 0 && stair?.totalRisers === 16;
  const cutaway = ROOT_LAYER_IDS.some((id) => rootLayers[id] && !rootLayers[id].visible);
  const sceneStats = deriveSceneStats(model);
  const materialShaderPrograms = deriveMaterialShaderPrograms(model);
  return {
    version: view.baseline ? '5.4.4' : '5.5.0',
    view: viewName,
    profileId: view.profile().id,
    evidenceContract: 'live-geometry-v2-position-index',
    fingerprintContract: {
      structure: 'full-position-index-world-transform-and-world-bounds-plus-explicit-building-roof-wall-opening-stair-manifest; excludes material, color, normal and uv',
      surface: 'surface-geometry-transform-plus-material-channels-and-full-vertex-or-instance-color-digest; includes wall-core, wall-overlay, roof-finish, door-leaf, window-leaf, frame, sill and replacement-part',
    },
    completeBuilding,
    cutaway,
    structuralFingerprint,
    structuralRenderableFingerprint,
    actualStructureManifestFingerprint: structureManifest.manifestFingerprint,
    actualStructureManifestEvidence: structureManifest,
    surfaceFingerprint,
    fullGeometryFingerprint,
    displayedRuntimeFingerprint,
    comparisonInputFingerprint,
    camera,
    cameraFingerprint,
    cameraFingerprintContract: 'actual-position-target-quaternion-up-zoom-aspect-near-far-fov-projection-matrixWorld-matrixWorldInverse-v2',
    cameraPresetId: activeCameraId,
    cameraEvidence: activeCameraEvidence ? { ...activeCameraEvidence } : null,
    qaDisplayState: { ...qaDisplaySummary },
    canvasFingerprint,
    lightFingerprint: lightEvidence.fingerprint,
    lightFingerprintContract: lightEvidence.contract,
    lightEvidence,
    comparisonContract: { ...(model.userData.comparisonContract || {}) },
    materialRuntimeContract: { ...(model.userData.materialRuntimeContract || {}) },
    renderQuality: {
      ...(model.userData.renderQuality || {}),
      viewportRule: RESPONSIVE_RENDER_QUALITY.viewportRule,
    },
    materialShaderPrograms,
    runtimeOptimization: { ...(model.userData.runtimeOptimization || {}) },
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
      sceneMatrixWorldAutoUpdate: view.scene.matrixWorldAutoUpdate,
      matrixUpdateContract: 'static-world-matrices-cached; explicit-opening-visitor-and-roof-actions-refresh-live-transforms',
      pixelRatio: view.renderer.getPixelRatio(),
      cssWidth: view.element.clientWidth,
      cssHeight: view.element.clientHeight,
      drawingBufferWidth: drawingBuffer.x,
      drawingBufferHeight: drawingBuffer.y,
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

setCamera('overview');
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
  actualStructureManifest,
  setPreset,
  setCamera,
  setRoofExploded,
  setQALighting,
  setQACapturePixelRatio,
  setQAFeatureCallouts,
  measureQAFeaturePixels,
  setQARoofIsolation,
  setQARoofLayerIsolation,
  setQAAbutmentIsolation,
  setMode: applyMode,
  setOpeningsProgress: setOpenings,
  setVisitorProgress: setVisitor,
  playVisitorRoute,
  visitorPlayback,
  measureProductionFps,
  waitForNextProductionRender,
  setQARouteEvidence,
  setQADisplayState,
  restoreQADisplayState,
  performanceEvidence,
  reset,
};
