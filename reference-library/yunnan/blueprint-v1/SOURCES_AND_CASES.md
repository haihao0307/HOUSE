# 来源、案例与使用限制对照 V1

整理基线：HOUSE 的 `feature/yunnan-component-studio-v1`，提交 `b1bacf6040dfde8acd223234c24325e5b494c993`。这里记录知识整理所依据的版本，不把它称作其他专业线的最新版本。

## 1. 旧系统来源

文中的 APP 指仓库目录 `yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local`。

R01：[系统数据](../../../yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/data/system_v5_2_1.json)。采用其知识主题、对象 ID 和原有证据状态；本轮没有重新验证其尺寸、地域归属和运行成果。

R02：[系统架构](../../../yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/docs/SYSTEM_ARCHITECTURE.md)。采用旧知识组织与认识顺序，软件实现陈述仍属于原版本。

R03：[世界知识交接](../../../yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/knowledge-handoff/v5.5.1/ARCHITECTURAL_WORLD_KNOWLEDGE.md)。保存间架、院落、屋面、瓦作、墙体和木作的原项目认识。把其中具体案例或实现要求与通用历史结论分开。

R04：[既有用户决策](../../../yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/knowledge-handoff/v5.5.1/CONVERSATION_DECISIONS.md)。用于追溯大理、乌龙村、团结乡参考的观察重点及既有纠正。

R05：[原参考库](../v1/README.md)与[原文件存储状态](../v1/BINARY_ARCHIVE_STATUS.md)。原记录含刘致平图版、测绘图、现场照片和三个 GLB 的清单线索。原存储状态说明部分图片分卷尚未上传；本轮未执行二进制补传或逐卷复核，不能宣告完整原始库已经在 GitHub。

R06：[文献总登记表](../../../yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/component-studio/data/knowledge/yunnan-architecture-literature-registry-v1.json)，schemaVersion 1.3.0。此次以其九个来源 ID 建立知识主题映射，不改变原记录的分类。

支持文件：[白族木构](../../../yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/component-studio/data/knowledge/bai-traditional-timber-hbim-support-v1.json)、[合院数据库](../../../yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/component-studio/data/knowledge/yunnan-courtyard-spatial-database-support-v1.json)、[迪庆土司](../../../yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/component-studio/data/knowledge/yunnan-tibet-tusi-manor-knowledge-v1.json)、[重复与低权重审查](../../../yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/component-studio/data/knowledge/yunnan-literature-support-review-20260831.json)。

## 2. 旧对象如何进入新框架

| 原对象 ID | 保存的身份 | 在蓝图知识中的位置 | 保持的边界 |
|---|---|---|---|
| BRANCH-CENTRAL-YUNNAN-YIKEYIN | 滇中紧凑合院支系 | 院落、间架、平立剖的既有研究入口 | measuredCaseAvailable 是旧状态，不能等同本轮验证 |
| BRANCH-WESTERN-YUNNAN-NAXI | 旧系统纳西院落支系 | 院落类型与单体剖面类型分别索引 | 保留旧标签，不用白族论文替它补尺寸 |
| CASE-YUNNAN-THREE-BAY-FRONT-GALLERY-2F | 地域未定三开间前廊两层个案 | 具体测绘案例入口 | 地点和族属仍待明确 |
| REFERENCE-TUANJIE-001 | 团结乡参考 GLB | 院落空腔、分组、入口和坡地关系 | 扫描参考不自动提供隐蔽构造或1940年代状态 |
| REFERENCE-DALI-001 | 大理参考 GLB | 屋面层级、墙面综合色及材料过渡 | 地域名称不等于已核实的单栋类型身份 |
| REFERENCE-HAOSI1-WULONG-001 | 乌龙 WL 参考 GLB | 瓦墙、风化、木作及洞口观察 | 本轮不重新测量模型或推断墙内构造 |

旧系统 `BRANCH-BAI` 与 `BRANCH-YI` 的 pendingEvidence 状态不被近期支持论文解除。论文中的具名案例也不与三个 GLB 按地名自动合并。

## 3. 九项已登记文献的落点

页码均指 PDF 阅读器页码。中文简称用于本项目索引；原题、作者和书目身份以登记表及原文为准。

