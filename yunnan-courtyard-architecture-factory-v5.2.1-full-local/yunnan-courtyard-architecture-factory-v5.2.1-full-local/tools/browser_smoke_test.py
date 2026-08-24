#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import threading
import traceback
from collections import Counter
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Complete production-line browser regression")
    parser.add_argument("--report", type=Path, default=ROOT / "data/qa/local_browser_smoke_test.json")
    parser.add_argument("--screenshots", type=Path, default=ROOT / "qa/screenshots")
    parser.add_argument("--run-sha", default=os.environ.get("GITHUB_SHA"), help="Commit under test and GitHub Sync read ref.")
    parser.add_argument("--run-ref", default=os.environ.get("GITHUB_REF_NAME"), help="Branch name recorded by GitHub Sync.")
    return parser.parse_args()


ARGS = parse_args()
REPORT = ARGS.report if ARGS.report.is_absolute() else ROOT / ARGS.report
SCREENSHOT_DIR = ARGS.screenshots if ARGS.screenshots.is_absolute() else ROOT / ARGS.screenshots
SCREEN = SCREENSHOT_DIR / "local_browser_smoke_test.png"
TUANJIE_SCREEN = SCREENSHOT_DIR / "v550_regression_tuanjie_reference.png"
TUANJIE_LOCAL_SCREEN = SCREENSHOT_DIR / "v550_regression_tuanjie_file_loader.png"
DALI_SCREEN = SCREENSHOT_DIR / "v550_regression_dali_reference.png"
WULONG_SCREEN = SCREENSHOT_DIR / "v550_regression_wulong_reference.png"
MOBILE_SCREEN = SCREENSHOT_DIR / "v550_regression_mobile_390x844.png"
STALE_HIGH_SCREEN = SCREENSHOT_DIR / "v550_regression_tuanjie_reference_high.png"
STALE_STANDARD_SCREEN = SCREENSHOT_DIR / "v550_regression_tuanjie_reference_standard.png"

REPORT.parent.mkdir(parents=True, exist_ok=True)
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
for previous in [
    REPORT,
    SCREEN,
    TUANJIE_SCREEN,
    TUANJIE_LOCAL_SCREEN,
    DALI_SCREEN,
    WULONG_SCREEN,
    MOBILE_SCREEN,
    STALE_HIGH_SCREEN,
    STALE_STANDARD_SCREEN,
]:
    if previous.is_file():
        previous.unlink()

results: list[dict[str, Any]] = []
process_failures: list[dict[str, Any]] = []
page_errors: list[str] = []
console_errors: list[dict[str, Any]] = []
network_console_diagnostics: list[dict[str, Any]] = []
failed_requests: list[dict[str, Any]] = []
http_errors: list[dict[str, Any]] = []
forbidden_high_requests: list[dict[str, Any]] = []
allowed_optional_http: list[dict[str, Any]] = []
allowed_network_console: list[dict[str, Any]] = []
model_runtime: dict[str, dict[str, Any]] = {}
sync_stats: dict[str, Any] = {}
mobile_sync_stats: dict[str, Any] = {}
state = None
measured_state = None
upper = None


def add_result(name: str, ok: bool, detail: Any = None) -> None:
    result: dict[str, Any] = {"name": name, "ok": bool(ok)}
    if detail is not None:
        result["detail"] = detail
    results.append(result)


def add_process_failure(kind: str, detail: Any, *, failure_type: str | None = None) -> None:
    process_failures.append({"kind": kind, "type": failure_type or kind, "detail": detail})


def capture_console(message: Any) -> None:
    if message.type != "error":
        return
    entry = {"text": message.text, "location": message.location}
    status_match = re.search(r"\bstatus(?: of)?\s+(\d{3})\b", message.text, re.IGNORECASE)
    if "Failed to load resource" in message.text and status_match:
        entry["status"] = int(status_match.group(1))
        network_console_diagnostics.append(entry)
    else:
        console_errors.append(entry)


