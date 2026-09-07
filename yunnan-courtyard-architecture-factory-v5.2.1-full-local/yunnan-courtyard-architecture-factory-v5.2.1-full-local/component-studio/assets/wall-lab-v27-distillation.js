const VERSION = '2.7.0';
const MODULE_ID = 'walls';
const STORE_NAME = 'attachments';
const SELECTED_KEY = 'yunnan-wall-v27:batch-selection';
const ANNOTATIONS_KEY = 'yunnan-wall-v27:annotations';
const SNAPSHOTS_KEY = 'yunnan-wall-v27:snapshots';

const tagDefinitions = [
  { id: 'stone-plinth', label: '石基', group: '结构' },
  { id: 'adobe-block', label: '土坯块', group: '材料' },
  { id: 'brick-edge-wear', label: '砖边磨损', group: '侵蚀' },
  { id: 'missing-corner', label: '缺角残边', group: '侵蚀' },
  { id: 'pitting', label: '坑蚀麻面', group: '侵蚀' },
  { id: 'small-holes', label: '小孔洞', group: '细节' },
  { id: 'straw-fiber', label: '稻草纤维', group: '细节' },
  { id: 'plaster-remnant', label: '残存抹灰', group: '饰面' },
  { id: 'plaster-loss', label: '抹灰脱落', group: '饰面' },
  { id: 'repair-patch', label: '修补片区', group: '饰面' },
  { id: 'rain-wash', label: '垂直雨痕', group: '环境' },
  { id: 'base-damp', label: '墙脚返潮', group: '环境' },
  { id: 'large-wave', label: '整墙起伏', group: '形态' },
  { id: 'erosion-cluster', label: '成片侵蚀', group: '形态' },
  { id: 'wood-lintel', label: '木过梁', group: '结构' },
  { id: 'stone-soil-joint', label: '石土交界', group: '结构' },
  { id: 'wall-opening', label: '门窗洞口', group: '结构' },
  { id: 'unknown', label: '待确认', group: '状态' }
];

const grades = {
  'direct-photo': { label: '照片直接可见', weight: 1 },
  'multi-photo': { label: '多图交叉支持', weight: 0.95 },
  'drawing': { label: '图纸或测绘支持', weight: 0.90 },
  'field-note': { label: '现场记录支持', weight: 0.85 },
  'regional-analogy': { label: '地区类比', weight: 0.55 },
  'visual-calibration': { label: '视觉校准', weight: 0.50 },
  'unresolved': { label: '仍未解决', weight: 0.25 }
};

const elements = {
  grid: document.getElementById('referenceGrid'),
  selectedCount: document.getElementById('distillSelectedCount'),
  selectAll: document.getElementById('distillSelectAll'),
  clearSelection: document.getElementById('distillClearSelection'),
  tagGrid: document.getElementById('distillTagGrid'),
  grade: document.getElementById('distillEvidenceGrade'),
  note: document.getElementById('distillNote'),
  applyAnnotation: document.getElementById('distillApplyAnnotation'),
  annotationStatus: document.getElementById('distillAnnotationStatus'),
  summary: document.getElementById('distillSummary'),
  suggestionList: document.getElementById('distillSuggestionList'),
  generate: document.getElementById('distillGenerate'),
  applyParams: document.getElementById('distillApplyParams'),
  saveSnapshot: document.getElementById('distillSaveSnapshot'),
  exportJson: document.getElementById('distillExport'),
  history: document.getElementById('distillHistory')
};

let selectedIds = new Set(loadJson(SELECTED_KEY, []));
let annotations = loadJson(ANNOTATIONS_KEY, {});
let snapshots = loadJson(SNAPSHOTS_KEY, []);
let draftTags = new Set();
let lastDistillation = null;
let decorating = false;

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = String(value ?? '');
  return span.innerHTML;
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value) < 0.1) return Number(value).toFixed(3);
  return Number(value).toFixed(2);
}

async function listRecords() {
  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
  if (!storage) throw new Error('资料库尚未准备好');
  const database = await storage.openAttachments();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.indexNames.contains('moduleId')
      ? store.index('moduleId').getAll(IDBKeyRange.only(MODULE_ID))
      : store.getAll();
    request.onsuccess = () => resolve((request.result || []).filter((record) => record.moduleId === MODULE_ID));
    request.onerror = () => reject(request.error || new Error('资料读取失败'));
  });
}

