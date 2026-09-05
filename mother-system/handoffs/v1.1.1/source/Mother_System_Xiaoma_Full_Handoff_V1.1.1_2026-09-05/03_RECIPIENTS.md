# 分发对象与本轮范围

以下是本轮查到的仓库入口，以及按导师意见整理的适用重点。它们提供任务寻址；当前分支、待办和验收状态由执行者开工时重新核对。

| 收件组 | GitHub 仓库 | 意见重点 |
|---|---|---|
| DEM、Landscape、Weather、Ocean/Coast | haihao0307/guilin-dem-pipeline | 分清真值与生成、外观与物理、接口语义和单位；从原任务选有限错误；不改变 canonical 数据与旧在线依赖 |
| House、Brick、Tiles | haihao0307/HOUSE | 核对地方证据、支承/搭接/厚度与材料状态；保留尺度未知；瓦片候选不自动成为全系统试点 |
| Aircraft、Aircraft Weapons | haihao0307/AIRCRAFT | 区分型号与具体安装依据，保护权威资产与动画/UV 边界；只修当前批准范围内的错误 |
| Human | haihao0307/Humanoid-Rig-Lab-Next | 用具体关节、接触或步态问题做有限试验；核对当前分支原创与骨骼约束；main 的旧总上下文不自动恢复已撤回路线 |
| Historical World | haihao0307/Three.js | 已查到历史地球目录；分开现代观测、历史证据和场景补全，保留时空锚点与出处 |

## 入口尚待确认的对象

Animal（狗、鸟、猪、猫）、Plant、Brain/Jarvis 均保留独立意见，但本轮尚未确认它们各自独立的正式仓库/任务入口。不能把人物仓库有名称就当作这些项目已经收到通知。

Animal：用一个具体体形的接触、转向、落地或休息状态连续性问题验证。Plant：先限定一个有观察依据的物种与季节，检查分枝及环境响应。Brain/Jarvis：记录目标、检索、实验选择和任务状态；继续遵守已确定的认知职责与低层运动边界，不据导师建议自行缩减长期目标。

本次未创建额外 Mother。GitHub 通知的发布状态和读取确认分开记录在 DISPATCH_LEDGER.json 中。