def capture_response(response: Any) -> None:
    if response.status >= 400:
        http_errors.append({
            "status": response.status,
            "url": response.url,
            "method": response.request.method,
        })


def capture_request_failure(request: Any) -> None:
    failed_requests.append({"method": request.method, "url": request.url, "failure": request.failure})


def capture_request(request: Any) -> None:
    if "YN_TUANJIE_001_EDITABLE_HIGH.glb" in request.url:
        forbidden_high_requests.append({"method": request.method, "url": request.url})


def canvas_probe(page: Any) -> dict[str, Any]:
    return page.evaluate("""() => {
      const canvas = document.querySelector('#tuanjieCanvas');
      const gl = canvas?.getContext('webgl');
      if (!canvas || !gl) return {width: canvas?.width || 0, height: canvas?.height || 0, webgl: false};
      const width = canvas.width;
      const height = canvas.height;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const pixelCount = width * height;
      const stride = Math.max(1, Math.floor(pixelCount / 4096));
      const colors = new Set();
      let checksum = 2166136261;
      let opaqueSamples = 0;
      let samples = 0;
      for (let pixel = 0; pixel < pixelCount; pixel += stride) {
        const offset = pixel * 4;
        const signature = `${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]},${pixels[offset + 3]}`;
        colors.add(signature);
        if (pixels[offset + 3] > 0) opaqueSamples += 1;
        samples += 1;
      }
      for (let offset = 0; offset < pixels.length; offset += 1) {
        checksum ^= pixels[offset];
        checksum = Math.imul(checksum, 16777619);
      }
      return {width, height, webgl: true, samples, opaqueSamples, uniqueColorSamples: colors.size, checksum: checksum >>> 0};
    }""")


def capture_model(page: Any, model_id: str, path: Path, stats: dict[str, Any]) -> dict[str, Any]:
    page.locator("#tuanjieViewer").scroll_into_view_if_needed()
    page.wait_for_timeout(450)
    probe = canvas_probe(page)
    page.locator("#tuanjieCanvas").screenshot(path=str(path), timeout=180_000)
    payload = path.read_bytes() if path.is_file() else b""
    evidence = {
        "modelId": model_id,
        "source": stats.get("source"),
        "loaded": stats.get("loaded"),
        "meshes": stats.get("meshes"),
        "vertices": stats.get("vertices"),
        "triangles": stats.get("triangles"),
        "textures": stats.get("textures"),
        "canvas": probe,
        "screenshot": {
            "path": str(path),
            "bytes": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest() if payload else None,
        },
    }
    model_runtime[model_id] = evidence
    add_result(
        f"{model_id} real WebGL frame",
        stats.get("loaded") is True
        and probe.get("webgl") is True
        and probe.get("width", 0) > 100
        and probe.get("height", 0) > 100
        and probe.get("opaqueSamples", 0) > 0
        and probe.get("uniqueColorSamples", 0) > 4
        and len(payload) > 1_000,
        evidence,
    )
    return evidence


def classify_browser_diagnostics(stats_collection: list[dict[str, Any]]) -> None:
    optional_contracts: Counter[tuple[str, int]] = Counter()
    optional_status_counts: Counter[int] = Counter()
    for stats in stats_collection:
        for request in stats.get("requestHistory") or stats.get("requests", []):
            status = request.get("status")
            request_id = request.get("id")
            request_url = request.get("url", "")
            if (
                request_id in {"api:commits", "api:issues"}
                and request_url.startswith("https://api.github.com/repos/haihao0307/HOUSE/")
                and request.get("required") is False
                and request.get("outcome") == "allowed-optional-http"
                and isinstance(status, int)
                and request.get("allowedStatuses") == [403, 429]
                and status in request.get("allowedStatuses", [])
            ):
                optional_contracts[(request_url, status)] += 1

    for response in http_errors:
        key = (response["url"], response["status"])
        if optional_contracts[key] > 0:
            optional_contracts[key] -= 1
            optional_status_counts[response["status"]] += 1
            allowed_optional_http.append(response)
        else:
            add_process_failure("unexpected-http-response", response, failure_type="http")

    for diagnostic in network_console_diagnostics:
        status = diagnostic.get("status")
        if isinstance(status, int) and optional_status_counts[status] > 0:
            optional_status_counts[status] -= 1
            allowed_network_console.append(diagnostic)
        else:
            add_process_failure("unexpected-network-console-error", diagnostic, failure_type="console")

    for error in page_errors:
        add_process_failure("pageerror", error, failure_type="pageerror")
    for error in console_errors:
        add_process_failure("console-error", error, failure_type="console")
    for failure in failed_requests:
        add_process_failure("failed-request", failure, failure_type="requestfailed")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *args: object) -> None:
        pass


