const STORE_NAME = 'attachments';
const MODULE_ID = 'walls';
const CHANNEL_NAME = 'yunnan-component-studio:v1';
const SELECTED_KEY = 'yunnan-wall-v24:selected-reference';
const CACHE_STORE = 'previews';
const RAW_RE = /\.(nef|nrw|cr2|cr3|arw|dng|raf|rw2|orf|pef)$/i;
const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
const DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|txt|md|json)$/i;

const elements = {
  dropZone: document.getElementById('referenceDropZone'),
  fileInput: document.getElementById('libraryFileInput'),
  search: document.getElementById('librarySearch'),
  filter: document.getElementById('libraryFilter'),
  grid: document.getElementById('referenceGrid'),
  count: document.getElementById('libraryCount'),
  status: document.getElementById('libraryStatus'),
  referenceImage: document.getElementById('referenceImage'),
  referencePlaceholder: document.getElementById('referencePlaceholder'),
  legacyFileInput: document.getElementById('referenceFile')
};

let records = [];
let selectedId = localStorage.getItem(SELECTED_KEY) || '';
let selectedUrl = '';
const thumbUrls = new Set();
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

function uid(prefix = 'attachment') {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function openDb() {
  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
  if (!storage) return Promise.reject(new Error('资料库迁移程序未载入'));
  return storage.openAttachments();
}

function openCache() {
  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
  if (!storage) return Promise.reject(new Error('预览缓存迁移程序未载入'));
  return storage.openPreviews();
}

async function listRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.indexNames.contains('moduleId')
      ? store.index('moduleId').getAll(IDBKeyRange.only(MODULE_ID))
      : store.getAll();
    request.onsuccess = () => {
      const values = (request.result || []).filter((record) => record.moduleId === MODULE_ID);
      values.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      resolve(values);
    };
    request.onerror = () => reject(request.error || new Error('资料读取失败'));
  });
}

async function putRecord(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error || new Error('资料写入失败'));
  });
}

async function removeRecord(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('资料删除失败'));
  });
}

async function cacheGet(id) {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const request = db.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(id);
    request.onsuccess = () => resolve(request.result?.blob || null);
    request.onerror = () => reject(request.error || new Error('预览读取失败'));
  });
}

async function cachePut(id, blob) {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    tx.objectStore(CACHE_STORE).put({ attachmentId: id, blob, createdAt: new Date().toISOString() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('预览缓存失败'));
  });
}

