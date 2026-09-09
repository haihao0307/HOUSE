# Brick Mother R7.2 选定公网审查候选（2026-09-09）

## 选定结论

R7.2 是本轮 R7.1 → R7.4 对照后选定的审查候选，不以版本号最大者冒充视觉最佳者。

- R7.1：技术交付闭环，但层状毛石存在贯穿整面的阶梯式厚度变化，读感偏横向堆叠软条。
- R7.2：移除上述离散整面厚度阶梯，改为稳定主导层理方向、低幅连续层理皮肤、少量局部浅劈裂；仍保留一定自然不规则度，是本轮四版中最平衡者。
- R7.3：压低体积噪声和圆勺式损伤后过度硬化，层状身份明显变弱，不采用。
- R7.4：增加浅平面断面后仍偏平、层状身份不足，不采用。

R7.3 / R7.4 作为失败对照保留，不覆盖、不删除；后续不得把它们的更高版本号解释为生产选定状态。

## 固定身份

- 文件：`Brick_Mother_R7_2_StoneCloseout.html`
- 固定提交：`29c84e1108697c0d1d0698835fa922512a4295f5`
- SHA256：`12b1f6ab83e039c7d0aa5d06c06d439af3d1ee126443c4c3c683654a8e70c71d`
- 字节：`89276`
- 固定公网：`https://rawcdn.githack.com/haihao0307/HOUSE/29c84e1108697c0d1d0698835fa922512a4295f5/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/experiments/atelier-r7/Brick_Mother_R7_2_StoneCloseout.html`

## 固定公网真实验收

Workflow：`Brick Mother R7.2 Selected Public Verify`

- run：`34338144221`
- job：`102422308165`
- artifact：`10098584563`
- conclusion：`success`

HTTP 固定文件验证：

- HTTP 200
- `Content-Type: text/html; charset=utf-8`
- 非附件下载
- 89276 bytes
- SHA256 与固定候选完全一致

真实 Chromium 用户链路：

1. 打开固定 `rawcdn.githack.com` 地址。
2. 出现 `External Content Notice | rawgit.hack`。
3. 实际点击 `Open the page`。
4. 打开后的标题：`Brick Mother R7 · 烧结旧砖`。
5. 打开后的文档 SHA256 再次等于固定候选。
6. 七类逐一真实切换通过：
   - 烧结旧砖：19.5k 面
   - 窑变旧砖：19.4k 面
   - 纤维土坯：65.6k 面，稻草 265，稻壳 48
   - 粗凿砌筑石：22.0k 面
   - 不规则毛石：35.1k 面
   - 层状毛石：40.3k 面
   - 建筑卵石：28.0k 面
7. 390×844 手机视口：canvas 可见，七类按钮全部可见。
8. page errors：空。
9. console 有一条非阻断资源 `404` 警告；不影响单文件主体和七类交互，不能表述成“零 console 警告”。

## 小妈学习接收

继续锁定 `BRICK_MOTHER_XIAOMA_LEARNING_RECEIPT_2026-09-09.md`：只接收稳定对象坐标、多尺度语义、Worley 距离语义审计、几何/材质/显示/身份分离、反例验证与人工门等直接相关方法；不把世界谱/TLO 结构直接塞进砖材质实现。

## 真实状态

- PR #15：`open / Draft / 未合并`
- base：`release/brick-mother-v1.0`
- 工作分支：`feature/brick-mother-v2.0-composite-material-dna`
- `humanVisualApproved=false`
- `productionApproved=false`

技术交付链已闭环，但 R7.2 不是自动宣布的 3A 视觉终版。当前仍可见的主要视觉余量是层状毛石局部偏软；继续改动必须以真实岩石形成逻辑和用户视觉复核为门，不得仅以“版本号更高”或“噪声更多”作为进步证据。
