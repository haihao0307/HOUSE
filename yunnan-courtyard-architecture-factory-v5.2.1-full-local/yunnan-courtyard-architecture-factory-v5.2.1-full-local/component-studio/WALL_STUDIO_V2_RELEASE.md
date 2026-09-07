# 云南墙体与墙面工作室 V2

## 在线入口

- `component-studio/wall-lab.html`
- `reference-model-showcase.html?mode=dali`
- `reference-model-showcase.html?mode=wulong`
- `reference-model-showcase.html?mode=tuanjie`

## 本轮成果

1. 沿用第一版组件工作台的 `YunnanComponentStudio / attachments` IndexedDB，因此用户已经放入墙体工作室的图片、NEF、PDF、图纸和 JSON 可继续读取。
2. NEF 与常见 RAW 文件由浏览器扫描内嵌 JPEG，较大的可用预览写入独立缓存库，原件保持只读。
3. 增加资料筛选、搜索、图片放大、旋转、原件下载、四图对比、墙面语义标签和证据等级。
4. 将大理、乌龙村、团结乡三个真实 GLB 的已确认墙面知识蒸馏为 `data/wall-knowledge-v2.json`。
5. 新增独立 Three.js 程序化试验墙，包含收分墙体、真实洞口、石勒脚、砖包角、抹灰、基层暴露、纤维、返潮、雨痕、裂缝、修补和粗糙度控制。
6. 三模型查看器改为按查询参数只加载当前模型，避免三份大型 GLB 同时争用显存和下载带宽。
7. 新增高 DPI、最高 16 倍各向异性过滤、线性色彩照明、五点纹理细节恢复和法线强度控制。

## 证据边界

- 大理和乌龙网页档保留原有几何与材质分配，公开贴图已经分别降采样至 4096 底色，以及乌龙 2048 法线。
- 团结乡网页档继续使用 3072 底色和 1024 法线，高精度 7000 / 2500 档保留在本地证据层。
- 高清着色与高 DPI 能改善网页观察，无法恢复公开档中已经被降采样移除的源像素。
- 扫描模型支持可见外观、综合色、粗糙度、风化分区和构件关系。墙厚、土料配比、抹灰厚度、隐蔽节点与年代仍由测绘和档案锁定。

## 验证

Actions run `32920179485`：build、deploy、verify 全部成功。部署提交：`b91bb852d11092100d45d6c6f2637f6e4f0b1ef1`。
