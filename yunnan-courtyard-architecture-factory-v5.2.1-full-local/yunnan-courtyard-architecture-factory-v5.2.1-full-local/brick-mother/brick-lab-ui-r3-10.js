(() => {
'use strict';

const HIGH_VARIATION = Object.freeze({
  colorRichness: 1.48,
  damage: 1.28,
  poreDepth: 1.38,
  poreDensity: 1.56,
  poreVariety: 1.42,
  waterStain: 1.16,
  weathering: 1.22,
  inclusion: 0.55,
  shapeVariation: 1.48,
  rockDetail: 1.05,
  strata: 0.46,
  microErosion: 1.12,
  colorClarity: 1.12,
  colorGamut: 1.28,
  maskSharpness: 1.08
});

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let controlsUnlocked = false;
let unlockTimer = 0;

function setQuery(values) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
  location.href = url.href;
}

function dispatchValue(input, value) {
  if (!input) return;
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function updateCacheStatus() {
  const node = $('#r310CacheStatus');
  const api = window.__BRICK_MESH_CACHE_R3_10__;
  if (!node || !api) return;
  const snapshot = api.snapshot();
  node.textContent = `${snapshot.eco ? '省电' : '精细'} · 缓存 ${snapshot.entries} · 命中 ${snapshot.hits} · 新算 ${snapshot.misses}`;
}

function setCustomActive(button, family) {
  $$('.r310-preset').forEach((item) => item.classList.toggle('on', item === button));
  $$('.profile-button[data-profile]').forEach((item) => item.classList.remove('on'));
  document.documentElement.dataset.r310PresetFamily = family || '';
}

function clearCustomActive(profileId = '') {
  $$('.r310-preset').forEach((item) => item.classList.remove('on'));
  document.documentElement.dataset.r310PresetFamily = profileId;
  document.documentElement.dataset.highVariationPreset = 'false';
}

function sourceButton(profileId) {
  return $(`.profile-button[data-profile="${profileId}"]`);
}

function ensureFamilyView() {
  const button = $('#soloView');
  if (button?.classList.contains('on')) button.click();
}

function ensureSingleView() {
  const button = $('#soloView');
  if (button && !button.classList.contains('on')) button.click();
}

function applyHighVariation(button) {
  if (!controlsUnlocked) return;
  const source = sourceButton('old-pbr-fired');
  if (!source) return;
  source.click();
  for (const [key, value] of Object.entries(HIGH_VARIATION)) {
    dispatchValue($(`[data-control="${key}"]`), value);
  }
  setCustomActive(button, 'old-pbr-fired-high-variation');
  document.documentElement.dataset.activeProfile = 'old-pbr-fired-high-variation';
  document.documentElement.dataset.highVariationPreset = 'true';
  const name = $('#profileName');
  if (name) name.textContent = '完整老砖 · 高变化预设';
  const family = $('#profileFamily');
  if (family) family.textContent = '同一老砖算法 / 高变化参数';
  updateCacheStatus();
}

function showFamilyTrio(profileId, button) {
  if (!controlsUnlocked) return;
  const source = sourceButton(profileId);
  if (!source) return;
  source.click();
  setCustomActive(button, profileId);
  requestAnimationFrame(() => {
    ensureFamilyView();
    setTimeout(relabelChildCards, 60);
  });
}

function variantKind(baseLabel) {
  if (/水痕|风化/.test(baseLabel)) return 1;
  if (/深孔|破碎/.test(baseLabel)) return 2;
  return 0;
}

function relabelChildCards() {
  const family = document.documentElement.dataset.r310PresetFamily ||
    $('.profile-button[data-profile].on')?.dataset.profile ||
    document.documentElement.dataset.activeProfile || '';
  const labels = family === 'raw-clay'
    ? [
        ['土砖 01 · 平衡纤维', '土体、稻草、稻壳和孔隙保持平衡'],
        ['土砖 02 · 水痕风化', '原来可见的湿痕、沉积和风化版本'],
        ['土砖 03 · 深孔破损', '原来可见的塌口、深孔和断面版本']
      ]
    : family === 'stone-block'
      ? [
          ['毛石 01 · 平衡母体', '解理、矿物和自然形体保持平衡'],
          ['毛石 02 · 水蚀风化', '增强水蚀、沉积和表面旧化'],
          ['毛石 03 · 深孔崩裂', '增强孔洞、崩角和断面关系']
        ]
      : family === 'old-pbr-fired-high-variation'
        ? [
            ['高变化老砖 01', '同一老砖算法的平衡变化'],
            ['高变化老砖 02', '同一老砖算法的水痕风化变化'],
            ['高变化老砖 03', '同一老砖算法的深孔破损变化']
          ]
        : null;
  if (!labels) return;
  $$('#childCards .child-card').forEach((card) => {
    const title = card.querySelector('b');
    const note = card.querySelector('small');
    if (!title) return;
    if (!title.dataset.r310BaseLabel) title.dataset.r310BaseLabel = title.textContent || '';
    const index = variantKind(title.dataset.r310BaseLabel);
    title.textContent = labels[index][0];
    if (note) note.textContent = labels[index][1];
  });
}

function unlockWhenReady() {
  if (!controlsUnlocked && window.__BRICK_MOTHER_READY__) {
    controlsUnlocked = true;
    $$('.r310-preset').forEach((button) => { button.disabled = false; });
    const readiness = $('#r310Readiness');
    if (readiness) readiness.textContent = '按钮已就绪';
    clearInterval(unlockTimer);
    unlockTimer = 0;
  }
}

function enhance() {
  const host = $('.profile-buttons');
  if (!host || host.dataset.r310Enhanced === 'true') return false;
  host.dataset.r310Enhanced = 'true';

  const style = document.createElement('style');
  style.textContent = `
    .r310-performance{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 9px;padding:8px;border:1px solid var(--line);border-radius:10px;background:#ffffff05}
    .r310-performance button{min-height:30px;padding:5px 8px;border:1px solid var(--line);border-radius:8px;background:#0d0f0d;color:var(--muted);font-size:8px;cursor:pointer}
    .r310-performance button.on{border-color:#d7a66b77;background:var(--gold-soft);color:var(--gold)}
    .r310-cache{align-self:center;margin-left:auto;color:var(--muted);font-size:8px}
    .r310-readiness{width:100%;color:var(--muted);font-size:7px}
    .r310-preset{width:100%;min-height:48px;display:grid;gap:3px;text-align:left;padding:8px 9px;border:1px solid var(--line);border-radius:10px;background:#ffffff04;color:var(--text);cursor:pointer}
    .r310-preset strong{font-size:11px}.r310-preset span{color:var(--muted);font-size:8px;line-height:1.45}
    .r310-preset:hover,.r310-preset.on{border-color:#d7a66b77;background:var(--gold-soft)}
    .r310-preset.on strong{color:var(--gold)}.r310-preset:disabled{opacity:.45;cursor:wait}
    @media(max-width:1020px){.r310-cache{width:100%;margin-left:0}}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'r310-performance';
  const eco = window.__BRICK_MESH_CACHE_R3_10__?.eco !== false;
  panel.innerHTML = `
    <button type="button" id="r310Eco" class="${eco ? 'on' : ''}">省电显示</button>
    <button type="button" id="r310Full" class="${eco ? '' : 'on'}">精细显示</button>
    <button type="button" id="r310Single">单块省电</button>
    <button type="button" id="r310Family">当前母体三版</button>
    <button type="button" id="r310Clear">清空缓存</button>
    <span class="r310-cache" id="r310CacheStatus"></span>
    <span class="r310-readiness" id="r310Readiness">正在等待第一块生成完成…</span>
  `;
  host.parentElement.insertBefore(panel, host);

  const raw = sourceButton('raw-clay');
  if (raw) {
    const strong = raw.querySelector('strong');
    const span = raw.querySelector('span');
    if (strong) strong.textContent = '土砖 / 土坯 · 单块';
    if (span) span.textContent = '稻草、稻壳、种粒、土团与湿痕';
  }
  const old = sourceButton('old-pbr-fired');
  if (old) {
    const strong = old.querySelector('strong');
    if (strong) strong.textContent = '完整老砖';
  }
  const stone = sourceButton('stone-block');
  if (stone) {
    const strong = stone.querySelector('strong');
    const span = stone.querySelector('span');
    if (strong) strong.textContent = '石块 / 毛石 · 单块';
    if (span) span.textContent = '解理、矿物、锈色与水蚀';
  }

  const high = document.createElement('button');
  high.type = 'button';
  high.className = 'r310-preset';
  high.disabled = true;
  high.innerHTML = '<strong>老砖 · 高变化</strong><span>同一老砖算法增强窑变、孔洞、破损和形体差异</span>';

  const soilTrio = document.createElement('button');
  soilTrio.type = 'button';
  soilTrio.className = 'r310-preset';
  soilTrio.disabled = true;
  soilTrio.innerHTML = '<strong>土砖 · 原来三版并排</strong><span>恢复平衡纤维、水痕风化、深孔破损三个版本</span>';

  const stoneTrio = document.createElement('button');
  stoneTrio.type = 'button';
  stoneTrio.className = 'r310-preset';
  stoneTrio.disabled = true;
  stoneTrio.innerHTML = '<strong>毛石 · 三版并排</strong><span>同一石材算法查看平衡、水蚀和崩裂三个版本</span>';

  if (raw) host.insertBefore(high, raw);
  else host.appendChild(high);
  if (stone) host.insertBefore(soilTrio, stone);
  else host.appendChild(soilTrio);
  host.appendChild(stoneTrio);

  high.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    applyHighVariation(high);
  });
  soilTrio.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    showFamilyTrio('raw-clay', soilTrio);
  });
  stoneTrio.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    showFamilyTrio('stone-block', stoneTrio);
  });

  $$('.profile-button[data-profile]').forEach((button) => {
    button.addEventListener('click', () => {
      clearCustomActive(button.dataset.profile || '');
      updateCacheStatus();
      setTimeout(relabelChildCards, 40);
    }, true);
  });

  $('#r310Eco').addEventListener('click', () => setQuery({ eco: '1', quality: 'eco', mode: 'siblings', solo: '1' }));
  $('#r310Full').addEventListener('click', () => setQuery({ eco: '0', quality: 'full', mode: 'siblings', solo: '1' }));
  $('#r310Single').addEventListener('click', ensureSingleView);
  $('#r310Family').addEventListener('click', ensureFamilyView);
  $('#r310Clear').addEventListener('click', () => {
    window.__BRICK_MESH_CACHE_R3_10__?.clear();
    updateCacheStatus();
  });

  $$('.section').forEach((section) => {
    if (section.textContent.includes('VERSION COMPARE')) section.hidden = true;
  });
  const topStatus = $('.status');
  if (topStatus) topStatus.innerHTML = '<span class="pill accent">R3.11 单算法</span><span class="pill">烧结砖</span><span class="pill">老砖高变化</span><span class="pill">土砖三版</span><span class="pill">毛石三版</span>';
  const eyebrow = $('.brand .eyebrow');
  if (eyebrow) eyebrow.textContent = 'R3.11 · ONE ENGINE · LAZY MESH CACHE';
  const title = $('.brand h1');
  if (title) title.textContent = 'Brick Mother 砖 / 土砖 / 毛石工作台';
  const modeButtons = $$('.mode-button');
  if (modeButtons[0]) modeButtons[0].textContent = '三类母材';
  if (modeButtons[1]) modeButtons[1].textContent = '当前母体三版';

  const stats = $('#batchStats');
  if (stats) new MutationObserver(() => {
    updateCacheStatus();
    unlockWhenReady();
  }).observe(stats, { childList: true, subtree: true });
  const cards = $('#childCards');
  if (cards) new MutationObserver(() => setTimeout(relabelChildCards, 0)).observe(cards, { childList: true, subtree: true });
  unlockTimer = setInterval(unlockWhenReady, 120);
  updateCacheStatus();
  return true;
}

function boot() {
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (enhance() || tries > 160) clearInterval(timer);
  }, 50);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
})();
