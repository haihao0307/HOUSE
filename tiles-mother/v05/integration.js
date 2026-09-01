/* V0.5 is an additive adapter over the published V0.4 Three.js renderer. */
(() => {
  'use strict';
  const G = window.TilesMotherV05Parts.geometry;
  const R = window.TilesMotherV05Parts.roof;
  const S = window.TilesMotherV05Parts.studio;
  let ctx = null;
  let state = null;
  let renderer = null;
  let roofScene = null;
  let originalSetMeshes = null;
  let originalDraw = null;
  let originalReset = null;
  let mounted = false;
  const clone = value => JSON.parse(JSON.stringify(value));
  const active = () => !!ctx && ctx.project.materialPreset === 'jiangwutang-v05' && ['pan', 'cover'].includes(ctx.project.active);
  const currentProfile = family => ctx.project.profiles[family];

  function persist() { ctx.project.v05 = clone(state); ctx.project.visualApproved = false; ctx.project.productionApproved = false; ctx.saveSoon(); }
  function currentSeeds(family, entityId) { const p = currentProfile(family); const bank = ctx.app.childSeeds(p.seeds, Number(ctx.project.selectedChild) || 0); return R.entitySeeds(bank, entityId); }

  function proxyProject() {
    const mode = S.modeInfo(state);
    const study = clone(ctx.project.study || {});
    study.presentation = { ...(study.presentation || {}), mode: state.mode, exposure: mode.exposure, rotation: 0 };
    return { ...ctx.project, channel: mode.channel, study };
  }

  function applyLayerControls(family) {
    const controls = { ...currentProfile(family).controls };
    if (!state.layers.macro) controls.richness = 0;
    if (!state.layers.meso) { controls.mottle = 0; controls.pores = 0; }
    if (!state.layers.micro) { controls.grain = 0; controls.microRelief = 0; }
    if (!state.layers.weather) controls.weather = 0;
    return controls;
  }

  function mountCanvas() {
    if (!renderer.reliefCanvas) return;
    renderer.originalCanvas.style.display = 'none';
    renderer.reliefCanvas.style.display = 'block';
    renderer.originalCanvas.id = 'gl-legacy';
    renderer.reliefCanvas.id = 'gl';
    renderer.using04 = true;
    if (!renderer.studio04) renderer.studio04 = new window.TilesStudyStudio(renderer.reliefCanvas);
  }

  function buildScene(fit = false) {
    if (!active()) return false;
    roofScene = R.buildRoof({ profiles: { pan: currentProfile('pan'), cover: currentProfile('cover') }, childSeeds: (seeds, variant) => ctx.app.childSeeds(seeds, variant), variant: Number(ctx.project.selectedChild) || 0, physicalTime: state.physicalTime, history: ctx.project.study?.history || window.TilesStudyCore.historyDefaults, roofId: state.roofId });
    const records = roofScene.meshes;
    renderer.studio04.setMeshes(records);
    const xs = [], ys = [], zs = [];
    for (const m of records) for (let i = 0; i < m.positions.length; i += 3) { xs.push(m.positions[i]); ys.push(m.positions[i + 1]); zs.push(m.positions[i + 2]); }
    renderer.v05Bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), minZ: Math.min(...zs), maxZ: Math.max(...zs), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), depth: Math.max(...zs) - Math.min(...zs) };
    renderer.v05Scene = roofScene;
    if (fit) fitCamera(); else renderer.draw();
    updateStatus();
    return true;
  }

  function buildSingle(fit = false) {
    if (!active()) return false;
    const family = ctx.project.active;
    const p = currentProfile(family);
    const bank = ctx.app.childSeeds(p.seeds, Number(ctx.project.selectedChild) || 0);
    const seeds = R.entitySeeds(bank, `${state.roofId}/${family}/single/${ctx.project.selectedChild}`);
    const tile = G.tile(family, `single/${family}/${ctx.project.selectedChild}`, seeds.master, applyLayerControls(family), seeds);
    const history = ctx.project.study?.history || window.TilesStudyCore.historyDefaults;
    const tileState = window.TilesStudyCore.evolve(tile, state.physicalTime, history, family === 'cover' ? 0.92 : 0.82);
    const mesh = G.mesh(tile, { nu: 68, nv: 96, damage: tileState.damage });
    const scene = { meshes: [{ ...mesh, tile, state: tileState, seeds, family, profile: family, role: `${family}-single`, meta: { family, entityId: tile.id, seeds } }], diagnostics: { view: 'single', tileCount: 1, panCount: family === 'pan' ? 1 : 0, coverCount: family === 'cover' ? 1 : 0, meshes: [{ family, entityId: tile.id, positionHash: R.positionHash(mesh.positions), geometry: G.diagnostics(mesh), edgeProfile: G.edgeProfile(mesh), metrics: mesh.metrics }] } };
    roofScene = scene;
    renderer.studio04.setMeshes(scene.meshes);
    const xs = [], ys = [], zs = []; for (let i = 0; i < mesh.positions.length; i += 3) { xs.push(mesh.positions[i]); ys.push(mesh.positions[i + 1]); zs.push(mesh.positions[i + 2]); }
    renderer.v05Bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), minZ: Math.min(...zs), maxZ: Math.max(...zs), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), depth: Math.max(...zs) - Math.min(...zs) };
    renderer.v05Scene = scene;
    if (fit) fitCamera(); else renderer.draw();
    updateStatus();
    return true;
  }

  function fitCamera() {
    if (!renderer?.v05Bounds) return;
    const b = renderer.v05Bounds;
    renderer.yaw = state.focus === 'side-edge' ? 1.28 : state.focus === 'cross-section' ? 1.53 : -0.52;
    renderer.pitch = state.focus === 'cross-section' ? 0.14 : 0.68;
    renderer.target = [state.focus === 'side-edge' ? b.maxX * 0.60 : state.focus === 'pan-overlap' || state.focus === 'cover-seam' ? b.maxX * 0.18 : 0, state.focus === 'board-micro' ? b.maxY * 0.45 : (b.minY + b.maxY) * 0.5, state.focus === 'board-micro' ? b.minZ * 0.32 : 0];
    const rect = renderer.reliefCanvas.getBoundingClientRect();
    const aspect = Math.max(0.38, rect.width / Math.max(1, rect.height));
    const extent = Math.max(b.width, b.depth, b.height * 2.5);
    renderer.distance = Math.max(extent / aspect * 1.35, extent * 1.45, 0.32);
    renderer.draw();
  }

  function draw() {
    if (!active() || !roofScene || !renderer?.studio04) return originalDraw();
    const p = proxyProject();
    renderer.studio04.draw(renderer, p, family => applyLayerControls(family), d => d.meta?.entityId ? currentSeeds(d.family || d.profile, d.meta.entityId) : d.seeds);
    document.body.dataset.tilesMotherReady = 'true';
    document.body.dataset.tilesMotherV05Ready = 'true';
  }

  function updateStatus() {
    const box = document.getElementById('v05Status'); if (!box) return;
    const d = roofScene?.diagnostics;
    box.textContent = d?.view === 'single' ? `V0.5 · 单块 ${ctx.project.active === 'pan' ? '板瓦' : '筒瓦'} · ${S.modeInfo(state).label}` : d ? `V0.5 · ${d.tileCount} 瓦（板 ${d.panCount} / 筒 ${d.coverCount}）· ${d.contacts?.length || 0} 组表面采样 · ${S.modeInfo(state).label}` : `V0.5 · 单块 ${ctx.project.active === 'pan' ? '板瓦' : '筒瓦'} · ${S.modeInfo(state).label}`;
    const meta = document.getElementById('v05Meta'); if (meta) meta.textContent = `roofId=${state.roofId} · entityId/processId 稳定 · 物理时间 ${(state.physicalTime / 86400).toFixed(2)} 示意日 · 尺寸与粗糙度未标定`;
    const profile = currentProfile(ctx.project.active);
    const familyCode = document.getElementById('familyCode'); if (familyCode) familyCode.textContent = ctx.project.active === 'pan' ? 'TM / ROOF / PAN · JIANGWUTANG V0.5' : 'TM / ROOF / COVER · JIANGWUTANG V0.5';
    const title = document.getElementById('specimenTitle'); if (title) title.textContent = d ? '同一屋面关系样方 · 28 块瓦' : (ctx.project.active === 'pan' ? '青灰板瓦 V0.5' : '青灰筒瓦 V0.5');
    const caption = document.getElementById('specimenCaption'); if (caption) caption.textContent = 'V0.5 真实网格候选 · 独立厚度边环 · 搭接关系待校准';
    const measure = document.getElementById('specimenMeasure'); if (measure) measure.textContent = `${profile.controls.length} × ${profile.controls.width} × ${profile.controls.thickness} cm · 实验尺寸，待参考校准 · ${state.mode}`;
    const mode = document.getElementById('v05SceneMode'); if (mode) mode.value = state.mode;
    const focus = document.getElementById('v05Focus'); if (focus) focus.value = state.focus;
    const time = document.getElementById('v05Time'); if (time) time.value = Math.min(90, state.physicalTime / 86400);
    document.querySelectorAll('[data-v05-view]').forEach(b => b.classList.toggle('active', b.dataset.v05View === state.view));
    document.querySelectorAll('[data-v05-layer]').forEach(i => { i.checked = !!state.layers[i.dataset.v05Layer]; });
  }

  function refresh(fit = false) { if (!active()) return; mountCanvas(); if (state.view === 'roof') buildScene(fit); else buildSingle(fit); }
  function addUI() {
    if (document.getElementById('v05Panel')) return;
    const section = document.createElement('section'); section.id = 'v05Panel'; section.className = 'section v05-panel'; section.innerHTML = `<div class="eyebrow">V0.5 / GEOMETRY / FIT</div><h2 class="section-title">讲武堂材质候选 V0.5</h2><p id="v05Status" class="explain"></p><p id="v05Meta" class="explain"></p><div class="row"><button class="small" data-v05-view="single">单瓦</button><button class="small" data-v05-view="roof">28 瓦屋面</button></div><label class="note-label">观察模式</label><select id="v05SceneMode"><option value="neutral_inspection">中性检查</option><option value="studio_beauty">完整光照</option><option value="diagnostic">字段诊断</option></select><label class="note-label">特写</label><select id="v05Focus"><option value="all">全景</option><option value="side-edge">侧边 / 断面</option><option value="cross-section">横截面</option><option value="pan-overlap">板瓦搭接</option><option value="cover-seam">筒瓦盖缝</option><option value="board-micro">板面肌理</option></select><label class="note-label">统一物理时间 <output id="v05TimeValue">0.00</output> 示意日</label><input id="v05Time" type="range" min="0" max="90" step="0.25" value="0"><div class="row"><button id="v05Step" class="small">前进一个求解步</button><button id="v05Reset" class="small">回到初态</button></div><details><summary>细节层开关</summary><label><input type="checkbox" data-v05-layer="macro" checked> 宏观形变</label><label><input type="checkbox" data-v05-layer="meso" checked> 中观斑驳 / 孔簇</label><label><input type="checkbox" data-v05-layer="micro" checked> 微颗粒 / 微法线</label><label><input type="checkbox" data-v05-layer="weather" checked> 风化响应</label></details><p class="explain">中性检查关闭材质纹理、微法线、孔窝暗化与 AO，仅看实际网格。V0.5 仍是候选，不是实测恢复或生产批准。</p></section>`;
    const rail = document.querySelector('.control-rail'); if (rail) rail.insertBefore(section, rail.children[1] || null);
    document.querySelectorAll('[data-v05-view]').forEach(button => button.onclick = () => { state.view = button.dataset.v05View; persist(); refresh(true); });
    document.getElementById('v05SceneMode').onchange = e => { state.mode = S.MODES[e.target.value] ? e.target.value : 'studio_beauty'; persist(); refresh(false); };
    document.getElementById('v05Focus').onchange = e => { state.focus = e.target.value; persist(); fitCamera(); };
    document.getElementById('v05Time').oninput = e => { state.physicalTime = Number(e.target.value) * 86400; state.displayTime = state.physicalTime; persist(); refresh(false); };
    document.getElementById('v05Step').onclick = () => { S.tick(state); persist(); refresh(false); };
    document.getElementById('v05Reset').onclick = () => { state.physicalTime = 0; state.displayTime = 0; persist(); refresh(false); };
    document.querySelectorAll('[data-v05-layer]').forEach(input => input.onchange = () => { state.layers[input.dataset.v05Layer] = input.checked; persist(); renderer.draw(); });
    const preset = document.getElementById('materialPreset'); if (preset && !preset.querySelector('option[value="jiangwutang-v05"]')) { const option = document.createElement('option'); option.value = 'jiangwutang-v05'; option.textContent = '讲武堂材质候选 V0.5'; preset.prepend(option); preset.value = ctx.project.materialPreset; }
  }

  function connect(next) {
    if (ctx) return api;
    ctx = next; renderer = ctx.renderer; state = S.makeState(ctx.project.v05); ctx.project.v05 = state;
    addUI();
    originalSetMeshes = renderer.setMeshes.bind(renderer); originalDraw = renderer.draw.bind(renderer); originalReset = renderer.reset.bind(renderer);
    renderer.setMeshes = (data, fit) => { if (active()) { mountCanvas(); refresh(!!fit); } else { originalSetMeshes(data, fit); renderer.v05Scene = null; } };
    renderer.draw = () => active() && roofScene ? draw() : originalDraw();
    renderer.reset = () => active() && renderer.v05Bounds ? fitCamera() : originalReset();
    refresh(true); updateStatus();
    return api;
  }

  const api = {
    version: '0.5.0', connect, getState: () => clone(state), getDiagnostics: () => roofScene?.diagnostics || null, getScene: () => clone(roofScene?.diagnostics || {}), refresh,
    setView(view) { if (!['single', 'roof'].includes(view)) throw Error('unknown V0.5 view'); state.view = view; persist(); refresh(true); },
    setMode(mode) { if (!S.MODES[mode]) throw Error('unknown V0.5 mode'); state.mode = mode; persist(); refresh(false); },
    setFocus(focus) { if (!S.FOCI.includes(focus)) throw Error('unknown V0.5 focus'); state.focus = focus; persist(); fitCamera(); },
    setLayer(name, value) { if (!Object.hasOwn(state.layers, name)) throw Error('unknown V0.5 layer'); state.layers[name] = !!value; persist(); renderer.draw(); },
    setTime(seconds) { if (!Number.isFinite(seconds) || seconds < 0 || seconds > 90 * 86400) throw Error('V0.5 time outside preview budget'); state.physicalTime = seconds; state.displayTime = seconds; persist(); refresh(false); },
    step() { S.tick(state); persist(); refresh(false); }, getBuildCount: () => roofScene ? 1 : 0
  };
  window.TilesMotherV05 = api;
})();
