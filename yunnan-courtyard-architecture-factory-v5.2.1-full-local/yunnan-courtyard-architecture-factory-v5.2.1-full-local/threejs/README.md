# 团结乡样本 01（旧称 C2 美人靠）GLB 参考层

这是生产线里的可编辑扫描参考层，不是当前 `index.html` 的程序化构件数据，也不替换一颗印或三开间前廊个案。运行主档为 `assets/models/YN_TUANJIE_001_EDITABLE.glb`；FBX 仅保留在私有来源链中，不是网页依赖。

```js
import { loadC2Meirenkao } from './C2MeirenkaoAsset.js';

const loaded = await loadC2Meirenkao({
  scene,
  baseUrl: '/assets/models',
});
console.log(loaded.dimensionsMeters);
```

主档含 48 个独立命名网格、608,634 个顶点和 464,288 个三角面；不含动画、骨骼、morph target、相机或外部解码器依赖。五个父分组可分别隔离场地、未定细部、一层、二层和屋顶。它是可编辑的空间扫描分片，不是已经验证过的柱、梁、墙、门窗或 BIM 构件。

运行模型按米制标签加载，坐标已从源 FBX 的 Z-up 转为 glTF/Three.js 的 Y-up，原点规则为“XY 包围盒中心、最低 Z”。当前约 `3.81322 × 2.33144 × 1.39608 m` 只表示转换后的展示包围盒；由于没有测量控制点，不能当成团结乡实建尺寸。空间分组可用于观察台基/楼梯、一层、二层、屋面和零散细部，但当前不宣称 BIM 构件语义。

原始 FBX、贴图、旧 GLB 和来源哈希位于 `references-private/c2-meirenkao/`，该目录默认被 Git 忽略。当前授权范围是本地生产线页面集成；对外公开分发前仍需单独确认版权和署名。

团结乡系列索引位于 `data/regions/tuanjie_township_reference_catalog_v1.json`，样本级拆分位于 `data/cases/tuanjie_township_001_reference_decomposition_v1.json`。

## Three.js 参数化生产体系

团结乡扫描的外观规律已经拆成可编辑源模块，不要求把扫描 GLB 当成生产线几何：

- `YunnanMaterialFactory.js`：收分夯土的分区风化、灰棕旧木、低饱和陶瓦、石板与门洞暗部材质。
- `YunnanCourtyardProduction.js`：滇中一颗印空间语法、正房/耳房/倒座、围廊圆柱、少量高窗、柴屋、日常楼梯和独立板瓦—筒瓦片。
- `yunnan-courtyard-production-demo.html`：在浏览器中检查分组和材质的开发预览。
- `../data/production/yunnan_threejs_production_system_v5_4_0.json`：资产契约、证据边界和质量门。

团结乡瓦的精确宽度、长度、搭接、泥灰坐浆、脊和边角仍由证据锁定；模块使用已有 YKY 测绘比例作为可替换种子，不宣称扫描包围盒是团结乡实测尺寸。详见 `../docs/YUNNAN_THREEJS_PRODUCTION_SYSTEM.md`。
