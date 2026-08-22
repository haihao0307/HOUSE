# 证据与资料管理

## 三层数据

原始证据层保存图片、测绘图、文献记录和文件哈希。

校准层保存从证据读取的尺寸、轴网、标高、材料和节点。

生成层保存网页和三维使用的参数。

三层数据不能互相覆盖。推导值需要记录来源和置信度。

## 本地参考资料

`references-private/` 由用户提供，主要用于本地研究和校准。它已经写入 `.gitignore`，默认不会被 `git add .` 加入仓库。

`data/evidence/reference_manifest.json` 保存文件名、分类、大小和 SHA256。GitHub 公开发布前应核验原始版权和引用许可。

## 资料不足时

使用 `unknown`、`locked` 或 `pendingEvidence`。不得用通用中式资产填补地方建筑节点。
