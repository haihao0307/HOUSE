# Tiles Mother 接续入口

当前接续版本：V0.9.8 Contact Rafter Beams。仓库 `haihao0307/HOUSE`，工作分支 `feature/tiles-mother-v0.1-workbench`。

本页是仓库级导航。以下阅读路径全部指向 `tiles-mother/v098/`，不要误读根目录下旧版 handoff。

## 开始阅读

1. [当前基线与全量包身份](CURRENT_BASELINE.json)
2. [V0.9.8 包内接续说明](v098/RESTART_START_HERE.md)
3. [完整源码、重建与核验说明](v098/README.md)
4. [用户已确定的工作规则](v098/handoff/USER_DECISIONS.md)
5. [已知缺口与下一步](v098/handoff/KNOWN_GAPS.md)
6. [已认可材质的代码锁](v098/knowledge/MATERIAL_LOCK.json)
7. [本次重新运行的浏览器检查](v098/qa/release-refresh/REPORT.json)

[完整离线工作台](v098/START_HERE.html)。[全量接续包](releases/Tiles_Mother_V098_Full_Restart_Package_2026-09-05.zip)。

工作台 SHA256：`c8b8211f8d14512b2f29c067894be563e2710053b648b39427a87986bcf34c9b`。
全量包 SHA256：`9c9389243c25b4106c46733456e0f5807affa2d0b16e5bd5efbe85d822334e2c`。

## 不得丢失

三片独立瓦是主体，48片构造台与860片屋面同时保留。保留V0.9.7继承的微孔、划痕、粗糙度、陶瓦着色器与观察光。整片偏色按瓦片群体概率分配。没有木板、望板或隐藏承托平面，圆椽位于四根较粗横梁之上。相邻板瓦共享圆椽，筒瓦双侧落座，瓦片不得穿透。

新改动先做小样，逐面检查瓦、木构和断口的UV、法线、落座与穿透，再扩展到48片和860片。停止维护的渗漏、木构劣化与支撑失效保持因果关联。独立碎片坠落堆积、完整结构求解、地方物性标定仍待完成。

开始工作时重新读取远端HEAD，从最新正常历史继续。不强推，不改写历史，不修改main、gh-pages、Brick Mother分支或冻结资产。本轮没有Pages部署。V0.9.2不作为当前入口，也不放回本全量包。

`visualApproved=false`，`productionApproved=false`。自动通过不代表人工视觉批准，Windows用户机器双击尚未直接实测。

下一轮可直接说：
“Tiles Mother，读取 HOUSE 工作分支的 tiles-mother/RESTART_START_HERE.md 和 V0.9.8 全量接续包，保留现有材质与三片、48片、860片三个界面，接着往下做。”

## 小妈学习接续，2026-09-05

继续制作前读取[材质、UV与装配一致性学习卡](knowledge/xiaoma-learning-r1/SKILL.md)。该卡记录小妈R1教材定位、本线独立答卷、英文官方来源、具体规则和有限试验设计。教材提交为guilin-dem-pipeline的b1f01bae975c4151539bc38d84644b8542c70c29，回执交HOUSE Issue #16。

此次仅更新知识和导航，V0.9.8源码、HTML、材质锁与全量包均不变。新技能仍为候选；小妈复核、House独立互审、Blender实操和新浏览器证据均需真实记录，不能由本次资料入库自动判为通过。

## 讲武堂原件重新接入，2026-09-05

用户再次提供的精细 ZIP 与既有 jiangwutang-001 原件及四个内部文件校验值相同。[本轮原生贴图读取、保留决定与读图纠错](knowledge/jiangwutang-001/SOURCE_REACCESS_20260905.md)已记录。继续制作前同时读取此记录和[边口造型专项诊断](knowledge/xiaoma-learning-r1/EDGE_FORM_REVIEW.md)。

该原件仍用于未完成的色彩、质感和细节对照，当前不删除；原始大文件不重复入 Git。此次只补参考记录与导航，没有修改生产参数或完成新版视觉验收。两张线描分别登记，撤回筒瓦3cm壁厚等旧读图推断，禁止将不同来源尺寸混成同一测绘对象。
