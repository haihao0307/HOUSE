param(
  [Parameter(Mandatory=$true)][string]$RepoUrl,
  [string]$CommitMessage = "Import Yunnan courtyard architecture factory V5.2.1"
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
python tools/validate.py
if (-not (Test-Path .git)) { git init }
git branch -M main
git add .
$hasChanges = -not [string]::IsNullOrWhiteSpace((git status --porcelain))
if ($hasChanges) { git commit -m $CommitMessage }
$origin = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) { git remote add origin $RepoUrl } elseif ($origin -ne $RepoUrl) { git remote set-url origin $RepoUrl }
git push -u origin main