server: ThreadingHTTPServer | None = None
browser = None
try:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        add_process_failure(
            "playwright-import",
            {"message": str(exc), "traceback": traceback.format_exc()},
            failure_type=type(exc).__name__,
        )
        sync_playwright = None

    if sync_playwright is not None:
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        with sync_playwright() as playwright:
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
            try:
                browser = playwright.chromium.launch(headless=True, executable_path=executable, args=launch_args)
                page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
                page.on("pageerror", lambda exc: page_errors.append(str(exc)))
                page.on("console", capture_console)
                page.on("request", capture_request)
                page.on("response", capture_response)
                page.on("requestfailed", capture_request_failure)
                injected_deployment = {}
                if ARGS.run_sha:
                    injected_deployment["sha"] = ARGS.run_sha
                if ARGS.run_ref:
                    injected_deployment["ref"] = ARGS.run_ref
                if injected_deployment:
                    page.add_init_script(
                        script="window.__GITHUB_SYNC_DEPLOYMENT__ = " + json.dumps(injected_deployment) + ";"
                    )

                page.goto(f"http://127.0.0.1:{server.server_port}/index.html", wait_until="load", timeout=120_000)
                page.wait_for_function("window.__APP_READY__ === true && !!window.__V521_TEST__", timeout=120_000)
                page.wait_for_timeout(1_000)

                title = page.title()
                add_result("title", VERSION in title, title)
                add_result("canvas", page.locator("#buildingCanvas").count() == 1)
                for selector, name in [
                    ("#m3OpenDemo", "openings button"),
                    ("#m3Tour", "visitor button"),
                    ("#m3Cut", "cutaway button"),
                ]:
                    add_result(name, page.locator(selector).count() == 1)

                state = page.evaluate("window.__V521_TEST__.stats()")
                add_result("WebGL active", not state.get("fallback", True), state)
                add_result("geometry populated", state.get("triangles", 0) > 500 and state.get("lines", 0) > 100)
                add_result("default complete geometry", state["options"]["cut"] is False and state["tour"]["revealUpper"] is False)
                stair_topology = page.evaluate("""() => {
                  const names = [...new Set(M3D.faces.map(face => face.name).filter(Boolean))];
                  const count = (stair, flight) => names.filter(name =>
                    name.startsWith(`${stair}-${flight}-flight-tread-`) && name.endsWith('-of-8')
                  ).length;
                  return {
                    west: {lower: count('west-daily-use-dogleg-stair-16-risers', 'lower'), upper: count('west-daily-use-dogleg-stair-16-risers', 'upper')},
                    east: {lower: count('east-daily-use-dogleg-stair-16-risers', 'lower'), upper: count('east-daily-use-dogleg-stair-16-risers', 'upper')},
                    treadNames: names.filter(name => /daily-use-dogleg-stair-16-risers-(lower|upper)-flight-tread-/.test(name))
                  };
                }""")
                add_result(
                    "8+8 double-flight stair topology",
                    all(
                        stair_topology.get(side, {}).get(flight) == 8
                        for side in ("west", "east")
                        for flight in ("lower", "upper")
                    ),
                    stair_topology,
                )
                tuanjie_layer = state.get("tuanjieLayer") or {}
                add_result("Tuanjie production-layer control", page.locator("#m3Tuanjie").count() == 1)
                add_result(
                    "Tuanjie evidence integrated into main generator",
                    tuanjie_layer.get("enabled") is True
                    and tuanjie_layer.get("integratedInto") == "current-main-generator"
                    and tuanjie_layer.get("standalone") is False
                    and tuanjie_layer.get("wallFaces", 0) > 0
                    and tuanjie_layer.get("roofTiles", 0) > 0
                    and tuanjie_layer.get("timberFaces", 0) > 0,
                    tuanjie_layer,
                )
                page.locator("#m3Tuanjie").click()
                page.wait_for_timeout(120)
                tuanjie_off = page.evaluate("window.__V521_TEST__.stats()")
                add_result(
                    "Tuanjie evidence layer can be disabled",
                    tuanjie_off["options"].get("tuanjie") is False
                    and (tuanjie_off.get("tuanjieLayer") or {}).get("enabled") is False,
                    tuanjie_off.get("tuanjieLayer"),
                )
                page.locator("#m3Tuanjie").click()
                page.wait_for_timeout(120)
                tuanjie_on_again = page.evaluate("window.__V521_TEST__.stats()")
                add_result(
                    "Tuanjie evidence layer can be restored",
                    tuanjie_on_again["options"].get("tuanjie") is True
                    and (tuanjie_on_again.get("tuanjieLayer") or {}).get("enabled") is True,
                    tuanjie_on_again.get("tuanjieLayer"),
                )

                page.locator('[data-branch="measured"]').click()
                page.wait_for_timeout(300)
                measured_text = page.locator("body").inner_text()
                measured_state = page.evaluate("window.__V521_TEST__.stats()")
                add_result("measured case selectable", "三开间带前廊两层建筑" in measured_text)
                add_result("measured dimensions visible", "11.53×7.92米" in measured_text)
                add_result(
                    "measured geometry populated",
                    measured_state.get("triangles", 0) > 500 and measured_state.get("lines", 0) > 100,
                    measured_state,
                )
                measured_layer = measured_state.get("tuanjieLayer") or {}
                add_result(
                    "Tuanjie layer follows measured branch",
                    measured_layer.get("enabled") is True
                    and measured_layer.get("integratedInto") == "current-main-generator"
                    and measured_layer.get("branch") == "measured",
                    measured_layer,
                )
                page.locator('[data-branch="yikeyin"]').click()
                page.wait_for_timeout(300)

                page.evaluate("window.__V521_TEST__.startOpenings()")
                page.wait_for_timeout(3_400)
                opened = page.evaluate("window.__V521_TEST__.stats()")
                add_result(
                    "openings demo",
                    opened["motion"]["gate"] > 0.95
                    and opened["motion"]["windows"] > 0.95
                    and opened["motion"]["inner"] > 0.95,
                    opened["motion"],
                )

                page.evaluate("window.__V521_TEST__.setTourTime(13.2)")
                page.wait_for_timeout(200)
                stair = page.evaluate("window.__V521_TEST__.stats()")
                add_result("visitor climbs stairs", 0.2 < stair.get("personFloor", 0) < 2.7, stair.get("personFloor"))
                page.evaluate("window.__V521_TEST__.setTourTime(24.0)")
                page.wait_for_timeout(200)
                upper = page.evaluate("window.__V521_TEST__.stats()")
                add_result("visitor reaches second floor", abs(upper.get("personFloor", 0) - 2.73) < 0.03, upper.get("personFloor"))
                add_result("tour keeps cutaway disabled", upper["options"]["cut"] is False)
                page.screenshot(path=str(SCREEN), full_page=False)

                page.locator('[data-view="reference"]').click()
                add_result("Tuanjie viewer visible before load", page.locator("#tuanjieViewer").is_visible())
                add_result("Tuanjie local-file control", page.locator("#tuanjieFileInput").count() == 1)

                html_source = (ROOT / "index.html").read_text(encoding="utf-8")
                add_result(
                    "high-precision model has no public URL",
                    "YN_TUANJIE_001_EDITABLE_HIGH.glb" not in html_source
                    and page.locator('[href*="YN_TUANJIE_001_EDITABLE_HIGH.glb"]').count() == 0,
                )
                chooser_detail: dict[str, Any] = {"opened": False}
                try:
                    with page.expect_file_chooser(timeout=5_000) as chooser_info:
                        page.locator("#openTuanjieReference").click()
                    chooser_detail["opened"] = chooser_info.value is not None
                except BaseException as exc:
                    chooser_detail.update({"type": type(exc).__name__, "message": str(exc)})
                add_result("high-precision control opens local file chooser", chooser_detail["opened"], chooser_detail)
                page.wait_for_timeout(200)
                add_result(
                    "high-precision control makes no network request",
                    not forbidden_high_requests,
                    forbidden_high_requests,
                )

                page.locator("#openTuanjieStandard").click()
                page.wait_for_function(
                    "window.__TUANJIE_TEST__.stats().loaded === true && /EDITABLE\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')",
                    timeout=180_000,
                )
                tuanjie_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
                add_result("Tuanjie GLB canvas", page.locator("#tuanjieCanvas").count() == 1)
                add_result(
                    "Tuanjie editable meshes",
                    tuanjie_reference.get("meshes") == 48 and tuanjie_reference.get("primitives") == 48,
                    tuanjie_reference,
                )
                add_result(
                    "Tuanjie geometry",
                    tuanjie_reference.get("triangles") == 464_288
                    and tuanjie_reference.get("animations") == 0
                    and tuanjie_reference.get("skins") == 0
                    and tuanjie_reference.get("cameras") == 0,
                )
                add_result(
                    "Tuanjie standard texture profile",
                    tuanjie_reference.get("textures", {}).get("base", {}).get("width") == 3_072
                    and tuanjie_reference.get("textures", {}).get("base", {}).get("height") == 3_072
                    and tuanjie_reference.get("textures", {}).get("normal", {}).get("width") == 1_024
                    and tuanjie_reference.get("textures", {}).get("normal", {}).get("height") == 1_024,
                    tuanjie_reference.get("textures"),
                )
                add_result(
                    "Tuanjie normal-map rendering",
                    tuanjie_reference.get("normalMapActive") is True,
                    {
                        "normalMapActive": tuanjie_reference.get("normalMapActive"),
                        "maxTextureSize": tuanjie_reference.get("maxTextureSize"),
                        "dpr": tuanjie_reference.get("dpr"),
                    },
                )
                page.locator('[data-tj-group="roof"]').click()
                page.wait_for_timeout(200)
                roof_hidden = page.evaluate("window.__TUANJIE_TEST__.stats()")
                add_result("Tuanjie editable roof group", roof_hidden.get("groups", {}).get("roof") is False, roof_hidden.get("groups"))
                page.locator('[data-tj-group="roof"]').click()
                capture_model(page, "Tuanjie", TUANJIE_SCREEN, page.evaluate("window.__TUANJIE_TEST__.stats()"))

                add_result(
                    "file protocol recovery instruction",
                    "location.protocol==='file:'" in html_source
                    and "YN_TUANJIE_001_EDITABLE.glb" in html_source
                    and "选择本地 GLB" in html_source,
                )
                page.locator("#tuanjieFileInput").set_input_files(str(ROOT / "assets/models/YN_TUANJIE_001_EDITABLE.glb"))
                page.wait_for_function("window.__TUANJIE_TEST__.stats().loaded === true", timeout=120_000)
                local_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
                add_result(
                    "local GLB re-import",
                    local_reference.get("meshes") == 48
                    and local_reference.get("triangles") == 464_288
                    and local_reference.get("source") == "YN_TUANJIE_001_EDITABLE.glb"
                    and local_reference.get("textures", {}).get("base", {}).get("width") == 3_072
                    and local_reference.get("normalMapActive") is True,
                    local_reference,
                )
                page.locator("#tuanjieViewer").scroll_into_view_if_needed()
                page.wait_for_timeout(300)
                page.locator("#tuanjieCanvas").screenshot(path=str(TUANJIE_LOCAL_SCREEN), timeout=180_000)

                page.locator("#openDaliReference").click()
                page.wait_for_function(
                    "window.__TUANJIE_TEST__.stats().loaded === true && /YN_DALI_001_REFERENCE_WEB\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')",
                    timeout=180_000,
                )
                dali_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
                add_result(
                    "Dali reference geometry",
                    dali_reference.get("source", "").endswith("YN_DALI_001_REFERENCE_WEB.glb")
                    and dali_reference.get("meshes") == 1
                    and dali_reference.get("triangles") == 997_659
                    and dali_reference.get("vertices") == 809_883,
                    dali_reference,
                )
                add_result(
                    "Dali reference texture profile",
                    dali_reference.get("textures", {}).get("base", {}).get("width") == 4_096
                    and dali_reference.get("textures", {}).get("base", {}).get("height") == 4_096,
                    dali_reference.get("textures"),
                )
                capture_model(page, "Dali", DALI_SCREEN, dali_reference)

                page.locator("#openWulongReference").click()
                page.wait_for_function(
                    "window.__TUANJIE_TEST__.stats().loaded === true && /YN_HAOSI1_WULONG_WL_001_REFERENCE_WEB\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')",
                    timeout=180_000,
                )
                wulong_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
                add_result(
                    "Wulong reference geometry",
                    wulong_reference.get("source", "").endswith("YN_HAOSI1_WULONG_WL_001_REFERENCE_WEB.glb")
                    and wulong_reference.get("meshes") == 1
                    and wulong_reference.get("triangles") == 300_084
                    and wulong_reference.get("vertices") == 357_794,
                    wulong_reference,
                )
                add_result(
                    "Wulong reference texture profile",
                    wulong_reference.get("textures", {}).get("base", {}).get("width") == 4_096
                    and wulong_reference.get("textures", {}).get("base", {}).get("height") == 4_096
                    and wulong_reference.get("textures", {}).get("normal", {}).get("width") == 2_048
                    and wulong_reference.get("textures", {}).get("normal", {}).get("height") == 2_048,
                    wulong_reference.get("textures"),
                )
                capture_model(page, "Wulong", WULONG_SCREEN, wulong_reference)

                runtime_hashes = [model_runtime[name]["screenshot"]["sha256"] for name in ("Tuanjie", "Dali", "Wulong")]
                runtime_checksums = [model_runtime[name]["canvas"]["checksum"] for name in ("Tuanjie", "Dali", "Wulong")]
                runtime_sources = [model_runtime[name]["source"] for name in ("Tuanjie", "Dali", "Wulong")]
                add_result(
                    "three reference models produce distinct rendered frames",
                    all(runtime_hashes)
                    and all(isinstance(checksum, int) for checksum in runtime_checksums)
                    and len(set(runtime_sources)) == 3
                    and len(set(runtime_hashes)) == 3
                    and len(set(runtime_checksums)) == 3,
                    {
                        "sources": runtime_sources,
                        "screenshotSha256": runtime_hashes,
                        "canvasChecksums": runtime_checksums,
                    },
                )

                add_result("GitHub sync bridge", page.evaluate("!!window.__GITHUB_SYNC__"))
                page.wait_for_function(
                    "window.__GITHUB_SYNC__.stats().refreshState === 'complete'",
                    timeout=120_000,
                )
                refresh_generation = page.evaluate("window.__GITHUB_SYNC__.stats().refreshGeneration || 0")
                page.locator("#githubSyncLauncher").click()
                page.evaluate("() => { window.__GITHUB_SYNC__.refresh(true); }")
                page.wait_for_function(
                    "(previous) => { const stats = window.__GITHUB_SYNC__.stats(); return stats.refreshGeneration > previous && stats.refreshState === 'complete'; }",
                    arg=refresh_generation,
                    timeout=120_000,
                )
                add_result(
                    "GitHub sync panel",
                    page.locator("#githubSyncOverlay").is_visible() and page.locator("#githubSyncAdd").count() == 1,
                )
                sync_stats = page.evaluate("window.__GITHUB_SYNC__.stats()")
                required_requests = [request for request in sync_stats.get("requests", []) if request.get("required")]
                deployment = sync_stats.get("deployment") or {}
                add_result(
                    "GitHub sync uses commit under test",
                    not ARGS.run_sha
                    or (
                        deployment.get("headSha") == ARGS.run_sha
                        and deployment.get("ref") == ARGS.run_sha
                        and deployment.get("source") == "runtime-injected"
                    ),
                    deployment,
                )
                add_result(
                    "GitHub sync required source reads",
                    sync_stats.get("schemaVersion") == VERSION
                    and not sync_stats.get("error")
                    and not sync_stats.get("deploymentError")
                    and sync_stats.get("files") == 4
                    and len(required_requests) == 4
                    and all(request.get("outcome") == "fulfilled" and request.get("status") == 200 for request in required_requests),
                    sync_stats,
                )
                api_requests = [request for request in sync_stats.get("requests", []) if request.get("id", "").startswith("api:")]
                optional_requests = [request for request in sync_stats.get("requests", []) if request.get("required") is False]
                add_result(
                    "GitHub sync optional requests explicitly modeled",
                    len(api_requests) == 2
                    and len(optional_requests) == 2
                    and {request.get("id") for request in optional_requests} == {"api:commits", "api:issues"}
                    and all(
                        request.get("required") is False
                        and request.get("allowedStatuses") == [403, 429]
                        and request.get("optionalReason")
                        and request.get("url", "").startswith("https://api.github.com/repos/haihao0307/HOUSE/")
                        for request in optional_requests
                    ),
                    optional_requests,
                )

                mobile_page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
                mobile_page.on("pageerror", lambda exc: page_errors.append(str(exc)))
                mobile_page.on("console", capture_console)
                mobile_page.on("request", capture_request)
                mobile_page.on("response", capture_response)
                mobile_page.on("requestfailed", capture_request_failure)
                if injected_deployment:
                    mobile_page.add_init_script(
                        script="window.__GITHUB_SYNC_DEPLOYMENT__ = " + json.dumps(injected_deployment) + ";"
                    )
                mobile_page.goto(
                    f"http://127.0.0.1:{server.server_port}/index.html",
                    wait_until="load",
                    timeout=120_000,
                )
                mobile_page.wait_for_function("window.__APP_READY__ === true && !!window.__V521_TEST__", timeout=120_000)
                mobile_page.locator('[data-view="building"]').click()
                mobile_page.wait_for_function(
                    "document.querySelector('#buildingCanvas') && window.__V521_TEST__.stats().fallback === false",
                    timeout=120_000,
                )
                mobile_page.wait_for_function(
                    "window.__GITHUB_SYNC__.stats().refreshState === 'complete'",
                    timeout=120_000,
                )
                mobile_sync_stats = mobile_page.evaluate("window.__GITHUB_SYNC__.stats()")
                mobile_required = [
                    request for request in mobile_sync_stats.get("requests", []) if request.get("required")
                ]
                add_result(
                    "mobile GitHub sync required source reads",
                    len(mobile_required) == 4
                    and all(
                        request.get("outcome") == "fulfilled" and request.get("status") == 200
                        for request in mobile_required
                    ),
                    mobile_sync_stats,
                )
                mobile_metrics = mobile_page.evaluate("""() => {
                  const root = document.documentElement;
                  const body = document.body;
                  const canvas = document.querySelector('#buildingCanvas')?.getBoundingClientRect();
                  const controls = ['#m3OpenDemo', '#m3Tour', '#m3Cut'].map(selector => {
                    const rect = document.querySelector(selector)?.getBoundingClientRect();
                    return {selector, width: rect?.width || 0, height: rect?.height || 0};
                  });
                  return {
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight,
                    scrollWidth: Math.max(root.scrollWidth, body.scrollWidth),
                    canvas: canvas ? {left: canvas.left, right: canvas.right, width: canvas.width, height: canvas.height} : null,
                    controls
                  };
                }""")
                add_result(
                    "390px mobile layout",
                    mobile_metrics.get("innerWidth") == 390
                    and mobile_metrics.get("innerHeight") == 844
                    and mobile_metrics.get("scrollWidth", 9999) <= 391
                    and mobile_metrics.get("canvas") is not None
                    and mobile_metrics["canvas"].get("left", -1) >= 0
                    and mobile_metrics["canvas"].get("right", 9999) <= 391
                    and all(control.get("width", 0) > 0 and control.get("height", 0) > 0 for control in mobile_metrics.get("controls", [])),
                    mobile_metrics,
                )
                mobile_page.screenshot(path=str(MOBILE_SCREEN), full_page=False)
                mobile_page.close()
            finally:
                if browser is not None:
                    try:
                        browser.close()
                    except BaseException as exc:
                        add_process_failure(
                            "browser-cleanup",
                            {"message": str(exc), "traceback": traceback.format_exc()},
                            failure_type=type(exc).__name__,
                        )
                    browser = None
