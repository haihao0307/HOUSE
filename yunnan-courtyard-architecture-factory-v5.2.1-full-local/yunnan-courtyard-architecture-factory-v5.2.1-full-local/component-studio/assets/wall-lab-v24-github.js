const GITHUB_OWNER = 'haihao0307';
const GITHUB_REPO = 'HOUSE';
const GITHUB_BRANCH = 'evidence/wall-inbox';
const GITHUB_BASE_BRANCH = 'feature/yunnan-component-studio-v1';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const GITHUB_TOKEN_KEY = 'yunnan-wall-github-token:session';
const DB_NAME = 'YunnanComponentStudio';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';
const MODULE_ID = 'walls';
const MAX_GITHUB_FILE_BYTES = 95 * 1024 * 1024;
const CHANNEL_NAME = 'yunnan-component-studio:v1';

const ui = {
  button: document.getElementById('githubPushButton'),
  state: document.getElementById('githubPushState'),
  modal: document.getElementById('githubPushModal'),
  close: document.getElementById('githubPushClose'),
  cancel: document.getElementById('githubPushCancel'),
  confirm: document.getElementById('githubPushConfirm'),
  token: document.getElementById('githubTokenInput'),
  scope: document.getElementById('githubPushScope'),
  summary: document.getElementById('githubPushSummary'),
  progress: document.getElementById('githubPushProgress'),
  progressBar: document.getElementById('githubPushProgressBar'),
  progressText: document.getElementById('githubPushProgressText'),
  clearToken: document.getElementById('githubClearToken')
};

let records = [];
let busy = false;
let dbPromise = null;
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('moduleId', 'moduleId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('资料库打开失败'));
  });
  return dbPromise;
}

async function listRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.indexNames.contains('moduleId')
      ? store.index('moduleId').getAll(IDBKeyRange.only(MODULE_ID))
      : store.getAll();
    request.onsuccess = () => resolve((request.result || []).filter((record) => record.moduleId === MODULE_ID));
    request.onerror = () => reject(request.error || new Error('资料读取失败'));
  });
}

