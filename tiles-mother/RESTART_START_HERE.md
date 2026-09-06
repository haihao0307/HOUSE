# Tiles Mother 接续入口

## 2026-09-06 用户撤回：先检讨，暂停制作

Macroscopic microscope R1 已被用户明确否决。同路线的 field-core-r1 从当前分支移除，不再交付或作为接续基线。先读[撤回范围与检讨](knowledge/REJECTED_MACROSCOPIC_R1_20260906.md)。本地交付和远端候选身份不同，禁止混用其功能与测试结论。本轮只清理被否决路线，保留所有较早工作台和原始参考。未经用户再次指示，不继续生成新版。

以下V0.9.11仅为保留的历史候选，仍有用户指出的材质、苔藓、裂纹及性能问题。V0.9.9/V0.9.10中已有的瓦形和搭接方向认可继续按原范围记录，无新增视觉或生产批准。

最新保留候选：V0.9.11 共用噪波场、断口与厚苔。保留V0.9.10同画面性能版、V0.9.9边口材质版和V0.9.8恢复基线。仓库haihao0307/HOUSE，工作分支feature/tiles-mother-v0.1-workbench。

## 当前入口

先读[候选身份](CURRENT_CANDIDATE.json)、[实际交付与未完成边界](v0911/DELIVERY_STATUS.md)，打开[V0.9.11独立HTML](v0911/START_HERE.html)。[重建和模块说明](v0911/README.md)包含完整复现方法。

默认是断口样台，D为共用噪波材质；3/48/860和A/B/C均保留。真实浏览器19个案例、22组新断面几何、5个装配状态接触审计通过。三片材质软件WebGL同会话绘制区间323.674ms到179.664ms；最终860片计时未取得有效值，不外推用户GPU或风扇表现。完整运动性能门槛未通过，没有公网部署，人工视觉和生产批准false。

受力仅在样台采用简化梁/条带候选；屋面为受水与支承依赖的经验情景。十年为用户指导的严重失养目标，未标定普遍寿命。断口展开不代表刚体坠落；持续修缮按钮选择从初始一直维护的对照历史，中途维修事件账本尚未实现。不得把原型输出写成完整建筑倒塌或精确断裂力学。

## 保护和恢复

[V0.9.10](v0910/START_HERE.html)、[其真实结果](v0910/DELIVERY_STATUS.md)保持，HTML SHA256为1d52c47f56c0b502b889650949b1e05ca98c34ea8b7ef960cac3d9cac33442e7。[V0.9.9](v099/START_HERE.html)保持，SHA256为06ad8f86f16afe8a58dbc83b14d206c712c4f48902cf5f8ac29e2ea0fcd209db。

[V0.9.8身份](CURRENT_BASELINE.json)、[包内接续](v098/RESTART_START_HERE.md)、[用户决定](v098/handoff/USER_DECISIONS.md)、[缺口](v098/handoff/KNOWN_GAPS.md)、[材质锁](v098/knowledge/MATERIAL_LOCK.json)保持。[V0.9.8工作台](v098/START_HERE.html) SHA256为c8b8211f8d14512b2f29c067894be563e2710053b648b39427a87986bcf34c9b。[原全量包](releases/Tiles_Mother_V098_Full_Restart_Package_2026-09-05.zip) SHA256为9c9389243c25b4106c46733456e0f5807affa2d0b16e5bd5efbe85d822334e2c。CURRENT_BASELINE未改。

三片是主入口之一，48片和860片必须继续保留。无木板、望板或隐藏支承平面；共享圆椽在四根横梁上；板瓦双侧承托，筒瓦双侧落座；瓦片不得穿透。新断口与厚苔独立对照，微孔旧核心和观察光保留。不能用减少瓦数、偷偷改尺寸、换灯光掩盖形体或接触错误。

几何、年份、种子和维护情景变化需重新核算依赖；只改显示参数避免重算全场景。缓存有上限并释放无用资源；画面停止后停止绘制。新噪波层的频率、梯度、颜色空间和坐标附着分别验证，不能以函数名称或公式短推断GPU速度。

开始时重新读取远端HEAD，从最新正常历史继续。不强推、不改写历史，不修改main、gh-pages、Brick Mother或冻结资产。不得用transport的初始归档覆盖后来源文件。

## 学习和参照

继续读[小妈R1学习卡](knowledge/xiaoma-learning-r1/SKILL.md)、[边口专项](knowledge/xiaoma-learning-r1/EDGE_FORM_REVIEW.md)、[讲武堂重读和尺寸纠错](knowledge/jiangwutang-001/SOURCE_REACCESS_20260905.md)、[失养逻辑与噪波研究](experiments/abandonment-noise-r1/README.md)。小妈最新已读资料提交7a6197fa9fd770c6e19c191eb9b140f877837ecc；HOUSE #16咨询5556071710的独立回复仍需实际回读，不能自签协作完成。

讲武堂精细包沿用jiangwutang-001，仅作参考和未完成细节对照；原始大包/FBX/完整贴图不重复入Git或运行时。两张线描分别登记，筒瓦3cm壁厚等旧推断已经撤回，不把不同来源尺寸混成同一测绘对象。屋面照片定位在[v0910参考回执](v0910/REFERENCE_RECEIPT.json)，不由远景测苔厚或推断物种。

暂停期间只核对已有成果与失败原因，不执行旧记录中的下一轮制作计划。保留全部恢复版本；所有既有未完成项和失败门槛继续如实记录。
