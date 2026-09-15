#!/usr/bin/env python3
"""Verify exact file inventory, byte counts and SHA256 for this handoff."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "MANIFEST_SHA256.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    expected = {item["path"]: item for item in manifest["files"]}
    actual = {
        path.relative_to(ROOT).as_posix()
        for path in ROOT.rglob("*")
        if path.is_file() and path != MANIFEST_PATH
    }

    errors: list[str] = []
    missing = sorted(set(expected) - actual)
    extra = sorted(actual - set(expected))
    errors.extend(f"missing: {path}" for path in missing)
    errors.extend(f"extra: {path}" for path in extra)

    for relative, item in sorted(expected.items()):
        path = ROOT / relative
        if not path.is_file():
            continue
        size = path.stat().st_size
        digest = sha256(path)
        if size != item["bytes"]:
            errors.append(f"size: {relative}: expected {item['bytes']}, got {size}")
        if digest != item["sha256"]:
            errors.append(f"sha256: {relative}: expected {item['sha256']}, got {digest}")

    if errors:
        print("FAIL")
        for error in errors:
            print(error)
        return 1

    print(
        f"PASS: {len(expected)} files, "
        f"{sum(item['bytes'] for item in expected.values())} bytes, zero mismatches"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
