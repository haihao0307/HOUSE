# 构建回执

构建日期：2026-09-15

本地实现提交：`3d100e635dcc3d221175aebb0dbcc826a0ecb4d7`

远端等价实现提交：`b30c1725da4e05c388896f7e7635d82786b9ab5a`

共同 Git tree：`976868e1dba9bcf23f9ff0330ba2d57aa74b1df1`

构建原则：

1. 仓库内容从本地实现提交按明确白名单导出。
2. 用户 GLB 从原始附件逐字节复制；两张 PNG 以像素差为 0 的无损 WebP 重编码，源与包内身份都按 `REFERENCE_SOURCE_LOCK.json` 校验。
3. 包内 manifest 覆盖除 manifest 自身外的所有文件。
4. ZIP 外另附 ZIP SHA256。
5. ZIP 解压后执行 `verify_package.py`。
6. R3.2 三套 QA 从全新解压目录重跑。
7. 包含 ZIP 的远端提交及固定下载 URL 记录在 ZIP 外同目录的 `CURRENT_FULL_HANDOFF.md`，避免 ZIP 自引用。

本回执记录构建协议；实际 ZIP 字节数、SHA256、文件数和发布提交以外部发布回执为准。
