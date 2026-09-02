#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "assets/models/YN_TUANJIE_001_EDITABLE.glb"
REPORT = ROOT / "data/qa/reference_model_lab_smoke.json"
SCREEN = ROOT / "qa/screenshots/reference_model_lab_smoke.png"

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright is not installed")
    raise SystemExit(2)

if sys.platform.startswith("linux") and not os.environ.get("DISPLAY"):
    print("Run this test under xvfb-run")
    raise SystemExit(2)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
results = []
errors = []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--no-sandbox",
            ],
        )
        page = browser.new_page(viewport={"width": 1500, "height": 980}, device_scale_factor=1)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(
            f"http://127.0.0.1:{server.server_port}/reference-model-lab.html",
            wait_until="load",
            timeout=120000,
        )
        page.wait_for_function("!!window.__REFERENCE_MODEL_LAB__", timeout=120000)
        results.append({"name": "page title", "ok": "参考模型实验室" in page.title()})
        results.append({"name": "dual canvases", "ok": page.locator("canvas").count() == 2})
        results.append({"name": "dual file slots", "ok": page.locator("#inputA").count() == 1 and page.locator("#inputB").count() == 1})
        results.append({"name": "persistent picker", "ok": page.locator("#pickPersistent").count() == 1})
        results.append({"name": "drop zone", "ok": page.locator("#dropzone").count() == 1})

        page.locator("#inputA").set_input_files(str(MODEL))
        page.wait_for_function("window.__REFERENCE_MODEL_LAB__.stats().A && window.__REFERENCE_MODEL_LAB__.state.A.viewer.loaded === true", timeout=180000)
        page.locator("#inputB").set_input_files(str(MODEL))
        page.wait_for_function("window.__REFERENCE_MODEL_LAB__.stats().B && window.__REFERENCE_MODEL_LAB__.state.B.viewer.loaded === true", timeout=180000)
        stats = page.evaluate("window.__REFERENCE_MODEL_LAB__.stats()")
        viewer_a = page.evaluate("window.__REFERENCE_MODEL_LAB__.state.A.viewer.stats()")
        viewer_b = page.evaluate("window.__REFERENCE_MODEL_LAB__.state.B.viewer.stats()")

        for slot in ("A", "B"):
            model = stats[slot]
            results.append({"name": f"{slot} sha256", "ok": len(model.get("sha256", "")) == 64})
            results.append({"name": f"{slot} structure", "ok": model.get("meshCount", 0) > 0 and model.get("primitiveCount", 0) > 0})
            results.append({"name": f"{slot} privacy", "ok": model.get("rawModelIncluded") is False and model.get("localPathIncluded") is False})
            results.append({"name": f"{slot} knowledge boundary", "ok": bool(model.get("knowledgeBoundary", {}).get("locked"))})

        results.append({"name": "A WebGL geometry", "ok": viewer_a.get("triangles", 0) > 1000 and viewer_a.get("primitives", 0) > 0})
        results.append({"name": "B WebGL geometry", "ok": viewer_b.get("triangles", 0) > 1000 and viewer_b.get("primitives", 0) > 0})
        results.append({"name": "analysis UI", "ok": "墙面候选" in page.locator("#infoA").inner_text() and "瓦顶候选" in page.locator("#infoB").inner_text()})
        page.screenshot(path=str(SCREEN), full_page=True)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

passed = sum(1 for item in results if item.get("ok"))
report = {
    "schemaVersion": "1.0.0",
    "page": "reference-model-lab.html",
    "results": results,
    "errors": errors,
    "summary": {"passed": passed, "failed": len(results) - passed, "total": len(results)},
    "screenshot": "qa/screenshots/reference_model_lab_smoke.png",
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
SCREEN.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report["summary"], ensure_ascii=False))
if errors or passed != len(results):
    raise SystemExit(1)
