const VERSION = '2.8.0';
const PACK_URL = new URL('../data/wall-evidence-pack-20260827.json?v=2.8.0', import.meta.url);
const STYLE_URL = new URL('./wall-lab-v28-evidence.css?v=2.8.0', import.meta.url);
const PACK_APPLIED_KEY = 'yunnan-wall-v28:evidence-pack-applied';
const PRESET_APPLIED_KEY = 'yunnan-wall-v28:evidence-preset-applied';
const PANEL_ID = 'wallEvidence35Panel';
const MODULE_ID = 'walls';
const STORE_NAME = 'attachments';

function waitFor(getter, timeout = 30000) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      try {
        const value = getter();
        if (value) {
          resolve(value);
          return;
        }
      } catch {
        // Keep waiting while the existing modules finish booting.
      }
      if (performance.now() - started > timeout) {
        reject(new Error('35 图证据融合等待工作台模块超时'));
        return;
      }
      setTimeout(check, 80);
    };
    check();
  });
}

function installStyle() {
  if (document.querySelector('link[data-wall-evidence-35]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_URL.href;
  link.dataset.wallEvidence35 = VERSION;
  document.head.append(link);
}

function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = String(value ?? '');
  return span.innerHTML;
}

async function listWallRecords() {
  const storage = await waitFor(() => window.__YUNNAN_COMPONENT_STUDIO_STORAGE__);
  const database = await storage.openAttachments();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.indexNames.contains('moduleId')
      ? store.index('moduleId').getAll(IDBKeyRange.only(MODULE_ID))
      : store.getAll();
    request.onsuccess = () => resolve((request.result || []).filter((record) => record.moduleId === MODULE_ID));
    request.onerror = () => reject(request.error || new Error('墙体资料读取失败'));
  });
}

function addTopStatus() {
  const actions = document.querySelector('.top-actions');
  if (!actions || document.getElementById('wallEvidence35TopPill')) return;
  const pill = document.createElement('span');
  pill.className = 'pill ok';
  pill.id = 'wallEvidence35TopPill';
  pill.textContent = '35 图证据已整流';
  const anchor = actions.querySelector('a');
  actions.insertBefore(pill, anchor || null);
}

function evidenceFindings(pack) {
  return (pack.distilledKnowledge || []).slice(0, 6).map((item) => `
    <li><b>${escapeHtml(item.confidence)}</b><span>${escapeHtml(item.statement)}</span></li>
  `).join('');
}

