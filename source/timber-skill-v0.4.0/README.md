# 云南木结构程序化纹理技能

版本：0.4.0

这是历史建筑生产线中的云南木结构材质模块。整个演示网页不读取木纹图片，柱、梁、枋、檩、椽、门窗和榫卯表面的颜色、年轮、纤维、毛孔、裂纹、加工痕与细微凹凸均由程序实时生成。

## 本版重点

圆形柱和圆形檩条使用独立的圆材纵纹模式。Three.js `CylinderGeometry` 的局部 Y 轴可直接映射到材质长度轴，柱身以纵向纤维为主，顶部和底部使用端面年轮，圆周方向保持连续。

矩形梁、枋、椽和门框继续使用三维母材坐标。构件切分、开榫和开卯后，可通过 `sourceTimberId` 与 `grainOffset` 继承同一根母材的纹理相位。

每次创建建筑会生成一个 `generationSeed`。同一栋建筑中，每根木料会根据构件身份派生独立变化。保存总种子后可以精确复建。

材质提供四组云南木色：深色旧木、暖褐中木、浅色风化、栗褐上漆。

## 直接查看

打开仓库根目录的 `index.html`。页面为单文件 WebGL2 演示，不依赖 CDN、外部脚本或图片纹理。

本地浏览器若限制直接打开本地文件，可在仓库目录启动任意静态服务器。

```bash
python -m http.server 8080
```

随后打开 `http://localhost:8080/`。

## 推送到 GitHub

将本包解压后，把包内所有文件提交到仓库根目录。仓库已包含 GitHub Pages 工作流：

```text
.github/workflows/pages.yml
```

在仓库设置中把 Pages 的发布源选择为 GitHub Actions。推送到 `main` 后，工作流会上传仓库中的静态网页并发布。

更详细的步骤见 `docs/GITHUB_PUBLISH.md`。包内还提供 PowerShell 和 Shell 发布辅助脚本。脚本会先执行完整验证，再初始化 Git 仓库、提交文件并推送到指定地址。

Windows PowerShell：

```powershell
.\scripts\publish-github.ps1 -RepositoryUrl "YOUR_REPOSITORY_GIT_URL"
```

macOS 或 Linux：

```bash
./scripts/publish-github.sh YOUR_REPOSITORY_GIT_URL
```

## 建筑生产线接口

```js
import { HistoricalBuildingTimberSkill } from "./src/integration/HistoricalBuildingTimberSkill.mjs";
import {
  prepareTimberGeometry,
  createYunnanTimberMaterial
} from "./src/three/YunnanTimberThreeAdapter.mjs";

const timberSkill = new HistoricalBuildingTimberSkill({
  buildingId: "kunming-yikeyin-001"
});

const columnSpec = timberSkill.registerMember({
  memberId: "main-column-west-01",
  sourceTimberId: "source-log-west-01",
  profile: "round",
  presetId: "dark_aged",
  geometryLengthAxis: [0, 1, 0],
  radialAxisHint: [1, 0, 0],
  grainOffset: [0, 0, 0],
  weathering: 0.34,
  toolMarks: 0.28
});

const geometry = prepareTimberGeometry(THREE, sourceGeometry, {
  profile: "round",
  geometryLengthAxis: [0, 1, 0],
  radialAxisHint: [1, 0, 0]
});

const material = createYunnanTimberMaterial(THREE, columnSpec, {
  quality: "inspection",
  distanceMeters: 2
});

const column = new THREE.Mesh(geometry, material);
```

## 凹凸层级

建筑观察档只启用程序微法线。

近景观察档启用程序微法线与六步视差。

构造检查档启用程序微法线、十步视差和受控低频顶点位移。端面与榫卯尺寸面锁定顶点位移。

深裂、缺口、腐损和会改变轮廓的破坏应在构件几何阶段生成。

## 目录

```text
index.html
preview-standalone.html
src/index.mjs
src/core/
src/integration/
src/three/
presets/
schemas/
examples/
docs/
tests/
.github/workflows/pages.yml
```

## 验证

```bash
npm run validate
```

测试覆盖圆柱 Y 轴映射、右手坐标系、圆材纵纹分支、端面分类、随机种子、色系、凹凸层级、单文件网页依赖、GitHub Pages 工作流与建筑状态序列化。
