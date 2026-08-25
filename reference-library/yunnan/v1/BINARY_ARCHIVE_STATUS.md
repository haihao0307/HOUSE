# 参考原文件存储状态

## 已在 GitHub 仓库中的参考资产

- `assets/models/YN_DALI_001_REFERENCE_WEB.glb`
- `assets/models/YN_HAOSI1_WULONG_WL_001_REFERENCE_WEB.glb`
- `assets/models/YN_TUANJIE_001_EDITABLE.glb`
- 结构化知识合同、测绘尺寸、图版关系、瓦作规则、墙面规则和模型分析 JSON。
- `REFERENCE_MANIFEST_SUMMARY.json` 中登记的 92 份原始参考文件清单、分类、总字节数和归档分卷 SHA256。

## 已准备的原始资料归档

92 份原文件已经按以下分卷整理并完成 SHA256：

1. 一颗印文章截图两卷。
2. 刘致平规范图版一卷。
3. 测绘图一卷。
4. 一颗印、纳西类型和反馈图一卷。
5. 现场航拍八卷。
6. 瓦墙局部照片两卷。
7. 网页反馈截图一卷。
8. 知识提取文件一卷。

## 当前技术边界

本次 GitHub 连接器可以写入代码、JSON、Markdown 和已存在的仓库资产，但当前会话没有提供把本地二进制文件直接作为 Git blob 或 Release Asset 上传的文件参数。原始照片分卷已生成并校验，尚未伪称已经写入仓库。

下一次具备二进制上传通道时，由小李工程师或 Codex 直接按 `REFERENCE_MANIFEST_SUMMARY.json` 的文件名与 SHA256 写入本目录；用户不参与上传操作。
