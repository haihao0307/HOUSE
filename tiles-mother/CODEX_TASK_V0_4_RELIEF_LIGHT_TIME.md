# Tiles Mother V0.4 讲武堂瓦片实体起伏、工作室灯光与屋顶时间闭环

任务日期：2026-09-01

仓库：`haihao0307/HOUSE`

唯一工作分支：`feature/tiles-mother-v0.1-workbench`

任务起始远端 HEAD：`f55949d3d2c03f58951856e8d4e384f3b831d3ea`

只允许正常追加提交。禁止强推、改写历史、修改 `main`、`release/brick-mother-v1.0`、Brick Mother 工作分支、其他 Mother、Pages 设置和冻结资产。人工视觉批准与生产批准继续保持 `false`。

## 一、任务结论与当前缺口

V0.3 已完成讲武堂色彩候选和基础材质接入，公开网页可运行，原始 FBX、完整贴图和 ZIP 没有进入运行时。

本轮必须关闭以下真实视觉缺口：

1. 板瓦与筒瓦表面仍显得平整，细小凹凸主要停留在弱屏幕微法线，缺少来源模型中可见的高低变化。
2. 手工压制、刮抹、拍打、局部塌陷、凸棱和不均匀边缘没有形成可读的实体或稳定表面结构。
3. Brick Mother 已有的孔洞、破损边、裂隙关联、层级起伏和多尺度侵蚀方法尚未蒸馏到 Tiles Mother。
4. 当前固定双光源无法提供稳定的中性检查、好看的工作室展示和清楚的斜光诊断。
5. 目前缺少一个屋顶级时间总线，不能统一驱动全部瓦片的环境经历和表面变化。
6. V0.3 的部分自动测试只检查几何哈希，没有证明材质场与相机解耦，也没有覆盖时间重放和灯光隔离。

本轮不能只增加说明文件。完成标准是实际代码、真实浏览器证据和公开网页候选。

## 二、开始前必须读取

先重新确认远端 HEAD，若已出现新提交，从最新远端正常快进。

读取当前生产线：

```text
tiles-mother/AGENTS.md
tiles-mother/JIANGWUTANG_SOURCE_RECEIPT.json
tiles-mother/knowledge/jiangwutang-001/analysis.json
tiles-mother/knowledge/jiangwutang-001/review.md
tiles-mother/knowledge/jiangwutang-001/material-candidate-v0.3.json
tiles-mother/v03/jiangwutang-material.js
tiles-mother/v03/build_v03.py
tiles-mother/v03/browser_qa_v03.py
tiles-mother/v03/build-manifest.json
.github/workflows/tiles-mother-v03-publish.yml
.github/workflows/tiles-mother-v01-preview.yml
```

读取用户交付的 `Mother 统一世界演化与生产方法论 V1.0.0`。本轮只蒸馏并接入与 Tiles Mother 相关的共同接口，禁止在局部任务中改写共同原则。

以只读方式研究 Brick Mother 最新知识基线：

```text
分支：feature/brick-mother-v2.0-composite-material-dna
审查 HEAD：b25508b8b57d45f9333286ab7b883644181039e7

brick-mother/brick-mother-geometry-v2.js
brick-mother/brick-mother-gaea-kernel-v1.js
brick-mother/brick-mother-renderer-v2.js
brick-mother/data/brick-material-profiles-v2.json
brick-mother/docs/BRICK_MOTHER_GAEA_DISTILLATION_V1.md
brick-mother/docs/BRICK_MOTHER_V27_VISUAL_TRUTH_SPEC.md
brick-mother/qa/gaea-distillation-contract-v1.json
```

实际路径以该分支树为准。严禁合并 Brick Mother 分支，严禁整文件复制整个运行时，严禁修改其源文件。只提取可复用的算子、接口、测试方法和小型参数定义。

## 三、先完成讲武堂三维参考的几何起伏蒸馏

原件继续只读：

```text
E:\讲武堂瓦片精细.zip
58,671,527 bytes
SHA256 ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365
```

原件只有一个合并 FBX 网格，真实单位和瓦件语义边界仍未知。已有分析确认法线图有效区域约 99.3233% 为平坦基准色，因此明显高低变化不能继续只依赖该法线图。

