# Codex 任务 V5.5.0：把三模型墙面与瓦顶知识接入正式云南民间建筑生产线

## 任务状态

立即实施。不要只做研究、UI 原型或文字总结。最终必须让用户在公开生产线网页中看到完整一颗印建筑的墙体和瓦顶发生真实变化。

## 仓库与工作目录

仓库：`haihao0307/HOUSE`

分支：`codex/yunnan-surface-production-v5.5.0`

工作目录：

`yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/`

开始前必须阅读：

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `docs/V5_5_0_SURFACE_PRODUCTION_AUDIT.md`
4. `data/production/yunnan_surface_weathering_seed_v5_5_0.json`
5. `data/production/yunnan_wall_roof_entry_tool_contract_v5_4_4.json`
6. `data/production/roof_tile_knowledge_v5_4_2.json`
7. `data/evidence/yunnan_three_reference_visual_knowledge_v5_4_3.json`
8. `threejs/YunnanCourtyardProduction.js`
9. `threejs/YunnanMaterialFactory.js`
10. `yunnan-architecture-understanding-lab.html`
11. `folk-building-production-line.html`
12. 现有浏览器 QA 与 Pages 工作流

先运行现有验证和真实浏览器基线，记录当前三角面、draw call、加载时间和交互状态。

## 用户验收目标

用户需要直接看到：

1. 瓦顶拥有自然的青灰、暖灰、褐灰和局部色差。
2. 灰尘、日晒、雨蚀、苔藓、缺瓦、破损和不同年代修补共同形成连续旧化。
3. 正房、耳房、倒座、门楼、大厦和小厦的屋顶保持真实高低错落，厚度由真实屋面层组成。
4. 墙体能够显示土墙、抹灰、裸土、石勒脚、砖包角、返潮、垂直雨痕、剥落、裂缝和修补。
5. 风化符合重力、日晒、檐口遮蔽和排水关系，不能是满墙随机噪声。
6. 用户可以在完整建筑上切换预设并比较 V5.4.4 基线与 V5.5.0 生产结果。

## 第一部分：数据驱动接线

### 1. 加载数据合同

正式生成器必须加载：

`data/production/yunnan_surface_weathering_seed_v5_5_0.json`

所有默认值、范围、预设、证据状态和 QA 门槛都从 JSON 读取。不得只把参数写死在 shader、HTML 或 JavaScript 常量中。

### 2. 版本与回滚

版本提升到 `5.5.0`。同时保留 `5.4.4-baseline` 回退模式。

至少提供：

- `baselineV544`
- `museum1940sBalanced`
- `wulongLongWeathering`
- `daliMaintained`

回退模式必须恢复原外观和原生成路径，方便 A/B 检查。

## 第二部分：瓦顶生产化

### 1. 迁移旧参数

停止把以下旧值作为正式默认值：

```text
tileWidth 0.28
tileLength 0.64
tileCourse 0.46
tileThickness 0.055
```

旧值只保留为兼容迁移记录。正式瓦件从 `tileProfileId + evidenceStatus` 解析。

### 2. 修正瓦作拓扑

必须满足：

- 板瓦凹面向上形成连续水槽。
- 筒瓦凸面向上覆盖相邻板瓦列之间的纵缝。
- 筒瓦列数按板瓦接缝数推导，不能与板瓦同数。
- 删除无证据的 `tileCourse * 0.23` 筒瓦坡向偏移。
- 板瓦檐端对应滴水。
- 筒瓦檐端对应勾头。
- 每条板瓦水槽连续到檐口。
- 正脊、垂脊、封头成为独立语义构件。
- 未解决的纵向搭接、列中心距和基层固定继续标记 `unresolved` 或 `visual-calibration-only`。

### 3. 屋面厚度分层

正式建筑中可单独显示：

1. 檩条
2. 椽列
3. 椽上基层
4. 板瓦
5. 筒瓦
6. 勾头与滴水
7. 正脊、垂脊和封头

不能再用一块均匀厚板表达全部屋面。

### 4. 七个独立屋面单元

至少保存：

- 正房双坡
- 左耳房长短坡
- 右耳房长短坡
- 倒座双坡
- 正房大厦披檐
- 耳房与倒座小厦披檐
- 门楼小屋面

每个屋面单元都要有独立 `roofUnitId`、屋脊标高、檐口标高、坡向、出檐、排水目标、材质 profile 和稳定种子。

### 5. 瓦面旧化算法

把以下通道真正用于正式瓦面：

- 烧成基础色
- 坡面朝向与日晒
- 灰尘
- 苔藓
- 顺坡雨蚀
- 缺瓦与崩边
- 修补片区
- 修补瓦年代色差
- 檐口和脊部磨损

实现要求：

- 使用低频连续场控制综合色。
- 苔藓只出现在日照弱、湿度高或排水阴影区域。
- 灰尘受坡度、脊后、檐口和遮蔽影响。
- 雨蚀沿坡向连续。
- 缺瓦和修补以片区出现。
- 每片瓦完全独立随机色属于失败。
- 支持研究高精度、网页标准、远景简化三档质量，共用构件 ID 和排水拓扑。

### 6. 性能

板瓦与筒瓦使用共享 Geometry 加 `InstancedMesh` 或等效批处理。保持每片或每列的稳定语义映射。

记录：

- 三角面
- draw call
- 实例数
- 加载时间
- 首帧时间
- 旋转与缩放交互状态

