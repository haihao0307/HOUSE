# Brick Mother 实时风化与 PBR 材质 DNA V1.0

状态：知识基线已建立，运行时接入待内部验证，visualApproved=false，productionApproved=false。

## 1. 来源边界

本规则由两组资料蒸馏而成。

1. WebGPU Community 的 Patina Preview 展示页。公开资料确认了 Three.js、TSL、WebGPU、实时参数、凹部氧化聚集、表面高光钝化、噪波场与粗糙度调制等组织方式。公开页面没有给出完整源码和节点图，因此本文只吸收可验证的系统结构，不声称复刻其具体实现。
2. Adobe 与 Allegorithmic 的 The PBR Guide，重点采用 Part 2 的 Metal/Roughness、Base Color、Roughness、AO、Height、Normal、线性色彩空间和 PBR 校验规则。上传版为 2018 年第三版，共 104 页。

## 2. Brick Mother 的材料总原则

Brick Mother 中的烧结砖、土坯、天然石材、规则石、毛石、片石和卵石均按介电材质处理。默认 metalness=0。普通介电材质的 F0 采用 0.04 作为基线，允许在 0.02 至 0.05 的可信范围内按岩性和湿润状态做小幅变化。

材质生成严格按以下顺序执行：

1. 形体与承重关系
2. 面族与断裂事件
3. 暴露、遮蔽、接触和排水信号
4. 时间演化过程
5. Base Color、Roughness、Normal、Height、AO 等 PBR 通道投影
6. 中性光、掠射光和多环境复核

微观噪波不得承担整体造型。任何颜色、粗糙度、凹腔和风化痕迹都必须能追溯到同一组形成事件或环境过程。

## 3. 色彩空间与通道纪律

### 3.1 Base Color

Base Color 使用 sRGB 解释，记录介电材质的反射色。不得烘焙主光、阴影和大尺度 AO。只允许少量无法由实时 AO 表达的微遮蔽进入 Base Color。

介电材质亮度控制采用以下范围：

1. 宽容下限 30 sRGB
2. 严格下限 50 sRGB
3. 上限 240 sRGB

工作台增加 PBR Safe Color 诊断视图，对超出范围的像素输出热图，不直接把颜色压成单一灰度。

### 3.2 Roughness

Roughness 作为线性数据解释。黑色代表光滑，白色代表粗糙。它用于讲述材料状态和环境历史，禁止使用均匀白噪声覆盖整个表面。

粗糙度必须由以下事件共同决定：

1. 新鲜断面通常较干净，颗粒尺度决定粗糙响应
2. 长期积尘和盐壳提高粗糙度
3. 水膜在湿润阶段降低表观粗糙度并压暗 Base Color
4. 人脚、工具和水流磨蚀会降低局部粗糙度
5. 微裂、孔蚀和生物附着提高局部粗糙度

### 3.3 Normal 与 Height

Height 使用线性数据。实时渲染中只保留低频与中频形态，用于轮廓、层板、片状剥离、凹坑、接触下陷和排水沟槽。高频颗粒、砂眼和细小工具痕进入 Normal。

固定频率分工：

1. 几何：轮廓、承重面、主断面、一级崩角、真实悬沿
2. Height：中尺度起伏、层理、浅凹腔、剥离边和磨蚀沟槽
3. Normal：晶粒、砂眼、细微裂纹、工具细痕和表面颗粒

禁止把高频噪波同时叠加到几何、Height 和 Normal。

### 3.4 Ambient Occlusion

AO 使用线性数据，只影响环境漫反射贡献。AO 不得压暗镜面反射。AO 单独输出，禁止大尺度烘焙进 Base Color。

AO 来源包括真实凹腔、层下悬沿、接触底面、砌缝邻接和颗粒间微遮蔽。工作台必须提供 AO 单通道观察。

## 4. 实时风化状态模型

实时风化采用一组共享状态场。所有 PBR 通道从同一状态场读取结果。

核心信号：

1. exposure：天空、雨水、太阳和风的暴露程度
2. cavity：凹部、孔洞、层下和裂隙深处
3. upwardness：朝上程度
4. underside：底面和悬沿下方
5. contact：与地面、砂浆或邻石接触区域
6. runoff：由重力和坡度形成的排水路径
7. freshFracture：新鲜断面和近期崩裂
8. abrasion：水磨、人为踩踏、工具摩擦和石块碰撞
9. wetness：瞬时含水状态
10. retainedMoisture：排水后残留湿度
11. deposit：尘土、盐、泥、烟尘和生物膜沉积
12. leaching：可溶矿物迁移和颜色漂白

每个信号都必须可单独显示，方便检查随机噪波是否破坏因果关系。

## 5. 时间演化规则

运行时使用确定性种子和明确时间步。相同 profile、seed、controls、environment、time 必须得到一致结果。

建议更新关系：

wetnessNext = clamp(wetness + rainInput + runoffIn + splashInput - evaporation - drainage, 0, 1)

retainedMoistureNext = clamp(retainedMoisture + wetnessNext * cavityRetention - dryingRate, 0, 1)

depositNext = clamp(deposit + airborneDust * shelter + muddyRunoff * runoff - washOff, 0, 1)

