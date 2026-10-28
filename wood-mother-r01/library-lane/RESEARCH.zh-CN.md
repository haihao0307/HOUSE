# Wood Mother R02：组织、切面、处理与老化分开

研究日期：2026-10-28。用途：实现建议与知识来源，不是已实现/已通过视觉验收声明。以下六项是展示配置，并非六种已标定的真实树种；本轮不导入商业资产或许可不明代码。

## 1. 为什么不能只换六个颜色

每个实例引用同一母体，参数分成四组：

- **木材组织**：早/晚材比例、导管孔径与分布、木射线、纤维方向、木节与共同生长场。
- **切面**：端切、径切、弦切；应查询同一个三维组织，不能各面画不相干的贴纹。
- **表面处理**：原木、油蜡、缎光、亮漆。独立的表层，不改变树木类别。
- **老化**：曝光、灰化、表层侵蚀、污渍、漆层磨损。不是将整个木块统一变灰。

木材都是介电体，metalness = 0。名字暂用“针叶材组织示意”“环孔材组织示意”等，不把未经标定的程序图称为精确松木/橡木/胡桃木。

## 2. 六个有价值的展示配置

| 配置 | 必须可辨的组织特征 | 默认切面/处理 | 不应出现 |
|---|---|---|---|
| 无导管针叶材 | 早晚材环带、细纵向纤维、木节 | 纵切，原木哑光 | 橡木式大导管孔遍布表面 |
| 环孔材弦切 | 早材区较大孔，晚材区较小孔；弦切产生山形年轮 | 弦切，开放孔哑光 | 仅换成棕色条纹 |
| 同组织径切 | 同一导管场；径切射线斑与近直年轮 | 径切，油蜡 | 另做一套无关联的纹理 |
| 细散孔材 | 一年轮内部孔径相对均匀且细，年轮对比低 | 纵切，缎光 | 每一圈都强黑线/大早材孔 |
| 半环孔材 | 孔径沿年轮渐变，配合心边材颜色区域 | 纵切，亮漆 | 用“更深颜色”等同于不同木种 |
| 风化外露材 | 表面灰化、早材优先侵蚀、纵向检查裂纹、局部漆层磨损 | 以针叶材为基底，风化 | 新切内部也自动变旧；按slider伪称真实年数 |

前五项中的物种联想只是审美参照；第3项是切面差异，第6项是表面状态差异，不是新增生物分类。

## 3. 不加多轮 fBm 的共同三维组织建议

以下为原创工程近似，不声称是论文原实现。

1. 先复用已有 growth/warp 坐标，取得木材局部径向距离、方位、轴向与年轮相位；孔与射线必须使用同一套坐标。
2. **导管**：横截面二维细胞 hash 决定中心和半径，沿局部纤维方向延续。查询同一管域，端面自然是点/孔，纵面自然是长条。环孔材的半径/密度由年轮相位调制；散孔材减弱该调制；针叶材关闭大导管域。
3. **射线**：用若干窄方位扇区与有限轴向高度定义径向薄片。端面显示径向线，径切面显示斑块，弦切面显示较短断面。方位周期首尾必须连续，不能 atan2 接缝跳变。
4. 这些是材质域的小尺度近似，默认影响颜色、粗糙度和法线，**不冒称已生成真实中空导管几何或真实透射纤维散射**。
5. 固定 seed；播放只变化明确的参数，不能每帧重抽随机数导致木纹沸腾。

## 4. 表层不是换色或降低同一个 roughness

Adobe Designer 当前默认 OpenPBR。重要的是分开基底镜面粗糙度、方向性、折射率，以及独立涂层的强度、粗糙度、吸收/暗化。官方参数默认值不是实测木材值。[Adobe Material properties](https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/workspace/3d-view/material-properties)

建议保留 `baseRoughness, fiberTangent, baseNormal, coatWeight, coatRoughness, coatIOR, coatNormal`。原木孔隙起伏不能因加漆全部消失；漆层法线可以更平滑。叠加高光要衰减底层能量，不是无限加白。需可见的大面积灯源反射，单个小白点难说明涂层质感。CPU简化版若没有完整多重散射与各向异性，必须写“分层近似”，不能标为完整 OpenPBR 实现。

