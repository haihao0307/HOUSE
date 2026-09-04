# Brick Mother 版本与资产地图

## 1. 正式冻结核心

### 1.1 V2.7.5 三栏观察台

路径：`source/brick-mother/brick-mother-observation-studio.html`

Git blob：`7b2a18c6a886d0751ca2fc92530b7986d9e1a727`

角色：真正的 V2.7.5 操作页面，公开根入口使用此页面。

修改权限：禁止修改。

### 1.2 V2.7.5 单文件运行时

路径：`source/brick-mother/brick-mother-standalone-v2.7.5.html`

Git blob：`7b10389cb9367f7423619262820883cc94b07a61`

运行时身份：`2.7.5-alpha.1`

角色：烧结砖、石材、土坯三类核心材质运行时。

修改权限：禁止修改。

### 1.3 V2.6 高变化版

路径：`source/brick-mother/brick-mother-standalone-v2.6.html`

Git blob：`f64c65d87dc418bf1a923a4cf332b449efbe0eb9`

角色：保留更强的色彩、孔洞、破损和形体变化，用于回看与继续提取有效经验。

修改权限：禁止修改。

## 2. 综合组织层

### 2.1 V2.7.6 综合工作台

路径：`source/brick-mother/workbench-v2.7.6.html`

角色：在一个页面中组织 V2.7.5、V2.6、PBR 实验和知识页。

默认内容：真实 V2.7.5 快开视图。

边界：只组织版本，不拥有覆盖核心的权限。

### 2.2 版本矩阵

路径：`source/brick-mother/VERSION_MATRIX_V2.7.6.json`

内容：冻结核心、保留版本、实验路径、性能策略和审批状态。

## 3. PBR 实验档案

### 3.1 实时风化 PBR V1.1

入口：`source/brick-mother/experiments/pbr-weathering-v1.1/index.html`

配套文件：

1. `brick-mother-realtime-weathering-pbr-v1.1.css`
2. `brick-mother-realtime-weathering-pbr-v1.1.js`
3. `brick-mother-stone-form-geometry-v3.5.js`
4. `brick-mother-weathering-geometry-v1.1.js`

保留内容：年代、降雨、干燥、积尘、盐析、生物附着、磨蚀、孔隙率、硬度、基础粗糙度、中尺度起伏和诊断通道。

状态：实验档案，人工视觉批准关闭，生产批准关闭。

### 3.2 日光 PBR V1.4

入口：`source/brick-mother/experiments/pbr-daylight-v1.4/index.html`

配套文件：

1. `studio.webmanifest`
2. `studio-icon.svg`

保留内容：后期日光环境、六类材料家族、诊断通道和交互研究。

状态：实验档案，人工视觉批准关闭，生产批准关闭。

缓存边界：实验目录内不允许注册能够控制 Brick Mother 根目录的 Service Worker。

## 4. PBR 知识层

### 4.1 可执行规则

路径：`source/brick-mother/knowledge/PBR_GUIDE_PRODUCTION_RULES_V1.json`

用途：将用户提供的完整 PBR 手册转成机器可读的生产约束。

### 4.2 人工检查页

路径：`source/brick-mother/knowledge/pbr-guide-production-rules-v1.html`

用途：快速检查线性空间、介电 F0、Base Color、Roughness、AO、Height、Normal、多通道传播和验证门。

### 4.3 原始手册边界

知识来源：Wes McDermott《The PBR Guide》第三版，2018 年 2 月。

原始 PDF 不随公开全量包重新分发。包内保存项目蒸馏规则、来源信息和页码索引。

## 5. 核心源码

以下源码支撑真正的 V2.7.5：

1. `brick-mother-app-v2.js`
2. `brick-mother-geometry-v2.js`
3. `brick-mother-renderer-v2.js`
4. `brick-mother-gaea-kernel-v1.js`
5. `stone-response-study.js`
6. `VERSION.json`
7. 材料档案 JSON 与项目内必要的本地依赖

性能改造不得直接修改冻结 HTML。需要改动核心 JS 时，先复制成版本化候选文件，并让候选 HTML 只调用候选 JS。

## 6. 相关工作流

全量包收录下列工作流，便于新窗口继续审计：

1. `brick-mother-observation-studio-smoke.yml`
2. `brick-mother-smoke.yml`
3. `brick-mother-v2-smoke.yml`
4. `brick-mother-v27-source-retry.yml`
5. `brick-mother-stone-study.yml`
6. `brick-mother-v275-full-handoff.yml`
7. `brick-mother-v276-deploy.yml`
8. `brick-mother-v276-full-handoff.yml`

## 7. 公开页面与本地页面

公开根入口保持真正的 V2.7.5 三栏观察台。

综合工作台只通过独立路径开放：`workbench-v2.7.6.html`。

全量包根目录提供 `START_HERE.html`，通过本地 HTTP 服务一次打开全部版本。

## 8. 权限与审批

1. `humanVisualApproved=false`
2. `productionApproved=false`
3. `pbrCandidateApproved=false`
4. `performanceCandidateApproved=false`
5. PR #15 保持 open、Draft、未合并
