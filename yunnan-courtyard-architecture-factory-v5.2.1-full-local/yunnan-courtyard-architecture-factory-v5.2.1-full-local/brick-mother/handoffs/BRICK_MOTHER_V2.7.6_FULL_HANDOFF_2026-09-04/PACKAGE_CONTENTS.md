# 全量包内容说明

已验证包：

`BRICK_MOTHER_V2.7.6_FULL_HANDOFF_2026-09-04-a601bbdbff979dcf2c23784435ce99351bf0d49d.zip`

ZIP SHA256：

`71ea081c33213372d0dee2b3e1ba7670b50601ae477194a06e63333cc688d503`

完整 GitHub 构建信息见 `BUILD_RECEIPT.md`。

## 1. 根目录文件

1. `START_HERE.html`
   本地综合入口。通过本地 HTTP 服务打开后，可以切换真正的 V2.7.5、V2.6 高变化版、两套 PBR 实验和 PBR 知识页。
2. `START_WINDOWS.bat`
   Windows 本地启动脚本。
3. `START_MAC_LINUX.sh`
   macOS 与 Linux 本地启动脚本。
4. `GITHUB_BUILD_IDENTITY.json`
   记录精确源提交、分支、PR 状态、冻结文件哈希、包内入口与审批状态。
5. `PACKAGE_MANIFEST_SHA256.json`
   记录包内所有文件的路径、字节数与 SHA256。
6. `PACKAGE_BUILD_REPORT.json`
   记录包内内容校验、冻结身份、本地路由 smoke 和审批状态。ZIP 的最终字节数与 SHA256 记录在同一 Actions artifact 内的外部 `PACKAGE_BUILD_REPORT.json` 与 `.zip.sha256` 文件中。
7. `README_FIRST.md`
   简短启动说明与边界。

## 2. `brick-mother/`

包含当前 Brick Mother 活动源码，排除旧交接包的递归复制与冻结 V1.0 发布目录。

关键文件包括：

1. 真正的 V2.7.5 三栏观察台。
2. 真正的 V2.7.5 单文件运行时。
3. V2.6 高变化版。
4. V2.7.6 综合工作台。
5. V2.7.6 版本矩阵。
6. PBR 实验档案。
7. PBR 手册蒸馏规则与检查页。
8. V2.7.5 几何、渲染、应用和 Gaea 内核源码。
9. 材料档案 JSON 与工作台所需的项目内依赖。

## 3. `handoff/`

收录本次交接文档：

1. `00_START_HERE.md`
2. `CURRENT_STATE.json`
3. `VERSION_AND_ASSET_MAP.md`
4. `KNOWN_ISSUES_AND_NEXT_TASKS.md`
5. `NEXT_WINDOW_PROMPT.md`
6. `PACKAGE_CONTENTS.md`

GitHub 分支中的同一交接目录另外保存 `BUILD_RECEIPT.md`，用于记录已经生成的 Actions artifact。

## 4. `workflows/`

包含继续开发与审计需要的有效 Brick Mother 工作流：

1. 三栏观察台 smoke。
2. 核心 smoke。
3. V2.7.5 复合材质 smoke。
4. V2.7 source retry。
5. 石材研究工作流。
6. V2.7.5 旧交接包工作流。
7. V2.7.6 在线部署工作流。
8. V2.7.6 已验证全量包工作流 `brick-mother-v276-full-package-verified.yml`。

失败或被替代的临时打包工作流已经从活动分支删除。

## 5. `repository-rules/`

在仓库存在对应文件时，收录：

1. `AGENTS.md`
2. `README.md`
3. `PROJECT_STATE.md`
4. `SYSTEM_ARCHITECTURE.md`

## 6. `online-proof/`

记录当前公开部署和浏览器检查身份：

1. V2.7.6 公开部署 run `33851920355` 已成功。
2. V2.7.6 浏览器 proof run `33852321101` 已成功。
3. 浏览器 proof 确认 V2.7.5 运行时为 `2.7.5-alpha.1`，Canvas 存在，运行时未失败。
4. 软件渲染记录只作为工程诊断，不作为真实 GPU 性能结论。

## 7. 明确排除内容

1. 用户提供的完整《The PBR Guide》PDF，不在公开全量包中重新分发。
2. `releases/v1.0/` 冻结发布资产，不重复复制。
3. 旧交接包目录，不进行递归嵌套。
4. 私有参考资料与大型私有模型。
5. `node_modules`、`.git`、缓存、临时文件和 Python 字节码。
6. Brick Mother 根目录的旧 PBR Service Worker。
7. 被替代的失败打包工作流。

## 8. 已完成的完整性检查

1. 三个冻结 Git blob 精确核对通过。
2. PBR 实验和知识文件存在性核对通过。
3. JSON 格式核对通过。
4. JavaScript 语法核对通过。
5. 禁止文件核对通过。
6. 本地入口与所有关键路由 smoke 通过。
7. 包内逐文件 SHA256 清单共记录 64 个文件，复核差异为 0。
8. ZIP 完整性测试通过。
9. 最终 ZIP SHA256 已核对通过。

## 9. GitHub 交付位置

1. 交接文档保存在当前工作分支的 `brick-mother/handoffs/BRICK_MOTHER_V2.7.6_FULL_HANDOFF_2026-09-04/`。
2. ZIP 位于 GitHub Actions run `33857248735` 的 artifact `9930669833`，保存至 2026-12-03。
3. PR #15 保持 open、Draft、未合并。
