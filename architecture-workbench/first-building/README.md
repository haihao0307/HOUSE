# 首栋建筑预审 V0.2.0

本轮先完成证据、尺寸控制和错误拦截，不发布假定的历史复原房屋。

## 事实与推导分开

记录来源：工程 data/cases/yunnan_three_bay_front_gallery_two_storey_v5_3_0.json，SHA256 a43782f7914067c6f04cfa1411daf5cc1cead977d8a46e352f91fd9085dbaff7。保留原记录全部字段，包含地域未定、现状改造、原建功能未确定及瓦作锁定状态。

本轮独立推导：面阔尺寸链11.53米、进深尺寸链7.92米的算术闭合；四个面阔轴点和三个间隔的对应。上述闭合不证明原始测量准确。

发现的口径问题：galleryClearDepth的1.87米与A、B轴线相减相同。缺少柱径、净距端点及原图，本轮不把二者视作相同含义。屋脊标高记录7.04米，但脊线平面位置缺失，不假定居中。

源注册表列出的四张原图按字节和哈希核对；当前缺失的文件明确为待取得，不继承旧measuredDrawingAvailable的可用声明。当前功能含卫生间及客房，不能赋予1940年代原状。来源登记为用户提供的二手图，取得后还须核验图纸出处。

## 实际旧错误回归

从原YunnanCourtyardProduction.js运行读取真实北墙顶点和主屋面基层三角形，世界坐标均为米。独立通过平面重心坐标求交获得屋面下包络。顶点采样检查的适用前提是该墙预期止于该屋面之下；结果不等于完整碰撞或承载验证，有证据的高墙应采用其他边界规则。

25项自测含错误注入和未知处理。查错器通过、源记录内部闭合、原件已验证、历史身份可靠、建筑完整、用户视觉批准分别记录。

## 执行

运行 node architecture-workbench/first-building/run-audit.mjs <工程根目录>。构建使用 python architecture-workbench/tools/build_first.py --app-root <工程根目录> --repository-root <仓库>。页面源码和实测资料分开，页面只显示图形控制线与标高辅助；红墙场景仅作为明确选择的旧失败样本。

浏览器测试 first-building/browser_qa.py 支持 --site 或 --url，记录实际运行路径和桌面、移动两套结果。旧工作台在 workspace.html，以原58项测试另行回归。

共同Mother V1.0.0 JSON保持原值。官方Schema和校验器尚未取得；本轮未声称完整演化运行时接入。所有批准为false。
