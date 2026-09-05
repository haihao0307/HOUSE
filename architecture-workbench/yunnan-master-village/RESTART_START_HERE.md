# 小李：云南建筑生产线重启

当前冻结版本：V0.15.0。

先读取 `CURRENT.json` 核对压缩包及 HTML 指纹，再读取 `versions/v0.15.0/RESTART_START_HERE.md`。
完整包位于 `packages/Yunnan_Master_and_Village_V0.15.0_Full_Restart_2026-09-05.zip`。
单文件工作台位于 `versions/v0.15.0/Yunnan_Master_and_Village_V0.15.0.html`。
归档保留施工骨架、知识、原始 QA、基线、重建源码与冷启动证据。
下一轮从此基线继续，禁止覆盖旧快照或把未核准的测量与历史信息升级为真值。
只在 `feature/yunnan-component-studio-v1` 分支工作，PR #13 保持 Draft、open、未合并；不修改 main、gh-pages、Brick Mother 冻结资产和其他生产线。
GitHub 归档与公开网站部署分开记录。此包未宣布公网部署。

## 2026年9月5日追加回读复核

`verification/2026-09-05-recheck/verification.json` 记录本次归档指纹、重建和浏览器实测。
`verification/2026-09-05-recheck/NEXT_EXECUTION.md` 锁定后续范围及不得回退的功能。
`verification/2026-09-05-recheck/REPRODUCE.md` 说明复核方式和环境限制。

本次对既存 V0.15.0 包进行独立回读，51个文件中49个 MANIFEST 条目验证通过。新生成的78个施工状态、125个通行采样及构件图与原归档逐字节一致。运行代码和压缩包原字节均保留，未降级到 V0.14.0。
