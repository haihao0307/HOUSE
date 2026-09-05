const CONFIG_URL = './data/modules.json';
const WORKSPACE_KEY = 'yunnan-component-studio:v1:workspace';
const MODULE_KEY_PREFIX = 'yunnan-component-studio:v1:module:';
const CHANNEL_NAME = 'yunnan-component-studio:v1';
const ISSUE_BASE = 'https://github.com/haihao0307/HOUSE/issues/new';

const app = document.querySelector('#app');
const hubTemplate = document.querySelector('#hubTemplate');
const moduleTemplate = document.querySelector('#moduleTemplate');
const jsonImportInput = document.querySelector('#jsonImportInput');
const toastRegion = document.querySelector('#toastRegion');
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

let config = null;
let activeModule = null;
let activeState = null;
let saveTimer = null;

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function uid(prefix = 'id') {
  if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() { return new Date().toISOString(); }

function formatDate(value, compact = false) {
  if (!value) return '尚未保存';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', compact
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
  ).format(date);
}

function formatBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function statusRecord(statusId) {
  return config.statuses.find((item) => item.id === statusId) || config.statuses[0];
}

function statusRank(statusId) {
  return Math.max(0, config.statuses.findIndex((item) => item.id === statusId));
}

function getWorkspaceState() {
  const stored = safeParse(localStorage.getItem(WORKSPACE_KEY), null);
  return {
    buildingId: stored?.buildingId || config.defaultBuilding.buildingId,
    typology: stored?.typology || config.defaultBuilding.typology,
    period: stored?.period || config.defaultBuilding.period,
    assemblyVersion: stored?.assemblyVersion || '0.1.0',
    updatedAt: stored?.updatedAt || null
  };
}

function saveWorkspaceState(next, broadcast = true) {
  const state = { ...next, updatedAt: nowIso() };
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
  if (broadcast) channel?.postMessage({ type: 'workspace-updated', state });
  return state;
}

function defaultModuleState(module) {
  return {
    schemaVersion: '1.0.0',
    workspaceId: config.workspaceId,
    moduleId: module.id,
    status: 'draft',
    version: '0.1.0',
    assemblyCandidate: false,
    requirements: '',
    decisions: '',
    forbidden: '',
    questions: '',
    notes: '',
    tasks: module.starterTasks.map((text) => ({ id: uid('task'), text, done: false })),
    activity: [{ id: uid('log'), time: nowIso(), message: '工作室已建立' }],
    snapshots: [],
    createdAt: nowIso(),
    updatedAt: null
  };
}

function getModuleState(module) {
  const stored = safeParse(localStorage.getItem(`${MODULE_KEY_PREFIX}${module.id}`), null);
  if (!stored || stored.moduleId !== module.id) return defaultModuleState(module);
  return {
    ...defaultModuleState(module),
    ...stored,
    tasks: Array.isArray(stored.tasks) ? stored.tasks : defaultModuleState(module).tasks,
    activity: Array.isArray(stored.activity) ? stored.activity : [],
    snapshots: Array.isArray(stored.snapshots) ? stored.snapshots : []
  };
}

function pushActivity(state, message) {
  const activity = [{ id: uid('log'), time: nowIso(), message }, ...(state.activity || [])].slice(0, 80);
  return { ...state, activity };
}

function saveModuleState(module, state, { logMessage = null, broadcast = true } = {}) {
  let next = { ...state, moduleId: module.id, updatedAt: nowIso() };
  if (logMessage) next = pushActivity(next, logMessage);
  localStorage.setItem(`${MODULE_KEY_PREFIX}${module.id}`, JSON.stringify(next));
  activeState = next;
  if (broadcast) channel?.postMessage({ type: 'module-updated', moduleId: module.id, updatedAt: next.updatedAt });
  return next;
}

function debounceSaveModule(module, stateFactory) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    activeState = saveModuleState(module, stateFactory(), { broadcast: true });
    updateModuleHeaderFields();
    renderReleaseGates();
  }, 260);
}

function showToast(message, tone = 'normal') {
  const item = document.createElement('div');
  item.className = `toast${tone === 'error' ? ' error' : ''}`;
  item.textContent = message;
  toastRegion.append(item);
  window.setTimeout(() => item.remove(), 3600);
}

window.addEventListener('yunnan-component-studio-storage', (event) => {
  const detail = event.detail || {};
  if (detail.database !== 'YunnanComponentStudio') return;
  if (detail.state === 'blocked') {
    showToast('资料库升级正在等待其他 HOUSE 页面关闭，请关闭旧页面后再试', 'error');
  } else if (detail.state === 'versionchange') {
    showToast('资料库已经升级，请重新载入这个页面', 'error');
  }
});

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function openAttachmentDb() {
  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
  if (!storage) return Promise.reject(new Error('组件资料库迁移程序未载入'));
  return storage.openAttachments();
}

async function dbTransaction(mode, callback) {
  const db = await openAttachmentDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('attachments', mode);
    const store = tx.objectStore('attachments');
    let result;
    try { result = callback(store, tx); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

async function sha256Hex(buffer) {
  if (!crypto?.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function addAttachment(moduleId, file) {
  const arrayBuffer = await file.arrayBuffer();
  const record = {
    id: uid('attachment'),
    moduleId,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    lastModified: file.lastModified || Date.now(),
    createdAt: nowIso(),
    sha256: await sha256Hex(arrayBuffer),
    blob: new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' })
  };
  await dbTransaction('readwrite', (store) => store.put(record));
  return record;
}

async function listAttachments(moduleId) {
  const db = await openAttachmentDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('attachments', 'readonly');
    const index = tx.objectStore('attachments').index('moduleId');
    const request = index.getAll(IDBKeyRange.only(moduleId));
    request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

async function getAttachment(id) {
  const db = await openAttachmentDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction('attachments', 'readonly').objectStore('attachments').get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteAttachment(id) {
  await dbTransaction('readwrite', (store) => store.delete(id));
}

async function attachmentMetadata(moduleId) {
  const items = await listAttachments(moduleId);
  return items.map(({ blob, ...metadata }) => metadata);
}