function visibleAttachmentIds() {
  return [...document.querySelectorAll('.reference-card[data-attachment-id]')]
    .map((card) => card.dataset.attachmentId)
    .filter(Boolean);
}

function updateSelectionStatus() {
  if (elements.selectedCount) elements.selectedCount.textContent = `${selectedIds.size} 份已选`;
  saveJson(SELECTED_KEY, [...selectedIds]);
  for (const card of document.querySelectorAll('.reference-card[data-attachment-id]')) {
    const id = card.dataset.attachmentId;
    const selected = selectedIds.has(id);
    card.classList.toggle('selected-for-distillation', selected);
    const button = card.querySelector('.evidence-select');
    if (button) {
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.title = selected ? '移出整流批次' : '加入整流批次';
    }
  }
}

function annotationFor(id) {
  return annotations[id] || null;
}

function decorateCards() {
  if (decorating || !elements.grid) return;
  decorating = true;
  try {
    for (const card of elements.grid.querySelectorAll('.reference-card[data-attachment-id]')) {
      const id = card.dataset.attachmentId;
      if (!id) continue;
      let selector = card.querySelector('.evidence-select');
      if (!selector) {
        selector = document.createElement('button');
        selector.type = 'button';
        selector.className = 'evidence-select';
        selector.textContent = '✓';
        selector.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (selectedIds.has(id)) selectedIds.delete(id);
          else selectedIds.add(id);
          updateSelectionStatus();
        });
        card.prepend(selector);
      }
      let badge = card.querySelector('.annotation-badge');
      const annotation = annotationFor(id);
      if (annotation) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'annotation-badge';
          card.append(badge);
        }
        const tagCount = Array.isArray(annotation.tags) ? annotation.tags.length : 0;
        const badgeText = `${tagCount} 标签`;
        const badgeTitle = `${grades[annotation.grade]?.label || '未分级'}${annotation.note ? ` · ${annotation.note}` : ''}`;
        if (badge.textContent !== badgeText) badge.textContent = badgeText;
        if (badge.title !== badgeTitle) badge.title = badgeTitle;
      } else if (badge) {
        badge.remove();
      }
    }
    updateSelectionStatus();
  } finally {
    decorating = false;
  }
}

function renderTags() {
  if (!elements.tagGrid) return;
  elements.tagGrid.replaceChildren(...tagDefinitions.map((definition) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'distill-tag';
    button.dataset.tag = definition.id;
    button.innerHTML = `<span>${escapeHtml(definition.label)}</span><small>${escapeHtml(definition.group)}</small>`;
    button.addEventListener('click', () => {
      if (draftTags.has(definition.id)) draftTags.delete(definition.id);
      else draftTags.add(definition.id);
      button.classList.toggle('active', draftTags.has(definition.id));
    });
    return button;
  }));
}

function setAnnotationStatus(text, tone = '') {
  if (!elements.annotationStatus) return;
  elements.annotationStatus.textContent = text;
  elements.annotationStatus.dataset.tone = tone;
}

function applyAnnotation() {
  if (!selectedIds.size) {
    setAnnotationStatus('请先勾选至少一份参考资料。', 'error');
    return;
  }
  if (!draftTags.size && !elements.note?.value.trim()) {
    setAnnotationStatus('请选择标签，或填写观察记录。', 'error');
    return;
  }
  const now = new Date().toISOString();
  for (const id of selectedIds) {
    const previous = annotations[id] || {};
    const mergedTags = new Set([...(previous.tags || []), ...draftTags]);
    annotations[id] = {
      tags: [...mergedTags],
      grade: elements.grade?.value || previous.grade || 'direct-photo',
      note: elements.note?.value.trim() || previous.note || '',
      updatedAt: now
    };
  }
  saveJson(ANNOTATIONS_KEY, annotations);
  setAnnotationStatus(`已把 ${draftTags.size} 个标签写入 ${selectedIds.size} 份资料。`, 'success');
  elements.note.value = '';
  draftTags.clear();
  for (const chip of elements.tagGrid.querySelectorAll('.distill-tag')) chip.classList.remove('active');
  decorateCards();
  generateDistillation().catch((error) => setAnnotationStatus(error.message || String(error), 'error'));
}

