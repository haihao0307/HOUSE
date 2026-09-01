# 云南建筑总工作台 V0.1.0

所属：建筑蓝图与总体系。知识框架：V1。共同方法：Mother V1.0.0。

入口为 `architecture-workbench/index.html`，由专用的保留全站发布流程加入现有公开网站。整个目录可以由 `tools/build.py` 在精确源提交上重建。`file-manifest.json` 记录产物文件的哈希。

本版实现六个工作区：总览、建筑知识、案例资料、专业入口、共同方法与验收、资料与笔记。既有总装候选使用原 `threejs/YunnanCourtyardProduction.js` 及原材质与屋面文件，只新增观察适配器，不修改原模型算法、专业默认参数或冻结文件。这里显示的是旧总装研究候选，各新 Mother 尚未合装。

中性、工作室、法线诊断使用同一对象；灯组独立控制；剖切只影响渲染。对象真实几何、实例矩阵与材料源值的指纹用于检查灯光与相机切换的隔离性。所有尺寸继续保留旧候选来源，未获得新的实测认证。

接收的统一方法按十七节组织提要，§12.1 JSON 原值保持。规则原文件按固定哈希加载，领域记录与灯光设置使用独立的严格字段检查。本地保护器明确标记为工作台 V0.1.0，官方 Schema、上游校验器和原 MD 字节仍未取得；本版未宣称完整规范接入。

附件保存到独立的浏览器 IndexedDB，笔记保存到独立 localStorage。它们不写入其他工作台、不自动上传 GitHub、不触发生成参数更新。研究记录导出包含笔记及附件身份清单，不包含附件二进制。导入未知字段、错误版本或伪造批准会拒绝。旧工作台的状态管理未在本轮修改。

完整对象演化、形成历史、环境历史、过程标定与跨 Mother 状态交换仍未实现。界面无虚假的时间、湿度或年龄滑杆。人工视觉批准与生产批准继续为 false。

## 验证

`python tools/build.py --app-root <既有工程根目录>`

`python tools/browser_qa.py --site <完整站点目录> --output evidence/staged --expected-sha <精确提交>`

`python tools/browser_qa.py --url <公开入口> --output evidence/public --expected-sha <精确提交>`

测试输出浏览器日志、资源失败、桌面与手机证据、三模式像素、实际源指纹、严格导入和批准隔离结果。自动通过不会授予用户视觉批准。

## 发布边界

只覆盖公开站点的 `architecture-workbench/` 前缀，其他路径以逐文件 SHA256 验证不变。源分支保持 `feature/yunnan-component-studio-v1`，PR #13 保持 Draft。代码提交使用 skip-ci，避免触发旧的全站覆盖发布；专用 `preview/architecture-workbench-*` 预览分支引用的 create 事件仅触发本工作台校验和发布。该引用只标识研究预览，不代表正式版本批准。

不更改 main、gh-pages、Pages 设置、其他 Mother 源码、冻结资产或实测真值。部署前再次核对当前成功发布身份，变化时阻断，禁止覆盖并行成果。
