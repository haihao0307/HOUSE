# 本线当前状态

版本0.2.0。任务：首栋建筑预审与旧错误隔离。

主分支保持 feature/yunnan-component-studio-v1，PR #13保持Draft。允许写入 architecture-workbench/ 与其专用发布工作流。其他Mother、旧生成器、真值源和冻结资产不可变。

已经实现：尺寸链、轴线顺序与数量校验；实际北墙顶点对屋面下包络测试；未知证据不能转为通过；三模式和移动相机观察。

运行结果从 first-building/data/audit.json 和当前构建浏览器报告读取，不能由本状态文件代替执行。新栋完整几何、原图核验、榫卯、完整排水、承载安全、历史演化均未完成。

后续优先：独立追索原图，复核净距与轴距，确定剖面，再建立两榀相邻构架的完整进深片段。不能从其他区域论文补成默认构造。

visualApproved=false，productionApproved=false。
