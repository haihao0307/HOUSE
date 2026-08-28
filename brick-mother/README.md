# Brick Mother 全量交接包 V0.1

生成日期：2026-08-28

这是“砖块母体窝”的完整阶段性交接包。它把土坯砖、烧结砖和石块纳入同一个参数化母体体系，同时保持三类材料各自的物理约束。

## 立即可看

- 在线三维原型：[Brick Mother 砖块母体窝](https://brick-mother-nest.sunhaihao.chatgpt.site)
- GitHub 仓库：`haihao0307/HOUSE`
- 独立分支：`feature/brick-mother-production-v0.1-full-package`
- 本包版本：`0.1.0-handoff.20260828`

## 包含内容

| 路径 | 内容 |
|---|---|
| `web/` | 可运行的三维网页源码，共 9 个程序化砖块子代 |
| `docs/Brick_Mother_Knowledge_V0.1.md` | 母体知识体系、参数逻辑和生产约束 |
| `docs/BRICK_MOTHER_SYSTEM_SUMMARY.md` | 当前成果全量总结 |
| `docs/NEXT_CHAT_HANDOFF_2026-08-28.md` | 新对话需要继承的精确状态 |
| `docs/NEXT_CHAT_START_PROMPT.md` | 可直接粘贴到新对话的启动提示词 |
| `schemas/brick-mother-v0.1.schema.json` | 砖块母体参数 JSON Schema |
| `reference/` | 用户提供的原始参考压缩包与来源收据 |
| `evidence/` | 九砖视觉方向板与证据说明 |
| `qa/` | 构建、部署、门禁和命令结果 |
| `manifests/` | 文件清单、大小和 SHA256 指纹 |

## 本地运行网页

要求 Node.js 22.13.0 或更高版本。

```bash
cd web
npm ci
npm run dev
```

生产构建：

```bash
cd web
npm ci
npm run lint
npm run build
```

## 当前结论

V0.1 已经形成可操作、可再生、可分材料控制的三维原型。浏览器内会实际生成 3 个土坯、3 个烧结砖和 3 个石块，支持旋转、缩放、材料筛选、年代、湿度、批次差异和母种子再生。

当前几何属于早期程序化原型。因此，V0.1 适合继续研发和快速视觉迭代，暂未达到云南建筑生产线资产门禁。

## V0.2 解析进展

V0.1 封包后已经完成以下增量：

- 6 个参考 GLB 的只读容器、几何、拓扑、UV、材质槽、图像引用和许可审计。
- 6 个参考 GLB 的确定性中性正面、侧面和顶面证据。
- 原始纹理使用量保持为零。
- 建立逐资产准入表，区分可接受几何、条件参考、隔离主网格和排除项。

入口：

- `docs/reference-analysis/BRICK_MOTHER_GLB_AUDIT_V0.1.md`
- `docs/reference-analysis/BRICK_MOTHER_REFERENCE_DISTILLATION_DECISIONS_V0.1.md`
- `evidence/BRICK_MOTHER_REFERENCE_NEUTRAL_3VIEW_CONTACT_SHEET_V0.1.png`
- `qa/GLB_REFERENCE_AUDIT_QA.json`

程序化子代的同资产三视图仍待完成，浏览器截图和控制台证据仍未运行。

## 仓库隔离

本包放在独立分支中。没有修改 `main`、`gh-pages`、任何既有 PR 分支，也没有创建新 PR。

## GitHub 与下载包范围

GitHub 独立分支保存可审阅、可构建的 UTF-8 源码、知识文档、Schema、QA、清单和二进制指纹收据。受当前 GitHub 连接写入方式限制，38 MB 原始参考压缩包和 3 MB 视觉板不写入仓库历史。

本下载 ZIP 是全量包，包含上述两项原始二进制证据。可用 `manifests/FILES.sha256` 核验每个载荷文件，再用最终 ZIP 的 SHA256 核验整体。
