const OWNER = 'haihao0307';
const DEFAULT_REPOSITORY = `${OWNER}/HOUSE`;
const DEFAULT_BRANCH = 'wall-evidence-inbox';
const DEFAULT_BASE_BRANCH = 'main';
const MODULE_ID = 'walls';
const DB_NAME = 'YunnanComponentStudio';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';
const CACHE_DB = 'YunnanWallStudioV2';
const CACHE_STORE = 'previews';
const RAW_RE = /\.(nef|nrw|cr2|cr3|arw|dng|raf|rw2|orf|pef)$/i;
const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
const API_VERSION = '2022-11-28';
const PROXY_MAX_DIMENSION = 2048;
const PROXY_JPEG_QUALITY = 0.86;
const MOCK_MODE = new URLSearchParams(location.search).get('githubMock') === '1';

const elements = {
  token: document.getElementById('githubToken'),
  repository: document.getElementById('githubRepository'),
  branch: document.getElementById('githubBranch'),
  baseBranch: document.getElementById('githubBaseBranch'),
  test: document.getElementById('githubTestButton'),
  push: document.getElementById('githubPushButton'),
  cleanup: document.getElementById('githubCleanupButton'),
  status: document.getElementById('githubBridgeStatus'),
  state: document.getElementById('githubBridgeState'),
  progress: document.getElementById('githubProgress'),
  branchLink: document.getElementById('githubBranchLink'),
  clearToken: document.getElementById('githubClearTokenButton')
};

let dbPromise = null;
let cachePromise = null;
let busy = false;
let lastResult = null;

function setStatus(text, tone = '') {
  if (!elements.status) return;
  elements.status.textContent = text;
  elements.status.dataset.tone = tone;
}

function setState(text, tone = '') {
  if (!elements.state) return;
  elements.state.textContent = text;
  elements.state.dataset.tone = tone;
}

function setBusy(value) {
  busy = value;
  for (const button of [elements.test, elements.push, elements.cleanup]) {
    if (button) button.disabled = value;
  }
}

function setProgress(value, max = 1) {
  if (!elements.progress) return;
  elements.progress.max = Math.max(1, max);
  elements.progress.value = Math.min(max, Math.max(0, value));
}

function repositoryName() {
  return (elements.repository?.value || DEFAULT_REPOSITORY).trim();
}

function branchName() {
  return (elements.branch?.value || DEFAULT_BRANCH).trim();
}

function baseBranchName() {
  return (elements.baseBranch?.value || DEFAULT_BASE_BRANCH).trim();
}

function tokenValue() {
  return (elements.token?.value || '').trim();
}

function assertRepository(value) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error('仓库名需要使用 owner/repository 格式');
  }
}

function assertBranch(value) {
  if (!value || value.startsWith('/') || value.endsWith('/') || value.includes('..') || /[~^:?*\[\\\s]/.test(value)) {
    throw new Error('临时分支名称无效');
  }
}

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

function openCache() {
  if (cachePromise) return cachePromise;
  cachePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'attachmentId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('RAW 预览缓存打开失败'));
  });
  return cachePromise;
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
      values.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      resolve(values);
    };
    request.onerror = () => reject(request.error || new Error('资料读取失败'));
  });
}

async function cacheGet(id) {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const request = db.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(id);
    request.onsuccess = () => resolve(request.result?.blob || null);
    request.onerror = () => reject(request.error || new Error('RAW 预览读取失败'));
  });
}

async function cachePut(id, blob) {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    tx.objectStore(CACHE_STORE).put({ attachmentId: id, blob, createdAt: new Date().toISOString() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('RAW 预览缓存失败'));
  });
}

function isRaw(record) {
  return RAW_RE.test(record.name || '');
}

function isImage(record) {
  return String(record.type || '').startsWith('image/') || IMAGE_RE.test(record.name || '');
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

async function previewBlob(record) {
  if (isImage(record)) return record.blob;
  if (!isRaw(record)) return null;
  const cached = await cacheGet(record.id);
  if (cached) return cached;
  const jpeg = await extractEmbeddedJpeg(record.blob);
  if (jpeg) await cachePut(record.id, jpeg);
  return jpeg;
}

async function sha256Hex(blob) {
  if (!crypto.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function decodeImage(blob) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      return createImageBitmap(blob);
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片解码失败'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('预览图编码失败')), type, quality);
  });
}

