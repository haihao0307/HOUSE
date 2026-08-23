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
    "data/qa/qa_report_v5_2_1.json", ".github/workflows/pages.yml",
    "surface-production-lab.html", "assets/js/surface-production-lab.js",
    "assets/css/surface-production-lab.css", "threejs/YunnanSurfaceProfiles.js",
    "threejs/YunnanWallSurfaceSystem.js", "threejs/YunnanRoofSurfaceSystem.js",
    "threejs/YunnanCourtyardProduction.js", "threejs/YunnanMaterialFactory.js",
    "tools/surface_production_smoke.py",
    "data/production/yunnan_surface_weathering_seed_v5_5_0.json",
    "data/production/roof_tile_knowledge_v5_4_2.json",
    "vendor/three/three.module.js", "vendor/three/controls/OrbitControls.js", "vendor/three/LICENSE"
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

surface_path = ROOT / "surface-production-lab.html"
if surface_path.exists():
    surface_html = surface_path.read_text("utf-8")
    if VERSION not in surface_html:
        errors.append("surface-production-lab.html does not contain current VERSION")
    for source in re.findall(r"<(?:script|link)[^>]+(?:src|href)=[\"']([^\"']+)", surface_html, re.I):
        if source.startswith(("data:", "#")):
            continue
        if re.match(r"^(?:https?:)?//", source, re.I) or source.startswith(("/", "file:")):
            errors.append(f"surface lab external dependency found: {source}")
            continue
        local_source = source.split("?", 1)[0].split("#", 1)[0]
        if not (ROOT / local_source).is_file():
            errors.append(f"surface lab local dependency is missing: {source}")
    if re.search(r"https?://", re.search(r"<script type=[\"']importmap[\"']>(.*?)</script>", surface_html, re.S | re.I).group(1) if "importmap" in surface_html else ""):
        errors.append("surface lab import map contains an external URL")
    for token in [
        '"three": "./vendor/three/three.module.js"',
        '"three/addons/": "./vendor/three/"',
        "板瓦筒瓦近景", "屋面爆炸分层", "墙面近景", "门窗人物楼梯",
    ]:
        if token not in surface_html:
            errors.append(f"surface lab required token missing: {token}")

seed_path = ROOT / "data/production/yunnan_surface_weathering_seed_v5_5_0.json"
if seed_path.exists():
    seed = json.loads(seed_path.read_text("utf-8"))
    for inherited in seed.get("inherits", []):
        if not (ROOT / inherited).is_file():
            errors.append(f"surface seed inherited contract is missing: {inherited}")
    roof_units = seed.get("roofUnitSchema", {}).get("requiredUnits", [])
    if len(roof_units) != 7 or len(set(roof_units)) != 7:
        errors.append("surface seed must define seven unique roof units")
    build_up = seed.get("roofUnitSchema", {}).get("visibleBuildUp", [])
    if len(build_up) != 7 or len(set(build_up)) != 7:
        errors.append("surface seed must define seven unique visible roof layers")
    if len(seed.get("roofSurfaceSchema", {}).get("presets", {})) != 3:
        errors.append("surface seed must define three roof presets")
    if len(seed.get("wallSurfaceSchema", {}).get("presets", {})) != 3:
        errors.append("surface seed must define three wall presets")

production_line = ROOT / "folk-building-production-line.html"
if production_line.exists() and 'href="surface-production-lab.html"' not in production_line.read_text("utf-8"):
    errors.append("folk production line does not link to surface-production-lab.html")

if system_path.exists():
    title = system.get("title", "")
    if VERSION not in title:
        errors.append("system title does not contain current VERSION")
    visitor_sequence = json.dumps(system.get("visitorSequence", system), ensure_ascii=False)
    if "单跑木梯" in visitor_sequence or "8+8" not in visitor_sequence:
        errors.append("system visitor route is not updated to the 8+8 double-flight stair")

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
