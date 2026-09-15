# R3.2 QA 证据

被测页面：`repository/brick-mother/Brick_Mother_Wall_4x3_R3_2.html`

页面 SHA256：`c33775fea10852714942d625728d68ee394f6eeeddd981d3191dabbbcb843690`

## 三个相互独立的门

1. 静态审计：36/36 通过。报告 `LOCAL_QA.json`，SHA256 `30f67bd821286693205937536be2a39a03c26ac6e34512c48da5125e5b400135`。
2. 运行时审计：23/23 通过。报告 `RUNTIME_QA.json`，SHA256 `c3785da7d2ac8250ffe9e16e71b246cc67db5f2d1715ea4a080f5c9a46db9e92`。
3. 真实 GPU 审计：Mesa EGL/OpenGL ES 3 的三套实际程序完成编译、链接与绘制。报告 `GPU_QA.json`，SHA256 `1da8971898ef4de108686ed3209a87b67d781cd05aef736bc0c567b8058ce6fc`。

三份报告均绑定同一个最终页面 SHA，不是旧页面报告。

## 已实际证明

- 冻结母砖 336 个残差系数身份未漂移。
- 4.000 m × 3.000 m × 0.48923 m 尺寸链闭合。
- 43 皮 A/B 交替、1,420 块砖与连续土芯的运行时数据真实执行。
- 三个对象模式、五个视图与土芯控件真实执行。
- 正、背、端、顶视图使用正交矩阵和平行 SDF 射线；等距视图保持透视。
- 砖、土芯、地面真实经过 GPU shader compile/link/draw；离屏绘制非空。
- 四张 GPU 证据图保存在 `repository/brick-mother/experiments/wall-4x3-r3-2/`。

## 没有证明

- 没有证明用户已认可整墙视觉效果。
- 没有证明 A/B 砌法解释就是唯一历史构造真值。
- 没有证明真实手机或用户设备的帧率。
- 没有证明土芯的色彩、表面尺度已经由实体土样校准。
- 没有授权进入抹灰或生产阶段。

## 在解压包中重跑

```bash
cd repository/brick-mother/experiments/wall-4x3-r3-2
python qa_wall_r3_2.py --out LOCAL_QA.json
node qa_runtime_wall_r3_2.cjs --out RUNTIME_QA.json
python qa_glsl_wall_r3_2.py ../../Brick_Mother_Wall_4x3_R3_2.html --out GPU_QA.json
```

GPU 脚本需要 Node.js、Mesa EGL/OpenGL ES 库；生成 PNG 时另需 Pillow。
