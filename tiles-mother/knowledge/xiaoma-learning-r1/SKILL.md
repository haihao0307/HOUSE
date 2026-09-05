# Tiles Mother：材质、UV与装配一致性学习卡

日期：2026-09-05。轮次：XIAOMA-LEARNING-R1-20260905。
执行者：Tiles Mother；会话标识：tiles-mother-xiaoma-learning-20260905。
状态：已读取下列资料并完成本线提炼；候选方法未接入生产；小妈理解复核、House独立互审、Blender实操与新浏览器验证均未完成。

## R1-A：实际任务与保护边界

本线仓库为 haihao0307/HOUSE，实际分支为 feature/tiles-mother-v0.1-workbench。本轮起始HEAD为 a86906316411c437499252cb8ff66a3066a8bdc9，产品基线为V0.9.8 Contact Rafter Beams。小妈教材固定在 guilin-dem-pipeline 的 b1f01bae975c4151539bc38d84644b8542c70c29；完整交接原件归档提交为372db85e3b450f8aa62c9cdc4792218d389bcc92。协调分支只读，不合入生产分支。

已有反复错误是瓦片悬空、搭接互穿、椽子UV及朝向错误、修复后已认可材质退化。V0.9.8 RELEASE_NOTES记录了相应修正；本轮没有重新运行工作台，不能断言这些错误当前仍可复现。本轮先补充防复发的知识与检查设计。最后完整人工接受提交为unknown；交接仅记载V0.9.7的部分材质特征获认可。当前visualApproved=false，productionApproved=false继续保留。

实际读取的关键小节及影响：小妈MOTHER_STARTUP的“先判断错在哪一层”要求区分几何与显示问题；REVIEW_DISPOSITION的“经项目实验再考虑推广”要求新方法保持候选；R1 geometry-context的“失效条件”要求明确坐标和求值阶段；procedural-geometry的“有限验证设计”要求材料变化与结构变化分开核对。不能由阅读目录推定已掌握全部软件。

三条保护边界：保留V0.9.8及继承材质锁、观察光、三片/48片/860片入口；保留共享圆椽、筒瓦双侧落座、四根横梁及无木板/隐藏支承平面的构造；只更新本线知识和接续导航，不修改main、gh-pages、Brick Mother、冻结资产或批准状态。导师建议与这些边界冲突时记录冲突，停止对应改动，继续有依据的独立工作。

竞争解释H1：实际变换、实体厚度或接触计算错误导致浮空/互穿。竞争解释H2：UV镜像、切线或面朝向错误造成看似异常的表面。两种原因可能共存。区分检查需固定版本、种子、年份、维护模式、尺度、相机、曝光和灯光，分别读取装配后的真实三角网格间隙，以及逐面UV/朝向/切线结果，并查看灰模、底面和剖面。亮度改善不能证明H1被排除。

四种状态的证据分别是：资料已读需有文件/章节/提交和读取范围；方法已实现需有实际执行源码及重建产物；结果已验证需有对应版本的新测试和真实浏览器证据；用户已接受需有用户明确批准及适用范围。前一状态不能自动推出后一状态。

## R1-B：分域材质与实体构造一致性审查

### 输入、输出、单位与依赖

输入：瓦/木构稳定id、profile、几何/材质/安装各自的seed、生成器版本、尺寸依据、局部到共同装配空间的变换、声明的UV方向、法线约定、维护与年份状态、材质锁和固定观察条件。

长度以米记录，UV无量纲；厚度与接触容差不得混用。记录Blender局部坐标、场景变换及导出后的轴向约定，不假定跨软件坐标自动一致。输出为逐对象/逐表面检查记录、接触点及间隙、属性与种子变化清单、未知项和候选采用状态。

现有执行位置为 tiles-mother/v098/source/app.js；contact.js、wood.js、roof.js、cracks.js是研究摘录。实际修改必须落在app.js并重建HTML，不能只改摘录。本轮不修改上述文件。

### 规则一：材质通道和色彩空间分别处理

按Three.js英文Color Management核对颜色输入、线性计算和显示输出。颜色图使用声明的颜色空间；normal/roughness等数据通道不做sRGB颜色解码；顶点颜色按Linear-sRGB契约处理。检查重复或遗漏转换，禁止用增减灯光补偿通道错误。程序化输出也应声明通道语义，不能把所有噪声输出都按颜色处理。[W1]

