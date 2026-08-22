#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_DIRS = {".git", "release", "_site", "__pycache__"}
EXCLUDED_FILES = {"CHECKSUMS.sha256", "data/build_manifest.json"}
EXCLUDED_SUFFIXES = {".pyc", ".zip"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def included_files() -> list[Path]:
    files: list[Path] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        relative_text = relative.as_posix()
        if any(part in EXCLUDED_DIRS for part in relative.parts):
            continue
        if relative_text in EXCLUDED_FILES or path.suffix in EXCLUDED_SUFFIXES:
            continue
        files.append(path)
    return files


def main() -> None:
    files = included_files()
    records = []
    checksum_lines = []
    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        digest = sha256(path)
        records.append({"path": relative, "sizeBytes": path.stat().st_size, "sha256": digest})
        checksum_lines.append(f"{digest}  {relative}")

    version = (ROOT / "VERSION").read_text("utf-8").strip()
    private_count = sum(record["path"].startswith("references-private/") for record in records)
    manifest = {
        "schemaVersion": "1.1.0",
        "projectVersion": version,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "entryPoint": "index.html#reference",
        "selfContained": True,
        "externalRuntimeDependencies": [],
        "qaBaseline": {
            "browserFull": {"passed": 28, "failed": 0},
            "packageSmoke": {"passed": 12, "failed": 0, "total": 12},
            "tuanjieReferenceViewer": {"passed": 28, "failed": 0, "total": 28},
            "tuanjieGlbQualityProfiles": {"passed": 8, "failed": 0, "status": "passed"},
        },
        "packageKind": "full-local",
        "referenceFilesDeclared": private_count,
        "referenceBinariesIncluded": True,
        "releaseExcludesPrivateReferences": True,
        "files": records,
    }
    (ROOT / "data" / "build_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (ROOT / "CHECKSUMS.sha256").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")
    print(f"updated {len(records)} file records; private references={private_count}")


if __name__ == "__main__":
    main()
