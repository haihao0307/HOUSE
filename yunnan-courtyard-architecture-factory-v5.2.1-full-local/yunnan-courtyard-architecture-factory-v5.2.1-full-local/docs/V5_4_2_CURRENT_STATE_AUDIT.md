# V5.4.2 当前状态审计与实施边界

## 1. 审计目的

本文件供 Codex、审查代理和后续维护者使用。目标是基于仓库当前 5.4.1 实际状态推进瓦作知识复核，避免按旧目录名或旧视觉参数回退工程。

当前项目目录名称仍保留 `v5.2.1-full-local`，正式版本以根目录 `VERSION` 和 `PROJECT_STATE.md` 为准。

当前稳定版本：`5.4.1`

当前主分支提交：`f04380c910d076a4c5930d4428231849ff2916f0`

目标版本：`5.4.2`

## 2. 当前系统已经具备的能力

### 2.1 建筑与显示

当前公开生产线已经具备：

1. WebGL 深度缓冲与大角度旋转遮挡。
2. 一颗印完整建筑默认入镜。
3. 一颗印测绘约束模型与三开间前廊测绘个案。
4. 平面、剖面、构架、屋面和材料的生产数据。
5. 活动门窗、人物入户、日常双跑楼梯和二层到达路线。
6. 人眼入户和自由观察模式。
7. 团结乡扫描 GLB 查看器和参数化生产参考层。
8. GitHub 同步中枢与 GitHub Pages 发布工作流。

### 2.2 当前瓦面结果

仓库已经存在逐片板瓦、筒瓦、曲面屋面、脊瓦和屋面覆盖的视觉实现，并已有多张 V5.3.0 QA 截图：

- `qa/screenshots/v530_yikeyin_board_barrel_tile_overlap.png`
- `qa/screenshots/v530_yikeyin_eave_tile_profiles.png`
- `qa/screenshots/v530_yikeyin_tapered_pan_cover_courses.png`
- `qa/screenshots/v530_yikeyin_curved_tile_roof_ridge_no_leak.png`
- `qa/screenshots/v530_measured_board_barrel_tile_exterior.png`
- `qa/screenshots/v530_three_bay_front_gallery_tile_roof.png`

这些成果应被复核、重构和数据化，不能全部推倒后恢复旧版平面灰屋顶。

### 2.3 当前性能基线

`data/qa/local_browser_smoke_test.json` 记录：

- 一颗印主模型约 586614 三角面、26665 条结构线。
- 三开间前廊测绘个案约 275420 三角面、11096 条结构线。
- 团结乡生产参考层在一颗印分支中记录约 236192 个瓦面相关计数。

V5.4.2 必须控制新增瓦件成本。默认网页标准档需要保持旋转、缩放、门窗和人物演示流畅。

## 3. 当前证据体系

### 3.1 刘致平图录

`data/evidence/reference_manifest.json` 已登记九张刘致平图录文件，位于本地忽略目录：

- `liu_zhiping_atlas_01.jpg`
- `liu_zhiping_atlas_02.jpg`
- `liu_zhiping_atlas_03.jpg`
- `liu_zhiping_atlas_04.jpg`
- `liu_zhiping_atlas_05.jpg`
- `liu_zhiping_atlas_06.jpg`
- `liu_zhiping_atlas_07.jpg`
- `liu_zhiping_atlas_08.jpg`
- `liu_zhiping_atlas_09.jpg`

公开仓库只保存清单、哈希、事实提取和适用边界，不发布来源权利未确认的原图。

### 3.2 三开间前廊个案

`data/evidence/yikeyin_additional_sources_2026_08_21.json` 已锁定另一组瓦件草测值：

- 板瓦长约 223 mm。
- 板瓦大口约 242 mm，小口约 221 mm。
- 筒瓦长约 222 mm。
- 筒瓦大口约 115 mm，小口约 90 mm。
- 纵向露明量按实景照片作视觉校准，未锁定为实测搭接。

这组数据属于独立个案，不得覆盖刘致平图录样本。

### 3.3 团结乡视觉参考

团结乡样本已经提供：

- 长期风化土墙外观。
- 云南板瓦和筒瓦的可见关系。
- 旧木构综合色。
- 多屋面组合和修补痕迹。

团结乡资料目前缺少精确瓦件尺寸、搭接、基层和修缮年代，因此只参与外观和关系校准。

## 4. 当前生成器审计

文件：`threejs/YunnanCourtyardProduction.js`

### 4.1 仍在使用的旧视觉默认值

当前 `YUNNAN_COURTYARD_DEFAULTS` 包含：

```js
tileWidth: 0.28,
tileLength: 0.64,
tileCourse: 0.46,
tileThickness: 0.055,
```

这些值没有与刘致平图录样本、三开间前廊草测和团结乡视觉参考分层。V5.4.2 需要把它们迁移到明确的兼容配置，并标注：

`deprecated-legacy-visual-profile`

默认生成器应读取带 `caseId` 和 `evidenceStatus` 的瓦件 profile。

### 4.2 板瓦和筒瓦数量关系

当前 `addRoof()` 对板瓦和筒瓦采用相同的横向数量 `across`。

