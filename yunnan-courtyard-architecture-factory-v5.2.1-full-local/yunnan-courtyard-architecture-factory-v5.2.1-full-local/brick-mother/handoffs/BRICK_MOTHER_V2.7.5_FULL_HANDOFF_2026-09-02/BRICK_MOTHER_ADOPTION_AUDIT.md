# Brick Mother 统一方法论接入前审计

审计版本：0.1.0  
日期：2026-09-01  
规范版本：1.0.0，原文状态 `candidate_for_user_review`  
结果：`RECEIVED_AND_AUDITED_RUNTIME_NOT_INTEGRATED`

## 1. 本轮实际边界

已完整阅读用户所附方法论 17 节与第 12.1 节全部规则 JSON。第 15 节是规范原作者的交付状态，不能作为 Brick Mother 的实现记录。本文不改共同规则，不把资料接收记作运行时接入。

本轮只读仓库、解压并验证当前构建证据、执行本地现有代码探针、生成本审计文件。无 GitHub 写入、提交、推送、合并、重新部署或其他 Mother 的修改。冻结的 V1.0、main、gh-pages、源模型及权威真值保持原状。当前可见预览不能据此获得生产资格。

## 2. 已核对的身份与交接差异

仓库：`haihao0307/HOUSE`  
分支：`feature/brick-mother-v2.0-composite-material-dna`  
PR：#15，open、Draft、未合并  
本轮读取的远端 HEAD：`b25508b8b57d45f9333286ab7b883644181039e7`  
冻结基线：`release/brick-mother-v1.0`，`77ce0a1bc63d301829942c14e5708fc16a06cdcd`

主运行时版本仍为 `2.7.5-alpha.1`。石材研究运行时是 `stone-response-s1.1`。PR 正文主要描述 `54f9ae9f43c078522ac6e082c4a857e57b06fae2` 的旧证据，不能将正文中的历史测试归到新 HEAD。

已校验交接包 `BRICK_MOTHER_V2.7.5_CLEAN_FULL_PACKAGE_2026-08-30.zip`：406,965 字节，48 个文件，47 条清单逐文件哈希通过，ZIP CRC 通过。SHA256 为 `583d6120132a977bb2fcd4d52fe13c1e44c22406c8e28c5ef70ea46563db1c2b`。包内运行时来源是 `fa142a834a74dc2009a161553d713acf77324c26`，落后于当前分支。它适合历史恢复，不能直接覆盖最新源码；包内旧删除清单本轮未执行。

上一轮实际交付的 `BRICK_MOTHER_STONE_REVIEW/STONE_STUDY.html` 及其 QA 指向 `5420ec41480a3a0280c11ad28f8318eb5ed86a72` 的 S1.0。当前仓库 S1.1 已有更新，需要重新形成完整交接。不能把旧 S1.0 画面当成 S1.1 的最新画面。

通用知识小包 V1.0 的 SHA256 为 `d69ecd2677507db9342a1d66092a8d6cf4255141346b14cc4629303bf1c4f396`，已通过完整性核验。其旧字段 Schema 允许扩展字段，不具备本次统一规则所需的严格拒绝能力，只保留资料定位。

## 3. 仓库规则核对

读取了父项目 `AGENTS.md`、`README.md`、`PROJECT_STATE.md`、`docs/SYSTEM_ARCHITECTURE.md`，以及 Brick Mother 的 `releases/v1.0/README.md`。确认数据来源与展示分开、推测不得直接写成几何硬规则、旧目录不得恢复为当前发布根、冻结版本不得擅自改动。

父项目文档中的建筑 V5.4.2 和发布到 main 的说明属于建筑主线，不构成本轮 Brick Mother 的写入授权。父项目全建筑验证本轮未重跑，也未扩展建筑、瓦作、木材或地形任务。

## 4. 已有基础与尚未满足的共同要求

### 4.1 形态、结构和多通道材料：已有局部实现

`brick-mother-geometry-v2.js` 的 `buildFormationEvents`、`createSDF`、`buildMesh` 中已有尺寸、负向孔洞、裂隙、层理、悬沿、纤维与拉脱槽事件。生成器输出事件列表、SDF/拓扑命中统计和真实网格。现有统计属于生成器诊断；其中 shader 命中值在 CPU 对同类场采样统计，不能冒充 GPU 遮罩逐像素仪器测量。

