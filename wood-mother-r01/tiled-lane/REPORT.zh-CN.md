# Wood Mother 上下文丢失分块修复候选

## 用户证据与结论边界
2026-10-28 03:23 用户 v5 截图明确记录 frames=0、draws=2、losses=1、restores=0、contextLost=true、1818×1092、48 个读回样本全零。确认用户浏览器上下文丢失，不将驱动问题、shader 大负载等假设说成已证根因。

## 范围
仅 HOUSE 分支 trial/wood-mother-r01-20261028 新增 tiled-lane 与既有隔离 CI。旧 v5 独立保留，不修改 Tiles、A4 或其他项目。当前提交 42a2a8ac762bf183a56817009dd8432fdfb31b36。

## 修复
- 材质/形体/vertex/fragment 源码逐字一致，原暖冷两面光与灰背景不改。
- 保持 v5 既有 effectiveDPR=min(requestedDPR,1.5)，不再降分辨率。这不是设备全原生 DPR；既有上限明确记录而不隐瞒。
- 初次16×16真实材质小块探针，再128×128偶数边界 scissor；viewport、gl_FragCoord 与 res 仍为全图。
- 一块提交后 fenceSync+flush，clientWaitSync(timeout=0)让出事件循环，signal 后才下一块；没有 gl.finish 或循环同步等待。
- 参数变化时等待当前在途块结束，取消余块，下一代清空全部为灰背景再绘；没有旧新形体混帧。渐进半帧明确标记未完成，不能作验收。
- preserveDrawingBuffer=true 保留跨异步块，未增整帧FBO/额外大纹理。
- 独立 contextSerial 禁止恢复后旧sync进入新context；旧token不删除新上下文资源。
- 一次自动恢复请求并完整重建，二次丢失停止，不reload、不循环恢复。
- 只有所有块完成且抽样通过才计完整frame；诊断记录epoch/committedGeneration、阶段、tile坐标与GPU错误。readPixels不是用户屏幕合成成功证明。

## 测试
整帧RGBA对照 v5 同尺寸（误差上限1）、桌面/大窗高DPR/手机尺寸、真实在途代际取消、快速参数合并、重设尺寸、薄切/端纹/灰度、绘制中loseContext恢复、第二次loss停止；独立空白context旧sync负控验证失效。
CI使用普通沙箱 Chrome，不能证明用户真实GPU已修复，必须继续根据实际用户反馈判断。

## 回退
仍保留 baseline-v5.html；root 未取得 CI 和图像审阅证据前不得替换 Site。

## 后续导数正确性修复
原候选严格全帧门失败：v5及分块同材质在64/180/106个轮廓邻像素存在差异，内部零差异。非一致hit控制流内导数导致不稳定是定位假设，故不放宽门限。经root批准：仅将age/phase/detailCoord及其导数、p的导数统一求值，昂贵noise/fBm/microHeight仍只在命中区域计算；命中p及形体判断不变。miss点仅提供有限边界延拓供导数邻域，非物理解析梯度。新baseline-stable与candidate同shader必须严格全帧对照；旧v5差分独立列出，不再声称shader与旧版逐字一致。
