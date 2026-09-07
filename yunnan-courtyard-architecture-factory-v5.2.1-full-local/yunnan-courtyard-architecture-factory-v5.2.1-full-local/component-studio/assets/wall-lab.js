import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/controls/OrbitControls.js';

const MODULE_ID = 'walls';
const LEGACY_DB = 'YunnanComponentStudio';
const LEGACY_STORE = 'attachments';
const CACHE_DB = 'YunnanWallStudioV2';
const STATE_KEY = 'yunnan-wall-lab:v2:state';
const KNOWLEDGE_URL = './data/wall-knowledge-v2.json';
const RAW_RE = /\.(nef|nrw|cr2|cr3|arw|dng|raf|rw2|orf|pef)$/i;
const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
const DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|txt|md|json)$/i;
const CONTROL_DEFS = [
  ['plaster', '抹灰覆盖', 0, 1, .01], ['earthExposure', '基层暴露', 0, 1, .01],
  ['fiber', '稻草纤维', 0, 1, .01], ['damp', '墙脚返潮', 0, 1, .01],
  ['rain', '垂直雨痕', 0, 1, .01], ['cracks', '裂缝强度', 0, 1, .01],
  ['repair', '补抹片区', 0, 1, .01], ['roughness', '表面粗糙度', .55, 1, .01],
  ['stoneBase', '石勒脚显著度', 0, 1, .01], ['brickCorners', '砖包角显著度', 0, 1, .01],
  ['seed', '生成种子', 1, 999, 1]
];

const $ = (id) => document.getElementById(id);
const els = {};
let knowledge = null;
let attachments = [];
let current = null;
let currentUrl = null;
let thumbUrls = [];
let compareUrls = [];
let wallRuntime = null;
let updateTimer = 0;
let modelLoaded = false;
let state = loadState();