正确拓扑要求：

- 板瓦形成水槽列。
- 筒瓦位于相邻板瓦列的接缝中心。
- 筒瓦主列数量应由板瓦接缝数量推导。
- 两侧边缘收口独立建模。

### 4.3 无来源的纵向错位

当前筒瓦位置使用：

```js
coverZ = run + tileCourse * 0.23
```

`0.23` 没有来源登记。V5.4.2 应分别定义：

- `tileLength`
- `exposure`
- `lap`
- `courseStartAtEave`
- `courseEndAtRidge`
- `courseOffset`
- `status`

缺少测绘时允许视觉校准值，网页必须显示 `visual-calibration-only`。

### 4.4 搭接关系隐含在 tileCourse 中

当前 `courses = ceil(halfRun / tileCourse)`，搭接被隐含为 `tileLength - tileCourse`，但没有：

- 来源记录。
- 末端裁切策略。
- 檐口第一片定位。
- 屋脊末片收口。
- 板瓦和筒瓦分别计算。

这些关系需要进入数据层和自动验收。

### 4.5 构件缺口

当前核心生成函数主要生成板瓦和筒瓦。V5.4.2 需要补齐或正式整理：

- 滴水。
- 勾头。
- 正脊。
- 垂脊。
- 封头。
- 屋面基层。
- 瓦面排水路径。
- 檐口边缘收口。

高等级祠庙和寺庙兽头、走兽、仙鱼和彩画保持在等级受控词汇库中，普通一颗印不自动调用。

### 4.6 性能结构

当前每片瓦以独立 Mesh 方式进入场景。V5.4.2 应优先采用：

- 共享 BufferGeometry。
- InstancedMesh。
- 批次到语义 ID 的映射表。
- 研究高精度、网页标准、远景简化三个质量档。

三个质量档共用坡面、行列和排水拓扑，不能形成三套互相无关的资产。

### 4.7 附属屋面

当前 `addShed()` 调用双坡 `addRoof()`。需要按宿主类型复核：

- 独立柴屋或服务房可以使用独立双坡。
- 大厦、小厦和披檐使用附属单坡生成器。
- 主体房屋继续使用双坡或有图证的多坡。

## 5. V5.4.2 数据迁移目标

### 5.1 瓦件 profile

至少建立四个 profile：

1. `liu-zhiping-atlas-kunming-sample`
2. `three-bay-front-gallery-survey-sample`
3. `tuanjie-township-visual-reference`
4. `legacy-visual-compatibility`

每个 profile 至少包含：

- `caseId`
- `region`
- `era`
- `dimensions`
- `topology`
- `evidenceSources`
- `evidenceStatus`
- `unresolvedFields`
- `allowedUses`
- `prohibitedUses`

### 5.2 坡面实例

每个坡面必须拥有：

- `roofUnitId`
- `slopeId`
- `hostBuildingId`
- `eaveLine`
- `ridgeLine`
- `maximumFallDirection`
- `tileProfileId`
- `qualityProfile`
- `drainageTarget`
- `evidenceStatus`

### 5.3 瓦件追溯

每个实例或实例批次映射到：

- 建筑支系。
- 类型。
- 个案。
- 单体。
- 坡面。
- 板瓦或筒瓦列。
- 行列索引。
- 檐口或屋脊归属。
- 证据状态。

## 6. 观察网页要求

瓦作工作台应读取实际生成器状态，并至少提供：

1. 完整瓦面。
2. 单坡隔离。
3. 屋面爆炸。
4. 檐口近景。
5. 板瓦单独显示。
6. 筒瓦单独显示。
7. 勾头与滴水交替显示。
8. 水流路径。
9. 证据状态和未解项。
10. 刘致平样本与三开间前廊样本对比。
11. 质量档切换。
12. 构件 ID 和坡面 ID 查询。

工作台不得只显示静态图解。切换 profile 或质量档后，实际 WebGL 几何、统计和检查结果必须同步变化。

## 7. 回归边界

以下能力在 V5.4.2 中不得退化：

- 建筑完整显示。
- WebGL 深度遮挡。
- 旋转和缩放。
- 院内观察与显式剖切分离。
- 门窗自动演示。
- 人物入户并到达二层。
- 人眼自由观察。
- 团结乡 GLB 查看器。
- GitHub 同步中枢。
- GitHub Pages 无外部 CDN 部署。

## 8. 完成门槛

V5.4.2 合并前必须确认：

1. `VERSION`、`CHANGELOG.md`、`PROJECT_STATE.md` 已更新。
2. 瓦作知识写入结构化 JSON。
3. 生成器读取 profile，不再直接依赖旧视觉默认值。
4. 板瓦水槽和筒瓦盖缝拓扑通过检查。
5. 勾头、滴水和水流可观察。
6. 未解搭接、基层和脊部节点继续明确标记。
7. 网页标准档保持可交互。
8. `python tools/validate.py` 通过。
9. `python tools/browser_smoke_test.py` 通过。
10. `python tools/make_release.py` 成功。
11. GitHub Pages 工作流通过。
12. PR 中提供真实 QA 截图和测试数据。
