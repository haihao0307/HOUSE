# HOUSE 生产线执行规则

Brick Mother、Tiles Mother、云南传统建筑和本仓库后续全部在线工作台，在开工与交付前必须读取并执行 `docs/PUBLIC_WEB_DELIVERY_GATE.md`。

## 所有 Mother 共用视觉产出规则

Brick Mother、Tiles Mother、云南传统建筑及本仓库后续全部 Mother，默认禁止调用图像生成或图像编辑工具。禁止生成概念图、效果图、预览图、参考图、海报、缩略图，也禁止用图片代替真实三维成果。

只有用户在当前对话中明确要求生成图片或修改图片时，才允许进入图片工具流程。用户提出“做一版看看”“展示创意”“做个样子”时，默认交付真实可交互三维 HTML、Three.js 或 WebGPU 页面、程序化几何、函数代码和在线工作台。

浏览器自动化可以在内部保存 QA 截图，仅作为运行与视觉检查证据。未经用户明确要求，不把 QA 截图作为创作成果发送。

## 真实三维工作台硬门禁

任何“做一版”“重新做”“继续做”“给我看”“按参考做”的任务都必须落实到真实生产源码和可交互三维工作台。除非用户在当前对话中明确要求图片，否则严禁调用图像生成或图像编辑工具，严禁用概念图、效果图、静态截图、视频、Canvas 假画面或占位页替代三维成果。

如果还没有可运行的三维版本，继续修改源码并明确尚未形成可验收成果；不得生成图片填补进度。只有截图而没有工作台，本轮自动判定失败。

每一份规划、任务卡、README、START_HERE、交接包、会议纪要和验收清单都必须包含：

- [ ] 没有用生成图片代替真实三维实现；
- [ ] 已实际修改生产源码；
- [ ] 用户看到的是可交互三维工作台；
- [ ] 画面来自实时三维运行时；
- [ ] 公网固定链接和真实浏览器已验证；
- [ ] 如果只有截图而没有工作台，本轮判定失败。

所有 Mother 面向用户的常规交付只允许展示一个已经发布并验证通过的公开网址。该网址必须可以直接点击并自动进入最终工作台。不得在常规回复中发送沙箱文件、下载链接、全量包、修正版压缩包、哈希、清单、QA 截图或多组测试地址。上述内部资产可以继续生成和保存，只有用户明确索要时才展示。

任何链接发给用户以前，必须完成实际发布、最终公网地址 HTTP 200 回读、版本标识正文匹配、关键资源检查与真实浏览器启动检查。仓库中存在文件、构建通过、本地打开成功和本地截图成功，均不能代替公网验证。

遇到 404、403、空白页、错误重定向、资源缺失或页面启动失败，立即修复并重新执行完整发布闭环。不得把首次公开访问检查交给用户。

每次成功发布保存 `PUBLICATION_PROOF.json`。只有 `shareAllowed=true` 才允许分享链接。新版公开验证完成以前保留旧版可用入口。


## KAOPU Mother Production OS R2 — 跨仓库强制规则

本仓库全部 Mother / Codex / 子执行端同时遵守 KAOPU 中央生产制度：
`haihao0307/guilin-dem-pipeline/knowledge/MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md`

相关中央硬门禁：
- `REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE.md`
- `TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE.md`

默认流程固定为：`LOCK → EXECUTE → VERIFY → PROMOTE`。

任何“按参考做 / 复刻 / 学习 / 照着做 / 不要想象补画”任务默认：
- `TASK_MODE=REPLICATION_LOCKED`
- `CREATIVE_AUTHORIZATION=false`

未经用户当前任务明确授权，不得自行简化、补画、重新设计、做 generic/toy/placeholder，也不得为了“先给用户看”制造一个差不多的可见替身。未知区域保持 UNKNOWN / SOURCE_ENTRY_REQUIRED / MEASUREMENT_REQUIRED。被拒绝的创作替代不得成为下一版父节点。

任何“这是最新结果 / 昨晚做的 / 本轮修改后的效果”必须证明发生在当前任务 dispatch 之后，并绑定当前 head。旧模型、旧页面、旧截图、旧 release 只能作为 BASELINE/BEFORE；没有新成果时必须报告 `NO_NEW_ARTIFACT`，不得拿旧产物填空。最新构建失败时不得 silent fallback 后把旧版冒充当前版。

