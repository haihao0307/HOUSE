# Tiles Mother 接续入口

最新可审阅候选：V0.9.10 同画面性能工作台。受保护的上一候选：V0.9.9 边口与材质学习版。恢复基线：V0.9.8 Contact Rafter Beams。仓库haihao0307/HOUSE，工作分支feature/tiles-mother-v0.1-workbench。

## 当前工作入口

先读[候选身份](CURRENT_CANDIDATE.json)、[V0.9.10实测结果与未过门槛](v0910/DELIVERY_STATUS.md)，打开[V0.9.10独立HTML](v0910/START_HERE.html)。从[v0910/README.md](v0910/README.md)了解重建和方法来源。

本轮同机浏览器860片首次CPU工作35.199s到14.640s；四组新旧有效几何、接触和画布逐像素一致；最近两个完整屋面复用；静止6秒无新绘制或帧轮询。单帧着色仍重，运动性能门槛未过；用户设备风扇、GPU与Windows双击没有直接测量。无Pages或其他公网部署。完整证据在v0910/qa/browser/REPORT.json和qa/NODE_BENCH.json。

用户对V0.9.9的瓦形和搭接给出接近完工的方向认可，要求优先性能，再细化厚苔层、木断口和下层木构腐朽。按范围记录，不产生全系统批准。visualApproved=false，productionApproved=false。

## 保留与恢复

[V0.9.9工作台](v099/START_HERE.html)与[原交付边界](v099/DELIVERY_STATUS.md)保留，HTML SHA256为06ad8f86f16afe8a58dbc83b14d206c712c4f48902cf5f8ac29e2ea0fcd209db。

[V0.9.8身份](CURRENT_BASELINE.json)、[包内接续](v098/RESTART_START_HERE.md)、[重建说明](v098/README.md)、[用户规则](v098/handoff/USER_DECISIONS.md)、[缺口](v098/handoff/KNOWN_GAPS.md)、[材质锁](v098/knowledge/MATERIAL_LOCK.json)、[历史QA](v098/qa/release-refresh/REPORT.json)继续有效。

[V0.9.8工作台](v098/START_HERE.html) SHA256为c8b8211f8d14512b2f29c067894be563e2710053b648b39427a87986bcf34c9b。[原全量包](releases/Tiles_Mother_V098_Full_Restart_Package_2026-09-05.zip) SHA256为9c9389243c25b4106c46733456e0f5807affa2d0b16e5bd5efbe85d822334e2c。CURRENT_BASELINE和这些资产未变。

## 不得丢失

保留三片独立瓦、48片构造台、860片屋面及A/B/C。本轮未降低瓦片数、网格细分、渲染分辨率或关闭原有阴影。材质核心、微孔细节、观察光、边口几何和木构演化块逐字节保持。新表面层独立对照；整片偏色概率与单片色斑面积分开。

无木板、望板或隐藏承托平面；圆椽在四根横梁之上；相邻板瓦共享圆椽；筒瓦双侧落座；不得穿透。改变几何、年份、seed或维护状态需重新核算，静止/灯光切换不得误重建全屋面。缓存必须有上限并释放无用资源，不能将少量缓冲减少概括为总内存降低。

新改动先小样逐面检查瓦、木构和断口的UV、法线、落座、穿透，再扩展到48与860片。青苔目前为颜色层，厚度几何未完成；木断面与下层横梁病害还需细化。完整结构求解、碎片刚体堆积和地方寿命标定仍未完成。

开始时重读远端HEAD，从最新正常历史继续。不强推、不改写历史、不修改main、gh-pages、Brick Mother或冻结资产。V0.9.2不恢复为当前入口。

## 学习与参考

读取[小妈R1学习卡](knowledge/xiaoma-learning-r1/SKILL.md)、[边口诊断](knowledge/xiaoma-learning-r1/EDGE_FORM_REVIEW.md)和[讲武堂原件重读及读图纠错](knowledge/jiangwutang-001/SOURCE_REACCESS_20260905.md)。小妈教材固定提交b1f01bae975c4151539bc38d84644b8542c70c29，HOUSE #16留实际回执，小妈/House独立复核不能代签。

讲武堂精细ZIP沿用jiangwutang-001，仍保留作未完成的细节对照；原始大文件不重复入Git或网页。两张线描分别登记，筒瓦3cm壁厚等旧推断已撤回。新屋面照片身份在[v0910/REFERENCE_RECEIPT.json](v0910/REFERENCE_RECEIPT.json)，用于整体灰度和风化节奏，不由远景照片推定苔藓物种或实测厚度。