async function putRecord(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error || new Error('资料状态写入失败'));
  });
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function batchId() {
  return `${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeName(name, fallback) {
  const cleaned = String(name || '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
  return cleaned || fallback;
}

function selectedRecords() {
  if (ui.scope?.value === 'all') return [...records];
  return records.filter((record) => !record.githubUpload?.commitSha);
}

function pendingRecords() {
  return records.filter((record) => !record.githubUpload?.commitSha);
}

function decorateCards() {
  const uploaded = new Set(records.filter((record) => record.githubUpload?.commitSha).map((record) => record.id));
  document.querySelectorAll('.reference-card[data-attachment-id]').forEach((card) => {
    const synced = uploaded.has(card.dataset.attachmentId);
    card.classList.toggle('github-synced', synced);
    let badge = card.querySelector('.github-synced-badge');
    if (synced && !badge) {
      badge = document.createElement('span');
      badge.className = 'github-synced-badge';
      badge.textContent = '已推送';
      card.append(badge);
    } else if (!synced && badge) {
      badge.remove();
    }
  });
}

function updateButton() {
  if (!ui.button) return;
  const pending = pendingRecords().length;
  ui.button.textContent = pending ? `推送 ${pending} 份资料到 GitHub` : '资料已同步到 GitHub';
  ui.button.classList.toggle('synced', pending === 0 && records.length > 0);
  ui.button.disabled = busy || records.length === 0;
  if (ui.state) ui.state.textContent = pending ? `${pending} 份待推送` : records.length ? '已同步' : '没有资料';
  decorateCards();
}

function openModal() {
  if (!ui.modal) return;
  const token = sessionStorage.getItem(GITHUB_TOKEN_KEY) || '';
  ui.token.value = token;
  ui.scope.value = pendingRecords().length ? 'pending' : 'all';
  updateModalSummary();
  ui.progress.hidden = true;
  ui.progressBar.classList.remove('failed');
  ui.modal.hidden = false;
  requestAnimationFrame(() => ui.modal.classList.add('show'));
  setTimeout(() => ui.token.focus(), 40);
}

function closeModal() {
  if (!ui.modal || busy) return;
  ui.modal.classList.remove('show');
  setTimeout(() => { ui.modal.hidden = true; }, 150);
}

function updateModalSummary() {
  const values = selectedRecords();
  const total = values.reduce((sum, record) => sum + Number(record.size || record.blob?.size || 0), 0);
  const oversized = values.filter((record) => Number(record.size || record.blob?.size || 0) > MAX_GITHUB_FILE_BYTES).length;
  ui.summary.innerHTML = `<b>${values.length} 份资料</b><span>合计 ${formatBytes(total)}</span><span>临时分支：${GITHUB_BRANCH}</span>${oversized ? `<span class="warning">${oversized} 份超过 GitHub 单文件限制，将跳过</span>` : ''}`;
}

function setProgress(done, total, text) {
  ui.progress.hidden = false;
  const ratio = total ? Math.round(done / total * 100) : 0;
  ui.progressBar.style.width = `${ratio}%`;
  ui.progressText.textContent = text || `${done}/${total}`;
  ui.confirm.textContent = total ? `正在推送 ${done}/${total}` : '正在准备';
}

async function github(path, token, options = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    mode: 'cors',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || `GitHub HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function refPath(branch) {
  return encodeURIComponent(`heads/${branch}`);
}

async function ensureBranch(token) {
  try {
    return await github(`/git/ref/${refPath(GITHUB_BRANCH)}`, token);
  } catch (error) {
    if (error.status !== 404) throw error;
    const base = await github(`/git/ref/${refPath(GITHUB_BASE_BRANCH)}`, token);
    await github('/git/refs', token, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${GITHUB_BRANCH}`, sha: base.object.sha })
    });
    return github(`/git/ref/${refPath(GITHUB_BRANCH)}`, token);
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('文件编码失败'));
    reader.readAsDataURL(blob);
  });
}

async function createBlobFromRecord(record, token) {
  const content = await blobToBase64(record.blob);
  return github('/git/blobs', token, {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'base64' })
  });
}

async function createTextBlob(content, token) {
  return github('/git/blobs', token, {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'utf-8' })
  });
}

async function commitBatch(values, token) {
  await github('', token);
  const ref = await ensureBranch(token);
  const headSha = ref.object.sha;
  const headCommit = await github(`/git/commits/${headSha}`, token);
  const id = batchId();
  const root = `temporary-evidence/walls/${id}`;
  const tree = [];
  const files = [];
  const skipped = [];

  let completed = 0;
  for (let index = 0; index < values.length; index += 1) {
    const record = values[index];
    const size = Number(record.size || record.blob?.size || 0);
    if (size > MAX_GITHUB_FILE_BYTES) {
      skipped.push({ name: record.name, size, reason: 'file-over-95mb' });
      completed += 1;
      setProgress(completed, values.length, `跳过大文件 ${record.name}`);
      continue;
    }
    setProgress(completed, values.length, `正在上传 ${record.name}`);
    const blob = await createBlobFromRecord(record, token);
    const safeName = sanitizeName(record.name, `file-${index + 1}`);
    const path = `${root}/${String(index + 1).padStart(3, '0')}-${String(record.id || '').slice(-8)}-${safeName}`;
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    files.push({
      id: record.id,
      name: record.name,
      type: record.type,
      size,
      sha256: record.sha256 || null,
      repositoryPath: path
    });
    completed += 1;
    setProgress(completed, values.length, `已准备 ${completed}/${values.length}`);
  }

  if (!files.length) throw new Error('没有可推送的文件。单个文件必须小于 95 MB。');

  const manifest = {
    schemaVersion: '1.0.0',
    batchId: id,
    createdAt: new Date().toISOString(),
    moduleId: MODULE_ID,
    source: 'Yunnan Wall System Studio V2.4.2 browser IndexedDB',
    repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    branch: GITHUB_BRANCH,
    temporaryEvidence: true,
    deletionPolicy: 'delete evidence branch after knowledge distillation and user approval',
    files,
    skipped
  };
  const manifestBlob = await createTextBlob(JSON.stringify(manifest, null, 2), token);
  tree.push({ path: `${root}/manifest.json`, mode: '100644', type: 'blob', sha: manifestBlob.sha });

  const newTree = await github('/git/trees', token, {
    method: 'POST',
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree })
  });
  const commit = await github('/git/commits', token, {
    method: 'POST',
    body: JSON.stringify({
      message: `Upload temporary Yunnan wall evidence batch ${id}`,
      tree: newTree.sha,
      parents: [headSha]
    })
  });
  await github(`/git/refs/${refPath(GITHUB_BRANCH)}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false })
  });

  const uploadedAt = new Date().toISOString();
  for (const file of files) {
    const record = values.find((item) => item.id === file.id);
    if (!record) continue;
    record.githubUpload = {
      branch: GITHUB_BRANCH,
      batchId: id,
      repositoryPath: file.repositoryPath,
      commitSha: commit.sha,
      uploadedAt
    };
    await putRecord(record);
  }
  return { id, root, commitSha: commit.sha, files, skipped };
}

