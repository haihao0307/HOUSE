# Brick Mother Gaea 工作流蒸馏 V1

## 目标

把 Gaea 的节点图工作方式蒸馏成可在 Brick Mother 中独立运行的程序化材料场。这里吸收的是公开文档中的工作方法、节点职责和组合逻辑，运行时代码为独立实现，不依赖 Gaea，也不复制其内部算法。

本轮重点解决四件事：

1. 岩石、烧结砖和土坯都拥有宏观、中观、微观三个尺度的细节链。
2. 颜色由坡度、空洞、突出、岩石图、流水、风化和分层等数据遮罩驱动。
3. 色彩先经过自动拉伸、局部清晰度和遮罩锐化，再进入多色渐变和多通道混合。
4. 形体、颜色、粗糙度、微法线和 AO 共用同一批事件场，减少浮在表面的随机花纹。

## 从 Gaea 节点图提取出的核心原则

### 一、所有复杂结果都由可检查的中间场组成

Gaea 把地形、遮罩和颜色都视为可连接的节点输出。Brick Mother 对应建立四类场：

- `Geometry Field`：宏观轮廓、破损、孔洞、岩层、微侵蚀。
- `Data Field`：坡度、曲率近似、空洞、突出、岩石图、流水、分离遮罩。
- `Color Field`：基底、暖色、氧化、矿物、潮湿、生物附着和夹杂颜色。
- `Render Field`：粗糙度、微法线、AO 和最终光照。

每个场都能进入诊断通道，不允许只在最终画面中出现无法解释的随机效果。

### 二、低强度多次复合优于单次极端处理

Gaea 的 LookDev 文档建议同类节点以较低强度重复使用，得到更复杂的结果。Brick Mother 将其转化为：

- 两层不同尺度的 `Rugged` 类破碎场。
- 一层局部分层场。
- 一层只增强沟槽与裂隙的微侵蚀场。
- 最后使用轻量的遮罩锐化，不对全局轮廓做过强锐化。

岩石档案使用两次低强度破碎和一次分层；烧结砖降低分层，只保留烧结裂隙与矿物团粒；土坯主要强化纤维夹杂周围的微侵蚀。

### 三、Combine 同时产生分离遮罩

Gaea 的 Combine 节点不仅混合两个输入，也能给出分离遮罩。Brick Mother 的 `separation mask` 记录两个材料事件场之间的差异，例如：

- 岩层与破碎面交界。
- 暖色烧结区与深色骨料交界。
- 水痕与干燥表面交界。
- 稻草或稻壳与泥土基底交界。

分离遮罩会同时提高颜色边界、粗糙度变化和微法线响应，使颜色更加锐利，同时保持材料关联。

### 四、颜色来自数据遮罩，不来自孤立彩色噪波

Gaea 的 CLUTer 可以把任意灰度场映射为渐变；Synth 可以从参考图提取有限色阶；Splat 可以把多个高度场编码并归一化混合；ColorFX 提供亮度、对比度、HSL、Gamma、Clarity 和噪波等后处理。

Brick Mother 对应建立以下链路：

1. 从宏观噪波、岩石图、分层、流水和空洞获得灰度驱动场。
2. 通过 `AutoLevel` 把有效范围拉满。
3. 通过 `Clarity` 提高局部对比。
4. 通过 `MaskSharp` 控制边界锐度。
5. 通过五段 CLUT 映射深色、湿色、基底、暖色和浅矿物。
6. 通过四通道 Splat 权重混合暗骨料、氧化色、浅矿物和岩层色。
7. 在 linear-sRGB 中完成混合，最后转换到 sRGB 输出。

这条链可以得到高色彩密度，也能避免单纯提高饱和度造成的塑料感。

## Brick Mother 节点映射