`stone-response-study.js` 的 `stoneFields` 已用一个静态 wet 量分别影响基色变暗和粗糙度，矿物场参与色彩与局部光泽。这提供共享原因、多输出的局部组织基础。当前 wet 仍是手动视觉控制量，没有降雨、遮挡、排水、含水状态及干燥历史求解。

四种石材共用同一块旧石材网格，只比较光学方向。四套独立岩性结构、实际晶体与层理形成过程、材料速率标定均未完成。

### 4.2 家族默认值：已有代码与抽查证据

`brick-mother-app-v2.js` 的 `controlDefaultsForProfile`、`globalControlDelta`、`controlsForChild` 从各 profile 的 `compositeDefaults` 取值，再加入显式全局增量和子代偏移。本轮探针对石材 `rockDetail`、土坯 `inclusion` 的保留情况通过。现有证据包含各家族有效参数快照。`inclusion` 已在几何重建控件列表。

该基础仍缺共同策略加载、严格领域参数 Schema、合成后配置哈希及实例历史。不应将这一部分扩大解释为统一系统完整接入。

### 4.3 种子与实例身份：部分可复现，存在明确缺口

同输入、同版本、同 seed 的 CPU 几何重复生成通过；仅改 color seed 的 36 个 SDF 采样一致。

发现两项需要修正的问题：

1. `seedBankForProfile(profile, cycle, explicitMaster=null)` 使用 `Number.isFinite(Number(explicitMaster))`。默认 null 变为 0，通过判断后 master 被截成 1。石材 cycle=0 和 cycle=1 都得到 master=1，阻断依赖该默认路径的“换一窝”。显式给定 master 的测试不能覆盖此缺陷。
2. `buildFormationEvents` 和结构方向的随机流使用 `damage XOR detail`。只改变 detail，会改变主要 bedding、shear、cavity 等事件。当前 detail 无法作为严格独立的微细节过程命名空间。

当前派生依赖 profileBias、childIndex 和固定偏移，没有完整的 `entityId + processId + seedDerivationVersion` 身份体系。新增层不扰动其他过程的测试、孩子局部历史持久性测试仍缺。

### 4.4 环境与时间历史：未接入

未找到符合规范的 `S(t)`、`initialState`、`environmentHistory`、`interactionHistory`、三种时间、求解设置、重放或检查点接口。研究页 `loop()` 的时间仅用于相机与灯光动画；不代表石材发生演化。

缺少原因关闭后的输出变化测试、同历史重放、不同帧率和播放速度的同物理时刻一致性、不可逆损伤持久性和适用过程的收支检查。没有校准速率前，不应把滑杆赋予真实十年或百年含义。

### 4.5 真值、单位和尺度：来源已登记，物理尺度尚有限制

材料档案保留源文件名、字节数、哈希及来源信息。石材明确标记 `source-units-pending-calibration`。`normalizedDimensions` 与 `specimenDimensions` 使用展示归一化尺寸。它们不能直接作为毫米或米制测量结果。

所有场仍需补 quantity、unit、coordinateSpace、spatialScale、temporalCorrelation、bounds、source、uncertainty。过程还需输入输出、适用尺度、更新规则、边界、校准状态及失效条件。对单纯光学预览可以说明不涉及物质收支；环境材料交换过程不能套用该豁免。

## 5. 三种展示模式审查

| 模式 | 目前基础 | 待接入 |
| --- | --- | --- |
| neutral_inspection | 固定基准拍摄、基色诊断、固定参数照明 | 独立命名和版本化预设；相机、曝光、白平衡及色彩变换锁定；同状态 A/B；灯光切换源状态哈希不变的实测 |
| studio_beauty | S1.1 可转灯光、手调曝光；两个硬编码方向光与环境项 | 独立 key、fill、rim；开关、方向、强度和颜色；单位、色温转换版本及能力声明；与对象状态分离 |
| diagnostic | 主线 11 个通道；研究页基色、粗糙、法线、矿物 | 统一通道图例与数值范围；原因和结果关联、状态历史、需要时的结构剖面；稀疏暗图可读性 |

当前最终画面不能同时代替中性和工作室证据。现有 shader 没有自动曝光这一点，只能支持局部行为观察，不能自动证明严格中性模式已完成。四套石材颜色不同，也不能替代三类展示模式。

