# 验证报告

版本：0.4.0  
验证时间：2026-08-20 10:59 UTC

## 验证结论

- JavaScript 与独立网页脚本语法检查：通过。
- 单元、契约、资源与部署结构测试：63 项通过，0 项失败。
- 圆柱 Y 轴到木材长度轴的映射测试：通过。
- 圆材柱身纵纹分支测试：通过。
- 柱顶与柱底端面年轮分类测试：通过。
- 每根构件独立种子与同源母材连续性测试：通过。
- 微法线、视差和受控低频位移结构测试：通过。
- 四种云南木色预设测试：通过。
- 单文件网页无 CDN、无外部脚本、无图片木纹资源测试：通过。
- GitHub Pages 工作流与发布辅助脚本测试：通过。

## 圆柱修正

标准 Three.js 圆柱沿局部 Y 轴生长。本版将圆柱长度轴设置为 `[0, 1, 0]`，径向提示设置为 `[1, 0, 0]`，再转换到木材统一坐标中的长度 X 轴。圆柱和圆檩使用独立的 `round` 轮廓分支，柱身以纵向纤维为主，端盖继续使用年轮、木射线、端面毛孔与径向细裂。

网页演示中的圆柱保持原生 Y 轴几何，不依靠把模型旋转到 X 轴来补偿材质。构件进入建筑场景并发生旋转后，木纹仍附着在构件局部坐标中。

## 木纹与凹凸

颜色对比限制在较低范围，细节主要由统一程序高度场、微法线、粗糙度与凹腔响应共同表现。高度场包含低频起伏、纵向纤维、年轮、毛孔、细裂、结疤和轻度手工加工痕。

建筑观察档使用微法线。近景档增加六步视差。构造检查档增加十步视差和最高 4.5 毫米的受控低频顶点位移。端面与榫卯尺寸面锁定位移，避免连接尺寸发生变化。

## 浏览器视觉验证边界

本容器中的 Chromium 软件 WebGL 和 EGL 环境未能稳定完成自动截图流程，因此本次没有把浏览器视觉冒烟标记为通过，也没有在包内放入测试截图。独立页面脚本、WebGL2 结构、着色器接口和材质契约均已完成静态验证。推送 GitHub Pages 后，应在桌面版 Chrome 或 Edge 中进行最终视觉验收。

## GitHub 全量结构

- `index.html`：GitHub Pages 根入口。
- `preview-standalone.html`：与根入口完全一致的单文件验证页面。
- `src/index.mjs`：统一模块入口。
- `src/core/YunnanTimberSkill.mjs`：种子、坐标、轮廓、色系与质量档核心。
- `src/three/YunnanTimberThreeAdapter.mjs`：Three.js 几何分类和程序材质适配器。
- `src/integration/HistoricalBuildingTimberSkill.mjs`：历史建筑生产线接入层。
- `presets/`、`schemas/`、`examples/`：预设、数据协议与示例。
- `.github/workflows/pages.yml`：验证后自动发布 GitHub Pages。
- `scripts/publish-github.ps1`、`scripts/publish-github.sh`：本地验证与推送辅助脚本。
- `docs/`：轴向、凹凸、材质和建筑生产线接入说明。
- `tests/`：63 项自动验证及原始结果。

## 原始结果

- `tests/node-syntax-result.txt`
- `tests/unit-test-result.txt`
- `tests/browser-smoke-result.json`
- `tests/browser-smoke-metrics.json`
- `tests/browser-smoke-run.txt`
