# GitHub 提交与 Pages 发布

## 提交仓库

1. 解压完整包。
2. 将包内文件放到 GitHub 仓库根目录。
3. 确认根目录存在 `index.html`、`README.md` 和 `.github/workflows/pages.yml`。
4. 提交并推送到 `main` 分支。

示例命令：

```bash
git init
git add .
git commit -m "Add Yunnan timber procedural skill v0.4.0"
git branch -M main
git remote add origin YOUR_REPOSITORY_GIT_URL
git push -u origin main
```

已有仓库时，从 `git add .` 开始执行即可。

## 一键辅助脚本

Windows PowerShell：

```powershell
.\scripts\publish-github.ps1 -RepositoryUrl "YOUR_REPOSITORY_GIT_URL"
```

macOS 或 Linux：

```bash
./scripts/publish-github.sh YOUR_REPOSITORY_GIT_URL
```

两个脚本都会先执行 `npm run validate`。验证失败时会停止推送。仓库已有 `origin` 时，脚本会把它更新为传入的地址。

## 开启 GitHub Pages

进入仓库 Settings，打开 Pages，把发布源选择为 GitHub Actions。

推送完成后，进入 Actions 查看 `Deploy Yunnan Timber Skill to GitHub Pages`。发布成功后，Pages 页面会显示访问地址。

## 页面入口

GitHub Pages 使用仓库根目录的 `index.html`。该文件与 `preview-standalone.html` 内容一致，网页运行时不请求 CDN、图片纹理或第三方脚本。

## 常见检查

页面空白时，先检查浏览器是否支持 WebGL2，再查看开发者工具控制台。

工作流未启动时，检查默认分支名称是否为 `main`，并确认 Pages 发布源已选择 GitHub Actions。

材质集成到建筑主项目时，圆柱必须传入：

```json
{
  "profile": "round",
  "geometryLengthAxis": [0, 1, 0],
  "radialAxisHint": [1, 0, 0]
}
```

矩形梁通常传入：

```json
{
  "profile": "rectangular",
  "geometryLengthAxis": [1, 0, 0],
  "radialAxisHint": [0, 1, 0]
}
```
