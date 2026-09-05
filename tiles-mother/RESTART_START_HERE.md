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
