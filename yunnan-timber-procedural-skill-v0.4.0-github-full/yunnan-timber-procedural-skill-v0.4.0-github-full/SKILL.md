# 云南木结构程序化纹理技能

版本：0.4.0

## 目标

为云南历史建筑生产线提供可复建、可随机、可扩展的木材程序纹理。技能覆盖圆柱、方柱、梁、枋、檩、椽、门窗、木板和榫卯切面。

## 强制坐标规则

材质规范中的局部 X 始终代表木材长度与纤维方向。

构件几何可以沿 X、Y 或 Z 生长。接入时必须提供 `geometryLengthAxis` 与 `radialAxisHint`。适配器会建立右手材质坐标系。

标准 Three.js 圆柱沿局部 Y 生长，圆柱必须使用：

```json
{
  "profile": "round",
  "geometryLengthAxis": [0, 1, 0],
  "radialAxisHint": [1, 0, 0]
}
```

圆材侧面使用纵向纤维分支。端面使用年轮、木射线、毛孔和径向裂纹分支。圆材侧面不以端面年轮条带作为主纹理。

## 表面分类

```text
0 longitudinal
1 end_grain
2 joint_cut
3 weathered_override
```

端面与榫卯尺寸面禁止顶点位移。深裂和缺口在几何阶段生成。

## 随机规则

建筑创建时生成一次 `generationSeed`。每根母材根据建筑、楼层、母材身份和材质修订号派生 `sourceSeed`。每个构件继续根据 `memberId` 派生独立细节变化。

同一根母材被截断或开榫时，子构件共享 `sourceTimberId`，并用 `grainOffset` 恢复母材坐标。

## 材质预设

```text
dark_aged
warm_medium
light_weathered
lacquered_chestnut
```

颜色对比保持柔和。细节主要由受光、粗糙度与统一高度场形成。

## 凹凸规则

微法线负责细纤维、毛孔和细小加工痕。

视差负责浅沟、浅裂和近景深度变化。

低频顶点位移负责轻微手工不平与风化起伏。

高度场同时驱动颜色细变、粗糙度、凹腔、微法线、视差和低频位移。

## 建筑生产线入口

```text
src/integration/HistoricalBuildingTimberSkill.mjs
```

Three.js 入口：

```text
src/three/YunnanTimberThreeAdapter.mjs
```

数据协议：

```text
schemas/yunnan-timber-member.schema.json
```