function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
    if (value && typeof value === 'object') return {
      annotations: value.annotations || {}, compare: Array.isArray(value.compare) ? value.compare.slice(0, 4) : [],
      selectedId: value.selectedId || null, wallPreset: value.wallPreset || 'museum1940sBalanced',
      wall: value.wall || null, scale: 1, rotation: 0, updatedAt: value.updatedAt || null
    };
  } catch (error) { console.warn(error); }
  return { annotations: {}, compare: [], selectedId: null, wallPreset: 'museum1940sBalanced', wall: null, scale: 1, rotation: 0 };
}
function saveState() {
  const serial = { ...state, scale: undefined, rotation: undefined, updatedAt: new Date().toISOString() };
  localStorage.setItem(STATE_KEY, JSON.stringify(serial));
  renderReleaseStats();
}
function bind() {
  ['storageState','attachmentCount','dropZone','fileInput','searchInput','typeFilter','attachmentList',
    'annotationState','evidenceLevel','tagCloud','annotationNote','saveAnnotationButton','copyAnnotationButton',
    'viewerTitle','viewerMeta','imagePlaceholder','mainImage','zoomOutButton','zoomResetButton','zoomInButton',
    'rotateButton','compareButton','downloadButton','viewerCaption','clearCompareButton','compareGrid',
    'knowledgeVersion','knowledgeGrid','wallCanvas','presetRow','controlsGrid','modelFrame','releaseFiles',
    'releaseAnnotations','releaseCompare','releasePreset','copyHandoffButton','exportManifestButton',
    'exportPackageButton','toastWrap'].forEach((id) => { els[id] = $(id); });
}
function toast(text, tone = '') {
  const item = document.createElement('div'); item.className = `toast${tone === 'error' ? ' error' : ''}`;
  item.textContent = text; els.toastWrap.append(item); setTimeout(() => item.remove(), 4200);
}
function uid(prefix = 'id') { return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`; }
function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
function formatDate(value) {
  const date = new Date(value); return Number.isNaN(date.getTime()) ? '未知时间' : new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
}
async function sha256Hex(buffer) {
  if (!crypto.subtle) return null; const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
function openDb(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = version ? indexedDB.open(name, version) : indexedDB.open(name);
    request.onupgradeneeded = () => upgrade?.(request.result, request.transaction); request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function legacyDb() {
  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
  if (storage) return storage.openAttachments();
  return openDb(LEGACY_DB, 2, (db, transaction) => {
    const store = db.objectStoreNames.contains(LEGACY_STORE)
      ? transaction.objectStore(LEGACY_STORE)
      : db.createObjectStore(LEGACY_STORE, { keyPath: 'id' });
    if (!store.indexNames.contains('moduleId')) store.createIndex('moduleId', 'moduleId');
  });
}
async function cacheDb() {
  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
  if (storage) return storage.openPreviews();
  return openDb(CACHE_DB, 2, (db) => { if (!db.objectStoreNames.contains('previews')) db.createObjectStore('previews', { keyPath: 'attachmentId' }); });
}
async function listAttachments() {
  const db = await legacyDb(); return new Promise((resolve, reject) => {
    const request = db.transaction(LEGACY_STORE).objectStore(LEGACY_STORE).index('moduleId').getAll(IDBKeyRange.only(MODULE_ID));
    request.onsuccess = () => resolve((request.result || []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    request.onerror = () => reject(request.error);
  });
}
async function putAttachment(record) {
  const db = await legacyDb(); return new Promise((resolve, reject) => {
    const tx = db.transaction(LEGACY_STORE, 'readwrite'); tx.objectStore(LEGACY_STORE).put(record);
    tx.oncomplete = () => resolve(record); tx.onerror = () => reject(tx.error);
  });
}
async function cacheGet(id) {
  const db = await cacheDb(); return new Promise((resolve, reject) => {
    const req = db.transaction('previews').objectStore('previews').get(id);
    req.onsuccess = () => resolve(req.result?.blob || null); req.onerror = () => reject(req.error);
  });
}
async function cachePut(id, blob) {
  const db = await cacheDb(); return new Promise((resolve, reject) => {
    const tx = db.transaction('previews', 'readwrite'); tx.objectStore('previews').put({ attachmentId: id, blob, createdAt: new Date().toISOString() });
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
function isRaw(record) { return RAW_RE.test(record.name || ''); }
function isImage(record) { return String(record.type || '').startsWith('image/') || IMAGE_RE.test(record.name || ''); }
function isDocument(record) { return DOC_RE.test(record.name || '') || String(record.type || '').includes('pdf'); }
async function extractEmbeddedJpeg(blob) {
  const buffer = await blob.arrayBuffer(); const bytes = new Uint8Array(buffer); const found = []; let start = -1;
  for (let i = 0; i < bytes.length - 1; i += 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) { start = i; i += 1; continue; }
    if (start >= 0 && bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
      const end = i + 2; if (end - start > 65536) found.push([start, end]); start = -1; i += 1;
    }
  }
  if (!found.length) return null; found.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  return new Blob([buffer.slice(found[0][0], found[0][1])], { type: 'image/jpeg' });
}
async function previewBlob(record) {
  if (isImage(record)) return record.blob; if (!isRaw(record)) return null;
  const cached = await cacheGet(record.id); if (cached) return cached;
  toast(`正在从 ${record.name} 提取内嵌预览`); const jpeg = await extractEmbeddedJpeg(record.blob);
  if (jpeg) { await cachePut(record.id, jpeg); toast(`${record.name} 的预览已经生成`); }
  return jpeg;
}
function annotation(id) { return state.annotations[id] || { level: knowledge?.evidenceLevels?.[0] || '照片直接可见', tags: [], note: '' }; }
function revokeUrls(list) { list.splice(0).forEach((url) => URL.revokeObjectURL(url)); }
function filtered() {
  const query = els.searchInput.value.trim().toLowerCase(); const type = els.typeFilter.value;
  return attachments.filter((record) => {
    const note = annotation(record.id); const haystack = [record.name, record.type, note.note, ...(note.tags || [])].join(' ').toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (type === 'previewable' && !(isImage(record) || isRaw(record))) return false;
    if (type === 'raw' && !isRaw(record)) return false; if (type === 'document' && !isDocument(record)) return false;
    if (type === 'annotated' && !state.annotations[record.id]) return false; return true;
  });
}
async function renderAttachments() {
  revokeUrls(thumbUrls); els.attachmentList.replaceChildren(); const records = filtered();
  els.attachmentCount.textContent = `${attachments.length} 个文件`;
  if (!records.length) { els.attachmentList.innerHTML = '<div class="panel-note">当前筛选没有资料</div>'; return; }
  for (const record of records) {
    const row = document.createElement('div'); row.className = `attachment${current?.id === record.id ? ' active' : ''}`;
    const thumb = document.createElement('div'); thumb.className = 'thumb'; thumb.textContent = isRaw(record) ? 'RAW' : isDocument(record) ? 'DOC' : 'IMG';
    if (isImage(record)) { const url = URL.createObjectURL(record.blob); thumbUrls.push(url); const img = new Image(); img.src = url; thumb.replaceChildren(img); }
    else if (isRaw(record)) {
      cacheGet(record.id).then((blob) => { if (!blob || !thumb.isConnected) return; const url = URL.createObjectURL(blob); thumbUrls.push(url); const img = new Image(); img.src = url; thumb.replaceChildren(img); });
    }
    const info = document.createElement('div'); info.className = 'file-info';
    const marked = Boolean(state.annotations[record.id]);
    info.innerHTML = `<strong>${escapeHtml(record.name)}</strong><small>${formatBytes(record.size)} · ${formatDate(record.createdAt || record.lastModified)}</small><div class="file-badges">${isRaw(record) ? '<span class="badge raw">NEF / RAW</span>' : ''}${marked ? '<span class="badge marked">已标注</span>' : ''}</div>`;
    const actions = document.createElement('div'); actions.className = 'file-actions';
    const download = document.createElement('button'); download.type = 'button'; download.textContent = '↓'; download.title = '下载原件';
    download.onclick = (event) => { event.stopPropagation(); downloadRecord(record); };
    actions.append(download); row.append(thumb, info, actions); row.onclick = () => selectAttachment(record.id); els.attachmentList.append(row);
  }
}
function escapeHtml(value) { const span = document.createElement('span'); span.textContent = String(value ?? ''); return span.innerHTML; }
function revokeCurrent() { if (currentUrl) URL.revokeObjectURL(currentUrl); currentUrl = null; }
function setImageTransform() { els.mainImage.style.transform = `scale(${state.scale}) rotate(${state.rotation}deg)`; }
async function selectAttachment(id) {
  const record = attachments.find((item) => item.id === id); if (!record) return; current = record; state.selectedId = id; state.scale = 1; state.rotation = 0; saveState();
  els.viewerTitle.textContent = record.name; els.viewerMeta.textContent = `${formatBytes(record.size)} · ${record.sha256 ? record.sha256.slice(0, 12) : '无校验'}`;
  els.viewerCaption.textContent = isRaw(record) ? 'RAW 原件保持只读，当前显示内嵌 JPEG 预览' : '当前显示浏览器可解码原件';
  els.imagePlaceholder.hidden = false; els.imagePlaceholder.textContent = isRaw(record) ? '正在扫描 NEF 内嵌预览……' : '正在解码图片……'; els.mainImage.hidden = true;
  revokeCurrent(); try {
    const blob = await previewBlob(record);
    if (!blob) { els.imagePlaceholder.textContent = '该文件无法直接形成图片预览。原件仍可下载，并可继续填写语义标注。'; }
    else { currentUrl = URL.createObjectURL(blob); els.mainImage.src = currentUrl; els.mainImage.hidden = false; els.imagePlaceholder.hidden = true; setImageTransform(); }
  } catch (error) { console.error(error); els.imagePlaceholder.textContent = `预览失败：${error.message || error}`; }
  fillAnnotation(); renderAttachments();
}
function renderTags() {
  els.evidenceLevel.replaceChildren(...knowledge.evidenceLevels.map((level) => { const option = document.createElement('option'); option.value = level; option.textContent = level; return option; }));
  els.tagCloud.replaceChildren(...knowledge.annotationVocabulary.map((tag) => {
    const label = document.createElement('label'); label.className = 'tag-check';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = tag;
    const span = document.createElement('span'); span.textContent = tag; label.append(input, span); return label;
  }));
}
function fillAnnotation() {
  const data = current ? annotation(current.id) : { level: knowledge.evidenceLevels[0], tags: [], note: '' };
  els.evidenceLevel.value = data.level; els.annotationNote.value = data.note || '';
  els.tagCloud.querySelectorAll('input').forEach((input) => { input.checked = (data.tags || []).includes(input.value); });
  els.annotationState.textContent = current ? (state.annotations[current.id] ? '已保存标注' : '待标注') : '未选择资料';
}
function saveAnnotation() {
  if (!current) { toast('先选择一份资料', 'error'); return; }
  state.annotations[current.id] = { level: els.evidenceLevel.value, tags: [...els.tagCloud.querySelectorAll('input:checked')].map((input) => input.value), note: els.annotationNote.value.trim(), updatedAt: new Date().toISOString() };
  saveState(); fillAnnotation(); renderAttachments(); toast('当前证据标注已保存');
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch {
    const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
  }
}
async function copyAnnotation() {
  if (!current) { toast('先选择一份资料', 'error'); return; } const data = annotation(current.id);
  await copyText(`${current.name}\n证据等级：${data.level}\n语义：${(data.tags || []).join('、') || '未标注'}\n观察：${data.note || '未填写'}`); toast('当前标注已复制');
}
function downloadRecord(record) {
  if (!record) { toast('先选择一份资料', 'error'); return; } const url = URL.createObjectURL(record.blob);
  const link = document.createElement('a'); link.href = url; link.download = record.name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function addFiles(fileList) {
  const files = [...fileList]; if (!files.length) return; toast(`正在写入 ${files.length} 个资料文件`);
  for (const file of files) {
    const buffer = await file.arrayBuffer(); const hash = await sha256Hex(buffer);
    if (hash && attachments.some((item) => item.sha256 === hash)) { toast(`${file.name} 已存在，跳过重复文件`); continue; }
    await putAttachment({ id: uid('attachment'), moduleId: MODULE_ID, name: file.name, type: file.type || 'application/octet-stream', size: file.size, lastModified: file.lastModified || Date.now(), createdAt: new Date().toISOString(), sha256: hash, blob: new Blob([buffer], { type: file.type || 'application/octet-stream' }) });
  }
  attachments = await listAttachments(); renderAttachments(); renderReleaseStats(); toast('新资料已经进入墙面工作室');
}
function setupDrop() {
  const choose = () => els.fileInput.click(); els.dropZone.onclick = choose; els.dropZone.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') choose(); };
  ['dragenter','dragover'].forEach((name) => els.dropZone.addEventListener(name, (event) => { event.preventDefault(); els.dropZone.classList.add('dragging'); }));
  ['dragleave','drop'].forEach((name) => els.dropZone.addEventListener(name, (event) => { event.preventDefault(); els.dropZone.classList.remove('dragging'); }));
  els.dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files)); els.fileInput.onchange = () => { addFiles(els.fileInput.files); els.fileInput.value = ''; };
}
async function addCompare() {
  if (!current) { toast('先选择一张资料', 'error'); return; } if (!state.compare.includes(current.id)) state.compare.push(current.id);
  state.compare = state.compare.slice(-4); saveState(); renderCompare(); toast('已加入多图比较');
}
async function renderCompare() {
  revokeUrls(compareUrls); els.compareGrid.replaceChildren();
  if (!state.compare.length) { els.compareGrid.innerHTML = '<div class="panel-note">从主图审阅区把最多四张图片加入这里。</div>'; renderReleaseStats(); return; }
  for (const id of state.compare) {
    const record = attachments.find((item) => item.id === id); if (!record) continue;
    const card = document.createElement('div'); card.className = 'compare-item'; const remove = document.createElement('button'); remove.textContent = '×'; remove.onclick = () => { state.compare = state.compare.filter((value) => value !== id); saveState(); renderCompare(); }; card.append(remove);
    try { const blob = await previewBlob(record); if (blob) { const url = URL.createObjectURL(blob); compareUrls.push(url); const img = new Image(); img.src = url; img.alt = record.name; card.append(img); } else card.insertAdjacentHTML('beforeend', `<div class="compare-placeholder">${escapeHtml(record.name)}<br>无可用预览</div>`); }
    catch { card.insertAdjacentHTML('beforeend', `<div class="compare-placeholder">${escapeHtml(record.name)}<br>预览失败</div>`); }
    els.compareGrid.append(card);
  }
  renderReleaseStats();
}
function renderKnowledge() {
  els.knowledgeVersion.textContent = `${knowledge.recordId} · ${knowledge.schemaVersion}`; els.knowledgeGrid.replaceChildren();
  const sources = document.createElement('article'); sources.className = 'knowledge-card';
  sources.innerHTML = `<h3>三个真实样本</h3><div class="source-list">${knowledge.referenceModels.map((item) => `<div class="source-item"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.evidenceClass)}<br>${item.wallStudyUse.map(escapeHtml).join('；')}</small></div>`).join('')}</div>`;
  const layers = document.createElement('article'); layers.className = 'knowledge-card';
  layers.innerHTML = `<h3>墙体与表面层</h3><p>${knowledge.wallSystem.geometryLayers.map(escapeHtml).join('、')}</p><ul>${knowledge.wallSystem.surfaceLayers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  const rules = document.createElement('article'); rules.className = 'knowledge-card';
  rules.innerHTML = `<h3>分布与物理逻辑</h3><ul>${knowledge.wallSystem.distributionRules.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  const unresolved = document.createElement('article'); unresolved.className = 'knowledge-card';
  unresolved.innerHTML = `<h3>仍未锁定</h3><ul>${knowledge.unresolved.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  els.knowledgeGrid.append(sources, layers, rules, unresolved);
}
function hash(x, y, seed) { let n = Math.imul(x + seed * 17, 374761393) ^ Math.imul(y + seed * 31, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
function smoothNoise(x, y, scale, seed) {
  const fx = x / scale, fy = y / scale, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const s = (t) => t * t * (3 - 2 * t); const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed), c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, s(tx)), THREE.MathUtils.lerp(c, d, s(tx)), s(ty));
}
function wallTextures(params) {
  const size = 384, color = document.createElement('canvas'), bump = document.createElement('canvas'); color.width = color.height = bump.width = bump.height = size;
  const ctx = color.getContext('2d'), bctx = bump.getContext('2d'), image = ctx.createImageData(size, size), bimage = bctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const i = (y * size + x) * 4, macro = smoothNoise(x, y, 82, params.seed), meso = smoothNoise(x, y, 27, params.seed + 7), fine = smoothNoise(x, y, 6, params.seed + 19);
    const height = 1 - y / size, damp = params.damp * Math.pow(1 - height, 2.4) * (.55 + .45 * macro);
    const rain = params.rain * Math.max(0, smoothNoise(x, 0, 18, params.seed + 33) - .58) * (1 - .18 * height);
    const exposed = Math.max(0, meso - (.68 - params.earthExposure * .28)); const plaster = Math.max(0, params.plaster - exposed * .92);
    const repair = params.repair * Math.max(0, smoothNoise(x, y, 115, params.seed + 51) - .64) * 2.4;
    let r = 134, g = 94, blue = 66; r += plaster * 34; g += plaster * 35; blue += plaster * 30; r += repair * 22; g += repair * 25; blue += repair * 22;
    r -= damp * 52 + rain * 35; g -= damp * 40 + rain * 27; blue -= damp * 25 + rain * 17;
    const grain = (fine - .5) * 26 * params.roughness; r += grain; g += grain * .86; blue += grain * .68;
    image.data[i] = THREE.MathUtils.clamp(r, 18, 245); image.data[i + 1] = THREE.MathUtils.clamp(g, 16, 235); image.data[i + 2] = THREE.MathUtils.clamp(blue, 14, 225); image.data[i + 3] = 255;
    const h = THREE.MathUtils.clamp(128 + (meso - .5) * 64 * params.roughness - exposed * 32 + plaster * 12, 0, 255); bimage.data[i] = bimage.data[i + 1] = bimage.data[i + 2] = h; bimage.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0); bctx.putImageData(bimage, 0, 0);
  ctx.save(); ctx.globalAlpha = params.fiber * .52; ctx.strokeStyle = '#d7b17c'; ctx.lineWidth = .7;
  for (let i = 0; i < Math.round(90 * params.fiber); i += 1) { const x = hash(i, 1, params.seed) * size, y = hash(i, 2, params.seed) * size, len = 4 + hash(i, 3, params.seed) * 13; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y + (hash(i, 4, params.seed) - .5) * 4); ctx.stroke(); }
  ctx.globalAlpha = params.cracks * .68; ctx.strokeStyle = '#34251e'; ctx.lineWidth = .7 + params.cracks * 1.5;
  for (let i = 0; i < Math.round(11 * params.cracks); i += 1) { let x = hash(i, 7, params.seed) * size, y = hash(i, 8, params.seed) * size; ctx.beginPath(); ctx.moveTo(x, y); for (let j = 0; j < 8; j += 1) { x += (hash(i * 11 + j, 9, params.seed) - .5) * 14; y += 7 + hash(i * 13 + j, 10, params.seed) * 13; ctx.lineTo(x, y); } ctx.stroke(); }
  ctx.restore(); return { color, bump };
}
function makeWallGeometry(width, height, depth, taper) {
  const hw = width / 2, hd = depth / 2, tw = hw - taper, td = Math.max(.02, hd - taper * .25);
  const positions = [-hw,0,-hd, hw,0,-hd, hw,0,hd, -hw,0,hd, -tw,height,-td, tw,height,-td, tw,height,td, -tw,height,td];
  const indices = [0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,4,5,6,4,6,7,3,2,1,3,1,0];
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
function initWall() {
  const renderer = new THREE.WebGLRenderer({ canvas: els.wallCanvas, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2.5)); renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b120f); const camera = new THREE.PerspectiveCamera(38, 1, .05, 100); camera.position.set(7.6, 4.2, 8.4);
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 1.8, 0); controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 16;
  scene.add(new THREE.HemisphereLight(0xe8efe9, 0x39281f, 2.1)); const sun = new THREE.DirectionalLight(0xffe7bd, 3.2); sun.position.set(5, 8, 6); sun.castShadow = true; scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x4b5147, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .92 }); const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x696a62, roughness: 1 }); const brickMaterial = new THREE.MeshStandardMaterial({ color: 0x6c4030, roughness: .96 });
  const wallGroup = new THREE.Group(), stoneGroup = new THREE.Group(), brickGroup = new THREE.Group(); scene.add(wallGroup, stoneGroup, brickGroup);
  const add = (group, mesh) => { mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); };
  add(wallGroup, new THREE.Mesh(makeWallGeometry(3.2, 4.2, .55, .11), wallMaterial)); wallGroup.children.at(-1).position.x = -2.2;
  add(wallGroup, new THREE.Mesh(makeWallGeometry(3.2, 4.2, .55, .11), wallMaterial)); wallGroup.children.at(-1).position.x = 2.2;
  add(wallGroup, new THREE.Mesh(makeWallGeometry(1.2, 1.35, .55, .05), wallMaterial)); wallGroup.children.at(-1).position.y = 3.525;
  for (const x of [-2.2, 2.2]) { const stone = new THREE.Mesh(new THREE.BoxGeometry(3.25, .58, .62), stoneMaterial); stone.position.set(x, .29, 0); add(stoneGroup, stone); }
  for (const x of [-3.78, 3.78]) { const corner = new THREE.Mesh(new THREE.BoxGeometry(.34, 4.28, .68), brickMaterial); corner.position.set(x, 2.14, 0); add(brickGroup, corner); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.22, .2, .72), brickMaterial); lintel.position.set(0, 2.91, 0); add(brickGroup, lintel);
  const resize = () => { const w = Math.max(1, els.wallCanvas.clientWidth), h = Math.max(1, els.wallCanvas.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(els.wallCanvas); resize();
  const loop = () => { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); }; loop();
  return { renderer, scene, camera, controls, wallMaterial, stoneMaterial, brickMaterial, stoneGroup, brickGroup, textures: {} };
}
function updateWall() {
  if (!wallRuntime || !state.wall) return; Object.values(wallRuntime.textures).forEach((texture) => texture.dispose()); const generated = wallTextures(state.wall);
  const color = new THREE.CanvasTexture(generated.color), bump = new THREE.CanvasTexture(generated.bump); color.colorSpace = THREE.SRGBColorSpace; color.anisotropy = wallRuntime.renderer.capabilities.getMaxAnisotropy(); bump.anisotropy = color.anisotropy;
  wallRuntime.textures = { color, bump }; wallRuntime.wallMaterial.map = color; wallRuntime.wallMaterial.bumpMap = bump; wallRuntime.wallMaterial.bumpScale = .018 + state.wall.roughness * .045; wallRuntime.wallMaterial.roughness = state.wall.roughness; wallRuntime.wallMaterial.needsUpdate = true;
  wallRuntime.stoneGroup.visible = state.wall.stoneBase > .04; wallRuntime.brickGroup.visible = state.wall.brickCorners > .04;
  wallRuntime.stoneMaterial.color.setHSL(.10, .06, .34 + state.wall.stoneBase * .08); wallRuntime.brickMaterial.color.setHSL(.035, .34, .30 + state.wall.brickCorners * .08);
  saveState(); renderReleaseStats();
}
function scheduleWall() { clearTimeout(updateTimer); updateTimer = setTimeout(updateWall, 90); }
function renderPresets() {
  els.presetRow.replaceChildren(...Object.entries(knowledge.presets).map(([id, preset]) => {
    const button = document.createElement('button'); button.className = `btn compact${state.wallPreset === id ? ' gold' : ''}`; button.textContent = preset.label;
    button.onclick = () => { state.wallPreset = id; state.wall = { ...preset }; saveState(); renderPresets(); renderControls(); updateWall(); }; return button;
  }));
}
function renderControls() {
  els.controlsGrid.replaceChildren(...CONTROL_DEFS.map(([key, label, min, max, step]) => {
    const row = document.createElement('div'); row.className = 'control-row'; const head = document.createElement('label'); const name = document.createElement('span'); name.textContent = label; const output = document.createElement('output'); const currentValue = Number(state.wall[key]); output.textContent = key === 'seed' ? Math.round(currentValue) : currentValue.toFixed(2); head.append(name, output);
    const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = currentValue;
    input.oninput = () => { state.wall[key] = key === 'seed' ? Math.round(Number(input.value)) : Number(input.value); state.wallPreset = 'custom'; output.textContent = key === 'seed' ? state.wall[key] : state.wall[key].toFixed(2); scheduleWall(); renderReleaseStats(); };
    row.append(head, input); return row;
  }));
}
function setupTabs() {
  document.querySelectorAll('.tab').forEach((button) => button.onclick = () => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === button)); document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === button.dataset.tab));
    if (button.dataset.tab === 'models' && !modelLoaded) setModel('wulong');
  });
  document.querySelectorAll('[data-model]').forEach((button) => button.onclick = () => setModel(button.dataset.model));
}
function setModel(id) { modelLoaded = true; document.querySelectorAll('[data-model]').forEach((button) => button.classList.toggle('active', button.dataset.model === id)); els.modelFrame.src = `../reference-model-showcase.html?mode=${id}&quality=inspection`; }
function metadata() { return attachments.map(({ blob, ...item }) => item); }
function renderReleaseStats() { els.releaseFiles.textContent = attachments.length; els.releaseAnnotations.textContent = Object.keys(state.annotations).length; els.releaseCompare.textContent = state.compare.length; if (knowledge) els.releasePreset.textContent = knowledge.presets[state.wallPreset]?.label || '自定义参数'; }
function payload(full) { return { schemaVersion: '2.0.0', moduleId: MODULE_ID, generatedAt: new Date().toISOString(), knowledgeRecordId: knowledge?.recordId, knowledge: full ? knowledge : undefined, wallPreset: state.wallPreset, wallParameters: state.wall, compare: state.compare, annotations: state.annotations, attachments: metadata(), storageBoundary: { originalFiles: 'browser IndexedDB YunnanComponentStudio / attachments', previewCache: 'browser IndexedDB YunnanWallStudioV2 / previews', githubContainsFileBodies: false } }; }
function downloadJson(name, data) { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function handoff() {
  const marked = attachments.filter((item) => state.annotations[item.id]).map((item) => { const data = state.annotations[item.id]; return `- ${item.name} | ${data.level} | ${(data.tags || []).join('、')} | ${data.note || '无补充说明'}`; });
  return [`# 云南墙体与墙面 V2 交接`, '', `知识包：${knowledge.recordId} ${knowledge.schemaVersion}`, `资料：${attachments.length} 个`, `已标注：${marked.length} 个`, `对比板：${state.compare.length} 个`, `试验墙预设：${knowledge.presets[state.wallPreset]?.label || '自定义'}`, '', '## 当前程序参数', '```json', JSON.stringify(state.wall, null, 2), '```', '', '## 已标注证据', marked.length ? marked.join('\n') : '- 尚未保存标注', '', '## 强制规则', ...knowledge.wallSystem.distributionRules.map((item) => `- ${item}`), '', '## 未解决', ...knowledge.unresolved.map((item) => `- ${item}`)].join('\n');
}
function setupActions() {
  els.searchInput.oninput = renderAttachments; els.typeFilter.onchange = renderAttachments; els.saveAnnotationButton.onclick = saveAnnotation; els.copyAnnotationButton.onclick = copyAnnotation;
  els.zoomInButton.onclick = () => { state.scale = Math.min(6, state.scale * 1.25); setImageTransform(); }; els.zoomOutButton.onclick = () => { state.scale = Math.max(.25, state.scale / 1.25); setImageTransform(); };
  els.zoomResetButton.onclick = () => { state.scale = 1; state.rotation = 0; setImageTransform(); }; els.rotateButton.onclick = () => { state.rotation = (state.rotation + 90) % 360; setImageTransform(); };
  els.compareButton.onclick = addCompare; els.downloadButton.onclick = () => downloadRecord(current); els.clearCompareButton.onclick = () => { state.compare = []; saveState(); renderCompare(); };
  els.exportPackageButton.onclick = () => { downloadJson(`yunnan-wall-evidence-v2-${new Date().toISOString().slice(0, 10)}.json`, payload(true)); toast('完整墙面证据包已导出'); };
  els.exportManifestButton.onclick = () => { downloadJson(`yunnan-wall-manifest-v2-${new Date().toISOString().slice(0, 10)}.json`, payload(false)); toast('轻量清单已导出'); };
  els.copyHandoffButton.onclick = async () => { await copyText(handoff()); toast('墙面交接内容已复制'); };
}
async function init() {
  bind(); setupDrop(); setupActions(); setupTabs();
  knowledge = await fetch(KNOWLEDGE_URL, { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error(`知识包 HTTP ${response.status}`); return response.json(); });
  renderTags(); renderKnowledge(); if (!state.wall || (!knowledge.presets[state.wallPreset] && state.wallPreset !== 'custom')) { state.wallPreset = 'museum1940sBalanced'; state.wall = { ...knowledge.presets[state.wallPreset] }; }
  wallRuntime = initWall(); renderPresets(); renderControls(); updateWall();
  try { attachments = await listAttachments(); els.storageState.textContent = '原墙面资料库已连接'; } catch (error) { console.error(error); els.storageState.textContent = '资料库连接失败'; toast(`第一版资料库读取失败：${error.message || error}`, 'error'); }
  renderAttachments(); renderCompare(); renderReleaseStats(); const requested = attachments.find((item) => item.id === state.selectedId)?.id || attachments[0]?.id; if (requested) selectAttachment(requested);
  else els.imagePlaceholder.textContent = '把墙面照片或 NEF 拖入左侧资料仓，即可在这里查看、比较和标注。';
}
window.addEventListener('beforeunload', () => { revokeCurrent(); revokeUrls(thumbUrls); revokeUrls(compareUrls); });
init().catch((error) => { console.error(error); bind(); toast(`墙面工作室启动失败：${error.message || error}`, 'error'); });
