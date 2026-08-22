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
OUT = ROOT / "qa/screenshots/v543-reference-study/study-page"
REPORT = ROOT / "data/qa/three_reference_study_browser_v5_4_3.json"

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


OUT.mkdir(parents=True, exist_ok=True)
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
        page = browser.new_page(viewport={"width": 1680, "height": 1050}, device_scale_factor=1)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(f"http://127.0.0.1:{server.server_port}/three-reference-study.html", wait_until="load", timeout=120000)
        page.wait_for_function(
            "() => { const s=window.__THREE_REFERENCE_STUDY__?.stats?.(); return s?.dali?.loaded && s?.wulong?.loaded && s?.tuanjie?.loaded; }",
            timeout=300000,
        )
        stats = page.evaluate("window.__THREE_REFERENCE_STUDY__.stats()")
        results.extend([
            {"name": "study page title", "ok": "三模型建筑研究" in page.title()},
            {"name": "three canvases", "ok": page.locator("canvas").count() == 3},
            {"name": "Dali geometry", "ok": stats["dali"]["triangles"] == 997659},
            {"name": "Wulong geometry", "ok": stats["wulong"]["triangles"] == 300084},
            {"name": "Tuanjie geometry", "ok": stats["tuanjie"]["triangles"] == 464288},
            {"name": "Dali texture", "ok": stats["dali"]["textures"]["base"]["width"] == 4096},
            {"name": "Wulong texture", "ok": stats["wulong"]["textures"]["base"]["width"] == 4096 and stats["wulong"]["textures"]["normal"]["width"] == 2048},
            {"name": "Tuanjie texture", "ok": stats["tuanjie"]["textures"]["base"]["width"] == 3072 and stats["tuanjie"]["textures"]["normal"]["width"] == 1024},
        ])
        hashes: dict[str, str] = {}
        for preset in ["oblique", "front", "back", "left", "right", "top", "eave", "ridge"]:
            page.locator(f'[data-preset="{preset}"]').click()
            page.wait_for_timeout(500)
            path = OUT / f"three_models_{preset}.png"
            page.screenshot(path=str(path), full_page=False)
            hashes[preset] = hashlib.sha256(path.read_bytes()).hexdigest()
        results.append({"name": "preset screenshots", "ok": len(hashes) == 8})
        results.append({"name": "preset image differences", "ok": len(set(hashes.values())) >= 7, "detail": hashes})
        bundle = page.evaluate("window.__THREE_REFERENCE_STUDY__.researchJson()")
        results.append({"name": "research bundle privacy", "ok": bundle["privacy"]["rawLocalFilesIncluded"] is False and bundle["privacy"]["localPathsIncluded"] is False})
        results.append({"name": "independent case IDs", "ok": len({v["caseId"] for v in bundle["models"].values()}) == 3})

        mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        mobile.on("pageerror", lambda exc: errors.append(f"mobile: {exc}"))
        mobile.goto(f"http://127.0.0.1:{server.server_port}/three-reference-study.html", wait_until="load", timeout=120000)
        mobile.wait_for_function(
            "() => { const s=window.__THREE_REFERENCE_STUDY__?.stats?.(); return s?.dali?.loaded && s?.wulong?.loaded && s?.tuanjie?.loaded; }",
            timeout=300000,
        )
        results.append({"name": "mobile single column", "ok": mobile.locator(".model").count() == 3 and mobile.locator(".model").first.is_visible()})
        await_path = OUT / "three_models_mobile.png"
        mobile.screenshot(path=str(await_path), full_page=False)
        mobile.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

passed = sum(1 for item in results if item.get("ok"))
report = {
    "schemaVersion": "5.4.3",
    "recordId": "YN-THREE-REFERENCE-STUDY-BROWSER-QA-001",
    "status": "pass" if not errors and passed == len(results) else "fail",
    "results": results,
    "errors": errors,
    "summary": {"passed": passed, "failed": len(results) - passed, "total": len(results)},
    "screenshots": sorted(str(path.relative_to(ROOT)).replace("\\", "/") for path in OUT.glob("*.png")),
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report["summary"], ensure_ascii=False))
if report["status"] != "pass":
    raise SystemExit(1)
