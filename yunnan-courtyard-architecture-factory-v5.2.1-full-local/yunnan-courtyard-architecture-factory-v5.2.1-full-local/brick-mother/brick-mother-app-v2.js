(() => {
'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const { clamp, vec3, buildMesh, normalizeControls } = window.BrickMotherGeometryV2;
const { BrickRenderer } = window.BrickMotherRendererV2;

const CONTROL_KEYS = ['colorRichness', 'damage', 'poreDepth', 'waterStain', 'weathering', 'inclusion', 'shapeVariation'];
const SEED_KEYS = ['master', 'shape', 'damage', 'pore', 'color', 'water', 'weather', 'inclusion', 'detail'];
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
  batchMode: 'siblings',
  selectedProfile: 'old-pbr-fired',
  batchCycle: 0,
  currentItems: [],
  building: false,
  debugMode: 0,
  controls: normalizeControls(),
  seedBank: {},
  rebuildTimer: 0
};

function showFatal(error) {
  const node = $('#fatal');
  if (!node) return;
  node.hidden = false;
  node.textContent = `页面初始化失败：${error?.message || error}`;
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
  $('#referenceFrame').src = profileSourceEmbed(profile);
  $('#sourceLicense').textContent = `${profile.source.author} · ${profile.source.license}`;

  $('#dnaGeometry').textContent =
    `比例 ${profile.runtimeDNA.shapeRatio.map((v) => v.toFixed(2)).join(':')} · 边缘 ${profile.runtimeDNA.edgeRadius.toFixed(3)} · 深孔基数 ${n.geometryDeepPoreCount ?? 0}`;
  $('#dnaMaterial').textContent =
    `色彩浓度 ${Number(c.colorRichness ?? 1).toFixed(2)} · 水痕 ${Number(c.waterStain ?? 0).toFixed(2)} · 风化 ${Number(c.weathering ?? 0).toFixed(2)}`;
  $('#dnaDamage').textContent =
    `破碎 ${Number(c.damage ?? 0).toFixed(2)} · 深孔 ${Number(c.poreDepth ?? 0).toFixed(2)} · 边缘脆性 ${profile.runtimeDNA.edgeFragility.toFixed(2)}`;
  $('#noiseSummary').textContent =
    `形体、破损、孔洞、色彩、水痕、风化、夹杂和微细节八类独立种子共同复合`;
  $('#inclusionSummary').textContent = profile.family === 'ADOBE'
    ? '长稻草、短切稻草、稻壳、种粒与脱落孔五层造纹已启用'
    : '夹杂层保留在 DNA 中，当前材质家族以矿物、氧化和孔隙为主';
}

function seedBankForProfile(profile, cycle = state.batchCycle) {
  const base = profile.runtimeDNA.seedBase + cycle * 911;
  const offsets = profile.seedLayerOffsets || {};
  const result = { master: base };
  for (const key of SEED_KEYS.slice(1)) result[key] = base + (offsets[key] || SEED_PRIMES[key] * 101);
  return result;
}

function controlDefaultsForProfile(profile) {
  return normalizeControls(profile.compositeDefaults || {});
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
    ? normalizeControls({ ...profile.compositeDefaults, ...state.controls })
    : normalizeControls(state.controls);
  const shifts = [
    { damage: -0.10, poreDepth: -0.10, waterStain: -0.06, weathering: -0.05, colorRichness: -0.04 },
    { damage: 0.02, poreDepth: 0.03, waterStain: 0.12, weathering: 0.13, colorRichness: 0.05 },
    { damage: 0.16, poreDepth: 0.20, waterStain: 0.02, weathering: 0.08, colorRichness: 0.10 }
  ][childIndex];
  const result = { ...base };
  for (const [key, delta] of Object.entries(shifts)) result[key] = Number(base[key]) + delta;
  return normalizeControls(result);
}

function createBatchDefinitions() {
  if (state.batchMode === 'mixed') {
    const ids = ['historical-fired', 'raw-clay', 'stone-block'];
    const levels = [0.26, 0.36, 0.32];
    const labels = ['富色烧结砖子代', '有机夹杂土坯子代', '矿物风化石块子代'];
    return ids.map((id, i) => {
      const profile = state.profiles.get(id);
      return {
        profile,
        seedDNA: seedDNAFor(profile, i),
        controls: controlsForChild(profile, i, 'mixed'),
        level: levels[i],
        label: labels[i],
        note: ['窑变、氧化斑、深孔与水痕复合', '稻草、稻壳、种粒、脱落孔与湿痕复合', '解理、矿物、锈色、水蚀和脆断复合'][i]
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
  setProgress('正在复合八类种子、深孔几何和多层材料事件场…', 4);
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const definitions = createBatchDefinitions();
  const built = [];

  try {
    for (let i = 0; i < definitions.length; i++) {
      const definition = definitions[i];
      setProgress(`正在生成 ${definition.label} ${i + 1}/3`, 10 + i * 29);
      await new Promise((resolve) => setTimeout(resolve, 18));
      const mesh = buildMesh(definition.profile, definition.seedDNA, definition.controls, definition.level, 1.04);
      if (!mesh.vertices || mesh.triangles < 1000) {
        throw new Error(`${definition.label} 网格过小，生成已停止`);
      }
      built.push({ ...definition, mesh });
    }

    const positions = [-4.4, 0, 4.4];
    const yaws = [-0.24, 0.05, 0.28];
    state.currentItems = built.map((item, i) => ({
      ...item,
      position: vec3(positions[i], item.mesh.dims.y * 0.5 + 0.02, 0),
      yaw: yaws[i]
    }));

    state.renderer.setMeshes(state.currentItems);
    state.renderer.setDebugMode(state.debugMode);
    state.renderer.resetView();
    renderChildCards();

    const totalTriangles = built.reduce((sum, item) => sum + item.mesh.triangles, 0);
    const totalDeepPores = built.reduce((sum, item) => sum + item.mesh.damage.deepPores.length, 0);
    const elapsed = Math.round(performance.now() - start);
    $('#batchStats').textContent =
      `${triangleLabel(totalTriangles)} 三角面 · ${totalDeepPores} 个深孔事件 · 八类独立种子 · ${elapsed} ms`;
    setProgress('V2 复合材质 DNA 首轮生成完成。可单独检查水痕风化和土坯夹杂通道。', 100);

    window.__BRICK_MOTHER_READY__ = true;
    document.documentElement.dataset.brickMotherReady = 'true';
    document.documentElement.dataset.brickMotherVersion = '2.0.0-alpha.1';
    document.documentElement.dataset.seedLayers = '8';
    document.documentElement.dataset.deepPores = String(totalDeepPores);
    window.__BRICK_MOTHER_QA__ = {
      ready: true,
      version: '2.0.0-alpha.1',
      mode: state.batchMode,
      profiles: built.map((item) => item.profile.id),
      triangleCounts: built.map((item) => Math.round(item.mesh.triangles)),
      vertices: built.map((item) => item.mesh.vertices),
      grids: built.map((item) => item.mesh.grid),
      seedDNA: built.map((item) => item.mesh.seedDNA),
      controls: built.map((item) => item.mesh.controls),
      generationMs: elapsed,
      noExternalGeometryAssets: true,
      independentSeedLayers: ['shape', 'damage', 'pore', 'color', 'water', 'weather', 'inclusion', 'detail'],
      negativeDamageGeometry: true,
      deepPoreCounts: built.map((item) => item.mesh.damage.deepPores.length),
      erosionBiteCounts: built.map((item) => item.mesh.damage.erosionBites.length),
      adobeInclusionFamilies: ['long-straw', 'chopped-straw', 'rice-husk', 'seed-grain', 'missing-inclusion-pit'],
      correlatedChannels: ['base-color', 'aggregate-color', 'water-stain', 'weathering', 'cavity', 'roughness', 'micro-normal', 'organic-inclusion'],
      debugModes: 8,
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
    version: '2.0.0-alpha.1',
    profile: state.selectedProfile,
    batchMode: state.batchMode,
    controls: state.controls,
    seedBank: state.seedBank,
    children: state.currentItems.map((item) => ({
      profileId: item.profile.id,
      label: item.label,
      level: item.level,
      seedDNA: item.mesh.seedDNA,
      controls: item.mesh.controls,
      triangleCount: Math.round(item.mesh.triangles),
      deepPoreCount: item.mesh.damage.deepPores.length,
      erosionBiteCount: item.mesh.damage.erosionBites.length
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
      if (['colorRichness', 'waterStain', 'inclusion'].includes(key)) {
        for (const item of state.currentItems) item.mesh.controls[key] = Number(input.value);
      }
    });
    input.addEventListener('change', () => {
      if (['damage', 'poreDepth', 'weathering', 'shapeVariation'].includes(key)) scheduleBuild(80);
    });
  });

  $$('[data-seed]').forEach((input) => {
    const key = input.dataset.seed;
    input.addEventListener('input', () => {
      state.seedBank[key] = Math.max(1, Math.round(Number(input.value) || 1));
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
    const response = await fetch('./data/brick-material-profiles-v2.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`材料档案读取失败 HTTP ${response.status}`);
    state.data = await response.json();
    state.profiles = new Map(state.data.profiles.map((profile) => [profile.id, profile]));
    const profile = state.profiles.get(state.selectedProfile);
    state.controls = controlDefaultsForProfile(profile);
    state.seedBank = seedBankForProfile(profile);
    state.renderer = new BrickRenderer($('#brickCanvas'));
    updateProfilePanel(profile);
    syncControlUI();
    syncSeedUI();
    bindUI();
    await buildCurrentBatch();
  } catch (error) {
    console.error(error);
    showFatal(error);
  }
}

main();
})();
