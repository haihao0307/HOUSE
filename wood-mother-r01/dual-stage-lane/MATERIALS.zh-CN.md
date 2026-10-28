# 木材代表风格 r01（原创近似；未物种标定）

## 已核实资料与边界
- 中国科学院华南植物园：[此“红木”非您想象中的“红木”](https://scib.cas.cn/hx/201709/t20170918_6734858.html)。家具语境红木是类群统称，不是一个准确物种；本例命名“红褐硬木风格”，不作材种鉴定。
- [Phoebe zhennan 心材颜色代谢组研究，2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9658324/)：支持提取物与心材颜色的关系。没有据此把所有楠木称为“富油”，也不将颜色形成解释成金属颗粒。
- [不同树龄楠木精油与香气研究，2024](https://pubmed.ncbi.nlm.nih.gov/38595765/)：精油研究不是表面油蜡涂层研究。存在可提取挥发成分不等于未处理木表面具有厚油膜。
- [Marschner 等，Measuring and Modeling the Appearance of Finished Wood, 2005](https://www.cs.cornell.edu/~srm/publications/SG05-wood-lr.pdf)：木纤维下表面散射与白色表层反射应分离；纤维方向可倾出表面。这里原创一个低阶锥状方向瓣演示，不复制论文实现，不宣称完整复现论文或金丝楠实测 BRDF。

## 补丁范围
仅 `rich-materials-lane`；不发布，不改生产入口，不改 geometry。
- PROFILES 添加 6 红褐硬木风格、7 金丝楠风格。原 0–5 保留。
- wood：新增两个风格沿现有 growth-age 域的细长色带，不是屏幕噪点。
- fiberLight：同一 growth 域中央差分取梯度，构造与生长年龄等值面相切的纵向纤维，随光线和视线改变产生方向光泽。不是仅改变 baseColor，也不使用 metalness。
- shade：在原底层反射上加入有色纤维瓣；原白色 coat 独立保留。
- prepare：family 上限改为 PROFILES.length-1，其余不变。
- functions.json 提供可合并函数与完整 profiles。集成者保留其新增 geometry-normal/instance 逻辑，不应整文件覆盖集成引擎。

## 三种 finish
裸木：粗糙底层，无 coat。油蜡：吸收加深+较低粗糙度+弱保护层。透明涂层：保留裸木底色，独立白色表面高光。不是三种木种；本参数为视觉原型非测量值。

## 实测
`node probe.cjs`：3000 次方向光泽有限性测试；同物点换视角结果改变；透明 coat/baseColor 精确相同；油蜡粗糙度降低。六张 600×420 实际CPU渲染 PNG，styles-grid.png 为拼图（不是浏览器截图）。已经人工查看：红褐与黄褐风格、哑光/油蜡/罩光差异存在；仍明显程序化、环纹较规则，不能称照片级。
计时单线程完整近景帧约 0.54–0.68 秒；新风格每命中点有六次 growth 求值用于方向，旧风格立即返回不增加此成本。此计时不代表浏览器 FPS；真实双物体性能由集成测试再测。

## 回退
删除新增两个 profile，恢复 materials-lane 的 wood/shade/prepare，移除 fiberLight 即回到 v10。没有外部贴图、未受权素材或新增依赖。
