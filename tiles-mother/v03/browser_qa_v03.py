"""Real Chromium QA for the Jiangwutang V0.3 material candidate.

This test exercises only the lightweight first-party workbench.  It never
loads the source FBX, source PNGs, or the source ZIP.  Screenshots are small
canvas/viewport evidence, not source-texture replacements.
"""

from __future__ import annotations

import argparse
import functools
import hashlib
import http.server
import json
import shutil
import threading
import traceback
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "tiles-mother" / "qa-v03"
OUT.mkdir(parents=True, exist_ok=True)
INDEX = ROOT / "tiles-mother" / "index.html"
MANIFEST = ROOT / "tiles-mother" / "v03" / "build-manifest.json"

parser = argparse.ArgumentParser()
parser.add_argument("--url")
args = parser.parse_args()


def normalized_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
report = {
    "schema": "tiles-mother-v03-browser-report",
    "version": "0.3.0",
    "publicURL": args.url,
    "testedSourceSHA256": normalized_sha(INDEX),
    "manifestIndexSHA256": manifest.get("indexSHA256"),
    "visualApproved": False,
    "productionApproved": False,
    "tests": [],
    "families": {},
    "screenshots": [],
    "pageErrors": [],
    "consoleErrors": [],
    "failedRequests": [],
    "unexpectedNetworkRequests": [],
    "allPassed": False,
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


server = None
if args.url:
    url = args.url
else:
    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}/tiles-mother/index.html"
report["testedURL"] = url


def check(name, value, detail=None):
    passed = bool(value)
    record = {"name": name, "passed": passed}
    if detail is not None:
        record["detail"] = detail
    report["tests"].append(record)
    print(name, passed, str(detail)[:180], flush=True)
    if not passed:
        raise AssertionError(f"{name}: {detail}")


def ready(page):
    page.wait_for_function(
        'document.body.dataset.appInitialized === "true" && '
        'document.body.dataset.tilesMotherReady === "true"',
        timeout=60000,
    )


def instrument(page, label):
    page.on(
        "pageerror",
        lambda error: report["pageErrors"].append(f"{label}: {error}"),
    )
    page.on(
        "console",
        lambda message: report["consoleErrors"].append(f"{label}: {message.text}")
        if message.type == "error"
        else None,
    )
    page.on(
        "requestfailed",
        lambda request: report["failedRequests"].append(
            {"page": label, "url": request.url, "failure": request.failure}
        ),
    )
    local_prefix = url.split("/tiles-mother/")[0]
    page.on(
        "request",
        lambda request: report["unexpectedNetworkRequests"].append(request.url)
        if request.url.startswith(("http:", "https:"))
        and not request.url.startswith(local_prefix)
        else None,
    )