leachingNext = clamp(leaching + wetDryCycles * mineralSolubility * runoff - redeposition, 0, 1)

abrasionNext = clamp(abrasion + traffic + impact + waterVelocity - surfaceRecovery, 0, 1)

时间演化只改变被过程触及的区域。滑块从 0 调到 1 时，不允许全表面同步变色。

## 6. 从 Patina Preview 吸收的节点组织

Patina Preview 的可验证价值集中在运行时组织方式：凹部遮罩、噪波场、粗糙度调制、实时参数和材质状态联动。Brick Mother 将这一思路转换成石材与砖材的环境演化图。

TSL 图分为四层：

1. StoneSignals：法线、曲率近似、坡度、凹部、接触、排水和断面
2. WeatheringState：湿润、残留湿度、沉积、溶蚀、盐析、生物附着和磨蚀
3. MaterialResponse：不同岩性、砖体和土坯的吸水率、孔隙率、硬度、可溶性和颗粒响应
4. PBRProjection：统一输出 Base Color、Roughness、Normal、Height、AO 和 F0

金属铜绿的化学颜色和 metallic 转换不移植到石材。吸收的是多通道同步传播和实时演化结构。

## 7. 四个砌筑石家族的风化语法

### 7.1 规则石材

主过程：人工錾修、边缘碰损、接触污迹、立面雨痕、顶部积尘、局部盐析。

形体优先保持建筑模数和承重面。风化不得破坏整体砌筑稳定性。

### 7.2 半规则毛石

主过程：天然断面差异、凹部保水、砂浆接触圈、局部生物附着、沿断裂排水、楔形接触磨损。

风化权重更多分配给 cavity、contact 和 runoff。

### 7.3 片石

主过程：主层理、沿层剥离、薄边破碎、顶部水膜、层间残留湿度、边缘冻融和盐析。

层理方向必须唯一且连续。禁止整圈等距条纹。剥离只在局部发生，并与层理和水分路径关联。

### 7.4 卵石

主过程：水磨抛光、碰撞坑、下侧泥膜、长期潮湿色差、矿物硬点和局部生物膜。

宏观轮廓保持非对称水磨母体。光滑区集中在主碰撞带和水流长期作用区。

## 8. 工作台交互要求

工作台采用少量明确控制：

1. 时间
2. 雨量
3. 湿干循环
4. 排水强度
5. 尘土负荷
6. 盐析强度
7. 生物附着
8. 磨蚀强度
9. 材料孔隙率
10. 材料硬度

必须提供以下视图：

1. Final
2. Base Color
3. Roughness
4. Normal
5. Height
6. AO
7. Wetness
8. Runoff
9. Cavity
10. Fresh Fracture
11. PBR Safe Color
12. Weather Delta
13. Fresnel

灯光提供棚拍、中性、掠射、阴天和高对比户外环境。资产必须在多种光照下保持可信。

## 9. QA 门禁

1. metalness 对砖和石材固定为 0
2. F0 默认 0.04，超出 0.02 至 0.05 时必须有岩性依据
3. Base Color 不含大尺度光照和 AO
4. Base Color 通过 30 至 240 sRGB 范围检查
5. Roughness、AO、Height 按线性数据处理
6. AO 只作用于环境漫反射
7. 几何、Height、Normal 的频率分工无重复堆叠
8. 相同输入可复现
9. 时间倒放只用于观察，生产状态演化保持单向累积
10. 极端参数不产生全表面同步变色、黑洞、亮边和金属感
11. 四家族在轮廓、承重、断裂、风化和粗糙度上均可区分
12. visualApproved 和 productionApproved 在人工确认前保持 false

## 10. 当前执行结论

现有 Brick Mother V2.7.5 三材质核心继续冻结保留。新的砌筑石系统在私有候选中接入本规则，完成中性光、掠射光、多通道和时间演化验证后，才允许替换公开工作台的砌筑石分区。
## 11. V1.1 三维工作台落地

V1.1 将上述知识转为实时可交互的 HTML 三维工作台，并新增净材与风化屏幕分界对照。分界左侧保持同一形体、同一种子和同一灯光下的净材基线，分界右侧显示实时风化结果，用于排除相机、几何和照明差异对判断的干扰。

实现约束：

1. WeatherMix 在 0 至 1 范围内连续控制风化结果。
2. CompareSplit 在画面 25% 至 75% 范围内移动。
3. 对照模式只改变材质演化权重，不改变形体、相机、光照、种子和几何拓扑。
4. Weather Delta 显示湿润、沉积、盐析、生物附着和磨蚀共同造成的材质变化强度。
5. Fresnel 显示固定介电 F0 与观察角共同形成的反射响应。
6. Base Color 继续以 sRGB 输入并在着色前转换到线性空间。
7. Roughness、AO、Height、Wetness、Runoff、Cavity、Fracture 和 Weather Delta 全部按线性数据处理。
8. AO 只衰减环境漫反射，不压暗直接高光和环境镜面项。
9. Height 负责低频与中频轮廓起伏，Normal 负责高频微表面。
10. visualApproved 与 productionApproved 在用户确认前保持 false。