| 索引 | 已有来源 ID | 原分类与用途 | 本版映射与限制 |
|---|---|---|---|
| L01 | YN-LIT-1992-NAXI-01 | B2_BACKGROUND，19页 | 地域、术语、住宅个案和社会背景；不定义全云南尺寸 |
| L02 | YN-LIT-1994-NAXI-02 | B2_BACKGROUND，18页 | 第1页调查对象，第5页等案例平剖作为局部线索；家族关系不代替节点证据 |
| L03 | YN-LIT-1999-DALI-RENLIYI | B2_BACKGROUND，8页 | 第2至4页空间使用、称呼与更新；不从生活空间直接推定承重体系 |
| L04 | YN-LIT-1999-MENGLIAN-DAI | B2_BACKGROUND，7页 | 继续按已有登记保留空间层级和地区比较；本版没有新增逐页提取 |
| L05 | YN-LIT-2023-LEJU-YIKEYIN | B2_BACKGROUND，8页 | 第1至3页研究范围与术语，第4页新住宅图；1972至2021年样本不充当1940年代真值 |
| L06 | YN-LIT-2026-SHIPING-HEYUAN | B2_BACKGROUND，10页 | 第2至3页范围与构成，第6至7页改修；居住者身份与原建传统分开 |
| L07 | YN-LIT-2024-BAI-TIMBER-HBIM | B1_SUPPORTING_METHOD_REFERENCE，26页 | 第7至8页对象、属性、关系、方法；保留组织思路，不采用未经核验的几何精度和结构性能主张 |
| L08 | YN-LIT-2023-COURTYARD-SPATIAL-DATABASE | B1_SUPPORTING_METHOD_REFERENCE，19页 | 第8页字段，第13页附近编号关联；作者报告432个样本，项目未取得432套原始测绘 |
| L09 | YN-LIT-2025-DIQING-TUSI-MANORS | B1_REGIONAL_ARCHITECTURAL_REFERENCE，26页 | 第3至4页范围与方法、第7至13页院落及立面比较；限定迪庆土司庄园，重复文件不计新来源 |

九项来源全部维持低权重的背景或支持用途。表中的 B1 是原有用途类别，不能被解读成优质资料或生产批准。本轮不复制论文全文，也不把论文中的参考文献算作已阅读原件。

L01原登记年份为1992，此前对话曾称1993；L02文件简称为1994而PDF页眉写研究年报1993。原 ID 保持不变，年报标年与实际出版日期作为书目待核事项，不在本轮静默统一。

## 4. 需要随知识一起保存的问题

合院论文第8页的 B1d 为 B1b/B1a，B1e 为 B1a/(B1a+B1b)。两者分别保存，不能都称作院落占宅地比例。B2c表名与段落最高点定义、roof slope与roof angle、DEM与DSM的不同写法均按原支持记录保留待核。

土司论文第12页正文二层层高上限与表4的小中甸数值存在不一致；逐层增高的概括也未获表内所有案例支持。既有审查已记录，原表数值与文字同时保留，不求平均消除矛盾。

白族论文的参数化关系可作方法支持，生成模型本身不能证明历史正确、结构性能或真实榫卯。完整原始尺寸、节点图和验证材料不足的部分继续待补。

已有旧汇编可能仍给上述论文较高等级。新知识的人工引用按后续用户审查限制处理；本轮不声称已经修改旧运行时的证据读取逻辑，也不批量迁移旧数据。

## 5. 用户讲授与本次整理建议

U01：用户指定当前窗口负责建筑蓝图与总体系，后续联系 Brick Mother、Tiles Mother、墙体、木构和木纹。

U02：用户要求先共同判断资料价值，再蒸馏；重点是建筑测绘、间数、材料、构造及有依据的细节。低价值论文可以保留背景，不因学术形式直接变成权威。

U03：用户对参考墙提出墙体主体、宽厚及收分、洞口闭合、石土衔接、墙顶连续、砖面突出量、抹灰、内外墙、深褐土体和植物纤维等认识与要求。它们绑定当前参考和项目目标，具体历史配方及普遍性未获证明。

U04：用户要求土坯、烧结砖、石材分别控制；多尺度复合种子、孔洞、磨损和纤维细节共同工作；各家族保持自身默认值。微观与构件尺度的分离保留为项目控制思路，具体实现另线验证。

U05：各专业独立深化，通过共同建筑身份、轴网、标高、部位和证据联系。当前只整理知识，实际接入等待后续工作。

以上为对本对话的整理性转述，未伪装成原始测绘。共同字段、概念层次和接口提纲属于本项目整理建议；用户已确认总体方向，尚未对每个未来接口字段逐项签认。

## 6. 尚未成为知识真值的材料

此前仅列为候选、尚无明确采用决定的一颗印气候模拟资料，不因本轮整理自动升级。未取得全文的173页联合调查报告、纳楼土司测量论文PDF、尚待用户提供的专著与图纸，只保留既有线索，不宣称已经读完或提取。

新资料到来后，按具名案例、部位、时间、图号及测量口径对接。至少建立一个可追溯的结论记录，再判断该证据能支持什么；不以补齐表格为目标制造不存在的数据。
