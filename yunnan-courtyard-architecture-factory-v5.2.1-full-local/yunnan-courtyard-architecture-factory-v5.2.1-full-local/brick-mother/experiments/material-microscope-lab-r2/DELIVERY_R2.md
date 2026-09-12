# Brick Mother R2 已交付

2026-09-12。本轮完成烧结砖显微控制实验，不扩展为其他材料族或最终砖体形状验收。

## 固定公网入口

[Brick Mother · 显微材质 R2](https://rawcdn.githack.com/haihao0307/HOUSE/29d0b0cfe207b9e26eae0e7b8aba3d29eee2921b/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/experiments/material-microscope-lab-r2/Brick_Material_Microscope_Lab_R2.html)

- 发布提交：29d0b0cfe207b9e26eae0e7b8aba3d29eee2921b。
- 接续分支：codex/brick-microscope-r2-20260912。
- HTML SHA256：03e791eb301546f747de22f848a011d58dcf967f7c6f00bea4b77ebc1a11de96。
- 保留原固定 R1 提交 201fb2c22eaa31d3783bbf35d4294c33eb1bcc81 及用户原始完整交接包。

## 完成内容

四项实时滑杆：显微强度、尺度、高度贡献、粗糙度贡献。统一显微场驱动两种贡献，保留既有形成遮罩。对照双方均为 B/Process，基准固定，调参默认增强预设；支持恢复 R1、显微 OFF/ON、相机复位和四种诊断模式。桌面左右对照、手机上下对照。静止时不持续重绘。

新增目录位于原仓库 brick-mother/experiments/material-microscope-lab-r2。没有修改历史 R1、毛石、土坯和其他族 DNA，没有合并既有草稿 PR。撤销工具未读取或恢复。

## 实际验收

本地与上述固定公网 URL 均已通过真实 Chrome/WebGL2 的 29 项检查，console/page error 列表为空。公网运行进行了实际滑杆操作、四诊断模式切换、OFF/ON 对照、相机拖动与复位、键盘操作、390×844 窄屏布局及 WebGL 缺失提示检查。桌面截图尺寸 1440×1000。已人工查看本次公网渲染的桌面与手机截图。

数值对照结果：高度变化的平均像素差 4.2608/255；粗糙度变化 1.6549/255；显微强度对两通道的差分别约 6.3908 与 3.3088；尺度对两通道约 10.5306 与 5.4567。高度/粗糙度独立性和形成遮罩不变检查为零差异。Beauty 的 OFF/零强度和相机复位均在 0.01/255 容差内；两侧 Beauty 基准在 0.02/255 容差内。极小差异与真实渲染数值波动相容，不把它误报成严格逐像素相等。

证据：qa-r2/public-report.json、qa-r2/local-report.json、qa-r2 下各模式截图，以及可复跑的 qa_r2.py。浏览器使用 SwiftShader，此结果不等同于所有手机实机的 GPU 性能验收。Codex 内嵌浏览器另一次打开尝试超时；公网验收依据已成功的独立 Chrome 实际运行，不依据该超时尝试。

humanVisualApproved=false，productionApproved=false。默认增强参数仅为实验预设。材质是否达到用户目标以及后续砖体边缘/破损形状，仍未宣称获用户认可。

## 接续

当前可交互版本为 R2；后续调整必须另发固定提交版本。以原完整包加本次 R2 源码、验收证据及两份共同规则接续，历史交接中的暂停段落须结合用户随后明确要求继续本轮的指令理解。不宣称其他责任线清理完成。
