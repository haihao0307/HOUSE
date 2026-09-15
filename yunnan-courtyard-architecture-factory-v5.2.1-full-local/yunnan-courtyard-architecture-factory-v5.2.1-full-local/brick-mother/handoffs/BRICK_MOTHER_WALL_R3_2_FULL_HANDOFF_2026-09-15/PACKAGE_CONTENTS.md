# 全量包内容

包名：`BRICK_MOTHER_WALL_R3_2_FULL_HANDOFF_2026-09-15.zip`

## 根目录

- 交接入口、当前状态、源锁、施工关系、用户决定、参考锁、QA 说明、未决事项与下一 Chat 提示。
- `MANIFEST_SHA256.json`：包内所有其他文件的路径、字节数与 SHA256。
- `verify_package.py`：离线逐文件校验器。

## `repository/brick-mother/`

- 当前 `Brick_Mother_Wall_4x3_R3_2.html`。
- 前序 `Brick_Mother_Bond_Study_R3_1.html`。
- R2.14.8.1 冻结说明与实际冻结源页。
- R2.14.8.1 的 `_8` 父基线页；`_8_1` 会固定读取该父页，因此不可误称为完全离线单文件。
- R2.1-B Material Microscope 源与锁定说明，全部从干净 Git 对象导出。
- R3.1 的完整 QA 目录。
- R3.2 的完整 QA 目录，包括三套报告、三套脚本和四张 GPU 检查图。
- 固定 raw.githack 交付规则。

所有仓库文件都从 Git 对象 `3d100e635dcc3d221175aebb0dbcc826a0ecb4d7` 按白名单导出，不从带有未提交改动的工作树复制。

## `repository-rules/`

包含仓库根规则、项目规则、项目 README、项目状态、系统架构，以及项目规则要求先读的两个核心 JSON。它们用于让新 Chat 在完整仓库继续时不丢失约束。

## `reference/`

- 用户提供的 Brick Stack GLB。
- 被明确否定的替代砖截图，作为禁止恢复的反例。
- 固定 R2.14.8.1 边角学习板截图，作为正确母砖身份参考。

两张 PNG 在包内使用像素差为 0 的无损 WebP 重编码，以通过 Chat→GitHub 的 16 MiB 传输门；分辨率、每个像素和语义不变，原 PNG 文件名、字节数与 SHA256 仍写入参考锁。GLB 保持原始字节不变。

三份参考的精确哈希和证据边界见 `REFERENCE_SOURCE_LOCK.json`。

## 明确不包含

- `.git`、缓存、`node_modules`、临时文件和 Python 字节码。
- 旧 ZIP、旧全量包和与本次墙体线无关的历史实验。
- 当前工作树中 9 个无关的 Material Microscope 未提交改动。
- 整个 HOUSE 建筑生产线的大体量重复副本。

## 完整性

解压后运行 `python verify_package.py`。校验器必须报告零缺失、零额外、零字节差异和零哈希差异。