在本机原始 FBX 上补做几何起伏分析：

1. 从非索引三角形重建稳定邻接关系，记录算法和容差。
2. 对外表面建立低频基准曲面，建议使用保边平滑或局部拟合。基准曲面只用于分离整体弧度与局部起伏，不能改写原件。
3. 沿局部法线计算原始几何相对基准曲面的有符号残差。
4. 统计 P05、P25、P50、P75、P95、极值、局部坡度、曲率、相关长度和方向性。
5. 单位无法确定时，使用 FBX 文件单位，并同时给出相对局部厚度、整体高度和中位边长的无量纲比值。
6. 检测连续凹陷、凸棱、手工刮抹候选、边缘缺损和孔口候选。直接观测、算法候选和未知项分开记录。
7. 从原始几何选择少量代表区域，保存轻量截图、剖面曲线和坐标。禁止上传完整 FBX、完整 7000 像素贴图或可还原原件的大型缓存。
8. Diffuse 中可能烘入阴影、遮蔽和反光，不能直接转换为几何高度。

新增轻量知识位置：

```text
tiles-mother/knowledge/jiangwutang-001/geometry-relief-analysis-v0.4.json
tiles-mother/knowledge/jiangwutang-001/geometry-relief-review-v0.4.md
tiles-mother/knowledge/jiangwutang-001/geometry-relief-evidence/
```

证据目录只保留必要裁片和剖面，目标增量控制在 2 MB 左右。

## 四、将 Brick Mother 方法蒸馏为 Tiles Mother 专用算子

建立独立、小型、可读的 Tiles 算子层。建议位置：

```text
tiles-mother/v04/tile-relief-kernel.js
tiles-mother/v04/tile-cavity-events.js
tiles-mother/v04/tile-surface-fields.js
tiles-mother/knowledge/operators/brick-to-tile-distillation-v0.4.json
```

需要蒸馏的方法：

1. 多尺度几何位移。宏观层表达手工成型缓慢起伏，中观层表达可辨识刮痕、压痕和局部凸棱，微观层表达细颗粒与小尺度粗糙。
2. 稳定域扭曲。方向场与幅度场分别控制，坐标固定在对象局部空间，转动相机和移动瓦片时纹理不能漂移。
3. 因果事件。孔洞簇需要与附近的分层剥落、裂隙或边缘损伤共享空间原因。孔口、破损边和暗部地板由同一事件派生。
4. 分层掩码。至少输出 `macroRelief`、`handToolMark`、`cavity`、`protrusion`、`edgeWear`、`microErosion`、`separation`。
5. 相关光学响应。颜色、粗糙度、微法线和遮蔽读取共享状态，各自使用不同响应函数，禁止把同一张噪波原样复制到全部通道。
6. 家族隔离。板瓦和筒瓦分别保存默认参数、种子银行和响应范围。修改一个家族不得覆盖另一个家族。

适配薄壳瓦片时增加以下约束：

1. 外表面和内表面必须协调更新，保留实体厚度。
2. 默认孔洞为表面凹坑与局部剥落。没有来源证据时禁止形成贯穿孔。
3. 每个候选记录最小厚度、最大位移和碰撞风险。
4. 轮廓破损使用真实几何。只影响高光的微细节可以使用法线扰动。
5. 几何起伏强度首先受到讲武堂 FBX 的无量纲统计范围约束。超出范围的艺术控制单独标记。

## 五、V0.4 几何和材质实现

在板瓦和筒瓦中增加实际几何起伏。V0.3 的 `.00008` 级屏幕微法线只能作为补充，不能继续承担全部表面质感。

每个母体至少提供：

```text
handPressWarp
scrapeRidge
localDepression
cavityCluster
brokenRim
edgeSpall
microGrain
microErosion
```

要求：

