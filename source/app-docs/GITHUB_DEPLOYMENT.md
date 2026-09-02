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
4. 正式发布推送到 `main`；PR #11 的 Draft 预览推送到 `codex/yunnan-surface-production-v5.5.0`。
5. 打开 Actions，等待 `Deploy Yunnan Courtyard Production Line` 完成。

工作流发布完整静态运行包，包括 Surface Lab、脚本、数据、Three.js vendor 和三份网页模型。私有参考、release 目录与仅供本地选择的高精度团结乡主档不会进入 Pages；`build.json` 记录实际 SHA、ref、run ID 与 run attempt。

`main` 使用 `github-pages` 环境，Draft 分支使用现有的 `github-pages-preview` 环境。预览路径不提交或写入 `main`/`gh-pages`，也不请求修改保护规则。部署后公开 QA 必须从部署动作返回的真实 URL 读取 `build.json` 和 `surface-production-lab.html`，并操作 A/B、相机、七层爆炸、预设、门窗和人物控件；控制台错误、pageerror、失败请求、HTTP 4xx/5xx、SHA 不一致、任一阶段失败或跳过均使 workflow 失败。JSON 与全部截图按 SHA/run attempt 上传为独立 artifact。

## 更新版本

修改代码后运行：

```bash
python tools/validate.py
node --check assets/js/surface-production-lab.js
node --check threejs/YunnanCourtyardProduction.js
node --check threejs/YunnanMaterialFactory.js
node --check threejs/YunnanRoofSurfaceSystem.js
node --check threejs/YunnanWallSurfaceSystem.js
python tools/surface_production_smoke.py
python tools/browser_smoke_test.py
python tools/make_release.py
git diff --check origin/main...HEAD
```

再提交并推送。
