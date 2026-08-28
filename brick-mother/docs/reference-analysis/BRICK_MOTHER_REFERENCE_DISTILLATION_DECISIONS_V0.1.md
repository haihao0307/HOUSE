# Brick Mother 参考资产蒸馏准入表 V0.1

日期：2026-08-28

## 结论

六个 GLB 已完成容器、几何、拓扑、UV、材质槽、图像引用和固定中性三视图审计。当前可以提取宏观比例、轮廓、低频起伏和缺损类型。绝对尺寸、材料身份、孔洞物理来源和微观表面仍需校准。

原始纹理继续保持证据用途，Brick Mother 运行时纹理权威为 `false`。

## 逐资产准入

| 参考资产 | 准入级别 | 可蒸馏内容 | 隔离内容 | 主要原因 |
|---|---|---|---|---|
| `12th_-14th_century_building_brick.glb` | ACCEPT_GEOMETRY_REFERENCE | 1:0.462:0.256 比例、长砖轮廓、低频面部起伏、边角磨圆范围 | 原贴图、材料身份断言 | 单砖结构清楚，绝对尺寸约 319×147×81 mm，焊接后无开放边，存在 16 条非流形边待观察 |
| `brick.glb` | ACCEPT_GEOMETRY_REFERENCE | 1:0.662:0.275 比例、宽厚砖轮廓、角部圆化、平整大面与局部起伏 | 原贴图、扫描微噪点 | 单网格结构清楚，焊接后无开放边和非流形边，世界最大尺寸约 419 mm |
| `clay_brick.glb` | CONDITIONAL_REFERENCE_ONLY | 方形薄砖家族、手工面起伏、边缘破损、面部矩形压痕 | 绝对尺寸、原贴图、可再分发资产 | 场景尺度约 566 m，明显需要归一化；两个开放扫描片；4 个退化三角形；来源标注 CC-BY-NC-4.0 |
| `stone_brick.glb` | CONDITIONAL_GEOMETRY_REFERENCE | 块石的厚重比例、非规则端面、宏观弯曲和削切轮廓 | 绝对尺寸、原贴图、十套 UV 结构 | 场景尺度约 14 mm，明显需要归一化；三个开放扫描片；扫描拓扑密度很高 |
| `brick (1).glb` | ISOLATE_PRIMARY_MESH | `Cube.001_0` 的方形薄砖候选比例 | `Plane_0`、场景级包围盒、环境杂物 | 三视图显示大量弧线与散点环境几何；场景级尺寸约 25.6 m；附加平面没有 UV |
| `white_wall_texture.glb` | EXCLUDE_FROM_BRICK_GEOMETRY | 暂无 | 圆角立方体几何、原贴图 | 几何是 100 m 圆角立方体载体，无法提供可信的墙面侵蚀结构；后续抹灰研究可以单独保留来源收据 |

## 比例家族

### A. 长砖与常规砌筑砖候选

来源：`12th_-14th_century_building_brick.glb`、`brick.glb`。

归一化后的排序尺寸范围：

- 最大轴：`1.000`
- 中轴：`0.462` 至 `0.662`
- 最小轴：`0.256` 至 `0.275`

这组数据可以形成 Brick Mother 的首个长砖基础区间。绝对毫米值仍由地域工艺配置控制。

### B. 厚重块石候选

来源：`stone_brick.glb`。

- 排序比例：`1.000:0.551:0.420`
- 特征：厚度高、端面不规则、整体弯曲比常规烧结砖强。
- 状态：只接受归一化轮廓，等待真实石材样本校准。

### C. 方形薄砖与砖瓦候选

来源：`clay_brick.glb`、隔离后的 `brick (1).glb` 主网格。

- `clay_brick.glb` 场景排序比例：`1.000:0.996:0.233`
- `Cube.001_0` 局部排序比例约：`1.000:0.860:0.268`
- 状态：保留为单独形状家族，不混入默认长砖分布。

## 纹理与材料处理

| 项目 | 决策 |
|---|---|
| 原图像像素 | 禁止进入运行时 |
| 原法线贴图 | 禁止进入运行时 |
| 原粗糙度与金属度贴图 | 禁止进入运行时 |
| UV 数量与槽位 | 只作为源结构证据 |
| 颜色观察 | 可转译成参数范围，需注明置信度 |
| 微孔和砂感 | 后续由材料专属噪声生成 |
| 大崩角和轮廓缺损 | 后续由几何内核生成 |

## 拓扑解释

报告同时记录索引边界和按位置焊接后的边界。索引边界可能来自 UV 缝、法线拆分或扫描分块。焊接后边界更接近真实开放表面的风险指标。

- `12th_-14th...` 和 `brick.glb` 焊接后开放边为零。
- `clay_brick.glb`、`stone_brick.glb` 保留大量焊接后开放边，属于开放扫描表面或分块结构。
- `brick (1).glb` 的附加平面有 14 条焊接后开放边。

## BrickDNA V0.2 建议入口

```json
{
  "shapeFamily": "ELONGATED_BRICK | BLOCK_STONE | SQUARE_THIN_BRICK",
  "normalizedDimensions": {
    "major": 1.0,
    "middle": "family range",
    "minor": "family range"
  },
  "absoluteSizeProfile": "regional craft profile",
  "macroContourSource": "accepted geometry statistics",
  "microSurfaceSource": "procedural material noise",
  "referenceTextureAuthority": false,
  "materialIdentityConfidence": "pending | low | medium | confirmed"
}
```

## 下一步

1. 将两件干净单砖和一个块石候选转成统一比例的中性轮廓样本。
2. 测量边角圆化、宏观凹凸和缺口尺度谱。
3. 为 `ADOBE`、`FIRED_CLAY`、`STONE` 各生成三个确定性子代。
4. 每个子代锁定种子并输出正面、侧面、顶面和参数 JSON。
5. 用户视觉确认后，再把材料身份从 `pending` 提升到已确认状态。

