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
SCREENSHOT = ROOT / "qa/screenshots/wall_v24_browser.png"
REPORT = ROOT / "data/qa/wall_v24_browser.json"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        return


def chrome_executable() -> str | None:
    for candidate in (
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
    ):
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
    url = f"http://127.0.0.1:{server.server_port}/component-studio/wall-lab-v24.html"

    console_errors: list[str] = []
    page_errors: list[str] = []
    try:
        with sync_playwright() as playwright:
            executable = chrome_executable()
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=executable,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--ignore-gpu-blocklist",
                    "--enable-unsafe-swiftshader",
                    "--use-angle=swiftshader",
                ],
            )
            page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.goto(url, wait_until="networkidle", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_V24__)", timeout=90_000)
            runtime = page.evaluate("() => window.__YUNNAN_WALL_V24__")
            canvas_box = page.locator("#wallCanvas").bounding_box()
            if not canvas_box or canvas_box["width"] < 700 or canvas_box["height"] < 450:
                raise RuntimeError(f"program wall canvas is too small: {canvas_box}")
            if runtime.get("version") != "2.4.0":
                raise RuntimeError(f"unexpected runtime version: {runtime}")
            if runtime.get("noise") != ["Perlin", "Simplex", "Worley"]:
                raise RuntimeError(f"noise stack mismatch: {runtime.get('noise')}")
            geometry = runtime.get("geometry") or {}
            if geometry.get("brickCount", 0) < 150 or geometry.get("stoneCount", 0) < 20:
                raise RuntimeError(f"generated geometry is incomplete: {geometry}")
            if geometry.get("openSurfaceCount") != 0:
                raise RuntimeError(f"open surface contract failed: {geometry}")

            screenshot = page.screenshot(path=str(SCREENSHOT), full_page=False)
            image = Image.open(BytesIO(screenshot)).convert("RGB")
            left = max(0, round(canvas_box["x"]))
            top = max(0, round(canvas_box["y"]))
            right = min(image.width, round(canvas_box["x"] + canvas_box["width"]))
            bottom = min(image.height, round(canvas_box["y"] + canvas_box["height"]))
            crop = image.crop((left, top, right, bottom)).resize((320, 180))
            pixels = list(crop.getdata())
            luminance = [0.2126 * red + 0.7152 * green + 0.0722 * blue for red, green, blue in pixels]
            white_fraction = sum(red > 244 and green > 244 and blue > 244 for red, green, blue in pixels) / len(pixels)
            unique_colors = len(set(pixels))
            luminance_stddev = statistics.pstdev(luminance)
            if white_fraction > 0.72:
                raise RuntimeError(f"canvas is visually washed out: white_fraction={white_fraction:.4f}")
            if unique_colors < 500 or luminance_stddev < 12:
                raise RuntimeError(
                    f"canvas lacks visible wall detail: unique_colors={unique_colors}, luminance_stddev={luminance_stddev:.3f}"
                )
            if console_errors or page_errors:
                raise RuntimeError(f"browser errors: console={console_errors}, page={page_errors}")

            report = {
                "schemaVersion": "1.0.0",
                "page": "component-studio/wall-lab-v24.html",
                "runtime": runtime,
                "canvas": canvas_box,
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
