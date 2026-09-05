# 小李：构件坐标与分层材质方法接收记录

接收日期：2026-09-05。运行基线：HOUSE / feature/yunnan-component-studio-v1 / V0.15.0。
本次为 V0.15.1 有限实验，CURRENT.json 仍保持原冻结版本。没有修改建筑形体、轴网、标高、工序、人物或其他 Mother。

## 先读什么

每次接续先读取建筑 RESTART_START_HERE.md、CURRENT.json、verification/2026-09-05-recheck/NEXT_EXECUTION.md，再读取本页及 qa/SUMMARY.json。交付包另含完整 qa/report.json、采样数据与浏览器截图。
小妈的公共入口位于 guilin-dem-pipeline 的 handoff/xiaoma-mentor-v1.1-20260905 分支，docs/mother_coordination/mentor-v1.1/README.md。
小妈发布材料以后，各执行窗口仍需实际读取；本记录用于可恢复的方法传递，不代表模型权重更新或跨窗口自动同步。

## 本次读取和采用

1. 已读取分发版 00_START_HERE、意见处理表、PUBLIC_TECH_KNOWLEDGE_MAP、资源导航中技术入口和合并研究前段。没有宣称逐页读完导师全文、全部手册或 Houdini 原书。
2. Houdini 方法：构件身份、局部轴、属性与变换分开保留。木纹使用局部静止坐标；梁柱沿生成器已有 Y 轴；明确长条箱形木件使用长轴候选；近方形数据保留未知。
3. 材质方法：本色、粗糙度、法线和真实位移分别处理。本次只改变木纹坐标，另有显式开启的粗糙度字段，幅度限制为原值上下 0.04。法线细节和真实位移没有接入。
4. UE 方法：材料响应和照明分离；原日照、中性光和相机均保留。A 原材质、B 顺构件木纹、C 独立粗糙度、端面检查可在相同场景切换。
5. 小妈复核方法：固定基线、有限改动、直接回退、重跑旧测试、未知与批准独立记录。

## 已实现的接口

src/material_bridge_v0151.js：chooseAxis、setMode、inspect、getProbe、exportReport。
每个有注册 ID 的木件带稳定种子、局部尺寸、轴向策略及世界矩阵。材质元数据不写入已有结构构件图。
对同一构件 ID 重放工序不会重新随机化；每个种子只影响本次显式粗糙度试验。

## 适用范围与反例

程序候选的长条箱体可以用几何长轴作为当前木纹方向假设。梁生成器已有语义轴时优先保留语义。
方形平台、方形节点、拼接门板不能从包围盒唯一判定木材组织，保留原表现并列入 unresolved。
世界 AABB 尺寸受旋转影响，不能替代构件本地尺寸或原始 SU 测量。导出字段明确标 candidate_not_verified_against_SKP。
材料试验不改支承几何，不能改善碰撞或结构净空，也不能作为历史木材实测校准。

## 核查来源

小妈原技术地图的 Git blob：e0fd25fe75416450169f7200508bed36405f0196。
导师资源导航 Git blob：38636a13d0e30eceecc3259f50a85e6233911326。
意见处理表 Git blob：3b72eac7b0a3e12d79afb8230fe110d218c56cc8。
建筑原材质源码 Git blob：b7955fdf2fa06a73c1e75d8b7a7f228fb74e1020。
上述 source 路径前缀为 docs/mother_coordination/mentor-v1.1/full-handoff-v1.1.1/source/Mother_System_Xiaoma_Full_Handoff_V1.1.1_2026-09-05/sources/mentor_v1_1/details/。

本轮实际核读的官方技术页：
https://www.sidefx.com/docs/houdini/model/attributes.html
https://dev.epicgames.com/documentation/en-us/unreal-engine/physically-based-materials-in-unreal-engine
https://dev.epicgames.com/documentation/en-us/unreal-engine/material-functions-in-unreal-engine

这些文档支持属性、分层材质和函数复用的概念。本次没有运行 Houdini 或 UE，也没有验证跨引擎像素等价。

## 建筑续作边界

原 SKP 的单位、嵌套实例和隐藏几何尚未核准。原包只保留来源指纹；本轮两次 File Library 检索没有取得该 SKP 原始字节。不能用相近地区 PDF 或 AABB 候选填作真值。
继续的建筑主目标仍是 SU 尺度、楼梯和耳房轴位、通行净高；完整院落及瓦作仍待完成。保留所有已有施工和聚餐行为。
所有测量、施工、历史、视觉和生产批准均保持 false。
