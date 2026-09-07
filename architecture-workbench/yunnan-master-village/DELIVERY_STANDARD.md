# 小李建筑生产线固定交付规范

生效日期：2026-09-07。

以后每个可供用户检查的版本统一按以下格式交付：

1. 生成一个完整、可独立运行的单文件 HTML。
2. 将该 HTML 写入 HOUSE 仓库，并取得包含该文件的不可变 Git commit SHA。
3. 对交付 HTML 核对文件字节数与 SHA256；版本构建报告、QA 与源文件继续保留可恢复关系。
4. 聊天中的第一入口使用固定 commit SHA 组成的 raw.githack 地址：
   `https://raw.githack.com/haihao0307/HOUSE/<COMMIT_SHA>/<PATH_TO_HTML>`
5. 用户点击该入口后，可在客户端的“外部网站”确认页面选择“打开链接”，直接运行工作台。
6. 分支地址、GitHub Pages 地址和本地 sandbox 文件可作为补充入口，不替代固定提交的 raw.githack 主入口。
7. 新版本不得覆盖旧版本目录。每一版都使用独立版本路径，并保留旧版固定 commit 供回退与比较。
8. 尚未完成的人工视觉批准、历史真实性、测量真值和生产批准继续按各版本实际状态记录，直开链接本身不改变批准状态。

## V0.17.0 首个固定格式实例

固定提交：`27cd4b58d7a2934fceda9c6737b4948b4f432ab5`

HTML：`architecture-workbench/yunnan-master-village/releases/v0.17.0/Xiaoli_V0.17.0.html`

字节数：`1599635`

SHA256：`d0ba6d06d879e0a371c87aba6a3a8882ff99693c6c267378b63610aed6a916f6`

raw.githack：
`https://raw.githack.com/haihao0307/HOUSE/27cd4b58d7a2934fceda9c6737b4948b4f432ab5/architecture-workbench/yunnan-master-village/releases/v0.17.0/Xiaoli_V0.17.0.html`
