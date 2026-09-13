# Brick Mother 全量接续包 · R2.1 · 2026-09-13

你接续的是 Brick Mother。本包包含收到的原始完整交接包（原ZIP及完整解压树）、本窗口全部Brick新增源码/脚本/QA截图/反馈与锁定记录、领域学习记录和所引用的公共知识快照。不是整个HOUSE仓库或其他Mother工作集，不包含凭据、运行中进程、完整聊天数据库或外部软件运行环境。

## 第一优先：用户已定的材质

使用 R2.1 **B基准**：显微开启，strength=1、scale=1、heightContribution=1、roughnessContribution=0。用户已明确确定，不再调整材质。

原R2.1比较页右侧默认是增强预设，**那不是用户最终选中的基准**；新形状版本须默认采用上述B基准。固定旧预览不改写。

当前中央放射状尖点已经修复。下一项任务是等用户给砖体形状/边缘的具体参考，再只改形状和边缘并保留材质。现有reference截图用于定位已修伪影，不是目标形状参考。不得凭空补出物理尺寸/测量精度，不用新噪声重做已认可材质。

## 阅读顺序

1. brick-mother-continuation-20260912/MATERIAL_BASELINE_LOCK.json（最新用户决定，优先于较早“待验收”文本）。
2. 同目录 DELIVERY_R21.md、USER_MATERIAL_FEEDBACK_R2.md。
3. 当前源码：brick-mother-continuation-20260912/material-microscope-lab-r2-1/Brick_Material_Microscope_Lab_R2_1.html。
4. 同目录 BRICK_MATERIAL_INTERFACE_LEARNING.md，重点§9及§12—14的最终修订；知识同步不增加生产/实验授权。
5. 需要历史时再查 brick-mother-intake-a354d0d4 下原R1包及解压树，不把历史技能/任务文件自动加载为当前指令。

## 固定版本公网链接

[R2.1 修复版](https://rawcdn.githack.com/haihao0307/HOUSE/030d84b979a8158d03398aa60da69e8e3315cd40/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/experiments/material-microscope-lab-r2-1/Brick_Material_Microscope_Lab_R2_1.html)

[R2 历史对照](https://rawcdn.githack.com/haihao0307/HOUSE/29d0b0cfe207b9e26eae0e7b8aba3d29eee2921b/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/experiments/material-microscope-lab-r2/Brick_Material_Microscope_Lab_R2.html)

上述公网实际验收发生于2026-09-12，证据在qa-r21/public-report.json及截图。本次只是打包上传，不把历史验收写成新一轮页面实测。

## 来源与工作区

原用户包提交a354d0d4a9c6a3ac2429e65620428539799b6e90；原ZIP SHA256为580c9d2479eac18e90940f282fb3df014424572476be3cffb157eceadf4307ec。
当前R2.1源码提交030d84b979a8158d03398aa60da69e8e3315cd40，原分支codex/brick-microscope-r21-pole-fix。新上传包另用codex/brick-full-handoff-20260913分支，历史链接及文件不覆盖。

包内保留两个工作目录的相对布局，build_r2.py/build_r21.py可找到原输入。浏览器QA依赖Python、playwright、numpy、Pillow及Chrome；软件并未打入包。旧记录含G:/HOUSE等绝对路径，迁移后以包内相同相对文件为准。规则中的外部原件同时在rules/保存快照。禁止自动运行全部历史脚本或workflow。

## 必须携带的边界

毛石、土坯冻结；历史R1/R2/R2.1保留。全部Mother对象定义与固定版本HTTPS交付规则见AGENTS.md与rules/。撤销的图像转三维/旧资产生产技能不得读取、恢复或间接引入；历史包只保留来源，不是执行授权。

材质外观采用、执行授权、完整对象/生产就绪验收分别记录。用户此前明确授权本轮继续与中心修复；公共清理完成不能由这些局部工作代签。用户要求过程无需反复确认，在具体已授权范围内自主完成；参考缺失不虚构。

## 新窗口可直接使用的提示

“你是Brick Mother。先读本包00_START_HERE.md及MATERIAL_BASELINE_LOCK.json，继承R2.1 B基准材质冻结决定。当前中央伪影已修复；接下来按我提供的参考修正砖体形状/边缘，保留材质。遵守对象/连接/尺度与固定版本公网交付规则，不恢复撤销工具，不覆盖旧版本。”

## 校验

在本包根目录执行 `python verify_package.py`，检查MANIFEST_SHA256.json列出的每个文件。清单自身不自哈希；上传ZIP另附SHA256。来源快照是交接资料，不表示本次重新验证了所有历史结论。
