# 新对话启动提示词

请继续 Brick Mother 砖块母体窝 V0.1。先读取我上传的全量交接包，重点阅读：

- `README.md`
- `docs/NEXT_CHAT_HANDOFF_2026-08-28.md`
- `docs/Brick_Mother_Knowledge_V0.1.md`
- `schemas/brick-mother-v0.1.schema.json`
- `qa/GATE_STATUS.md`
- `manifests/PACKAGE_MANIFEST.json`

在线原型是 <https://brick-mother-nest.sunhaihao.chatgpt.site>。

GitHub 仓库是 `haihao0307/HOUSE`，只使用独立分支 `feature/brick-mother-production-v0.1-full-package`。禁止修改 `main`、`gh-pages` 和任何现有 PR，也不要创建或合并 PR，除非我明确要求。

本阶段先处理单砖母体。请依次完成：

1. 只读解析 `reference/brick-reference-source-2026-08-28.zip` 中的 6 个 GLB。
2. 为每个 GLB 输出单位、轴向、包围盒、长宽高比例、节点数、网格数、三角形数、UV、材质槽和纹理引用报告。
3. 把观察结果蒸馏成尺寸范围、缺损分布、孔洞尺度和材料规律，运行时不复制原纹理。
4. 建立固定种子、相机、灯光和标尺的同资产三视图生成器。
5. 土坯、烧结砖、石块每类生成 3 个三维子代，每个子代输出正面、侧面、顶面与参数 JSON。
6. 重点升级真实圆蚀轮廓、脆性崩角、层状侵蚀、材料专属孔洞和多尺度表面随机性。
7. 运行网页桌面和窄屏视觉 QA，保存截图、控制台日志、WebGL 状态、构建结果和性能指标。

硬规则：土坯可以含稻草；烧结砖和石块的稻草值必须为零；大缺损进入几何；微细节进入材质或着色；尺寸与微观尺度解耦；地址作为带置信度的先验；年代通过材料、气候、暴露与维修共同作用。每个输出必须携带版本、参数和种子，保证可复现。

开始时先核验交接包 SHA256 和当前 GitHub 分支 head，再汇报计划。完成后给我可视化成果、精确提交 SHA、逐项 QA 和仍未通过的门禁。

