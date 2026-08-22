#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text("utf-8").strip()

REQUIRED = [
    "index.html", "404.html", ".nojekyll", "VERSION", "README.md", "PROJECT_STATE.md",
    "AGENTS.md", "data/system_v5_2_1.json", "data/interaction_renderer_route_v5_2_1.json",
    "data/qa/qa_report_v5_2_1.json", ".github/workflows/pages.yml"
]

errors: list[str] = []
warnings: list[str] = []

for rel in REQUIRED:
    if not (ROOT / rel).exists():
        errors.append(f"missing required file: {rel}")

html_path = ROOT / "index.html"
if html_path.exists():
    html = html_path.read_text("utf-8")
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    if not title or VERSION not in title.group(1):
        errors.append("HTML title does not contain current VERSION")
    script_sources = re.findall(r"<script[^>]+src=[\"']([^\"']+)", html, re.I)
    for source in script_sources:
        if re.match(r"^(?:https?:)?//", source, re.I) or source.startswith(("/", "file:")):
            errors.append(f"external script reference found: {source}")
            continue
        local_source = source.split("?", 1)[0].split("#", 1)[0]
        if not (ROOT / local_source).is_file():
            errors.append(f"local script reference is missing: {source}")
    if re.search(r"<link[^>]+rel=[\"']stylesheet", html, re.I):
        errors.append("external stylesheet reference found")
    urls = sorted(set(re.findall(r"https?://[^\"'<>\\s]+", html)))
    if urls:
        errors.append("external URL dependency found: " + ", ".join(urls[:5]))
    if "/mnt/data" in html or "file:///" in html:
        errors.append("container or local absolute path found in HTML")
    required_tokens = [
        "WebGL", "depth", "门窗自动演示", "人物入户上楼", "完整几何", "m3Cut"
    ]
    for token in required_tokens:
        if token not in html:
            errors.append(f"required runtime token missing: {token}")

json_count = 0
for p in sorted((ROOT / "data").rglob("*.json")):
    try:
        json.loads(p.read_text("utf-8"))
        json_count += 1
    except Exception as exc:
        errors.append(f"invalid JSON {p.relative_to(ROOT)}: {exc}")

qa_path = ROOT / "data/qa/qa_report_v5_2_1.json"
if qa_path.exists():
    qa = json.loads(qa_path.read_text("utf-8"))
    summary = qa.get("summary", {})
    if summary.get("failed") != 0 or summary.get("passed") != 24:
        warnings.append(f"QA summary differs from stable baseline: {summary}")

system_path = ROOT / "data/system_v5_2_1.json"
if system_path.exists():
    system = json.loads(system_path.read_text("utf-8"))
    if system.get("schemaVersion") != VERSION:
        errors.append("system schemaVersion does not match VERSION")
    contract = system.get("renderingContract", {})
    if not contract.get("depthBuffer"):
        errors.append("renderingContract.depthBuffer must be true")
    if contract.get("courtyardPresetChangesGeometry") is not False:
        errors.append("courtyard preset must not change geometry")

if (ROOT / "404.html").exists() and html_path.exists():
    if hashlib.sha256((ROOT / "404.html").read_bytes()).digest() != hashlib.sha256(html_path.read_bytes()).digest():
        warnings.append("404.html differs from index.html")

print(f"Version: {VERSION}")
print(f"JSON files parsed: {json_count}")
for warning in warnings:
    print(f"WARNING: {warning}")
if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(f"Validation failed with {len(errors)} error(s).", file=sys.stderr)
    raise SystemExit(1)
print("Validation passed.")
