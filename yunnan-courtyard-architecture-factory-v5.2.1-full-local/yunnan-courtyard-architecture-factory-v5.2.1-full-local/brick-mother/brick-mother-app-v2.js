(() => {
'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const { clamp, vec3, buildMesh, normalizeControls } = window.BrickMotherGeometryV2;
const { BrickRenderer } = window.BrickMotherRendererV2;

const CONTROL_KEYS = ['colorRichness', 'damage', 'poreDepth', 'poreDensity', 'poreVariety', 'waterStain', 'weathering', 'inclusion', 'shapeVariation', 'rockDetail', 'strata', 'microErosion', 'colorClarity', 'colorGamut', 'maskSharpness'];
const SEED_KEYS = ['master', 'shape', 'damage', 'pore', 'color', 'water', 'weather', 'inclusion', 'detail'];
const QUERY = new URLSearchParams(window.location.search);
const MOBILE_QUERY = QUERY.get('mobile');
const MOBILE_RUNTIME = MOBILE_QUERY === '1' || (MOBILE_QUERY !== '0' && (
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  ((window.matchMedia?.('(pointer: coarse)')?.matches ?? false) &&
    Math.min(window.innerWidth || 9999, window.innerHeight || 9999) < 920)
));
const REBUILD_CONTROL_KEYS = ['damage', 'poreDepth', 'poreDensity', 'poreVariety', 'weathering', 'inclusion', 'shapeVariation', 'rockDetail', 'strata', 'microErosion'];
const CHILD_OFFSETS = [0, 1181, 2647];
const SEED_PRIMES = {
  master: 1,
  shape: 3,
  damage: 5,
  pore: 7,
  color: 11,
  water: 13,
  weather: 17,
  inclusion: 19,
  detail: 23
};

const state = {
  data: null,
  profiles: new Map(),
  renderer: null,
  batchMode: 'mixed',
  selectedProfile: 'old-pbr-fired',
  batchCycle: 0,
  currentItems: [],
  building: false,
  debugMode: 0,
  controls: normalizeControls(),
  seedBank: {},
  rebuildTimer: 0,
  evidenceMode: QUERY.get('evidence') === '1',
  evidenceQuality: (() => {
    const requested = Number(QUERY.get('evidenceQuality'));
    return Number.isFinite(requested) && requested > 0 ? clamp(requested, 0.40, 1.04) : 0.78;
  })(),
  mobileMode: MOBILE_RUNTIME,
  fullFamilyRequested: QUERY.get('full') === '1',
  mobileQuickProfile: QUERY.get('profile') || 'old-pbr-fired',
  evidenceFocus: Math.max(0, Math.min(2, Math.round(Number(QUERY.get('focus') ?? 1) || 1))),
  soloMode: QUERY.get('solo') === '1' || (MOBILE_RUNTIME && QUERY.get('full') !== '1'),
  benchmarkMode: QUERY.get('specimen') !== 'historical'
};

function showFatal(error) {
  const node = $('#fatal');
  if (node) {
    node.hidden = false;
    node.textContent = `页面初始化失败：${error?.message || error}`;
  }
  if (state.mobileMode) {
    document.body.classList.add('runtime-failed');
    $('#loadingMask')?.classList.remove('on');
    const copy = $('#mobileBootstrapCopy');
    if (copy) copy.innerHTML = '<b>当前预览器没有完成三维初始化</b><span>页面已保留可见预览。用 Safari 打开同一 HTML 可继续进入手机快速三维模式。</span>';
  }
}

window.addEventListener('error', (event) => {
  if (!window.__BRICK_MOTHER_READY__) showFatal(event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  if (!window.__BRICK_MOTHER_READY__) showFatal(event.reason || '未处理的异步错误');
});

function profileSourceEmbed(profile) {
  const match = profile.source.sourceUrl.match(/-([a-f0-9]{32})$/i);
  return match
    ? `https://sketchfab.com/models/${match[1]}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_watermark=0&ui_hint=0`
    : profile.source.sourceUrl;
}

function formatColor(values) {
  return values.map((v) => Math.round(v * 255)).join(' / ');
}

function familyLabel(profile) {
  if (profile.family === 'FIRED_CLAY') return '烧结黏土';
  if (profile.family === 'ADOBE') return '原始黏土 / 土坯';
  return '石材';
}

function triangleLabel(n) {
  return Math.round(n).toLocaleString('zh-CN');
}

function updateProfilePanel(profile) {
  const n = profile.noiseDNA || {};
  const c = profile.compositeDefaults || {};
  $('#profileName').textContent = profile.label;
  $('#profileFamily').textContent = familyLabel(profile);
  $('#profileSource').textContent = profile.source.filename;
  $('#profileTriangles').textContent = triangleLabel(profile.measured.triangleCount);
  const dimensionSuffix = profile.measured.dimensionUnitStatus === 'source-units-pending-calibration'
    ? ' 源文件单位（实物尺度待校准）'
    : ' mm';
  $('#profileDimensions').textContent =
    profile.measured.dimensionsMm.map((v) => Math.round(v * 10) / 10).join(' × ') + dimensionSuffix;
  $('#profileColor').textContent = formatColor(profile.measured.baseColorMeanSRGB);
  const rough = profile.measured.roughnessMean ?? profile.measured.rawRoughnessMean;
  $('#profileRoughness').textContent =
    Number(rough).toFixed(3) + (profile.measured.rawMetalnessMean ? '（原始导出已规范化）' : '');
  $('#profileNormal').textContent =
    `${profile.measured.normalTiltDegrees.mean.toFixed(1)}° / ${profile.measured.normalTiltDegrees.p95.toFixed(1)}°`;
  $('#profileLink').href = profile.source.sourceUrl;
  $('#referenceSourceLink').href = profile.source.sourceUrl;
  $('#referenceFrame').dataset.src = profileSourceEmbed(profile);
  $('#sourceLicense').textContent = `${profile.source.author} · ${profile.source.license}`;

  $('#dnaGeometry').textContent =
    `比例 ${profile.runtimeDNA.shapeRatio.map((v) => v.toFixed(2)).join(':')} · 边缘 ${profile.runtimeDNA.edgeRadius.toFixed(3)} · 深孔基数 ${n.geometryDeepPoreCount ?? 0}`;
  $('#dnaMaterial').textContent =
    `色彩浓度 ${Number(c.colorRichness ?? 1).toFixed(2)} · 水痕 ${Number(c.waterStain ?? 0).toFixed(2)} · 风化 ${Number(c.weathering ?? 0).toFixed(2)}`;
  $('#dnaDamage').textContent =
    `破碎 ${Number(c.damage ?? 0).toFixed(2)} · 深孔 ${Number(c.poreDepth ?? 0).toFixed(2)} · 边缘脆性 ${profile.runtimeDNA.edgeFragility.toFixed(2)}`;
  $('#noiseSummary').textContent =
    `八类独立种子进入 Gaea 蒸馏图谱，并由 Rugged、Stratify、MicroErosion、RockMap、CLUT 与 Splat 复合`;
  $('#inclusionSummary').textContent = profile.family === 'ADOBE'
    ? '长稻草、短切稻草、稻壳、种粒与脱落孔五层造纹已启用'
    : '夹杂层保留在 DNA 中，当前材质家族以矿物、氧化和孔隙为主';
}

function seedBankForProfile(profile, cycle = state.batchCycle, explicitMaster = null) {
  const base = Number.isFinite(Number(explicitMaster))
    ? Math.max(1, Math.round(Number(explicitMaster)))
    : profile.runtimeDNA.seedBase + cycle * 911;
  const offsets = profile.seedLayerOffsets || {};
  const result = { master: base };
  for (const key of SEED_KEYS.slice(1)) result[key] = base + (offsets[key] || SEED_PRIMES[key] * 101);
  return result;
}

function controlDefaultsForProfile(profile) {
  return normalizeControls(profile.compositeDefaults || {});
}

function globalControlDelta(profile) {
  const defaults = controlDefaultsForProfile(profile);
  const delta = {};
  for (const key of CONTROL_KEYS) {
    const value = Number(state.controls[key]);
    const baseline = Number(defaults[key]);
    delta[key] = Number.isFinite(value) && Number.isFinite(baseline) ? value - baseline : 0;
  }
  return delta;
}

function syncControlUI() {
  for (const key of CONTROL_KEYS) {
    const input = $(`[data-control="${key}"]`);
    const output = $(`[data-control-output="${key}"]`);
    if (!input) continue;
    input.value = state.controls[key];
    if (output) output.textContent = Number(state.controls[key]).toFixed(2);
  }
}

function syncSeedUI() {
  for (const key of SEED_KEYS) {
    const input = $(`[data-seed="${key}"]`);
    if (input) input.value = state.seedBank[key] ?? 1;
  }
}

function loadProfileDNA(profile, { preserveControls = false, preserveSeeds = false } = {}) {
  if (!preserveControls) state.controls = controlDefaultsForProfile(profile);
  if (!preserveSeeds) state.seedBank = seedBankForProfile(profile);
  syncControlUI();
  syncSeedUI();
}

function seedDNAFor(profile, childIndex) {
  const childOffset = CHILD_OFFSETS[childIndex] || 0;
  const profileBias = profile.runtimeDNA.seedBase % 997;
  const result = {};
  for (const key of SEED_KEYS) {
    const base = Number(state.seedBank[key] ?? profile.runtimeDNA.seedBase);
    result[key] = Math.max(1, Math.round(base + profileBias + childOffset * SEED_PRIMES[key]));
  }
  return result;
}

function controlsForChild(profile, childIndex, mode) {
  const base = mode === 'mixed'
    ? normalizeControls(Object.fromEntries(
      Object.entries(controlDefaultsForProfile(profile)).map(([key, value]) => [key, value + (globalControlDelta(state.profiles.get(state.selectedProfile))[key] || 0)])
    ))
    : normalizeControls(state.controls);
  const shifts = [
    { damage: -0.10, poreDepth: -0.08, poreDensity: -0.08, poreVariety: -0.05, waterStain: -0.06, weathering: -0.05, colorRichness: -0.04 },
    { damage: 0.02, poreDepth: 0.06, poreDensity: 0.10, poreVariety: 0.12, waterStain: 0.12, weathering: 0.13, colorRichness: 0.05 },
    { damage: 0.16, poreDepth: 0.25, poreDensity: 0.18, poreVariety: 0.22, waterStain: 0.02, weathering: 0.08, colorRichness: 0.10 }
  ][childIndex];
  const result = { ...base };
  for (const [key, delta] of Object.entries(shifts)) result[key] = Number(base[key]) + delta;
  result.benchmarkSlab = state.benchmarkMode ? 1 : 0;
  result.mobilePreview = state.mobileMode && !state.fullFamilyRequested ? 1 : 0;
  return normalizeControls(result);
}

function createBatchDefinitions() {
  if (state.batchMode === 'mixed') {
    const ids = ['old-pbr-fired', 'stone-block', 'raw-clay'];
    const levels = [0.42, 0.48, 0.46];
    const labels = ['烧结砖视觉真值子代', '定向地质石材子代', '纤维土坯视觉真值子代'];
    return ids.map((id, i) => {
      const profile = state.profiles.get(id);
      return {
        profile,
        seedDNA: seedDNAFor(profile, i),
        controls: controlsForChild(profile, i, 'mixed'),
        level: levels[i],
        label: labels[i],
        note: ['烧结壳层、片状剥离、矿物析出与破口复合', '剪切带、层理、下切悬沿与矿物脉复合', '压实土片、纤维束、拔出沟槽与塌落区复合'][i]
      };
    });
  }

  const profile = state.profiles.get(state.selectedProfile);
  const levels = [0.18, 0.38, 0.58];
  return levels.map((level, i) => ({
    profile,
    seedDNA: seedDNAFor(profile, i),
    controls: controlsForChild(profile, i, 'siblings'),
    level,
    label: ['平衡复合子代', '水痕风化子代', '深孔破碎子代'][i],
    note: [
      '多色簇、微孔与颗粒保持平衡',
      '增强重力水痕、边缘漂白和沉积',
      '增加深孔、裂缝、崩角与断面事件'
    ][i]
  }));
}

function setProgress(text, percent = null) {
  $('#buildStatus').textContent = text;
  $('#progressBar').style.width = percent == null ? '0%' : `${clamp(percent, 0, 100)}%`;
  $('#loadingMask').classList.toggle('on', state.building);
}


function mobileQuickActive() {
  return state.mobileMode && !state.fullFamilyRequested;
}

function syncMobileRuntimeUI() {
  if (!state.mobileMode) return;
  const button = $('#mobileFullFamily');
  if (button) {
    button.textContent = state.fullFamilyRequested ? '返回手机快速单块' : '加载完整三材质';
    button.classList.toggle('on', state.fullFamilyRequested);
  }
  const copy = $('#mobileBootstrapCopy');
  if (copy && !document.body.classList.contains('runtime-failed')) {
    copy.innerHTML = mobileQuickActive()
      ? '<b>手机快速预览</b><span>先生成一块低负载基准方砖，完成后可再加载完整三材质。</span>'
      : '<b>手机完整三材质</b><span>正在依次生成烧结砖、石材和土砖，耗时会高于快速单块。</span>';
  }
}

function installMobileRuntimeUI() {
  if (!state.mobileMode) return;
  document.body.classList.add('mobile-runtime');
  document.documentElement.dataset.mobileRuntime = 'true';
  const viewer = $('.viewer');
  if (viewer && !$('#mobileBootstrapPreview')) {
    const preview = document.createElement('div');
    preview.id = 'mobileBootstrapPreview';
    preview.className = 'mobile-bootstrap-preview';
    preview.innerHTML = `
      <div class="mobile-bootstrap-brick" aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
      <div class="mobile-bootstrap-copy" id="mobileBootstrapCopy"></div>
    `;
    viewer.prepend(preview);
  }
  const toolbar = $('.toolbar');
  if (toolbar && !$('#mobileFullFamily')) {
    const button = document.createElement('button');
    button.className = 'tool-button mobile-family-button';
    button.id = 'mobileFullFamily';
    button.addEventListener('click', () => {
      state.fullFamilyRequested = !state.fullFamilyRequested;
      if (state.fullFamilyRequested) {
        state.batchMode = 'mixed';
        state.soloMode = false;
      } else {
        state.selectedProfile = state.profiles.has(state.mobileQuickProfile)
? state.mobileQuickProfile
: 'old-pbr-fired';
        state.batchMode = 'siblings';
        state.soloMode = true;
        state.evidenceFocus = 1;
        const profile = state.profiles.get(state.selectedProfile);
        updateProfilePanel(profile);
        loadProfileDNA(profile);
      }
      $$('.mode-button').forEach((item) => item.classList.toggle('on', item.dataset.mode === state.batchMode));
      $$('.profile-button').forEach((item) => item.classList.toggle('on', item.dataset.profile === state.selectedProfile && state.batchMode === 'siblings'));
      $('#soloView').classList.toggle('on', state.soloMode);
      $('#soloView').textContent = state.soloMode ? '返回家族' : '单块近景';
      syncMobileRuntimeUI();
      buildCurrentBatch();
    });
    toolbar.prepend(button);
  }
  syncMobileRuntimeUI();
}

function scheduleBuild(delay = 220) {
  clearTimeout(state.rebuildTimer);
  state.rebuildTimer = setTimeout(() => buildCurrentBatch(), delay);
}

async function buildCurrentBatch() {
  if (state.building) {
    scheduleBuild(360);
    return;
  }
  state.building = true;
  window.__BRICK_MOTHER_READY__ = false;
  const start = performance.now();
  setProgress(
    mobileQuickActive()
      ? '手机快速模式：先生成一块低负载基准方砖…'
      : '正在复合八类种子、Gaea 场图、深孔几何和多层材料事件场…',
    4
  );
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const definitions = createBatchDefinitions();
  const buildDefinitions = state.soloMode
    ? [definitions[state.evidenceFocus] || definitions[0]]
    : definitions;
  const built = [];

  try {
    for (let i = 0; i < buildDefinitions.length; i++) {
      const definition = buildDefinitions[i];
      setProgress(`正在生成 ${definition.label} ${i + 1}/${buildDefinitions.length}`, 12 + i * (76 / buildDefinitions.length));
      await new Promise((resolve) => setTimeout(resolve, 18));
      const quality = state.mobileMode
        ? (state.fullFamilyRequested ? 0.56 : 0.30)
        : (state.evidenceMode ? state.evidenceQuality : (state.soloMode ? 1.00 : (state.benchmarkMode ? 0.72 : 1.04)));
      const mesh = buildMesh(definition.profile, definition.seedDNA, definition.controls, definition.level, quality);
      if (!mesh.vertices || mesh.triangles < 1000) {
        throw new Error(`${definition.label} 网格过小，生成已停止`);
      }
      built.push({ ...definition, mesh });
    }

    const positions = state.soloMode ? [0] : (state.benchmarkMode ? [-3.46, 0, 3.46] : [-4.4, 0, 4.4]);
    const yaws = state.soloMode ? [0.04] : (state.benchmarkMode ? [0.02, 0.02, 0.02] : [-0.24, 0.05, 0.28]);
    state.currentItems = built.map((item, i) => ({
      ...item,
      position: vec3(positions[i], state.benchmarkMode ? 0 : item.mesh.dims.y * 0.5 + 0.02, 0),
      yaw: yaws[i]
    }));

    state.renderer.setMeshes(state.currentItems);
    state.renderer.setDebugMode(state.debugMode);
    state.renderer.resetView();
    renderChildCards();
    if (state.soloMode) state.renderer.focus(0);
    else if (state.evidenceMode) state.renderer.focus(state.evidenceFocus);

    const totalTriangles = built.reduce((sum, item) => sum + item.mesh.triangles, 0);
    const totalDeepPores = built.reduce((sum, item) => sum + item.mesh.damage.deepPores.length, 0);
    const totalInclusionVoids = built.reduce((sum, item) => sum + (item.mesh.damage.inclusionVoids?.length || 0), 0);
    const totalRimChips = built.reduce((sum, item) => sum + (item.mesh.damage.poreRimChips?.length || 0), 0);
    const totalCollapsedPores = built.reduce((sum, item) => sum + (item.mesh.damage.collapsedPores?.length || 0), 0);
    const formationEvents = built.flatMap((item) => item.mesh.damage.formationEvents || []);
    const formationCounts = formationEvents.reduce((acc, event) => { acc[event.type] = (acc[event.type] || 0) + 1; return acc; }, {});
    const formationQA = built.map((item) => item.mesh.formationEventQA || {
      declaredEventCount: 0,
      shaderHitCount: 0,
      sdfGridHitCount: 0,
      finalTopologyHitCount: 0,
      declaredEventCountByType: {},
      shaderHitCountByType: {},
      sdfGridHitCountByType: {},
      finalTopologyHitCountByType: {},
      geometryAppliedByType: {}
    });
    const formationTotals = formationQA.reduce((acc, qa) => {
      acc.declaredEventCount += qa.declaredEventCount || 0;
      acc.shaderHitCount += qa.shaderHitCount || 0;
      acc.sdfGridHitCount += qa.sdfGridHitCount || 0;
      acc.finalTopologyHitCount += qa.finalTopologyHitCount || 0;
      return acc;
    }, { declaredEventCount: 0, shaderHitCount: 0, sdfGridHitCount: 0, finalTopologyHitCount: 0 });
    const elapsed = Math.round(performance.now() - start);
    $('#batchStats').textContent =
      `${triangleLabel(totalTriangles)} 三角面 · ${totalDeepPores} 深孔 · ${totalRimChips} 孔沿碎裂 · ${totalCollapsedPores} 塌口 · ${elapsed} ms`;
    setProgress(
      mobileQuickActive()
        ? '手机快速预览完成。现在可以旋转、缩放，或加载完整三材质。'
        : 'V2.7.5 视觉真值结构生成完成。可检查三类材料与复合事件。',
      100
    );

    window.__BRICK_MOTHER_READY__ = true;
    document.documentElement.dataset.brickMotherReady = 'true';
    document.documentElement.dataset.brickMotherVersion = '2.7.5-alpha.1';
    document.documentElement.dataset.seedLayers = '8';
    document.documentElement.dataset.deepPores = String(totalDeepPores);
    document.documentElement.dataset.inclusionVoids = String(totalInclusionVoids);
    document.documentElement.dataset.poreRimChips = String(totalRimChips);
    document.documentElement.dataset.collapsedPores = String(totalCollapsedPores);
    document.documentElement.dataset.soloMode = state.soloMode ? 'true' : 'false';
    document.documentElement.dataset.gaeaKernel = window.BrickMotherGaeaV1?.version || 'missing';
    document.documentElement.dataset.debugModes = '11';
    document.documentElement.dataset.activeProfile = state.selectedProfile;
    document.documentElement.dataset.oxideContours = 'suppressed';
    document.documentElement.dataset.eventColorMasking = 'true';
    document.documentElement.dataset.evidenceReady = state.evidenceMode ? 'true' : 'false';
    document.documentElement.dataset.benchmarkSpecimen = state.benchmarkMode ? 'true' : 'false';
    document.documentElement.dataset.mobileRuntime = state.mobileMode ? 'true' : 'false';
    document.documentElement.dataset.mobileQuick = mobileQuickActive() ? 'true' : 'false';
    document.documentElement.dataset.mobileGridProfile = mobileQuickActive() ? 'quick' : (state.mobileMode ? 'family' : 'desktop');
    document.documentElement.dataset.formationEvents = String(formationEvents.length);
    document.documentElement.dataset.macroEvents = String(formationEvents.filter((event) => ['macroPlateLoss', 'shearBand', 'beddingLayer', 'edgeSpall'].includes(event.type)).length);
    document.documentElement.dataset.mesoEvents = String(formationEvents.filter((event) => !['macroPlateLoss', 'shearBand', 'beddingLayer', 'edgeSpall'].includes(event.type)).length);
    document.documentElement.dataset.declaredFormationEvents = String(formationTotals.declaredEventCount);
    document.documentElement.dataset.shaderFormationHits = String(formationTotals.shaderHitCount);
    document.documentElement.dataset.sdfGridFormationHits = String(formationTotals.sdfGridHitCount);
    document.documentElement.dataset.finalTopologyFormationHits = String(formationTotals.finalTopologyHitCount);
    document.documentElement.dataset.formationHitCount = String(formationTotals.finalTopologyHitCount);
    document.documentElement.dataset.fiberBundles = String(formationEvents.filter((event) => event.type === 'fiberBundle').length);
    window.__BRICK_MOTHER_QA__ = {
      ready: true,
      version: '2.7.5-alpha.1',
      mode: state.batchMode,
      profiles: built.map((item) => item.profile.id),
      triangleCounts: built.map((item) => Math.round(item.mesh.triangles)),
      vertices: built.map((item) => item.mesh.vertices),
      grids: built.map((item) => item.mesh.grid),
      seedDNA: built.map((item) => item.mesh.seedDNA),
      seedDerivation: built.map((item) => ({
        master: item.mesh.seedDNA.master,
        layers: Object.fromEntries(SEED_KEYS.slice(1).map((key) => [key, item.mesh.seedDNA[key]])),
        rule: 'layer = master + profile.seedLayerOffsets[layer] + childOffset * prime[layer] + profileBias'
      })),
      controls: built.map((item) => item.mesh.controls),
      controlsByFamily: built.reduce((acc, item) => {
        (acc[item.profile.family] ||= []).push(item.mesh.controls);
        return acc;
      }, {}),
      seedDNAByFamily: built.reduce((acc, item) => {
        (acc[item.profile.family] ||= []).push(item.mesh.seedDNA);
        return acc;
      }, {}),
      globalControlDelta: globalControlDelta(state.profiles.get(state.selectedProfile)),
      controlIsolation: {
        mixedUsesProfileCompositeDefaults: state.batchMode === 'mixed',
        soloUsesSelectedProfileControls: state.batchMode !== 'mixed',
        sameFamilyMixedSoloComparable: true
      },
      generationMs: elapsed,
      noExternalGeometryAssets: true,
      independentSeedLayers: ['shape', 'damage', 'pore', 'color', 'water', 'weather', 'inclusion', 'detail'],
      negativeDamageGeometry: true,
      deepPoreCounts: built.map((item) => item.mesh.damage.deepPores.length),
      poreRimChipCounts: built.map((item) => item.mesh.damage.poreRimChips?.length || 0),
      collapsedPoreCounts: built.map((item) => item.mesh.damage.collapsedPores?.length || 0),
      benchmarkSpecimen: state.benchmarkMode,
      mobileRuntime: state.mobileMode,
      mobileQuickPreview: mobileQuickActive(),
      progressiveFamilyLoad: state.mobileMode,
      evidenceQuality: state.evidenceQuality,
      formationEventCounts: formationCounts,
      formationEventFamilies: Object.keys(formationCounts),
      formationEventQA: formationQA,
      formationEventTotals: formationTotals,
      soloMode: state.soloMode,
      erosionBiteCounts: built.map((item) => item.mesh.damage.erosionBites.length),
      inclusionVoidCounts: built.map((item) => item.mesh.damage.inclusionVoids?.length || 0),
      adobeInclusionFamilies: ['long-straw', 'chopped-straw', 'rice-husk', 'seed-grain', 'missing-inclusion-pit', 'physical-fiber-pullout-channel'],
      correlatedChannels: ['base-color', 'aggregate-color', 'water-stain', 'weathering', 'cavity', 'roughness', 'micro-normal', 'organic-inclusion', 'rugged', 'strata', 'micro-erosion', 'rock-map', 'separation-mask'],
      gaeaKernel: window.BrickMotherGaeaV1?.version || 'missing',
      gaeaOperatorFamilies: Object.keys(window.BrickMotherGaeaV1?.operatorFamilies || {}),
      gaeaGraphRecipes: Object.keys(window.BrickMotherGaeaV1?.graphRecipes || {}),
      gaeaDistilledIndependentImplementation: true,
      visualCalibration: {
        eventColorMasking: true,
        oxideContourSuppression: true,
        connectedColorNetworksSuppressed: true,
        naturalStonePalette: true,
        familySpecificSaturation: true,
        firedClayChromaticZones: true,
        stoneReadableMidtones: true,
        reducedMicroNoise: true,
        adobeInclusionClustering: true,
        visualTruthReferenceFrozen: true,
        formationHierarchy: ['macro', 'meso', 'micro'],
        directionalStoneGeology: true,
        benchmarkSlab: state.benchmarkMode,
        profileEvidenceRoute: state.evidenceMode,
        activeProfile: state.selectedProfile,
        focusedChild: state.evidenceFocus
      },
      debugModes: 11,
      sourceComparisonNoDimming: true
    };
  } catch (error) {
    console.error(error);
    setProgress(`生成失败：${error.message || error}`, 0);
    $('#loadingError').textContent = error.stack || String(error);
    showFatal(error);
  } finally {
    state.building = false;
    setTimeout(() => $('#loadingMask').classList.remove('on'), 420);
  }
}

function renderChildCards() {
  const host = $('#childCards');
  host.innerHTML = '';
  state.currentItems.forEach((item, i) => {
    const card = document.createElement('button');
    card.className = 'child-card';
    card.dataset.index = i;
    card.innerHTML = `
      <span class="child-no">CHILD 0${i + 1}</span>
      <b>${item.label}</b>
      <em>${item.profile.label}</em>
      <small>${item.note}</small>
      <span class="mini">${triangleLabel(item.mesh.triangles)} 面 · ${item.mesh.damage.deepPores.length} 深孔 · ${item.mesh.damage.erosionBites.length} 风蚀 · master ${item.mesh.seedDNA.master}</span>
    `;
    card.addEventListener('click', () => {
      state.renderer.focus(i);
      $$('.child-card').forEach((element) => element.classList.toggle('on', element === card));
    });
    host.appendChild(card);
  });
}

function exportDNA() {
  const payload = {
    product: 'Brick Mother',
    version: '2.7.5-alpha.1',
    profile: state.selectedProfile,
    batchMode: state.batchMode,
    controls: state.controls,
    globalControlDelta: globalControlDelta(state.profiles.get(state.selectedProfile)),
    seedBank: state.seedBank,
    children: state.currentItems.map((item) => ({
      profileId: item.profile.id,
      label: item.label,
      level: item.level,
      seedDNA: item.mesh.seedDNA,
      controls: item.mesh.controls,
      triangleCount: Math.round(item.mesh.triangles),
      deepPoreCount: item.mesh.damage.deepPores.length,
      erosionBiteCount: item.mesh.damage.erosionBites.length,
      formationEvents: item.mesh.damage.formationEvents,
      formationEventQA: item.mesh.formationEventQA
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `brick-mother-v2-dna-${state.selectedProfile}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindControls() {
  $$('[data-control]').forEach((input) => {
    const key = input.dataset.control;
    input.addEventListener('input', () => {
      state.controls[key] = Number(input.value);
      const output = $(`[data-control-output="${key}"]`);
      if (output) output.textContent = Number(input.value).toFixed(2);
      state.currentItems.forEach((item, index) => {
        item.mesh.controls = controlsForChild(item.profile, index, state.batchMode);
      });
      if (REBUILD_CONTROL_KEYS.includes(key)) scheduleBuild(160);
    });
    input.addEventListener('change', () => {
      if (REBUILD_CONTROL_KEYS.includes(key)) scheduleBuild(80);
    });
  });

  $$('[data-seed]').forEach((input) => {
    const key = input.dataset.seed;
    input.addEventListener('input', () => {
      state.seedBank[key] = Math.max(1, Math.round(Number(input.value) || 1));
      if (key === 'master') {
        const profile = state.profiles.get(state.selectedProfile);
        state.seedBank = seedBankForProfile(profile, state.batchCycle, state.seedBank.master);
        syncSeedUI();
      }
    });
    input.addEventListener('change', () => scheduleBuild(80));
  });

  $('#resetDNA').addEventListener('click', () => {
    const profile = state.profiles.get(state.selectedProfile);
    loadProfileDNA(profile);
    buildCurrentBatch();
  });

  $('#randomizeSeeds').addEventListener('click', () => {
    state.batchCycle = (state.batchCycle + 1) % 64;
    state.seedBank = seedBankForProfile(state.profiles.get(state.selectedProfile), state.batchCycle);
    syncSeedUI();
    buildCurrentBatch();
  });
}

function bindUI() {
  $$('.profile-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedProfile = button.dataset.profile;
      state.batchMode = 'siblings';
      $$('.profile-button').forEach((item) => item.classList.toggle('on', item === button));
      $$('.mode-button').forEach((item) => item.classList.toggle('on', item.dataset.mode === 'siblings'));
      const profile = state.profiles.get(state.selectedProfile);
      updateProfilePanel(profile);
      loadProfileDNA(profile);
      buildCurrentBatch();
    });
  });

  $$('.mode-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.batchMode = button.dataset.mode;
      $$('.mode-button').forEach((item) => item.classList.toggle('on', item === button));
      if (state.batchMode === 'mixed') {
        $$('.profile-button').forEach((item) => item.classList.remove('on'));
      } else {
        $$('.profile-button').forEach((item) => {
          item.classList.toggle('on', item.dataset.profile === state.selectedProfile);
        });
        updateProfilePanel(state.profiles.get(state.selectedProfile));
      }
      buildCurrentBatch();
    });
  });

  $$('.channel-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.debugMode = Number(button.dataset.channel);
      state.renderer.setDebugMode(state.debugMode);
      $$('.channel-button').forEach((item) => item.classList.toggle('on', item === button));
      $('#channelName').textContent = button.dataset.label;
    });
  });

  $('#regenerate').addEventListener('click', () => $('#randomizeSeeds').click());

  $('#specimenMode').addEventListener('click', (event) => {
    state.benchmarkMode = !state.benchmarkMode;
    event.currentTarget.classList.toggle('on', state.benchmarkMode);
    event.currentTarget.textContent = state.benchmarkMode ? '基准方砖' : '历史砖比例';
    buildCurrentBatch();
  });

  $('#soloView').addEventListener('click', (event) => {
    state.soloMode = !state.soloMode;
    event.currentTarget.classList.toggle('on', state.soloMode);
    event.currentTarget.textContent = state.soloMode ? '返回家族' : '单块近景';
    buildCurrentBatch();
  });

  $('#resetView').addEventListener('click', () => {
    state.renderer.resetView();
    $$('.child-card').forEach((element) => element.classList.remove('on'));
  });

  $('#autoRotate').addEventListener('click', (event) => {
    state.renderer.autoRotate = !state.renderer.autoRotate;
    event.currentTarget.classList.toggle('on', state.renderer.autoRotate);
    event.currentTarget.textContent = state.renderer.autoRotate ? '停止旋转' : '自动旋转';
  });

  $('#exportDNA').addEventListener('click', exportDNA);

  $('#showReference').addEventListener('click', () => {
    const frame = $('#referenceFrame');
    if (!frame.getAttribute('src')) frame.src = frame.dataset.src || 'about:blank';
    $('#referencePanel').classList.add('open');
    document.body.classList.add('reference-open');
  });

  const closeReference = () => {
    $('#referencePanel').classList.remove('open');
    document.body.classList.remove('reference-open');
  };

  $('#closeReference').addEventListener('click', closeReference);
  $('#referenceBackdrop').addEventListener('click', closeReference);
  bindControls();
}

async function main() {
  try {
    if (window.__BRICK_MOTHER_INLINE_DATA__) {
      state.data = window.__BRICK_MOTHER_INLINE_DATA__;
    } else {
      const response = await fetch('./data/brick-material-profiles-v2.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`材料档案读取失败 HTTP ${response.status}`);
      state.data = await response.json();
    }
    state.profiles = new Map(state.data.profiles.map((profile) => [profile.id, profile]));
    const requestedProfile = QUERY.get('profile');
    if (requestedProfile && state.profiles.has(requestedProfile)) {
      state.selectedProfile = requestedProfile;
      state.batchMode = QUERY.get('mode') === 'mixed' ? 'mixed' : 'siblings';
    } else if (QUERY.get('mode') === 'siblings') {
      state.batchMode = 'siblings';
    } else {
      state.batchMode = 'mixed';
    }
    if (state.mobileMode && !state.fullFamilyRequested && !state.evidenceMode) {
      state.selectedProfile = state.profiles.has(state.mobileQuickProfile)
        ? state.mobileQuickProfile
        : 'old-pbr-fired';
      state.batchMode = 'siblings';
      state.soloMode = true;
      state.evidenceFocus = 1;
      state.benchmarkMode = true;
    }
    state.debugMode = Math.max(0, Math.min(10, Math.round(Number(QUERY.get('debug') ?? 0) || 0)));
    if (state.evidenceMode) {
      document.body.classList.add('evidence-mode');
      document.body.dataset.evidenceLabel = `Brick Mother V2.7.5 · ${state.selectedProfile} · channel ${state.debugMode}`;
    }
    const profile = state.profiles.get(state.selectedProfile);
    state.controls = controlDefaultsForProfile(profile);
    const requestedMaster = Number(QUERY.get('seed'));
    state.seedBank = seedBankForProfile(
      profile,
      state.batchCycle,
      Number.isFinite(requestedMaster) && requestedMaster > 0 ? requestedMaster : null
    );
    installMobileRuntimeUI();
    state.renderer = new BrickRenderer($('#brickCanvas'));
    state.renderer.setDebugMode(state.debugMode);
    updateProfilePanel(profile);
    $$('.profile-button').forEach((item) => item.classList.toggle('on', item.dataset.profile === state.selectedProfile));
    $$('.mode-button').forEach((item) => item.classList.toggle('on', item.dataset.mode === state.batchMode));
    $$('.channel-button').forEach((item) => item.classList.toggle('on', Number(item.dataset.channel) === state.debugMode));
    const activeChannel = $(`.channel-button[data-channel="${state.debugMode}"]`);
    if (activeChannel) $('#channelName').textContent = activeChannel.dataset.label;
    syncControlUI();
    syncSeedUI();
    bindUI();
    $('#soloView').classList.toggle('on', state.soloMode);
    $('#soloView').textContent = state.soloMode ? '返回家族' : '单块近景';
    $('#specimenMode').classList.toggle('on', state.benchmarkMode);
    $('#specimenMode').textContent = state.benchmarkMode ? '基准方砖' : '历史砖比例';
    await buildCurrentBatch();
  } catch (error) {
    console.error(error);
    showFatal(error);
  }
}

main();
})();
