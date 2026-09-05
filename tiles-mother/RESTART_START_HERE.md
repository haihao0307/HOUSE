# Tiles Mother 接续入口

最新可审阅候选：V0.9.9 边口与材质学习工作台。恢复基线：V0.9.8 Contact Rafter Beams。仓库 `haihao0307/HOUSE`，工作分支 `feature/tiles-mother-v0.1-workbench`。

## 当前工作入口

先读[候选身份](CURRENT_CANDIDATE.json)及[实际交付状态与未过门槛](v099/DELIVERY_STATUS.md)，打开[V0.9.9独立三维工作台](v099/START_HERE.html)。该HTML已在真实浏览器使用file协议验证。公网代理回读未通过，没有Pages部署。原始源码与重建工具见[v099/README.md](v099/README.md)。A/B/C可比较原形原材质、新形原材质、新形新材质。

功能检查与270组几何检查通过；CI软件WebGL的运动性能门槛未通过。候选不是人工接受基线。visualApproved=false，productionApproved=false。当前候选的公开地址、用户Windows机器表现及人工视觉验收均不得冒称已完成。

## 恢复基线阅读

1. [V0.9.8基线与全量包身份](CURRENT_BASELINE.json)
2. [V0.9.8包内接续说明](v098/RESTART_START_HERE.md)
3. [V0.9.8完整源码、重建与核验说明](v098/README.md)
4. [用户已确定的工作规则](v098/handoff/USER_DECISIONS.md)
5. [已知缺口与下一步](v098/handoff/KNOWN_GAPS.md)
6. [已认可材质的代码锁](v098/knowledge/MATERIAL_LOCK.json)
7. [V0.9.8历史浏览器检查](v098/qa/release-refresh/REPORT.json)

[V0.9.8原始工作台](v098/START_HERE.html)。[原全量接续包](releases/Tiles_Mother_V098_Full_Restart_Package_2026-09-05.zip)。

V0.9.8工作台SHA256：`c8b8211f8d14512b2f29c067894be563e2710053b648b39427a87986bcf34c9b`。原全量包SHA256：`9c9389243c25b4106c46733456e0f5807affa2d0b16e5bd5efbe85d822334e2c`。本轮未改这些资产或CURRENT_BASELINE。

## 不得丢失

三片独立瓦、48片构造台与860片屋面同时保留。继承的微孔、划痕、陶瓦核心着色与观察光受保护；新表面层独立开关和对照。整片偏色按瓦片群体概率分配，不拿单片色斑面积充当群体比例。没有木板、望板或隐藏承托平面，圆椽位于四根较粗横梁之上。相邻板瓦共享圆椽，筒瓦双侧落座，瓦片不得穿透。

新改动先做小样，逐面检查瓦、木构和断口的UV、法线、落座与穿透，再扩展48片和860片。停止维护的渗漏、木构劣化与支撑失效保持因果关联。独立碎片坠落堆积、完整结构求解、地方物性标定仍待完成。形体或细分变化后的实际接触筛除结果须重新记录，不能沿用旧数字。

开始工作时重新读取远端HEAD，从最新正常历史继续。不强推、不改写历史、不修改main、gh-pages、Brick Mother分支或冻结资产。V0.9.2不恢复为当前入口。

## 学习与参考定位

读取[材质、UV与装配一致性学习卡](knowledge/xiaoma-learning-r1/SKILL.md)及[边口造型专项诊断](knowledge/xiaoma-learning-r1/EDGE_FORM_REVIEW.md)。小妈R1教材提交为guilin-dem-pipeline的b1f01bae975c4151539bc38d84644b8542c70c29，回执交HOUSE Issue #16。小妈独立复核与House互审仍需真实回执；不能由本次代码实现代签。

用户再次提供的精细ZIP沿用jiangwutang-001身份。[原生贴图读取、保留决定与读图纠错](knowledge/jiangwutang-001/SOURCE_REACCESS_20260905.md)继续有效。原件仍用于未完成的色彩、质感和细节对照，当前不删除；原始大文件不重复入Git或工作台。两张线描分别登记，撤回筒瓦3cm壁厚等旧读图推断，禁止将不同来源尺寸混成同一测绘对象。

下一轮从V0.9.9候选继续，保留V0.9.8恢复入口，先根据用户对边口和色彩的意见做有限修改，同时处理性能与真正在线发布的剩余问题。