## 第三部分：墙面生产化

### 1. 墙面分层

正式墙体至少分为：

- 主体墙体
- 抹灰层
- 裸土暴露层
- 石勒脚或砖墙脚
- 砖包角或转角保护
- 墙脚返潮
- 垂直雨痕
- 表层剥落
- 裂缝网络
- 修补斑块
- 烟熏和污渍

结构、材料、历史状态可以分别关闭。

### 2. 几何层

以下内容优先使用独立几何表达：

- 石勒脚
- 砖包角
- 厚抹灰边界
- 明显剥落形成的厚度差
- 门窗洞口周边保护

轻微色差、粗糙度、返潮和细裂缝可以使用 shader 或程序化纹理。

### 3. 风化逻辑

必须服从：

- 返潮从墙脚向上衰减。
- 雨痕从檐口滴水线、墙顶、窗台、裂缝和洞口边缘向下延伸。
- 檐口遮蔽区域雨蚀减弱。
- 朝阳面更干燥和褪色。
- 背阴面更容易出现苔痕和冷灰。
- 剥落形成连续片区。
- 修补具有明确边界和年代综合色差。
- 裂缝优先从洞口角、材料交界和沉降区产生。

满墙随机噪声、墙顶返潮、横向漂浮雨痕都属于失败。

### 4. 三种正式墙面预设

至少实现：

- 滇中一颗印 1940 年代均衡旧墙
- 乌龙村长期风化旧墙
- 大理院落较完整墙面

预设必须作用于完整建筑墙面，并允许每面墙根据朝向、檐口和功能作二次修正。

## 第四部分：正式生产线网页

### 1. 直接写入生产线

把成果接入 `index.html` 与 `folk-building-production-line.html`。用户打开公开生产线后能直接看到完整建筑，不需要另开只展示样板的孤立页面。

### 2. 新增正式观察区

建议新增：

`surface-production-lab.html`

该页必须使用正式 `createYunnanCourtyardPrototype()` 或其 V5.5.0 后继生成器，不能只画二维 Canvas 样板。

至少支持：

- V5.4.4 基线
- 仅墙面改善
- 仅瓦顶改善
- 完整 1940 年代状态
- 乌龙村长期风化
- 大理较完整维护
- 屋面分层爆炸
- 墙体分层爆炸
- 修补片区显示
- 排水与雨痕调试
- 墙脚近景
- 檐口近景
- 屋顶俯视
- 院内人眼

### 3. 自动演示

一键播放：

1. V5.4.4 基线完整建筑
2. 瓦顶综合色与错落
3. 灰尘、日晒、雨蚀、苔藓
4. 缺瓦与修补片区
5. 墙脚石基与砖包角
6. 返潮和垂直雨痕
7. 剥落、裂缝和修补
8. 人物从大门进入并登上二层
9. 返回完整 1940 年代状态

支持暂停、继续和复位。

## 第五部分：代码组织

建议增加：

- `threejs/YunnanRoofSurfaceSystem.js`
- `threejs/YunnanWallSurfaceSystem.js`
- `threejs/YunnanSurfaceProfiles.js`
- `surface-production-lab.html`
- `assets/js/surface-production-lab.js`
- `tools/surface_production_smoke.py`

已有 `YunnanCourtyardProduction.js` 和 `YunnanMaterialFactory.js` 可以重构，但保持公共入口兼容。

## 第六部分：自动验收

真实浏览器测试必须检查：

1. 正式一颗印完整建筑加载。
2. 七个独立屋面单元存在。
3. 板瓦列数与筒瓦接缝关系正确。
4. 滴水、勾头、脊部对象存在。
5. 排水路径连续到檐口。
6. 三种瓦顶预设作用于完整建筑。
7. 三种墙面预设作用于完整建筑。
8. 墙体结构、材料、历史状态可独立关闭。
9. 返潮集中在墙脚并向上衰减。
10. 雨痕沿重力方向。
11. 缺瓦和修补形成片区。
12. 屋面综合色存在连续低频变化。
13. 石勒脚和砖包角有可见厚度。
14. V5.4.4 基线可以恢复。
15. 门窗自动开合通过。
16. 人物沿 8 加 8 双跑楼梯到达二层。
17. 大理、乌龙村、团结乡三模型页无回归。
18. 大角度旋转无深度穿面。
19. 网页标准质量保持可交互。
20. Pages 公开入口可用。

必须生成 QA 截图：

- 基线完整建筑
- V5.5.0 完整建筑
- 屋顶俯视
- 檐口近景
- 缺瓦与修补近景
- 墙脚返潮近景
- 雨痕与剥落近景
- 石勒脚与砖包角近景
- 院内人眼
- 人物楼梯与二层
- 屋面爆炸
- 墙体爆炸

## 第七部分：交付

更新：

- `VERSION` 至 `5.5.0`
- `CHANGELOG.md`
- `PROJECT_STATE.md`
- `README.md`
- 生产数据 schema
- Pages 入口
- QA 报告和截图

完成后把全部实际代码提交到当前分支，并在 PR 中汇报：

- 提交 SHA
- 修改文件
- 正式网页入口
- 三角面、draw call、实例数和加载时间
- 浏览器测试结果
- QA 截图
- 仍然锁定的证据参数

不能只把提交留在隔离工作区，远端 PR changed files 必须出现实际实现。