本线映射：现有陶瓦着色器与观察光继续锁定。后续候选实验一次只改一个材质变量，核对几何、UV、安装矩阵及支承关系不变。整片烧成偏色、片内斑驳、粗糙度、湿度响应分别记录，材料之间不互相覆盖默认值。

### 规则二：真实形体、表面凹凸和厚度分尺度

Blender Displacement章节区分仅改变着色的bump与改变网格的真实位移，也说明二者的成本和适用差异。[W2]

本线推导：轮廓、搭接边、实体厚度及会影响支承的损伤进入几何检查；不改变轮廓的细孔和浅划痕可在既有高频表面层表达。不能依赖normal或bump修正实际落座，也不能把观察到的明暗直接记为实测孔深。厚度沿宏观壳体方向处理，不让高频微孔扰动造成背面折返。分层幅度和尺度须有来源或标明经验候选，本轮不调参。

### 规则三：UV按面角保存，逐面检查方向

Blender Attributes把UV列为Face Corner属性，把整实例数据与点/面数据区分。[W3]

本线推导：共享空间位置允许在不同面角上拥有不同UV。导出到以顶点存属性的网格时，接缝两侧必要的属性分裂必须保留。板瓦、筒瓦检查外/内表面、左右侧边、出檐端和迎水端；圆椽、横梁检查侧壁、两端和破损端面。木构侧壁沿轴向追踪纹理，端面使用局部截面方向，方向以各端朝外约定核对。

检查有限值、零UV面积、意外镜像、局部拉伸、接缝与切线方向，不能只看UV属性存在。UV位于0到1属于当前特定映射约束；其他平铺/多区映射须按各自合同检查。镜像也需结合约定判定，不能把所有合法映射一律拒绝。UV退化与几何退化分开记录。

### 规则四：切线法线与采样UV保持一致

Blender Normal Map说明切线空间法线使用的UV应与纹理采样UV一致，法线图使用Non-Color，输入还涉及空间及法线约定。[W4]

本线推导：先检查几何朝向，再检查UV、切线、法线约定和材质读取。故意镜像端面、反转侧壁、压扁UV、用错UV集合分别作为坏样本。不能用双面显示掩盖反向三角形，也不能对全部资产盲目翻转某个法线通道。

### 规则五：字段求值阶段、稳定身份与实例隔离

Blender Fields指出同一字段会随求值几何和属性域改变结果；SideFX说明稳定id与可改变的元素序号不同。[W5][W6] 小妈实例卡要求逐项判断共享几何与单实例操作边界；本轮未补齐Instance on Points的官方完整正文，因此相关实操保持待验证。

本线推导：几何生成、装配、材料计算和显示各自声明输入空间与时刻。只调一片瓦的偏色时，其稳定id、几何seed及其他瓦片均不应改变。不能用排序后的数组序号替代长期身份；替换新瓦可另记代次。仅改变实例颜色不应修改共享几何；需要独立破损时，明确如何隔离几何，并记录内存与生成成本。

### 规则六：接触关系独立于外观验收

按当前构造从横梁、圆椽、板瓦到筒瓦追踪依赖，使用共同空间的实际曲面检查。包围盒只作候选筛选。两侧支点、纵向搭接和木构连接分别记录；近距离或包围盒重叠都不能独立证明有效支承。

本线现有数值合同：nominalNumericalSeatGap=0.00018m，rejectionMaxBilateralGap=0.0005m，pairPenetrationTestTolerance=0.00005m。它们来自V0.9.8 CONFIGURATION，属于算法检查设置，不作为地方实测误差、施工标准或承载安全依据。不以几何间隙合格宣称完整荷载求解完成。

### 有限试验设计，尚未运行

正例使用固定V0.9.8输入作为历史候选参照，再经新检查确认；不能把历史allPassed字段直接当作这轮测试结果。负例分别注入已知的单侧失去支承、瓦片穿透、端面镜像、侧壁反向和UV面积退化，并确认每个错误被正确的检查项捕获。另保留有意合法的方向/映射对照，观察误拒。

先在三片样本逐面确认，再在48片装配检查共享椽和底面，最后检查860片和维护/失养状态。材料实验固定几何与相机；接触实验固定材质和灯光。记录结构哈希、矩阵差异、最小间隙、双侧支点、UV与法线结果、首次生成耗时、增量耗时、几何数量/内存、draw calls、桌面与390x844移动端真实交互。新浏览器测试与Windows双击均保持not_run，不用文档检验替代。

