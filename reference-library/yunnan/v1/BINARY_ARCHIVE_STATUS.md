# 参考原文件存储状态

## 已在 GitHub 仓库中的参考资产

- `assets/models/YN_DALI_001_REFERENCE_WEB.glb`
- `assets/models/YN_HAOSI1_WULONG_WL_001_REFERENCE_WEB.glb`
- `assets/models/YN_TUANJIE_001_EDITABLE.glb`
- 结构化知识合同、测绘尺寸、图版关系、瓦作规则、墙面规则和模型分析 JSON。
- `knowledge-handoff/v5.5.1/` 中的建筑世界知识、有效对话、用户决策、Codex 协议、新聊天入口和当前错误清单。
- `REFERENCE_ARCHIVE_MANIFEST_V1_1.json` 中的 17 个确定性归档分卷、文件数量、字节数和 SHA256。

## 已准备的原始资料归档

原始资料已经按以下 17 卷整理并完成 SHA256：

1. 一颗印文章截图两卷。
2. 刘致平规范图版一卷。
3. 测绘图一卷。
4. 一颗印、纳西类型和反馈图一卷。
5. 现场航拍八卷。
6. 瓦墙局部照片两卷。
7. 网页反馈截图一卷。
8. 知识提取文件一卷。

归档总大小为 96,390,973 bytes。全部分卷已经收入完整新聊天包：

- `HOUSE-yunnan-production-v5.5.1-new-chat-complete.zip`
- SHA256：`a0b4c4814e55a00b281d16c30f392fb8b854bf9a69f45a7b9ef1d47abb283971`

## 当前技术边界

当前 GitHub 写入接口能够创建文本文件和接收 base64 blob 内容，但没有直接接收本地文件路径的参数。约 96 MB 的原始图片分卷尚未写入 GitHub 二进制目录或 Release Asset。该状态已登记到 Issue #12，禁止把本地路径、清单或校验值冒充成已经上传的二进制文件。

## 下一会话动作

具备合适的二进制上传通道后，小李工程师或 Codex 直接完成：

1. 读取 `REFERENCE_ARCHIVE_MANIFEST_V1_1.json`。
2. 上传到 `reference-library/yunnan/v1/archives/` 或 GitHub Release。
3. 逐卷核对 SHA256。
4. 更新本文件和逐文件清单。
5. 关闭 Issue #12。

用户不参与上传、拖放、拆包或配置。
