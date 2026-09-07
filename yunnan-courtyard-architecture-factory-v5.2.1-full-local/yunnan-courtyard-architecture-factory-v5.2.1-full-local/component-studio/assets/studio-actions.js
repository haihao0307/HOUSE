function setupModuleActions(collectState) {
  document.querySelector('[data-action="add-task"]').addEventListener('click', () => {
    const task = { id: uid('task'), text: '新的模块任务', done: false };
    activeState = saveModuleState(activeModule, { ...collectState(), tasks: [...activeState.tasks, task] }, { logMessage: '添加一项新任务' });
    renderTasks();
    renderActivityLog();
    renderReleaseGates();
    const inputs = document.querySelectorAll('.task-item input[type="text"]');
    inputs[inputs.length - 1]?.select();
  });

  document.querySelector('[data-action="save-snapshot"]').addEventListener('click', () => {
    const current = collectState();
    const snapshot = { id: uid('snapshot'), createdAt: nowIso(), state: { ...current, snapshots: undefined } };
    activeState = saveModuleState(activeModule, {
      ...current,
      snapshots: [snapshot, ...(activeState.snapshots || [])].slice(0, 20)
    }, { logMessage: `保存模块快照 ${snapshot.id.slice(-8)}` });
    renderActivityLog();
    updateModuleHeaderFields();
    showToast('本轮快照已保存');
  });

  document.querySelector('[data-action="export-module"]').addEventListener('click', exportActiveModule);
  document.querySelector('[data-action="copy-handoff"]').addEventListener('click', async () => {
    const text = await buildModuleHandoffText(activeModule, activeState);
    await copyText(text);
    showToast('交接内容已复制，可以直接发给小李');
  });
  document.querySelector('[data-action="create-issue"]').addEventListener('click', async () => {
    const body = await buildModuleHandoffText(activeModule, activeState);
    const title = `[组件工作台] ${activeModule.name} ${activeState.version || '未定版本'}`;
    const url = `${ISSUE_BASE}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
  });
  document.querySelector('[data-action="import-json"]').addEventListener('click', () => {
    jsonImportInput.dataset.moduleId = activeModule.id;
    jsonImportInput.click();
  });
  document.querySelector('[data-action="reset-module"]').addEventListener('click', async () => {
    const confirmed = window.confirm(`确认清空“${activeModule.name}”在当前浏览器中的文字、任务和附件吗？`);
    if (!confirmed) return;
    const items = await listAttachments(activeModule.id);
    for (const item of items) await deleteAttachment(item.id);
    localStorage.removeItem(`${MODULE_KEY_PREFIX}${activeModule.id}`);
    activeState = defaultModuleState(activeModule);
    saveModuleState(activeModule, activeState, { logMessage: '模块数据已重置' });
    renderModule(activeModule);
    showToast('当前模块已重置');
  });
}

async function exportActiveModule() {
  if (!activeModule || !activeState) return;
  const workspace = getWorkspaceState();
  const attachments = await attachmentMetadata(activeModule.id);
  const packet = {
    schemaVersion: '1.0.0',
    packetType: 'yunnan-architecture-module-handoff',
    exportedAt: nowIso(),
    workspace,
    module: activeModule,
    state: activeState,
    attachments
  };
  downloadJson(`${workspace.buildingId}_${activeModule.id}_${activeState.version || 'draft'}.json`, packet);
  showToast('模块 JSON 已导出');
}

async function exportWorkspace() {
  const workspace = getWorkspaceState();
  const modules = [];
  for (const module of config.modules) {
    modules.push({
      definition: module,
      state: getModuleState(module),
      attachments: await attachmentMetadata(module.id)
    });
  }
  downloadJson(`${workspace.buildingId}_component-workspace_${workspace.assemblyVersion || 'draft'}.json`, {
    schemaVersion: '1.0.0',
    packetType: 'yunnan-architecture-component-workspace',
    exportedAt: nowIso(),
    workspace,
    modules
  });
  showToast('总工作包已导出');
}

function buildAssemblyManifestText() {
  const workspace = getWorkspaceState();
  const lines = [
    `云南建筑总装清单`,
    `建筑: ${workspace.buildingId}`,
    `类型: ${workspace.typology}`,
    `年代: ${workspace.period}`,
    `总装版本: ${workspace.assemblyVersion}`,
    ''
  ];
  config.modules.forEach((module) => {
    const state = getModuleState(module);
    lines.push(`${module.number} ${module.name}: ${state.version || '未定'} | ${statusRecord(state.status).label} | ${state.assemblyCandidate ? '总装候选' : '未列入'}`);
  });
  return lines.join('\n');
}

async function buildModuleHandoffText(module, state) {
  const workspace = getWorkspaceState();
  const attachments = await attachmentMetadata(module.id);
  const dependencyLines = module.dependencies.length
    ? module.dependencies.map((id) => {
        const definition = config.modules.find((item) => item.id === id);
        const dependency = definition ? getModuleState(definition) : null;
        return `${definition?.name || id}: ${statusRecord(dependency?.status).label} ${dependency?.version || ''}`;
      })
    : ['无'];
  const taskLines = state.tasks.map((task) => `${task.done ? '[完成]' : '[待办]'} ${task.text}`);
  const attachmentLines = attachments.length
    ? attachments.map((item) => `${item.name} | ${formatBytes(item.size)} | SHA256 ${item.sha256 || '未生成'}`)
    : ['无附件'];
  return [
    `云南建筑组件工作台交接`,
    `模块: ${module.number} ${module.name}`,
    `建筑: ${workspace.buildingId}`,
    `类型: ${workspace.typology}`,
    `年代: ${workspace.period}`,
    `状态: ${statusRecord(state.status).label}`,
    `模块版本: ${state.version || '未定'}`,
    `总装候选: ${state.assemblyCandidate ? '是' : '否'}`,
    `计划独立库: haihao0307/${module.repoSlug}`,
    '',
    `本轮要求`, state.requirements || '尚未填写', '',
    `已确认决定`, state.decisions || '尚未填写', '',
    `禁止事项`, state.forbidden || '尚未填写', '',
    `仍需回答的问题`, state.questions || '尚未填写', '',
    `研穵笔记与链接`, state.notes || '尚未填写', '',
    `任务`, ...taskLines, '',
    `上游依赖`, ...dependencyLines, '',
    `附件清单`, ...attachmentLines
  ].join('\n');
}

jsonImportInput.addEventListener('change', async () => {
  const file = jsonImportInput.files?.[0];
  jsonImportInput.value = '';
  if (!file) return;
  try {
    const packet = JSON.parse(await file.text());
    const targetId = jsonImportInput.dataset.moduleId;
    const importedState = packet.state || packet;
    if (importedState.moduleId !== targetId) throw new Error(`模块 ID 不匹配，当前需要 ${targetId}`);
    const module = config.modules.find((item) => item.id === targetId);
    if (!module) throw new Error('找不到目标模块');
    activeState = saveModuleState(module, { ...defaultModuleState(module), ...importedState }, { logMessage: `导入模块包: ${file.name}` });
    renderModule(module);
    showToast('模块包导入完成');
  } catch (error) {
    showToast(`模块包导入失败: ${error.message}`, 'error');
  }
});

channel?.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type === 'workspace-updated' && !activeModule) renderHubModules();
  if (message.type === 'module-updated') {
    if (!activeModule) renderHubModules();
    else if (message.moduleId === activeModule.id && !document.querySelector('input:focus, textarea:focus, select:focus')) {
      activeState = getModuleState(activeModule);
      updateModuleHeaderFields();
      renderTasks();
      renderActivityLog();
      renderReleaseGates();
    }
  }
  if (message.type === 'attachments-updated' && activeModule?.id === message.moduleId) renderAttachments();
});

window.addEventListener('storage', (event) => {
  if (!activeModule && (event.key === WORKSPACE_KEY || event.key?.startsWith(MODULE_KEY_PREFIX))) renderHubModules();
});

async function boot() {
  try {
    config = await loadConfig();
    const moduleId = new URLSearchParams(window.location.search).get('module');
    const module = config.modules.find((item) => item.id === moduleId);
    if (moduleId && !module) {
      history.replaceState(null, '', './');
      showToast('指定工作室不存在，已经返回总控首页', 'error');
    }
    if (module) renderModule(module); else renderHub();
    updateBuildFooter();
  } catch (error) {
    console.error(error);
    app.innerHTML = `<section class="loading-state"><p>组件工作台启动失败</p><small>${String(error.message || error)}</small></section>`;
  }
}

boot();
