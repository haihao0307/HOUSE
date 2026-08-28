(() => {
'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const { clamp, vec3, buildMesh } = window.BrickMotherGeometryV04;
const { BrickRenderer } = window.BrickMotherRendererV04;

const state = {
  data: null,
  profiles: new Map(),
  renderer: null,
  batchMode: 'siblings',
  selectedProfile: 'old-pbr-fired',
  batchCycle: 0,
  currentItems: [],
  building: false,
  debugMode: 0
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
    `比例 ${profile.runtimeDNA.shapeRatio.map((v) => v.toFixed(2)).join(':')} · 边缘 ${profile.runtimeDNA.edgeRadius.toFixed(3)} · 几何孔簇 ${n.geometryPoreCount ?? 0}`;
  $('#dnaMaterial').textContent =
    `粗糙度 ${profile.runtimeDNA.roughnessRange[0].toFixed(2)} 至 ${profile.runtimeDNA.roughnessRange[1].toFixed(2)} · 色彩对比 ${Number(n.colorContrast ?? 1).toFixed(2)}`;
  $('#dnaDamage').textContent =
    `孔蚀 ${profile.runtimeDNA.pitDensity.toFixed(2)} · 边缘脆性 ${profile.runtimeDNA.edgeFragility.toFixed(2)} · 裂缝 ${profile.runtimeDNA.crackAffinity.toFixed(2)}`;
  $('#noiseSummary').textContent =
    `域扭曲 ${Number(n.warpStrength ?? 0).toFixed(2)} · 脊状 ${Number(n.ridgedScale ?? 0).toFixed(1)} · Worley ${Number(n.cellScale ?? 0).toFixed(1)} · 微颗粒 ${Number(n.microScale ?? 0).toFixed(0)}`;
}

function createBatchDefinitions() {
  const cycle = state.batchCycle * 911;
  if (state.batchMode === 'mixed') {
    const ids = ['historical-fired', 'raw-clay', 'stone-block'];
    const levels = [0.24, 0.34, 0.30];
    const labels = ['手工烧结砖子代', '原始黏土砖子代', '石块子代'];
    return ids.map((id, i) => {
      const profile = state.profiles.get(id);
      return {
        profile,
        seed: profile.runtimeDNA.seedBase + [101, 202, 303][i] + cycle,
        level: levels[i],
        label: labels[i],
        note: ['窑变、细碎孔隙和颗粒边缘', '团粒、松散边角和浅裂', '解理、矿物颗粒和脆断'][i]
      };
    });
  }

  const profile = state.profiles.get(state.selectedProfile);
  const levels = [0.14, 0.31, 0.49];
  return levels.map((level, i) => ({
    profile,
    seed: profile.runtimeDNA.seedBase + [71, 181, 307][i] + cycle,
    level,
    label: ['基准子代', '边角孔蚀子代', '裂缝空洞子代'][i],
    note: [
      '保留母材身份，低损伤高细节',
      '真实负向崩角、孔簇和浅坑',
      '裂缝、空洞和断面颗粒增加'
    ][i]
  }));
}

function setProgress(text, percent = null) {
  $('#buildStatus').textContent = text;
  $('#progressBar').style.width = percent == null ? '0%' : `${clamp(percent, 0, 100)}%`;
  $('#loadingMask').classList.toggle('on', state.building);
}

async function buildCurrentBatch() {
  if (state.building) return;
  state.building = true;
  window.__BRICK_MOTHER_READY__ = false;
  const start = performance.now();
  setProgress('正在构建多频噪波材料与高细节几何场…', 4);
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const definitions = createBatchDefinitions();
  const built = [];

  try {
    for (let i = 0; i < definitions.length; i++) {
      const definition = definitions[i];
      setProgress(`正在生成 ${definition.label} ${i + 1}/3`, 10 + i * 29);
      await new Promise((resolve) => setTimeout(resolve, 18));
      const mesh = buildMesh(definition.profile, definition.seed, definition.level, 1.08);
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
    const elapsed = Math.round(performance.now() - start);
    $('#batchStats').textContent =
      `${triangleLabel(totalTriangles)} 三角面 · 多频噪波材质 · 真实负向孔洞 · ${elapsed} ms`;
    setProgress('V0.4 高细节子代生成完成，可以放大检查空洞、颗粒和颜色边界。', 100);

    window.__BRICK_MOTHER_READY__ = true;
    document.documentElement.dataset.brickMotherReady = 'true';
    document.documentElement.dataset.brickMotherVersion = '0.4.0';
    document.documentElement.dataset.noiseStack = '6';
    window.__BRICK_MOTHER_QA__ = {
      ready: true,
      version: '0.4.0',
      mode: state.batchMode,
      profiles: built.map((item) => item.profile.id),
      triangleCounts: built.map((item) => Math.round(item.mesh.triangles)),
      vertices: built.map((item) => item.mesh.vertices),
      grids: built.map((item) => item.mesh.grid),
      seeds: built.map((item) => item.seed),
      generationMs: elapsed,
      noExternalGeometryAssets: true,
      materialStatisticsBounded: true,
      negativeDamageGeometry: true,
      geometryPoreClusters: built.map((item) => item.mesh.damage.poreClusters.length),
      shaderNoiseStack: [
        'gradient-noise',
        'fractal-brownian-motion',
        'ridged-fbm',
        'turbulence',
        'domain-warp',
        'worley-cellular'
      ],
      correlatedChannels: ['base-color', 'cavity', 'roughness', 'micro-normal'],
      debugModes: 6,
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
      <span class="mini">${triangleLabel(item.mesh.triangles)} 面 · ${item.mesh.damage.poreClusters.length} 几何孔簇 · seed ${item.seed}</span>
    `;
    card.addEventListener('click', () => {
      state.renderer.focus(i);
      $$('.child-card').forEach((element) => element.classList.toggle('on', element === card));
    });
    host.appendChild(card);
  });
}

function bindUI() {
  $$('.profile-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedProfile = button.dataset.profile;
      state.batchMode = 'siblings';
      $$('.profile-button').forEach((item) => item.classList.toggle('on', item === button));
      $$('.mode-button').forEach((item) => item.classList.toggle('on', item.dataset.mode === 'siblings'));
      updateProfilePanel(state.profiles.get(state.selectedProfile));
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

  $('#regenerate').addEventListener('click', () => {
    state.batchCycle = (state.batchCycle + 1) % 8;
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
}

async function main() {
  try {
    const response = await fetch('./data/brick-material-profiles-v0.4.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`材料档案读取失败 HTTP ${response.status}`);
    state.data = await response.json();
    state.profiles = new Map(state.data.profiles.map((profile) => [profile.id, profile]));
    state.renderer = new BrickRenderer($('#brickCanvas'));
    updateProfilePanel(state.profiles.get(state.selectedProfile));
    bindUI();
    await buildCurrentBatch();
  } catch (error) {
    console.error(error);
    showFatal(error);
  }
}

main();
})();
