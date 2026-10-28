# Wood Mother CPU 兼容三维

本模式不建立 WebGL/WebGL2 上下文。Worker 使用同一板体/圆柱解析射线求交、体域生长时间、活节、4层fBm、微高度法线与冷暖双侧GGX数学，计算最终RGBA；Canvas2D仅显示计算结果。不是预渲染截图、贴图或二维伪造。保留v6有效DPR=min(devicePixelRatio,1.5)的实际像素预算，没有再次降分辨率。

## 数值契约
JavaScript Number(binary64)，弧度，fract=x-floor(x)，hash=fract(sin(x*127.1+y*311.7+z*74.7)*43758.5453)，同一固定种子常数。GGX保持原3.14159。2×2像素quad差分，fwidth=abs(dx)+abs(dy)，底左射线坐标转换为顶左ImageData行序。遵守v6有限miss辅助延拓，只有命中表面算昂贵噪声。CPU与GPU浮点/三角函数精度不同，不承诺逐bit一致；尤其sin-hash、面交界法线判定可出现局部差异，必须与平均误差分别报告。

## 响应性与失败处理
64×64块，每块让出事件循环。新参数epoch立即使旧消息无效，并取消Worker旧任务；不混合两代图像。Worker不可用时同一算法主线程小批协作运行，不换截图。没有自动WebGL恢复尝试或reload。完成必须收到全部块并读取Canvas2D像素确认非空，仍不把读回等同用户屏幕合成证明。显示真实耗时，不宣称实时60fps。

## 验证
- Node独立1000×630真实计算约1.87秒，160块、630000不透明像素、134544解析命中。
- test_cpu_browser.py独立拦截WebGL上下文，要求调用次数0；桌面、用户近似窗口、手机viewport；实际在途取消、切面/圆柱/端纹/噪节/通道。
- 故意阻止Worker启动，要求同算法主线程最终RGBA与Worker全字节一致，并验证在途取消后仍一致。
- 正常Chrome沙箱CI与云CUA（无WebGL可用）分开验证。用户机器最终显示仍须实际确认。

## 回退
旧tiled-lane/candidate.html和Site v6保留。此兼容候选不得在未验证实际画面前默认替换生产入口。
