# 云南建筑总工作台 V0.2.0

所属：建筑蓝图与总体系。共同规则：Mother V1.0.0，原JSON保持不变。当前默认入口进入 first-building/ 首栋建筑预审，旧工作台保留在 workspace.html。

用户已撤回旧整栋作为后续母版的用途。本轮将旧生成器保留为只读失败样本，默认页面不加载它。仅对原生成器的实际北墙顶点与主屋面基层作独立检测，形成可重复的错误拦截；没有修补并重新包装旧房屋。

## 当前能力

首栋的尺寸记录、轴网和标高控制图；旧错误的明确选看；中性、工作室、法线诊断；平移、旋转、缩放和复位；实际查错结果及证据缺口；有效观察参数导出。

候选来自原三开间前廊个案的结构化记录。该记录当前缺少四份原图回核，原登记为用户提供的二手图，建筑身份、精确剖面及构件截面仍待核。图中线面只是图纸控制辅助，不表示已经建好柱、梁、楼面或屋顶。算术闭合不等于测绘可靠，查错程序通过不等于建筑合格。

新栋完整几何、真实安装节点、全排水、承载安全、历史演化及跨Mother总装尚未实现。visualApproved=false，productionApproved=false。

## 构建与验证

`python architecture-workbench/tools/build_first.py --app-root <既有工程根目录> --repository-root <仓库根目录>`

先运行既有知识数据构建，再运行 first-building/run-audit.mjs。源文件哈希不匹配即停止。最终更新构建身份、当前审查数据哈希和所有自有产物的清单。VERSION、CHANGELOG.md、PROJECT_STATE.md均为本工作台独立版本，不改其他生产线版本。

`python architecture-workbench/first-building/browser_qa.py --site <完整站点目录> --output <证据目录> --expected-sha <提交>`

`python architecture-workbench/first-building/browser_qa.py --url <真实公开入口> --output <证据目录> --expected-sha <提交>`

两端独立执行实际触控或鼠标操作，测试观察模式、源几何指纹、完整入镜、导出和批准状态。tools/archive_qa.py为保留的workspace.html选择入口，并调用原tools/browser_qa.py的完整测试，原测试算法未改。

## 保护范围与缺口

发布仍仅更新 architecture-workbench/ 前缀。专用工作流从最新成功Pages部署提取完整站点，叠加本线产物，逐文件验证其他路径不变，并在部署前再次核对并行发布状态及本分支HEAD。禁止用旧站点包覆盖其他Mother更新。

共同规则的本地哈希为80aef698e30a6378e25d6eeb7c6ee67c1df24e6ae96faef5f4df4ef62d19c8d3。官方Schema、上游校验器和原MD原始字节仍待接收。本轮属于预审及观察入口的局部实现，未宣告共同演化运行时全部接入。
