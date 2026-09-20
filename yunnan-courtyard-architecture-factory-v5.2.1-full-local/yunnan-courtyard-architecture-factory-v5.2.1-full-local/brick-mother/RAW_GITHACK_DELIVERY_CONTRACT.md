# Brick Mother 单文件固定提交交付规则

生效日期：2026-09-06。

今后每一个给用户审看的 Brick Mother 版本，主交付必须同时满足以下条件：

1. 工作台是一个可以独立运行的单文件 HTML。
2. 单文件写入 haihao0307/HOUSE 的 Brick Mother 当前工作分支。
3. 聊天中的主入口使用完整 Git commit SHA 构造的 raw.githack 链接，禁止使用会漂移的分支名链接。
4. 用户第一次点击时，可经过 ChatGPT 的“外部网站”确认，再点击“打开链接”直接运行工作台。
5. 附件、ZIP、GitHub Pages 和分支链接只能作为备份，不能替代聊天中的固定提交直开链接。
6. 交付前必须核实该固定提交中 HTML 文件真实存在，且页面能够初始化三维工作台。
7. 新候选没有通过视觉回归门时，不生成“完成版”直开链接。可以继续保留旧基线链接，但必须明确它是旧基线。
8. 每次交付文字至少写明版本、完整 commit SHA、文件路径、视觉基线、是否通过人工视觉批准。

当前视觉基线：Brick Mother R5.0.0。

当前基线文件：

`yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/experiments/atelier-r5/web/index.html`

R6 已登记为材质与色彩回归对照，禁止从 R6 继续增量开发。下一候选必须从 R5 固定视觉基线开始，并在同机位、同光照、同曝光、同种子条件下通过视觉比较后，才可作为新版本交付。

此文件只规定交付格式和视觉门，不代表新修正版已经完成。