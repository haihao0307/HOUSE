# Tiles Mother 当前全量交接 · 2026-09-14

这是当前生产线继续工作的入口。不要从零重做，也不要恢复已否决路线。

当前仓库：`haihao0307/HOUSE`

当前分支：`feature/tiles-mother-r2-closeout-08a-micro-tune`

最后一个已完成自动与公网浏览器 QA 的候选：`R2-closeout-08B-microscope-pbr`

固定候选提交：`21bad87fffd654b1aaddee74af67e7cac6750a5d`

固定公网预览：
`https://raw.githack.com/haihao0307/HOUSE/21bad87fffd654b1aaddee74af67e7cac6750a5d/tiles-mother/r2-closeout-08b-microscope/START_HERE.html`

08B 的 08A 基线、瓦体、尺寸、搭接、木构、屋面状态、镜头与交互没有重做。旧瓦面成组刻线/装饰性程序纹样已从完整瓦面路径撤下，Microscope 17 级场接入既有 PBR。08B 自动 QA 与公网浏览器 QA 已通过，但用户没有宣布视觉批准或生产批准。

`visualApproved=false`

`productionApproved=false`

## 用户最新指令：下一步只做 08C 收尾

用户对 08B 总体外观评价为“基本 ok”，但明确留下两个问题。后续必须从 08B 原工作台继续，不得换路线。

第一，Microscope 不能只造成法线/图案层面的视觉变化。下一步必须让同一 Microscope 场对瓦面实际高低形态和瓦边缘轮廓产生可见的微形变，包括瓦面起伏、前口/侧边轻微不齐与边缘形态变化。这里是收尾微调，不授权改变瓦的大体尺寸、主要弧度类别、搭接关系或支承关系。

第二，PBR 色彩调整应做成独立按钮或独立控制区，不要和 Microscope 形态控制混成一个入口。颜色变化的丰富度应参考讲武堂瓦片的已核验轻量资料；不允许重新发明装饰纹、刀刻纹、回旋纹或没有来源的颜色图案。PBR 仍是必须的瓦面材质系统，不引入 Blender 运行体系。

用户要求：继续做到成果完成为止。

## 不可破坏项

- 不改当前瓦的大体形状与尺寸基线。
- 不改板瓦、筒瓦、椽子、横梁的搭接/支承逻辑。
- 不另建一套工作台替换当前工作台。
- 不恢复已被否定的 R2-11。
- 不恢复成组弯线、同心/回旋、刀刻式花纹。
- 不把普通随机噪声、自己编的划痕或装饰色块冒充 Microscope。
- 不把 Blender 系统带入当前运行时。
- 不覆盖旧固定公网版本；新候选必须另有固定提交链接。
- 新候选没有真实浏览器和移动布局 QA 前不得冒称完成；人工视觉批准只能由用户给出。

## Microscope 权威约束

本包包含用户 2026-09-06 教学记录的核心一/二以及 08B 已实现代码。

坐标约定：
- `xi0 = log2(length(p)) - 2 - 0.3*t`
- `xi1 = -p.z / length(p)`，不额外减一
- `xi2 = atan(p.x, p.y)`

17 个尺度：`1, 2, 4, ..., 65536`

单层：`cos(dot(cos(xi.zyy*s), cos(xi.xyx*s))) / s`

不要自行宣称未核实的旋转节点常数来自作者。瓦面域映射、幅度、过滤、边缘权重、PBR 增益必须明确标成适配参数，不得冒称作者原常数或实测瓦片数据。

## 讲武堂资料

本包不包含用户约 58 MB 原始 FBX/贴图 ZIP。项目规则禁止把原始大参考文件写进 Git 历史。包中包含 `JIANGWUTANG_SOURCE_RECEIPT.json` 和 `knowledge/jiangwutang-001/` 的轻量分析、核验数据和必要证据图。

原件身份已记录为 `讲武堂瓦片精细.zip`，SHA256 `ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365`。如需新的逐像素或逐网格复核，应重新读取用户保存的原件，不得从轻量图反推不存在的物理高度或粗糙度。

## 接手顺序

1. 先读 `SOURCE_LOCK.json` 与 `CURRENT_SURFACE_CANDIDATE.json`。
2. 打开 `project/current-08B/START_HERE.html`，确认当前候选身份。
3. 对照 `project/baseline-08A/START_HERE.html`，确保下一版只改变授权的瓦面/边缘微形态与独立 PBR 色彩 UI。
4. 读 `knowledge/MICROSCOPE_USER_TEACHING_CORE_01_02.md` 与 `knowledge/jiangwutang-001/`。
5. 做 08C 时固定同一瓦、同一 seed、同一相机，分别检查 Microscope=0、默认、增强；灰模轮廓；前缘与侧边；PBR 色彩按钮开/关；讲武堂色彩丰富度对照。
6. 如果 Microscope 位移进入真实顶点，必须重新跑接触、穿透和边缘 QA，不能沿用 08B 的“几何完全不变”结论。
7. 交付必须提供固定公网 HTTPS，并实际打开检查后再给用户。

## 已否决路线

`R2-11` 属于完全失败版本，已撤回，不得恢复、换名或从其独立工作台继续。

旧 `Macroscopic microscope R1 / field-core-r1` 也有明确撤回记录。保留的是失败教训，不是产品基线。

## 包内容

- `project/current-08B/`：当前 Microscope + PBR 候选及构建/QA源码。
- `project/baseline-08A/`：上一基线入口和 Microscope 核心准备文件。
- `project/frozen-07/`：08A 的冻结父候选入口。
- `knowledge/`：Microscope 教学、讲武堂轻量分析、失败路线记录。
- `rules/`：Tiles Mother 工作规则与当前候选状态。
- `qa/`：当前 QA 工作流源码与 Build QA。
- `SOURCE_LOCK.json`：打包时生成的提交/身份锁。
- `SHA256SUMS.txt`：包内文件校验。

从这里继续，目标不是再次发散，而是把最后的 08C 微形态与独立 PBR 色彩控制收干净。
