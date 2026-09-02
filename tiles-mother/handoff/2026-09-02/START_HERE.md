# Tiles Mother 全量交接包启动入口

交接日期：2026-09-02

生产线：Tiles Mother

仓库：`haihao0307/HOUSE`

唯一工作分支：`feature/tiles-mother-v0.1-workbench`

本目录用于把当前 Tiles Mother 生产线完整移交到新的对话或新的执行环境。解压 GitHub Release 中的全量包后，从本文件开始读取。

## 1. 首次读取顺序

依次读取：

1. `START_HERE.md`
2. `TILES_MOTHER_MASTER_HANDOFF_2026-09-02.md`
3. `NEW_CHAT_BOOTSTRAP.md`
4. `HANDOFF_CONTRACT.json`
5. 包根目录的 `PACKAGE_STATE.json`
6. `../../AGENTS.md`
7. `../../knowledge/jiangwutang-001/review.md`
8. `../../knowledge/jiangwutang-001/material-candidate-v0.5.json`
9. `../../v05/build-manifest.json`
10. `../../v05/profile.js`
11. `../../v05/geometry-operators.js`
12. `../../v05/roof-joints.js`
13. `../../v05/integration.js`
14. `../../v05/test_core.cjs`
15. `../../qa-v05/v05-candidate-receipt.json`
16. `../../qa-v05/public-browser-report.json`

包根目录的 `PACKAGE_STATE.json` 保存实际打包提交 SHA、分支、文件数量、字节数和批准状态。该文件由 GitHub Actions 在打包时生成，优先级高于静态文档中的起始基线。

## 2. 当前权威基线

本次打包触发前远端 HEAD：

`24569631df06f1507e7ec325c05cb7806cbc7d81`

该提交记录 V0.5 公开浏览器证据。全量包工作流和本交接目录会形成一个新的正常追加提交，实际包来源以 `PACKAGE_STATE.json.sourceCommit` 为准。

禁止强推、改写历史、修改 `main`、修改 `release/brick-mother-v1.0`、修改 Brick Mother 工作分支、修改其他 Mother 生产线或覆盖既有 Pages 资产。

## 3. 包含内容

全量包包含：

1. 完整 `tiles-mother/` 目录。
2. Tiles Mother 全部 GitHub Actions 工作流。
3. 当前自包含在线网页源文件。
4. V0.1 至 V0.5 的可读源码、构建器和回退版本。
5. 讲武堂瓦片轻量知识、参数、来源身份和分析记录。
6. 本地与公开浏览器 QA 报告及截图证据。
7. 新工作流启动说明、状态合同和 SHA256 文件清单。

讲武堂原始 ZIP、原始 FBX、完整 7000 像素 Diffuse 和完整 Normal 未装入交接包。它们没有成为运行时依赖。原始资料身份和已完成分析保存在知识记录中。

## 4. 打开网页

自包含入口：

`repository/tiles-mother/index.html`

可直接打开，也可在包内 `repository/` 目录运行：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://127.0.0.1:8000/tiles-mother/
```

稳定公开入口：

`https://haihao0307.github.io/HOUSE/tiles-mother/`

公开页面是否与新提交一致，需要以对应工作流的 HTTP 回读和真实浏览器报告确认。

## 5. 当前阶段

当前版本为 V0.5 研究候选。已经具备板瓦、筒瓦、实体厚度、独立边缘环、28 瓦屋面试验板、三类展示模式、确定性历史回放、独立种子和资料工作台。

当前批准状态：

```text
visualApproved=false
productionApproved=false
distillationComplete=false
```

自动 QA 成功不会改变人工视觉批准状态。

## 6. 新一轮首要任务

下一轮沿 V0.5 正常推进到 V0.6，优先处理：

1. 根据最终位移几何重新计算法线与切线。
2. 重建背面和四段边缘的连续坐标、法线和断面材质。
3. 让几何、屋面排布、接触、灯光和时间全部读取同一份校验 Profile。
4. 使用真实背面几何完成筒瓦座接、穿插、支承区、间隙和排水通道诊断。
5. 将排数、朝向、遮挡、汇水、檐口位置和盖缝关系接入瓦片级时间演化。
6. 继续对照讲武堂参考，增强手工成型高低变化、刮抹、拍打、局部塌陷、粗糙边缘和多尺度表面关系。

不得通过深阴影、过强对比、统一撒点或单层噪波掩盖几何与材质问题。
