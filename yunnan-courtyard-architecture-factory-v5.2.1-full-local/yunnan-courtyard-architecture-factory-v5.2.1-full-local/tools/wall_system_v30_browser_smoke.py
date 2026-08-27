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
SCREENSHOT = ROOT / "qa/screenshots/wall_system_v30_browser.png"
REPORT = ROOT / "data/qa/wall_system_v30_browser.json"


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
    url = f"http://127.0.0.1:{server.server_port}/component-studio/wall-system-lab.html"
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
            page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.goto(url, wait_until="networkidle", timeout=120_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_SYSTEM_V30__)", timeout=120_000)

            runtime = page.evaluate("() => window.__YUNNAN_WALL_SYSTEM_V30__")
            if runtime.get("version") != "3.0.0":
                raise RuntimeError(f"unexpected runtime version: {runtime.get('version')}")
            geometry = runtime.get("geometry") or {}
            contract = runtime.get("contract") or {}
            if geometry.get("brickCount", 0) < 120:
                raise RuntimeError(f"brick system incomplete: {geometry}")
            if geometry.get("stoneCount", 0) < 20:
                raise RuntimeError(f"stone system incomplete: {geometry}")
            if geometry.get("openSurfaceCount") != 0 or not geometry.get("doorClosurePassed"):
                raise RuntimeError(f"closure contract failed: {geometry}")
            if geometry.get("topGapActual", 1) > 0.03:
                raise RuntimeError(f"top closure gap too large: {geometry.get('topGapActual')}")
            if geometry.get("jointGapActual", 1) > 0.002:
                raise RuntimeError(f"stone-adobe joint gap: {geometry.get('jointGapActual')}")
            if geometry.get("brickProjection", 1) > 0.02:
                raise RuntimeError(f"default brick projection too large: {geometry.get('brickProjection')}")
            if not contract.get("closurePassed"):
                raise RuntimeError(f"door contract did not pass: {contract}")

            control_count = page.locator('input[type="range"][data-parameter]').count()
            if control_count < 50:
                raise RuntimeError(f"insufficient controls: {control_count}")

            page.evaluate(
                """() => window.__YUNNAN_WALL_SYSTEM_V30__.applyParameters({
                  wallWidth: 11.4,
                  sideTaper: 0.64,
                  topClosureGap: 0.006,
                  brickCourseAdjust: 3,
                  brickProjection: 0.009,
                  stoneCourseAdjust: 1,
                  stoneAdobeOverlap: 0.038,
                  outerPlasterCoverage: 0.48,
                  innerPlasterCoverage: 0.82,
                  edgeRoundness: 0.92,
                  edgeWear: 0.94,
                  largeWeathering: 0.91,
                  strawDensity: 0.78,
                  holeDensity: 0.62
                })"""
            )
            page.wait_for_function(
                """() => {
                  const runtime = window.__YUNNAN_WALL_SYSTEM_V30__;
                  return runtime?.parameters?.wallWidth === 11.4
                    && runtime.geometry.topGapActual <= 0.008
                    && runtime.geometry.jointGapActual <= 0.002;
                }""",
                timeout=90_000,
            )
            adjusted = page.evaluate("() => window.__YUNNAN_WALL_SYSTEM_V30__")
            adjusted_geometry = adjusted.get("geometry") or {}
            adjusted_contract = adjusted.get("contract") or {}
            if adjusted_geometry.get("openSurfaceCount") != 0 or not adjusted_geometry.get("doorClosurePassed"):
                raise RuntimeError(f"adjusted closure failed: {adjusted_geometry}")
            if adjusted_geometry.get("topGapActual", 1) > 0.008:
                raise RuntimeError(f"adjusted top gap failed: {adjusted_geometry}")
            if adjusted_geometry.get("jointGapActual", 1) > 0.002:
                raise RuntimeError(f"adjusted joint failed: {adjusted_geometry}")
            if adjusted_contract.get("minPierActual", 0) < adjusted["parameters"]["minPierWidth"] - 0.001:
                raise RuntimeError(f"adjusted pier contract failed: {adjusted_contract}")

            for button_id in ("toggleCore", "togglePlaster", "toggleWire"):
                page.locator(f"#{button_id}").click()
                page.wait_for_timeout(120)
            page.locator('[data-view="close"]').click()
            page.wait_for_timeout(400)

            canvas = page.locator("#wallSystemCanvas")
            canvas_box = canvas.bounding_box()
            if not canvas_box or canvas_box["width"] < 700 or canvas_box["height"] < 500:
                raise RuntimeError(f"wall canvas is too small: {canvas_box}")
            page.screenshot(path=str(SCREENSHOT), full_page=False)
            canvas_image = Image.open(BytesIO(canvas.screenshot())).convert("RGB").resize((360, 220))
            pixels = list(canvas_image.getdata())
            luminance = [0.2126 * red + 0.7152 * green + 0.0722 * blue for red, green, blue in pixels]
            white_fraction = sum(red > 244 and green > 244 and blue > 244 for red, green, blue in pixels) / len(pixels)
            unique_colors = len(set(pixels))
            luminance_stddev = statistics.pstdev(luminance)
            if white_fraction > 0.72:
                raise RuntimeError(f"canvas is washed out: {white_fraction:.4f}")
            if unique_colors < 900 or luminance_stddev < 14:
                raise RuntimeError(f"canvas lacks wall detail: colors={unique_colors}, luminance_stddev={luminance_stddev:.3f}")
              if console_errors or page_errors:
                raise RuntimeError(f"browser errors: console={console_errors}, page={page_errors}")

            report = {
                "schemaVersion": "1.0.0",
                "page": "component-studio/wall-system-lab.html",
                "studioVersion": "3.0.0",
                "initial": {"parameters": runtime.get("parameters"), "contract": contract, "geometry": geometry},
                "adjusted": {"parameters": adjusted.get("parameters"), "contract": adjusted_contract, "geometry": adjusted_geometry},
                "controlCount": control_count,
                "visual": {"whiteFraction": round(white_fraction, 6), "uniqueColors": unique_colors, "luminanceStddev": round(luminance_stddev, 6)},
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
