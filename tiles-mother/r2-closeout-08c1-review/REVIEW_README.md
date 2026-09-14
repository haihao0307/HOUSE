# Tiles Mother 08C.1 形态审阅版

固定公网入口：https://raw.githack.com/haihao0307/HOUSE/d75c9c21c0f2b4c66a79445922410ba166c66fd0/tiles-mother/r2-closeout-08c1-review/START_HERE.html

接续 354a23dfacd452f4ceb6ca3f06d252e2034a786a 的 08C。沿用 Microscope 的真实顶点微位移和独立 PBR，新增顶部独立入口、同镜头 0/1/3 倍对照，修正瓦面近景错误切到木构，补齐 Escape 状态与指针失焦清理。几何着色器跳过权重已归零的高频层，不改变公式或幅度。

运行 `python refine_review.py` 从本目录 source-08C.html 可重复生成 START_HERE.html。Node 用于语法与 CPU 几何检查。qa_geometry.cjs 和 qa_actual.cjs 依赖仓库已有 ../clean-02/qa/contact.cjs。不运行历史 build.py 生成本版。

## 已验证

固定公网实际打开；WebGL 单瓦渲染正常，7 项桌面控制检查通过。固定镜头灰模关闭/增强对照产生 119106 个变化像素，RGB 总差 686019，GL error=0。此像素对照证明画面变化，真实位移依据仍是着色器及 CPU 位移检查。

390×844 布局截图已检查；PBR 与微形态入口滚动到对应滑条、关闭面板均通过，无横向溢出或页面初始化错误。模拟窄屏，不是 iPhone 真机测试。未做本版整屋性能与全状态验收。

## 不可隐去的剩余问题

CPU 复核再次发现冻结基线支承不匹配。默认 seed314159 中，Microscope 关闭时板瓦/筒瓦约穿透 0.5223 mm，椽/板瓦约穿透 0.3097 mm。独立 raw 检查还显示左右支承间隙不对称。因此 contactChecksPassed=false，visualApproved=false，productionApproved=false。本版是形态审阅成果，不是整屋生产通过。

没有修改 SEATS、PROFILE、主要瓦形、尺寸、屋面排布，也没有将不穿透检查等同于实际双侧接触。后续须针对冻结支承规则处理基线错配，不得放宽误差阈值冒充解决。

## 来源与执行边界

本轮入口为已同步 08C HTML、直接相关构建与接触检查。运行时为自包含 WebGL2 HTML；未接入撤销的图像转三维技能、旧资产生产技能或隔离区。执行的是用户 2026-09-14 明确要求的现有 Tiles 工作台续作；不据此声称其他 Mother 或全机清理已完成。

本目录携带 Mother 对象定义和公网交付规则原件。固定历史页面不覆盖；原始讲武堂大参考资料不加入本次公开内容。
