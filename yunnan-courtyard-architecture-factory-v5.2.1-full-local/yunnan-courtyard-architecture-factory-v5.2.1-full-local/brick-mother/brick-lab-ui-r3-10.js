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
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

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
  const s = api.snapshot();
  node.textContent = `${s.eco ? '省电' : '精细'} · 缓存 ${s.entries} · 命中 ${s.hits} · 新算 ${s.misses}`;
}
function applyHighVariation(button) {
  const sourceButton = $('[data-profile="old-pbr-fired"]');
  if (sourceButton && !sourceButton.classList.contains('on')) sourceButton.click();
  setTimeout(() => {
    for (const [key, value] of Object.entries(HIGH_VARIATION)) {
      dispatchValue($(`[data-control="${key}"]`), value);
    }
    $$('.profile-button').forEach((item) => item.classList.remove('on'));
    button.classList.add('on');
    document.documentElement.dataset.activeProfile = 'old-pbr-fired-high-variation';
    document.documentElement.dataset.highVariationPreset = 'true';
    const name = $('#profileName');
    if (name) name.textContent = '完整老砖 · 高变化预设';
    const family = $('#profileFamily');
    if (family) family.textContent = '同一 V2.7.5 算法 / 高变化参数';
    updateCacheStatus();
  }, 80);
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
    .profile-button[data-r310-high="1"]{border-color:#d7a66b66;background:linear-gradient(135deg,#d7a66b18,#ffffff04)}
    @media(max-width:1020px){.r310-cache{width:100%;margin-left:0}}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'r310-performance';
  const eco = window.__BRICK_MESH_CACHE_R3_10__?.eco !== false;
  panel.innerHTML = `
    <button type="button" id="r310Eco" class="${eco ? 'on' : ''}">省电显示</button>
    <button type="button" id="r310Full" class="${eco ? '' : 'on'}">精细显示</button>
    <button type="button" id="r310Clear">清空已算缓存</button>
    <span class="r310-cache" id="r310CacheStatus"></span>
  `;
  host.parentElement.insertBefore(panel, host);

  const raw = $('[data-profile="raw-clay"]');
  if (raw) {
    const strong = raw.querySelector('strong');
    const span = raw.querySelector('span');
    if (strong) strong.textContent = '土砖 / 土坯';
    if (span) span.textContent = '稻草、稻壳、种粒、土团与湿痕';
  }
  const old = $('[data-profile="old-pbr-fired"]');
  if (old) {
    const strong = old.querySelector('strong');
    if (strong) strong.textContent = '完整老砖';
  }
  const stone = $('[data-profile="stone-block"]');
  if (stone) {
    const strong = stone.querySelector('strong');
    if (strong) strong.textContent = '石块 / 毛石母体';
  }

  const high = document.createElement('button');
  high.type = 'button';
  high.className = 'profile-button';
  high.dataset.r310High = '1';
  high.innerHTML = '<strong>老砖高变化</strong><span>同一算法下增强窑变、孔洞、破损和形体差异</span>';
  const rawIndex = raw ? [...host.children].indexOf(raw) : -1;
  if (rawIndex >= 0) host.insertBefore(high, raw);
  else host.appendChild(high);
  high.addEventListener('click', () => applyHighVariation(high));

  $$('[data-profile]').forEach((button) => {
    button.addEventListener('click', () => {
      high.classList.remove('on');
      document.documentElement.dataset.highVariationPreset = 'false';
      updateCacheStatus();
    }, true);
  });
  $('#r310Eco').addEventListener('click', () => setQuery({ eco: '1', quality: 'eco', mode: 'siblings', solo: '1' }));
  $('#r310Full').addEventListener('click', () => setQuery({ eco: '0', quality: 'full', mode: 'siblings', solo: '1' }));
  $('#r310Clear').addEventListener('click', () => {
    window.__BRICK_MESH_CACHE_R3_10__?.clear();
    updateCacheStatus();
  });

  $$('.section').forEach((section) => {
    if (section.textContent.includes('VERSION COMPARE')) section.hidden = true;
  });
  const topStatus = $('.status');
  if (topStatus) topStatus.innerHTML = '<span class="pill accent">R3.10 单算法</span><span class="pill">烧结砖</span><span class="pill">高变化</span><span class="pill">土砖</span><span class="pill">石块</span>';
  const eyebrow = $('.brand .eyebrow');
  if (eyebrow) eyebrow.textContent = 'R3.10 · ONE ENGINE · LAZY MESH CACHE';
  const title = $('.brand h1');
  if (title) title.textContent = 'Brick Mother 砖材质工作台';

  const stats = $('#batchStats');
  if (stats) new MutationObserver(updateCacheStatus).observe(stats, { childList: true, subtree: true });
  updateCacheStatus();
  return true;
}
function boot() {
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (enhance() || tries > 120) clearInterval(timer);
  }, 50);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
})();