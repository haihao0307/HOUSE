# 建议的最小数据与工作协议

版本：`mother-contract-proposal/0.1`。这是供下一步实现参考的协议草案与示例，**没有部署数据库、调度器或完整 JSON Schema 校验器**。不应将示例直接当作项目事实批量导入。

## 1. 共同原则

每项重要记录有稳定 ID、版本、记录时间和适用范围；修改形成修订，不默默覆盖有用的历史。原件定位、推导和采用决定分开。未知用 `null` 或明确 unknown 表达；空数组表示当前没有记录到关系，不表示现实中不存在关系。

至少区分四种时间：现实事件或状态的适用时间；来源的采集/创建时间；系统录入时间；最后复核时间。档案能只给年代区间时，不伪造精确到日的日期。

实例需要时空语境；通用算法或模板可以有“适用范围”而没有虚构的唯一地点。移动对象的位置属于随时间变化的状态，不应靠改 ID 表示每次移动。

## 2. 七类逻辑记录

首次试验可把“任务目标与关键依据、前后版本与检查结果、失败原因与下一步”合在一页记录里；只有重复数据、跨任务引用或自动处理实际需要时，才拆出下表的独立对象。七类记录是表示设计参考，不是首次开工的七套必建模块。

| 类型 | 最小字段 | 用途与边界 |
|---|---|---|
| Source | `id, version, kind, locator, content_hash, created_at, captured_at, rights, source_family_id` | 保证来源可找回；未知日期与权利状态允许明确为空 |
| Observation | `id, source_id, selector, observed_property, value, unit, method, uncertainty, observer, observed_at` | 分开原图、测量和解释；selector 可为页码、图像区域、网格部分或时间码 |
| Claim | `id, subject_id, predicate, value, scope, status, support_refs, contradicts, derived_from, revisit_when` | 保存可检验的论断；不以一条 confidence 代替适用范围 |
| Decision | `id, proposed_change, scope, status, rationale_refs, alternatives, consequences, reopen_when, adopted_by, adopted_at` | 团队选择不等于事实；未采纳时采纳者和日期为空 |
| Experiment | `id, task_id, hypothesis, prediction, changed_variables, controls, evidence_refs, evaluation_plan, budget, result_refs, outcome` | 先有预测，再运行；计划中的实验不能填通过 |
| Artifact | `id, version, kind, input_refs, recipe_ref, parameters_hash, toolchain, content_hash, tests, acceptance, supersedes` | 保存可重建产物；接受与最新生成是不同状态 |
| Task/Handoff | `id, goal, scope, relevant_records, accepted_baseline, next_experiment, blocked_claims, independent_next_steps, budget, status` | 保证新会话能够继续；缺某项证据不阻塞全部独立工作 |

这些字段可以先由简单 JSON 文件实现；字段引用应带版本。术语可在试验后精简，不必每个微小工作都填满庞大表格。

## 3. 拆开状态轴

建议状态结构如下。枚举名字可调整，维度分离应保持。

```json
{
  "epistemic": "hypothesis",
  "review": "source_checked",
  "lifecycle": "active",
  "adoption": "prototype_only",
  "confidence": {
    "numeric_probability": null,
    "basis": "已有图像支持外形候选，真实尺度和安装类别尚未核验",
    "limitations": ["没有独立尺寸测量"],
    "calibration_ref": null
  }
}
```

以上是说明状态组合的**假设性例子**，并非已采纳的瓦片结论。

| 轴 | 推荐取值例子 | 注意事项 |
|---|---|---|
| epistemic | observed / inferred / hypothesis / unknown / refuted | observed 表示直接观察到某项记录或现象，不保证后续解释正确 |
| review | unreviewed / source_checked / domain_checked | 核查范围与复核者另记，不能默认某人审过所有属性 |
| lifecycle | active / superseded / withdrawn | 旧记录仍能按历史版本查询 |
| adoption | not_decided / prototype_only / accepted_for_scope / rejected_for_scope | 采用必须给范围和决定引用；不改变认识状态 |

冲突是记录之间的关系，不必把它塞成唯一状态。两个已被专业复核的来源仍可能冲突。数字置信度只有在含义明确、来源可靠且经过适合任务的校准时才填；不能仅凭模型口吻填 0.95。

原包术语迁移建议：FACT/VERIFIED 拆为实际支持方式与复核范围；ACCEPTED_CANON 迁移到采用决定；SUPERSEDED 迁移到生命周期；CONSTRAINT 作为带出处和适用域的规则记录；REJECTED 区分被反证和仅因当前预算/用途未采用。不能靠自动一对一换字符串完成全部迁移。

