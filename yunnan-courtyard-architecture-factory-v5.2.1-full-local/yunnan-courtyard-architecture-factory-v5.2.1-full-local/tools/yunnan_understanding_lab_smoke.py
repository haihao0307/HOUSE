#!/usr/bin/env python3
from __future__ import annotations

import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "data/qa/yunnan_understanding_lab_smoke_v5_4_4.json"
SCREEN = ROOT / "qa/screenshots/yunnan_understanding_lab_v5_4_4.png"

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
results: list[dict] = []
errors: list[str] = []

try:
    with sync_playwright() as p:
        executable = "/usr/bin/chromium" if Path("/usr/bin/chromium").exists() else None
        browser = p.chromium.launch(
            headless=False,
            executable_path=executable,
            args=[
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--no-sandbox",
            ],
        )
        page = browser.new_page(viewport={"width": 1800, "height": 1180}, device_scale_factor=1)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" and "Failed to load resource" not in msg.text else None)
        page.goto(
            f"http://127.0.0.1:{server.server_port}/yunnan-architecture-understanding-lab.html",
            wait_until="load",
            timeout=120000,
        )
        page.wait_for_function("window.__YN_UNDERSTANDING_LAB__ && window.__APP_READY__ === true", timeout=600000)
        page.wait_for_timeout(1500)
        stats = page.evaluate("window.__YN_UNDERSTANDING_LAB__.stats()")
        results.append({"name": "three real models loaded", "ok": stats["modelsLoaded"] == 3 and stats["modelsFailed"] == 0, "detail": stats})
        results.append({"name": "five workspaces", "ok": all(page.locator(f"#{sid}").count() == 1 for sid in ["evidenceSection", "roofRelationSection", "entrySection", "wallToolSection", "roofToolSection"])})
        results.append({"name": "seven independent roof units", "ok": stats["roofUnits"] >= 7, "detail": stats["roofUnits"]})
        page.evaluate("window.__YN_UNDERSTANDING_LAB__.setRoofMode('explode')")
        page.wait_for_timeout(200)
        results.append({"name": "roof exploded mode", "ok": page.evaluate("window.__YN_UNDERSTANDING_LAB__.stats().roofMode") == "explode"})
        page.evaluate("window.__YN_UNDERSTANDING_LAB__.setTourProgress(1)")
        page.wait_for_timeout(160)
        end_stats = page.evaluate("window.__YN_UNDERSTANDING_LAB__.stats()")
        results.append({"name": "entry route reaches upper floor", "ok": abs(end_stats["personFloor"] - 2.73) < 0.02, "detail": end_stats["personFloor"]})
        results.append({"name": "double flight stair baseline", "ok": "8 + 8" in page.locator("body").inner_text()})
        page.evaluate("window.__YN_UNDERSTANDING_LAB__.setWallPreset('wulong')")
        page.wait_for_timeout(160)
        results.append({"name": "wall preset switch", "ok": page.evaluate("window.__YN_UNDERSTANDING_LAB__.stats().wallPreset") == "wulong"})
        page.evaluate("window.__YN_UNDERSTANDING_LAB__.setTilePreset('dali')")
        page.wait_for_timeout(160)
        results.append({"name": "roof tile preset switch", "ok": page.evaluate("window.__YN_UNDERSTANDING_LAB__.stats().tilePreset") == "dali"})
        results.append({"name": "unresolved evidence displayed", "ok": end_stats["unresolved"] >= 5 and "unresolved" in page.locator("body").inner_text()})
        results.append({"name": "all model canvases visible", "ok": all(page.locator(f"#modelCanvas-{mid}").is_visible() for mid in ["dali", "wulong", "tuanjie"])})
        page.locator("#matrixSection").scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        SCREEN.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SCREEN), full_page=True)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

passed = sum(1 for item in results if item.get("ok"))
report = {
    "schemaVersion": "5.4.4",
    "title": "云南建筑构造理解与生成工具原型浏览器验收",
    "results": results,
    "errors": errors,
    "summary": {"passed": passed, "failed": len(results) - passed, "total": len(results)},
    "screenshot": "qa/screenshots/yunnan_understanding_lab_v5_4_4.png",
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report["summary"], ensure_ascii=False))
if errors or passed != len(results):
    raise SystemExit(1)
