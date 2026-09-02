# 从这里开始：云南民间建筑生产线 V5.5.1

## 新会话第一步

1. 打开 GitHub 仓库 `haihao0307/HOUSE`。
2. 优先读取工作分支 `codex/yunnan-surface-production-v5.5.0`，当前 PR 为 #11。
3. 阅读项目根目录的 `AGENTS.md` 与 `PROJECT_STATE.md`。
4. 阅读本目录中的全部文件，顺序如下：
   - `NEW_CHAT_BOOTSTRAP.md`
   - `CHAT_HISTORY_CURATED.md`
   - `CONVERSATION_DECISIONS.md`
   - `ARCHITECTURAL_WORLD_KNOWLEDGE.md`
   - `CODEX_EXECUTION_PROTOCOL.md`
   - `KNOWN_ERRORS_AND_NEXT_STEPS.md`
   - `GITHUB_POINTERS.json`
5. 阅读瓦作、墙体、门窗、人物路线、参考模型和一颗印测绘数据合同。
6. 运行现有静态验证和浏览器测试。
7. 确认知识、代码和网页状态后再指挥 Codex。

## 工作方式

- 修改前必须查 GitHub 知识库。
- Codex 必须先读知识库再工作。
- 用户只验收网页成果。
- 文件传递、参数表、GitHub 配置、PR、Actions 和 Pages 都由小李工程师处理。
- Codex 的本地摘要、本地提交号和无法下载的容器路径不算交付。
- 实际文件进入 GitHub 远端后才计入完成。
- 主网页只显示最新版本，旧版本只用于后台回归。

## 当前核心目标

把云南建筑知识真正作用于完整一颗印主生产线：

- 板瓦凹面向上形成水槽。
- 筒瓦覆盖相邻板瓦列的纵缝。
- 正脊沿两坡最高交界轴线。
- 板瓦与筒瓦真实出檐，端口厚度和手工微差可见。
- 山墙只位于双坡屋面两个山面端部。
- 瓦面有连续沉降、日晒、积尘、雨蚀、苔藓、破损和成片修补。
- 墙面有土体、抹灰、稻草纤维、裸露土坯、夯筑层理、石勒脚、砖包角、返潮、雨痕、裂缝和补抹。
- 门窗木作进入同一生产体系，保留自动开合与人物上二层路线。

## 当前网页

- `folk-building-production-line.html`
- `surface-production-lab.html`
- `index.html`
- `reference-model-showcase.html`

## 参考资料

- 三个主要 GLB 已在仓库 `assets/models/`。
- 原始图片、测绘图、现场照片和知识提取文件的归档清单位于 `reference-library/yunnan/v1/`。
- 本次完整新聊天包内保存 17 个参考资料分卷和 SHA256，方便在任何环境恢复。

## 证据边界

当前可运行几何不等于历史节点已经被实测证明。瓦片纵向搭接、列中心距、基层固定和普通住宅脊部封闭，在缺少实测节点时必须继续标为 `visual-calibration-only` 或 `unresolved`。
