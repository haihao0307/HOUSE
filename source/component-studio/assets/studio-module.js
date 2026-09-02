function updateModuleHeaderFields() {
  const updated = document.querySelector('#updatedInput');
  if (updated && activeState) updated.value = formatDate(activeState.updatedAt);
}

function renderTasks() {
  const list = document.querySelector('#taskList');
  if (!list || !activeState) return;
  list.replaceChildren();
  if (!activeState.tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-note';
    empty.textContent = '当前没有任务，点击右上角添加';
    list.append(empty);
    return;
  }
  activeState.tasks.forEach((task) => {
    const row = document.createElement('div');
    row.className = `task-item${task.done ? ' done' : ''}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', '完成任务');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = task.text;
    input.setAttribute('aria-label', '任务内容');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', '删除任务');

    checkbox.addEventListener('change', () => {
      activeState.tasks = activeState.tasks.map((item) => item.id === task.id ? { ...item, done: checkbox.checked } : item);
      activeState = saveModuleState(activeModule, activeState, { logMessage: checkbox.checked ? `完成任务: ${task.text}` : `重新打开任务: ${task.text}` });
      renderTasks();
      renderActivityLog();
      renderReleaseGates();
    });
    input.addEventListener('input', () => {
      activeState.tasks = activeState.tasks.map((item) => item.id === task.id ? { ...item, text: input.value } : item);
      debounceSaveModule(activeModule, () => activeState);
    });
    remove.addEventListener('click', () => {
      activeState.tasks = activeState.tasks.filter((item) => item.id !== task.id);
      activeState = saveModuleState(activeModule, activeState, { logMessage: `删除任务: ${task.text}` });
      renderTasks();
      renderActivityLog();
      renderReleaseGates();
    });
    row.append(checkbox, input, remove);
    list.append(row);
  });
}

function renderActivityLog() {
  const log = document.querySelector('#activityLog');
  if (!log || !activeState) return;
  log.replaceChildren();
  (activeState.activity || []).slice(0, 30).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'activity-item';
    const dot = document.createElement('i');
    const content = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.message;
    const time = document.createElement('small');
    time.textContent = formatDate(item.time);
    content.append(title, time);
    row.append(dot, content);
    log.append(row);
  });
}

async function renderReleaseGates() {
  const container = document.querySelector('#releaseGates');
  if (!container || !activeState || !activeModule) return;
  const attachments = await attachmentMetadata(activeModule.id);
  const dependenciesReady = activeModule.dependencies.every((id) => {
    const module = config.modules.find((item) => item.id === id);
    const state = module ? getModuleState(module) : null;
    return statusRank(state?.status) >= statusRank('visual_approved');
  });
  const tasksDone = activeState.tasks.length > 0 && activeState.tasks.every((task) => task.done);
  const evidencePresent = attachments.length > 0 || activeState.notes.trim().length > 20 || activeState.decisions.trim().length > 20;
  const gates = [
    { ok: activeState.requirements.trim().length > 0, title: '本轮目标清楚', note: '本轮要求已经填写' },
    { ok: tasksDone, title: '模块任务完成', note: `${activeState.tasks.filter((task) => task.done).length} / ${activeState.tasks.length} 项完成` },
    { ok: evidencePresent, title: '证据已进入工作室', note: `${attachments.length} 个附件，研究笔记 ${activeState.notes.trim().length} 字` },
    { ok: dependenciesReady, title: '上游依赖满足', note: activeModule.dependencies.length ? '依赖模块至少达到视觉通过' : '本模块没有上游依赖' },
    { ok: statusRank(activeState.status) >= statusRank('visual_approved'), title: '视觉验收通过', note: `当前状态为 ${statusRecord(activeState.status).label}` },
    { ok: activeState.status === 'production_locked' && activeState.assemblyCandidate, title: '进入总装', note: '生产锁定并列为总装候选' }
  ];
  container.replaceChildren();
  gates.forEach((gate) => {
    const item = document.createElement('div');
    item.className = `gate-item${gate.ok ? ' ok' : ''}`;
    item.innerHTML = `<i></i><div><strong>${gate.title}</strong><small>${gate.note}</small></div>`;
    container.append(item);
  });
}

async function renderAttachments() {
  const list = document.querySelector('#attachmentList');
  if (!list || !activeModule) return;
  const items = await listAttachments(activeModule.id);
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-note';
    empty.textContent = '尚未加入参考资料';
    list.append(empty);
    renderReleaseGates();
    return;
  }
  items.forEach((record) => {
    const row = document.createElement('div');
    row.className = 'attachment-item';
    const thumb = document.createElement('div');
    thumb.className = 'attachment-thumb';
    if (record.type.startsWith('image/')) {
      const image = document.createElement('img');
      const objectUrl = URL.createObjectURL(record.blob);
      image.src = objectUrl;
      image.alt = '';
      image.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
      thumb.append(image);
    } else {
      thumb.textContent = record.name.split('.').pop()?.toUpperCase().slice(0, 5) || 'FILE';
    }
    const info = document.createElement('div');
    info.className = 'attachment-info';
    const name = document.createElement('strong');
    name.textContent = record.name;
    const meta = document.createElement('small');
    meta.textContent = `${formatBytes(record.size)} · ${record.sha256 ? record.sha256.slice(0, 10) : '无校验'}`;
    info.append(name, meta);
    const actions = document.createElement('div');
    actions.className = 'attachment-actions';
    const download = document.createElement('button');
    download.className = 'icon-button';
    download.type = 'button';
    download.textContent = '↓';
    download.title = '下载';
    download.addEventListener('click', () => downloadAttachment(record.id));
    const remove = document.createElement('button');
    remove.className = 'icon-button';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = '删除';
    remove.addEventListener('click', async () => {
      await deleteAttachment(record.id);
      activeState = saveModuleState(activeModule, activeState, { logMessage: `删除资料: ${record.name}` });
      channel?.postMessage({ type: 'attachments-updated', moduleId: activeModule.id });
      renderAttachments();
      renderActivityLog();
    });
    actions.append(download, remove);
    row.append(thumb, info, actions);
    list.append(row);
  });
  renderReleaseGates();
}

async function downloadAttachment(id) {
  const record = await getAttachment(id);
  if (!record) return;
  const url = URL.createObjectURL(record.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = record.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function setupAttachmentUi() {
  const dropZone = document.querySelector('#dropZone');
  const fileInput = document.querySelector('#fileInput');
  const chooseFiles = () => fileInput.click();
  dropZone.addEventListener('click', chooseFiles);
  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseFiles(); }
  });
  ['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault(); dropZone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault(); dropZone.classList.remove('dragging');
  }));
  dropZone.addEventListener('drop', (event) => handleFiles(event.dataTransfer.files));
  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
    fileInput.value = '';
  });
  renderAttachments();
}

async function handleFiles(fileList) {
  const files = [...fileList];
  if (!files.length || !activeModule) return;
  showToast(`正在写入 ${files.length} 个资料文件`);
  try {
    for (const file of files) {
      await addAttachment(activeModule.id, file);
      activeState = saveModuleState(activeModule, activeState, { logMessage: `加入资料: ${file.name}`, broadcast: false });
    }
    channel?.postMessage({ type: 'attachments-updated', moduleId: activeModule.id });
    renderAttachments();
    renderActivityLog();
    showToast('资料已经进入当前工作室');
  } catch (error) {
    console.error(error);
    showToast(`资料写入失败: ${error.message}`, 'error');
  }
}

