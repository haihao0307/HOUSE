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
    "assets/css/surface-production-lab.css", "threejs/YunnanBaselineV544.js",
    "threejs/v544/YunnanCourtyardProduction.js", "threejs/v544/YunnanMaterialFactory.js",
    "threejs/YunnanSurfaceProfiles.js",
    "threejs/YunnanWallSurfaceSystem.js", "threejs/YunnanRoofSurfaceSystem.js",
    "threejs/YunnanCourtyardProduction.js", "threejs/YunnanMaterialFactory.js",
    "tools/surface_production_smoke.py",
    "data/production/yunnan_surface_weathering_seed_v5_5_0.json",
    "data/production/roof_tile_knowledge_v5_4_2.json",
    "vendor/three/three.module.js", "vendor/three/controls/OrbitControls.js", "vendor/three/LICENSE"
]

VENDOR_SHA256 = {
    "vendor/three/three.module.js": "ec3ddc3897ec75288b5502057456c471c2eb7d6e7cf36140d0a5224e94a1984b",
    "vendor/three/controls/OrbitControls.js": "f260591ef315aa04888152e7f121865214e33fb54727145cf4e4445058db1297",
    "vendor/three/LICENSE": "4c40a1ef62450b857c3b2aaf294936304cd552d965fbcd9d32d4c5bcf4ba4454",
}

FROZEN_V544_GIT_BLOBS = {
    "threejs/v544/YunnanCourtyardProduction.js": "7b254beeffde1325329101b50784e694249081bd",
    "threejs/v544/YunnanMaterialFactory.js": "0bcf25b39ebf65047b2f4628ce4ee9306395aa45",
}

errors: list[str] = []
warnings: list[str] = []

for rel in REQUIRED:
    if not (ROOT / rel).exists():
        errors.append(f"missing required file: {rel}")

for rel, expected_sha256 in VENDOR_SHA256.items():
    path = ROOT / rel
    if not path.is_file():
        continue
    actual_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual_sha256 != expected_sha256:
        errors.append(f"vendored Three.js integrity mismatch for {rel}: {actual_sha256}")

for rel, expected_blob_sha in FROZEN_V544_GIT_BLOBS.items():
    path = ROOT / rel
    if not path.is_file():
        continue
    payload = path.read_bytes()
    header = f"blob {len(payload)}\0".encode("ascii")
    actual_blob_sha = hashlib.sha1(header + payload).hexdigest()
    if actual_blob_sha != expected_blob_sha:
        errors.append(f"frozen V5.4.4 Git blob mismatch for {rel}: {actual_blob_sha}")

vendor_license = ROOT / "vendor/three/LICENSE"
if vendor_license.is_file():
    license_text = vendor_license.read_text("utf-8")
    if "MIT License" not in license_text or "three.js authors" not in license_text:
        errors.append("vendored Three.js LICENSE does not contain the expected MIT attribution")

vendor_module = ROOT / "vendor/three/three.module.js"
if vendor_module.is_file() and "const REVISION = '162';" not in vendor_module.read_text("utf-8")[:1024]:
    errors.append("vendored Three.js version is not the pinned r162 release")

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

surface_script = ROOT / "assets/js/surface-production-lab.js"
if surface_script.is_file():
    surface_source = surface_script.read_text("utf-8")
    for token in [
        "live-instance-matrices-buffer-geometry-and-world-bounds",
        "live-wall-mesh-world-bounds",
        "live-actor-position-route-polyline-wall-aabbs-and-walkable-aabbs",
        "live-geometry-v1",
    ]:
        if token not in surface_source:
            errors.append(f"surface runtime evidence contract missing: {token}")

github_sync = ROOT / "assets/js/github-sync.js"
if github_sync.is_file():
    sync_source = github_sync.read_text("utf-8")
    declared_sync_versions = set(re.findall(r"schemaVersion:\s*['\"]([^'\"]+)['\"]", sync_source))
    if declared_sync_versions != {VERSION}:
        errors.append(f"GitHub sync schema versions {sorted(declared_sync_versions)} do not match VERSION {VERSION}")
    if "5.4.2" in sync_source:
        errors.append("GitHub sync bridge still contains the obsolete 5.4.2 schema")
    if "yunnan_surface_weathering_seed_v5_5_0.json" not in sync_source:
        errors.append("GitHub sync bridge does not expose the V5.5.0 surface seed")

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