艺术调参起点而非测量：原木 base roughness 0.55–0.8；油蜡 0.35–0.55；亮漆保留基底组织、coat roughness 0.06–0.18。不同渲染器粗糙度映射不一定相同，数值须看实际图再定。

## 5. 老化与播放边界

USDA研究把木材风化视为表面受日光、水分等共同作用；颜色、起毛与检查裂纹具有暴露条件差异。曝光mask应影响表面而非整个材积；新剖开的内部应保持基底状态。[USFS Weathering of wood](https://research.fs.usda.gov/treesearch/22122) [Above Ground Deterioration](https://www.fpl.fs.usda.gov/documnts/pdf2014/fpl_2014_kirker003.pdf)

播放推荐显示“木节/年轮参数循环演示”，有播放、暂停、进度和复位。若木节位置往返或年轮数量回退，这是教学参数动画，不是植物真实生长模拟。真正生长时间应单调，循环端点是重置。0与1帧一致，不能突然切换seed。

## 6. 教师与授权清单

| 来源 | 真正吸收什么 | 授权及边界 |
|---|---|---|
| [Procedural Knots](https://github.com/marialarsson/procedural_knots) | 统一生长场、木节周围年轮组织关系 | MIT，保留版权许可；不代表完整木材PBR |
| [Maxon WoodGrain.osl](https://github.com/Maxon-Computer/Redshift-OSL-Shaders/blob/main/WoodGrain.osl) | 环纹、纵纤维、扰动和多输出组织方式 | 文件标CC-BY-SA但版本不明；本轮只学思路，不复制代码。不是SideFX原生VEX |
| [community Designer wood/material.sbs](https://github.com/dcc-mcp/dcc-mcp-substance3d-designer/blob/main/docs/showcase/crate-lookdev/wood/material.sbs) | 通道拆分、程序图组织 | 社区项目，不是Adobe官方开源；仓库MIT不授权Adobe sbs://依赖实现及受限资产 |
| [Adobe Designer material properties](https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/workspace/3d-view/material-properties) | 基底、各向异性、清漆分层 | 官方文档学习；不提取商业节点源码 |
| [Adobe Sampler Varnish](https://experienceleague.adobe.com/en/docs/substance-3d-sampler/using/filters/wear-and-finish/varnish) | varnish作为独立表层处理的用户操作模型 | 文档不是开源滤镜实现 |
| [ASWF OpenPBR](https://github.com/AcademySoftwareFoundation/OpenPBR) | 材质模型规范、参数与MaterialX参考实现 | Apache-2.0；若移植代码另保留许可/NOTICE，当前建议仅原创近似，不声称完整移植 |
| [USDA Wood Handbook anatomy chapter](https://research.fs.usda.gov/treesearch/62242) | 导管、针叶材、环孔/散孔、射线与切面基础 | 官方知识来源，不是木种数值标定库 |

额外组织资料：[USFS Structure and function of wood 2005](https://www.fpl.fs.usda.gov/documnts/pdf2005/fpl_2005_wiedenhoeft001.pdf)。软/硬木是植物学分类，不等于字面硬度。

## 7. 统一验收

- 相同灯光、形体、相机下六样本可辨；去掉颜色仍应有组织或表层差别。
- 同一材质跨端面、径切、弦切有连续关系，孔不能三面都变成独立圆点。
- 粗糙度、法线、颜色有对应但不强制全部同一噪波。
- 旋转时清漆反射随视角变化，不能是画死白斑；原木不呈金属。
- 新旧变化不侵入未暴露内部，种子不闪烁。
- 记录实际尺寸、fps、完整帧耗时和视觉截图；慢不能报流畅，预设参数不能报物种实测。
- 保留原版本；只替换木材工作台新增实验，不触碰A4或其他项目。
