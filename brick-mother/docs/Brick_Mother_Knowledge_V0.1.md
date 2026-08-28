# Brick Mother 知识体系 V0.1

状态：视觉方向与生成逻辑草案  
日期：2026-08-28  
范围：土坯砖、烧结砖、砌筑石块  

## 1. 目标

用一个共享的 Brick Mother 生成三类砌筑单元：

1. `ADOBE`：土坯砖，可以含稻草或其他植物纤维。
2. `FIRED_CLAY`：烧结砖，禁止出现稻草。
3. `STONE`：砌筑石块，禁止出现稻草。

三类材料共享尺寸、比例、手工成型误差、边角控制、随机种子、年代与环境接口。材料内部结构、孔洞来源、破损方式、颜色成因分别计算。

生成目标是可解释、可复现、可批量扩展的三维资产。上传模型用于提取形体逻辑与可见特征，原模型贴图不进入最终生成链。

## 2. 当前证据包

上传压缩包：`砖brick (2).zip`  
SHA-256：`8567d93a3e129dc3a91b03ad0cb690ad61d3020cb5e82e823b971906e6d0742c`

只完成了只读目录核对，目前含 6 个 GLB：

| 文件 | 暂定用途 | 当前状态 |
|---|---|---|
| `12th_-14th_century_building_brick.glb` | 历史烧结砖或年代特征参考 | 待做几何测量 |
| `brick (1).glb` | 通用砖形参考 | 待做几何测量 |
| `brick.glb` | 通用砖形参考 | 待做几何测量 |
| `clay_brick.glb` | 土坯或黏土砖候选参考 | 待判型 |
| `stone_brick.glb` | 砌筑石块参考 | 待做岩性判读 |
| `white_wall_texture.glb` | 抹灰或墙面参考 | 暂不纳入 Brick Mother |

文件名只能提供线索。材料身份需要通过几何、截面、表面特征和用户确认共同确定。

## 3. 总体结构

```text
Evidence Intake
  -> BrickDNA
  -> Shared Shape Kernel
  -> Material Program
  -> Pore and Inclusion Program
  -> Weathering Program
  -> Surface Response
  -> Deterministic Renderer
  -> QA and Approval
```

每个参数都保存四项信息：

- `value`：当前数值或枚举值
- `unit`：毫米、摄氏度、年、比例等
- `status`：`observed`、`inferred`、`art_directed`、`pending`
- `evidenceRefs`：来源文件、文献或审批记录

未知信息维持 `pending`，不自动伪造为确定事实。

## 4. 共享形体母核

所有材料共用以下接口，数值使用真实物理单位：

| 参数组 | 关键参数 | 含义 |
|---|---|---|
| 尺寸 | `lengthMm`, `widthMm`, `heightMm` | 成品尺寸 |
| 手工度 | `handmadeAmount` | 模具偏差、轻微锥度、面部起伏 |
| 形变 | `bow`, `twist`, `taper`, `shrinkage` | 干燥、烧制或加工造成的整体变化 |
| 边角 | `edgeRadiusMm`, `cornerBias`, `edgeIrregularity` | 初始边缘及局部不均匀性 |
| 大破损 | `chipCount`, `chipScaleMm`, `chipSharpness` | 实际几何缺口 |
| 面身份 | `front`, `side`, `top` | 三个连续表面的朝向与接缝 |

尺寸变化与微观尺度分离。砖体放大一倍时，稻草直径、矿物颗粒和微孔尺寸不会自动放大一倍。

## 5. 三类材料的独立规律

| 逻辑 | `ADOBE` 土坯 | `FIRED_CLAY` 烧结砖 | `STONE` 石块 |
|---|---|---|---|
| 主体 | 黏土、粉砂、砂、水 | 黏土或页岩经干燥和烧制 | 岩石矿物与胶结物 |
| 稻草 | 允许，含量、长度、方向可控 | 强制为 0 | 强制为 0 |
| 典型孔洞 | 收缩孔、纤维脱落孔、不规则连通孔 | 烧结孔、气泡孔、挤出或成型孔 | 粒间孔、溶蚀孔、层理或裂隙孔 |
| 新鲜边缘 | 偏软，手工模具感强 | 偏硬，可带切割或模具痕 | 受凿切、劈裂和岩性控制 |
| 年代破坏 | 雨蚀圆化、泥质流失、纤维暴露、干湿裂缝 | 脆性崩角、磨耗、盐霜、局部剥落 | 沿矿物、层理、解理或胶结弱区风化 |
| 颜色主因 | 当地土壤、含水率、铁氧化物、碳酸盐、有机质 | 原料矿物、峰值温度、窑内气氛、保温与冷却 | 岩性、矿物比例、颗粒、铁染、含水率 |
| 表面随机性 | 土团、砂粒、草纤维和压实不均 | 窑位、火候、成型纹和批次变化 | 矿物晶粒、层理、脉体和天然裂隙 |

