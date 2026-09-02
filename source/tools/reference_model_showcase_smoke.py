#!/usr/bin/env python3
from __future__ import annotations

import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "data/qa/reference_model_showcase_smoke.json"
SCREEN_DIR = ROOT / "qa/screenshots"
SCREEN_DIR.mkdir(parents=True, exist_ok=True)

EXPECTED = {
    "dali": {"meshes": 1, "triangles": 997659},
    "wulong": {"meshes": 1, "triangles": 300084},
    "tuanjie": {"meshes": 48, "triangles": 464288},
}

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
            f"http://127.0.0.1:{server.server_port}/reference-model-showcase.html",
            wait_until="load",
            timeout=120000,
        )
        page.wait_for_function(
            "window.__YUNNAN_REFERENCE_SHOWCASE__ && "
            "(window.__YUNNAN_REFERENCE_SHOWCASE__.stats().loaded + "
            "window.__YUNNAN_REFERENCE_SHOWCASE__.stats().failed) === 3",
            timeout=600000,
        )
        page.wait_for_timeout(1800)
        state = page.evaluate("window.__YUNNAN_REFERENCE_SHOWCASE__.stats()")
        results.append({"name": "three models loaded", "ok": state["loaded"] == 3 and state["failed"] == 0, "detail": state})
        for model_id, expected in EXPECTED.items():
            stats = state["models"].get(model_id) or {}
            results.append({
                "name": f"{model_id} geometry",
                "ok": stats.get("meshes") == expected["meshes"] and stats.get("triangles") == expected["triangles"],
                "detail": {"meshes": stats.get("meshes"), "triangles": stats.get("triangles"), "textures": stats.get("textures")},
            })
        results.append({"name": "all canvases visible", "ok": all(page.locator(f"#canvas-{model_id}").is_visible() for model_id in EXPECTED)})
        body_text = page.locator("body").inner_text()
        results.append({"name": "knowledge rules present", "ok": "屋顶必须分成独立屋面单元" in body_text and "墙面保留材料转换和时间痕迹" in body_text})
        page.screenshot(path=str(SCREEN_DIR / "yunnan_reference_showcase_all.png"), full_page=True)
        for model_id in EXPECTED:
            page.locator(f'[data-mode="{model_id}"]').click()
            page.wait_for_timeout(450)
            page.screenshot(path=str(SCREEN_DIR / f"yunnan_reference_showcase_{model_id}.png"), full_page=False)
        page.locator('[data-mode="all"]').click()
        page.wait_for_timeout(250)
        roof_button = page.locator('[data-roof="tuanjie"]')
        roof_button.click()
        page.wait_for_timeout(350)
        roof_state = page.evaluate("window.__YUNNAN_REFERENCE_SHOWCASE__.state.viewers.tuanjie.stats().groups.roof")
        results.append({"name": "Tuanjie roof group toggle", "ok": roof_state is False})
        roof_button.click()
        results.append({"name": "WebGL contexts active", "ok": all(page.evaluate(f"document.querySelector('#canvas-{model_id}').getContext('webgl') !== null") for model_id in EXPECTED)})
        browser.close()
finally:
    server.shutdown()
    server.server_close()

passed = sum(1 for item in results if item.get("ok"))
report = {
    "schemaVersion": "5.4.3",
    "title": "云南建筑三模型成果演示浏览器验收",
    "results": results,
    "errors": errors,
    "summary": {"passed": passed, "failed": len(results) - passed, "total": len(results)},
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report["summary"], ensure_ascii=False))
if errors or passed != len(results):
    raise SystemExit(1)
