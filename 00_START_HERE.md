# Brick Mother 全量接续包 · R2.14.2 · 2026-09-14

本包汇集当前 Brick Mother 仓库源码、R2 材质至 R2.14.2 形状版本、运行依赖快照、本地接续资料、QA 证据和规则，用于在新任务接续。不是整个 HOUSE 仓库，也不是生产就绪或最终通过的声明。

## 当前状态与冻结决定
- 源分支 codex/brick-r25-glb-shape-final，提交 61e59bd01824d11e20a5de67b154dafe63278bdc。
- 最新候选 R2.14.2，几何源码提交 d40492520f2638437a3eb729d442ff778e26bc9c。
- R2.4 大形、比例、厚度保持；R2.1 B 材质冻结，显微开启，strength=1、scale=1、heightContribution=1、roughnessContribution=0。毛石、土坯冻结。
- 继续项是侧边、角部与连续表面细节。不得重定义尺寸或重新制作已认可材质。
- 原任务报告平均像素差异 1.120、强变化 2.84%、覆盖率 4.78%，覆盖率未达到 5.5%。这些数值是原任务记录，本次未重跑。
- 本次直接查询 GitHub：run 34748672288 已完成、结论 failure；原始 API 记录和可取得的 QA 截图已入包。
- 像素差异不证明与参考一致或用户认可。下一步应核对边线和角部的参考对应证据，不能只追逐覆盖率。

## 阅读顺序
1. 本文件、SOURCE_LOCK.json、EXCLUSIONS.json。
2. rules/ 两份 Mother 原件；规则要求先检验身份、参考架、连接和边界逻辑，再验外观。清理完成状态本次未代签。
3. local-history/brick-mother-continuation-20260912/MATERIAL_BASELINE_LOCK.json。
4. repository/brick-mother/experiments/shape-edge-lab-r2-14/Brick_Shape_Edge_Lab_R2_14.html。
5. DEPENDENCY_LOCK.json 和 runtime-dependencies/；再按需查看其他实验版本和 qa-r2142/。

## 包含内容与路径
- repository/brick-mother/：源仓库 Brick 子目录的可交接文件。为避免 Windows 长路径，移除了两层冗长的建筑父目录；原前缀见 SOURCE_LOCK.json 的仓库信息和构建脚本。
- repository/.github/workflows/：Brick 历史及当前 workflow 作为资料存档，禁止自动批量运行。
- runtime-dependencies/：R2.14.2、R2.13.1、R2.11、R2.1 的实际依赖版本，均从对应提交逐字节保存。
- local-history/：已有 R2/R2.1 源码、脚本、反馈、QA 和 2026-09-14 状态同步。
- prior-handoff-metadata/：较早交接的说明和清单，仅为历史来源；其中旧清单不表示本包包含全部旧文件。
- qa-r2142/ 与 GITHUB_QA_*.json：GitHub 现有 QA 截图和状态证据。
- MANIFEST_SHA256.json、verify_package.py：逐文件完整性校验。

## 运行与开发限制
原始源码保持不变，入口仍 fetch 固定公网 URL；保存依赖文件不等于 HTML 已自动改为离线加载。开发者可依据 DEPENDENCY_LOCK.json 将 URL 映射到本地快照。浏览器和 Python/Playwright 等环境未打入包。早期脚本可能引用旧目录布局，运行前先按本包路径调整。

原始参考 GLB 未在当前获取的 Brick 仓库和本地交接中找到，因此没有伪称包含。已包含提取后的 EDGE_FIELD_COEFFICIENTS.json 和观察说明；若要重新分析参考几何，仍需原始 GLB。完整聊天数据库和会话中的参考图片不在本包范围。

已撤销技能及可能内含这些技能的旧压缩包不重新打入本包；排除列表见 EXCLUSIONS.json。旧任务、旧源码和历史包都不构成恢复旧工具的授权。本次只做交接打包，不改变几何或生产新资产。

## 既有固定公网候选入口
[R2.14.2 候选版](https://rawcdn.githack.com/haihao0307/HOUSE/d40492520f2638437a3eb729d442ff778e26bc9c/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/experiments/shape-edge-lab-r2-14/Brick_Shape_Edge_Lab_R2_14.html)

本次是用户明确要求的源码全量包上传，不是新网页发布。此前公网浏览器连接失败，未完成本地会话的公网复验。不得把打包成功写成预览验收通过；已有固定预览不改写。

## 校验和接续
解压后运行 `python verify_package.py`。清单覆盖所有包内文件，清单本身不自哈希；ZIP 的 SHA256 另附。

新任务提示：先读 00_START_HERE.md、SOURCE_LOCK.json 和 rules/；接续 R2.14.2，继承 R2.4 大形与 R2.1 B 材质冻结。当前仍未最终通过。先核对参考对应证据与现有 QA，再处理侧边和角部。遵守对象定义和固定公网交付规则，不加载撤销技能，不覆盖旧版。
