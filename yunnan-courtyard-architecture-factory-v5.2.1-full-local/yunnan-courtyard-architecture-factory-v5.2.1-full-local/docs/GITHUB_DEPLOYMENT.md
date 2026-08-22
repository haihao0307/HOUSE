# GitHub 上传与 Pages 部署

## 准备仓库

在 GitHub 新建空仓库。不要勾选自动生成 README，避免首次推送冲突。

## PowerShell 推送

```powershell
./PUSH_TO_GITHUB.ps1 -RepoUrl "https://github.com/你的账号/你的仓库.git"
```

## Bash 推送

```bash
./push_to_github.sh "https://github.com/你的账号/你的仓库.git"
```

## GitHub Pages

1. 打开仓库 Settings。
2. 进入 Pages。
3. Source 选择 GitHub Actions。
4. 推送到 `main`。
5. 打开 Actions，等待 `Deploy GitHub Pages` 完成。

工作流先运行 `tools/validate.py`，然后只把 `index.html`、`404.html` 和 `.nojekyll` 放入 Pages 发布产物。

## 更新版本

修改代码后运行：

```bash
python tools/validate.py
python tools/browser_smoke_test.py
python tools/make_release.py
```

再提交并推送。
