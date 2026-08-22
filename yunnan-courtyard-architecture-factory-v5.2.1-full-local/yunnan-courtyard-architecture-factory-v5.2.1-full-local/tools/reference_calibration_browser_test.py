#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "data/qa/reference_calibration_browser_v5_4_3.json"
SCREEN = ROOT / "qa/screenshots/v543-reference-study/calibrated_building_comparison.png"

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


SCREEN.parent.mkdir(parents=True, exist_ok=True)
REPORT.parent.mkdir(parents=True, exist_ok=True)
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
results: list[dict] = []
errors: list[str] = []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 1600, "height": 980}, device_scale_factor=1)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(
            f"http://127.0.0.1:{server.server_port}/threejs/yunnan-reference-calibration-demo.html",
            wait_until="load",
            timeout=120000,
        )
        page.wait_for_function("window.__YUNNAN_REFERENCE_CALIBRATION_TEST__?.calibrated", timeout=180000)
        page.wait_for_timeout(1800)
        stats = page.evaluate("window.__YUNNAN_REFERENCE_CALIBRATION_TEST__.stats()")
        results.extend([
            {"name": "two comparison canvases", "ok": page.locator("canvas").count() == 2},
            {"name": "baseline geometry", "ok": stats["base"]["meshCount"] > 100 and stats["base"]["triangleCount"] > 1000},
            {"name": "calibrated geometry", "ok": stats["calibrated"]["meshCount"] > 100 and stats["calibrated"]["triangleCount"] > 1000},
            {"name": "roof units calibrated", "ok": stats["calibration"]["roofUnitCount"] >= 4, "detail": stats["calibration"]},
            {"name": "walls calibrated", "ok": stats["calibration"]["wallCount"] >= 4},
            {"name": "evidence boundary", "ok": "unresolved" in json.dumps(stats["calibration"], ensure_ascii=False)},
        ])
        page.screenshot(path=str(SCREEN), full_page=False)
        results.append({"name": "comparison screenshot", "ok": SCREEN.exists() and SCREEN.stat().st_size > 20000, "detail": hashlib.sha256(SCREEN.read_bytes()).hexdigest() if SCREEN.exists() else None})
        browser.close()
finally:
    server.shutdown()
    server.server_close()

passed = sum(1 for item in results if item.get("ok"))
report = {
    "schemaVersion": "5.4.3",
    "recordId": "YN-REFERENCE-CALIBRATION-BROWSER-QA-001",
    "status": "pass" if not errors and passed == len(results) else "fail",
    "results": results,
    "errors": errors,
    "summary": {"passed": passed, "failed": len(results) - passed, "total": len(results)},
    "screenshot": str(SCREEN.relative_to(ROOT)).replace("\\", "/"),
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report["summary"], ensure_ascii=False))
if report["status"] != "pass":
    raise SystemExit(1)