async function createProxy(record) {
  const source = await previewBlob(record);
  if (!source) return null;
  const image = await decodeImage(source);
  const sourceWidth = image.width || image.naturalWidth;
  const sourceHeight = image.height || image.naturalHeight;
  if (!sourceWidth || !sourceHeight) {
    image.close?.();
    throw new Error(`${record.name} 没有可用尺寸`);
  }
  const scale = Math.min(1, PROXY_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#d7d0c2';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  image.close?.();
  const blob = await canvasToBlob(canvas, 'image/jpeg', PROXY_JPEG_QUALITY);
  return {
    blob,
    width,
    height,
    sourceWidth,
    sourceHeight,
    proxySha256: await sha256Hex(blob)
  };
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function blobToBase64(blob) {
  return bufferToBase64(await blob.arrayBuffer());
}

function apiHeaders(token, extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
    ...extra
  };
}

function encodeRef(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function mockApi(path, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, 12));
  const method = options.method || 'GET';
  if (path.endsWith('/git/ref/heads/wall-evidence-inbox') && method === 'GET') {
    return { ref: 'refs/heads/wall-evidence-inbox', object: { sha: 'mock-parent-sha' } };
  }
  if (path.endsWith('/git/ref/heads/main') && method === 'GET') {
    return { ref: 'refs/heads/main', object: { sha: 'mock-main-sha' } };
  }
  if (path.includes('/git/commits/')) return { sha: 'mock-parent-sha', tree: { sha: 'mock-base-tree-sha' } };
  if (path.endsWith('/git/blobs') && method === 'POST') return { sha: `mock-blob-${Math.random().toString(16).slice(2)}` };
  if (path.endsWith('/git/trees') && method === 'POST') return { sha: 'mock-tree-sha' };
  if (path.endsWith('/git/commits') && method === 'POST') return { sha: 'mock-commit-sha' };
  if (path.includes('/git/refs/heads/') && (method === 'PATCH' || method === 'DELETE')) return null;
  if (path.endsWith('/git/refs') && method === 'POST') return { ref: 'refs/heads/wall-evidence-inbox', object: { sha: 'mock-main-sha' } };
  if (/\/repos\/[^/]+\/[^/]+$/.test(path)) return { full_name: repositoryName(), permissions: { push: true } };
  return {};
}

async function githubApi(path, options = {}) {
  const token = tokenValue();
  if (!token && !MOCK_MODE) throw new Error('请先粘贴 GitHub 细粒度令牌');
  if (MOCK_MODE) return mockApi(path, options);
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: apiHeaders(token, options.headers || {})
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = payload?.message || payload || `GitHub API ${response.status}`;
    throw new Error(String(message));
  }
  return payload;
}

async function verifyConnection() {
  const repo = repositoryName();
  assertRepository(repo);
  const payload = await githubApi(`/repos/${repo}`);
  if (payload?.permissions && payload.permissions.push === false) {
    throw new Error('当前令牌没有仓库写入权限');
  }
  return payload;
}

async function getRef(repo, branch) {
  try {
    return await githubApi(`/repos/${repo}/git/ref/heads/${encodeRef(branch)}`);
  } catch (error) {
    if (/404|not found/i.test(error.message)) return null;
    throw error;
  }
}

