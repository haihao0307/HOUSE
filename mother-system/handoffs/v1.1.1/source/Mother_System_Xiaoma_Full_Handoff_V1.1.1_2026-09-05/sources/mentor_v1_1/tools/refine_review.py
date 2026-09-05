"""Apply the second review's documented editorial corrections to a copy."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
DETAILS = ROOT / 'details'


def replace_once(path, before, after):
    body = path.read_text(encoding='utf-8')
    assert body.count(before) == 1, (path.name, before[:80], body.count(before))
    path.write_text(body.replace(before, after), encoding='utf-8')


for path in DETAILS.glob('*.md'):
    body = path.read_text(encoding='utf-8')
    path.write_text(body.replace('小马', '小妈'), encoding='utf-8')

review = DETAILS / '01_REVIEW.md'
replace_once(review,
    '**建议继续，并把接下来一个月的工作集中到一个可验证的学习与生产闭环。** 目前最应该追求的成果，是同一种错误不再反复出现，新证据能修正有关对象，另一项任务能复用已经验证的方法。这比继续增加 Mother 名称或编写更宏大的世界观更有价值。',
    '**建议继续，下一轮先在现有生产任务中诊断一处反复出现的错误，再用有限试验验证修正、保存和复用。** 阶段目标是减少同类返工，让新证据正确影响相关产物，并观察方法在不同任务上的效果。具体试点与投入应依据实际资产、证据和阻塞状况决定。')
replace_once(review, '## 3. 必须修正的八个概念', '## 3. 需要澄清的八个概念')
replace_once(review,
    '一次 Mother 学习周期，至少应交付：一个适用范围明确的结论、一份可复用方法或代码改动、一个反例或失败条件、一份新旧对照、一个迁移任务的结果。没有迁移验证时，可以说“这个样本改好了”，暂不说“掌握了这类对象”。这类流程积累也不能自动解释为底层模型权重已经被训练。',
    '普通修正先留下目标、关键依据、前后差异和结果；准备宣称某项方法可复用时，再补适用范围、反例和不同任务的迁移结果。没有迁移验证时，结论限于当前样本。不能因为一次修正没有迁移实验就否认它的价值，也不能把外部记录积累解释为底层模型权重已经被训练。')
replace_once(review,
    '以下全部为建议。先在文件和一个可重建索引上实现，再根据实际瓶颈扩展服务。',
    '以下是逻辑职责划分，全部为建议。先复用已有文件、工具和工作流；只有实际查找、协作或重建问题需要时，再增加索引与服务。六个逻辑边界不要求建设六套平台。')
replace_once(review,
    '建议先用 Git 管理小型文本、规则和配置，用独立文件区保存大证据及内容散列，用 JSON 记录实体，用 SQLite 建可重建的结构化查询与全文索引。先验证中文分词、别名、旧地名和编号检索；选了 FTS5 并不等于召回已经可靠。[SQLite FTS5](https://www.sqlite.org/fts5.html)',
    '建议先复用现有版本控制、证据文件和少量结构化记录。实际出现反复找不到适用记录、跨任务查询或索引恢复需求时，可试用 SQLite 建可重建索引；不将新增数据库列为第一次修正的前置。若采用全文检索，要测试中文分词、别名、旧地名和编号；选了 FTS5 并不等于召回可靠。[SQLite FTS5](https://www.sqlite.org/fts5.html)')
replace_once(review, '### 5.1 一轮十步\n',
    '### 5.1 一轮需要回答的十个问题\n\n以下是思考顺序，可以合并在一页任务记录中。按本轮用途选择必要检查，不要求每次小修改都新增十份记录或运行整套生产验收。\n')
replace_once(review,
    '这样才能区分改善来自记忆、评测还是单纯多花了计算。小样本结果用来决定下一次实验，不作普遍能力排名。',
    '这有助于判断改善是否与记忆、评测或额外计算有关。小样本、任务难度差异和模型随机性仍会限制归因，应报告这些因素；结果用于决定下一次实验，不作普遍能力排名。')
replace_once(review, '### 6.1 最需要的不是一个更长的观察提示词\n',
    '### 6.1 先诊断视觉错误的来源\n\n检查、记忆和复核能提供反馈，不保证执行模型就能看懂或修好对象。对一个已有正确参照的失败样本，建议先区分：原始证据缺失；已有证据未检索到；相机/尺度不匹配；观察者看到了但解释错误；结构表示或生成工具表达不了；导出/渲染造成偏差。分别补证据、修检索、校准观察、加入明确测量或人工标注、修改表示/工具、排查运行转换。若只有专业人员或独立测量能判断某个关键点，就保留该检查接口，不继续依赖同一模型重复自评。\n')
replace_once(review,
    '本地瓦片样本是很合适的起点。',
    '本地瓦片样本提供了一个可考虑的起点，但尚未比较所有 Mother 的现有样本。')
replace_once(review,
    '**优先建议：利用已有瓦片资料，完成“有限屋面样片：证据 → 结构描述 → 参数化变化 → 材料状态 → 固定验收 → 新证据修正 → 另一类任务复用”。**',
    '**先从已有生产任务中选择试点。瓦片是当前可见的候选，尚不能认定为全系统最优选择。** 建议小妈用现有清单快速比较候选的来源可取得性、验收依据、当前返工问题、修改范围和跨能力依赖。若瓦片合适，再完成“有限屋面样片：证据 → 结构描述 → 参数化变化 → 材料状态 → 固定验收 → 新证据修正 → 另一类任务复用”。')
replace_once(review,
    '首周完成的含义应是：能证明这套流程会抓住一个已知错误，会保存正确版本，会因一条证据变更更新相关产物。并不要求首周就做出完整历史建筑或整个开放世界。',
    '首次小试验的目标是：抓住一个有明确正确参照的错误，完成修正并保存可恢复版本；有适用的依赖案例时，再验证证据变更怎样影响产物。完成时间由实际任务与资源决定。单次通过只验证相应案例，不能据此宣称整体学习系统已经成熟。')

roadmap = DETAILS / '02_HANDOFF_AND_ROADMAP.md'
replace_once(roadmap,
    '4. 优先做已有瓦片样本的有限闭环；如果另有证据更完整的样本，可以按同一选择标准替换。',
    '4. 先按实际证据、当前失败和修改成本选试点；瓦片是候选，不能因评审所在目录而自动确定。')
replace_once(roadmap,
    '| D08 / P1 | 文件/Git＋可重建结构化索引起步 | 先验证查询和恢复，再判断服务需求 | 多人写入激增后需数据库服务；早期重型平台拖慢验证 | Memory；中文别名查询、索引恢复与冲突测试 |',
    '| D08 / P1 | 先复用现有记录，实际查询瓶颈出现后再试结构化索引 | 避免把新平台变成首次改进的前置 | 文件索引足够时维持现状；多人写入增加后再评估服务 | Memory；通过真实查询与恢复问题决定是否引入 |')
replace_once(roadmap,
    '建议对象：从已有瓦片资料中选择一个可明确描述的局部屋面组合，涉及有限重复瓦件、至少一个端部/搭接检查、一个支承关系和四种材料/暴露状态。',
    '先用小妈已有的项目清单选样本，不新增一轮全项目文档工程。优先选择：原件可取得、错误有明确对照、能在现有流程内修正、修改范围有限且能暴露一个真实依赖的问题。瓦片若满足条件，可选有限屋面组合；首项只验证当前关键错误，材料/暴露状态按后续问题再增加。')
replace_once(roadmap,
    '## 4. 七天工作安排\n\n这是一种顺序和相对工作量安排，不是对未知人员配置的日历承诺。若某项未过，后续独立工具工作可继续，依赖该项的真实性结论不得越过。',
    '## 4. 七个工作阶段（原七天安排改为顺序示例）\n\n现有材料没有团队投入与任务耗时，不能合理保证每阶段只需一天。以下改为工作顺序；一次首次试验通常只选其中与目标有关的部分。相邻阶段可以合并，已实现的部分直接复用。若某项未过，独立工作可继续，依赖该项的真实性结论不得越过。')
body = roadmap.read_text(encoding='utf-8')
body = body.replace('| 天 | 主要工作 |', '| 阶段 | 主要工作 |')
for i in range(1, 8):
    body = body.replace(f'| 第 {i} 天 |', f'| 第 {i} 阶段 |')
body = body.replace('必须在第 1 天根据设备、网络、展示目标确定', '应在相关运行任务开始时根据设备、网络、展示目标确定')
body = body.replace('10/10 关键检索题找到适用记录；五类注入全被抓住；有效对照不被全部拒绝',
    '固定示例检索题和对应有效对照通过；五类已知错误被定位；这些只作为流程检查，另留新题测试并逐项报告漏报/误报')
roadmap.write_text(body, encoding='utf-8')
replace_once(roadmap,
    '建议再保留五个有效对照，避免评测通过“一概拒绝”获得表面高分。每个注入都应有确定的预期和影响范围。',
    '每个坏样本都配一个确认为有效的对照；固定坏样本应被定位，对照应通过。对照被错误拒绝也算检查失败，不能以只放过一个对照获得通过。先由适合的测量或专业复核确认这些样本的预期；它们只验证已知规则是否生效，仍需另留新样本测未知错误。')
replace_once(roadmap,
    '## 5. 第一月、三个月和十二个月\n',
    '## 5. 第一月、三个月和十二个月的规划情景\n\n以下时间与样本数量是便于讨论的规模示例，没有实际人力、算力和来源获取工时支持，不作为承诺、强制配额或通用合格线。先测一次真实修正的成本，再由小妈调整投入和阶段；小样本通过不构成统计意义上的普遍可靠性证明。\n')
replace_once(roadmap,
    '如果首月后仍无法发现已知错误，不扩充世界面积和 Mother 数量。',
    '如果试点仍无法发现相应已知错误，先不把这项能力的适用范围扩到更大的世界或更多 Mother；其他已有证据支持的生产工作可以继续。')

contracts = DETAILS / '05_CONTRACTS.md'
replace_once(contracts,
    '## 2. 七类记录\n',
    '## 2. 七类逻辑记录\n\n首次试验可把“任务目标与关键依据、前后版本与检查结果、失败原因与下一步”合在一页记录里；只有重复数据、跨任务引用或自动处理实际需要时，才拆出下表的独立对象。七类记录是表示设计参考，不是首次开工的七套必建模块。\n')

resource = DETAILS / '03_RESOURCE_MAP.md'
replace_once(resource,
    'P0：立刻用于闭环；P1：首月/近期领域试验；P2：样板通过后按需。资源优先级表示当前项目用途，不是对软件水平的排名。',
    'P0：可优先解决当前相关问题；P1：近期有对应试验时查；P2：后续按需。优先级不要求先读完该组全部资料。36 项是导航，其中目录/产品入口的核查深度低于具体技术段落；资源存在不证明本方案有效，工程建议还需本项目试验。')

risks = DETAILS / '04_RISKS_AND_QUESTIONS.md'
body = risks.read_text(encoding='utf-8').replace('七天、一月、三月、十二月建议', '七阶段、一月/三月/十二月规划情景')
body = body.replace('补一页已实现能力和一个实际产物入口', '复用小妈已有清单，补实际产物入口；无需重写全项目文档')
risks.write_text(body, encoding='utf-8')

examples_path = DETAILS / 'contracts/examples.json'
examples = json.loads(examples_path.read_text(encoding='utf-8'))
examples['recipient'] = '小妈'
examples['revision'] = '1.1'
examples['purpose'] += ' Roof pilot is conditional on actual candidate comparison; plans are not dispatched.'
examples['decisions'][0]['proposed_change'] = 'Select a bounded existing production failure using evidence availability, a defensible acceptance reference, current rework, and correction cost; a roof patch is one candidate.'
examples['decisions'][0]['scope'] = 'Conditional pilot selection. No project-wide best-asset claim or calendar commitment.'
examples['tasks'][0]['independent_next_steps'].insert(0, 'Use the existing project inventory to check whether this candidate is suitable; do not recreate a full inventory.')
examples_path.write_text(json.dumps(examples, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('Applied second-review corrections to authored materials; original input files remain byte-identical.')
