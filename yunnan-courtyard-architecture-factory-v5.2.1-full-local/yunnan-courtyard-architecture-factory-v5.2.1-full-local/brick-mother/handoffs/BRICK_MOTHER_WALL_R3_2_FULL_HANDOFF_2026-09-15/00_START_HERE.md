# Brick Mother 墙体 R3.2 全量交接入口

交接日期：2026-09-15

仓库：`haihao0307/HOUSE`

工作分支：`codex/brick-wall-4x3-r3-2-20260915`

当前对象：4.000 m 宽 × 3.000 m 高 × 0.48923 m 厚的砖包土墙候选 R3.2。

## 最重要的继承规则

1. 墙上每一块砖都必须来自冻结的 `R2.14.8.1` 右侧“边角学习”母砖，以及冻结的 `R2.1-B` 材质。
2. 用户第一张截图里的 R3 替代砖是明确否定项，禁止重新使用、模仿或从它继续开发。
3. 第二张截图里的 `R2.14.8.1 边角学习` 才是固定板子；墙体只能刚性复用这个母砖。
4. R3.1 是先把砖从底部逐皮砌对的小样。用户明确评价“非常好”，随后要求放大成 4×3 m 整墙。
5. R3.2 是当前整墙候选；自动 QA 已通过，但尚未获得用户对整墙的人工视觉批准，也未获生产批准。

## 下一 Chat 的读取顺序

1. 读本文件。
2. 读 `CURRENT_STATE.json` 和 `SOURCE_LOCK.json`，核对当前对象与字节身份。
3. 读 `USER_DECISIONS_AND_REJECTIONS.md`，防止再次换错砖。
4. 读 `WALL_CONSTRUCTION_CONTRACT.json`，理解尺寸、砌层、厚度与土芯逻辑。
5. 读 `REFERENCE_SOURCE_LOCK.json`，区分三份用户参考各自能证明什么。
6. 读 `QA_EVIDENCE.md` 和 `KNOWN_ISSUES_AND_NEXT_TASKS.md`。
7. 最后把 `NEXT_WINDOW_PROMPT.md` 作为新 Chat 的起始任务说明。

## 当前固定公网审查页

`https://rawcdn.githack.com/haihao0307/HOUSE/b30c1725da4e05c388896f7e7635d82786b9ab5a/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/Brick_Mother_Wall_4x3_R3_2.html`

该 URL 绑定远端内容提交 `b30c1725da4e05c388896f7e7635d82786b9ab5a`，不随分支移动。

## 包完整性

在解压后的包根目录运行：

```bash
python verify_package.py
```

程序会逐文件核对字节数与 SHA256，并拒绝缺失文件、额外文件和内容漂移。

## 当前批准状态

- `humanVisualApproved=false`
- `productionApproved=false`
- `historicalConstructionVerified=false`

不得把静态、运行时或 GPU 自动通过改写成人工视觉批准。