async function ensureBranch(repo, branch, baseBranch) {
  const current = await getRef(repo, branch);
  if (current) return current;
  const base = await githubApi(`/repos/${repo}/git/ref/heads/${encodeRef(baseBranch)}`);
  return githubApi(`/repos/${repo}/git/refs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha })
  });
}

function batchId() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-');
}

function safeOriginalName(name = '') {
  return String(name).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 240);
}

async function uploadBatch() {
  if (busy) return;
  const repo = repositoryName();
  const branch = branchName();
  const baseBranch = baseBranchName();
  assertRepository(repo);
  assertBranch(branch);
  assertBranch(baseBranch);
  setBusy(true);
  setState('准备上传', 'working');
  setStatus('正在读取墙面资料仓');
  setProgress(0, 1);
  try {
    await verifyConnection();
    const all = await listRecords();
    const candidates = all.filter((record) => isImage(record) || isRaw(record));
    if (!candidates.length) throw new Error('资料仓里还没有可上传的图片或 RAW 预览');

    const batch = batchId();
    const proxies = [];
    const skipped = [];
    setProgress(0, candidates.length + 6);
    for (let index = 0; index < candidates.length; index += 1) {
      const record = candidates[index];
      setStatus(`生成去 EXIF 预览 ${index + 1}/${candidates.length}：${record.name}`);
      try {
        const proxy = await createProxy(record);
        if (!proxy) {
          skipped.push({ id: record.id, name: record.name, reason: 'no-preview' });
        } else {
          proxies.push({ record, proxy, index: index + 1 });
        }
      } catch (error) {
        skipped.push({ id: record.id, name: record.name, reason: error.message || String(error) });
      }
      setProgress(index + 1, candidates.length + 6);
    }
    if (!proxies.length) throw new Error('没有生成任何可推送的 JPEG 预览');

    setStatus(`准备临时分支 ${branch}`);
    const ref = await ensureBranch(repo, branch, baseBranch);
    const parentSha = ref.object.sha;
    const commit = await githubApi(`/repos/${repo}/git/commits/${parentSha}`);
    setProgress(candidates.length + 1, candidates.length + 6);

    const entries = [];
    const manifestItems = [];
    for (let index = 0; index < proxies.length; index += 1) {
      const item = proxies[index];
      setStatus(`推送预览 ${index + 1}/${proxies.length}：${item.record.name}`);
      const blobPayload = await githubApi(`/repos/${repo}/git/blobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: await blobToBase64(item.proxy.blob), encoding: 'base64' })
      });
      const filename = `${String(index + 1).padStart(3, '0')}-${(item.record.sha256 || item.proxy.proxySha256 || 'nohash').slice(0, 12)}.jpg`;
      const path = `wall-evidence-inbox/batches/${batch}/images/${filename}`;
      entries.push({ path, mode: '100644', type: 'blob', sha: blobPayload.sha });
      manifestItems.push({
        attachmentId: item.record.id,
        originalName: safeOriginalName(item.record.name),
        originalMime: item.record.type || 'application/octet-stream',
        originalBytes: item.record.size || item.record.blob?.size || null,
        originalSha256: item.record.sha256 || null,
        originalCreatedAt: item.record.createdAt || null,
        rawSource: isRaw(item.record),
        proxyPath: path,
        proxyBytes: item.proxy.blob.size,
        proxySha256: item.proxy.proxySha256,
        proxyWidth: item.proxy.width,
        proxyHeight: item.proxy.height,
        sourceWidth: item.proxy.sourceWidth,
        sourceHeight: item.proxy.sourceHeight
      });
      setProgress(candidates.length + 1 + ((index + 1) / proxies.length) * 2, candidates.length + 6);
    }

    const manifest = {
      schemaVersion: '1.0.0',
      batchId: batch,
      moduleId: MODULE_ID,
      generatedAt: new Date().toISOString(),
      repository: repo,
      branch,
      uploadMode: 'public-temporary-branch-exif-stripped-jpeg-proxies',
      privacy: {
        originalFilesUploaded: false,
        exifPreserved: false,
        maxDimension: PROXY_MAX_DIMENSION,
        jpegQuality: PROXY_JPEG_QUALITY,
        warning: 'Deleting the branch removes the normal branch reference, but public Git objects can remain retrievable by known commit SHA until GitHub garbage collection.'
      },
      counts: {
        sourceCandidates: candidates.length,
        uploadedProxies: manifestItems.length,
        skipped: skipped.length
      },
      files: manifestItems,
      skipped
    };
    const manifestPath = `wall-evidence-inbox/batches/${batch}/manifest.json`;
    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const manifestGitBlob = await githubApi(`/repos/${repo}/git/blobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: await blobToBase64(manifestBlob), encoding: 'base64' })
    });
    entries.push({ path: manifestPath, mode: '100644', type: 'blob', sha: manifestGitBlob.sha });

    const latestBlob = new Blob([JSON.stringify({
      schemaVersion: '1.0.0',
      batchId: batch,
      generatedAt: manifest.generatedAt,
      manifestPath,
      uploadedProxies: manifestItems.length
    }, null, 2)], { type: 'application/json' });
    const latestGitBlob = await githubApi(`/repos/${repo}/git/blobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: await blobToBase64(latestBlob), encoding: 'base64' })
    });
    entries.push({ path: 'wall-evidence-inbox/latest.json', mode: '100644', type: 'blob', sha: latestGitBlob.sha });
    setProgress(candidates.length + 4, candidates.length + 6);

    const tree = await githubApi(`/repos/${repo}/git/trees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: commit.tree.sha, tree: entries })
    });
    const newCommit = await githubApi(`/repos/${repo}/git/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Temporary wall evidence proxy batch ${batch}`,
        tree: tree.sha,
        parents: [parentSha]
      })
    });
    await githubApi(`/repos/${repo}/git/refs/heads/${encodeRef(branch)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommit.sha, force: false })
    });
    setProgress(candidates.length + 6, candidates.length + 6);

    lastResult = {
      batchId: batch,
      repository: repo,
      branch,
      commitSha: newCommit.sha,
      uploadedCount: manifestItems.length,
      skippedCount: skipped.length,
      manifestPath,
      mock: MOCK_MODE
    };
    if (elements.branchLink) {
      elements.branchLink.href = `https://github.com/${repo}/tree/${encodeURIComponent(branch)}/wall-evidence-inbox/batches/${batch}`;
      elements.branchLink.hidden = MOCK_MODE;
    }
    setState('推送完成', 'success');
    setStatus(`已推送 ${manifestItems.length} 张去 EXIF 预览。批次 ${batch}${skipped.length ? `，跳过 ${skipped.length} 份` : ''}`);
    if (elements.token) elements.token.value = '';
    window.dispatchEvent(new CustomEvent('yunnan-wall-evidence-pushed', { detail: lastResult }));
  } catch (error) {
    console.error(error);
    setState('推送失败', 'error');
    setStatus(error.message || String(error), 'error');
    throw error;
  } finally {
    setBusy(false);
  }
}

