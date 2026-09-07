# 复核方法

本次下载 GitHub Actions run 33952333895 的 artifact 9965243741，校验外层 ZIP 后解出全量包。内层完整包的 SHA256 与 CURRENT.json、PERSISTENCE_RECEIPT.json 相同；以 Git blob 头加文件字节计算 SHA1，也与仓库 packages 目录返回的 blob SHA 相同。

原全量包只读保留。先执行原包 tools/verify_package.py，49个 MANIFEST 条目均通过，再将全包复制到隔离工作目录。

在工作副本内执行：

```sh
CHROMIUM_EXECUTABLE=/usr/bin/chromium xvfb-run -a python tools/restart_check.py
```

本次 Chromium 的 file URL 导航受运行环境策略阻止。脚本明确记录 ERR_BLOCKED_BY_ADMINISTRATOR，随后把同一 HTML 原字节加载到浏览器 DOM 完成检查。它没有验证用户设备的 file URL 策略，也没有验证公网部署。

26道工序各抽查12%、50%、92%，共78个状态；成屋路线按0.5秒间隔抽查125个时刻，覆盖0至62秒。楼梯检查6项通过。页面异常、警告、失败资源和外部资源请求均为零。两个移动视口为390×844、430×932，均无水平溢出。

新生成 stage_checks.json、walk_trace.json、component_graph.json 与冻结包内对应数据逐字节一致，指纹保存于 verification.json；没有重复上传这三份相同数据。

本轮没有修改 HTML、材质、声音、人物动画、冻结 ZIP 或施工阶段。重建得到的 HTML 仍为 bdd566b7c1817a21c9fc136e23b53adaa1c018adaa6e4aa25a43ef292aaedae9。
