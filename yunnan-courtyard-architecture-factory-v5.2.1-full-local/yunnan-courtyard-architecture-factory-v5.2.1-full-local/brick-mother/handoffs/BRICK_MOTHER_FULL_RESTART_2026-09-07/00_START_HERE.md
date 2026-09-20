# Brick Mother 全量交接与重新启动入口

日期：2026-09-07

## 当前真实状态

- 仓库：`haihao0307/HOUSE`
- 工作分支：`feature/brick-mother-v2.0-composite-material-dna`
- 打包前生产 HEAD：`3edbcfbdeef850aa1a7e0cc7ca71d664f8b7ad15`
- PR #15：open / Draft / 未合并
- 唯一视觉基线：R5.0.0
- R6：材质与色彩回归，只保留作失败对照
- humanVisualApproved=false
- productionApproved=false

## 为什么重新启动

本轮在 Macroscopic microscope R2、参数 QA 和隔离样板上投入过多，完整产品视觉收敛不足。重新启动后停止扩展新路线，只从 R5 视觉基线做有限修正。

## 必须保留的用户要求

1. R5 的整体视觉、相机、灯光和曝光。
2. 烧结砖保持红砖主体，白色接近零，灰黑只做淡而局部的窑痕。
3. 窑变砖白色大幅减少，避免规则撒点。
4. 土坯加入真实稻草与小稻壳，壳边、内外面、埋入和露出关系要能读到。
5. 粗凿石减少光滑感，凿面、断口和硬转折要真实。
6. 花岗岩主要用于不规则毛石；砂岩、玄武岩、石英岩等按岩性组织材质。
7. 卵石整体圆磨，表面只保留轻微起伏。
8. 湿润、粗糙度、色彩层次等公开控件必须肉眼明显且真实接线；无效控件删除。
9. 历史强烈版本作为可切换对照保留。
10. Macroscopic microscope R2 只作为内部组织方法，不再单独作为用户交付物。

## 下一阶段验收门

固定同一对象、同种子、同机位、同灯光、同曝光对比 R5。任何已接近成功的部分发生视觉退步，立即撤销该项修改。整组砖、石、土坯、卵石都完成后才交付。

## 固定交付格式

每个给用户审看的版本必须：

`单文件 HTML -> GitHub 固定完整 commit SHA -> raw.githack 直开链接`

禁止用 sandbox、漂移分支链接或中间教学页替代主交付。

## 恢复顺序

1. 先读取 `experiments/atelier-r5/`，R5 是唯一视觉起点。
2. 读取 `VISUAL_BASELINE_LOCK_R5_2026-09-06.md` 与 `RAW_GITHACK_DELIVERY_CONTRACT.md`。
3. 读取 `knowledge/macroscopic-microscope-r2-user-core-20260906/`、`knowledge/brick-instance-identity-r1-20260906/`。
4. 读取 `experiments/mm-r2-probe-20260907/`，只把它当技术小样，不当产品基线。
5. R6 只用于失败对照，禁止从 R6 继续增量。

## 当前技术小样

`experiments/mm-r2-probe-20260907/index.html` 已保留 Macroscopic microscope R2 的对数球坐标、17层前缀、稳定 brickId 和 A=0 恢复测试。它没有完成孔洞、几何边角、土坯纤维、稻壳和石材接入，不能冒充成品。
