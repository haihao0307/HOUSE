# Brick Mother Unified Workbench R3

本目录是 Brick Mother 的单一工作台候选版。四种模式共用一个工作台：

- 单砖
- 砖墙 + 抹灰
- 石头
- 土墙 + 抹灰

## 冻结边界

- 单砖继续采用已冻结的 `R2.14.8.1-B`，本版不得改变其形体、材质系数或 Microscope 结果。
- 冻结 B 的 Microscope 参数为：`strength=1`、`scale=1`、`heightContribution=1`、`roughnessContribution=0`。
- 新墙芯、抹灰和土墙的 Microscope 几何计算与 legacy brick / `CORE-exact` 隔离；调墙体或抹灰不得回写或改变冻结单砖。

## R3 用户指定规则

- 砖墙端部按皮交替顺砖与丁砖。
- 排砖允许真正的半砖：半砖有自己的封闭切面和几何长度，不以纹理或视觉缩放冒充。
- 墙芯、抹灰和土墙的 Microscope 必须实际移动顶点，改变形状；色彩与表面纹理变化只是同一场的附加表达。

这些是本版按用户要求采用的工作台 preset，不应从参考 GLB 反推成普遍砌筑规范。

## 参考资料边界

`转堆brick_stack.glb` 只用于离线视觉蒸馏，用来观察砖堆的转角、层次、边缘和表面变化。它不随工作台发布或在运行时加载，也不作为尺寸标尺、比例依据或砌筑规范。来源、授权与文件指纹详见 `REFERENCE_DISTILLATION.json`。

## 状态

本目录当前是候选实现和审计资料。自动化检查通过不等于人眼验收：`visualApproved=false`，`productionApproved=false`，须由用户继续视觉确认。
