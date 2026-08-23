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
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
REPORT = ROOT / "data/qa/local_browser_smoke_test.json"
SCREEN = ROOT / "qa/screenshots/local_browser_smoke_test.png"
REFERENCE_HIGH_SCREEN = ROOT / "qa/screenshots/v540_tuanjie_reference_high.png"
REFERENCE_STANDARD_SCREEN = ROOT / "qa/screenshots/v540_tuanjie_reference_standard.png"
REFERENCE_FILE_SCREEN = ROOT / "qa/screenshots/v540_tuanjie_file_loader.png"

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright is not installed. Run: python -m pip install -r requirements-dev.txt")
    raise SystemExit(2)

results = []
errors = []
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
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
    if sys.platform.startswith("win"):
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
    browser = p.chromium.launch(headless=True, executable_path=executable, args=launch_args)
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    # GitHub's unauthenticated REST API can legitimately return 403 when its
    # shared rate limit is exhausted; the public raw-data read and the local
    # sync queue remain valid in that case, so do not fail the UI regression on
    # those expected network diagnostics.
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" and "responded with a status of 403" not in msg.text else None)
    page.goto(f"http://127.0.0.1:{server.server_port}/index.html", wait_until="load", timeout=120000)
    page.wait_for_function("window.__APP_READY__ === true && !!window.__V521_TEST__", timeout=120000)
    page.wait_for_timeout(1000)

    title = page.title()
    results.append({"name": "title", "ok": VERSION in title, "detail": title})
    results.append({"name": "canvas", "ok": page.locator("#buildingCanvas").count() == 1})
    for selector, name in [("#m3OpenDemo", "openings button"), ("#m3Tour", "visitor button"), ("#m3Cut", "cutaway button")]:
        results.append({"name": name, "ok": page.locator(selector).count() == 1})

    state = page.evaluate("window.__V521_TEST__.stats()")
    results.append({"name": "WebGL active", "ok": not state.get("fallback", True), "detail": state})
    results.append({"name": "geometry populated", "ok": state.get("triangles", 0) > 500 and state.get("lines", 0) > 100})
    results.append({"name": "default complete geometry", "ok": state["options"]["cut"] is False and state["tour"]["revealUpper"] is False})
    tuanjie_layer = state.get("tuanjieLayer") or {}
    results.append({
        "name": "Tuanjie production-layer control",
        "ok": page.locator("#m3Tuanjie").count() == 1,
    })
    results.append({
        "name": "Tuanjie evidence integrated into main generator",
        "ok": tuanjie_layer.get("enabled") is True
        and tuanjie_layer.get("integratedInto") == "current-main-generator"
        and tuanjie_layer.get("standalone") is False
        and tuanjie_layer.get("wallFaces", 0) > 0
        and tuanjie_layer.get("roofTiles", 0) > 0
        and tuanjie_layer.get("timberFaces", 0) > 0,
        "detail": tuanjie_layer,
    })
    page.locator("#m3Tuanjie").click()
    page.wait_for_timeout(120)
    tuanjie_off = page.evaluate("window.__V521_TEST__.stats()")
    results.append({
        "name": "Tuanjie evidence layer can be disabled",
        "ok": tuanjie_off["options"].get("tuanjie") is False
        and (tuanjie_off.get("tuanjieLayer") or {}).get("enabled") is False,
        "detail": tuanjie_off.get("tuanjieLayer"),
    })
    page.locator("#m3Tuanjie").click()
    page.wait_for_timeout(120)
    tuanjie_on_again = page.evaluate("window.__V521_TEST__.stats()")
    results.append({
        "name": "Tuanjie evidence layer can be restored",
        "ok": tuanjie_on_again["options"].get("tuanjie") is True
        and (tuanjie_on_again.get("tuanjieLayer") or {}).get("enabled") is True,
        "detail": tuanjie_on_again.get("tuanjieLayer"),
    })

    page.locator('[data-branch="measured"]').click()
    page.wait_for_timeout(300)
    measured_text = page.locator("body").inner_text()
    measured_state = page.evaluate("window.__V521_TEST__.stats()")
    results.append({"name": "measured case selectable", "ok": "三开间带前廊两层建筑" in measured_text})
    results.append({"name": "measured dimensions visible", "ok": "11.53×7.92米" in measured_text})
    results.append({"name": "measured geometry populated", "ok": measured_state.get("triangles", 0) > 500 and measured_state.get("lines", 0) > 100, "detail": measured_state})
    measured_layer = measured_state.get("tuanjieLayer") or {}
    results.append({
        "name": "Tuanjie layer follows measured branch",
        "ok": measured_layer.get("enabled") is True
        and measured_layer.get("integratedInto") == "current-main-generator"
        and measured_layer.get("branch") == "measured",
        "detail": measured_layer,
    })
    page.locator('[data-branch="yikeyin"]').click()
    page.wait_for_timeout(300)

    page.evaluate("window.__V521_TEST__.startOpenings()")
    page.wait_for_timeout(3400)
    opened = page.evaluate("window.__V521_TEST__.stats()")
    results.append({"name": "openings demo", "ok": opened["motion"]["gate"] > .95 and opened["motion"]["windows"] > .95 and opened["motion"]["inner"] > .95, "detail": opened["motion"]})

    page.evaluate("window.__V521_TEST__.setTourTime(13.2)")
    page.wait_for_timeout(200)
    stair = page.evaluate("window.__V521_TEST__.stats()")
    results.append({"name": "visitor climbs stairs", "ok": .2 < stair.get("personFloor", 0) < 2.7, "detail": stair.get("personFloor")})

    page.evaluate("window.__V521_TEST__.setTourTime(24.0)")
    page.wait_for_timeout(200)
    upper = page.evaluate("window.__V521_TEST__.stats()")
    results.append({"name": "visitor reaches second floor", "ok": abs(upper.get("personFloor", 0) - 2.73) < .03, "detail": upper.get("personFloor")})
    results.append({"name": "tour keeps cutaway disabled", "ok": upper["options"]["cut"] is False})

    page.screenshot(path=str(SCREEN), full_page=False)

    page.locator('[data-view="reference"]').click()
    results.append({"name": "Tuanjie viewer visible before load", "ok": page.locator("#tuanjieViewer").is_visible()})
    results.append({"name": "Tuanjie local-file control", "ok": page.locator("#tuanjieFileInput").count() == 1})
    page.locator("#openTuanjieStandard").click()
    page.wait_for_function("window.__TUANJIE_TEST__.stats().loaded === true && /EDITABLE\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')", timeout=180000)
    reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
    results.append({"name": "Tuanjie GLB canvas", "ok": page.locator("#tuanjieCanvas").count() == 1})
    results.append({"name": "Tuanjie editable meshes", "ok": reference.get("meshes") == 48 and reference.get("primitives") == 48, "detail": reference})
    results.append({"name": "Tuanjie geometry", "ok": reference.get("triangles", 0) == 464288 and reference.get("animations") == 0 and reference.get("skins") == 0 and reference.get("cameras") == 0})
    results.append({"name": "Tuanjie standard texture profile", "ok": reference.get("textures", {}).get("base", {}).get("width") == 3072 and reference.get("textures", {}).get("base", {}).get("height") == 3072 and reference.get("textures", {}).get("normal", {}).get("width") == 1024 and reference.get("textures", {}).get("normal", {}).get("height") == 1024, "detail": reference.get("textures")})
    results.append({"name": "Tuanjie normal-map rendering", "ok": reference.get("normalMapActive") is True, "detail": {"normalMapActive": reference.get("normalMapActive"), "maxTextureSize": reference.get("maxTextureSize"), "dpr": reference.get("dpr")}})
    results.append({"name": "Tuanjie standard texture device support", "ok": reference.get("maxTextureSize", 0) >= 3072, "detail": reference.get("maxTextureSize")})
    page.locator('[data-tj-group="roof"]').click()
    page.wait_for_timeout(200)
    roof_hidden = page.evaluate("window.__TUANJIE_TEST__.stats()")
    results.append({"name": "Tuanjie editable roof group", "ok": roof_hidden.get("groups", {}).get("roof") is False, "detail": roof_hidden.get("groups")})
    page.locator('[data-tj-group="roof"]').click()
    page.locator("#tuanjieViewer").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=str(REFERENCE_HIGH_SCREEN), full_page=False)

    page.locator("#openTuanjieStandard").click()
    page.wait_for_function("window.__TUANJIE_TEST__.stats().loaded === true && /EDITABLE\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')", timeout=120000)
    standard_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
    results.append({"name": "Tuanjie standard geometry parity", "ok": standard_reference.get("meshes") == 48 and standard_reference.get("triangles") == 464288, "detail": standard_reference})
    results.append({"name": "Tuanjie standard texture profile", "ok": standard_reference.get("textures", {}).get("base", {}).get("width") == 3072 and standard_reference.get("textures", {}).get("base", {}).get("height") == 3072 and standard_reference.get("textures", {}).get("normal", {}).get("width") == 1024 and standard_reference.get("textures", {}).get("normal", {}).get("height") == 1024, "detail": standard_reference.get("textures")})
    page.locator("#tuanjieViewer").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=str(REFERENCE_STANDARD_SCREEN), full_page=False)

    # Browser automation is not allowed to navigate to file:// URLs. Verify the
    # file-protocol recovery branch statically, then exercise the exact same
    # local-file loader over the local HTTP test page.
    html_source = (ROOT / "index.html").read_text(encoding="utf-8")
    results.append({
        "name": "file protocol recovery instruction",
        "ok": "location.protocol==='file:'" in html_source and "YN_TUANJIE_001_EDITABLE.glb" in html_source and "选择本地 GLB" in html_source,
    })
    page.locator("#tuanjieFileInput").set_input_files(str(ROOT / "assets/models/YN_TUANJIE_001_EDITABLE.glb"))
    page.wait_for_function("window.__TUANJIE_TEST__.stats().loaded === true", timeout=120000)
    local_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
    results.append({"name": "local GLB re-import", "ok": local_reference.get("meshes") == 48 and local_reference.get("triangles") == 464288 and local_reference.get("source") == "YN_TUANJIE_001_EDITABLE.glb" and local_reference.get("textures", {}).get("base", {}).get("width") == 3072 and local_reference.get("normalMapActive") is True, "detail": local_reference})
    page.locator("#tuanjieViewer").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=str(REFERENCE_FILE_SCREEN), full_page=False)

    # Newly catalogued public reference GLBs share the same editable viewer.
    # Verify their public paths, preserved triangle counts and optimized texture profiles.
    page.locator("#openDaliReference").click()
    page.wait_for_function("window.__TUANJIE_TEST__.stats().loaded === true && /YN_DALI_001_REFERENCE_WEB\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')", timeout=180000)
    dali_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
    results.append({"name": "Dali reference button", "ok": page.locator("#openDaliReference").count() == 1 and dali_reference.get("source", "").endswith("YN_DALI_001_REFERENCE_WEB.glb"), "detail": dali_reference})
    results.append({"name": "Dali reference geometry", "ok": dali_reference.get("meshes") == 1 and dali_reference.get("triangles") == 997659 and dali_reference.get("vertices") == 809883, "detail": dali_reference})
    results.append({"name": "Dali reference texture profile", "ok": dali_reference.get("textures", {}).get("base", {}).get("width") == 4096 and dali_reference.get("textures", {}).get("base", {}).get("height") == 4096, "detail": dali_reference.get("textures")})

    page.locator("#openWulongReference").click()
    page.wait_for_function("window.__TUANJIE_TEST__.stats().loaded === true && /YN_HAOSI1_WULONG_WL_001_REFERENCE_WEB\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')", timeout=180000)
    wulong_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
    results.append({"name": "Wulong reference button", "ok": page.locator("#openWulongReference").count() == 1 and wulong_reference.get("source", "").endswith("YN_HAOSI1_WULONG_WL_001_REFERENCE_WEB.glb"), "detail": wulong_reference})
    results.append({"name": "Wulong reference geometry", "ok": wulong_reference.get("meshes") == 1 and wulong_reference.get("triangles") == 300084 and wulong_reference.get("vertices") == 357794, "detail": wulong_reference})
    results.append({"name": "Wulong reference texture profile", "ok": wulong_reference.get("textures", {}).get("base", {}).get("width") == 4096 and wulong_reference.get("textures", {}).get("base", {}).get("height") == 4096 and wulong_reference.get("textures", {}).get("normal", {}).get("width") == 2048 and wulong_reference.get("textures", {}).get("normal", {}).get("height") == 2048, "detail": wulong_reference.get("textures")})

    # GitHub synchronization bridge: the public page must expose a read-only
    # repository connection without requiring a token.
    results.append({"name": "GitHub sync bridge", "ok": page.evaluate("!!window.__GITHUB_SYNC__")})
    page.locator("#githubSyncLauncher").click()
    page.wait_for_timeout(250)
    results.append({"name": "GitHub sync panel", "ok": page.locator("#githubSyncOverlay").is_visible() and page.locator("#githubSyncAdd").count() == 1})
    sync_stats = page.evaluate("window.__GITHUB_SYNC__.stats()")
    results.append({"name": "GitHub sync public read contract", "ok": sync_stats.get("schemaVersion") == VERSION and sync_stats.get("queued", -1) >= 0, "detail": sync_stats})
    browser.close()
finally:
    server.shutdown()
    server.server_close()

passed = sum(1 for item in results if item.get("ok"))
report = {
    "version": VERSION,
    "results": results,
    "errors": errors,
    "summary": {"passed": passed, "failed": len(results) - passed, "total": len(results)},
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report["summary"], ensure_ascii=False))
if errors or passed != len(results):
    raise SystemExit(1)
