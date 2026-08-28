# Brick Mother 1.0 冻结版本

发布日期：2026-08-28

## 版本结论

Brick Mother V0.4 多频噪波材质实现正式提升为产品版本 1.0。V1.0 从此作为砖块母体生产线的固定回退基线，后续高精度研究进入 V2.0 分支。

## 已冻结能力

1. 历史手工烧结砖、完整 PBR 老砖、原始黏土砖和石块四套真实参考材料档案。
2. 三个独立程序化网格子代，具备独立种子、网格和材料参数。
3. SDF 与四面体等值面重建。
4. 崩角、浅坑、孔簇、裂缝和边缘破坏进入负向几何。
5. Gradient Noise、fBm、Ridged fBm、Turbulence、Domain Warp、Worley Cellular Noise 六层噪波材料场。
6. 颜色、空洞、粗糙度、法线与噪波诊断通道。
7. WebGL2 材质渲染、旋转、缩放、平移、聚焦与换种子。
8. 原始参考并排查看及作者、许可、来源和哈希追踪。
9. GitHub Pages 在线发布。
10. 真实 Chromium 自动 Smoke、截图、DOM 和日志证据。

## 验证记录

源实现提交：`587b7612c4afd44174457ff769715986f5a68c62`

Pages 成功运行：`33160946550`

真实 Chromium Smoke 成功运行：`33160946482`

浏览器证据 artifact：`9681613755`

## 完整包

完整运行包名称：

`BRICK_MOTHER_V1.0_FULL_PACKAGE_2026-08-28.zip`

本地交付包 SHA256：

`a46f2d8ceef5caf03f6a11ba69cac3b980ae272f87f62b4befd855773a12fb9e`

GitHub Actions 会从冻结源码、版本文档、发布工作流和真实浏览器证据重新生成同名全量包，并为 GitHub 产物单独计算 SHA256。

## 参考资产边界

原始第三方 GLB 的文件名、作者、许可、来源网址和 SHA256 保存在材料档案中。生产运行时不依赖这些外部 GLB 二进制。打开原始参考面板时需要联网访问来源平台。

## 在线入口

`https://haihao0307.github.io/HOUSE/brick-mother/?v=20260828-6`