def shot(page, name, locator=None, full_page=False):
    path = OUT / name
    if locator is None:
        page.screenshot(path=str(path), full_page=full_page, type="jpeg", quality=82)
    else:
        locator.screenshot(path=str(path), type="png")
    report["screenshots"].append({"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size})
    return path


def select_candidate(page):
    preset = page.locator("#materialPreset")
    if not preset.is_visible():
        page.locator("details.control-group").filter(has_text="独立种子与色系").locator("summary").click()
    page.locator("#materialPreset").select_option("jiangwutang-v03")
    page.wait_for_timeout(250)


def geometry_state(page):
    return page.evaluate(
        "({hashes:TilesMother.getGeometryHashes(), builds:TilesMother.getGeometryBuilds(), "
        "project:TilesMother.getProject(), camera:TilesMother.getCamera()})"
    )


try:
    check("deterministic build manifest matches working candidate", normalized_sha(INDEX) == manifest["indexSHA256"], {"actual": normalized_sha(INDEX), "manifest": manifest["indexSHA256"]})
    check("runtime does not depend on raw source", not manifest["rawSourceInRuntime"] and not manifest["completeLargeTexturesInRuntime"])
    with sync_playwright() as playwright:
        executable = next(
            (
                candidate
                for candidate in (
                    shutil.which("google-chrome"),
                    shutil.which("google-chrome-stable"),
                    shutil.which("chromium"),
                    shutil.which("chromium-browser"),
                    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                )
                if candidate and Path(candidate).is_file()
            ),
            None,
        )
        launch_kwargs = {"headless": True, "args": [
            "--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl",
            "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader",
            "--use-gl=angle", "--use-angle=swiftshader",
        ]}
        if executable:
            launch_kwargs["executable_path"] = executable
        browser = playwright.chromium.launch(**launch_kwargs)
        report["browserVersion"] = browser.version
        context = browser.new_context(viewport={"width": 1536, "height": 960}, device_scale_factor=1)
        page = context.new_page()
        instrument(page, "desktop")
        response = page.goto(url, wait_until="networkidle", timeout=60000)
        check("entry HTTP 200", response is not None and response.status == 200, response.status if response else None)
        ready(page)
        check("workbench version", page.evaluate("TilesMother.version") == "0.3.0")
        check("V0.3 generator loaded", page.evaluate("TilesMotherJiangwutang.version") == "0.3.0")
        check("WebGL2 real context", page.evaluate("!!document.getElementById('gl').getContext('webgl2')"))
        check("IndexedDB ready", page.evaluate("TilesMother.getStorage().dbReady"))
        check("V0.2 fallback is visible", page.locator("#materialPreset option[value='legacy-v02']").count() == 1)
        check("old V0.2 QA evidence remains", (ROOT / "tiles-mother" / "qa-v02" / "browser-report.json").is_file())

        for family in ("pan", "cover"):
            page.evaluate("f => TilesMother.setProfile(f)", family)
            select_candidate(page)
            page.wait_for_timeout(400)
            qa = page.evaluate("TilesMother.runQA()")
            check(f"{family} built-in QA", qa["allPassed"], qa)
            check(f"{family} uses V0.3 candidate", qa["materialPreset"] == "jiangwutang-v03" and qa["materialCandidate"]["profile"] == family)
            state = geometry_state(page)
            project = state["project"]
            check(f"{family} source approval flags remain false", not project["visualApproved"] and not project["productionApproved"])

            baseline_hashes = state["hashes"]
            baseline_builds = state["builds"]
            baseline_seed = project["profiles"][family]["seeds"]
            page.evaluate("v => TilesMother.setSeed('color', v)", baseline_seed["color"] + 1)
            page.wait_for_timeout(300)
            color_state = geometry_state(page)
            check(f"{family} color seed does not change geometry", color_state["hashes"] == baseline_hashes and color_state["builds"] == baseline_builds)
            page.evaluate("v => TilesMother.setSeed('micro', v)", baseline_seed["micro"] + 1)
            page.wait_for_timeout(300)
            micro_state = geometry_state(page)
            check(f"{family} micro seed does not change geometry", micro_state["hashes"] == baseline_hashes and micro_state["builds"] == baseline_builds)
            page.evaluate("v => TilesMother.setSeed('shape', v)", baseline_seed["shape"] + 1)
            page.wait_for_timeout(350)
            shape_state = geometry_state(page)
            check(f"{family} shape seed changes geometry", shape_state["hashes"] != baseline_hashes)
            page.evaluate("v => TilesMother.setSeed('master', v)", project["profiles"][family]["seeds"]["master"])
            page.wait_for_timeout(350)
            select_candidate(page)

            page.locator("button[data-layout='trio']").click()
            page.wait_for_timeout(450)
            trio_hashes = page.evaluate("TilesMother.getGeometryHashes()")
            check(f"{family} has three distinct browser variants", len(trio_hashes) == 3 and len(set(trio_hashes)) == 3, trio_hashes)
            shot(page, f"{family}-trio-v03.jpg")
            page.locator("button[data-layout='single']").click()
            page.wait_for_timeout(350)

            page.locator("#channel").select_option("albedo")
            page.wait_for_timeout(200)
            shot(page, f"{family}-albedo-v03.jpg")
            page.locator("#channel").select_option("final")
            page.wait_for_timeout(200)
            shot(page, f"{family}-final-v03.jpg")

            canvas = page.locator("#gl")
            box = canvas.bounding_box()
            camera_before = page.evaluate("TilesMother.getCamera()")
            x = box["x"] + box["width"] * 0.52
            y = box["y"] + box["height"] * 0.50
            page.mouse.move(x, y)
            page.mouse.down()
            page.mouse.move(x + 80, y + 28, steps=8)
            page.mouse.up()
            page.mouse.wheel(0, -120)
            page.wait_for_timeout(250)
            camera_after = page.evaluate("TilesMother.getCamera()")
            camera_hashes = page.evaluate("TilesMother.getGeometryHashes()")
            check(f"{family} camera changes without texture/geometry drift", camera_before["yaw"] != camera_after["yaw"] and camera_hashes == baseline_hashes)
            report["families"][family] = {
                "qa": qa,
                "baselineGeometryHashes": baseline_hashes,
                "threeVariantGeometryHashes": trio_hashes,
                "cameraBefore": camera_before,
                "cameraAfter": camera_after,
            }

        page.evaluate("TilesMother.setProfile('pan')")
        select_candidate(page)
        page.locator("button[data-layout='single']").click()
        page.wait_for_timeout(350)
        page.locator("#materialPreset").select_option("legacy-v02")
        page.wait_for_timeout(250)
        check("V0.2 fallback actually selects legacy renderer", page.evaluate("TilesMother.getProject().materialPreset") == "legacy-v02")
        shot(page, "pan-legacy-v02-compare.jpg")
        select_candidate(page)
        page.wait_for_timeout(250)

        # The UI writes project state through its normal saveSoon path. Reload
        # verifies migration/compatibility without reading browser storage.
        page.locator("#masterSeed").fill("880031")
        page.locator("#masterSeed").press("Enter")
        page.wait_for_timeout(800)
        page.reload(wait_until="networkidle", timeout=60000)
        ready(page)
        check("V0.3 project survives reload", page.evaluate("TilesMother.getProject().version") == "0.3.0")
        check("candidate selection survives reload", page.locator("#materialPreset").input_value() == "jiangwutang-v03")
        check("seed edit survives reload", page.locator("#masterSeed").input_value() == "880031")

        mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        mobile = mobile_context.new_page()
        instrument(mobile, "mobile")
        mobile.goto(url, wait_until="networkidle", timeout=60000)
        ready(mobile)
        check("mobile WebGL2 ready", mobile.evaluate("!!document.getElementById('gl').getContext('webgl2')"))
        check("mobile no horizontal overflow", mobile.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        shot(mobile, "mobile-v03.jpg", full_page=True)
        mobile_context.close()

        check("no uncaught page errors", not report["pageErrors"], report["pageErrors"])
        check("no console errors", not report["consoleErrors"], report["consoleErrors"])
        check("no failed requests", not report["failedRequests"], report["failedRequests"])
        check("no unexpected external requests", not report["unexpectedNetworkRequests"], report["unexpectedNetworkRequests"])
        report["allPassed"] = True
        browser.close()
except Exception as error:
    report["error"] = str(error)
    report["traceback"] = traceback.format_exc()
    try:
        shot(page, "failure-v03.jpg")
    except Exception:
        pass
    raise
finally:
    if server:
        server.shutdown()
    (OUT / "browser-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
