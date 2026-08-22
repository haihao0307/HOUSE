#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text("utf-8").strip()
RELEASE = ROOT / "release"
RELEASE.mkdir(exist_ok=True)
OUT = RELEASE / f"yunnan-courtyard-architecture-factory-v{VERSION}-github-ready.zip"

EXCLUDE_DIRS = {".git", "release", "references-private", "_site", "__pycache__"}
EXCLUDE_SUFFIXES = {".pyc", ".zip", ".tar.gz"}

files = []
for p in sorted(ROOT.rglob("*")):
    if not p.is_file():
        continue
    rel = p.relative_to(ROOT)
    if any(part in EXCLUDE_DIRS for part in rel.parts):
        continue
    if p.suffix in EXCLUDE_SUFFIXES:
        continue
    files.append(p)

with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for p in files:
        zf.write(p, Path(f"yunnan-courtyard-architecture-factory-v{VERSION}") / p.relative_to(ROOT))

sha = hashlib.sha256(OUT.read_bytes()).hexdigest()
metadata = {"version": VERSION, "createdAt": datetime.now(timezone.utc).isoformat(), "archive": OUT.name, "sizeBytes": OUT.stat().st_size, "sha256": sha, "fileCount": len(files)}
(OUT.with_suffix(OUT.suffix + ".json")).write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(OUT)
print(sha)
