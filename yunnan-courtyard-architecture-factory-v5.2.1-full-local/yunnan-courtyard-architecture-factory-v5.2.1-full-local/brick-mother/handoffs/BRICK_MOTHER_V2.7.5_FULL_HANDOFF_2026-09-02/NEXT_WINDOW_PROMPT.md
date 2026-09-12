# 新窗口启动指令

请完整读取本全量包，先读：

```text
00_START_HERE.md
CURRENT_STATE.json
BRICK_MOTHER_ADOPTION_AUDIT.md
MOTHER_UNIFIED_POLICY_V1.0.0.json
MOTHER_UNIFIED_METHOD_SOURCE_REFERENCE.md
```

继续处理 GitHub 仓库 `haihao0307/HOUSE` 的 Draft PR #15。

唯一工作分支：

```text
feature/brick-mother-v2.0-composite-material-dna
```

开始时重新读取远端 HEAD、PR 状态、适用的 `AGENTS.md`、`README.md`、`PROJECT_STATE.md` 与 `docs/SYSTEM_ARCHITECTURE.md`。包内 `GITHUB_BUILD_IDENTITY.json` 记录打包精确提交。远端有新提交时从远端最新 HEAD 正常快进。

保持 PR open、Draft、未合并。禁止强推、改写历史、修改 `main`、`gh-pages`、`release/brick-mother-v1.0`、V1.0 冻结资产、其他 Mother、Pages 设置和权威来源。所有人工视觉批准与 `productionApproved` 保持 `false`。

当前主运行时是 `2.7.5-alpha.1`，石材研究是 `stone-response-s1.1`。烧结砖当前不扩展功能。下一阶段优先继续两个问题：

1. 石材材质响应。继续降低水泥感，分别建立石灰岩、砂岩、花岗岩和板岩的岩性结构、综合色彩、粗糙度、矿物响应和干湿变化。当前四种候选共享一块旧石材网格，只能作为表面研究。
2. 土砖稻草。等待并读取用户参考后，把直杆式分布改为弯曲、锥化、成束、交叠、半埋、露出、折断、拉脱和缺失空腔共同形成的随机关系。

统一世界演化方法论只完成资料接收与接入前审计。后续真正接入需要实际代码和证据。优先修复：

1. 默认换批路径把 null 转成母种子 1 的问题。
2. `detail` 种子影响主要结构事件的问题。
3. 未知参数和越界参数被静默处理的问题。
4. 对象身份、初始状态、环境史、交互史、`physicalTime`、`solverStep`、`displayTime`、重放与检查点。
5. 中性检查、工作室打光、诊断模式的版本化预设，以及展示设置不改对象源状态的验证。
6. 稳定公开网页入口和真实浏览器验证。

每次视觉修改都要提供同对象、同种子、同取景的中性 A/B、工作室检查和诊断证据。自动 QA、视觉批准和生产批准分开记录。缺失、skipped 和 pending 都不能汇总成通过。
