const DELIVERY_VERSION = '2.6.0';
const STORE_NAME = 'attachments';
const CACHE_STORE = 'previews';
const MODULE_ID = 'walls';
const RAW_RE = /\.(nef|nrw|cr2|cr3|arw|dng|raf|rw2|orf|pef)$/i;
const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.86;

const ui = {
  token: document.getElementById('githubToken'),
  test: document.getElementById('githubTestButton'),
  push: document.getElementById('githubPushButton'),
  export: document.getElementById('githubExportButton'),
  tokenCreate: document.getElementById('githubTokenCreateLink'),
  status: document.getElementById('githubBridgeStatus'),
  state: document.getElementById('githubBridgeState'),
  progress: document.getElementById('githubProgress'),
  exportHint: document.getElementById('githubExportHint')
};

let exportBusy = false;

function setStatus(text, tone = '') {
  if (ui.status) {
    ui.status.textContent = text;
    ui.status.dataset.tone = tone;
  }
}

function setState(text, tone = '') {
  if (ui.state) {
    ui.state.textContent = text;
    ui.state.dataset.tone = tone;
  }
}

function setProgress(value, max = 1) {
  if (!ui.progress) return;
  ui.progress.max = Math.max(1, max);
  ui.progress.value = Math.max(0, Math.min(value, max));
}

function openDb() {
  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
  if (!storage) return Promise.reject(new Error('资料库迁移程序未载入'));
  return storage.openAttachments();
}

function openCache() {
  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
  if (!storage) return Promise.reject(new Error('RAW 预览缓存迁移程序未载入'));
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
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
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
  const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
  return {
    blob,
    width,
    height,
    sourceWidth,
    sourceHeight,
    sha256: await sha256Hex(blob)
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

async function makeZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const stamp = dosDateTime();

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = new Uint8Array(await entry.blob.arrayBuffer());
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, stamp.time);
    writeUint16(localView, 12, stamp.day);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, stamp.time);
    writeUint16(centralView, 14, stamp.day);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, localOffset);
  writeUint16(endView, 20, 0);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function compactTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-');
}