### 5.1 土坯专属

- 稻草是有方向和长度分布的三维纤维，不能画成表面贴花。
- 稻草暴露量由表面侵蚀深度决定，脱落后留下与纤维形状相符的空隙。
- 圆蚀优先发生在外露棱角和水流汇集处，受压或受遮蔽部位保留更多原始形体。
- 湿润会使颜色暂时变暗；反复干湿会增加泥质流失和局部裂缝风险。

### 5.2 烧结砖专属

- 颜色由原料化学组成、烧成温度、氧化或还原气氛、窑位和冷却共同控制。
- 同一原料和工艺中，较高烧成程度通常对应更深颜色、较低吸水率和更高强度。跨原料比较时，颜色不能直接替代强度判断。
- 氧化烧成可形成红、橙红和棕红；还原或闪烧可以形成深褐、黑色或蓝灰色区域。
- 边缘破损保持陶瓷材料的脆性，缺口偏尖锐。长期磨耗会让局部棱线变钝，但不会变成土坯式整体泥化。

### 5.3 石块专属

- 先选择岩性：砂岩、石灰岩、花岗岩、板岩或其他本地石材，再生成对应矿物、颗粒、层理和解理。
- 孔隙、毛细吸水、粗糙度和矿物组成共同决定风化与生物附着倾向。
- 砂岩可沿胶结弱区产生颗粒脱落和层状侵蚀；板岩或薄层岩石更容易沿解理剥离；花岗岩表现为晶粒与裂隙控制的局部崩落。
- 颜色从岩性和矿物场生成，黄褐铁染、蓝灰基质与湿润暗化均需沿真实结构分布。

## 6. 地址到地方材料

地址提供区域先验，不能单独确定一块砖的精确颜色。实际取土点、采石点、窑炉和修缮历史可能离建筑地址有一定距离。

建议流程：

1. 地址转经纬度、海拔和行政区域。
2. 查询土壤、地质、地形和气候数据。
3. 形成 3 个候选地方材料档案，并保存置信区间。
4. 优先使用当地实物照片、样本或文献修正候选档案。
5. 用户审批后锁定项目级 `LocalMaterialProfile`。

`LocalMaterialProfile` 至少包含：

```yaml
location:
  address: pending
  latitude: pending
  longitude: pending
  altitudeM: pending
source_material:
  soil_or_lithology: pending
  clayPct: pending
  siltPct: pending
  sandPct: pending
  coarseFragmentPct: pending
  ironInfluence: pending
  carbonateInfluence: pending
  organicInfluence: pending
color:
  dryMunsell: pending
  wetMunsell: pending
  paletteCandidates: [yellow_ochre, red_earth, blue_gray]
confidence:
  spatialResolutionM: pending
  score01: pending
  evidenceRefs: []
```

全球级 SoilGrids 可提供 250 米分辨率的黏土、粉砂、砂、粗颗粒、有机碳等预测，并为像元提供不确定性。生产时仍要优先叠加地方调查和实物证据。

## 7. 时间系统

时间分成三个概念：

- `materialAgeYears`：材料自制成以来的年龄
- `exposureAgeYears`：实际暴露在风雨中的累计时间
- `repairAgeYears`：最近一次修补或翻面的时间

高层输入可以使用 `NEW`、`MATURE`、`OLD`、`RUIN`。内部计算使用连续的环境剂量：

```text
weatherDose = exposureAgeYears
            * climateSeverity
            * rainExposure
            * moistureRetention
            * orientationFactor
            * pollutionAndSalt
            * maintenanceModifier
```

