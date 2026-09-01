# Tiles Mother V0.3：讲武堂材质候选

V0.3 是依据 `knowledge/jiangwutang-001/analysis.json` 的首个程序化可视候选。它只把已观察到的有效 UV 区域颜色分布、多尺度图像变化、近似各向同性的方向信号和近乎平坦的 Normal 结果转成可调候选；它不声称恢复真实基础色、粗糙度、物理尺寸或高度。

## 可复现构建

`build_v03.py` 从审查基线 `b6a9d0be3acdf3d9f5a633acec12fcf7cc2e32c1` 读取冻结的 V0.2 `tiles-mother/index.html`，应用 `j1-index.patch`，再对当前候选 HTML、生成器和配置计算 SHA256。生成 HTML 写入调用者指定的临时路径；仓库只保留轻量脚本、配置和最终构建清单。

示例：

```powershell
python tiles-mother/v03/build_v03.py `
  --candidate tiles-mother/index.html `
  --out $env:TEMP/tiles-mother-v03-index.html `
  --manifest tiles-mother/v03/build-manifest.json
```

工作台默认的新项目使用 `jiangwutang-v03`；载入 V0.1/V0.2 协作记录时迁移器保留 `legacy-v02`，不会清空浏览器记录。素烧地砖和釉面瓷砖不进入讲武堂候选分支。

微凹凸候选默认弱值，可在“微凹凸候选”设为 0 作为关闭对照。其数值是渲染候选，不是高度测量。`原色观察`与`完整光照`共用同一候选，后者使用固定观察光照。
