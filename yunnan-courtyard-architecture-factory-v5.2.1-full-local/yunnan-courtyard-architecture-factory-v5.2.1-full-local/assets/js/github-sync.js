(function (global) {
  'use strict';

  // GitHub Pages is intentionally read-only.  This module makes the public
  // production line pull its source-of-truth metadata from the repository and
  // gives the browser a safe, auditable path to send observations back as
  // GitHub Issues.  No token is embedded in the site or written to storage.
  var CONFIG = {
    owner: 'haihao0307',
    repo: 'HOUSE',
    branch: 'main',
    ref: 'main',
    headSha: null,
    deploymentSource: 'default-main',
    pagesUrl: 'https://haihao0307.github.io/HOUSE/',
    sourceRoot: 'yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local',
    dataFiles: [
      { id: 'system', label: '母系统数据', path: 'data/system_v5_2_1.json', required: true },
      { id: 'production', label: 'Three.js 生产合同', path: 'data/production/yunnan_threejs_production_system_v5_4_0.json', required: true },
      { id: 'surface-v550', label: 'V5.5.0 表面生产种子', path: 'data/production/yunnan_surface_weathering_seed_v5_5_0.json', required: true },
      { id: 'evidence', label: '团结乡材料证据', path: 'data/evidence/tuanjie_township_001_material_weathering_reference_v5_3_6.json', required: true }
    ]
  };
  var STORAGE_KEY = 'yunnan-production-web-sync-v1';
  var entries = readEntries();
  var remote = {
    files: [], commit: null, issues: [], checkedAt: null, error: null,
    refreshState: 'idle', refreshGeneration: 0, requests: [], requestHistory: [],
    optionalDiagnostics: [], deploymentError: null
  };
  var overlay;
  var refs = {};
  var deploymentReady = Promise.resolve();
  var refreshPromise = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function repoUrl(path) {
    return 'https://github.com/' + CONFIG.owner + '/' + CONFIG.repo + '/blob/' + CONFIG.ref + '/' + path;
  }
  function rawUrl(path) {
    return 'https://raw.githubusercontent.com/' + CONFIG.owner + '/' + CONFIG.repo + '/' + CONFIG.ref + '/' + path;
  }
  function apiUrl(path) {
    return 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + path;
  }
  function validRef(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 160 &&
      !value.startsWith('/') && !value.endsWith('/') && !value.includes('..') &&
      /^[0-9A-Za-z._/-]+$/.test(value);
  }
  function applyDeployment(metadata, source) {
    var sha = metadata && typeof metadata.sha === 'string' ? metadata.sha.trim() : '';
    var branch = metadata && typeof (metadata.ref || metadata.branch) === 'string' ? String(metadata.ref || metadata.branch).trim() : '';
    if (sha && !/^[0-9a-f]{40}$/i.test(sha)) throw new Error('build.json sha is not a full commit SHA');
    if (branch && !validRef(branch)) throw new Error('build.json ref is invalid');
    if (!sha && !branch) throw new Error('deployment metadata has neither sha nor ref');
    CONFIG.branch = branch || CONFIG.branch;
    CONFIG.headSha = sha || null;
    CONFIG.ref = sha || branch;
    CONFIG.deploymentSource = source;
  }
  function resolveDeployment() {
    var injected = global.__GITHUB_SYNC_DEPLOYMENT__;
    if (injected) {
      try {
        applyDeployment(injected, 'runtime-injected');
      } catch (error) {
        remote.deploymentError = error.message;
      }
      return Promise.resolve();
    }
    var pagesHost = new URL(CONFIG.pagesUrl).hostname;
    if (global.location.hostname !== pagesHost) return Promise.resolve();
    var buildUrl = new URL('build.json', CONFIG.pagesUrl).href;
    return fetch(buildUrl, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('build.json HTTP ' + response.status);
      return response.json();
    }).then(function (metadata) {
      applyDeployment(metadata, 'pages-build-json');
    }).catch(function (error) {
      remote.deploymentError = error.message;
    });
  }
  function requestJson(spec) {
    var record = {
      id: spec.id,
      url: spec.url,
      required: spec.required !== false,
      allowedStatuses: (spec.allowedStatuses || []).slice(),
      optionalReason: spec.optionalReason || null,
      generation: remote.refreshGeneration,
      status: null,
      outcome: 'pending',
      error: null
    };
    remote.requests.push(record);
    remote.requestHistory.push(record);
    if (remote.requestHistory.length > 100) remote.requestHistory.shift();
    return fetch(spec.url, spec.options || {}).then(function (response) {
      record.status = response.status;
      if (!response.ok) {
        record.outcome = !record.required && record.allowedStatuses.includes(response.status) ? 'allowed-optional-http' : 'failed-http';
        throw new Error(spec.id + ' HTTP ' + response.status);
      }
      return response.json().then(function (payload) {
        record.outcome = 'fulfilled';
        return payload;
      });
    }).catch(function (error) {
      record.error = error.message || String(error);
      if (record.outcome === 'allowed-optional-http') {
        remote.optionalDiagnostics.push({ id: record.id, status: record.status, url: record.url, reason: record.optionalReason });
        return null;
      }
      if (record.outcome === 'pending') record.outcome = 'failed-request';
      throw error;
    });
  }
  function readEntries() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(-100) : [];
    } catch (_) { return []; }
  }
  function saveEntries() {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-100))); } catch (_) {}
  }
  function context() {
    try {
      if (typeof global.__PRODUCTION_CONTEXT__ === 'function') return global.__PRODUCTION_CONTEXT__();
    } catch (_) {}
    return { view: document.querySelector('.tab.active')?.dataset.view || null };
  }
  function nowId() {
    return 'WEB-' + new Date().toISOString().replace(/[-:.TZ]/g, '') + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  }
  function ensureStyles() {
    if (document.getElementById('githubSyncStyles')) return;
    var style = document.createElement('style');
    style.id = 'githubSyncStyles';
    style.textContent = [
      '.githubSyncLauncher{cursor:pointer;background:transparent;font:inherit}',
      '#githubSyncOverlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:#06100ccc;color:#eff5ef}',
      '#githubSyncOverlay[hidden]{display:none}',
      '.githubSyncPanel{width:min(920px,96vw);max-height:min(900px,94vh);overflow:auto;border:1px solid #596e62;border-radius:14px;background:#101b17;box-shadow:0 24px 90px #000b;padding:18px}',
      '.githubSyncHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid #2e4036;padding-bottom:12px}',
      '.githubSyncHead h2{margin:0;color:#efcc91;font-size:18px}.githubSyncHead p{margin:5px 0 0;color:#aebdb2;font-size:11px;line-height:1.6}',
      '.githubSyncClose{border:1px solid #596e62;border-radius:6px;background:#17251e;color:#dce7de;padding:7px 10px;cursor:pointer}',
      '.githubSyncGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px}',
      '.githubSyncCard{border:1px solid #2e4036;border-radius:9px;background:#14221c;padding:12px}',
      '.githubSyncCard h3{margin:0 0 8px;color:#d6b982;font-size:12px}.githubSyncCard p,.githubSyncCard li{color:#bcc9bf;font-size:10px;line-height:1.65}.githubSyncCard ul{margin:0;padding-left:16px}',
      '.githubSyncStatus{display:flex;align-items:center;gap:7px;color:#a8d0b5;font-size:11px}.githubSyncDot{width:8px;height:8px;border-radius:50%;background:#7bc69a;box-shadow:0 0 10px #7bc69a}.githubSyncDot.warn{background:#d39a5e;box-shadow:0 0 10px #d39a5e}',
      '.githubSyncForm{display:grid;gap:8px}.githubSyncForm label{display:grid;gap:4px;color:#b7c5bb;font-size:10px}.githubSyncForm input,.githubSyncForm select,.githubSyncForm textarea{box-sizing:border-box;width:100%;border:1px solid #4a5d51;border-radius:5px;background:#0c1511;color:#eef6ef;padding:8px;font:inherit;font-size:11px}.githubSyncForm textarea{min-height:86px;resize:vertical}',
      '.githubSyncActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:2px}.githubSyncActions button{border:1px solid #977044;border-radius:6px;background:#3b2b18;color:#f4dba8;padding:8px 10px;font-size:10px;cursor:pointer}.githubSyncActions button.secondary{border-color:#4a5d51;background:#17251e;color:#d6e2d8}',
      '.githubSyncHint{margin:4px 0 0;color:#8fa397;font-size:9px;line-height:1.6}.githubSyncMessage{min-height:17px;color:#e2c589;font-size:10px}',
      '.githubSyncList{display:grid;gap:6px;max-height:250px;overflow:auto}.githubSyncItem{border:1px solid #30453a;border-radius:6px;background:#0e1813;padding:8px}.githubSyncItem b{display:block;color:#d8c08d;font-size:10px}.githubSyncItem small{display:block;color:#8fa397;font-size:9px;line-height:1.5;margin-top:3px}.githubSyncItem p{margin:4px 0 0;color:#c4d0c6;font-size:10px;white-space:pre-wrap;word-break:break-word}',
      '@media(max-width:700px){.githubSyncGrid{grid-template-columns:1fr}.githubSyncPanel{padding:12px}}'
    ].join('');
    document.head.appendChild(style);
  }
  function createLauncher() {
    var host = document.querySelector('.badges');
    if (!host || document.getElementById('githubSyncLauncher')) return;
    var button = document.createElement('button');
    button.id = 'githubSyncLauncher';
    button.className = 'badge warn githubSyncLauncher';
    button.type = 'button';
    button.textContent = 'GitHub同步准备中';
    button.title = '打开 GitHub 同步中枢';
    button.addEventListener('click', open);
    host.appendChild(button);
  }
  function createPanel() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'githubSyncOverlay';
    overlay.hidden = true;
    overlay.innerHTML = '<section class="githubSyncPanel" role="dialog" aria-modal="true" aria-labelledby="githubSyncTitle">' +
      '<div class="githubSyncHead"><div><h2 id="githubSyncTitle">GitHub 同步中枢</h2><p>网页端自动读取仓库的生产合同和证据版本；命令、复核意见和现场记录可整理后回传到 GitHub。</p></div><button class="githubSyncClose" id="githubSyncClose" type="button">关闭</button></div>' +
      '<div class="githubSyncGrid">' +
      '<div class="githubSyncCard"><h3>仓库连接</h3><div class="githubSyncStatus"><i class="githubSyncDot warn" id="githubSyncDot"></i><span id="githubSyncStatus">正在连接 GitHub…</span></div><p id="githubSyncCommit">尚未读取最新提交。</p><p><a id="githubSyncRepoLink" href="https://github.com/haihao0307/HOUSE" target="_blank" rel="noopener" style="color:#e5c98f">打开公开仓库</a> · <a href="https://haihao0307.github.io/HOUSE/" target="_blank" rel="noopener" style="color:#e5c98f">打开公开生产线</a></p></div>' +
      '<div class="githubSyncCard"><h3>已读取的生产资料</h3><ul id="githubSyncFiles"><li>等待读取…</li></ul><p class="githubSyncHint">读取使用公开仓库内容，不需要令牌；当前页面不会把 GitHub 令牌写入 localStorage、导出文件或提交内容。</p></div>' +
      '</div>' +
      '<div class="githubSyncGrid">' +
      '<div class="githubSyncCard"><h3>记录网页命令 / 现场信息</h3><div class="githubSyncForm"><label>记录类型<select id="githubSyncType"><option value="command">生产线命令</option><option value="observation">现场观察</option><option value="correction">纠错复核</option><option value="evidence">新增证据</option></select></label><label>关联对象<input id="githubSyncBuilding" value="YUNNAN-COURTYARD-SYSTEM" placeholder="例如 YN_TUANJIE_001 / YKY-T07"></label><label>内容<textarea id="githubSyncText" placeholder="写下要同步给生产线的命令、尺寸、照片结论或待核问题…"></textarea></label><div class="githubSyncActions"><button id="githubSyncAdd" type="button">加入本地队列</button><button id="githubSyncExport" class="secondary" type="button">导出同步 JSON</button></div><p class="githubSyncHint">本地队列保存在当前浏览器，最多保留 100 条；导出 JSON 可作为可审计的资料包交给下一次生产线更新。</p></div></div>' +
      '<div class="githubSyncCard"><h3>回传 GitHub（可选）</h3><div class="githubSyncForm"><label>Fine-grained token（本次页面会话使用，不保存）<input id="githubSyncToken" type="password" autocomplete="off" placeholder="需要对仓库 Issues 有写权限"></label><div class="githubSyncActions"><button id="githubSyncPush" type="button">把最新记录提交为 GitHub Issue</button><button id="githubSyncRefresh" class="secondary" type="button">刷新 GitHub</button></div><p class="githubSyncHint">GitHub Pages 本身不能安全地把写入令牌放进前端。只有你主动填写令牌并点击提交时，浏览器才会调用 GitHub Issues API；令牌只留在内存中，刷新页面即消失。</p><div class="githubSyncMessage" id="githubSyncMessage"></div></div></div>' +
      '</div>' +
      '<div class="githubSyncGrid"><div class="githubSyncCard"><h3>待同步本地记录</h3><div class="githubSyncList" id="githubSyncQueue"></div></div><div class="githubSyncCard"><h3>GitHub 上的同步记录</h3><div class="githubSyncList" id="githubSyncRemote"></div></div></div>' +
      '</section>';
    document.body.appendChild(overlay);
    refs = {
      launcher: document.getElementById('githubSyncLauncher'), dot: document.getElementById('githubSyncDot'), status: document.getElementById('githubSyncStatus'), commit: document.getElementById('githubSyncCommit'), files: document.getElementById('githubSyncFiles'), queue: document.getElementById('githubSyncQueue'), remote: document.getElementById('githubSyncRemote'), message: document.getElementById('githubSyncMessage'), type: document.getElementById('githubSyncType'), building: document.getElementById('githubSyncBuilding'), text: document.getElementById('githubSyncText'), token: document.getElementById('githubSyncToken')
    };
    document.getElementById('githubSyncClose').addEventListener('click', close);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    document.getElementById('githubSyncAdd').addEventListener('click', addFromForm);
    document.getElementById('githubSyncExport').addEventListener('click', exportBundle);
    document.getElementById('githubSyncPush').addEventListener('click', pushLatest);
    document.getElementById('githubSyncRefresh').addEventListener('click', function () { refresh(true); });
    renderQueue(); renderRemote();
  }
  function open() { createPanel(); overlay.hidden = false; refresh(false); }
  function close() { if (overlay) overlay.hidden = true; }
  function setMessage(text, error) { if (refs.message) { refs.message.textContent = text || ''; refs.message.style.color = error ? '#e2a394' : '#e2c589'; } }
  function renderQueue() {
    if (!refs.queue) return;
    if (!entries.length) { refs.queue.innerHTML = '<p class="githubSyncHint">暂无本地记录。先在上方写一条命令或观察。</p>'; return; }
    refs.queue.innerHTML = entries.slice().reverse().map(function (item) {
      var state = item.issueUrl ? '已回传' : '待回传';
      return '<article class="githubSyncItem"><b>' + esc(item.kindLabel || item.kind) + ' · ' + esc(item.buildingId) + ' · ' + state + '</b><small>' + esc(item.id) + ' · ' + esc(item.createdAt) + '</small><p>' + esc(item.text) + '</p></article>';
    }).join('');
  }
  function renderRemote() {
    if (!refs.remote) return;
    if (!remote.issues.length) { refs.remote.innerHTML = '<p class="githubSyncHint">暂无公开的 [Web Sync] Issue，或 GitHub API 暂时不可用。</p>'; return; }
    refs.remote.innerHTML = remote.issues.map(function (item) {
      return '<article class="githubSyncItem"><b><a href="' + esc(item.html_url) + '" target="_blank" rel="noopener" style="color:#e5c98f">' + esc(item.title) + '</a></b><small>#' + esc(item.number) + ' · ' + esc(item.updated_at || item.created_at || '') + '</small><p>' + esc((item.body || '').replace(/```json[\s\S]*?```/g, '').trim().slice(0, 360)) + '</p></article>';
    }).join('');
  }
  function addFromForm() {
    var text = (refs.text.value || '').trim();
    if (!text) { setMessage('请先填写要同步的内容。', true); refs.text.focus(); return; }
    var kind = refs.type.value;
    var labels = { command: '生产线命令', observation: '现场观察', correction: '纠错复核', evidence: '新增证据' };
    var item = { id: nowId(), kind: kind, kindLabel: labels[kind] || kind, buildingId: (refs.building.value || '').trim() || 'YUNNAN-COURTYARD-SYSTEM', text: text, context: context(), source: 'yunnan-production-line-web', createdAt: new Date().toISOString() };
    entries.push(item); entries = entries.slice(-100); saveEntries(); refs.text.value = ''; renderQueue(); setMessage('已加入本地队列。需要真正写入 GitHub 时，再点击“提交为 GitHub Issue”。');
  }
  function bundle() {
    return { schemaVersion: '5.5.0', bundleType: 'yunnan-production-web-sync', repository: CONFIG.owner + '/' + CONFIG.repo, branch: CONFIG.branch, generatedAt: new Date().toISOString(), sourcePage: global.location.href, entries: entries.slice() };
  }
  function exportBundle() {
    var blob = new Blob([JSON.stringify(bundle(), null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'yunnan-production-web-sync-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); setMessage('已下载同步 JSON，可作为生产线资料包归档。');
  }
  function formatCommit(item) { return item && item.commit ? (item.commit.message || '').split('\n')[0] + ' · ' + (item.sha || '').slice(0, 7) : '未读取提交信息'; }
  function refreshResolved(force) {
    createPanel();
    // A launcher click and a forced QA refresh can arrive in the same event turn.
    // Keep exactly one request set in flight so its audit records cannot be
    // overwritten or interleaved with another refresh.
    if (remote.refreshState === 'loading' && refreshPromise) return refreshPromise;
    if (remote.checkedAt && !force && Date.now() - remote.checkedAt < 45000) {
      renderQueue(); renderRemote(); return Promise.resolve(remote);
    }
    remote.checkedAt = Date.now(); remote.error = remote.deploymentError; remote.refreshState = 'loading';
    remote.refreshGeneration += 1;
    remote.requests = []; remote.optionalDiagnostics = [];
    if (refs.status) refs.status.textContent = '正在读取 GitHub…';
    if (refs.dot) refs.dot.classList.add('warn');
    var fileRequests = CONFIG.dataFiles.map(function (file) {
      var url = rawUrl(CONFIG.sourceRoot + '/' + file.path);
      return requestJson({ id: 'data:' + file.id, url: url, required: file.required !== false, options: { cache: 'no-store' } }).then(function (json) {
        if (!json) return null;
        return { id: file.id, label: file.label, path: file.path, schemaVersion: json.schemaVersion || '未声明', title: json.title || '', url: url };
      });
    });
    var commitUrl = apiUrl('/commits?sha=' + encodeURIComponent(CONFIG.ref) + '&path=' + encodeURIComponent(CONFIG.sourceRoot + '/data/system_v5_2_1.json') + '&per_page=1');
    var commitRequest = requestJson({
      id: 'api:commits', url: commitUrl, required: false, allowedStatuses: [403, 429],
      optionalReason: 'Unauthenticated GitHub REST rate limit; source data reads remain authoritative.',
      options: { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' }
    }).then(function (list) { return Array.isArray(list) ? list[0] : null; });
    var issueUrl = apiUrl('/issues?state=all&per_page=30&sort=updated&direction=desc');
    var issueRequest = requestJson({
      id: 'api:issues', url: issueUrl, required: false, allowedStatuses: [403, 429],
      optionalReason: 'Unauthenticated GitHub REST rate limit; the local audit queue remains available.',
      options: { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' }
    }).then(function (list) { return (Array.isArray(list) ? list : []).filter(function (item) { return /^\[Web Sync\]/i.test(item.title || '') && !item.pull_request; }).slice(0, 20); });
    var activeRefresh = Promise.allSettled([Promise.all(fileRequests), commitRequest, issueRequest]).then(function (results) {
      if (results[0].status === 'fulfilled') remote.files = results[0].value.filter(Boolean);
      if (results[1].status === 'fulfilled') remote.commit = results[1].value;
      if (results[2].status === 'fulfilled') remote.issues = results[2].value;
      var failures = results.filter(function (item) { return item.status === 'rejected'; }).map(function (item) { return item.reason.message; });
      if (remote.deploymentError) failures.unshift(remote.deploymentError);
      remote.error = failures.length ? failures.join('；') : null;
      remote.refreshState = 'complete';
      if (refs.files) refs.files.innerHTML = remote.files.length ? remote.files.map(function (file) { return '<li>' + esc(file.label) + ' · schema ' + esc(file.schemaVersion) + '</li>'; }).join('') : '<li>读取失败，请点击刷新。</li>';
      if (refs.commit) refs.commit.textContent = remote.commit ? '最新数据提交：' + formatCommit(remote.commit) : '提交信息暂不可用。';
      if (refs.status) refs.status.textContent = remote.error ? 'GitHub 部分可读 · ' + remote.error : 'GitHub 已连接 · ' + CONFIG.owner + '/' + CONFIG.repo + '@' + CONFIG.ref.slice(0, 12);
      if (refs.dot) refs.dot.classList.toggle('warn', !!remote.error);
      if (refs.launcher) { refs.launcher.textContent = remote.error ? 'GitHub同步部分可读' : 'GitHub已同步'; refs.launcher.classList.toggle('ok', !remote.error); refs.launcher.classList.toggle('warn', !!remote.error); }
      renderQueue(); renderRemote();
      return remote;
    }).finally(function () {
      // Do not let an older completion clear a newer refresh started by a
      // promise continuation in the same microtask drain.
      if (refreshPromise === activeRefresh) refreshPromise = null;
    });
    refreshPromise = activeRefresh;
    return refreshPromise;
  }
  function refresh(force) {
    return deploymentReady.then(function () { return refreshResolved(force); });
  }
  function pushLatest() {
    var token = (refs.token.value || '').trim();
    if (!token) { setMessage('需要你主动填写 GitHub Fine-grained token，且令牌需有 Issues: write 权限。', true); refs.token.focus(); return; }
    if (!entries.length) { setMessage('本地队列为空，请先加入一条记录。', true); return; }
    var item = entries.find(function (entry) { return !entry.issueUrl; }) || entries[entries.length - 1];
    var title = '[Web Sync] ' + item.kindLabel + ' · ' + item.buildingId + ' · ' + item.id;
    var body = ['## 云南民居生产线网页同步记录', '', '- 类型：' + item.kindLabel, '- 关联对象：' + item.buildingId, '- 记录 ID：' + item.id, '- 创建时间：' + item.createdAt, '- 页面上下文：' + JSON.stringify(item.context || {}), '', item.text, '', '```json', JSON.stringify(item, null, 2), '```', '', '_由 GitHub Pages 生产线的 GitHub 同步中枢提交。_'].join('\n');
    setMessage('正在提交到 GitHub Issues…');
    fetch(apiUrl('/issues'), { method: 'POST', headers: { Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ title: title, body: body }) }).then(function (response) { return response.json().then(function (payload) { if (!response.ok) throw new Error(payload.message || ('HTTP ' + response.status)); return payload; }); }).then(function (issue) { item.issueUrl = issue.html_url; item.issueNumber = issue.number; item.syncedAt = new Date().toISOString(); saveEntries(); refs.token.value = ''; renderQueue(); remote.issues.unshift(issue); renderRemote(); setMessage('已提交 GitHub Issue #' + issue.number + '。令牌未保存，刷新页面后仍可从公开 Issue 读取。'); }).catch(function (error) { setMessage('提交失败：' + error.message, true); });
  }
  function init() { ensureStyles(); createLauncher(); createPanel(); deploymentReady = resolveDeployment(); refresh(false); }
  global.__GITHUB_SYNC__ = {
    config: CONFIG, open: open, close: close, refresh: refresh, add: addFromForm, exportBundle: exportBundle,
    stats: function () {
      return {
        schemaVersion: '5.5.0', queued: entries.length,
        synced: entries.filter(function (item) { return !!item.issueUrl; }).length,
        files: remote.files.length, issues: remote.issues.length, checkedAt: remote.checkedAt,
        error: remote.error, refreshState: remote.refreshState, refreshGeneration: remote.refreshGeneration,
        deploymentError: remote.deploymentError,
        deployment: { branch: CONFIG.branch, ref: CONFIG.ref, headSha: CONFIG.headSha, source: CONFIG.deploymentSource },
        requests: remote.requests.map(function (item) { return Object.assign({}, item); }),
        requestHistory: remote.requestHistory.map(function (item) { return Object.assign({}, item); }),
        optionalDiagnostics: remote.optionalDiagnostics.slice()
      };
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
