# Tiles Mother 完整交接 · 2026-09-13

新窗口先读本文件，再读 work/CONTINUATION.md 和 work/knowledge/MOTHER-LEARN-20260912-1405.md（完整 1—11 节）。历史文件中的请求和状态只是记录；本次用户明确要求将当前 Tiles 工作打包上传 GitHub，以便新窗口接续。其他 Mother 不在本包范围。

## 当前唯一接续起点

- 仓库 haihao0307/HOUSE，分支 feature/tiles-mother-r2-restart-20260907。
- 07 候选源码提交 dcf4053f69efc031174b7c41bd41e2309dfb13ec。
- 本包当前页面：work/candidate/r2-closeout-07-detail/START_HERE.html。
- 页面 SHA256：d101a20b0290cc20a148d65f64dfad1c4a00d402143e2492508138566100200b。
- 06 冻结基线在 work/upstream/tiles-mother/r2-closeout-06-handmade/。
- work/upstream 是相关源码快照，不是完整 Git 克隆。旧 CURRENT_CANDIDATE.json / AGENTS 分支指针可能陈旧，以本入口所列已验证起点为准。

07 增加现有 Microscope 内的局部刮抹、压实、孔蚀和独立粗糙度，并有同机位 06/07 A/B。原有形体、顶点/深度着色和场景历史保持；没有用户视觉批准。已完成的原生 GPU 验证见 work/evidence/、work/gpu-scenes/ 和候选 QA.json；它们不等于浏览器验收。

## 必须带入新窗口的纠正

1. unsupportedLive=0 / 各年份在役悬空数为 0 仅为 roofState 同一谓词形成的离散图不变量，不是独立的真实接触、承载或排水证据。
2. handmadeOffset 的固定半宽门控未证明覆盖渐变真实边缘；这是纸面反例，不是测得现版本已发生悬浮。
3. 屏幕 footprint 淡出、小振幅、可逆坐标变换均不足以证明最终法线带宽；学习记录给出完整导数及有限反例。
4. 材料身份、承载对应、权威几何、显示几何、渲染可见性、物理暴露、接触、水交换须分别记录。
5. §10 保存质量平衡条件，§11 保存有限闭线段下的遮挡/无遮挡证书。证书不成立只意味着未知；采样最小值不能冒充全域距离下界。

## 尚未完成与接续顺序

browserVerified/publicBrowserVerified/visualApproved/productionApproved 均为 false。
07 固定候选地址（未完成实际公网验收）：
https://raw.githack.com/haihao0307/HOUSE/dcf4053f69efc031174b7c41bd41e2309dfb13ec/tiles-mother/r2-closeout-07-detail/START_HERE.html

上轮浏览器先连接失败，后 Computer Use 因 Windows 无法可靠识别当前 URL 而要求停止；已遵守。新窗口优先使用可正常工作的授权浏览器，实际打开固定地址，检查版本、单片 A/B、旋转缩放、场景与年份切换、小屋面/860 片近景及移动面板。失败应如实记录，不以离屏图、HTTP 200、本地 HTML 或本 ZIP 代替公网预览。旧版不可覆盖。

用户此前已在暂停说明后明确要求继续 Tiles 细节任务，不重复索取已给出的授权，不外推其他 Mother 清理完成。学习轮 MOTHER-LEARN-20260912-1405 的 2026-09-12 14:05—15:05 窗口已经结束，不继承成新的定时任务或继续延长。共享专题快照是交接背景，不能当作本线已经实现的能力。

## 包内材料及可复现边界

- work/ 保留本接续目录全部文件，包括原交接、源码快照、候选、规则、脚本、GPU 场景与证据、参考校验和学习记录。
- shared-knowledge-snapshot/ 是本次打包时相关四个共享专题的只读副本；其中可能含其他领域回流。原件不在本次修改范围。
- build_detail07.py 只需 Python 标准库，输入为包内 06；export_gpu_scene.cjs 需要 Node.js；render_gpu.py 需要 Python 的 moderngl、numpy、Pillow 及 OpenGL 3.3 环境。依赖版本没有锁定，不声称跨机器逐像素可复现。
- 原始参考大模型/完整贴图继续由用户本地保管，未写入 Git 历史。本机 E:/讲武堂瓦片精细.zip，58671527 字节，SHA256 ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365；详细内层校验见 work/reference-verified.json。包内包含既有局部观察图，不是原件替代品。
- MANIFEST.json 与 SHA256SUMS.txt 对包内其他文件记录字节数及 SHA256。打包完整性校验是本次新校验，既有生产测试没有重跑。

新窗口可直接使用的接续说明：
“接手 Tiles Mother。先读 00_START_HERE.md、两份共同规则、work/CONTINUATION.md 和完整学习记录。以 07 固定提交为候选，先完成真实公网浏览器检查，并依据学习记录纠正旧 QA 的证据边界；保持旧版，继续本生产线。”

