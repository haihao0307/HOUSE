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
OUT_DIR = ROOT / "qa/screenshots/v543-reference-study/quicklook"
REPORT = ROOT / "data/qa/three_reference_quicklook_v5_4_3.json"

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


PROFILES = [
    {
        "id": "dali",
        "button": "#openDaliReference",
        "source": "YN_DALI_001_REFERENCE_WEB.glb",
        "label": "大理",
        "expectedTriangles": 997659,
    },
    {
        "id": "wulong",
        "button": "#openWulongReference",
        "source": "YN_HAOSI1_WULONG_WL_001_REFERENCE_WEB.glb",
        "label": "乌龙村",
        "expectedTriangles": 300084,
    },
    {
        "id": "tuanjie",
        "button": "#openTuanjieStandard",
        "source": "YN_TUANJIE_001_EDITABLE.glb",
        "label": "团结乡",
        "expectedTriangles": 464288,
    },
]

OUT_DIR.mkdir(parents=True, exist_ok=True)
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
            args=[
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--no-sandbox",
            ],
        )
        page = browser.new_page(viewport={"width": 1600, "height": 1100}, device_scale_factor=1)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on(
            "console",
            lambda msg: errors.append(msg.text)
            if msg.type == "error" and "responded with a status of 403" not in msg.text
            else None,
        )
        page.goto(
            f"http://127.0.0.1:{server.server_port}/index.html",
            wait_until="load",
            timeout=120000,
        )
        page.wait_for_function("window.__APP_READY__ === true && !!window.__TUANJIE_TEST__", timeout=120000)
        page.locator('[data-view="reference"]').click()
        page.wait_for_timeout(500)

        for profile in PROFILES:
            page.locator(profile["button"]).click()
            page.wait_for_function(
                f"window.__TUANJIE_TEST__.stats().loaded === true && /{profile['source'].replace('.', r'\\.')}$/.test(window.__TUANJIE_TEST__.stats().source || '')",
                timeout=240000,
            )
            page.wait_for_timeout(1200)
            stats = page.evaluate("window.__TUANJIE_TEST__.stats()")
            results.append(
                {
                    "id": profile["id"],
                    "label": profile["label"],
                    "source": stats.get("source"),
                    "nodes": stats.get("nodes"),
                    "meshes": stats.get("meshes"),
                    "primitives": stats.get("primitives"),
                    "vertices": stats.get("vertices"),
                    "triangles": stats.get("triangles"),
                    "textures": stats.get("textures"),
                    "normalMapActive": stats.get("normalMapActive"),
                    "geometryMatch": stats.get("triangles") == profile["expectedTriangles"],
                }
            )
            page.locator("#tuanjieViewer").screenshot(path=str(OUT_DIR / f"{profile['id']}_oblique.png"))
            page.locator("#tuanjieAuto").click()
            page.wait_for_timeout(5200)
            page.locator("#tuanjieAuto").click()
            page.locator("#tuanjieViewer").screenshot(path=str(OUT_DIR / f"{profile['id']}_rotated.png"))

        browser.close()
finally:
    server.shutdown()
    server.server_close()

report = {
    "schemaVersion": "5.4.3",
    "recordId": "YN-THREE-REFERENCE-QUICKLOOK-001",
    "status": "pass" if not errors and all(item["geometryMatch"] for item in results) else "fail",
    "models": results,
    "errors": errors,
    "screenshots": sorted(str(path.relative_to(ROOT)).replace("\\", "/") for path in OUT_DIR.glob("*.png")),
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": report["status"], "models": len(results), "screenshots": len(report["screenshots"])}, ensure_ascii=False))
if report["status"] != "pass":
    raise SystemExit(1)
