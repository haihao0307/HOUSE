#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "data/qa/yunnan_threejs_production_system_browser_smoke_v5_4_0.json"
SCREEN = ROOT / "qa/screenshots/v540_yunnan_production_preview.png"


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
        executable = None
        for candidate in [
            os.environ.get("CHROME_PATH"),
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        ]:
            if candidate and Path(candidate).exists():
                executable = candidate
                break
        browser = p.chromium.launch(
            headless=False,
            executable_path=executable,
            args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(f"http://127.0.0.1:{server.server_port}/threejs/yunnan-courtyard-production-demo.html", wait_until="load", timeout=120000)
        page.wait_for_function("window.__YUNNAN_PRODUCTION_TEST__ && window.__YUNNAN_PRODUCTION_TEST__.stats.meshCount > 0", timeout=120000)
        page.wait_for_timeout(1200)
        stats = page.evaluate("window.__YUNNAN_PRODUCTION_TEST__.stats")
        results.append({"name": "prototype loaded", "ok": stats.get("meshCount", 0) >= 50, "detail": stats})
        results.append({"name": "editable layer groups", "ok": page.locator("[data-layer]").count() == 5})
        tile_count = page.evaluate("(() => { let n = 0; window.__YUNNAN_PRODUCTION_TEST__.model.traverse(o => { if (o.userData?.type === '板瓦-pan-tile' || o.userData?.type === '筒瓦-cover-tile') n += 1; }); return n; })()")
        results.append({"name": "tile units are discrete", "ok": tile_count > 100, "detail": {"tileCount": tile_count}})
        page.locator('[data-layer="roof-tiles"]').click()
        page.wait_for_timeout(150)
        results.append({"name": "roof layer toggles", "ok": page.evaluate("window.__YUNNAN_PRODUCTION_TEST__.model.children.find(x => x.userData.layer === 'roof-tiles').visible") is False})
        page.locator('[data-layer="roof-tiles"]').click()
        page.locator("#humanView").click()
        page.wait_for_timeout(150)
        results.append({"name": "human view control", "ok": page.locator("#toast").inner_text() == "已切换到入口人的视角"})
        page.locator("#resetView").click()
        page.wait_for_timeout(150)
        results.append({"name": "reset view control", "ok": page.locator("#toast").inner_text() == "视角已复位"})
        page.screenshot(path=str(SCREEN), full_page=False)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

passed = sum(1 for result in results if result.get("ok"))
report = {
    "schemaVersion": "5.4.0",
    "recordId": "YN-THREEJS-PRODUCTION-BROWSER-QA-001",
    "status": "pass" if not errors and passed == len(results) else "fail",
    "results": results,
    "errors": errors,
    "summary": {"passed": passed, "failed": len(results) - passed, "total": len(results)},
    "screenshot": "qa/screenshots/v540_yunnan_production_preview.png",
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report["summary"], ensure_ascii=False))
if errors or passed != len(results):
    raise SystemExit(1)