function createPanel(pack) {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;
  panel = document.createElement('section');
  panel.className = 'panel evidence-pack-panel';
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="panel-head">
      <div><h2>08 35 图证据融合</h2><small>已将本次上传的土坯、石基、抹灰、稻草、孔洞、门洞和历史图录整理为可执行墙体知识。</small></div>
      <span class="pill ok" id="wallEvidence35State">知识包加载完成</span>
    </div>
    <div class="evidence-pack-grid">
      <article class="evidence-pack-summary">
        <div class="evidence-pack-numbers">
          <div><b>${pack.sourceCount}</b><span>资料收据</span></div>
          <div><b>${pack.uniqueEvidenceCount}</b><span>独立证据</span></div>
          <div><b>${(pack.distilledKnowledge || []).length}</b><span>稳定结论</span></div>
          <div><b id="wallEvidence35Matched">0</b><span>本机已匹配</span></div>
        </div>
        <p>一张完全重复的历史图录保留收据，但不会重复增加权重。原始照片没有写入公开仓库，网页只保存蒸馏后的标签、哈希和参数。</p>
      </article>
      <article class="evidence-pack-findings">
        <h3>本轮锁定的墙体关系</h3>
        <ul>${evidenceFindings(pack)}</ul>
      </article>
      <article class="evidence-pack-actions">
        <h3>直接作用于程序墙</h3>
        <p>证据预设降低整块缺失概率，增强小孔洞、纤维、砖边圆化、石基离散和连续侵蚀场。</p>
        <div class="evidence-action-buttons">
          <button class="btn gold" id="wallEvidence35ApplyPreset" type="button">应用 35 图证据预设</button>
          <button class="btn" id="wallEvidence35SelectCore" type="button">选择 12 张核心证据</button>
          <button class="btn" id="wallEvidence35Sync" type="button">重新同步资料标签</button>
          <a class="btn" href="data/wall-evidence-pack-20260827.json" target="_blank" rel="noopener">查看蒸馏知识 JSON</a>
        </div>
        <div class="evidence-pack-status" id="wallEvidence35Status">正在匹配你浏览器中的墙体资料。</div>
      </article>
    </div>
  `;
  const distillation = document.getElementById('distillationLab');
  const workbench = document.getElementById('workbench');
  if (distillation?.parentElement) distillation.parentElement.insertBefore(panel, distillation);
  else workbench?.parentElement?.append(panel);
  return panel;
}

function addEvidencePresetButton(pack, runtime) {
  const host = document.querySelector('.preset-buttons');
  if (!host) return null;
  let button = document.getElementById('wallEvidence35PresetButton');
  if (!button) {
    button = document.createElement('button');
    button.className = 'btn evidence-preset-button';
    button.id = 'wallEvidence35PresetButton';
    button.type = 'button';
    button.textContent = '35 图证据融合';
    const randomize = document.getElementById('randomize');
    host.insertBefore(button, randomize || null);
  }
  runtime.presets.evidence35 = { ...pack.recommendedPreset };
  return button;
}

function setPresetActive(button) {
  document.querySelectorAll('.preset-buttons .btn').forEach((item) => item.classList.toggle('active', item === button));
}

function applyEvidencePreset(pack, runtime, button, status) {
  runtime.applyParameters(pack.recommendedPreset);
  localStorage.setItem(PRESET_APPLIED_KEY, pack.recordId);
  setPresetActive(button);
  if (status) {
    status.textContent = '35 图证据预设已应用，程序墙已经按本批资料重新生成。';
    status.dataset.tone = 'success';
  }
  const label = document.querySelector('.ref-label');
  if (label) label.textContent = '35 图融合：石基、短厚土坯、薄抹灰、小孔洞、稻草纤维与连续侵蚀';
}

function matchPackItems(pack, records) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const bySha = new Map();
  for (const record of records) {
    if (!record.sha256) continue;
    if (!bySha.has(record.sha256)) bySha.set(record.sha256, []);
    bySha.get(record.sha256).push(record);
  }
  const used = new Set();
  const matches = [];
  for (const item of pack.items || []) {
    let record = byId.get(item.attachmentId) || null;
    if (!record && item.originalSha256) {
      record = (bySha.get(item.originalSha256) || []).find((candidate) => !used.has(candidate.id)) || null;
    }
    if (!record) continue;
    used.add(record.id);
    matches.push({ item, record });
  }
  return matches;
}

async function syncAnnotations(pack, { selectCore = false } = {}) {
  const distillation = await waitFor(() => window.__YUNNAN_WALL_DISTILLATION__);
  const records = await listWallRecords();
  const matches = matchPackItems(pack, records);
  const current = distillation.annotations || {};
  const matchedByIndex = new Map();

  for (let index = 0; index < matches.length; index += 1) {
    const { item, record } = matches[index];
    const existing = current[record.id] || {};
    const tags = [...new Set([...(existing.tags || []), ...(item.tags || [])])];
    const note = existing.note?.trim() ? existing.note : item.note;
    const grade = existing.grade || item.grade || 'direct-photo';
    distillation.annotate([record.id], {
      ...existing,
      tags,
      grade,
      note,
      sourcePack: pack.recordId,
      sourceIndex: item.index,
      role: item.role
    });
    matchedByIndex.set(item.index, record.id);
    if ((index + 1) % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const coreIds = (pack.primaryReferenceIndexes || []).map((index) => matchedByIndex.get(index)).filter(Boolean);
  if (selectCore && coreIds.length) {
    distillation.select(coreIds);
    await distillation.generate();
  }
  await window.__YUNNAN_WALL_LIBRARY_V24__?.refresh?.();

  const matchedNode = document.getElementById('wallEvidence35Matched');
  if (matchedNode) matchedNode.textContent = String(matches.length);
  const state = document.getElementById('wallEvidence35State');
  if (state) {
    state.textContent = matches.length === pack.sourceCount ? '35 / 35 已匹配' : `${matches.length} / ${pack.sourceCount} 已匹配`;
    state.dataset.tone = matches.length === pack.sourceCount ? 'success' : 'working';
  }
  const status = document.getElementById('wallEvidence35Status');
  if (status) {
    status.textContent = matches.length
      ? `已把 ${matches.length} 份本机资料与蒸馏知识关联，${coreIds.length} 份核心证据可直接参与参数建议。`
      : '知识包已经加载，但当前浏览器还没有匹配到这批资料。';
    status.dataset.tone = matches.length ? 'success' : 'working';
  }
  return { records, matches, coreIds };
}

async function init() {
  installStyle();
  addTopStatus();
  const response = await fetch(PACK_URL.href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`35 图知识包读取失败：HTTP ${response.status}`);
  const pack = await response.json();
  const runtime = await waitFor(() => window.__YUNNAN_WALL_V27__ || window.__YUNNAN_WALL_V24__);
  await waitFor(() => window.__YUNNAN_WALL_LIBRARY_V24__);
  await waitFor(() => window.__YUNNAN_WALL_DISTILLATION__);
  createPanel(pack);
  const presetButton = addEvidencePresetButton(pack, runtime);
  const panelStatus = document.getElementById('wallEvidence35Status');

  presetButton?.addEventListener('click', () => applyEvidencePreset(pack, runtime, presetButton, panelStatus));
  document.getElementById('wallEvidence35ApplyPreset')?.addEventListener('click', () => applyEvidencePreset(pack, runtime, presetButton, panelStatus));
  document.getElementById('wallEvidence35SelectCore')?.addEventListener('click', () => {
    syncAnnotations(pack, { selectCore: true }).catch((error) => {
      if (panelStatus) {
        panelStatus.textContent = error.message || String(error);
        panelStatus.dataset.tone = 'error';
      }
    });
  });
  document.getElementById('wallEvidence35Sync')?.addEventListener('click', () => {
    syncAnnotations(pack, { selectCore: false }).catch((error) => {
      if (panelStatus) {
        panelStatus.textContent = error.message || String(error);
        panelStatus.dataset.tone = 'error';
      }
    });
  });

  if (localStorage.getItem(PRESET_APPLIED_KEY) !== pack.recordId) {
    applyEvidencePreset(pack, runtime, presetButton, panelStatus);
  } else {
    runtime.presets.evidence35 = { ...pack.recommendedPreset };
  }

  const firstInstall = localStorage.getItem(PACK_APPLIED_KEY) !== pack.recordId;
  const result = await syncAnnotations(pack, { selectCore: firstInstall });
  localStorage.setItem(PACK_APPLIED_KEY, pack.recordId);

  const runtimeLabel = document.getElementById('runtimeLabel');
  if (runtimeLabel) runtimeLabel.textContent = `V${runtime.version} · 35 图证据融合`;
  const noiseNote = document.querySelector('.noise-note');
  if (noiseNote) noiseNote.textContent = '35 图证据融合：低频整墙起伏与竖向雨蚀共享连续场；土坯采用短厚尺寸和低整块缺失率；孔洞、稻草、抹灰断口与石基离散均由独立参数控制。';

  window.__YUNNAN_WALL_EVIDENCE_35__ = {
    version: VERSION,
    pack,
    matchedCount: result.matches.length,
    coreIds: [...result.coreIds],
    applyPreset: () => applyEvidencePreset(pack, runtime, presetButton, panelStatus),
    sync: (options) => syncAnnotations(pack, options)
  };
  window.dispatchEvent(new CustomEvent('yunnan-wall-evidence-pack-ready', {
    detail: { version: VERSION, recordId: pack.recordId, matchedCount: result.matches.length }
  }));
}

init().catch((error) => {
  console.error(error);
  const status = document.getElementById('wallEvidence35Status') || document.getElementById('distillAnnotationStatus');
  if (status) {
    status.textContent = `35 图证据融合失败：${error.message || error}`;
    status.dataset.tone = 'error';
  }
  window.__YUNNAN_WALL_EVIDENCE_35__ = {
    version: VERSION,
    error: error.message || String(error),
    matchedCount: 0
  };
});