async function exportEvidenceBundle() {
  if (exportBusy) return;
  exportBusy = true;
  if (ui.export) ui.export.disabled = true;
  setState('正在打包', 'working');
  setStatus('正在读取资料并生成去 EXIF 预览');
  setProgress(0, 1);
  try {
    const records = await listRecords();
    const candidates = records.filter((record) => isImage(record) || isRaw(record));
    if (!candidates.length) throw new Error('资料仓里还没有可打包的照片或 RAW 预览');

    const zipEntries = [];
    const files = [];
    const skipped = [];
    setProgress(0, candidates.length + 2);
    for (let index = 0; index < candidates.length; index += 1) {
      const record = candidates[index];
      setStatus(`生成资料包 ${index + 1}/${candidates.length}：${record.name}`);
      try {
        const proxy = await createProxy(record);
        if (!proxy) {
          skipped.push({ name: record.name, reason: 'no-preview' });
        } else {
          const filename = `${String(files.length + 1).padStart(3, '0')}-${(record.sha256 || proxy.sha256 || 'nohash').slice(0, 12)}.jpg`;
          const path = `images/${filename}`;
          zipEntries.push({ name: path, blob: proxy.blob });
          files.push({
            attachmentId: record.id,
            originalName: record.name,
            originalMime: record.type || 'application/octet-stream',
            originalBytes: record.size || record.blob?.size || null,
            originalSha256: record.sha256 || null,
            rawSource: isRaw(record),
            proxyPath: path,
            proxyBytes: proxy.blob.size,
            proxySha256: proxy.sha256,
            proxyWidth: proxy.width,
            proxyHeight: proxy.height,
            sourceWidth: proxy.sourceWidth,
            sourceHeight: proxy.sourceHeight
          });
        }
      } catch (error) {
        skipped.push({ name: record.name, reason: error.message || String(error) });
      }
      setProgress(index + 1, candidates.length + 2);
    }
    if (!files.length) throw new Error('没有生成可交付的图片预览');

    const packageId = compactTimestamp();
    const manifest = {
      schemaVersion: '1.0.0',
      packageId,
      generatedAt: new Date().toISOString(),
      generator: `Yunnan Wall Studio ${DELIVERY_VERSION}`,
      moduleId: MODULE_ID,
      transferMode: 'browser-downloaded-exif-stripped-jpeg-proxies',
      instructions: 'Upload this ZIP once in the current ChatGPT conversation for Xiao Li to ingest and distill.',
      privacy: {
        originalFilesIncluded: false,
        exifPreserved: false,
        maxDimension: MAX_DIMENSION,
        jpegQuality: JPEG_QUALITY
      },
      counts: {
        sourceCandidates: candidates.length,
        packagedProxies: files.length,
        skipped: skipped.length
      },
      files,
      skipped
    };
    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const readme = [
      '云南墙体资料临时交付包',
      '',
      `包编号：${packageId}`,
      `预览图：${files.length} 张`,
      `跳过：${skipped.length} 份`,
      '',
      '本包只含最大 2048 像素、去 EXIF 的 JPEG 预览和 manifest.json。',
      '把整个 ZIP 上传到与小李协作的当前聊天即可。知识蒸馏完成后可以删除本包。'
    ].join('\n');
    zipEntries.unshift(
      { name: 'manifest.json', blob: manifestBlob },
      { name: 'README.txt', blob: new Blob([readme], { type: 'text/plain;charset=utf-8' }) }
    );
    setStatus('正在写入 ZIP 资料包');
    setProgress(candidates.length + 1, candidates.length + 2);
    const zip = await makeZip(zipEntries);
    const filename = `yunnan-wall-evidence-${packageId}.zip`;
    downloadBlob(zip, filename);
    setProgress(candidates.length + 2, candidates.length + 2);
    setState('资料包已下载', 'success');
    setStatus(`已生成 ${files.length} 张预览的资料包。把 ${filename} 整体拖入当前聊天即可。`, 'success');
    if (ui.exportHint) ui.exportHint.textContent = `已下载 ${filename}`;
    window.__YUNNAN_WALL_EVIDENCE_BUNDLE__.lastResult = {
      packageId,
      filename,
      packagedCount: files.length,
      skippedCount: skipped.length,
      bytes: zip.size
    };
  } catch (error) {
    console.error(error);
    setState('打包失败', 'error');
    setStatus(error.message || String(error), 'error');
  } finally {
    exportBusy = false;
    if (ui.export) ui.export.disabled = false;
  }
}

function tokenIsPresent() {
  return Boolean(ui.token?.value.trim());
}

function showAuthorizationChoice() {
  setState('尚未授权', 'working');
  setStatus('GitHub 自动推送需要一次性令牌。先点“创建临时令牌”，或直接点“无需令牌：下载整批资料包”。');
  ui.tokenCreate?.classList.add('attention');
  ui.export?.classList.add('attention');
  setTimeout(() => {
    ui.tokenCreate?.classList.remove('attention');
    ui.export?.classList.remove('attention');
  }, 1800);
}

function wrapTokenRequiredAction(button) {
  if (!button) return;
  const original = button.onclick;
  button.onclick = (event) => {
    if (!tokenIsPresent()) {
      event?.preventDefault?.();
      showAuthorizationChoice();
      return;
    }
    return original?.call(button, event);
  };
}

function init() {
  wrapTokenRequiredAction(ui.test);
  wrapTokenRequiredAction(ui.push);
  ui.export?.addEventListener('click', exportEvidenceBundle);
  ui.tokenCreate?.addEventListener('click', () => {
    setState('等待创建令牌', 'working');
    setStatus('GitHub 会打开已经预填“Contents: write”和 7 天有效期的官方页面。创建后只复制 github_pat_ 开头的字符串。');
  });
  if (!tokenIsPresent()) {
    setState('可直接下载资料包');
    setStatus('无需令牌也能继续。点击“下载整批资料包”，再把 ZIP 一次上传到当前聊天。');
  }
  window.__YUNNAN_WALL_EVIDENCE_BUNDLE__ = {
    version: DELIVERY_VERSION,
    mode: 'token-assisted-github-or-tokenless-zip',
    lastResult: null,
    export: exportEvidenceBundle,
    makeZip
  };
}

init();
