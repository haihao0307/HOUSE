#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import statistics
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "qa/screenshots/wall_v24_browser.png"
REPORT = ROOT / "data/qa/wall_v24_browser.json"
REFERENCE_COUNT = 36


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


def make_reference_fixture(path: Path, index: int) -> None:
    base = (132 + index % 9 * 5, 82 + index % 7 * 4, 52 + index % 5 * 3)
    image = Image.new("RGB", (260, 170), base)
    draw = ImageDraw.Draw(image)
    for row in range(5):
        y = 14 + row * 27
        offset = 18 if row % 2 else 0
        for column in range(7):
            x = -16 + offset + column * 43
            fill = (151 + (index + row) % 5 * 4, 98 + column % 3 * 4, 63 + index % 4 * 3)
            draw.rounded_rectangle((x, y, x + 39, y + 21), radius=4, fill=fill, outline=(80, 50, 34), width=2)
    draw.rectangle((0, 140, 260, 170), fill=(104 + index % 6 * 3, 100, 88))
    draw.text((8, 147), f"REF {index + 1:02d}", fill=(238, 226, 202))
    image.save(path, quality=90)


def main() -> None:
    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    reference_fixtures = [Path(f"/tmp/wall_reference_smoke_{index:02d}.jpg") for index in range(REFERENCE_COUNT)]
    for index, path in enumerate(reference_fixtures):
        make_reference_fixture(path, index)

    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/component-studio/wall-lab-v24.html?githubMock=1"

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
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_LIBRARY_V24__)", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_GITHUB_BRIDGE__)", timeout=90_000)
            runtime = page.evaluate("() => window.__YUNNAN_WALL_V24__")
            library_runtime = page.evaluate("() => ({version: window.__YUNNAN_WALL_LIBRARY_V24__.version, count: window.__YUNNAN_WALL_LIBRARY_V24__.count})")
            bridge_runtime = page.evaluate("() => ({version: window.__YUNNAN_WALL_GITHUB_BRIDGE__.version, mode: window.__YUNNAN_WALL_GITHUB_BRIDGE__.mode, mock: window.__YUNNAN_WALL_GITHUB_BRIDGE__.mock})")
            canvas_box = page.locator("#wallCanvas").bounding_box()
            library_box = page.locator("#referenceLibrary").bounding_box()
            bridge_box = page.locator("#githubBridge").bounding_box()
            if not canvas_box or canvas_box["width"] < 700 or canvas_box["height"] < 450:
                raise RuntimeError(f"program wall canvas is too small: {canvas_box}")
            if not library_box or library_box["width"] < 240 or library_box["height"] < 550:
                raise RuntimeError(f"reference library is not usable: {library_box}")
            if not bridge_box or bridge_box["width"] < 220 or bridge_box["height"] < 180:
                raise RuntimeError(f"GitHub bridge is not usable: {bridge_box}")
            if runtime.get("version") != "2.4.0":
                raise RuntimeError(f"unexpected runtime version: {runtime}")
            if runtime.get("noise") != ["Perlin", "Simplex", "Worley"]:
                raise RuntimeError(f"noise stack mismatch: {runtime.get('noise')}")
            if library_runtime.get("version") != "2.4.1":
                raise RuntimeError(f"unexpected reference library version: {library_runtime}")
            if bridge_runtime != {
                "version": "2.5.0",
                "mode": "temporary-branch-exif-stripped-proxies",
                "mock": True,
            }:
                raise RuntimeError(f"unexpected GitHub bridge runtime: {bridge_runtime}")
            geometry = runtime.get("geometry") or {}
            if geometry.get("brickCount", 0) < 150 or geometry.get("stoneCount", 0) < 20:
                raise RuntimeError(f"generated geometry is incomplete: {geometry}")
            if geometry.get("openSurfaceCount") != 0:
                raise RuntimeError(f"open surface contract failed: {geometry}")

            page.set_input_files("#libraryFileInput", [str(path) for path in reference_fixtures])
            page.wait_for_function(
                f"() => window.__YUNNAN_WALL_LIBRARY_V24__.count >= {REFERENCE_COUNT}",
                timeout=60_000,
            )
            page.wait_for_selector(".reference-card", timeout=30_000)
            page.locator(".reference-card").first.click()
            page.wait_for_function("() => !document.querySelector('#referenceImage').hidden", timeout=30_000)
            card_count = page.locator(".reference-card").count()
            if card_count < REFERENCE_COUNT:
                raise RuntimeError(f"reference library lost cards: {card_count}/{REFERENCE_COUNT}")

            button_boxes: dict[str, dict[str, float] | None] = {}
            for button_id in ("githubTestButton", "githubPushButton", "githubCleanupButton"):
                locator = page.locator(f"#{button_id}")
                if not locator.is_visible():
                    raise RuntimeError(f"GitHub bridge button is hidden: {button_id}")
                box = locator.bounding_box()
                button_boxes[button_id] = box
                if not box:
                    raise RuntimeError(f"GitHub bridge button has no layout box: {button_id}")
                if box["y"] < library_box["y"] or box["y"] + box["height"] > library_box["y"] + library_box["height"]:
                    raise RuntimeError(f"GitHub bridge button is outside the visible library panel: {button_id} {box}")

            page.locator("#githubPushButton").click()
            page.wait_for_function(
                f"() => window.__YUNNAN_WALL_GITHUB_BRIDGE__.lastResult?.uploadedCount >= {REFERENCE_COUNT}",
                timeout=90_000,
            )
            push_result = page.evaluate("() => window.__YUNNAN_WALL_GITHUB_BRIDGE__.lastResult")
            if push_result.get("mock") is not True or push_result.get("uploadedCount", 0) < REFERENCE_COUNT:
                raise RuntimeError(f"mock GitHub evidence push failed: {push_result}")

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
                "schemaVersion": "1.3.0",
                "page": "component-studio/wall-lab-v24.html",
                "runtime": runtime,
                "referenceLibrary": {
                    "runtime": library_runtime,
                    "box": library_box,
                    "uploadedCardCount": card_count,
                    "activeReferenceVisible": True,
                },
                "githubBridge": {
                    "runtime": bridge_runtime,
                    "box": bridge_box,
                    "buttonBoxes": button_boxes,
                    "buttonsVisibleWithReferenceCount": REFERENCE_COUNT,
                    "mockPushResult": push_result,
                    "proxyOnly": True,
                },
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
        for path in reference_fixtures:
            path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