async function testConnection() {
  if (busy) return;
  setBusy(true);
  setState('测试连接', 'working');
  setStatus('正在验证 GitHub 仓库写入权限');
  try {
    const payload = await verifyConnection();
    setState('连接可用', 'success');
    setStatus(`已连接 ${payload.full_name || repositoryName()}，可开始推送压缩预览`);
  } catch (error) {
    setState('连接失败', 'error');
    setStatus(error.message || String(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function cleanupBranch() {
  if (busy) return;
  const repo = repositoryName();
  const branch = branchName();
  assertRepository(repo);
  assertBranch(branch);
  if (!MOCK_MODE && !confirm(`删除临时分支 ${repo}:${branch} 吗？这会移除全部已推送的墙面预览批次。`)) return;
  setBusy(true);
  setState('正在清理', 'working');
  setStatus(`正在删除临时分支 ${branch}`);
  try {
    await githubApi(`/repos/${repo}/git/refs/heads/${encodeRef(branch)}`, { method: 'DELETE' });
    lastResult = null;
    if (elements.branchLink) elements.branchLink.hidden = true;
    setState('已清理', 'success');
    setStatus('GitHub 临时资料分支已删除。本机原始资料仍然保留。');
    if (elements.token) elements.token.value = '';
  } catch (error) {
    setState('清理失败', 'error');
    setStatus(error.message || String(error), 'error');
  } finally {
    setBusy(false);
  }
}

function init() {
  if (!elements.push || !elements.token) return;
  elements.repository.value = localStorage.getItem('yunnan-wall-github-repository') || DEFAULT_REPOSITORY;
  elements.branch.value = localStorage.getItem('yunnan-wall-github-branch') || DEFAULT_BRANCH;
  elements.baseBranch.value = localStorage.getItem('yunnan-wall-github-base-branch') || DEFAULT_BASE_BRANCH;
  for (const [element, key] of [
    [elements.repository, 'yunnan-wall-github-repository'],
    [elements.branch, 'yunnan-wall-github-branch'],
    [elements.baseBranch, 'yunnan-wall-github-base-branch']
  ]) {
    element.addEventListener('change', () => localStorage.setItem(key, element.value.trim()));
  }
  elements.test.onclick = testConnection;
  elements.push.onclick = () => uploadBatch().catch(() => {});
  elements.cleanup.onclick = cleanupBranch;
  elements.clearToken.onclick = () => {
    elements.token.value = '';
    setState('令牌已清空');
    setStatus('令牌仅存在于当前输入框，从未写入浏览器存储。');
  };
  if (MOCK_MODE) elements.token.value = 'mock-token';
  setProgress(0, 1);
  setState(MOCK_MODE ? '模拟桥已准备' : '等待一次性授权');
  setStatus('只推送最大 2048 像素、去 EXIF 的 JPEG 预览。原图与 RAW 留在本机。');
  window.__YUNNAN_WALL_GITHUB_BRIDGE__ = {
    version: '2.5.0',
    mode: 'temporary-branch-exif-stripped-proxies',
    mock: MOCK_MODE,
    get busy() { return busy; },
    get lastResult() { return lastResult; },
    push: uploadBatch,
    test: testConnection,
    cleanup: cleanupBranch
  };
}

init();
