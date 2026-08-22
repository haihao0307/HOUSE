# 建筑生产线接入

## 建筑级状态

每栋建筑保存：

```json
{
  "skill": "yunnan_timber_procedural",
  "skillVersion": "0.4.0",
  "generationSeed": 1234567890,
  "defaultPresetId": "dark_aged"
}
```

## 构件级状态

圆柱示例：

```json
{
  "memberId": "west-column-01",
  "sourceTimberId": "source-log-west-01",
  "profile": "round",
  "presetId": "dark_aged",
  "geometryLengthAxis": [0, 1, 0],
  "radialAxisHint": [1, 0, 0],
  "grainOffset": [0, 0, 0],
  "weathering": 0.34,
  "toolMarks": 0.28,
  "qualityCap": "inspection"
}
```

矩形梁示例：

```json
{
  "memberId": "main-beam-01",
  "sourceTimberId": "source-log-beam-01",
  "profile": "rectangular",
  "presetId": "dark_aged",
  "geometryLengthAxis": [1, 0, 0],
  "radialAxisHint": [0, 1, 0],
  "grainOffset": [0, 0, 0]
}
```

## 母材连续性

一根梁被截成左右两段时，两段共享 `sourceTimberId`。`grainOffset` 记录各子构件在母材中的原始坐标。开榫、开卯和斜切面使用同一母材坐标采样。

## 性能档位

大范围建筑观察使用 `building`。

室内与近距离行走使用 `close`。

材质检查与榫卯演示使用 `inspection`。

运行时可以调用材质用户数据中的 `updateQuality(distanceMeters, qualityCap)` 切换凹凸层级。

## 导出

建筑 JSON 保存技能版本、总种子和构件配置。导出 glTF 时，可把同一数据写入构件节点的 `extras.yunnanTimber`。

需要烘焙时，使用相同种子与对象空间坐标生成颜色、法线、粗糙度和高度图，保证网页材质与烘焙结果一致。
