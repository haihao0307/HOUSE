# 资源导航与原来源表核查

核查日期：2026-09-05。这里只列能对应明确学习产物的优先入口，**不声称穷尽全部领域、评定全世界“最佳”，或已经逐章读完所有书和手册**。已打开文档或核对相关原始摘要/段落；失败与未核对项另列。下表“学习产物、避免事项、优先级”是本次建议。

P0：可优先解决当前相关问题；P1：近期有对应试验时查；P2：后续按需。优先级不要求先读完该组全部资料。36 项是导航，其中目录/产品入口的核查深度低于具体技术段落；资源存在不证明本方案有效，工程建议还需本项目试验。

## 1. 证据、记忆、构建与交付

| ID / 资源与类型 | 优先级 / 负责能力 | 学什么 | 预期交付与收益 | 避免直接照搬 |
|---|---|---|---|---|
| R01 [W3C PROV-O](https://www.w3.org/TR/prov-o/)；标准 | P0 / Evidence | 实体、活动、责任主体及派生关系 | 画通“原件→提取→论断→产物”，使失效可追踪 | 第一周完整实现全部本体；把有来源误当必然真实 |
| R02 [CIDOC CRM 7.1.1 定义](https://cidoc-crm.org/Resources/definition-of-the-cidoc-conceptual-reference-model-v7.1.1)；文化遗产概念模型 | P1 / History | 事件中心的时空、对象与活动联系 | 一个建筑建造/修补/记录事件示例 | 把复杂历史压成对象单一日期；也不必全面部署本体 |
| R03 [STAC Item](https://github.com/radiantearth/stac-spec/blob/master/item-spec/item-spec.md)；时空资产索引规范 | P0 / DEM、Evidence | 地理范围、时间、资产和链接 | 可检索的栅格来源卡，减少找错版本 | 把索引当作历史真实性证明 |
| R04 [SideFX PDG](https://www.sidefx.com/docs/houdini/tops/intro.html)；专业系统文档 | P0 / 小妈、构建 | 工作项、属性、依赖和增量重算 | 一个证据改变时只重建受影响产物 | 节点名字与 UI 当世界本体；无基准就复杂并行 |
| R05 [SQLite FTS5](https://www.sqlite.org/fts5.html)；实现文档 | P0 / Memory | 结构化记录与全文候选检索 | 中英文术语/编号查询和索引恢复试验 | 默认分词已满足中文地名、短词和编号要求 |
| R06 [OpenUSD Introduction](https://openusd.org/release/intro.html)；开源场景系统文档 | P1 / 构建、整合 | 分层组合、引用、非破坏变体 | 证明不同历史候选能隔离与切换 | 把 USD 强层意见当证据置信度；把场景文件当唯一记忆 |
| R07 [Khronos glTF](https://www.khronos.org/gltf/)；交付标准与验证工具导航 | P0 / Runtime | 资产交付、扩展与验证入口 | 导出检查和目标渲染器对照 | 认为格式验证通过即代表视觉、历史或设备验收通过 |
| R08 [GDAL COG](https://gdal.org/en/stable/drivers/raster/cog.html)；地理工具文档 | P1 / DEM | 分块、概览、压缩和 LERC 误差参数 | 同区域、同精度条件的压缩与访问对照 | 以降采样冒充无损；把像元大小写成实测精度 |
| R09 [OGC 3D Tiles](https://www.ogc.org/standards/3DTiles/)；标准 | P2 / World、Runtime | 空间层级、分块和运行交付 | 小样区按视野加载及几何误差策略 | 先把所有世界数据塞进浏览器；把层级交付当证据格式 |

## 2. 形状、视觉、材料与工具

| ID / 资源与类型 | 优先级 / 负责能力 | 学什么 | 预期交付与收益 | 避免直接照搬 |
|---|---|---|---|---|
| R10 [COLMAP Tutorial](https://colmap.github.io/tutorial.html)；原项目文档 | P0 / Observation | 多视重建、相机和几何对应 | 一份有比例/相机依据的采集方案 | 生成视图充当独立观测；无尺度便报米制尺寸 |
| R11 [libigl](https://libigl.github.io/)；几何处理库 | P1 / Geometry | 网格、参数化、距离与几何处理入口 | 一个与视觉问题直接有关的几何检查 | 为复刻库而复刻库；算法成功当语义正确 |
| R12 [LPIPS](https://richzhang.github.io/PerceptualSimilarity/)；作者论文/代码/数据页 | P1 / QA | 感知相似度与人类标注基准 | 与人工错误标注比较，判断是否有辅助价值 | 用单一感知分数代替结构和历史验收 |
| R13 [Physically Based Rendering，第 4 版](https://www.pbr-book.org/4ed/contents)；作者在线教材 | P0 / Material、Lighting | 几何/着色法线、反射、材质、体积与光源 | 建一套中性/掠射/生产照明对照 | 把光学渲染直接当成长期风化模型 |
| R14 [Mitsuba 3](https://mitsuba-renderer.org/) / [逆渲染教程](https://mitsuba.readthedocs.io/en/latest/src/inverse_rendering/forward_inverse_rendering.html)；EPFL 工具与文档 | P1 / Material、Observation | 正向模型与受控参数反演 | 比较改变相机、照明、粗糙度各自造成的误差 | 拟合一张图后宣称物理参数唯一确定 |
| R15 [MaterialX](https://github.com/AcademySoftwareFoundation/MaterialX)；ASWF 开源标准项目 | P1 / Material | 跨工具的材质与外观表达 | 一种材料在两个目标中的映射记录 | 假定所有节点在所有引擎像素一致 |
| R16 [Substance 3D Designer](https://www.adobe.com/products/substance3d/apps/designer.html)；厂商产品入口 | P1 / Material | 程序化、非破坏材质制作的能力入口 | 找到与现有材料问题相关的官方节点文档和例子 | 产品页营销内容充当科学验证；学习完软件才开始做样本 |
| R17 [Gaea 官方文档](https://docs.quadspinner.com/)；厂商手册入口 | P1 / Landscape | 地形分解、尺度、侵蚀和派生层导航 | 一个“有/无该过程”的地貌对照，并标明合成与实测层 | 在已锚定 DEM 上加侵蚀后仍称原样测绘复原 |
| R18 [OpenVDB](https://www.openvdb.org/)；ASWF 稀疏体积库 | P2 / Terrain、Weather | 稀疏体积与层级存储 | 在确有洞穴/体积需求时做小型表示比较 | 对所有二维场使用高成本三维体素 |
| R19 [Unreal Engine 5.8 文档入口](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-documentation)；厂商手册 | P1 / Runtime、World | 内容生产、世界组织、渲染与优化章节导航 | 根据当前引擎版本选一个可测的光照或流式案例 | 把文档目录当作已验证的跨引擎实现方案 |
| R20 [Three.js WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html)；原项目 API 文档 | P1 / Web Runtime | 浏览器渲染入口、实际版本能力 | 固定浏览器、GPU、库版本的小场景测量 | 宣称 WebGPU 自动带来所有设备上的性能提升 |

几何书籍学习路线建议从几何处理、相机模型、误差度量和参数化开始。暂时无需同时学习全部重建论文；先选择能解决当前样本一个明确错误的方法。

## 3. 环境、历史与地理观测

| ID / 资源与类型 | 优先级 / 负责能力 | 学什么 | 预期交付与收益 | 避免直接照搬 |
|---|---|---|---|---|
| R21 [ECMWF：ERA5 扩展至 1940](https://www.ecmwf.int/en/newsletter/175/news/era5-reanalysis-now-available-1940)；数据生产方说明 | P1 / Weather、History | 再分析、观测约束和时空尺度 | 区域天气参考卡，注明局限和适用用途 | 插值后冒充院落实测或精确历史局地天气 |
| R22 [SWAN Introduction](https://swanmodel.sourceforge.io/online_doc/swanuse/node3.html) / [Limitations](https://swanmodel.sourceforge.io/online_doc/swanuse/node4.html)；原项目手册 | P2 / Ocean | 近岸波浪的输入、尺度、边界与局限 | 分清波浪统计状态、海流、视觉浪面和泡沫各自职责 | 一套视觉噪声替代全部近岸过程；照搬为逐帧游戏求解器 |
| R23 [ASF SAR 指南](https://hyp3-docs.asf.alaska.edu/guides/introduction_to_sar/)；数据处理方文档 | P1 / GIS | 后向散射、叠掩、阴影及校正边界 | 每个 SAR 层的可靠区域与用途标注 | 雷达亮暗直接解释为高度或唯一材质 |
| R24 [USGS 解密卫星影像 1](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-declassified-data-declassified-satellite-imagery-1?qt-science_center_objects=0)；官方数据说明 | P1 / History、GIS | 数据年代、来源和扫描产品性质 | 给候选影像建立时间与配准卡 | 把 1960 年代资料说成 1940 年代同期影像 |
| R25 [NARA Foreign Aerial Photography](https://www.archives.gov/research/cartographic/aerial-photography/foreign-photography)；档案机构目录 | P0（历史试点选址） / History | 战时外国航片与相关档案组导航 | 为具体地点找到可核对的目录/卷号/帧号 | 有大范围馆藏就假定目标坐标已有清晰数字影像 |
| R26 [JACAR 概述](https://www.jacar.go.jp/english/about/outline.html)；原始档案平台说明 | P1 / History | 亚洲相关近现代档案的保存机构与检索入口 | 保留档案编号、原文、译文及解释差异 | 只保存模型翻译；不核对原件及语境 |
| R27 [London Charter](https://londoncharter.org/principles.html)；文化遗产方法原则 | P0 / 全体历史能力 | 来源评估、过程记录、访问与持续保存 | 将重建依据和采用假设纳入发布说明 | 以“很逼真”代替方法透明 |
| R28 [LoC HABS/HAER/HALS](https://www.loc.gov/collections/historic-american-buildings-landscapes-and-engineering-records/about-this-collection/?loclr=reclnk)；建筑与工程档案 | P1 / Architecture、Evidence | 测绘图、照片与历史说明的组织方法 | 学会一项对象的多种证据如何互相补足 | 把美国建筑类型当成云南建筑规则 |

地方性证据仍需当地档案、修缮记录、测绘、老照片和匠人说明。本次尚未替首个地点找到这些具体材料，不能以国外通用资源代替。

## 4. 建筑、生物、动作与学习评估

| ID / 资源与类型 | 优先级 / 负责能力 | 学什么 | 预期交付与收益 | 避免直接照搬 |
|---|---|---|---|---|
| R29 [The Algorithmic Beauty of Plants 与 Algorithmic Botany 论文](https://algorithmicbotany.org/papers/)；作者书籍和研究组 | P2 / Plant | 发育结构、分枝和程序表达 | 一种植物的结构规则与本地观察对照 | L-system 参数随机化就当本地生态成立 |
| R30 [GBIF Occurrence 数据要求](https://www.gbif.org/data-quality-requirements-occurrences)；数据网络规范 | P2 / Ecology | 物种在特定时间地点出现的记录 | 物种/时间/位置/来源/精度卡 | 单条出现记录证明整个区域丰度；缺记录就判绝不存在 |
| R31 [MuJoCo Computation](https://mujoco.readthedocs.io/en/stable/computation/index.html)；原项目文档 | P1 / Mechanical、Motion | 关节、约束、接触及数值近似 | 一个具有边界条件的关节/接触对照 | 仿真通过就证明真实历史安装正确 |
| R32 [CMU Motion Capture Database](https://mocap.cs.cmu.edu/)；大学数据集 | P2 / Human | 校准骨架、动作分类、数据局限 | 一个动作的重定向、脚滑与接触检查 | 将未捕捉关节或噪声当真实动作；忽略数据使用条件 |
| R33 [DeepLabCut](https://deeplabcut.github.io/DeepLabCut/)；研究工具及文档 | P2 / Animal、Observation | 可标注关键点和动作观测 | 从合适视频提取可检查轨迹及不确定部分 | 二维关键点自动等于三维身体与完整行为理解 |
| R34 [Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798)；ICLR 2024 论文 | P0 / QA、导师 | 无外部反馈自纠的实验问题与失败风险 | 本项目自纠前后对照及错误定位实验 | 旧任务结果推断所有当前模型永久不能自纠 |
| R35 [SCoRe](https://arxiv.org/abs/2409.12917)；2024 研究论文 | P1 / Learning | 专门训练与测试时自纠的区别 | 说明当前流程究竟改了记录、程序还是模型训练 | 把提示角色或开会当作已经完成强化学习训练 |
| R36 [Procedural Urban Modeling in Practice](https://www.peterwonka.net/Publications/pdfs/2008.CGA.Watson.ProceduralModelingTutorial.pdf)；原作者保存的论文 | P1 / Architecture、PCG | 语法、约束、城市/建筑分层与生产用法 | 一条规则在两个实例上的可编辑变化 | 建筑外壳生成等同于本地构造、室内和历史准确性 |

研究组/社区的选择也应跟问题走：材料反演可沿 EPFL Realistic Graphics Lab/Mitsuba；植物结构沿 Calgary Algorithmic Botany；动作观察沿 CMU 和 DeepLabCut；几何与渲染沿相关原项目社区；证据互通沿 CIDOC、W3C、STAC/GDAL 与 OGC。先带一个最小复现和明确错误去交流，比泛泛询问“怎样做世界”更有效。

应寻找的专业人包括地方瓦匠和木匠、传统建筑测绘/保护研究者、档案员与相关历史研究者、摄影测量/测地人员、材料测量人员、目标设备图形工程师，以及相关物种/动作研究者。不同专业人员只对其有依据的范围复核。具体飞机手册必须按型号、时期和安装语境查找；本次没有核验适用手册，故不猜编号。

## 5. 对原 `SOURCE_MAP.md` 的具体修订

| 原项目 | 本次核查结果 | 建议 |
|---|---|---|
| `Uploaded: Houdini Foundations 19.5` | 本 ZIP 没有这本书或附件；这不排除它曾在别处上传 | 补实际可访问位置、文件散列和版本，避免后续代理以为已经读过 |
| Unreal 5.8 文档链接 | 本次打开返回对应的 5.8 文档入口 | 保留；以实际项目引擎版本为准。不能凭旧印象把它判断为不存在 |
| Blender 3.4 | 原包明确给了版本化旧入口；本次另尝试 latest Geometry Nodes 页面，抓取返回错误 | 旧入口保留为版本证据，实施时补对应版本。抓取失败不代表产品或页面付费 |
| INSYDIUM | 官方根入口本次抓取超时 | 列待复核；不要基于不可读页面声称理解了全部求解器 |
| Gaea 官方与第三方译文 | 已打开官方入口；未逐章核对两个译文镜像 | 官方术语与版本作为校核锚；译文作辅助导航 |
| Substance | 原链接是产品介绍页 | 补解决具体任务的官方技术页面；产品页不足以支撑节点行为断言 |
| Tripo 的 `api-evangelist/tripo-ai` | 仓库自述为独立第三方 API 档案 | 标成第三方导航；不拿它证明生成资产质量或官方能力承诺 |
| Meshy/Tripo 低优先策略 | 包里有排除策略，没有本项目对照试验 | 可保留现阶段不投入的决定；理由写“未通过本项目验收/暂不需要”，避免永久行业判定 |
| HyperWar/CBI 示例 | 已打开该章，含历史叙述与脚注 | 用于事件语境与追索引用；具体尺寸/地方构造还需别的原始依据 |
| ASF、USGS、OSM | 原包大多是搜索入口，尚无具体数据 ID、AOI 和参数 | 进入生产后固定数据条目、采集日期、区域、版本、CRS 与处理史 |
| MaterialX（新增） | 主站本次抓取失败；改核对 ASWF 官方仓库 | 以维护方仓库和版本化文档追踪，不将网络失败误判为项目无效 |

本次对 Tripo 仓库的使用仅用于核对其自述的来源身份，不将其中技术介绍作为生产能力证据。[仓库说明](https://github.com/api-evangelist/tripo-ai)

每项资源最终应沉淀一个短记录：解决的问题、可迁移规律、原术语/版本、输入输出、限制、最小试验和受益 Mother。没有这样的产物时，读完再多目录也很难形成系统能力。
