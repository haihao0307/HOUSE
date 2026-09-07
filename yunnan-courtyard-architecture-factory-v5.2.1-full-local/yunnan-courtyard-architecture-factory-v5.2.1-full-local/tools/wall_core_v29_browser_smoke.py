#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import statistics
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "qa/screenshots/wall_core_v29_browser.png"
REPORT = ROOT / "data/qa/wall_core_v29_browser.json"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        return


def chrome_executable() -> str | None:
    for candidate in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        value = shutil.which(candidate)
        if value:
            return value
    return None


def main() -> None:
    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/component-studio/wall-core-lab.html"
    console_errors: list[str] = []
    page_errors: list[str] = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=chrome_executable(),
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--ignore-gpu-blocklist",
                    "--enable-unsafe-swiftshader",
                    "--use-angle=swiftshader",
                ],
            )
            page = browser.new_page(viewport={"width": 1760, "height": 1050}, device_scale_factor=1)
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.goto(url, wait_until="networkidle", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_CORE_V29__)", timeout=90_000)
            initial = page.evaluate("() => window.__YUNNAN_WALL_CORE_V29__")
            if initial.get("version") != "2.9.0":
                raise RuntimeError(f"unexpected wall core version: {initial}")
            if initial["geometry"]["coreSegmentCount"] != 3:
                raise RuntimeError(f"wall core segment contract failed: {initial['geometry']}")
            if initial["geometry"]["coreBoundaryEdges"] != 0 or initial["geometry"]["openSurfaceCount"] != 0:
                raise RuntimeError(f"wall core is open: {initial['geometry']}")
            if not initial["contract"]["closurePassed"]:
                raise RuntimeError(f"initial door closure failed: {initial['contract']}")

            revision = initial["geometryRevision"]
            page.evaluate(
                """() => window.__YUNNAN_WALL_CORE_V29__.applyParameters({
                  wallCoreWidth: 11.6,
                  wallSideTaper: 0.74,
                  wallDepthTaper: 0.19,
                  doorWidth: 1.82,
                  doorOffset: 0.68,
                  frameWidth: 0.24,
                  lintelHeight: 0.30,
                  lintelEmbed: 0.58,
                  closureOverlap: 0.036,
                  soilDarkness: 0.86,
                  topCoreReveal: 0.24
                })"""
            )
            page.wait_for_function(f"() => window.__YUNNAN_WALL_CORE_V29__.geometryRevision > {revision}", timeout=30_000)
            adjusted = page.evaluate("() => window.__YUNNAN_WALL_CORE_V29__")
            contract = adjusted["contract"]
            geometry = adjusted["geometry"]
            if abs(contract["wallWidth"] - 11.6) > 0.001:
                raise RuntimeError(f"wall width control did not apply: {contract}")
            if abs(contract["topHalf"] * 2 - (11.6 - 1.48)) > 0.02:
                raise RuntimeError(f"wall taper did not apply: {contract}")
            if not contract["closurePassed"] or contract["minPierActual"] < 0.42:
                raise RuntimeError(f"door closure did not survive parameter change: {contract}")
            if geometry["coreBoundaryEdges"] != 0 or geometry["openSurfaceCount"] != 0:
                raise RuntimeError(f"adjusted core is open: {geometry}")
            if geometry["brickDoorIntersections"] <= 0:
                raise RuntimeError(f"surface opening exclusion was not exercised: {geometry}")

            page.locator("#toggleCoreReview").click()
            page.wait_for_function("() => window.__YUNNAN_WALL_CORE_V29__.view.coreReview === true", timeout=10_000)
            page.locator("#toggleWireframe").click()
            page.wait_for_function("() => window.__YUNNAN_WALL_CORE_V29__.view.wireframeReview === true", timeout=10_000)
            canvas = page.locator("#wallCoreCanvas")
            box = canvas.bounding_box()
            if not box or box["width"] < 800 or box["height"] < 600:
                raise RuntimeError(f"wall core canvas too small: {box}")
            page.screenshot(path=str(SCREENSHOT), full_page=False)
            canvas_image = Image.open(BytesIO(canvas.screenshot())).convert("RGB").resize((320, 180))
            pixels = list(canvas_image.getdata())
            luminance = [0.2126 * red + 0.7152 * green + 0.0722 * blue for red, green, blue in pixels]
            white_fraction = sum(red > 244 and green > 244 and blue > 244 for red, green, blue in pixels) / len(pixels)
            unique_colors = len(set(pixels))
            luminance_stddev = statistics.pstdev(luminance)
            if white_fraction > 0.72 or unique_colors < 700 or luminance_stddev < 13:
                raise RuntimeError(
                    f"wall core visual failed: white={white_fraction:.4f}, colors={unique_colors}, std={luminance_stddev:.3f}"
                )
            if console_errors or page_errors:
                raise RuntimeError(f"browser errors: console={console_errors}, page={page_errors}")
            report = {
                "schemaVersion": "1.0.0",
                "page": "component-studio/wall-core-lab.html",
                "version": "2.9.0",
                "initial": initial,
                "adjusted": adjusted,
                "visual": {
                    "whiteFraction": round(white_fraction, 6),
                    "uniqueColors": unique_colors,
                    "luminanceStddev": round(luminance_stddev, 6),
                },
                "consoleErrors": console_errors,
                "pageErrors": page_errors,
                "passed": True,
            }
            REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
