#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: ./scripts/publish-github.sh <repository-git-url> [branch]" >&2
  exit 2
fi

REPOSITORY_URL="$1"
BRANCH="${2:-main}"
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

command -v git >/dev/null 2>&1 || { echo "Git is required." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Node.js and npm are required." >&2; exit 1; }

npm run validate

[ -d .git ] || git init
git branch -M "$BRANCH"
if git remote | grep -qx origin; then
  git remote set-url origin "$REPOSITORY_URL"
else
  git remote add origin "$REPOSITORY_URL"
fi

git add -A
if ! git diff --cached --quiet; then
  git commit -m "Publish Yunnan timber procedural skill v0.4.0"
else
  echo "No new file changes to commit."
fi

git push -u origin "$BRANCH"
