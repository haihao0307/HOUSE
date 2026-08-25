async function loadConfig() {
  const response = await fetch(CONFIG_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`组件注册表读取失败: ${response.status}`);
  return response.json();
}

async function updateBuildFooter() {
  const footer = document.querySelector('#footerBuild');
  try {
    const response = await fetch('../build.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('missing');
    const build = await response.json();
    footer.textContent = `组件工作台 V1 · ${String(build.ref || '').replace('refs/heads/', '')} · ${String(build.sha || '').slice(0, 8)}`;
  } catch {
    footer.textContent = '组件工作台 V1 · 本机工作区';
  }
}

function moduleUrl(moduleId) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('module', moduleId);
  return url.href;
}

function renderHub() {
  activeModule = null;
  activeState = null;
  document.title = '云南建筑组件工作台';
  app.replaceChildren(hubTemplate.content.cloneNode(true));

  const workspace = getWorkspaceState();
  const buildingInput = document.querySelector('#buildingIdInput');
  const typologyInput = document.querySelector('#typologyInput');
  const periodInput = document.querySelector('#periodInput');
  const assemblyVersionInput = document.querySelector('#assemblyVersionInput');
  buildingInput.value = workspace.buildingId;
  typologyInput.value = workspace.typology;
  periodInput.value = workspace.period;
  assemblyVersionInput.value = workspace.assemblyVersion;

  const saveSettings = () => {
    saveWorkspaceState({
      buildingId: buildingInput.value.trim(),
      typology: typologyInput.value.trim(),
      period: periodInput.value.trim(),
      assemblyVersion: assemblyVersionInput.value.trim()
    });
  };
  [buildingInput, typologyInput, periodInput, assemblyVersionInput].forEach((input) => input.addEventListener('input', saveSettings));

  renderHubModules();

  document.querySelector('[data-action="open-all"]').addEventListener('click', () => {
    const opened = [];
    config.modules.forEach((module) => {
      const tab = window.open(moduleUrl(module.id), `_yunnan_${module.id}`);
      if (tab) opened.push(module.id);
    });
    showToast(opened.length === config.modules.length
      ? '八个工作室已经分别打开'
      : `浏览器打开了 ${opened.length} 个工作室，请允许此网站打开多个窗口`);
  });

  document.querySelector('[data-action="export-workspace"]').addEventListener('click', exportWorkspace);
  document.querySelector('[data-action="copy-assembly"]').addEventListener('click', async () => {
    await copyText(buildAssemblyManifestText());
    showToast('总装清单已复制');
  });
}

