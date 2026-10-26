# Tiles Mother R02：共同基础片候选

2026-10-26，按用户明确要求重新实现。09H仍是已认可质量锚点；09I是本次共同基础片实现的候选预览。

## 定义与调用

`mother.cjs`只保存共享连续规则，不保存网格。`library.json`保存共同默认变量和D7/L9板瓦、筒瓦及平片的差异数据。实例名称只用于查表，核心没有板瓦/筒瓦构造分支。

```js
const mother=require('./mother.cjs');
const library=require('./library.json');
const tile=mother.instantiate(library,'cover-L9',{press:{amount:0.5}});
const point=tile.evaluate(0.2,0.6,0);
// position, materialAddress, materialPoint, color, roughness,
// metallic, microHeight, microGradient, embossHeight, displacementHeight
```

米制局部架：x横向、y向上、z纵向。材料地址u∈[-1,1]、t∈[0,1]、q∈[0,1]；q从上表面到下表面。`sheetPoint`查询基础矩形片，`shape`查询压形主面，`position`含表面细节，`evaluate`同时查询几何与表面。`definition()`返回定义副本。采样三角形只在显示器中产生。

压形程度amount从0到1连续改变有符号曲率、收分及小头；表面场依附同一材料地址。细节位移、颜色和粗糙度从同一17频规则求值。为保留09H纹理外观，材料场的参考嵌入由该配方的成形状态生成，然后在改变amount时保持固定。这不是物理泥坯压制，也没有证明弧长、面积或体积守恒。不同配方不保证相同材料纹理嵌入；当前保证的是同一配方压形过程中材料点稳定。

`shader-adapter.cjs`从核心标量函数生成GLSL，避免另写一套色彩/粗糙度公式。渲染器另处理光照和临时法线；旧工作台的损坏、苔藓及装饰面还保留原规则，不能称全部瓦类细节已经迁移。轮廓裁切、孔和压印曲线有基础函数测试，尚未把旧花饰逐项转换为新配方。

## 验证与边界

`VALIDATION.json`记录连续点、平片、压形材料稳定性和参数验证。与09H普通瓦形体对照时，修正原板瓦位移遗漏的纵向法线分量；默认强度最大位置差约22.5微米。`GPU_VALIDATION.json`记录实际WebGL执行与CPU的256个样本比较，容差针对微高度、微斜率、颜色和粗糙度，并保留原始误差。测试通过不等于全部GPU或全部参数成立。

工作台的折坡搭接及梁架支承属于组合层，保留09H连接规则并另行检查。`warm-fold.js`只把旧布局作为候选，使用当前完整三角面验证接触与投影搭接宽度，通过后才缓存；未通过继续求解。它不是瓦片本体。

D7/L9数据来自既有图示解释，误差未知；未标尺寸、圆弧及形变仍含模型假设。不可称宋式通用标准、真实生产流程、结构安全或全部瓦型已验证。共享函数体积、实例差异、显示与求解缓存应分别报告，不能把对象引用大小当成总依赖大小。

继续执行根目录AGENTS.md、TILES_MOTHER_CHARTER.md以及公共交付和对象定义规则。固定旧版与公网链接保留。