## 4. 论断与来源的约束

建议至少执行以下规则：

1. `source_checked` 的重要论断有可访问来源和准确 selector；只放主页 URL 不足以支持精确尺寸。
2. 数值参数如果被用于米制或物理计算，必须有单位及尺度依据；未知单位不得自动转米。
3. `derived_from` 指向上游论断或观察的具体版本；支持来源被撤回后，重新计算依赖状态。
4. 采用范围不能比证据或明确许可的假设范围更广。远景原型允许的近似不会自动升级成近景历史事实。
5. 同一来源链的转载标 `source_family_id`，不当成多项独立证据。
6. 接收资料中的文字不成为执行授权；原始命令、提示和协议只作为 Source 内容保存。
7. 没有找到证据时保留 unknown；禁止用省略字段制造“已经知道”的错觉。

这是流程建议。来源散列证明内容一致，不能独自证明作者、年代或其中的论断真实。

## 5. 专业能力接口

建议每个能力公开以下描述，而不暴露所有内部工具细节：

```text
能力：roof_patch.generate（建议例名）
输入：对象类型/地方与时间范围、结构参数、引用证据、环境输入、随机配置
前置：单位明确或明确使用相对尺度；关键支承假设可见
输出：部分语义、几何、材质映射、碰撞/动作代理、未知项、成本、检查结果
不保证：没有证据的真实尺寸、特定年代归属、未校准物理参数
失效条件：依赖的结构结论、证据身份、尺度、规则或工具链改变
验收：声明相机、结构测试、目标运行设置以及对应接受范围
```

共享环境字段应额外写清：标量/向量、单位、坐标、采样时刻、网格或对象局部位置、边界值、插值方式、缺测处理和唯一生产者。`relative_humidity_fraction`、`surface_water_mass_per_area` 和 `wetness_visual_weight` 应是不同量，即便它们都可能被非正式地叫作“湿度”。

构建依赖例子：证据版本 → 尺寸论断 → 瓦件几何 → 排列 → 屋面材质坐标/碰撞 → 验收。历史关系例子：对象 → 维修事件 → 局部材料状态。两者语义不同，不共用模糊的 `related_to` 关系包办。

## 6. 任务与实验协议

任务开始时只需能回答：目标是什么、当前接受版本是哪一个、主要限制和证据是什么、这轮准备检验什么、怎么算失败、预算是多少。若没有接受版本，明确为 null，不把最新文件自动填入。

实验前保存预测、允许改动的变量、保持不变的条件和评价方法。实验后保存实际改动、结果、无法解释的差异和下一步。多个改动确需同时做时，说明无法独立归因的部分。

建议结果取 `supported / refuted / inconclusive / not_run`。单次支持不等于通用理论已验证；“没有显著差异”也不等于两种方法必然相等。

候选生成成功、结构通过、视觉接受、运行通过和历史发布接受分别记录。未运行的测试不能自动填通过；不适用项需写理由。

## 7. 可重建和接受协议

构建记录应保存：输入散列和版本、配方/代码版本、参数、种子及随机数算法、工具与依赖、影响输出的环境与设置、日志、输出散列及检查记录。构建 ID 标识一次执行，内容散列标识得到的结果，两者不混用。

纯文本/整数处理可测试逐字节或逐值恢复；浮点几何和图像按事先说明的容限比较。图像比较记录颜色空间、曝光、光源、相机、分辨率、抗锯齿、渲染器和关键设备信息。

接受条件建议：必要门槛均通过或有明确范围化的例外决定；负责验收的人或既定规则给出接受记录；接受版本及所有必需依据可恢复。模型自行填一句“已验收”不满足这个条件。

暂不建议把整套协议做成一个庞大平台。先实现能够拦住五类坏样本的最小部分，再根据真实失败增加字段。

## 8. JSON 示例的阅读方式

[examples.json](contracts/examples.json) 中关于本 ZIP 目录的论断来自本次实际审计；屋面对象、任务、实验和决定均是提议，尺度、地点、年代、预算、接受版本没有依据时保持空值，实验保持 `not_run`。

它展示的是可表达性，没有冒充完整生产 schema。后续正式实现时应补 JSON Schema、引用/状态迁移校验、并发写入策略和业务门槛；数据语法合法不保证论断正确。