function renderHubModules() {
  const grid = document.querySelector('#moduleGrid');
  const rail = document.querySelector('#pipelineRail');
  const body = document.querySelector('#assemblyTableBody');
  if (!grid || !rail || !body) return;
  grid.replaceChildren();
  rail.replaceChildren();
  body.replaceChildren();

  let locked = 0;
  let candidates = 0;
  config.modules.forEach((module) => {
    const state = getModuleState(module);
    const status = statusRecord(state.status);
    if (state.status === 'production_locked') locked += 1;
    if (state.assemblyCandidate) candidates += 1;

    const card = document.createElement('article');
    card.className = 'module-card';
    card.style.setProperty('--module-accent', module.accent);
    card.innerHTML = `
      <div class="card-top">
        <span class="card-number">${module.number}</span>
        <span class="status-badge" data-status="${state.status}">${status.label}</span>
      </div>
      <h3>${module.name}</h3>
      <p>${module.summary}</p>
      <div class="card-meta">${module.scope.slice(0, 4).map((item) => `<span>${item}</span>`).join('')}</div>
      <div class="card-footer">
        <small>${state.version || '未定版本'} · ${formatDate(state.updatedAt, true)}</small>
        <a class="open-studio-link" href="${moduleUrl(module.id)}">打开工作室 ›</a>
      </div>`;
    grid.append(card);

    const node = document.createElement('a');
    node.className = 'pipeline-node';
    node.href = moduleUrl(module.id);
    node.innerHTML = `<small>${module.number}</small><strong>${module.shortName}</strong><div class="node-status">${status.label}</div>`;
    rail.append(node);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${module.shortName}</td>
      <td><span class="status-badge" data-status="${state.status}">${status.label}</span></td>
      <td>${state.version || '未定'}</td>
      <td>${formatDate(state.updatedAt, true)}</td>
      <td class="${state.assemblyCandidate ? 'candidate-yes' : 'candidate-no'}">${state.assemblyCandidate ? '已列入' : '尚未列入'}</td>`;
    body.append(row);
  });

  document.querySelector('#lockedCount').textContent = `${locked} / ${config.modules.length}`;
  document.querySelector('#progressBar').style.width = `${(locked / config.modules.length) * 100}%`;
  document.querySelector('#assemblySummary').textContent = locked === config.modules.length && candidates === config.modules.length
    ? '八个组件均已生产锁定并列入总装候选，可以生成第一版完整建筑总装。'
    : `当前有 ${locked} 个组件达到生产锁定，${candidates} 个组件列入总装候选。总装器继续保持只读，直到所有依赖满足。`;
}

function fillModuleStaticContent(module) {
  document.querySelector('#crumbModule').textContent = module.name;
  document.querySelector('#moduleNumber').textContent = module.number;
  document.querySelector('#moduleName').textContent = module.name;
  document.querySelector('#moduleSummary').textContent = module.summary;
  document.querySelector('#moduleHero').style.setProperty('--module-accent', module.accent);
  const preview = document.querySelector('#previewLink');
  preview.href = module.preview;
  document.querySelector('#repoInput').value = `haihao0307/${module.repoSlug}`;

  const scopeList = document.querySelector('#scopeList');
  module.scope.forEach((item) => {
    const chip = document.createElement('span');
    chip.textContent = item;
    scopeList.append(chip);
  });

  const outputList = document.querySelector('#outputList');
  module.outputs.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    outputList.append(li);
  });

  const dependencyList = document.querySelector('#dependencyList');
  const tags = document.createElement('div');
  tags.className = 'dependency-tags';
  if (!module.dependencies.length) {
    const span = document.createElement('span');
    span.textContent = '无上游依赖';
    tags.append(span);
  } else {
    module.dependencies.forEach((id) => {
      const dependency = config.modules.find((item) => item.id === id);
      const state = dependency ? getModuleState(dependency) : null;
      const link = document.createElement('a');
      link.href = moduleUrl(id);
      link.textContent = `${dependency?.shortName || id} · ${statusRecord(state?.status).label}`;
      tags.append(link);
    });
  }
  dependencyList.append(tags);
}

function renderModule(module) {
  activeModule = module;
  activeState = getModuleState(module);
  document.title = `${module.name} · 云南建筑组件工作台`;
  app.replaceChildren(moduleTemplate.content.cloneNode(true));
  fillModuleStaticContent(module);

  const statusSelect = document.querySelector('#statusSelect');
  config.statuses.forEach((status) => {
    const option = document.createElement('option');
    option.value = status.id;
    option.textContent = status.label;
    statusSelect.append(option);
  });

  const fields = {
    status: statusSelect,
    version: document.querySelector('#versionInput'),
    assemblyCandidate: document.querySelector('#assemblyCandidateInput'),
    requirements: document.querySelector('#requirementsInput'),
    decisions: document.querySelector('#decisionsInput'),
    forbidden: document.querySelector('#forbiddenInput'),
    questions: document.querySelector('#questionsInput'),
    notes: document.querySelector('#notesInput')
  };
  fields.status.value = activeState.status;
  fields.version.value = activeState.version;
  fields.assemblyCandidate.checked = Boolean(activeState.assemblyCandidate);
  fields.requirements.value = activeState.requirements;
  fields.decisions.value = activeState.decisions;
  fields.forbidden.value = activeState.forbidden;
  fields.questions.value = activeState.questions;
  fields.notes.value = activeState.notes;

  const collectState = () => ({
    ...activeState,
    status: fields.status.value,
    version: fields.version.value.trim(),
    assemblyCandidate: fields.assemblyCandidate.checked,
    requirements: fields.requirements.value,
    decisions: fields.decisions.value,
    forbidden: fields.forbidden.value,
    questions: fields.questions.value,
    notes: fields.notes.value
  });

  ['version', 'requirements', 'decisions', 'forbidden', 'questions', 'notes'].forEach((key) => {
    fields[key].addEventListener('input', () => debounceSaveModule(module, collectState));
  });
  fields.status.addEventListener('change', () => {
    activeState = saveModuleState(module, collectState(), { logMessage: `状态调整为 ${statusRecord(fields.status.value).label}` });
    updateModuleHeaderFields();
    renderActivityLog();
    renderReleaseGates();
  });
  fields.assemblyCandidate.addEventListener('change', () => {
    activeState = saveModuleState(module, collectState(), { logMessage: fields.assemblyCandidate.checked ? '列入总装候选' : '移出总装候选' });
    renderActivityLog();
    renderReleaseGates();
  });

  updateModuleHeaderFields();
  renderTasks();
  renderActivityLog();
  renderReleaseGates();
  setupAttachmentUi();
  setupModuleActions(collectState);
}

