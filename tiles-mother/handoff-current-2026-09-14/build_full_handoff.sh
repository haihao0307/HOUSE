#!/usr/bin/env bash
set -euo pipefail
PKG="Tiles_Mother_Current_Full_Handoff_R2_08B_2026-09-14"
ROOT="_handoff/$PKG"
OUT="tiles-mother/distributions/${PKG}.zip"
RECEIPT="tiles-mother/distributions/${PKG}.receipt.json"
rm -rf _handoff
mkdir -p "$ROOT/project/current-08B" "$ROOT/project/baseline-08A" "$ROOT/project/frozen-07" "$ROOT/knowledge" "$ROOT/rules" "$ROOT/qa" "$(dirname "$OUT")"

cp tiles-mother/handoff-current-2026-09-14/00_START_HERE.md "$ROOT/00_START_HERE.md"
cp tiles-mother/handoff-current-2026-09-14/PACKAGE_SCOPE.json "$ROOT/PACKAGE_SCOPE.json"
cp tiles-mother/handoff-current-2026-09-14/MICROSCOPE_USER_TEACHING_CORE_01_02.md "$ROOT/knowledge/MICROSCOPE_USER_TEACHING_CORE_01_02.md"
cp tiles-mother/r2-closeout-08a-micro-tune/CURRENT_SURFACE_CANDIDATE.json "$ROOT/CURRENT_SURFACE_CANDIDATE.json"
cp tiles-mother/JIANGWUTANG_SOURCE_RECEIPT.json "$ROOT/knowledge/JIANGWUTANG_SOURCE_RECEIPT.json"
cp tiles-mother/AGENTS.md "$ROOT/rules/TILES_AGENTS.md"
cp tiles-mother/knowledge/REJECTED_MACROSCOPIC_R1_20260906.md "$ROOT/knowledge/REJECTED_MACROSCOPIC_R1_20260906.md"
cp -a tiles-mother/knowledge/jiangwutang-001 "$ROOT/knowledge/"
cp -a tiles-mother/r2-closeout-08b-microscope/. "$ROOT/project/current-08B/"
cp tiles-mother/r2-closeout-08a-micro-tune/START_HERE.html "$ROOT/project/baseline-08A/START_HERE.html"
cp -a tiles-mother/r2-closeout-08a-micro-tune/microscope-core-staging "$ROOT/project/baseline-08A/"
cp tiles-mother/r2-closeout-07-detail/START_HERE.html "$ROOT/project/frozen-07/START_HERE.html"
cp .github/workflows/tiles-microscope-08b.yml "$ROOT/qa/tiles-microscope-08b.yml"
cp tiles-mother/r2-closeout-08b-microscope/BUILD_QA.json "$ROOT/qa/BUILD_QA.json"
cp tiles-mother/CURRENT_FULL_HANDOFF.md "$ROOT/rules/CURRENT_FULL_HANDOFF.md"

SOURCE_COMMIT="${GITHUB_SHA:-$(git rev-parse HEAD)}"
cat > "$ROOT/SOURCE_LOCK.json" <<EOF
{
  "package": "$PKG",
  "repository": "haihao0307/HOUSE",
  "branch": "feature/tiles-mother-r2-closeout-08a-micro-tune",
  "packageBuildSourceCommit": "$SOURCE_COMMIT",
  "lastVerified08BCommit": "21bad87fffd654b1aaddee74af67e7cac6750a5d",
  "baseline08ACommit": "0adcadc4f070cec1560fae51b06b9ef8b419940c",
  "parent07Commit": "dcf4053f69efc031174b7c41bd41e2309dfb13ec",
  "visualApproved": false,
  "productionApproved": false,
  "currentTask": "08C only: preserve macro shape, dimensions and seating; let Microscope affect real tile-surface and edge micro-shape; make Jiangwutang-informed PBR color richness a separate control; no invented patterns or new workbench."
}
EOF

find "$ROOT" -type f ! -name SHA256SUMS.txt -printf '%P\n' | LC_ALL=C sort > "$ROOT/PACKAGE_CONTENTS.txt"
(cd "$ROOT" && find . -type f ! -name SHA256SUMS.txt -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > SHA256SUMS.txt)
(cd "$ROOT" && sha256sum -c SHA256SUMS.txt)
rm -f "$OUT" "$RECEIPT"
(cd _handoff && zip -9 -r "../$OUT" "$PKG" >/dev/null)
unzip -t "$OUT"

required=(
  "$PKG/00_START_HERE.md"
  "$PKG/SOURCE_LOCK.json"
  "$PKG/CURRENT_SURFACE_CANDIDATE.json"
  "$PKG/project/current-08B/START_HERE.html"
  "$PKG/project/current-08B/build.py"
  "$PKG/project/current-08B/microscope-surface.glsl"
  "$PKG/project/current-08B/tile-pbr.glsl"
  "$PKG/project/current-08B/microscope-controls.html"
  "$PKG/project/current-08B/microscope-controls.js"
  "$PKG/project/current-08B/BUILD_QA.json"
  "$PKG/project/baseline-08A/START_HERE.html"
  "$PKG/project/frozen-07/START_HERE.html"
  "$PKG/knowledge/JIANGWUTANG_SOURCE_RECEIPT.json"
  "$PKG/knowledge/MICROSCOPE_USER_TEACHING_CORE_01_02.md"
  "$PKG/rules/TILES_AGENTS.md"
  "$PKG/SHA256SUMS.txt"
)
for f in "${required[@]}"; do unzip -Z1 "$OUT" | grep -Fx "$f" >/dev/null || { echo "missing $f"; exit 1; }; done

PACKAGE_SHA256=$(sha256sum "$OUT" | cut -d' ' -f1)
PACKAGE_BYTES=$(stat -c%s "$OUT")
PACKAGE_FILES=$(find "$ROOT" -type f | wc -l)
cat > "$RECEIPT" <<EOF
{
  "package": "${PKG}.zip",
  "repository": "haihao0307/HOUSE",
  "branch": "feature/tiles-mother-r2-closeout-08a-micro-tune",
  "buildSourceCommit": "$SOURCE_COMMIT",
  "bytes": $PACKAGE_BYTES,
  "sha256": "$PACKAGE_SHA256",
  "packageFileCount": $PACKAGE_FILES,
  "zipIntegrity": "passed",
  "internalSHA256": "passed",
  "requiredFiles": "passed",
  "rawJiangwutangSourceIncluded": false,
  "lastVerified08BCommit": "21bad87fffd654b1aaddee74af67e7cac6750a5d",
  "visualApproved": false,
  "productionApproved": false
}
EOF
printf 'PACKAGE_SHA256=%s\nPACKAGE_BYTES=%s\nPACKAGE_FILES=%s\n' "$PACKAGE_SHA256" "$PACKAGE_BYTES" "$PACKAGE_FILES" > _handoff/package.env
cat _handoff/package.env
