#!/usr/bin/env python3
"""Reproduce and verify the V0.3 workbench from the frozen V0.2 commit.

The HTML patch is intentionally small and reviewable. The build uses only the
repository's frozen V0.2 HTML plus first-party V0.3 source; it never needs the
original FBX, PNGs or ZIP. The generated HTML is written to a caller-provided
temporary path so a duplicate multi-megabyte artifact is not committed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path


BASE_COMMIT = "b6a9d0be3acdf3d9f5a633acec12fcf7cc2e32c1"
INDEX_PATH = "tiles-mother/index.html"
FORBIDDEN_RUNTIME_REFERENCES = (
    "讲武堂瓦片精细.zip",
    "01.fbx",
    "01_u1_v1_diffuse.png",
    "01_u1_v1_normal.png",
)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob(commit: str, path: str) -> bytes:
    return subprocess.check_output(["git", "show", f"{commit}:{path}"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    repo = args.repo.resolve()
    patch_path = repo / "tiles-mother/v03/j1-index.patch"
    generator_path = repo / "tiles-mother/v03/jiangwutang-material.js"
    config_path = repo / "tiles-mother/knowledge/jiangwutang-001/material-candidate-v0.3.json"
    for path in (patch_path, generator_path, config_path, args.candidate):
        if not path.is_file():
            raise SystemExit(f"missing build input: {path}")

    base = git_blob(BASE_COMMIT, INDEX_PATH)
    with tempfile.TemporaryDirectory(prefix="tiles-mother-v03-build-") as temp_name:
        temp = Path(temp_name)
        target = temp / INDEX_PATH
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(base)
        subprocess.run(
            ["git", "apply", "--no-index", "--unsafe-paths", "--directory", str(temp), str(patch_path)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        generated = target.read_bytes().replace(b"\r\n", b"\n")

    text = generated.decode("utf-8")
    required_markers = (
        "const VERSION='0.3.0';",
        "v03/jiangwutang-material.js",
        "jiangwutang-v03",
        "legacy-v02",
        "materialPreset",
    )
    missing = [marker for marker in required_markers if marker not in text]
    if missing:
        raise SystemExit(f"generated V0.3 is missing markers: {missing}")
    forbidden = [marker for marker in FORBIDDEN_RUNTIME_REFERENCES if marker in text]
    if forbidden:
        raise SystemExit(f"raw source leaked into runtime HTML: {forbidden}")
    candidate = args.candidate.read_bytes().replace(b"\r\n", b"\n")
    if candidate != generated:
        raise SystemExit(
            "candidate HTML differs from the deterministic V0.3 build; "
            "run this script with --out and inspect the diff"
        )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(generated)
    manifest = {
        "schema": "tiles-mother-v03-build-manifest",
        "version": "0.3.0",
        "baseCommit": BASE_COMMIT,
        "baseIndexSHA256": sha256_bytes(base),
        "patchSHA256": sha256_bytes(patch_path.read_bytes()),
        "indexPath": INDEX_PATH,
        "indexSHA256": sha256_bytes(generated),
        "bytes": len(generated),
        "generatorPath": "tiles-mother/v03/jiangwutang-material.js",
        "generatorSHA256": sha256_bytes(generator_path.read_bytes()),
        "configPath": "tiles-mother/knowledge/jiangwutang-001/material-candidate-v0.3.json",
        "configSHA256": sha256_bytes(config_path.read_bytes()),
        "runtimeSourceDependencies": ["first-party V0.3 generator only"],
        "rawSourceInRuntime": False,
        "completeLargeTexturesInRuntime": False,
        "visualApproved": False,
        "productionApproved": False,
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
