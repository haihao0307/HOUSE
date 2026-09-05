# Tiles Mother V0.9.8 全量接续包

打开 START_HERE.html。单文件内置渲染运行时与程序化材质，不需要外部贴图。当前产品版本继续是 0.9.8 Contact Rafter Beams，本轮只做打包、续接说明及发布核验，不改变画面、UV、材质或装配。

先读 RESTART_START_HERE.md，再读 handoff/USER_DECISIONS.md 和 handoff/KNOWN_GAPS.md。三片独立瓦为主体；48片构造台和860片屋面均保留；只有瓦、圆椽和四根较粗横梁，没有木板、望板、挡雨板或隐藏承托平面。

## 文件与重建

source/app.js 是嵌入工作台的唯一执行主源码；contact.js、wood.js、roof.js、cracks.js 为便于研究的准确摘录。修改摘录不会自动修改主源码。修改主源码后运行 python tools/rebuild_html.py，重新跑检查并更新摘录与哈希。source/vendor 保留 Node 几何测试所用运行时。

校验命令：python tools/verify_package.py；python tools/rebuild_html.py --check；node qa/check_geometry.cjs。浏览器核验使用 qa/release_smoke.py，需要 Playwright 1.57.0 和 Chromium。固定种子、年份、维护模式重跑。自动检查只能覆盖报告中列明的配置，不能作为任意参数或人工视觉批准的证明。

## 证据与范围

当前包包含完整可运行 HTML、全部生成源码、配置、材质锁、测绘参数、测试脚本、历史数值报告及本轮重新运行的浏览器证据。原始参考图与历史截图不重复公开，身份与参数保存在 provenance 和 knowledge；详情见 provenance/README.md。

qa/release-refresh 是本轮新证据，qa/inherited 是上轮证据。Windows 用户电脑的实际双击行为未在本环境直接验证。年份、木腐、结构失效与维修参数未做地方实测标定。独立碎片坠落堆积、精细断口、完整结构求解和墙体坍塌尚未完成。

本轮不更改 main、gh-pages、Brick Mother 分支或任何冻结资产，不执行 Pages 部署，不合并 PR。visualApproved=false，productionApproved=false。