每个明确任务只处理一个 primary defect，并记录最小 Task Anchor：target、baseSha、accepted baseline、reference set、protected invariants、forbidden routes、acceptance gates。Producer 不能批准自己；候选在进入用户视野前至少通过 Contract / Freshness / Reference Fidelity / Machine gates。两次内部失败仍未解决同一 bounded task 时进入 ROOT_CAUSE_REVIEW，不继续凭感觉微调。

用户的重要纠正必须进入 regression case，避免同类错误再次由用户发现。评估进展只看目标相关 fresh delta、实际测试和门禁，不看 branch/Issue/README/截图数量。

以上为生产制度，不覆盖本仓库更严格的领域专用规则；如有冲突，用户当前明确指令与更严格冻结/安全/真值规则优先。


## 用户最终交付格式：单体 HTML 双击直开（2026-09-21 永久规则）

凡是交给用户直接打开、查看、测试、验收的网页、三维工作台或演示，**最终交付本体必须是一个独立的 `.html` 文件**。用户只需双击即可运行；不得要求解压、配置路径、运行 npm/Vite/Python/local server、另外放 assets 目录或再打开第二个工具。

所有运行必需的 JavaScript、Three.js/runtime、shader、CSS、图片、数据、模型、音频和 decoder 必须在构建时封装进该 HTML（inline / data URI / base64 / typed array / compressed payload + inline decoder / Blob URL 均可）。核心运行不得依赖 CDN、远程图片/GLB/JSON、GitHub raw、localhost 或首次 service-worker 预缓存。

发布前必须真实执行 `file://` / 本地双击测试：首帧成功、关键交互可用、console 0 error、无缺失资源、无 CORS 核心失败、无需服务器、核心功能所需网络请求为 0。内部开发仍可多文件；用户交付必须 build 成一个 standalone HTML。

单文件规则不允许降低三维、物理、材质、数据或视觉质量；禁止用截图/视频/简化展示壳代替真实工作台。在线固定网址可以作为附加镜像，但不能替代 standalone HTML，也不能成为其运行前提。

若本仓库旧规则写“只交公开网址/必须服务器”，与本条冲突时以用户 2026-09-21 最新单体 HTML 指令为准。跨 Mother 完整规范见 `haihao0307/guilin-dem-pipeline@5791e1edef55b75888e783d5d355cc2cdfe277ba:knowledge/SINGLE_FILE_DOUBLE_CLICK_HTML_DELIVERY_GATE.md`。


## Mother Factory Execution Mode R3（2026-09-21 永久角色分工）

Production Mother 是执行车间，不是项目总设计者。小妈/Coordinator负责研究、复杂思考、任务拆解、方法选择、跨模块协调和验收；Production Mother 收到冻结好的 Task Anchor 后立即执行一个 bounded production defect，修改源码/数据/几何、跑测试、写 receipt，再领取下一个明确任务。

`thinking / still thinking / analyzing / waiting / cannot think / unable to think` 不再是合法生产状态。若当前模型/会话/工具确实无法继续，必须立即返回 `EXECUTOR_CAPABILITY_BLOCKED`，包含 taskId、baseSha、已完成 artifact、下一条具体 command、实际能力/工具限制；不得长时间原地思考，不得自主降模型、降画质、降门槛或换对象。模型切换由协调层决定。

已有明确 Task Anchor 时禁止重新写 master plan、重新选题或等待用户反复说“继续”。首轮必须实际执行 first command / source diff / numeric probe，或者给出精确 BLOCKED_VALID。一个 Mother 一次只解决一个 primary defect；做完后按 nextTaskPointer 接下一个零件，不能自己发明下一任务。

跨 Mother 完整规范：`haihao0307/guilin-dem-pipeline@8c8635a512d6d136c202e96187f8b31d93325bd9:knowledge/MOTHER_FACTORY_EXECUTION_MODE_R3_ZH.md`。R2 的 LOCK→EXECUTE→VERIFY→PROMOTE、参考复刻、freshness、verifier、单体 HTML 等门禁全部保留；R3 只进一步锁死“Production Mother 主要职责是 EXECUTE，不是重新 THINK”。
