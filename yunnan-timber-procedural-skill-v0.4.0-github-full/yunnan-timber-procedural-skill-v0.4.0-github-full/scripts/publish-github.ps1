param(
  [Parameter(Mandatory = $true)]
  [string]$RepositoryUrl,
  [string]$Branch = "main",
  [string]$CommitMessage = "Publish Yunnan timber procedural skill v0.4.0"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed or is not available in PATH."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Node.js and npm are required to run validation before publishing."
}

npm run validate

if (-not (Test-Path ".git")) {
  git init
}

git branch -M $Branch
$originExists = (git remote) -contains "origin"
if ($originExists) {
  git remote set-url origin $RepositoryUrl
} else {
  git remote add origin $RepositoryUrl
}

git add -A
$changes = git status --porcelain
if ($changes) {
  git commit -m $CommitMessage
} else {
  Write-Host "No new file changes to commit."
}

git push -u origin $Branch
