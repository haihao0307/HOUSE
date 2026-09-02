# 本地运行

## Windows

双击 `START_LOCAL_WINDOWS.bat`。脚本会启动本地服务器并打开浏览器。

PowerShell 也可以运行：

```powershell
./START_LOCAL_WINDOWS.ps1
```

## macOS 或 Linux

```bash
chmod +x start_local_mac_linux.sh
./start_local_mac_linux.sh
```

## 手动运行

```bash
python tools/serve.py --port 8080
```

浏览器打开 `http://127.0.0.1:8080/`。

## 常见问题

页面空白时先打开浏览器开发者工具，确认 WebGL 是否可用。硬件加速被关闭时，页面会尝试 Canvas 回退，显示效果和性能会降低。

端口被占用时：

```bash
python tools/serve.py --port 8090
```