1. 关闭实体起伏时能回到基准几何。
2. 起伏种子改变实际几何哈希。
3. 颜色、粗糙度和灯光种子不改变几何。
4. 孔洞、凸棱和局部凹陷在斜向诊断光下可读。
5. 单瓦近景中能看到手工质感，远景没有统一撒点、棋盘条纹或屏幕闪烁。
6. 三个孩子拥有不同局部痕迹，同时保持同一讲武堂材质家族。
7. 原始 FBX、原始 PNG 和 ZIP 不得成为运行时依赖。

候选参数放在独立 Profile，渲染器必须读取经过校验的 Profile。禁止 JSON 写一套参数、着色器再硬编码另一套数值。

## 六、重做灯光体系

新增单独版本化的展示配置，建议位置：

```text
tiles-mother/presentation/lighting-presets-v0.4.json
tiles-mother/v04/tile-lighting.js
```

必须具备三种正式模式：

### 1. 中性检查

固定相机预设、固定白平衡、固定曝光、固定色彩转换和中性背景。关闭自动曝光、锐化、景深、强烈暗角和美化滤镜。提供正面、侧面、顶部、底部和低角度斜视。

### 2. 工作室展示

使用独立主光、辅光和轮廓光。每盏灯提供开关、方位、高度、强度、颜色或色温控制。主光交代体积，辅光保留暗部信息，轮廓光帮助识别薄壳边界和孔沿。默认预设需要画面舒服，同时不能用深阴影隐藏缺陷。

网页自定义渲染器没有物理光照单位时，明确标记为相对展示单位。色温转换算法和版本写入构建清单。

### 3. 诊断模式

提供斜向掠射光、纯色几何、线框、法线、深度、粗糙度、孔洞、实体起伏、手工痕迹、最小厚度和时间状态图。每个通道有清楚标签与图例。

灯光状态与对象状态分离。切换灯光、旋转灯架、改色温或强度后，几何哈希、材质基础场哈希、历史状态哈希必须保持不变。

## 七、建立屋顶时间总线

新增屋顶级状态接口，先做最小屋面试验板，暂不扩展完整建筑。

建议位置：

```text
tiles-mother/evolution/roof-time-v0.4.js
tiles-mother/evolution/roof-state-v0.4.schema.json
tiles-mother/knowledge/roof-time-model-v0.4.md
```

必须分开：

```text
physicalTime
solverStep
displayTime
```

当前没有材料速率标定，界面中的时间明确标记为 `illustrative_not_calibrated`。禁止把滑杆数值宣传成真实十年或百年。

最小因果链：

```text
共享屋顶环境历史
→ 每块瓦的朝向、位置、遮挡与排水修正
→ 含水和干燥状态
→ 累积暴露剂量
→ 不可逆损伤状态
→ 色彩、粗糙度、孔洞暗部、边缘损伤和微细节响应
```

要求：

1. 一个屋顶时间控件统一驱动试验板上的全部板瓦和筒瓦。
2. 每块瓦由 `roofEntityId + tileEntityId + processId + seedDerivationVersion` 派生稳定过程种子。
3. 全部瓦共享同一环境历史，同时保留位置、朝向和个体种子造成的差异。
4. 湿润后干燥可以改变含水状态，不能自动修复裂缝、孔洞和边缘损伤。
5. 相同初始状态、历史、时间、步长和版本重放后得到相同状态哈希。
6. 改播放速度不能改变同一 `physicalTime` 的结果。
7. 时间回退通过检查点或从初始状态重放，禁止对不可逆过程直接使用负步长。
8. 建立单瓦特写和轻量屋面试验板两种观察模式。试验板可以使用有限数量实例，优先保证近景质量和可检查性。

## 八、共同规则的轻量接入

不要把整份统一方法论、整套 Brick Mother 或原始参考资料打进网页。

只保存以下轻量内容：

1. Tiles Mother 对共同规范 V1.0.0 的接入回执。
2. 本线需要的有效字段、版本和哈希。
3. 专用算子、参数 Profile、Schema、测试和少量证据。
4. 来源路径、适用边界和未完成项。

接入回执建议位置：

```text
tiles-mother/governance/mother-v1-adoption-v0.4.json
```

运行时在生成、参数修改、导出和发布入口实际校验。未知字段、越界参数、核心版本不匹配和缺少关键证据时阻断相关操作并显示原因。

## 九、修复工作流隔离

