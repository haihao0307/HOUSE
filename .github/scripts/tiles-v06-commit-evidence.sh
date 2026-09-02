#!/usr/bin/env bash
set -euo pipefail
BRANCH=feature/tiles-mother-v0.1-workbench
test "$(git ls-remote origin refs/heads/$BRANCH | cut -f1)" = "$GITHUB_SHA"
mkdir -p tiles-mother/qa-v06 tiles-mother/v06
cp /tmp/tm-v06/candidate/tiles-mother/index.html tiles-mother/index.html
cp /tmp/tm-v06/candidate/tiles-mother/v06/build-manifest.json tiles-mother/v06/build-manifest.json
cp /tmp/tm-v06/local-qa/core-report.json tiles-mother/qa-v06/core-report.json
cp /tmp/tm-v06/local-qa/browser-report.json tiles-mother/qa-v06/browser-report.json
cp /tmp/tm-v06/public-qa/browser-report.json tiles-mother/qa-v06/public-browser-report.json
cp /tmp/tm-v06/publication.json tiles-mother/qa-v06/publication.json
cp /tmp/tm-v06/site-preservation.json tiles-mother/qa-v06/site-preservation.json
for name in roof-studio-v06.jpg roof-raking-v06.jpg side-edge-v06.jpg contact-v06.jpg drainage-v06.jpg trio-v06.jpg mobile-v06.jpg; do
  test -s "/tmp/tm-v06/local-qa/$name"
  cp "/tmp/tm-v06/local-qa/$name" "tiles-mother/qa-v06/$name"
done
shopt -s nullglob
parts=(tiles-mother/v06/bootstrap-v06.tar.gz.b64.part-*)
if test "${#parts[@]}" -gt 0; then git rm "${parts[@]}"; fi
git add \
  tiles-mother/index.html tiles-mother/README.md \
  tiles-mother/v06 tiles-mother/qa-v06 \
  tiles-mother/knowledge/jiangwutang-001/material-candidate-v0.6.json \
  tiles-mother/knowledge/jiangwutang-001/review.md \
  .github/scripts/tiles-v06-overlay.py \
  .github/scripts/tiles-v06-readback.py \
  .github/scripts/tiles-v06-commit-evidence.sh \
  .github/workflows/tiles-mother-v06-publish.yml
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
if ! git diff --cached --quiet; then
  git commit -m 'test(tiles-mother): publish V0.6 workbench and evidence'
  git push origin HEAD:refs/heads/$BRANCH
fi