同样 70 年的砖，在干燥檐下和迎雨墙脚会产生完全不同的状态。年代不会直接把表面统一变灰；它会驱动各材料自己的物理变化。

### 7.1 年代输入映射

| 用户说法 | 系统初值 | 还需要读取的条件 |
|---|---:|---|
| 新房子 | `exposureAgeYears = 0..5` | 工艺、批次、施工水分 |
| 有些年头 | `5..30` | 朝向、檐口、雨量、维护 |
| 老房子 | `30..120` | 修补史、盐、毛细水、生物附着 |
| 很老或遗址 | `120+` | 结构失稳、材料替换、残存保护层 |

区间只是交互初值。建筑年份、观察年份和修缮记录拥有更高优先级。

### 7.2 年代结果按材料分流

| 剂量结果 | 土坯 | 烧结砖 | 石块 |
|---|---|---|---|
| 边缘 | 连续圆蚀、局部退缩 | 小型脆裂加磨圆 | 沿晶粒、层理或解理退缩 |
| 孔洞 | 纤维脱落孔和泥质冲刷孔增加 | 盐冻或制造缺陷处扩展 | 连通孔、溶蚀孔和裂隙增强 |
| 颜色 | 湿暗、冲刷变浅、泥尘沉积 | 本体色稳定，叠加尘污、盐霜、窑色差 | 湿暗、铁染、矿物变化、生物膜 |
| 纹理 | 草纤维逐渐显露 | 硬质表面与缺口并存 | 粗糙度随岩性分别变化 |

## 8. 色差系统

色差使用分层、相关的随机性，避免每块砖独立抽成杂乱彩虹：

```text
Project palette
  -> production source or quarry
  -> batch
  -> kiln zone or material lens
  -> individual unit
  -> face exposure
  -> pore and micrograin
```

关键控制：

| 参数 | 作用 |
|---|---|
| `uniformity01` | 越高，批次与单砖色差越低 |
| `batchCount` | 一面墙包含多少生产或采集批次 |
| `batchShift` | 每批的色相、明度和饱和度偏移 |
| `spatialPatchScaleM` | 墙面色差簇的空间尺度 |
| `kilnZoneVariance` | 烧结砖窑位差异 |
| `wetnessResponse` | 当前含水率造成的临时暗化 |
| `weatherStainStrength` | 铁染、尘污、盐霜和生物膜强度 |

“没有色差”映射为高一致性与单批次，同时保留极小的微观变化，避免计算机式纯色。

## 9. 三维随机场与种子

每个结果可以由同一参数和种子完全复现：

- `shapeSeed`：尺寸、翘曲、边缘与大缺口
- `compositionSeed`：土团、矿物、颗粒和色域
- `poreSeed`：孔洞数量、尺度和连通性
- `inclusionSeed`：稻草、碎粒、脉体等夹杂物
- `weatherSeed`：水流、盐、生物膜和年代破损

三个表面读取同一套三维场。跨边缘的裂缝、色带、层理与缺口必须连续，不能给三个面分别生成互不相干的二维噪声。

## 10. 几何与材质的尺度分工

初始建议，后续由参考模型和浏览器性能校准：

| 尺度 | 表达方式 | 示例 |
|---|---|---|
| 大于 2 mm | 实际几何或体素布尔 | 崩角、深孔、层状剥离 |
| 0.2 到 2 mm | 位移或近景几何 | 浅蚀、草梗沟、明显颗粒 |
| 小于 0.2 mm | 法线、粗糙度和微表面 | 细砂、烧结微孔、晶粒反光 |

远景 LOD 逐步将小结构烘焙到法线与粗糙度。轮廓与主要空洞始终保留几何证据。

## 11. 强制合法性规则

1. `FIRED_CLAY.strawContent = 0`
2. `STONE.strawContent = 0`
3. `ADOBE.firingTemperatureC = null`
4. `STONE.firingTemperatureC = null`
5. `FIRED_CLAY.beddingStrength = 0`，除非记录的是原料层压缺陷且另有证据
6. `ADOBE.vitrification = 0`
7. 石块的层状侵蚀必须跟随岩性、层理或解理方向
8. 烧结砖蓝灰色需要还原烧成、闪烧、矿物或表层处理依据
9. 稻草脱落孔必须与历史纤维场一致
10. 年代值必须同时读取环境与维修记录

