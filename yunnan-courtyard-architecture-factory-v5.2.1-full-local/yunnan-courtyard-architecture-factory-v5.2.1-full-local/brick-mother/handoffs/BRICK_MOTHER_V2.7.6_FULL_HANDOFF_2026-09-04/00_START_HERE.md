# Brick Mother V2.7.6 全量交接入口

交接日期：2026-09-04

仓库：`haihao0307/HOUSE`

工作分支：`feature/brick-mother-v2.0-composite-material-dna`

Draft PR：`#15`

## 新窗口的读取顺序

1. 先读本文件。
2. 再读 `CURRENT_STATE.json`。
3. 再读 `VERSION_AND_ASSET_MAP.md`。
4. 再读 `KNOWN_ISSUES_AND_NEXT_TASKS.md`。
5. 最后读 `NEXT_WINDOW_PROMPT.md`，并按其中顺序继续执行。

## 当前必须保持的版本关系

1. `brick-mother-observation-studio.html` 是真正的 V2.7.5 三栏观察台，也是公开根入口所使用的页面。
2. `brick-mother-standalone-v2.7.5.html` 是真正的 V2.7.5 单文件三维运行时。
3. `brick-mother-standalone-v2.6.html` 是必须保留的高变化版本。
4. `workbench-v2.7.6.html` 是新增综合入口，只负责组织各版本和实验，不能改写冻结核心。
5. `experiments/pbr-weathering-v1.1/` 与 `experiments/pbr-daylight-v1.4/` 是保留的 PBR 实验档案，均未获视觉批准。
6. `knowledge/PBR_GUIDE_PRODUCTION_RULES_V1.json` 与 `knowledge/pbr-guide-production-rules-v1.html` 是当前 PBR 手册蒸馏结果。

## 冻结身份

1. V2.7.5 三栏观察台 Git blob：`7b2a18c6a886d0751ca2fc92530b7986d9e1a727`
2. V2.7.5 单文件运行时 Git blob：`7b10389cb9367f7423619262820883cc94b07a61`
3. V2.6 高变化版 Git blob：`f64c65d87dc418bf1a923a4cf332b449efbe0eb9`

以上三个文件必须保持字节级不变。所有性能与材质改进都必须进入新增候选文件。

## 在线入口

1. 原 V2.7.5 根入口：`https://haihao0307.github.io/HOUSE/brick-mother/`
2. 综合工作台：`https://haihao0307.github.io/HOUSE/brick-mother/workbench-v2.7.6.html`
3. 原 V2.7.5 三栏观察台：`https://haihao0307.github.io/HOUSE/brick-mother/brick-mother-observation-studio.html`
4. V2.6 高变化版：`https://haihao0307.github.io/HOUSE/brick-mother/brick-mother-standalone-v2.6.html`

## 当前真实状态

1. V2.7.5、V2.6、两个 PBR 实验与 PBR 知识页已经被同一综合工作台收纳。
2. 公开部署的 HTTP 身份检查已经通过。
3. 真实 Chromium 软件渲染检查已经确认综合工作台可见，V2.7.5 Canvas 存在，运行时身份为 `2.7.5-alpha.1`。
4. 软件渲染环境记录的综合外壳就绪约为 720 ms，主样本就绪约为 13.6 s。该数值只属于工程诊断，不能视为真实硬件性能结论。
5. `humanVisualApproved=false`。
6. `productionApproved=false`。

## 继续工作的边界

1. 保持 PR #15 open、Draft、未合并。
2. 禁止修改 `main`、`release/brick-mother-v1.0`、`gh-pages`。
3. 禁止覆盖三个冻结版本。
4. 禁止让 PBR 实验成为默认入口。
5. 禁止生成静态图片替代三维网页交付。
6. 新一轮优先处理 V2.7.5 启动性能，再处理独立 PBR 候选。
7. 所有新候选必须提供同镜头、同几何、同灯光、同曝光对照。

## PBR 手册版权边界

用户提供的 Wes McDermott《The PBR Guide》第三版是知识来源。全量包只收录项目蒸馏规则与来源说明，不重新分发原 PDF。