## 6. 规则硬控制与具体接入位置

下列均为确定后的接入计划，本轮没有安装这些新入口。

1. `brick-mother/policy/`：保存原样共同规则、原版严格 Schema、原版 validator 和哈希说明。原文来源条目与固定字段保留；通用模块另用中性名称。此前最小知识包不能覆盖或放宽共同规则。
2. `brick-mother-app-v2.js`：在 `main()` 读取规则；在 `buildCurrentBatch()`、`bindControls()`、`exportDNA()` 验证规则版本、领域参数与有效配置。校验通过之前不得生成正式候选或导出合格资产。
3. `stone-response-study.js`：在 `start()`、`build()`、参数 input 处理与导出按钮加入同等门禁。将对象与材料状态、环境状态和展示参数分开；不要把当前祖先 `sourceHead` 当作运行时和部署 HEAD。
4. `brick-mother-geometry-v2.js`：在调用边界拒绝未知键、错误类型与越界值，再进入内部归一化；保留显式且被记录的可选 clamp 逻辑；补充过程元数据及稳定种子命名空间。
5. 新候选 `evolution-state.js`：实例身份、初始条件、环境与交互历史、三种时间、不可逆状态、重放与检查点。后续必须由单个可验证案例推进，不能只新增空对象字段。
6. 新候选 `data/presentation-presets.json` 与两套 renderer 的适配入口：实现三个明确模式和能力说明；灯光只改展示状态。
7. `data/brick-material-profiles-v2.json`：独立领域 Schema 与版本映射。当前内嵌档案的 schemaVersion 为 2.7.4-alpha.1、version 为 2.7.3-alpha.1，需明确它们和引擎 2.7.5 的兼容规则，不能靠盲目统一版本号消除问题。
8. `tools/capture_evidence_v275.py`、`tools/capture_stone_study.py` 与 Brick 专属两条 workflow：增加统一配置、语义、展示和构建身份测试，保留失败证据，区分预览可用与验收阻断。不得修改其他 Mother 的发布流程。

## 7. 本轮实际测试结果

### 7.1 包、源码与文件身份

四份 ZIP 的外层 SHA256 和 CRC 全部通过；干净全量包 47 条文件清单通过。当前证据中提取的几何与字段内核逐字节匹配当前仓库 Git blob。9 个实际脚本的 Node 语法检查通过。上述检查只证明对应文件与语法，不证明统一配置或物理正确性。

按原文转录的规则 JSON 通过标准 JSON 解析，拒绝重复键和非有限字面值的读取器未发现此类输入。本次没有原版严格 Schema、原版 `validate_mother_policy.py` 和原始 28 项报告，因此没有复跑或宣称 `POLICY_DOCUMENT_VALID`。

本包规则 JSON 的 SHA256：`fe69ea88c05d9b8c74e79e21c2c2c719dc096b677848eb40305575f08b5b8fdf`。该哈希仅绑定本地转录的 UTF-8/LF 规则文件；原附件 MD 字节在执行沙箱未挂载，原 MD 哈希保持空值。共同 Schema 与 validator 哈希也保持空值，不能猜填。

### 7.2 新执行的现有代码探针

12 项：8 通过、4 失败。测试使用精确 HEAD 的构建产物内现有代码，仅在测试上下文暴露内部函数，并禁止应用 main 自动执行；没有修改生成算法或仓库。

通过：家族默认值抽查、inclusion 重建声明、同主种子派生可复现、color seed 的 SDF 采样隔离、CPU 网格重复生成、网格数值有限、输入 profile 未改写、必需几何命中记录存在。

失败：默认随机换批不改变 master；未知控制键未拒绝；越界 damage=999 被静默截为1.6；detail seed 改变主要结构事件。未知键和越界项目对应本次统一规则要求，表明缺门禁；不将它们伪装成新接入后的回归结果。

CPU 网格复现条件：Node v22.16.0、stone seed8231、quality0.40、grid24×24×16、9984三角面。positions+normals SHA256 两次一致：`c65c0484c3e3ea3674163918a8148f88700362c42f2f1759d44b9291d87efd89`。不能据此宣称跨 GPU 逐位一致。

### 7.3 当前 HEAD 的远端证据

