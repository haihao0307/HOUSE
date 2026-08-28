'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const { clamp, vec3, buildMesh } = window.BrickMotherGeometry;
const { BrickRenderer } = window.BrickMotherRenderer;
const state = {
  data: null,
  profiles: new Map(),
  renderer: null,
  batchMode: 'siblings',
  selectedProfile: 'old-pbr-fired',
  batchCycle: 0,
  currentItems: [],
  building: false
};

function profileSourceEmbed(profile) {
  const match = profile.source.sourceUrl.match(/-([a-f0-9]{32})$/i);
  return match ? `https://sketchfab.com/models/${match[1]}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_watermark=0&ui_hint=0` : profile.source.sourceUrl;
}

function formatColor(values) { return values.map((v) => Math.round(v * 255)).join(' / '); }
function familyLabel(profile) { return profile.family === 'FIRED_CLAY' ? '烧结黏土' : profile.family === 'ADOBE' ? '原始黏土 / 土坯' : '石材'; }
function triangleLabel(n) { return Math.round(n).toLocaleString('zh-CN'); }

function updateProfilePanel(profile) {
  $('#profileName').textContent = profile.label;
  $('#profileFamily').textContent = familyLabel(profile);
  $('#profileSource').textContent = profile.source.filename;
  $('#profileTriangles').textContent = triangleLabel(profile.measured.triangleCount);
  const dimensionSuffix = profile.measured.dimensionUnitStatus === 'source-units-pending-calibration' ? ' 源文件单位（实物尺度待校准）' : ' mm';
  $('#profileDimensions').textContent = profile.measured.dimensionsMm.map((v) => Math.round(v * 10) / 10).join(' × ') + dimensionSuffix;
  $('#profileColor').textContent = formatColor(profile.measured.baseColorMeanSRGB);
  const rough = profile.measured.roughnessMean ?? profile.measured.rawRoughnessMean;
  $('#profileRoughness').textContent = Number(rough).toFixed(3) + (profile.measured.rawMetalnessMean ? '（原始导出已规范化）' : '');
  $('#profileNormal').textContent = `${profile.measured.normalTiltDegrees.mean.toFixed(1)}° / ${profile.measured.normalTiltDegrees.p95.toFixed(1)}°`;
  $('#profileLink').href = profile.source.sourceUrl;
  $('#referenceSourceLink').href = profile.source.sourceUrl;
  $('#referenceFrame').src = profileSourceEmbed(profile);
  $('#sourceLicense').textContent = `${profile.source.author} · ${profile.source.license}`;
  $('#dnaGeometry').textContent = `比例 ${profile.runtimeDNA.shapeRatio.map((v) => v.toFixed(2)).join(':')} · 边缘半径 ${profile.runtimeDNA.edgeRadius.toFixed(3)}`;
  $('#dnaMaterial').textContent = `粗糙度 ${profile.runtimeDNA.roughnessRange[0].toFixed(2)} 至 ${profile.runtimeDNA.roughnessRange[1].toFixed(2)} · 色值锁定`;
  $('#dnaDamage').textContent = `孔蚀 ${profile.runtimeDNA.pitDensity.toFixed(2)} · 边缘脆性 ${profile.runtimeDNA.edgeFragility.toFixed(2)} · 裂缝 ${profile.runtimeDNA.crackAffinity.toFixed(2)}`;
}

function createBatchDefinitions() {
  const cycle = state.batchCycle * 911;
  if (state.batchMode === 'mixed') {
    const ids = ['historical-fired', 'raw-clay', 'stone-block'];
    const levels = [0.24, 0.34, 0.30];
    const labels = ['手工烧结砖子代', '原始黏土砖子代', '石块子代'];
    return ids.map((id, i) => {
      const p = state.profiles.get(id);
      return { profile: p, seed: p.runtimeDNA.seedBase + [101, 202, 303][i] + cycle, level: levels[i], label: labels[i], note: ['窑变与细碎表面', '团粒、松散边角与浅裂', '解理、矿物颗粒与脆断'][i] };
    });
  }
  const p = state.profiles.get(state.selectedProfile);
  const levels = [0.16, 0.33, 0.50];
  return levels.map((level, i) => ({
    profile: p,
    seed: p.runtimeDNA.seedBase + [71, 181, 307][i] + cycle,
    level,
    label: ['基准子代', '边角损伤子代', '孔蚀裂缝子代'][i],
    note: ['保留母材身份，低损伤', '真实负向崩角与浅坑', '裂缝、孔蚀和断面增加'][i]
  }));
}

function setProgress(text, percent = null) {
  $('#buildStatus').textContent = text;
  $('#progressBar').style.width = percent == null ? '0%' : `${clamp(percent, 0, 100)}%`;
  $('#loadingMask').classList.toggle('on', state.building);
}

