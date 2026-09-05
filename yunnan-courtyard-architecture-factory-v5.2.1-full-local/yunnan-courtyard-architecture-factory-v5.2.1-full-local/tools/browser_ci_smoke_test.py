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
REPORT = ROOT / "data/qa/ci_browser_smoke_test_v5_4_2.json"
SCREEN = ROOT / "qa/screenshots/ci_browser_smoke_test_v5_4_2.png"
REFERENCE_SCREEN = ROOT / "qa/screenshots/ci_tuanjie_standard_v5_4_2.png"

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright is not installed. Run: python -m pip install -r requirements-dev.txt")
    raise SystemExit(2)

if sys.platform.startswith("linux") and not os.environ.get("DISPLAY"):
    print("Linux needs a virtual display for the WebGL test.")
    print("Run: xvfb-run -a python tools/browser_ci_smoke_test.py")
    raise SystemExit(2)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()

results: list[dict] = []
errors: list[str] = []


def record(name: str, ok: bool, detail=None) -> None:
    item = {"name": name, "ok": bool(ok)}
    if detail is not None:
        item["detail"] = detail
    results.append(item)


try:
    with sync_playwright() as p:
        launch_args = [
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            "--disable-web-security",
            "--no-sandbox",
        ]
        executable = "/usr/bin/chromium" if Path("/usr/bin/chromium").exists() else None
        browser = p.chromium.launch(headless=False, executable_path=executable, args=launch_args)
        page = browser.new_page(viewport={"width": 1360, "height": 920}, device_scale_factor=1)
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
        page.wait_for_function(
            "window.__APP_READY__ === true && !!window.__V521_TEST__",
            timeout=120000,
        )
        page.wait_for_timeout(900)

        title = page.title()
        record("title", "云南院落历史建筑生产线" in title, title)
        record("main canvas", page.locator("#buildingCanvas").count() == 1)
        record("openings control", page.locator("#m3OpenDemo").count() == 1)
        record("visitor control", page.locator("#m3Tour").count() == 1)

        state = page.evaluate("window.__V521_TEST__.stats()")
        record("WebGL active", not state.get("fallback", True), state)
        record(
            "main geometry populated",
            state.get("triangles", 0) > 500 and state.get("lines", 0) > 100,
            {"triangles": state.get("triangles"), "lines": state.get("lines")},
        )
        record(
            "default complete geometry",
            state.get("options", {}).get("cut") is False
            and state.get("tour", {}).get("revealUpper") is False,
        )

        page.evaluate("window.__V521_TEST__.startOpenings()")
        page.wait_for_timeout(3400)
        opened = page.evaluate("window.__V521_TEST__.stats()")
        motion = opened.get("motion", {})
        record(
            "automatic openings",
            motion.get("gate", 0) > 0.95
            and motion.get("windows", 0) > 0.95
            and motion.get("inner", 0) > 0.95,
            motion,
        )

        page.evaluate("window.__V521_TEST__.setTourTime(13.2)")
        page.wait_for_timeout(220)
        stair = page.evaluate("window.__V521_TEST__.stats()")
        stair_floor = stair.get("personFloor")
        record(
            "visitor climbs stairs",
            isinstance(stair_floor, (int, float)) and 0.2 < stair_floor < 2.7,
            stair_floor,
        )

        page.evaluate("window.__V521_TEST__.setTourTime(24.0)")
        page.wait_for_timeout(220)
        upper = page.evaluate("window.__V521_TEST__.stats()")
        upper_floor = upper.get("personFloor")
        record(
            "visitor reaches second floor",
            isinstance(upper_floor, (int, float)) and abs(upper_floor - 2.73) < 0.03,
            upper_floor,
        )
        record("tour keeps explicit cutaway off", upper.get("options", {}).get("cut") is False)
        page.screenshot(path=str(SCREEN), full_page=False)

        page.locator('[data-branch="measured"]').click()
        page.wait_for_timeout(350)
        measured_state = page.evaluate("window.__V521_TEST__.stats()")
        record(
            "measured case geometry",
            measured_state.get("triangles", 0) > 500 and measured_state.get("lines", 0) > 100,
            {
                "triangles": measured_state.get("triangles"),
                "lines": measured_state.get("lines"),
            },
        )

        page.locator('[data-view="reference"]').click()
        page.wait_for_timeout(250)
        record("Tuanjie viewer visible", page.locator("#tuanjieViewer").is_visible())
        record("standard GLB control", page.locator("#openTuanjieStandard").count() == 1)
        page.locator("#openTuanjieStandard").click()
        page.wait_for_function(
            "window.__TUANJIE_TEST__ && window.__TUANJIE_TEST__.stats().loaded === true && /EDITABLE\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')",
            timeout=180000,
        )
        reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
        record(
            "standard GLB geometry",
            reference.get("meshes") == 48
            and reference.get("primitives") == 48
            and reference.get("triangles") == 464288,
            reference,
        )
        textures = reference.get("textures", {})
        record(
            "standard GLB texture profile",
            textures.get("base", {}).get("width") == 3072
            and textures.get("base", {}).get("height") == 3072
            and textures.get("normal", {}).get("width") == 1024
            and textures.get("normal", {}).get("height") == 1024
            and reference.get("normalMapActive") is True,
            textures,
        )
        page.locator("#tuanjieViewer").scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        page.screenshot(path=str(REFERENCE_SCREEN), full_page=False)

        record("GitHub sync bridge", bool(page.evaluate("window.__GITHUB_SYNC__")))
        page.locator("#githubSyncLauncher").click()
        page.wait_for_timeout(250)
        record(
            "GitHub sync panel",
            page.locator("#githubSyncOverlay").is_visible()
            and page.locator("#githubSyncAdd").count() == 1,
        )
        sync_stats = page.evaluate("window.__GITHUB_SYNC__.stats()")
        record(
            "GitHub sync public read contract",
            str(sync_stats.get("schemaVersion", "")).startswith("5.4")
            and sync_stats.get("queued", -1) >= 0,
            sync_stats,
        )

        browser.close()
finally:
    server.shutdown()
    server.server_close()

passed = sum(1 for item in results if item.get("ok"))
report = {
    "schemaVersion": "5.4.2-draft",
    "recordId": "HOUSE-CI-BROWSER-SMOKE-V5.4.2",
    "status": "pass" if not errors and passed == len(results) else "fail",
    "results": results,
    "errors": errors,
    "summary": {"passed": passed, "failed": len(results) - passed, "total": len(results)},
    "screenshots": [
        "qa/screenshots/ci_browser_smoke_test_v5_4_2.png",
        "qa/screenshots/ci_tuanjie_standard_v5_4_2.png",
    ],
    "boundary": "The local-only 7000x7000 high GLB is excluded from public Git and is tested by the full local browser suite, not by this public-repository CI suite.",
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report["summary"], ensure_ascii=False))
if errors or passed != len(results):
    raise SystemExit(1)
