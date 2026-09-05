# Tiles Mother V0.9.9 学习工作台

从 START_HERE.html 打开。单文件内置 Three.js；没有外部扫描模型、纹理或网络依赖。

A 原形原材质调用 V0.9.8 生成器；B 新形原材质只改边口形体；C 新形新材质启用有限色层与条痕。A/B/C 使用相同相机和观察光。单片边口特写、边口/端面/俯视/底面、灰模、UV、48片及860片均保留。图像参考选择只在本地浏览器内显示。审阅参数可保存为JSON。

新几何采用独立边线种子、端线扰动、六带圆钝剖面、缓变厚度和局部损伤。边界曲线幅度是有范围的候选，未声称从线描精确恢复全部轮廓。原测绘比例不改。UV按面角分离，重复位置的法线单独平均，避免焊接掉纹理接缝。新的圆钝侧面检查使用壳体法线和边口向外方向，保留UV方向及负例检查。

原有 makeDetail、clayShader、setLight 三块源码逐字节锁定；新表面层独立包裹原着色器。原版微孔/浅划痕、色群概率、生命史、木构及实际接触求解继续继承。新几何缓存独立，改变形体强度会重算落座。

源码接续：source/edge_geometry.js、material_study.js、study_ui.js、study.css 是本次新增。tools/build.py 从相邻 v098/ 的冻结HTML和唯一主源码重建 source/app.js 与 START_HERE.html。构建检查 V0.9.8 HTML SHA256 与三个锁定代码段。命令：python tiles-mother/v099/tools/build.py；node tiles-mother/v099/qa/geometry.cjs；python tiles-mother/v099/qa/browser.py --quick；python tiles-mother/v099/qa/browser.py --full。

QA 的原始生成记录与浏览器证据在 qa/。浏览器检查含固定A/B/C、桌面及390×844、实际网格接触、UV、6秒运动窗口。软件渲染的性能记录不能代替用户设备。检查范围外的种子/参数及长期物性不作保证。

本轮原始 ZIP 和完整贴图未进入网页。Jiangwutang 源身份为 ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365；关联依据见 ../knowledge/jiangwutang-001/SOURCE_REACCESS_20260905.md 与 ../knowledge/xiaoma-learning-r1/。厚度和颜色解释沿用纠错后的记录。

visualApproved=false；productionApproved=false。V0.9.8 基线及全量包保持原样。候选工作台未部署公开站点，仓库更新与离线交付不等同于公网发布。
