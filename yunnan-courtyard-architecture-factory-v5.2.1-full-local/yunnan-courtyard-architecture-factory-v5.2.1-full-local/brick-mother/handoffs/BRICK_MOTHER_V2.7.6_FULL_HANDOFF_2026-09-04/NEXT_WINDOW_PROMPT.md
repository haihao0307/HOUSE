# 下一窗口直接执行提示

继续处理 GitHub 仓库 `haihao0307/HOUSE` 的 Draft PR #15。

只在现有分支 `feature/brick-mother-v2.0-composite-material-dna` 继续工作。

开始前先读取：

1. `brick-mother/handoffs/BRICK_MOTHER_V2.7.6_FULL_HANDOFF_2026-09-04/00_START_HERE.md`
2. `brick-mother/handoffs/BRICK_MOTHER_V2.7.6_FULL_HANDOFF_2026-09-04/CURRENT_STATE.json`
3. `brick-mother/handoffs/BRICK_MOTHER_V2.7.6_FULL_HANDOFF_2026-09-04/VERSION_AND_ASSET_MAP.md`
4. `brick-mother/handoffs/BRICK_MOTHER_V2.7.6_FULL_HANDOFF_2026-09-04/KNOWN_ISSUES_AND_NEXT_TASKS.md`
5. `brick-mother/knowledge/PBR_GUIDE_PRODUCTION_RULES_V1.json`
6. `brick-mother/VERSION_MATRIX_V2.7.6.json`

开始执行时重新查询远端 branch head。若已有新提交，从最新远端 head 正常快进。保持 PR #15 open、Draft、未合并。禁止强推和改写历史。禁止修改 `main`、`release/brick-mother-v1.0` 和 `gh-pages`。

先验证三个冻结文件：

1. `brick-mother-observation-studio.html` 的 Git blob 必须为 `7b2a18c6a886d0751ca2fc92530b7986d9e1a727`。
2. `brick-mother-standalone-v2.7.5.html` 的 Git blob 必须为 `7b10389cb9367f7423619262820883cc94b07a61`。
3. `brick-mother-standalone-v2.6.html` 的 Git blob 必须为 `f64c65d87dc418bf1a923a4cf332b449efbe0eb9`。

以上文件禁止修改、覆盖、重新命名或删除。

当前公开入口关系：

1. Brick Mother 根入口继续打开真正的 V2.7.5 三栏观察台。
2. `workbench-v2.7.6.html` 是独立综合工作台。
3. V2.6 高变化版必须保留。
4. `experiments/pbr-weathering-v1.1/` 和 `experiments/pbr-daylight-v1.4/` 必须保留，且只能作为实验档案。
5. PBR 实验不得注册能够控制 Brick Mother 根目录的 Service Worker。

下一轮只优先关闭 V2.7.5 启动性能，不同时重做多个材质家族。

性能候选必须采用新增文件，冻结核心继续字节级不变。先把程序化 `buildMesh()` 移入 Web Worker，使用 Transferable ArrayBuffer 传递几何数组。主样本先显示，完整家族按需加载。使用 IndexedDB 建立确定性几何缓存。缓存键需要包含运行时版本、材料 profile、全部种子、全部几何 controls、质量等级和算法版本。静止时停止无意义的连续渲染。阴影只在几何、灯光或相机发生变化后更新。

原版与性能候选必须使用相同 seed、controls、相机、灯光、曝光、几何分辨率和材料输出。核对顶点数、索引数、包围盒和事件统计。禁止通过减少形体事件、降低几何精度、削弱法线或简化材质获得速度提升。

性能闭环以后，再建立一块烧结砖的独立 PBR 候选。严格依据 `PBR_GUIDE_PRODUCTION_RULES_V1.json`：

1. 颜色输入按 sRGB 解释，数据输入按线性值解释，照明计算在线性空间进行。
2. 砖、土坯、普通建筑石材的 Metallic 固定为 0。
3. 常见介电 F0 默认 0.04，除非有实测依据。
4. Base Color 不包含宏观照明与 AO。
5. Roughness 表达微表面分布和表面经历。
6. AO 只影响环境漫反射可达性，不压暗镜面反射。
7. Height 负责低频与中频形体。
8. Normal 负责高频表面细节。
9. 同一个孔洞、裂缝、剥片、积尘或湿润事件必须在相关通道共享空间来源。

PBR 候选必须经过中性棚、明亮日光棚、掠射光和阴天柔光四种固定检查。保持相同镜头、曝光、白平衡、色调映射和占框率。

任何候选在用户批准前保持：

`humanVisualApproved=false`

`productionApproved=false`

交付格式固定为可直接打开的三维 HTML、源码、可审计报告和 GitHub 全量包。禁止生成静态图片替代三维成果。
