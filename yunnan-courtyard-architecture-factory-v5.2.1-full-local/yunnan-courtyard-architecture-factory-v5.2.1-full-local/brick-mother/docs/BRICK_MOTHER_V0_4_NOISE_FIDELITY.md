# Brick Mother V0.4 多频噪波材质真实性说明

日期：2026-08-28  
分支：`feature/brick-mother-production-v0.4-noise-fidelity`

## 目标

V0.4 解决 V0.3 中的三个主要视觉问题：

1. 微观表面过于平滑，空洞和颗粒缺少清晰边界。
2. Base Color 变化过度平均，接近模糊的统一泥色。
3. Base Color、Roughness、Cavity 与 Micro Normal 各自变化，缺乏真实材料中的通道相关性。

## 参考与实现边界

用户指定研究入口：

- https://threejsroadmap.com/blog/10-noise-functions-for-threejs-tsl-shaders

Three.js 官方实现参考：

- https://github.com/mrdoob/three.js/blob/dev/src/nodes/materialx/MaterialXNoise.js
- https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language

V0.4 继续使用当前已经通过浏览器验证的 WebGL2 运行时，并实现与 TSL / MaterialX 噪波家族对应的数学层。这样可以先独立判断材质视觉提升，避免同时更换渲染器和材质算法。视觉基线稳定以后，再将相同噪波合同迁移为 TSL NodeMaterial。

## 六层噪波合同

### 1. Gradient Noise

用于连续的基础材质变化，避免简单哈希噪点产生像素闪烁。

### 2. Fractal Brownian Motion

用于宏观泥土、烧结和石材分区。多倍频叠加提供大中小尺度之间的连续性。

### 3. Ridged fBm

用于清晰的颗粒脊线、破损断面和烧结边界。该层提高局部锐度。

### 4. Turbulence

用于非对称侵蚀和杂乱细节，参与凹陷和粗糙度变化。

### 5. Domain Warp

先扭曲采样坐标，再执行后续噪波。所有通道共享同一扭曲场，避免纹理呈现笔直、重复和互不关联的图案。

### 6. Worley Cellular Noise

用于稀疏孔洞、矿物颗粒和细胞边缘。Worley 最近点距离生成孔洞核心，第二近点距离差生成石材脉线和颗粒边界。

## 通道相关性

同一个多频场同时驱动：

- Base Color
- Cavity
- Roughness
- Micro Normal
- Mineral Flecks
- Kiln Band / Clay Lump / Stone Vein

孔洞区域会同步变暗、增粗糙并形成法线凹陷。矿物颗粒会同步影响颜色、局部高度和粗糙度。禁止为各通道独立生成互不相关的随机图。

## 几何与材质分工

真实网格承担：

- 大崩角
- 浅坑
- 几何孔簇
- 主裂缝和分支裂缝
- 轮廓形变

片元材质承担：

- 微孔
- 粉尘和细颗粒
- 矿物斑点
- 窑变色带
- 微粗糙度
- 微法线

V0.4 仍禁止外贴黑球、假孔洞贴片和通用大圆角盒。

## V0.4 视觉验收重点

1. 打开原始参考并排模式时，左侧程序画面保持原亮度。
2. 放大后能看到清晰的孔洞边界、颗粒和矿物斑点。
3. 色彩具有局部锐度，同时保持在各来源 GLB 的统计色域内。
4. 空洞、粗糙度和法线位置相互对应。
5. 三个子代使用独立种子和独立网格。
6. 浏览器完成后设置：
   - `data-brick-mother-ready="true"`
   - `data-brick-mother-version="0.4.0"`
   - `data-noise-stack="6"`

## 后续

V0.4 通过用户视觉确认后，下一步才进入：

1. 更精确的参考纹理统计分块。
2. 基于源材质频谱的自动参数拟合。
3. TSL / WebGPU NodeMaterial 迁移。
4. 砖缝、灰浆、错缝和墙体批次系统。
