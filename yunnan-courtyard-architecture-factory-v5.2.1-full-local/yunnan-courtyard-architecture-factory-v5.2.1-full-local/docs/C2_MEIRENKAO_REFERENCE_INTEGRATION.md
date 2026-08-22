# 团结乡样本 01（旧称 C2 美人靠）参考层接入说明

## 接入结果

用户确认该建筑来自云南团结乡，现以稳定编号 `YN_TUANJIE_001` 登记为一个完整院落建筑群扫描。“民居 C2 美人靠”和 `YN_C2_Meirenkao` 只作为兼容旧文件与加载入口的历史别名。

扫描已经放入云南建筑生产线的本地参考目录：

```text
references-private/c2-meirenkao/
├── C2_Meirenkao_Reference_Lite.glb
├── C2_Meirenkao_Reference_High.glb
└── source/
    ├── C2_Meirenkao_Source.fbx
    ├── C2_Meirenkao_Source.fbx.rsInfo
    ├── C2_Meirenkao_diffuse.png
    └── C2_Meirenkao_normal.png
```

生产线使用的可编辑双档另存为：

```text
assets/models/YN_TUANJIE_001_EDITABLE_HIGH.glb  # 7000/2500 高精度主档
assets/models/YN_TUANJIE_001_EDITABLE.glb       # 3072/1024 网页标准档
```

网页可明确切换这两个 GLB；FBX 及旧 High/Lite 仅用于来源追溯，不是运行时依赖。

源坐标为本地 Euclidean / Z-up；进入 Three.js 3GIS 后为米制标签、Y-up，原点为 XY 包围盒中心的最低 Z。FBX 元数据同时记录 `UnitScaleFactor = 100` 和 `OriginalUnitScaleFactor = 1`，但没有测量控制点或地理坐标。因此 GLB 的 `3.81322 × 2.33144 × 1.39608 m` 只表示转换资产的展示包围盒，不是实建尺寸；真实尺度状态为 `unverifiedNoSurveyControl`。

## 与生产线的关系

当前主页面仍是无外部依赖的程序化 WebGL 生产线，团结乡扫描件不直接替换现有一颗印或三开间前廊个案。它作为 `referenceObservation` 层使用：

- 台基/楼梯/地面 → L05、L07
- 一层 → L06、L08、L12
- 二层 → L07、L08、L09
- 屋面 → L09、L11
- 零散细部候选 → L10、L12

这些是 48 个扫描空间分片的粗分组，不是已经确认的柱、梁、墙、门窗、楼梯或屋面语义。对 High 源文件和新主档的直接结构检查均为 0 动画、0 骨骼、0 morph target、0 相机；旧记录把这些项目写成转换器冗余属于误判，现已纠正。后续必须先用平面、剖面、控制尺寸和近照锁定，再提取为可编辑 Three.js 参数化构件。

## Three.js 使用

Three.js 宿主使用 `threejs/C2MeirenkaoAsset.js`：

```js
const loaded = await loadC2Meirenkao({
  scene,
  variant: 'editable',
  baseUrl: '/assets/models',
});
```

两档均为 464,288 三角面、48 个可选择网格，不使用 Draco 或其他解码器。加载完后使用 `disposeC2Meirenkao(root)` 释放几何和材质。生产线内置页面不依赖 Three.js 包，而由 `assets/js/tuanjie-glb-viewer.js` 直接解析 GLB；必须由用户点击后才加载，并会应用底色、法线、各向异性过滤和高 DPI 渲染。

## 追溯与 QA

- 团结乡系列索引：`data/regions/tuanjie_township_reference_catalog_v1.json`
- 样本完整拆分：`data/cases/tuanjie_township_001_reference_decomposition_v1.json`
- 来源与哈希：`data/evidence/yunnan_c2_meirenkao_reference_sources_v5_3_1.json`
- 资产合同：`data/assets/yunnan_c2_meirenkao_reference_asset_contract_v5_3_1.json`
- 双档质量合同：`data/assets/tuanjie_township_001_glb_quality_profiles_v5_3_5.json`
- 双档质量 QA：`data/qa/tuanjie_township_001_glb_quality_validation_v5_3_5.json`
- 加载入口：`threejs/C2MeirenkaoAsset.js`
