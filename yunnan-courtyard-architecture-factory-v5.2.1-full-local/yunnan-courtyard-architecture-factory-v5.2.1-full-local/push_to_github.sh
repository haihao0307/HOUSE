#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -lt 1 ]; then
  echo "Usage: ./push_to_github.sh https://github.com/USER/REPO.git"
  exit 2
fi
REPO_URL="$1"
cd "$(dirname "$0")"
python3 tools/validate.py
[ -d .git ] || git init
git branch -M main
git add .
if [ -n "$(git status --porcelain)" ]; then
  git commit -m "Import Yunnan courtyard architecture factory V5.2.1"
fi
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi
git push -u origin main