改变前提的预测：如果只提高表面湿度参数，允许已定义的材料响应变化，几何和落座应保持；如果移动一根椽子，应重新检查它支承的板瓦及相关筒瓦，无关瓦片seed不应改变。如果对同一壳体增加厚度，应重算接触与搭接，不能沿用旧缓存直接判为通过。这些预测尚待受控试验。

不适用反例：轮廓/厚度/破损改变时不能要求几何哈希保持；完整断裂、碎片碰撞堆积及整体木构失稳超出静态接触卡能力；无原始尺寸依据时不能从Blender或Gaea教材猜云南构造；跨硬件或导出重新排序后，应区分容差几何等价与字节一致。

失败条件：源码与HTML身份不一致、坐标/单位不明、缺少对应参照、锁定材质被改、合法对照被误拒、旧错误复现，任一项出现即停止扩大候选。本轮未运行计时或测量，不填性能收益。

## 四类概览的本线吸收范围

Houdini：学习属性、稳定id和依赖的表达；不声称已运行SOP或模拟。Blender：重点学习Fields、属性域、实例边界、UV和表面表达；不改变现有Three.js交付。UE：本轮仅从小妈目录了解场景数据、状态和显示分层，不迁移工作台。Gaea：本轮仅学习尺度与因果边界，不把地形侵蚀参数套成瓦片百年寿命或木材物性。Substance保留为后续有来源的专项，本轮未深读其手册。地方实测、原书全文和软件操作均不因目录入库而完成。

## 来源与读取范围

小妈资料均固定于 guilin-dem-pipeline 提交 b1f01bae975c4151539bc38d84644b8542c70c29，前缀为docs/mother_coordination/：

- mentor-v1.1/README.md、MOTHER_STARTUP.md、REVIEW_DISPOSITION.md、RECIPIENTS.md。
- mentor-v1.1/full-handoff-v1.1.1/source/Mother_System_Xiaoma_Full_Handoff_V1.1.1_2026-09-05/sources/mentor_v1_1/00_小妈先读.md。
- learning-r1-20260905/START_HERE.md、SKILL_INDEX.md、skills/geometry-context/SKILL.md、skills/procedural-geometry/SKILL.md。
- HOUSE Issue #16的R1通知，comment 5550625144。ASSIGNMENTS中的Tiles题同时在该通知及教材提交差异中读取。

本线出处：HOUSE固定提交a86906316411c437499252cb8ff66a3066a8bdc9的tiles-mother/AGENTS.md、RESTART_START_HERE.md、CURRENT_BASELINE.json，及v098内README、RELEASE_NOTES、USER_DECISIONS、KNOWN_GAPS、MATERIAL_LOCK、CONFIGURATION。文件来源沿用本会话实际读取；本轮只重新核对HEAD、导航和知识目录，未重复下载全量包或审计完整app.js。

W1 https://threejs.org/manual/en/color-management.html ，本轮直接读取正文，章节Input/Working/Output color space与Common mistakes；页面未固定发布号，项目运行库版本另核。
W2 https://docs.blender.org/manual/en/latest/render/materials/components/displacement.html ，官方索引正文已读取，页面显示5.2 LTS；直接打开返回402，未完成页面直读或软件运行。
W3 https://docs.blender.org/manual/en/4.5/modeling/geometry_nodes/attributes_reference.html ，官方索引读取Attribute Domains、Built-In/Custom Attributes，版本4.5 LTS；直接打开返回402。
W4 https://docs.blender.org/manual/en/latest/render/shader_nodes/displacement/normal_map.html ，官方索引读取输入、空间、约定和UV要求，页面显示5.2 LTS；直接打开返回402。
W5 https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/fields.html ，官方索引读取Node Types与Field Context，页面显示5.2 LTS；直接打开返回402。
W6 https://www.sidefx.com/docs/houdini/model/attributes.html ，本轮直接读取Geometry components、Attribute precedence与Common attributes，页面显示Houdini22.0；实际软件版本unknown。

软件版本标签仅用于定位文档，不等于已安装、实测或升级项目。英文官方来源的读取范围与受阻项均保留；本卡的“本线推导”是候选方法，须经验证。小妈复核为not_reviewed；House独立互审为not_run；跨对象验证为not_run；生产采用未获批准。