async function sha256Hex(buffer) {
  if (!crypto.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isRaw(record) {
  return RAW_RE.test(record.name || '');
}

function isImage(record) {
  return String(record.type || '').startsWith('image/') || IMAGE_RE.test(record.name || '');
}

function isDocument(record) {
  return DOC_RE.test(record.name || '') || String(record.type || '').includes('pdf');
}

function extension(name = '') {
  const value = name.split('.').pop();
  return value && value !== name ? value.slice(0, 5).toUpperCase() : 'FILE';
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}

async function extractEmbeddedJpeg(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const candidates = [];
  let start = -1;
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0xd8) {
      start = index;
      index += 1;
      continue;
    }
    if (start >= 0 && bytes[index] === 0xff && bytes[index + 1] === 0xd9) {
      const end = index + 2;
      if (end - start > 65536) candidates.push([start, end]);
      start = -1;
      index += 1;
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  return new Blob([buffer.slice(candidates[0][0], candidates[0][1])], { type: 'image/jpeg' });
}

async function previewBlob(record, allowExtract = false) {
  if (isImage(record)) return record.blob;
  if (!isRaw(record)) return null;
  const cached = await cacheGet(record.id);
  if (cached || !allowExtract) return cached;
  setStatus(`正在提取 ${record.name} 的内嵌预览`);
  const jpeg = await extractEmbeddedJpeg(record.blob);
  if (jpeg) await cachePut(record.id, jpeg);
  return jpeg;
}

function setStatus(text, tone = '') {
  elements.status.textContent = text;
  elements.status.dataset.tone = tone;
}

window.addEventListener('yunnan-component-studio-storage', (event) => {
  const detail = event.detail || {};
  if (!['YunnanComponentStudio', 'YunnanWallStudioV2'].includes(detail.database)) return;
  const subject = detail.database === 'YunnanWallStudioV2' ? 'RAW 预览缓存' : '资料库';
  if (detail.state === 'blocked') {
    setStatus(`${subject}升级正在等待其他 HOUSE 页面关闭。关闭旧页面后会自动继续。`, 'error');
  } else if (detail.state === 'versionchange') {
    setStatus(`${subject}已经升级，请重新载入这个页面。`, 'error');
  }
});

function revokeSelectedUrl() {
  if (selectedUrl) URL.revokeObjectURL(selectedUrl);
  selectedUrl = '';
}

function clearThumbUrls() {
  for (const url of thumbUrls) URL.revokeObjectURL(url);
  thumbUrls.clear();
}

async function selectRecord(id, { extractRaw = true } = {}) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  selectedId = id;
  localStorage.setItem(SELECTED_KEY, id);
  revokeSelectedUrl();
  const blob = await previewBlob(record, extractRaw);
  if (blob) {
    selectedUrl = URL.createObjectURL(blob);
    elements.referenceImage.onload = () => {
      elements.referenceImage.hidden = false;
      elements.referencePlaceholder.hidden = true;
      setStatus(`当前参考：${record.name}`);
    };
    elements.referenceImage.src = selectedUrl;
    elements.referenceImage.alt = record.name;
  } else {
    elements.referenceImage.hidden = true;
    elements.referencePlaceholder.hidden = false;
    elements.referencePlaceholder.textContent = isRaw(record)
      ? '这个 RAW 文件没有找到可用的内嵌 JPEG。原件仍保存在资料仓中。'
      : '这份资料无法作为图片直接显示，仍可保留、下载和用于后续知识整理。';
    setStatus(`已选择 ${record.name}`);
  }
  renderGrid();
}

function downloadRecord(record) {
  const url = URL.createObjectURL(record.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = record.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function deleteRecord(record) {
  if (!confirm(`删除资料“${record.name}”吗？`)) return;
  await removeRecord(record.id);
  records = await listRecords();
  if (selectedId === record.id) {
    selectedId = '';
    localStorage.removeItem(SELECTED_KEY);
  }
  channel?.postMessage({ type: 'attachments-updated', moduleId: MODULE_ID });
  renderGrid();
  setStatus('资料已删除');
}

function filteredRecords() {
  const query = elements.search.value.trim().toLowerCase();
  const filter = elements.filter.value;
  return records.filter((record) => {
    const haystack = `${record.name || ''} ${record.type || ''}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (filter === 'image' && !isImage(record)) return false;
    if (filter === 'raw' && !isRaw(record)) return false;
    if (filter === 'document' && !isDocument(record)) return false;
    return true;
  });
}

function renderGrid() {
  clearThumbUrls();
  const values = filteredRecords();
  elements.count.textContent = `${records.length} 个资料`;
  elements.grid.replaceChildren();
  if (!values.length) {
    const empty = document.createElement('div');
    empty.className = 'library-empty';
    empty.textContent = records.length ? '当前筛选没有资料' : '把参考照片、NEF、PDF、图纸和 JSON 拖到上面的资料窗口。';
    elements.grid.append(empty);
    return;
  }
  for (const record of values) {
    const card = document.createElement('article');
    card.className = `reference-card${record.id === selectedId ? ' active' : ''}`;
    card.dataset.attachmentId = record.id;
    const visual = document.createElement('div');
    visual.className = 'reference-thumb';
    visual.innerHTML = `<span>${escapeHtml(isRaw(record) ? 'RAW' : extension(record.name))}</span>`;
    if (isImage(record)) {
      const url = URL.createObjectURL(record.blob);
      thumbUrls.add(url);
      const image = new Image();
      image.src = url;
      image.alt = '';
      visual.replaceChildren(image);
    } else if (isRaw(record)) {
      cacheGet(record.id).then((blob) => {
        if (!blob || !visual.isConnected) return;
        const url = URL.createObjectURL(blob);
        thumbUrls.add(url);
        const image = new Image();
        image.src = url;
        image.alt = '';
        visual.replaceChildren(image);
      }).catch(() => {});
    }
    const meta = document.createElement('div');
    meta.className = 'reference-meta';
    meta.innerHTML = `<strong title="${escapeHtml(record.name)}">${escapeHtml(record.name)}</strong><small>${formatBytes(record.size)}${record.sha256 ? ` · ${record.sha256.slice(0, 7)}` : ''}</small>`;
    const actions = document.createElement('div');
    actions.className = 'reference-actions';
    const download = document.createElement('button');
    download.type = 'button';
    download.title = '下载原件';
    download.textContent = '↓';
    download.onclick = (event) => {
      event.stopPropagation();
      downloadRecord(record);
    };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.title = '删除资料';
    remove.textContent = '×';
    remove.onclick = (event) => {
      event.stopPropagation();
      deleteRecord(record).catch((error) => setStatus(error.message || String(error), 'error'));
    };
    actions.append(download, remove);
    card.append(visual, meta, actions);
    card.onclick = () => selectRecord(record.id).catch((error) => setStatus(error.message || String(error), 'error'));
    elements.grid.append(card);
  }
}

async function addFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  setStatus(`正在写入 ${files.length} 份资料`);
  const added = [];
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const sha256 = await sha256Hex(buffer);
    if (sha256 && records.some((record) => record.sha256 === sha256)) continue;
    const record = {
      id: uid(),
      moduleId: MODULE_ID,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      lastModified: file.lastModified || Date.now(),
      createdAt: new Date().toISOString(),
      sha256,
      blob: new Blob([buffer], { type: file.type || 'application/octet-stream' })
    };
    await putRecord(record);
    added.push(record.id);
  }
  records = await listRecords();
  channel?.postMessage({ type: 'attachments-updated', moduleId: MODULE_ID });
  renderGrid();
  const first = added.map((id) => records.find((record) => record.id === id)).find((record) => record && (isImage(record) || isRaw(record)));
  if (first) await selectRecord(first.id);
  setStatus(added.length ? `已加入 ${added.length} 份资料` : '重复资料已跳过');
}

function setupDropZone() {
  const choose = () => elements.fileInput.click();
  elements.dropZone.onclick = choose;
  elements.dropZone.onkeydown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose();
    }
  };
  for (const name of ['dragenter', 'dragover']) {
    elements.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add('dragging');
    });
  }
  for (const name of ['dragleave', 'drop']) {
    elements.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove('dragging');
    });
  }
  elements.dropZone.addEventListener('drop', (event) => {
    addFiles(event.dataTransfer.files).catch((error) => setStatus(error.message || String(error), 'error'));
  });
  elements.fileInput.onchange = () => {
    addFiles(elements.fileInput.files).catch((error) => setStatus(error.message || String(error), 'error'));
    elements.fileInput.value = '';
  };
}

async function init() {
  if (!elements.dropZone || !elements.grid) return;
  setupDropZone();
  elements.search.oninput = renderGrid;
  elements.filter.onchange = renderGrid;
  if (elements.legacyFileInput) {
    elements.legacyFileInput.addEventListener('change', () => {
      const files = elements.legacyFileInput.files;
      if (files?.length) addFiles(files).catch((error) => setStatus(error.message || String(error), 'error'));
    });
  }
  channel?.addEventListener('message', async (event) => {
    if (event.data?.type === 'attachments-updated' && event.data.moduleId === MODULE_ID) {
      records = await listRecords();
      renderGrid();
    }
  });
  const initialStorageStates = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__?.states || {};
  const initialBlockedState = ['YunnanComponentStudio', 'YunnanWallStudioV2']
    .map((name) => initialStorageStates[name])
    .find((state) => state?.state === 'blocked');
  if (initialBlockedState) {
    const subject = initialBlockedState.database === 'YunnanWallStudioV2' ? 'RAW 预览缓存' : '资料库';
    setStatus(`${subject}升级正在等待其他 HOUSE 页面关闭。关闭旧页面后会自动继续。`, 'error');
  }
  records = await listRecords();
  renderGrid();
  const requested = records.find((record) => record.id === selectedId && (isImage(record) || isRaw(record)))
    || records.find((record) => isImage(record))
    || records.find((record) => isRaw(record));
  if (requested) await selectRecord(requested.id, { extractRaw: false });
  setStatus(records.length ? '原墙面资料仓已连接' : '资料窗口已准备好');
  window.__YUNNAN_WALL_LIBRARY_V24__ = {
    version: '2.4.1',
    moduleId: MODULE_ID,
    get count() { return records.length; },
    refresh: async () => { records = await listRecords(); renderGrid(); }
  };
}

window.addEventListener('beforeunload', () => {
  revokeSelectedUrl();
  clearThumbUrls();
  channel?.close();
});

init().catch((error) => {
  console.error(error);
  setStatus(`资料窗口启动失败：${error.message || error}`, 'error');
});
