# AGENTS.md

本文件供 Codex、自动化开发代理和后续聊天窗口读取。

## 开始工作前

1. 阅读 `README.md`、`PROJECT_STATE.md`、`docs/SYSTEM_ARCHITECTURE.md`。
2. 阅读 `data/system_v5_2_1.json` 和 `data/core/legacy_rejection_ledger_v5_2_1.json`。
3. 运行 `python tools/validate.py`。
4. 修改显示、门窗或人物路线后，运行 `python tools/browser_smoke_test.py`。

## 禁止事项

1. 禁止恢复 Canvas 平均深度排序作为主显示器。
2. 禁止让镜头预设自动删除墙体或屋顶。
3. 禁止把完整建筑压成一个可连续拉伸的盒子。
4. 禁止把耳房主屋面改成无证据的单坡。
5. 禁止用静态贴片代替活动门窗。
6. 禁止在瓦作证据不齐全时铺设写实假瓦。
7. 禁止把解释性推测当作尺寸和几何硬规则。
8. 禁止把旧版本目录重新复制进当前发布根目录。

## 修改要求

1. 数据优先写入 `data/`，显示器从数据推导。
2. 每个活动构件需要唯一 ID、宿主、枢轴、角度、状态和碰撞包络。
3. 每个建筑构件需要可追溯到支系、类型、单体、楼层、间位和证据状态。
4. 平面轴网改变时，柱网、墙体、楼面、屋架和屋面必须同步更新。
5. 任何显示优化都必须在大角度旋转下验证遮挡。
6. 任何交通路线都必须检查门开启次序、楼梯连续标高和二层到达点。

## 完成交付

1. 更新 `VERSION`、`CHANGELOG.md`、`PROJECT_STATE.md`。
2. 更新 JSON 的 `schemaVersion`。
3. 更新 QA 报告与截图。
4. 运行 `python tools/validate.py`。
5. 运行浏览器冒烟测试。
6. 使用 `python tools/make_release.py` 生成发布包。