三材质工作流 run `33458112053` 成功，artifact `9782256363`。下载包 SHA256 为 `1f18bfd93d1099d651b20590b6dadb1a401bae5a07d142efd34c0eb5a96f54d9`。包含24张主证据和2张特写；参考并排对比记录为 skipped。源码明确实际800×500渲染后放大到1600×1000。1600×1000属于交付画布，不能称为原生渲染分辨率。

石材工作流 run `33458112049` 失败，artifact `9782267239`。下载包 SHA256 为 `68b246de153a64d91058d0677127b7fcbf3175648f18bbc870a6fe515c72e0d9`。内部报告 localPassed=true、standalonePassed=true、publicPassed=false、passed=false。浏览器视口1440×1000，石材画布截图原生970×869，无重采样。两条公网路线都返回确认中转页，未成功进入应用；HTTP200不能替代应用加载成功。

这两份报告是本轮重新获取、解压并核验的既有远端执行证据。本轮没有触发新 Actions run。

### 7.4 本轮浏览器尝试

本地 Chromium 分别尝试 `file://` 与 loopback HTTP，均在页面加载前出现 `ERR_BLOCKED_BY_ADMINISTRATOR`。本轮浏览器新增行为测试执行数为0，状态为环境阻断。没有为灯光不改几何、湿润响应或三模式完整性生成新的通过记录。远端已存在的本地浏览器通过状态，与本轮沙箱阻断分开记录。

### 7.5 参考原件找回

本轮在当前文件中找到了精确参考 PNG。尺寸2048×682、SHA256 `f439b732f9b62584dac96ad5b4ab19dc77d48105d4b092cc21b064ee59c27cfb`，与仓库参考门禁完全一致。现在可记录本地参考身份已核验。远端旧 run 的并排对比仍保持 skipped，本轮没有重做参考相似性或授予视觉批准。

## 8. 最短接入闭环建议

先补齐原版严格 Schema、validator 和原始校验报告，再固定策略哈希与领域接口。先修复默认种子与已发现的依赖问题，建立严格输入门禁。

首个接入候选限定在石材研究中的一个实例，使用明确的环境输入、边界和含水历史。含水状态分别驱动基色与粗糙度，记录不同响应函数；已有损伤保持不逆转。没有实际标定时使用明确示意状态和时间，不宣称真实年限。物理尺寸需取得依据或保持展示单位预览标签。

在完全相同对象状态下补齐中性、工作室、诊断三个预设，输出状态哈希、有效参数、种子谱系、时间历史、灯光参数、原生像素、错误日志和精确构建身份。完成同历史重放、播放速度与帧率一致、展示不回写源状态、家族与实例隔离及公网实测后，才提交运行时接入回执。

烧结砖目前不扩展新视觉修改；土坯稻草仍等待用户参考及自然分布验证。不得借接入规范重建冻结资产、覆盖其他 Mother 或删除权威资料。

## 9. 最终回执状态

`methodologyReceived=true`；`policyJsonExtracted=true`；`runtimeIntegrationVerified=false`；`repositoryWritesPerformed=false`；`visualApproved=false`；`productionApproved=false`。

共同原则按1.0.0保持，不降级为表面噪波包，不由局部任务增加例外。每个待接入入口、缺失哈希、失败测试和未验证项均保存在机器回执中。

## 10. 可追溯来源

规范来源：用户附件 `MOTHER_UNIFIED_EVOLUTION_METHOD_V1.0.0.md` 第1至17节，尤其第2至6节、第10至14节。文件引用身份 `file_00000000244081f7aaec3a92572eb9d5`，正文可读取，原始字节不可访问。

仓库元数据：`https://github.com/haihao0307/HOUSE/pull/15`  
精确源码根：`https://github.com/haihao0307/HOUSE/tree/b25508b8b57d45f9333286ab7b883644181039e7`  
三材质执行：`https://github.com/haihao0307/HOUSE/actions/runs/33458112053`  
石材执行：`https://github.com/haihao0307/HOUSE/actions/runs/33458112049`

实际包哈希、参考身份与代码 blob 核验保存在原审计环境的 `SOURCE_AND_INTEGRITY.json`；探针保存在 `RUNTIME_PROBE_REPORT.json`。这些源文件的保存只作为资料与证据交付，不代表跨窗口运行时同步。
