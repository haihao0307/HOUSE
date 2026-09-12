# Brick Mother × 小妈学习接收回执（2026-09-09）

## 固定生产基线

- 仓库：`haihao0307/HOUSE`
- 分支：`feature/brick-mother-v2.0-composite-material-dna`
- 本次接收前远端 HEAD：`c2556b90bffac58eb258b435a83a5ba0da6ba7c3`
- PR：#15，保持 `open / Draft / 未合并`
- R7 唯一视觉起点：R5.0.0；R6 只读失败对照。
- 当前 R7 目录：`brick-mother/experiments/atelier-r7`（仓库内实际嵌套路径见本文件所在目录）。
- 人工门：`humanVisualApproved=false`、`productionApproved=false`，不得因自动测试而改写。

## 小妈来源锁

本轮实际读取：

- 仓库：`haihao0307/guilin-dem-pipeline`
- 协调分支：`handoff/xiaoma-mentor-v1.1-20260905`
- 2026-09-09 读取时 HEAD：`ba9801afb4dbb861ea5c34ea05838173e96396bb`
- 直接相关技能：
  - `skills/macroscopic-microscope-masterclass/SKILL.md`
  - `skills/procedural-noise-audit/SKILL.md`
  - `skills/procedural-geometry/SKILL.md`
- 2026-09-09 新增的“靠谱 / 世界大合唱”内容只接收其证据、分工、可追溯和反例验证纪律；不把世界谱/TLO 数据结构直接塞进砖材质实现。

## 已接收且确认适用于 Brick Mother 的方法

### 1. 稳定对象坐标，而不是相机坐标

材料细节身份必须附着在对象/材料坐标中；旋转相机、改变观察顺序、停止动画都不能让孔洞、矿物、稻草或烧结区域游动。R7 当前的 `detailCoordinates()`、固定 seed、无 camera/time 参与的材质域符合这一原则，继续保留。

### 2. 跨尺度结构必须有语义，不把“噪声多”当“真实”

Macroscopic microscope 的 `log2(radius)` 和多尺度嵌套可用于组织尺度相关性，但只能作为局部内部算子。砖的烧结孔、石材层理/劈裂、土坯纤维/稻壳必须由各自材料形成逻辑解释；不能共用一个抽象标量冒充全部形态。

### 3. 高频小幅值仍可能强烈改变法线

增加细层时必须单独检查屏幕足迹、抗混叠、法线、粗糙度和闪烁；不能因为高度变化小就认为视觉影响小。现有 footprint 门控继续保留，新增细节不重新归一化既有粗层，不暗改 R5/R7 已经接近成功的宏观色形。

### 4. Worley / cell 边界量不是物理距离

`F2-F1` 或类似第二近邻差值只能作为边界指标，不能直接解释为恒定物理裂缝宽度。R7 `crystal()` 已明确把 `second-first` 作为 boundary indicator，不作为真实距离；继续保持此声明。需要真实宽度的缝、孔、掉块必须进入实际几何或受单位约束的体积场。

### 5. 几何、材质、显示、身份分离

只改颜色/湿度时，主体拓扑和纤维锚定不应变化；只改石材层理方向时，砖和土坯 seed DNA 不应变化。每个家族保持稳定 seed 和显式依赖，避免全局控件误覆盖别的家族。

### 6. 六道理解门

后续采用：来源复述 → 参数预测 → 反例 → 隔离实现 → 产品对照 → 用户接受。自动 smoke、截图统计或 shader 编译通过均不能代替最后的人工视觉接受。

## 对当前 R7 的实际判断

当前 R7 已经不是旧 V2.7.5 PR 正文所描述的状态：

- 烧结旧砖已经改成“红砖主体、烧结区域、稀疏孔口”，白色矿物点接近移除；窑变白灰只保留极弱、极稀疏候选。
- 土坯已存在真实几何长短纤维、双端埋入检查，以及有内外面和壳边的稻壳；剩余主要问题是局部仍可能读成偏直的杆状符号。
- 花岗岩/砂岩/玄武岩/石英岩/石灰岩已按不同结构组织；当前更值得收尾的是“每个 seed 一条可读的主导层理/剪切方向”和局部破裂区的颗粒层次，而不是全表面再叠更多噪声。
- 粗凿石、毛石、卵石已有不同几何规则，不应再次统一成一种损伤算法。

## 本轮允许的有限收尾

1. `stone`：保持已有层状基本形态，只让每个 seed 派生一条稳定的主导层理方向；层厚继续非均匀，避免固定方向造成程序条纹。
2. `adobe`：在不改变双端埋入锚定的前提下，给长短纤维加入端点为零的第二级微弯曲，降低“直杆”感；稻壳内外面与壳边保持。
3. `fired/kiln`：本轮先验证当前红砖色与稀疏孔口，不因旧 PR 文本再次大改；只有同机位对照确认仍偏黄/白后才继续调整。
4. 任何新候选均单独保存，不覆盖 R5、R6、R7 历史文件。

## 当前真实阻塞

最新分支 HEAD 的 `Brick Mother R7 Direct Frozen Release` run `34126828743` 失败在旧 Standalone Base64/gzip 解压：`zlib.error: invalid distance too far back`。因此“最新源码”不能冒称“最新已验证公网交付”。新的收尾候选必须直接以仓库内已经存在的未压缩 `Brick_Mother_R7_Direct.html` 为源，重新执行语法、Chromium、移动端与固定 raw.githack 公网验证。

状态：`learningReceived=true`；`productionAdoption=limited-closeout-only`；`humanVisualApproved=false`；`productionApproved=false`。
