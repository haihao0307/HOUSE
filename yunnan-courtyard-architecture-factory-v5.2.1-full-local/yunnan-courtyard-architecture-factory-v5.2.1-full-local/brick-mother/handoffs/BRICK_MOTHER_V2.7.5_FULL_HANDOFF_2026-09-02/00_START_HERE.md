# Brick Mother V2.7.5 全量交接包

## 先做什么

1. 读取 `CURRENT_STATE.json`。
2. 读取 `NEXT_WINDOW_PROMPT.md`。
3. 读取 `BRICK_MOTHER_ADOPTION_AUDIT.md`、`MOTHER_UNIFIED_POLICY_V1.0.0.json` 和方法论来源记录。
4. 在 GitHub 重新读取 PR #15 和远端分支 HEAD。远端如果已有新提交，从最新 HEAD 正常快进。
5. 运行包内三维工作台和现有验证，再开始新的修改。

## 当前身份

仓库：`haihao0307/HOUSE`  
分支：`feature/brick-mother-v2.0-composite-material-dna`  
主运行时：`2.7.5-alpha.1`  
石材研究：`stone-response-s1.1`  
运行时基线 HEAD：`b25508b8b57d45f9333286ab7b883644181039e7`

GitHub Action 会把真实打包提交写入 `GITHUB_BUILD_IDENTITY.json`。它优先于本文件中的运行时基线 HEAD。

## 工作台

解压后运行 `START_WINDOWS.bat`，浏览器将打开本地交接入口。也可以直接打开：

* `workbenches/brick-mother-standalone-v2.7.5.html`
* `workbenches/BRICK_MOTHER_STONE_STUDY_S1.html`
* `workbenches/brick-mother-standalone-v2.6.html`

分体观察台请通过本地服务器打开：

* `source/brick-mother/brick-mother-observation-studio.html`

## 证据边界

主三材质工作流通过。石材专项的本地浏览器与单文件验证通过，公网托管验证仍未通过。统一方法论已接收并完成接入前审计，完整运行时接入仍为 `false`。

人工视觉批准、综合色彩批准、石材批准、土砖批准和生产批准全部保持 `false`。

## 保护范围

禁止强推、改写历史、合并 PR、修改 `main`、`gh-pages`、`release/brick-mother-v1.0`、V1.0 冻结资产、其他 Mother 和 Pages 设置。
