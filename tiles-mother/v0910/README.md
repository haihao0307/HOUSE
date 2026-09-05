# Tiles Mother V0.9.10：同画面性能候选

从 V0.9.9 固定HTML和源码重建，不修改恢复版 V0.9.8 或 V0.9.9。执行 `python tiles-mother/v0910/tools/build.py`，打开本目录 START_HERE.html。材质核心、细节函数、观察光、V0.9.9瓦形与细分、木构腐朽规则均逐字节保持。候选仍需浏览器和用户复核；本文件本身不代表测试通过。

性能改动：精确曲面接触算法复用裁剪暂存数组和访问标记，保留原三角形、公式、遍历顺序和容差；最近两个完整屋面场景LRU复用；大型逐瓦三角形代理在完成装配后释放，主动审计时按原矩阵重新构造；实例矩阵/颜色缓冲按实际数量分配；未变化的全局几何检查复用结果；页面静止时不轮询帧，隐藏时暂停绘制。

`qa/node_bench.cjs` 对V0.9.9与新的接触算法进行同机CPU数值检查，材料构造为测试桩，不算真实浏览器。`qa/browser_compare.py` 在同一CI机器用真实Chromium/WebGL检查新旧几何、接触报告、逐像素画面、冷/热场景计算、静止调度、缓存上限、内存与移动布局。帧率和功能分开记录，不用流水线success替代性能门槛。

目前没有减少瓦片、简化网格、降渲染分辨率、关闭原有阴影或换材质。单帧着色器计算成本基本继承；不预先保证运动FPS提升，更不从CI耗时推算用户电脑温度、风扇或功耗。

这轮照片和用户反馈用于接续：用户认可瓦形与搭接基本接近完成，下一优先级为860片性能；青苔应有独立厚度层，破损木材断口和下层横梁腐朽需要继续细化。仅记录此范围的阶段性认可，不产生全系统生产批准。原件与其他生产线不动。

源码复核发现青苔目前主要来自 `clayColor()` 的 `history.z` 与 `bio` 颜色混合，没有独立有厚度的生长几何；木断面仍由 `woodGeometry.cap()` 平面扇形封口形成。横梁已经有 `beamLoss` 和晚期断段，但完整承载求解与坠落堆积仍未完成。本轮不改这些外观/演化参数，防止性能比较混入形体差异。随后应分别验证局部有厚度苔藓簇、顺纤维断口，以及板瓦漏水到椽子再到横梁的状态传递。

英文官方方法阅读：Three.js Rendering on Demand、Cleanup、InstancedMesh、WebGLRenderer；MDN Page Visibility API。来源定位分别为 https://threejs.org/manual/en/rendering-on-demand.html 、https://threejs.org/manual/en/cleanup.html 、https://threejs.org/docs/pages/InstancedMesh.html 、https://threejs.org/docs/pages/WebGLRenderer.html 、https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API 。文档方法与本轮实测结果分开。

visualApproved=false；productionApproved=false；publicSiteDeployed=false。用户机器的风扇噪音与GPU负载未测量。公开部署遵守既有分支限制，本轮不修改main或gh-pages。