async function refresh() {
  records = await listRecords();
  updateButton();
  if (!ui.modal?.hidden) updateModalSummary();
}

async function push() {
  if (busy) return;
  const values = selectedRecords();
  if (!values.length) {
    alert('当前没有待推送的资料。');
    return;
  }
  const token = ui.token.value.trim();
  if (!token) {
    ui.token.focus();
    return;
  }
  sessionStorage.setItem(GITHUB_TOKEN_KEY, token);
  busy = true;
  ui.confirm.disabled = true;
  ui.cancel.disabled = true;
  ui.close.disabled = true;
  ui.button.disabled = true;
  try {
    const result = await commitBatch(values, token);
    await refresh();
    channel?.postMessage({ type: 'attachments-updated', moduleId: MODULE_ID });
    ui.state.textContent = `已推送 ${result.files.length} 份`;
    ui.progressBar.style.width = '100%';
    ui.progressText.textContent = `完成，提交 ${result.commitSha.slice(0, 8)}`;
    ui.confirm.textContent = '推送完成';
    const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tree/${result.commitSha}/${result.root}`;
    window.open(url, '_blank', 'noopener');
    alert(`资料已经自动推送到 GitHub 临时分支。\n\n批次：${result.id}\n文件：${result.files.length} 份\n提交：${result.commitSha}\n${result.skipped.length ? `跳过：${result.skipped.length} 份超大文件\n` : ''}\n小李现在可以从 GitHub 读取并整流这些资料。`);
    busy = false;
    ui.confirm.disabled = false;
    ui.cancel.disabled = false;
    ui.close.disabled = false;
    closeModal();
  } catch (error) {
    console.error(error);
    if (error.status === 401 || error.status === 403) sessionStorage.removeItem(GITHUB_TOKEN_KEY);
    ui.progress.hidden = false;
    ui.progressBar.style.width = '100%';
    ui.progressBar.classList.add('failed');
    ui.progressText.textContent = `推送失败：${error.message || error}`;
    ui.confirm.textContent = '重新推送';
    alert(`GitHub 推送失败：${error.message || error}\n\n请检查令牌是否对 haihao0307/HOUSE 具有 Contents: Read and write 权限。`);
  } finally {
    busy = false;
    ui.confirm.disabled = false;
    ui.cancel.disabled = false;
    ui.close.disabled = false;
    updateButton();
  }
}

function bind() {
  if (!ui.button) return;
  ui.button.addEventListener('click', openModal);
  ui.close?.addEventListener('click', closeModal);
  ui.cancel?.addEventListener('click', closeModal);
  ui.confirm?.addEventListener('click', () => push());
  ui.scope?.addEventListener('change', updateModalSummary);
  ui.clearToken?.addEventListener('click', () => {
    sessionStorage.removeItem(GITHUB_TOKEN_KEY);
    ui.token.value = '';
    ui.token.focus();
  });
  ui.modal?.addEventListener('click', (event) => {
    if (event.target === ui.modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !ui.modal?.hidden) closeModal();
  });
  channel?.addEventListener('message', (event) => {
    if (event.data?.type === 'attachments-updated' && event.data.moduleId === MODULE_ID) refresh().catch(console.error);
  });
}

async function init() {
  bind();
  const grid = document.getElementById('referenceGrid');
  if (grid) new MutationObserver(() => decorateCards()).observe(grid, { childList: true, subtree: true });
  records = await listRecords();
  updateButton();
  window.__YUNNAN_WALL_GITHUB_PUSH__ = {
    version: '2.4.2',
    repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    branch: GITHUB_BRANCH,
    get pendingCount() { return pendingRecords().length; },
    refresh
  };
}

window.addEventListener('beforeunload', () => channel?.close());
init().catch((error) => {
  console.error(error);
  if (ui.state) ui.state.textContent = `GitHub 推送模块失败：${error.message || error}`;
});
