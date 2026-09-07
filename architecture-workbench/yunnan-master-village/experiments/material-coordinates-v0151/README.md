# 小李 V0.15.1：木纹坐标有限实验

日期：2026-09-05。接续 HOUSE / feature/yunnan-component-studio-v1 / PR #13。
本实验基于 4f9c35f095863d9d6fe09fb86288298efd5b9d87 的 V0.15.0 冻结归档。根目录 CURRENT.json 继续保持 V0.15.0。本目录提供可复现源码和接收回执，不替代建筑测量、历史或视觉批准。

## 已完成的当前样本修正

原材质统一把局部 Y 当木材长轴。梁生成器沿 Y 制作构件，该约定保留；箱形木踏步按当前局部尺寸的明确长轴设置材质坐标候选。14 级踏步、梯顶板和长桌共 16 个注册构件改变木纹坐标。41 个近方形注册木件方向未定，维持原表现。

新增面板“小妈方法试验 · V0.15.1”，默认收起。A 恢复原材质，B 使用顺构件木纹，C 显式启用独立粗糙度试验，另有端面诊断和 JSON 导出。默认 B。没有改变顶点位置、尺寸、轴网、光照、构件图、工序或动作。几何属性增加了材质轴与稳定种子，不能把这些候选参数当作 SU 实测值。

## 如何恢复工作台

从仓库根目录运行：

```sh
python architecture-workbench/yunnan-master-village/experiments/material-coordinates-v0151/src/build_v0151.py architecture-workbench/yunnan-master-village/versions/v0.15.0/Yunnan_Master_and_Village_V0.15.0.html /tmp/Yunnan_Master_and_Village_V0.15.1.html
```

输出是自带 Three.js 的单文件 HTML，没有外部网络资源。生成脚本拒绝不同基线指纹，拒绝覆盖冻结 HTML。生成结果须为 1497417 bytes，SHA-256 为 0978fd5c669f9008a68ee76ae49f7f18a64bb69f914e5ac85b4dafb201f1feb1。

V0.15.0 HTML 指纹：bdd566b7c1817a21c9fc136e23b53adaa1c018adaa6e4aa25a43ef292aaedae9。
原全量 ZIP 指纹：cd3a438708152182fd9ff457f6a0a53c35fbff620ce1cbd72ed18be74571989a，9927426 bytes。原包 51 个文件中的 49 个清单条目复核通过。

## 新鲜复核结果

qa/SUMMARY.json 是本次结果摘要。交付包包含完整 report.json、78 个施工状态采样、125 个通行采样、946 个构件记录及 7 张浏览器截图。原版与实验版都重新运行，未复用旧报告充当本轮实测。

78 个施工状态、125 个通行采样、946 个构件记录和 6 项楼梯检查均与原版一致。23 项材质轴、输入校验和种子检查通过。同相机和中性光下切回 A 后截图像素一致。390×844 与 430×932 视口的控件在屏内且无横向溢出；桌面和这两个视口未记录浏览器错误或警告。

环境为 Chromium headed / Xvfb / SwiftShader，通过 set_content 加载完整 HTML。没有实测物理手机、Houdini、UE、原 SKP 或公网网站；未作本轮 FPS 验收。上述有限采样不构成施工安全或历史真实性认证。

安装 Playwright Python 包、Pillow、Chromium 和 Xvfb 后，可在本目录运行：

```sh
xvfb-run -a python qa/verify_v0151.py ../../versions/v0.15.0/Yunnan_Master_and_Village_V0.15.0.html /tmp/Yunnan_Master_and_Village_V0.15.1.html /tmp/xiaoli-v0151-fresh-qa
```

Chromium 默认 /usr/bin/chromium，可用 CHROMIUM_EXECUTABLE 环境变量设置。测试输出必须放在工作副本，禁止覆盖冻结证据。

## 小妈方法如何进入这条生产线

knowledge/SKILL.md 保留读取范围、来源 Git blob、采用规则、接口、反例和未执行项。实际运行接口为 YKY.materialBridge。Houdini 的属性与局部坐标、分层材质、UE 的材质和照明分离方法已用于这次有限实验；跨对象与跨引擎推广仍需新证据。

## 尚未完成与不变边界

建筑主任务仍是核准 SU 原件的单位、实例变换和隐藏几何，再校核楼梯、耳房轴位与净高。完整院落和瓦作尚未完成。材料坐标实验不改变这些完成状态。

measurementTruthApproved、constructionTruthApproved、historicReconstructionApproved、visualApproved、productionApproved 均为 false。PR #13 保持 open、Draft、未合并；仅允许本分支正常追加。GitHub 源码归档与公网部署独立，public_site_deployed=false。