except BaseException as exc:
    add_process_failure(
        "uncaught-test-exception",
        {"message": str(exc), "traceback": traceback.format_exc()},
        failure_type=type(exc).__name__,
    )
finally:
    if server is not None:
        try:
            server.shutdown()
            server.server_close()
        except BaseException as exc:
            add_process_failure(
                "local-server-cleanup",
                {"message": str(exc), "traceback": traceback.format_exc()},
                failure_type=type(exc).__name__,
            )

classify_browser_diagnostics([sync_stats, mobile_sync_stats])

assertion_passed = sum(1 for item in results if item.get("ok"))
assertion_failed = len(results) - assertion_passed
process_failure_count = len(process_failures)
screenshots = []
for path in [SCREEN, TUANJIE_SCREEN, TUANJIE_LOCAL_SCREEN, DALI_SCREEN, WULONG_SCREEN, MOBILE_SCREEN]:
    if not path.is_file():
        continue
    payload = path.read_bytes()
    screenshots.append({
        "name": path.name,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    })

summary = {
    "passed": assertion_passed,
    "assertionFailed": assertion_failed,
    "processFailures": process_failure_count,
    "failed": assertion_failed + process_failure_count,
    "total": assertion_passed + assertion_failed + process_failure_count,
}
report = {
    "schemaVersion": VERSION,
    "version": VERSION,
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "runSha": ARGS.run_sha,
    "runRef": ARGS.run_ref,
    "viewport": {"width": 1440, "height": 1000},
    "performance": {
        "initial": state,
        "measuredBranch": measured_state,
        "upperFloorRegression": upper,
    },
    "modelRuntime": model_runtime,
    "githubSync": sync_stats,
    "mobileGithubSync": mobile_sync_stats,
    "screenshots": screenshots,
    "results": results,
    "processFailures": process_failures,
    "errors": process_failures,
    "diagnostics": {
        "pageErrors": page_errors,
        "consoleErrors": console_errors,
        "networkConsoleDiagnostics": network_console_diagnostics,
        "failedRequests": failed_requests,
        "httpErrors": http_errors,
        "forbiddenHighRequests": forbidden_high_requests,
        "allowedOptionalHttp": allowed_optional_http,
        "allowedNetworkConsole": allowed_network_console,
    },
    "summary": summary,
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(summary, ensure_ascii=False))
if summary["failed"]:
    raise SystemExit(1)
