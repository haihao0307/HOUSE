# 下一 Chat 直接执行提示

继续处理 GitHub 仓库 `haihao0307/HOUSE` 的 Brick Mother 墙体线。

只在分支 `codex/brick-wall-4x3-r3-2-20260915` 或从它新建的后续版本分支工作。禁止改动或合并 `main`，禁止强推。

开始前先读取本交接包的：

1. `00_START_HERE.md`
2. `CURRENT_STATE.json`
3. `SOURCE_LOCK.json`
4. `USER_DECISIONS_AND_REJECTIONS.md`
5. `WALL_CONSTRUCTION_CONTRACT.json`
6. `REFERENCE_SOURCE_LOCK.json`
7. `KNOWN_ISSUES_AND_NEXT_TASKS.md`

然后核对远端分支最新 head，并打开固定 R3.2 页面：

`https://rawcdn.githack.com/haihao0307/HOUSE/b30c1725da4e05c388896f7e7635d82786b9ab5a/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/Brick_Mother_Wall_4x3_R3_2.html`

当前冻结不变量：

- 母砖必须是 `R2.14.8.1-right`，源 blob `19315c0094234f68aad6a1fadc32aeea1725aab6`。
- 母砖材质必须是 `R2.1-B`。
- 第一张参考截图是被用户否定的替代砖，禁止使用。
- 第二张参考截图才是固定“边角学习”母砖板子。
- R3.1 的砌法方向已获用户明确肯定，R3.2 是按该方向放大的整墙候选。
- 当前 4×3 m R3.2 的自动 QA 已通过，但 `humanVisualApproved=false`、`productionApproved=false`。

如果用户说“继续”，不要重新造砖或重启统一工作台。先接住用户对当前 R3.2 整墙的视觉意见，只修改被指出的砌筑、厚度、土芯后退或 Microscope 问题。

任何修订都必须：

1. 新建版本文件，不覆盖 R3.2。
2. 保持旧固定链接可用。
3. 重跑静态、运行时和真实 GPU 三个门。
4. 记录新页面 SHA、Git blob、提交和固定 raw.githack URL。
5. 在用户明确批准前保持人工视觉与生产批准为 `false`。
6. 交付真实可交互 HTML，不用生成图替代三维工作台。