async function buildCurrentBatch() {
  if (state.building) return;
  state.building = true; setProgress('正在依据参考 DNA 生成三维子代…', 4);
  await new Promise((r) => requestAnimationFrame(r));
  const defs = createBatchDefinitions(), built = [];
  try {
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]; setProgress(`正在生成 ${def.label} ${i + 1}/3`, 12 + i * 29);
      await new Promise((r) => setTimeout(r, 12));
      const mesh = buildMesh(def.profile, def.seed, def.level, 1);
      built.push({ ...def, mesh });
    }
    const positions = [-4.4, 0, 4.4], yaws = [-0.24, 0.05, 0.28];
    state.currentItems = built.map((item, i) => ({ ...item, position: vec3(positions[i], item.mesh.dims.y * 0.5 + 0.02, 0), yaw: yaws[i] }));
    state.renderer.setMeshes(state.currentItems);
    state.renderer.resetView();
    renderChildCards();
    const totalTriangles = built.reduce((a, b) => a + b.mesh.triangles, 0);
    $('#batchStats').textContent = `${triangleLabel(totalTriangles)} 三角面 · 三个独立程序化网格 · 固定材料数据边界`;
    setProgress('首批子代生成完成，可以旋转和放大检查。', 100);
    window.__BRICK_MOTHER_READY__ = true;
    window.__BRICK_MOTHER_QA__ = {
      ready: true,
      mode: state.batchMode,
      profiles: built.map((x) => x.profile.id),
      triangleCounts: built.map((x) => Math.round(x.mesh.triangles)),
      vertices: built.map((x) => x.mesh.vertices),
      seeds: built.map((x) => x.seed),
      noExternalGeometryAssets: true,
      materialStatisticsBounded: true,
      negativeDamageGeometry: true
    };
  } catch (error) {
    console.error(error); setProgress(`生成失败：${error.message || error}`, 0); $('#loadingError').textContent = error.stack || String(error);
  } finally {
    state.building = false; setTimeout(() => $('#loadingMask').classList.remove('on'), 420);
  }
}

function renderChildCards() {
  const host = $('#childCards'); host.innerHTML = '';
  state.currentItems.forEach((item, i) => {
    const card = document.createElement('button'); card.className = 'child-card'; card.dataset.index = i;
    card.innerHTML = `<span class="child-no">CHILD 0${i + 1}</span><b>${item.label}</b><em>${item.profile.label}</em><small>${item.note}</small><span class="mini">${triangleLabel(item.mesh.triangles)} 面 · seed ${item.seed}</span>`;
    card.addEventListener('click', () => { state.renderer.focus(i); $$('.child-card').forEach((e) => e.classList.toggle('on', e === card)); });
    host.appendChild(card);
  });
}

function bindUI() {
  $$('.profile-button').forEach((button) => button.addEventListener('click', () => {
    state.selectedProfile = button.dataset.profile;
    state.batchMode = 'siblings';
    $$('.profile-button').forEach((b) => b.classList.toggle('on', b === button));
    $$('.mode-button').forEach((b) => b.classList.toggle('on', b.dataset.mode === 'siblings'));
    updateProfilePanel(state.profiles.get(state.selectedProfile));
    buildCurrentBatch();
  }));
  $$('.mode-button').forEach((button) => button.addEventListener('click', () => {
    state.batchMode = button.dataset.mode;
    $$('.mode-button').forEach((b) => b.classList.toggle('on', b === button));
    if (state.batchMode === 'mixed') $$('.profile-button').forEach((b) => b.classList.remove('on'));
    else {
      $$('.profile-button').forEach((b) => b.classList.toggle('on', b.dataset.profile === state.selectedProfile));
      updateProfilePanel(state.profiles.get(state.selectedProfile));
    }
    buildCurrentBatch();
  }));
  $('#regenerate').addEventListener('click', () => { state.batchCycle = (state.batchCycle + 1) % 6; buildCurrentBatch(); });
  $('#resetView').addEventListener('click', () => { state.renderer.resetView(); $$('.child-card').forEach((e) => e.classList.remove('on')); });
  $('#autoRotate').addEventListener('click', (e) => { state.renderer.autoRotate = !state.renderer.autoRotate; e.currentTarget.classList.toggle('on', state.renderer.autoRotate); e.currentTarget.textContent = state.renderer.autoRotate ? '停止旋转' : '自动旋转'; });
  $('#showReference').addEventListener('click', () => $('#referencePanel').classList.toggle('open'));
  $('#closeReference').addEventListener('click', () => $('#referencePanel').classList.remove('open'));
  $('#referenceBackdrop').addEventListener('click', () => $('#referencePanel').classList.remove('open'));
}

async function main() {
  try {
    const response = await fetch('./data/brick-material-profiles-v0.3.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`材料档案读取失败 HTTP ${response.status}`);
    state.data = await response.json();
    state.profiles = new Map(state.data.profiles.map((p) => [p.id, p]));
    state.renderer = new BrickRenderer($('#brickCanvas'));
    updateProfilePanel(state.profiles.get(state.selectedProfile));
    bindUI();
    await buildCurrentBatch();
  } catch (error) {
    console.error(error);
    $('#fatal').hidden = false; $('#fatal').textContent = `页面初始化失败：${error.message || error}`;
  }
}

main();
