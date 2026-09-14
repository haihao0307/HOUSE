# Tiles Mother 08E · 08D 外观基线 / 接触校正

08E 只处理 08D 已记录的两个结构接触问题，不重新设计瓦、不改变尺寸、排布、Microscope 17 层形态函数、PBR 色彩或用户已经认可的 08D 视觉方向。

08D 的 CPU 接触记录为：

- 板瓦 / 筒瓦默认首对：`-0.5222757979708794 mm`
- 左椽 / 板瓦：`-0.3097305168461122 mm`

负值代表投影接触检查中的穿透。08E 使用同一组刚体 `SEATS`，只对 Y 就位做亚毫米修正，并把目标间隙设为 `+0.02 mm`：

- `panY` 上移 `0.3297305168461122 mm`
- `coverY` 上移 `0.8720063148169916 mm`
- 其余 `step / spacing / rafterRadius / angle / roll / phase` 不变

`build.py` 从 08D 固定源码派生自包含 `START_HERE.html`，同时复制同一套接触检查器。构建预测不是验收结论；只有实际运行 `qa_geometry.cjs` 后 `contactPassed=true` 才能关闭这两个穿透问题。

人工状态保持：`visualApproved=false`、`productionApproved=false`。08D 的用户“基本成功”记录只作为外观基线，不自动升级为生产批准。
