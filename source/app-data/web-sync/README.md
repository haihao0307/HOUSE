# 网页端 GitHub 同步资料包

公开生产线通过 `assets/js/github-sync.js` 与仓库保持双向、可审计的轻量连接：

1. 页面只读读取 `data/system_v5_2_1.json`、Three.js 生产合同、团结乡材料证据和 GitHub 最新提交；任何人打开公开网址都可以看到当前版本，不需要令牌。
2. 网页上的生产线命令、现场观察、纠错复核和新增证据先进入浏览器本地队列。点击“导出同步 JSON”后，可把资料包交给后续整理或直接归档。
3. 需要回到 GitHub 时，由用户在同步面板中临时输入 Fine-grained token，并点击“提交为 GitHub Issue”。令牌只存在于当前页面内存，不写入源码、`localStorage` 或导出文件；Issue 统一使用 `[Web Sync]` 标题，方便后续检索和人工复核。

## 权限与边界

- 推荐只给 `haihao0307/HOUSE` 单仓库的 `Issues: Read and write` 权限。
- GitHub Pages 是静态站点，不能安全保存写入密钥，因此不会自动代替用户写仓库。
- Issue 是“待整理输入”，不是未经复核的事实；尺寸、年代、结构和瓦作隐蔽做法仍要通过资料和人工复核后再写入生产合同。

同步 JSON 的字段约定见同目录 `inbox.schema.json`。
