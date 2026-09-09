# Brick Mother R7.1 公网候选验收回执（2026-09-09）

## 固定身份

- 候选：`Brick_Mother_R7_1_Closeout.html`
- 固定提交：`a534aa0503bbc80a2ff8b94193cfcada8a1efd3c`
- SHA256：`6c2718ae3a8b437f96f9a8b1bf0cf77c2a282ae229e55fd588128b262cd8b9b8`
- 字节：`88342`
- 固定公网：`https://rawcdn.githack.com/haihao0307/HOUSE/a534aa0503bbc80a2ff8b94193cfcada8a1efd3c/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/experiments/atelier-r7/Brick_Mother_R7_1_Closeout.html`

## 真实交付链验收

最终验收 workflow：`Brick Mother R7.1 RawCDN Open-Page Verify`

- run：`34336439721`
- job：`102416815940`
- 结论：`success`
- artifact：`10097918015`

实际浏览器链路：

1. 打开上述固定 `rawcdn.githack.com` URL。
2. 浏览器首先收到 `External Content Notice | rawgit.hack`。
3. 实际点击 `Open the page`。
4. 打开后的文档标题为 `Brick Mother R7 · 烧结旧砖`。
5. 打开后的正文 SHA256 与固定候选完全一致：`6c2718ae...b9b8`。
6. 七类材料逐一实际切换通过：烧结旧砖、窑变旧砖、纤维土坯、粗凿砌筑石、不规则毛石、层状毛石、建筑卵石。
7. `390×844` 手机视口：canvas 可见，七类按钮全部可见。
8. page errors：空。
9. 存在一条非阻断 console `404` 资源警告；不影响单文件工作台主体与七类交互，因此不得把它表述成“零 console 警告”。

## R7.1 实际改动

- 层状毛石：每个 seed 派生稳定主导层理方向。
- 土坯纤维：加入端点严格为零的二级微弯曲，保留既有双端埋入约束。
- 删除两处失效的 `leaveLegacy` 调用，修复七类切换/暂停的运行时欠账。
- R5、R6、R7 历史文件均未覆盖。

## 人工门

- `humanVisualApproved=false`
- `productionApproved=false`
- PR #15 继续 `open / Draft / 未合并`

R7.1 已完成“固定文件 + 固定提交 + 固定公网 + 真实浏览器 + 移动端”的技术交付闭环，但不等于 3A 视觉终版。人工视觉复核发现层状毛石仍存在明显的整面阶梯式厚度起伏，读感偏“横向堆叠软条”，因此后续只允许在新的 R7.2 隔离候选中重做该家族的层理形态，不得回头覆盖 R7.1，也不得顺手重做其余六类。
