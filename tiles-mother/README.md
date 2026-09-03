# Tiles Mother V0.9.1

本包保存云南传统陶瓦程序化生产线当前完整可重启状态。

## 核心内容

- 12 块板瓦与 16 块筒瓦组成的 28 瓦三维屋面样方
- 板瓦纵向搭接、筒瓦纵向搭接、筒瓦左右座接与排水关系
- 正面、背面、檐口、屋脊端和左右侧边的实体闭合拓扑
- 单面、不透明、深度写入的 PBR 陶瓦材质
- 烧制色差、孔窝、鼓泡塌陷、刮抹、颗粒、微法线、粗糙度和百年演化
- 0 至 150 年的建筑历史时间尺度
- 屋面、局部座接、单瓦与三件变体观察模式
- 桌面和移动端响应式界面

## 运行

直接打开 `workbench/index.html`。

某些浏览器限制本地文件运行时，可以在包根目录启动：

```bash
python3 -m http.server 8000
```

随后访问：

```text
http://127.0.0.1:8000/workbench/
```

## 重建

```bash
python3 tools/build.py
```

## 验证

```bash
node tools/release_core.cjs
```

浏览器 QA 脚本依赖 Python Playwright、Chromium 和可用的 WebGL2 环境。

## 交付原则

Tiles Mother 后续的主要视觉成果始终为可操作的三维 HTML。单张图片不能替代工作台交付。
