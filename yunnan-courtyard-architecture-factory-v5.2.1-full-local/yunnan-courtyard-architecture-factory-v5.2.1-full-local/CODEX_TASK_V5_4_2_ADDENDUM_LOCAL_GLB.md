# V5.4.2 增补任务：本地双 GLB 参考模型导入与知识提取

## 用户提供的本地模型

用户已在 Windows `G:` 盘放置两个文件：

- `yunnan_dali_1.glb`
- `yunnan_house1_wl.glb`

这些文件当前没有进入 GitHub 仓库，也没有上传到公开站点。浏览器安全策略禁止网页在无用户手势时直接读取任意 `G:\` 路径。因此本任务必须让公开网页通过本地文件选择器或拖放读取模型，模型原始字节默认只留在用户浏览器内，不自动上传 GitHub。

## 目标

在现有云南建筑生产线中增加通用的“参考模型实验室”，使用户能在公开网页中直接选择上述两个本地 GLB，完成显示、对比、结构解析、材料解析、墙面与瓦顶证据提取，并生成可同步到 HOUSE 仓库的结构化分析包。

## 必须实现

### 1. 双模型本地导入

新增独立入口“参考模型实验室”，支持：

- 同时选择最多两个 `.glb` 文件
- 拖放导入
- 分别显示文件名、文件大小、SHA256、glTF 版本、generator
- 单模型查看、A/B 并排比较、叠加透明比较
- 自动计算包围盒并完整入镜
- 鼠标旋转、缩放、平移、复位、全屏
- 显示 WebGL 深度测试结果

模型必须从浏览器 `File` 对象读取，不依赖固定路径，不把 `G:\` 路径写入代码或日志。

### 2. 通用 GLB 兼容性

现有团结乡查看器对专用主档约束很强。新的参考模型入口需要独立兼容层，至少支持：

- glTF 2.0 GLB
- 多 mesh、多 primitive、多 material
- indexed 与 non-indexed primitive
- 多张 baseColor、normal、roughness、metallic、occlusion、emissive 贴图
- 节点平移、旋转、缩放和层级矩阵
- 透明、双面材质
- 静态模型包含 camera、animation 或 skin 时不应直接拒绝文件；允许观察静态首帧，并在分析报告中标记这些内容
- 对 Draco、Meshopt、KTX2 等当前未支持扩展给出明确错误和扩展名称

不得破坏既有 `YN_TUANJIE_001_EDITABLE.glb` 查看器。

### 3. 结构分析

每个模型生成独立分析 JSON，至少包括：

- `assetId`
- `fileName`
- `sha256`
- `byteLength`
- `gltfAsset`
- `nodes`
- `meshes`
- `primitives`
- `materials`
- `textures`
- `images`
- `animations`
- `skins`
- `cameras`
- `extensionsUsed`
- `extensionsRequired`
- `bounds`
- `suggestedUpAxis`
- `suggestedScaleStatus`
- `meshNameInventory`
- `materialNameInventory`

所有推断必须带 `confidence` 和 `evidenceBasis`。

### 4. 墙面知识提取

增加墙面分析面板，提取并区分：

- 垂直或近垂直表面占比
- 墙面候选 mesh 与 material
- 主色分布
- 明暗变化
- 粗糙度与金属度
- baseColor 贴图分辨率
- normal map 是否存在及分辨率
- 表面高频细节指标
- 墙体收分候选
- 墙脚、石基、砖角候选
- 风化斑块和修补候选

几何厚度、夯筑层、材料成因和年代只能在模型明确分件或有资料支持时确认。仅凭纹理得到的结论必须标记为 `visual-evidence-only`。

### 5. 瓦顶知识提取

增加屋顶分析面板，提取并区分：

- 斜面候选及坡向
- 屋脊候选线
- 檐口候选线
- 独立屋面单元数量候选
- 重复小构件或纹理周期
- 板瓦、筒瓦、勾头、滴水的可见候选
- 瓦色分布、粗糙度、法线贴图
- 屋面曲率与檐口微曲候选
- 破损、缺瓦、修补候选

模型若把瓦顶烘焙成一张连续扫描网格，只能提取外观与尺度线索，不能自动转成语义瓦件。系统必须区分：

- `semantic-component-evidence`
- `scanned-surface-evidence`
- `texture-only-evidence`
- `unresolved`

### 6. 与现有体系的关系

两个模型只能先登记为“参考资产候选”，不得自动覆盖一颗印、纳西、大理或团结乡的现有规则。

分析包需要支持将观察结果映射到：

- 地区支系候选
- 建筑类型候选
- 墙体材料候选
- 屋面瓦作候选
- 门窗候选
- 廊厦候选
- 不确定项

用户确认或额外资料核验后，才能提升为正式生产规则。

### 7. 本地证据包与 GitHub 同步

导入后提供：

- “导出模型分析 JSON”
- “导出观察截图”
- “加入本地证据队列”
- “通过现有 GitHub 同步中枢提交为 `[Web Sync]` Issue”

原始 GLB 不随分析 JSON 上传。分析包保存文件 SHA256，便于未来核对同一资产。

### 8. 测试

仓库内没有这两个 G 盘文件，因此自动化测试使用：

1. `assets/models/YN_TUANJIE_001_EDITABLE.glb`
2. 一个由测试脚本生成的多材质、非索引小型 GLB fixture

浏览器测试必须验证：

- 本地文件选择器存在
- 双模型槽位存在
- 团结乡标准 GLB 可以导入通用实验室
- 多材质和 non-indexed fixture 可以导入
- 自动入镜
- A/B 切换
- 分析 JSON 包含 SHA256、bounds、materials、wallCandidates、roofCandidates
- 原始文件未进入同步 JSON
- 既有门窗、人物上楼、瓦作工作台、团结乡专用查看器无回归

## 完成后用户操作

公开页面部署后，用户只需进入“参考模型实验室”，点击“选择模型 A”和“选择模型 B”，从 `G:` 盘选择：

- `yunnan_dali_1.glb`
- `yunnan_house1_wl.glb`

网页应立即给出是否能打开、失败原因、模型统计、墙面和瓦顶候选分析。用户随后可将分析包同步到 GitHub，供上游审查并写入生产体系。
