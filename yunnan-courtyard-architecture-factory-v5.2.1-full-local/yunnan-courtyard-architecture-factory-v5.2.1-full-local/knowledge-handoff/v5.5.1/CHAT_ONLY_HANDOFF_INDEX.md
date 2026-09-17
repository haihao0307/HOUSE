# V5.5.1 聊天接续包索引

本索引对应轻量聊天接续包 `HOUSE-yunnan-production-v5.5.1-chat-handoff.zip`。

该包只保存新聊天继续工作所需的有效上下文，不包含代码、图片、GLB、参考资料分卷、QA 图片、缓存和临时文件。

## 包内文件

1. `README_FIRST.md`
2. `00_NEW_CHAT_PROMPT.txt`
3. `01_CURRENT_PROJECT_STATE.json`
4. `02_CHAT_CONTEXT_MASTER.md`
5. `03_ARCHITECTURAL_KNOWLEDGE.md`
6. `04_USER_DECISIONS_AND_PREFERENCES.md`
7. `05_CODEX_EXECUTION_PROTOCOL.md`
8. `06_KNOWN_ERRORS_AND_NEXT_STEPS.md`
9. `07_VERSION_TIMELINE.md`
10. `08_SELECTED_USER_REQUIREMENTS.md`
11. `09_GITHUB_POINTERS.json`
12. `PACKAGE_MANIFEST.json`
13. `CHECKSUMS.sha256`

## 新聊天接续顺序

1. 读取 `00_NEW_CHAT_PROMPT.txt`。
2. 读取 GitHub 仓库 `haihao0307/HOUSE`。
3. 读取分支 `codex/yunnan-surface-production-v5.5.0` 和 PR #11。
4. 阅读本目录现有知识文件。
5. 运行验证后再指挥 Codex。

## 清理范围

包内已删除寒暄、重复确认、等待语句、临时进度承诺、工具报错、缓存路径、失效链接、代码和二进制资料，以及重复版本文件。