## 12. 三面图快速迭代协议

每个候选砖输出一张三格证据条：

1. 正面：长乘高
2. 侧面：宽乘高
3. 顶面：长乘宽

三格必须来自同一个三维资产、同一个种子和同一色彩管理。摄像机使用固定正交尺度，背景、曝光、光源和单位标尺保持一致。

每轮评审只改变一组变量：

- A 轮：比例与手工度
- B 轮：材料身份和孔洞
- C 轮：边缘与破损
- D 轮：地方色与批次色差
- E 轮：年代与环境剂量

当前九宫格属于视觉方向板。正式生产证据必须由同一个三维资产从三个摄像机渲染，以保证跨面连续性。

## 13. QA 闸门

| 闸门 | 通过条件 |
|---|---|
| G0 逻辑 | 没有稻草串材、烧成串材等非法组合 |
| G1 物理尺度 | 尺寸、孔径、草纤维和颗粒均使用毫米并相互合理 |
| G2 跨面连续 | 三面层理、裂缝、色带和缺口在边界连续 |
| G3 轮廓 | 圆蚀、脆裂、劈裂三种失效方式可从剪影辨识 |
| G4 材料读感 | 关闭颜色后仍可从几何与粗糙度区分三类材料 |
| G5 年代 | 老化结果能由时间、环境和维修记录解释 |
| G6 地方性 | 地址数据带置信度，已有地方证据能够覆盖区域先验 |
| G7 浏览器 | 固定相机截图、近中远 LOD、性能和随机种子均有记录 |

## 14. 第一张视觉板的预设

```yaml
presetId: yunnan_highland_old_house_v01
locationMode: regional_visual_prior
locationConfidence: low
materialAgeYears: 70
exposureAgeYears: 55
climate: humid_subtropical_highland
rainExposure01: 0.55
moistureRetention01: 0.35
saltExposure01: 0.12
maintenanceHistory: unknown
views: [front, side, top]
materials: [ADOBE, FIRED_CLAY, STONE]
```

这组参数用于展示三类母体的分流能力，不代表云南某一个具体地址的考据结论。

## 15. 下一阶段进入生产所需工作

1. 只读解析 6 个 GLB，输出尺寸、三角面数、包围盒、UV、材质槽和几何异常。
2. 对候选砖提取比例、边角半径、缺口尺度谱、孔洞形状与面部起伏。
3. 建立第一版确定性三维 Brick Mother，先只生成单砖。
4. 用固定三摄像机输出真实三面图，并提供种子和参数回执。
5. 用户批准材料身份后，再连接墙体、砂浆、抹灰和侵蚀实验室。

## 16. 依据

- Brick Industry Association, [Manufacturing of Brick](https://www.gobrick.com/media/file/9-manufacturing-of-brick.pdf)
- Brick Industry Association, [Specifications for and Classification of Brick](https://www.gobrick.com/media/file/9a-specifications-for-and-classification-of-brick.pdf)
- USDA NRCS, [From the Surface Down: An Introduction to Soil Surveys](https://www.nrcs.usda.gov/sites/default/files/2022-11/from-the-surface-down.pdf)
- ISRIC, [SoilGrids global gridded soil information](https://isric.org/explore/soilgrids)
- National Park Service, [Measuring the Effects of Rainstorm Intensity on Adobe Walls](https://www.nps.gov/articles/sodn_adobe_test_walls.htm)
- National Park Service, [Salt Weathering in Adobe and Earthen Structures](https://www.nps.gov/articles/000/field-kit-and-methodology-for-detecting-measuring-and-remediating-salt-attack-salt-weathering-in-adobe-and-earthen-structures.htm)
- Historic England, [Characterisation of Primary and Secondary Stone Bioreceptivity](https://historicengland.org.uk/research/results/reports/9132/CharacterisationofPrimaryandSecondaryStoneBioreceptivity)
- Historic England, [Assessing Damp in Historic Buildings](https://historicengland.org.uk/images-books/publications/assessing-damp-historic-buildings/heag311-assessing-damp-historic-buildings/)
- U.S. Geological Survey, [What are sedimentary rocks?](https://www.usgs.gov/faqs/what-are-sedimentary-rocks)