function weightedRatio(tagId, selectedAnnotations) {
  let totalWeight = 0;
  let tagWeight = 0;
  for (const annotation of selectedAnnotations) {
    const weight = grades[annotation.grade]?.weight ?? 0.5;
    totalWeight += weight;
    if ((annotation.tags || []).includes(tagId)) tagWeight += weight;
  }
  return totalWeight ? tagWeight / totalWeight : 0;
}

function suggestParameters(selectedAnnotations, currentParams) {
  const suggestions = {};
  const set = (key, value) => { suggestions[key] = value; };
  const ratio = (id) => weightedRatio(id, selectedAnnotations);

  const stone = ratio('stone-plinth');
  if (stone > 0) {
    set('stoneHeight', clamp(0.92 + stone * 0.45, 0.45, 1.65));
    set('stoneProjection', clamp(0.07 + stone * 0.09, 0.02, 0.20));
  }
  const edge = ratio('brick-edge-wear');
  if (edge > 0) set('edgeWear', clamp(0.34 + edge * 0.62, 0, 1));
  const corner = ratio('missing-corner');
  if (corner > 0) set('edgeBreak', clamp(0.24 + corner * 0.70, 0, 1));
  const pitting = ratio('pitting');
  if (pitting > 0) set('pitting', clamp(0.30 + pitting * 0.66, 0, 1));
  const holes = ratio('small-holes');
  if (holes > 0) {
    set('holeDensity', clamp(0.08 + holes * 0.82, 0, 1));
    set('holeScale', clamp(0.045 + holes * 0.075, 0.025, 0.16));
  }
  const straw = ratio('straw-fiber');
  if (straw > 0) {
    set('strawDensity', clamp(0.10 + straw * 0.82, 0, 1));
    set('strawLength', clamp(0.065 + straw * 0.11, 0.035, 0.24));
  }
  const plaster = ratio('plaster-remnant');
  if (plaster > 0) set('plaster', clamp(0.22 + plaster * 0.56, 0, 1));
  const plasterLoss = ratio('plaster-loss');
  if (plasterLoss > 0) set('plasterLoss', clamp(0.32 + plasterLoss * 0.65, 0, 1));
  const repair = ratio('repair-patch');
  if (repair > 0) set('plasterPatchCount', Math.round(clamp(2 + repair * 7, 0, 10)));
  const rain = ratio('rain-wash');
  if (rain > 0) set('rain', clamp(0.28 + rain * 0.68, 0, 1));
  const damp = ratio('base-damp');
  if (damp > 0) set('damp', clamp(0.25 + damp * 0.72, 0, 1));
  const wave = ratio('large-wave');
  if (wave > 0) {
    set('waveStrength', clamp(0.12 + wave * 0.39, 0, 0.58));
    set('domainWarp', clamp(0.28 + wave * 0.62, 0, 1));
  }
  const cluster = ratio('erosion-cluster');
  if (cluster > 0) set('erosionCluster', clamp(0.24 + cluster * 0.70, 0, 1));
  const lintel = ratio('wood-lintel');
  if (lintel > 0) {
    set('lintelEmbed', clamp(0.30 + lintel * 0.18, 0.18, 0.58));
    set('lintelHeight', clamp(0.18 + lintel * 0.10, 0.14, 0.36));
  }
  const joint = ratio('stone-soil-joint');
  if (joint > 0) set('stoneIrregularity', clamp(0.38 + joint * 0.54, 0, 1));

  for (const [key, value] of Object.entries(suggestions)) {
    if (Number.isNaN(value) || value === undefined) delete suggestions[key];
    if (currentParams && key in currentParams && Math.abs(Number(currentParams[key]) - Number(value)) < 0.001) delete suggestions[key];
  }
  return suggestions;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function renderSuggestionList(suggestions) {
  if (!elements.suggestionList) return;
  const runtime = window.__YUNNAN_WALL_V27__ || window.__YUNNAN_WALL_V24__;
  const labels = new Map(Object.values(runtime?.controlDefs || {}).flat().map((definition) => [definition.key, definition.label]));
  const entries = Object.entries(suggestions || {});
  if (!entries.length) {
    elements.suggestionList.innerHTML = '<div class="distill-empty">当前标签还没有形成可执行的参数建议。</div>';
    return;
  }
  elements.suggestionList.innerHTML = entries.map(([key, value]) => {
    const current = runtime?.parameters?.[key];
    return `<div class="parameter-suggestion"><span>${escapeHtml(labels.get(key) || key)}</span><small>${current === undefined ? '当前未设置' : `当前 ${formatNumber(current)}`}</small><b>${formatNumber(value)}</b></div>`;
  }).join('');
}

async function generateDistillation() {
  const records = await listRecords();
  const selectedRecords = records.filter((record) => selectedIds.has(record.id));
  const selectedAnnotations = selectedRecords.map((record) => ({ record, ...(annotations[record.id] || {}) })).filter((item) => item.tags?.length || item.note);
  const counts = new Map();
  for (const item of selectedAnnotations) {
    for (const tag of item.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  const rankedTags = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const runtime = window.__YUNNAN_WALL_V27__ || window.__YUNNAN_WALL_V24__;
  const suggestions = suggestParameters(selectedAnnotations, runtime?.parameters || runtime?.params || {});
  const tagLabels = new Map(tagDefinitions.map((item) => [item.id, item.label]));
  const gradeCounts = new Map();
  for (const item of selectedAnnotations) gradeCounts.set(item.grade || 'unresolved', (gradeCounts.get(item.grade || 'unresolved') || 0) + 1);

  const findings = rankedTags.map(([id, count]) => ({ id, label: tagLabels.get(id) || id, count }));
  lastDistillation = {
    schemaVersion: '1.0.0',
    studioVersion: VERSION,
    generatedAt: new Date().toISOString(),
    selectedCount: selectedRecords.length,
    annotatedCount: selectedAnnotations.length,
    selectedRecords: selectedRecords.map((record) => ({
      id: record.id,
      name: record.name,
      type: record.type,
      size: record.size,
      sha256: record.sha256 || null,
      annotation: annotations[record.id] || null
    })),
    findings,
    gradeCounts: Object.fromEntries(gradeCounts),
    suggestedParameters: suggestions,
    currentParameters: runtime?.parameters ? { ...runtime.parameters } : runtime?.params ? { ...runtime.params } : null
  };

  if (elements.summary) {
    const findingsText = findings.length
      ? findings.slice(0, 8).map((finding) => `<li><b>${escapeHtml(finding.label)}</b><span>${finding.count}/${selectedRecords.length}</span></li>`).join('')
      : '<li><span>选中资料尚未标注</span></li>';
    const gradesText = [...gradeCounts.entries()].map(([grade, count]) => `${grades[grade]?.label || grade} ${count}`).join('，') || '暂无证据等级';
    elements.summary.innerHTML = `
      <div class="distill-summary-metrics">
        <div><b>${selectedRecords.length}</b><span>选中资料</span></div>
        <div><b>${selectedAnnotations.length}</b><span>已标注</span></div>
        <div><b>${Object.keys(suggestions).length}</b><span>参数建议</span></div>
      </div>
      <p>${escapeHtml(gradesText)}</p>
      <ul>${findingsText}</ul>
    `;
  }
  renderSuggestionList(suggestions);
  if (elements.applyParams) elements.applyParams.disabled = !Object.keys(suggestions).length;
  return lastDistillation;
}

function applySuggestedParameters() {
  if (!lastDistillation) return;
  const runtime = window.__YUNNAN_WALL_V27__ || window.__YUNNAN_WALL_V24__;
  if (!runtime?.applyParameters) {
    setAnnotationStatus('程序墙参数接口尚未准备好。', 'error');
    return;
  }
  runtime.applyParameters(lastDistillation.suggestedParameters);
  setAnnotationStatus(`已把 ${Object.keys(lastDistillation.suggestedParameters).length} 项建议应用到程序墙。`, 'success');
  generateDistillation().catch(() => {});
}

function saveSnapshot() {
  if (!lastDistillation) {
    setAnnotationStatus('请先生成一次整流结果。', 'error');
    return;
  }
  const snapshot = {
    id: `WALL-DISTILL-${Date.now()}`,
    savedAt: new Date().toISOString(),
    ...lastDistillation
  };
  snapshots.unshift(snapshot);
  snapshots = snapshots.slice(0, 30);
  saveJson(SNAPSHOTS_KEY, snapshots);
  renderHistory();
  setAnnotationStatus('整流快照已经保存。', 'success');
}

function renderHistory() {
  if (!elements.history) return;
  if (!snapshots.length) {
    elements.history.innerHTML = '<div class="distill-empty">还没有保存的整流快照。</div>';
    return;
  }
  elements.history.innerHTML = snapshots.slice(0, 8).map((snapshot) => {
    const time = new Date(snapshot.savedAt).toLocaleString('zh-CN', { hour12: false });
    return `<button type="button" class="distill-history-item" data-snapshot-id="${escapeHtml(snapshot.id)}"><b>${escapeHtml(time)}</b><span>${snapshot.selectedCount} 份资料 · ${Object.keys(snapshot.suggestedParameters || {}).length} 项建议</span></button>`;
  }).join('');
  for (const button of elements.history.querySelectorAll('[data-snapshot-id]')) {
    button.addEventListener('click', () => {
      const snapshot = snapshots.find((item) => item.id === button.dataset.snapshotId);
      if (!snapshot) return;
      lastDistillation = snapshot;
      renderSuggestionList(snapshot.suggestedParameters || {});
      if (elements.summary) {
        elements.summary.innerHTML = `<p>已载入 ${escapeHtml(new Date(snapshot.savedAt).toLocaleString('zh-CN', { hour12: false }))} 的整流快照。</p>`;
      }
      if (elements.applyParams) elements.applyParams.disabled = !Object.keys(snapshot.suggestedParameters || {}).length;
    });
  }
}

function downloadJson(name, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportDistillation() {
  const result = lastDistillation || await generateDistillation();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadJson(`yunnan-wall-distillation-${timestamp}.json`, {
    ...result,
    allAnnotations: annotations,
    snapshotCount: snapshots.length
  });
  setAnnotationStatus('整流 JSON 已导出。', 'success');
}

function setupEvents() {
  elements.selectAll?.addEventListener('click', () => {
    for (const id of visibleAttachmentIds()) selectedIds.add(id);
    updateSelectionStatus();
  });
  elements.clearSelection?.addEventListener('click', () => {
    selectedIds.clear();
    updateSelectionStatus();
  });
  elements.applyAnnotation?.addEventListener('click', applyAnnotation);
  elements.generate?.addEventListener('click', () => generateDistillation().catch((error) => setAnnotationStatus(error.message || String(error), 'error')));
  elements.applyParams?.addEventListener('click', applySuggestedParameters);
  elements.saveSnapshot?.addEventListener('click', saveSnapshot);
  elements.exportJson?.addEventListener('click', () => exportDistillation().catch((error) => setAnnotationStatus(error.message || String(error), 'error')));
}

function init() {
  if (!elements.grid || !elements.tagGrid) return;
  renderTags();
  renderHistory();
  setupEvents();
  decorateCards();
  const observer = new MutationObserver(() => decorateCards());
  observer.observe(elements.grid, { childList: true, subtree: true });
  window.addEventListener('yunnan-wall-runtime-updated', () => {
    if (lastDistillation) renderSuggestionList(lastDistillation.suggestedParameters || {});
  });
  window.__YUNNAN_WALL_DISTILLATION__ = {
    version: VERSION,
    tagDefinitions,
    grades,
    get selectedIds() { return [...selectedIds]; },
    get annotations() { return JSON.parse(JSON.stringify(annotations)); },
    get snapshots() { return JSON.parse(JSON.stringify(snapshots)); },
    select(ids) {
      selectedIds = new Set(ids || []);
      updateSelectionStatus();
    },
    annotate(ids, payload) {
      const now = new Date().toISOString();
      for (const id of ids || []) annotations[id] = { ...(annotations[id] || {}), ...(payload || {}), updatedAt: now };
      saveJson(ANNOTATIONS_KEY, annotations);
      decorateCards();
    },
    generate: generateDistillation,
    applySuggestedParameters
  };
}

init();
