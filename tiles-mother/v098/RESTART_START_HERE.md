# Tiles Mother 接续入口

当前唯一续接版本：V0.9.8 Contact Rafter Beams。工作台 SHA256：c8b8211f8d14512b2f29c067894be563e2710053b648b39427a87986bcf34c9b。

仓库 haihao0307/HOUSE。分支 feature/tiles-mother-v0.1-workbench。开始时通过 GitHub 重新读取分支 HEAD，从最新正常历史继续。仅修改 tiles-mother 及对应构建、测试、发布文件。不强推、不改写历史、不修改 main、gh-pages、Brick Mother 或冻结资产。

阅读顺序：README.md → handoff/USER_DECISIONS.md → handoff/KNOWN_GAPS.md → knowledge/MATERIAL_LOCK.json → knowledge/CONFIGURATION.json → qa/release-refresh/REPORT.json → RELEASE_NOTES.md。

不得因单项修复重建工作台、漂白材质、删除三片独立瓦或48片构造台。V0.9.7 被认可的微孔、划痕、粗糙度、陶瓦着色器和观察光已经继承进本版。先锁定材质，再处理局部问题。旧0.9.2不进入本包，也不恢复它的跳转入口；不据此改写 Git 历史。

下一轮先复核筒瓦两侧落座、板瓦前后搭接、圆椽与四根横梁接触、破损端面UV，使用三片、48片、860片以及底面同机位对照。新改动先小范围运行再扩展，不覆盖已被用户认可的素材。

用户可在下一轮直接说：
“Tiles Mother，读取 HOUSE 工作分支的 tiles-mother/RESTART_START_HERE.md 与 v098 全量接续包，从 V0.9.8 继续，保留现有材质与三个工作台入口。”
