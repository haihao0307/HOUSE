# Tiles Mother 接续入口

## 当前：Clean 02 已公开，可交互审阅

2026-09-06。用户在撤回失败路线后已重新授权极小干净版，并要求继续改善材质、木构、苔层及直接可开的公网入口。本轮继续制作授权有效；Macroscopic microscope R1 / field-core-r1 仍然撤回，不恢复该代码。

仓库haihao0307/HOUSE，工作分支feature/tiles-mother-v0.1-workbench。先读[当前身份](CURRENT_CANDIDATE.json)、[完整公开交付记录](clean-02/PUBLIC_RELEASE.json)和[源码重建与边界](clean-02/README.md)。

公开入口：https://haihao0307.github.io/HOUSE/tiles-mother/clean-02/

[独立HTML源码](clean-02/START_HERE.html)，53,033字节，SHA256 1477c0b62fc62ba97df823ba6a5bc6a362c82646397076ce122b8b0980835922。完整source、build.py及实际QA已在clean-02下保存，运行源码物化提交4eee1292ebce3c9a0b1971a202a54e5f09fed7c1。正常重建只运行build.py，不运行历史transport或一次性public_fix.py覆盖现有代码。

公开HTML桌面与手机尺寸实际导航、哈希、画面、参数及网络错误检查通过，最终run34025424061。色彩控件可见且不重建几何，木纹局部转向可调，静止6秒零新绘制。未重新完成完整运动性能门槛，不推定用户GPU帧率或风扇已解决。visualApproved=false，productionApproved=false。

构造台补回原来被跳过的顶口筒瓦后为28板+21筒=49片，界面已标明，内部兼容id仍是roof48。860片保持440板+420筒。木材连续蚀薄和存留段合并为显示近似，保留承压带以维持既有静态支承；真实断裂传播、碎片堆积及地方物性尚未完成。

## 共享网站防覆盖

发布时保留全部283个其他站点文件，只增改tiles-mother/clean-02/index.html与build.json。根入口、Brick根、R5、R6另行HTTP回读保持。最新完整站点产物run34025424061 / github-pages artifact9986920954；归档会到期，不能作为长期唯一备份。

后续任何生产线部署都应先核对当时最新完整站点，不能用单个旧分支重建整站而抹掉其他Mother入口。本线不修改main、gh-pages、Brick生产分支或其他Mother资产。公开页面和Git源文件分别核对，不能把仓库浏览地址当网页入口。

## 历史与恢复

[失败路线撤回及检讨](knowledge/REJECTED_MACROSCOPIC_R1_20260906.md)保留，历史暂停已由用户新授权解除，但被否决实现不改名重交。

[Clean 01原始交付定位](knowledge/clean-01-20260906/DELIVERY.md)保留，其原件仍按记录中的附件与校验值定位。[V0.9.11](v0911/START_HERE.html)及[交付范围](v0911/DELIVERY_STATUS.md)是历史候选，不自动获得新批准。

[V0.9.10](v0910/START_HERE.html) SHA256 1d52c47f56c0b502b889650949b1e05ca98c34ea8b7ef960cac3d9cac33442e7；[V0.9.9](v099/START_HERE.html) SHA256 06ad8f86f16afe8a58dbc83b14d206c712c4f48902cf5f8ac29e2ea0fcd209db。用户对其瓦形与搭接的方向认可仍按原范围保留。

[V0.9.8身份](CURRENT_BASELINE.json)、[用户决定](v098/handoff/USER_DECISIONS.md)、[材质锁](v098/knowledge/MATERIAL_LOCK.json)、[恢复HTML](v098/START_HERE.html)保持。HTML SHA256 c8b8211f8d14512b2f29c067894be563e2710053b648b39427a87986bcf34c9b；[原全量包](releases/Tiles_Mother_V098_Full_Restart_Package_2026-09-05.zip) SHA256 9c9389243c25b4106c46733456e0f5807affa2d0b16e5bd5efbe85d822334e2c。CURRENT_BASELINE未改。

## 保持的规则与学习

三片、板瓦、筒瓦、木构、检查台和860片均保留；无木板或隐藏支承平面；圆椽在四道横梁上，相邻板瓦共享圆椽，筒瓦双侧落座。模板、尺寸、年份和损伤变化需要对依赖作相应验证，不能用材质遮盖穿透。仅改色彩避免全场景重建。缓存与新几何有明确上限，静止停绘。

已读小妈最新1fc23df1dd253d4785e05b19154cf443b4636ced中的FUNCTION_APPLICATION_MAP材质参考态及surface-and-volume-optics前82行。HOUSE #16真实回执5558358851，独立审阅仍待回复，不能代签。继续保留[小妈学习卡](knowledge/xiaoma-learning-r1/SKILL.md)、[边口诊断](knowledge/xiaoma-learning-r1/EDGE_FORM_REVIEW.md)、[失养与噪波研究](experiments/abandonment-noise-r1/README.md)。

讲武堂沿用jiangwutang-001；[原件重读及读图纠错](knowledge/jiangwutang-001/SOURCE_REACCESS_20260905.md)、两张线描及[v0910屋面照片回执](v0910/REFERENCE_RECEIPT.json)保留。原始大包和完整贴图不重复公开；筒瓦3cm壁厚等旧推断已经撤回。不可用远景照片推定实测苔厚、材料物性或所有旧宅的统一坍塌寿命。

开始时重新读取远端HEAD并正常快进，不强推、不改写历史。先读用户对Clean 02的具体反馈，未得到人工批准的质感和性能继续保持候选。
