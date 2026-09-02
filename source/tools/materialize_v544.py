#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = ROOT / "tools" / "v544_payload"

TARGETS = {
    "page": (
        "yunnan-architecture-understanding-lab.html",
        "13e24881facac6292601789665680d950b9350d2b93dba1903b9f8dcb39a22d5",
    ),
    "contract": (
        "data/production/yunnan_wall_roof_entry_tool_contract_v5_4_4.json",
        "b2669a104253f301add51548200ede151d6e52e2f0bb0ef0dc6e07df273f24a4",
    ),
    "smoke": (
        "tools/yunnan_understanding_lab_smoke.py",
        "7aeb727cdd2fa46459bcdb243cb4008c0ba5c037f5a5d1a9e83e88176fa32809",
    ),
    "hub": (
        "folk-building-production-line.html",
        "b62d45e1870dc669c76badc53f554d858aca16e8f5d106a667824c53204f5a23",
    ),
}


def restore(name: str, target: str, expected_sha256: str) -> None:
    parts = sorted(PAYLOAD.glob(f"{name}.*.b64"))
    if not parts:
        raise SystemExit(f"missing payload for {name}")
    encoded = "".join(part.read_text(encoding="utf-8").split() for part in parts)
    raw = gzip.decompress(base64.b64decode(encoded))
    digest = hashlib.sha256(raw).hexdigest()
    if digest != expected_sha256:
        raise SystemExit(
            f"sha256 mismatch for {name}: expected {expected_sha256}, got {digest}"
        )
    output = ROOT / target
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(raw)
    print(f"materialized {target} ({len(raw)} bytes, {digest})")


def main() -> None:
    for name, (target, digest) in TARGETS.items():
        restore(name, target, digest)


if __name__ == "__main__":
    main()