旧 `.github/workflows/tiles-mother-v01-preview.yml` 仍要求旧版固定字节和哈希，V0.3 更新时因此产生失败记录。

修复方式必须保留历史证据，同时让旧版检查只在冻结 V0.1 输入变化时运行。新版只由 V0.4 工作流验证。禁止删除失败记录或用跳过冒充通过。

新增可复现构建和公开发布：

```text
tiles-mother/v04/build_v04.py
tiles-mother/v04/browser_qa_v04.py
.github/workflows/tiles-mother-v04-qa.yml
.github/workflows/tiles-mother-v04-publish.yml
```

依赖锁定到仓库可复现来源，禁止长期依赖会过期的短期 artifact。

## 十、真实浏览器验收

至少完成以下检查：

### 几何与结构

1. 起伏关闭时基准几何可复核。
2. 起伏种子改变几何，颜色、灯光和时间显示速度不改变基础形体。
3. 孔洞和破损边具有几何证据。
4. 外内表面没有翻转、自交和非法索引。
5. 最小厚度大于安全阈值，默认没有贯穿孔。
6. 板瓦和筒瓦参数隔离。

### 材质与字段

1. 固定对象采样点的宏观、中观、微观、孔洞和手工痕迹字段在相机旋转前后完全一致。
2. 共享原因能够驱动相关输出，同时各通道响应不完全相同。
3. 三个孩子具有不同字段哈希。
4. 关闭某一原因后，相关输出按声明关系消失或减弱。

### 时间

1. 同一历史重放得到相同状态哈希。
2. 不同帧率和播放速度在同一物理时刻一致。
3. 干燥不重置不可逆损伤。
4. 检查点恢复可复核。
5. 一个屋顶时间控件实际影响试验板全部瓦片。

### 灯光与展示

1. 中性、工作室和诊断三种模式均有真实截图。
2. 主光、辅光和轮廓光独立控制。
3. 改灯光不改对象状态哈希。
4. 斜向光可以清楚显示孔沿、凹凸和手工纹理。
5. 桌面与移动端分别验证。

### 原有功能回归

保留 GLB、FBX、ZIP、文件夹导入、资料笔记、协作记录保存与恢复。验证 V0.2 和 V0.3 记录迁移。浏览器控制台、页面错误、失败请求和外部请求全部如实记录。

## 十一、视觉证据

必须保存：

1. 板瓦与筒瓦各自三个孩子的中性全景。
2. 两类瓦各至少两张近景，显示手工起伏、孔洞和边缘。
3. 工作室展示全景和特写。
4. 诊断斜光、实体起伏、孔洞、法线、粗糙度和厚度证据。
5. 屋面试验板在至少三个示意时间检查点的相同机位对照。
6. V0.3 与 V0.4 的相同机位对照。

证据必须来自真实浏览器，记录视口、原生像素、相机、灯光预设、种子、时间、构建 SHA 和网页 SHA。

自动 QA 通过只代表技术检查。视觉质量继续等待用户确认。

## 十二、发布与最终状态

只更新 `tiles-mother/` 对应网页内容。通过受控方式保留现有完整 Pages 站点，所有其他公开文件逐字节保持。

公开回读至少验证：

```text
HTTP 200
text/html
V0.4 页面版本
HTML 字节数
SHA256
WebGL2
中性模式
工作室模式
诊断模式
屋顶时间控件
真实浏览器无阻断错误
```

最终返回：

1. 起始和结束远端 HEAD。
2. 实际提交列表。
3. 公开在线网址。
4. 浏览器证据路径。
5. 从讲武堂 FBX 蒸馏出的几何起伏统计摘要。
6. 从 Brick Mother 蒸馏的算子清单及 Tiles 适配边界。
7. 灯光预设版本和时间模型版本。
8. 仍缺少的实物尺度、粗糙度、制造历史和物理速率证据。
9. 是否清理临时副本及明确清理清单。

必须保持：

```text
visualApproved=false
productionApproved=false
distillationComplete=false
```

只有完成程序化对照并获得用户视觉确认后，才能更新相应状态。用户 E 盘原件永远不在清理范围。