| Gaea 节点思想 | Brick Mother 独立实现 | 作用 |
| --- | --- | --- |
| MultiFractal / Perlin / RockNoise | 多尺度 fBm、脊状 fBm、细胞板块 | 建立宏观到微观的基础场 |
| Warp / D-Warp | 三维域扭曲和方向扭曲 | 打散规则噪波和重复纹理 |
| AutoLevel / Curve / Gamma | 自动拉伸、曲线、Gamma | 控制遮罩动态范围 |
| Combine / MultiCombine | 多种数学混合和分离遮罩 | 复合多个事件场并保留边界 |
| Rugged / Shatter / Surface | 双层破碎、板块裂隙、局部突出 | 岩石和砖体表面细节 |
| Stratify | 不连续分层场 | 石材层理和断面层次 |
| MicroErosion | 沟槽与裂隙增强场 | 增强已有侵蚀结构 |
| Slope / Curvature / RockMap / Flow | 坡度、曲率近似、岩石图、流水 | 驱动颜色和 PBR 通道 |
| CLUTer / QuickColor | 五段渐变和双色渐变 | 从数据场生成颜色 |
| Synth / SatMaps | 参考色簇配置文件 | 建立材料家族色域 |
| Splat / RGBMix | 归一化四通道权重 | 混合骨料、氧化、矿物和岩层 |
| ColorFX | 明暗、饱和度、Gamma、清晰度 | 最终颜色校正 |

## 三套材料图谱

### 烧结砖

`MultiFractal → Domain Warp → Rugged Low → MicroErosion → Cavity / Flow / Separation → CLUT5 → Splat → ColorFX → PBR`

重点：烧结色带、氧化团粒、深色骨料、浅矿物、孔洞和水痕共用遮罩。

### 土坯

`MultiFractal → Directional Warp → Fiber Inclusions → MicroErosion → Cavity / Flow / Separation → Synth Palette → Splat → PBR`

重点：稻草、短纤维、稻壳、种粒和脱落空洞各自拥有种子，同时改变颜色、粗糙度、法线与空洞。

### 石块

`MultiFractal → Domain Warp → Rugged Low A → Rugged Low B → Stratify → MicroErosion → RockMap / Slope / Curvature → CLUT5 → Splat → PBR`

重点：先保留整体石块轮廓，再增加板块破碎、层理、微侵蚀和矿物色。锐化只作用在岩层边缘和裂隙遮罩上。

## 新增可调参数

- `rockDetail`：岩石板块与表面破碎强度。
- `strata`：局部分层和断面层理强度。
- `microErosion`：沟槽、孔壁与裂隙的微侵蚀强度。
- `colorClarity`：颜色驱动场的局部对比。
- `colorGamut`：综合色域混合比例。
- `maskSharpness`：颜色、岩层和侵蚀边界锐度。

这些参数进入每个材料档案的 `gaeaDNA` 和 `compositeDefaults`，并继续服从独立种子和可复现规则。

## 质量约束

1. 全局形体锐化保持低强度，防止轮廓锯齿和 LOD 闪烁。
2. 高锐度主要用于颜色分离遮罩、岩层边界和孔口，不直接放大所有高频噪声。
3. 水痕必须同时改变颜色和粗糙度。
4. 空洞必须同时改变几何、AO、颜色和微法线。
5. 岩石层理不得平均覆盖所有表面，应受坡度、破碎面和局部遮罩控制。
6. 所有随机节点必须拥有明确种子，单独更换一个种子不得改写无关层。

## 官方研究来源

- Gaea Node Reference: https://docs.quadspinner.com/Reference/
- Masking and process masks: https://docs.quadspinner.com/Guide/Using-Gaea/Modify-Shapes.html
- Combine: https://docs.quadspinner.com/Reference/Adjustments/Combine.html
- Rugged: https://docs.quadspinner.com/Reference/LookDev/Rugged.html
- Surface: https://docs.quadspinner.com/Reference/LookDev/Surface.html
- LookDev usage strategies: https://docs.quadspinner.com/Guide/Using-Gaea/LookDev.html
- MicroErosion: https://docs.quadspinner.com/Reference/Erosion/MicroErosion.html
- Stratify: https://docs.quadspinner.com/Reference/Erosion/Stratify.html
- RockMap: https://docs.quadspinner.com/Reference/Data/RockMap.html
- CLUTer: https://docs.quadspinner.com/Reference/Color/CLUTer.html
- Synth: https://docs.quadspinner.com/Reference/Color/Synth.html
- Splat: https://docs.quadspinner.com/Reference/Color/Splat.html
- ColorFX: https://docs.quadspinner.com/Reference/Color/ColorFX.html
- QuickColor: https://docs.quadspinner.com/Reference/Color/QuickColor.html

## 知识产权边界

本模块只采用公开文档描述的通用程序化工作方法。噪波、场函数、混合、着色器、数据结构和参数均在本仓库内独立实现。`Gaea` 名称仅用于说明研究来源和工作流对照。
