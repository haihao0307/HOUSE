#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import statistics
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image
from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "qa/screenshots/wall_system_v30_browser.png"
REPORT = ROOT / "data/qa/wall_system_v30_browser.json"
PAGE_PATH = "component-studio/wall-system-lab.html"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        return

    def do_GET(self) -> None:  # noqa: N802 - inherited HTTP handler API
        if self.path.partition("?")[0] == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()


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


def numeric_value(mapping: dict[str, Any], *fragments: str) -> float | None:
    for key, value in mapping.items():
        lowered = key.lower()
        if all(fragment.lower() in lowered for fragment in fragments):
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                return float(value)
    return None


def runtime_snapshot(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """() => {
          const runtime = window.__YUNNAN_WALL_SYSTEM_V30__;
          if (!runtime) return null;
          const cleanObject = (value) => {
            const out = {};
            for (const [key, item] of Object.entries(value || {})) {
              if (typeof item === 'number' || typeof item === 'string' || typeof item === 'boolean' || item === null) {
                out[key] = item;
              }
            }
            return out;
          };
          const controlKeys = [];
          for (const definitions of Object.values(runtime.controlDefs || {})) {
            for (const definition of definitions || []) {
              if (definition?.key) controlKeys.push(definition.key);
            }
          }
          return {
            version: runtime.version,
            parameters: cleanObject(runtime.parameters),
            contract: cleanObject(runtime.contract),
            geometry: cleanObject(runtime.geometry),
            revision: Number(runtime.revision ?? runtime.geometryRevision ?? 0),
            controlKeys,
            hasApplyParameters: typeof runtime.applyParameters === 'function',
            hasRebuild: typeof runtime.rebuild === 'function'
          };
        }"""
    )


def assert_runtime(snapshot: dict[str, Any], label: str) -> None:
    if not snapshot:
        raise RuntimeError(f"{label}: runtime snapshot is empty")
    if snapshot.get("version") != "3.0.0":
        raise RuntimeError(f"{label}: unexpected runtime version {snapshot.get('version')}")

    parameters = snapshot.get("parameters") or {}
    required_parameters = (
        "edgeRoundness",
        "stoneAdobeOverlap",
        "outerPlasterCoverage",
        "innerPlasterCoverage",
    )
    missing_parameters = [key for key in required_parameters if key not in parameters]
    if missing_parameters:
        raise RuntimeError(f"{label}: missing parameters {missing_parameters}")

    geometry = snapshot.get("geometry") or {}
    if geometry.get("openSurfaceCount") != 0:
        raise RuntimeError(f"{label}: open surface contract failed {geometry}")

    top_gap = numeric_value(geometry, "top", "gap")
    if top_gap is not None and top_gap > 0.025:
        raise RuntimeError(f"{label}: top adobe gap is too large: {top_gap}")

    joint_gap = numeric_value(geometry, "joint", "gap")
    if joint_gap is not None and joint_gap > 0.012:
        raise RuntimeError(f"{label}: stone/adobe joint gap is too large: {joint_gap}")

    adobe_count = numeric_value(geometry, "adobe")
    if adobe_count is None:
        adobe_count = numeric_value(geometry, "brick")
    if adobe_count is not None and adobe_count < 40:
        raise RuntimeError(f"{label}: insufficient adobe geometry: {adobe_count}")

    stone_count = numeric_value(geometry, "stone", "count")
    if stone_count is None:
        stone_count = numeric_value(geometry, "stone")
    if stone_count is not None and stone_count < 8:
        raise RuntimeError(f"{label}: insufficient stone geometry: {stone_count}")

    contract = snapshot.get("contract") or {}
    if contract.get("closurePassed") is False:
        raise RuntimeError(f"{label}: door closure contract failed {contract}")
    min_pier = contract.get("minPierActual")
    required_pier = parameters.get("minPierWidth")
    if isinstance(min_pier, (int, float)) and isinstance(required_pier, (int, float)):
        if min_pier + 0.001 < required_pier:
            raise RuntimeError(
                f"{label}: minimum pier width failed: actual={min_pier}, required={required_pier}"
            )


def main() -> None:
    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)

    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/{PAGE_PATH}?qa=1"

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
            page = browser.new_page(
                viewport={"width": 1720, "height": 1080},
                device_scale_factor=1,
            )
            page.on(
                "console",
                lambda message: console_errors.append(message.text)
                if message.type == "error"
                else None,
            )
            page.on("pageerror", lambda error: page_errors.append(str(error)))

            page.goto(url, wait_until="networkidle", timeout=120_000)
            page.wait_for_function(
                "() => window.__YUNNAN_WALL_SYSTEM_V30__?.version === '3.0.0'",
                timeout=120_000,
            )
            page.wait_for_selector("#wallSystemCanvas", state="visible", timeout=60_000)
            page.wait_for_timeout(700)

            initial = runtime_snapshot(page)
            assert_runtime(initial, "initial")

            range_count = page.locator('input[type="range"]').count()
            if range_count < 24:
                raise RuntimeError(f"wall system exposes too few controls: {range_count}")

            adjusted = page.evaluate(
                """() => {
                  const runtime = window.__YUNNAN_WALL_SYSTEM_V30__;
                  const parameters = runtime.parameters || {};
                  const changes = {};
                  if ('topGap' in parameters) changes.topGap = Math.min(0.008, Number(parameters.topGap));
                  if ('topGapHeight' in parameters) changes.topGapHeight = Math.min(0.008, Number(parameters.topGapHeight));
                  if ('stoneAdobeOverlap' in parameters) changes.stoneAdobeOverlap = Math.max(0.045, Number(parameters.stoneAdobeOverlap));
                  if ('surfaceRelief' in parameters) changes.surfaceRelief = Math.min(0.022, Number(parameters.surfaceRelief));
                  if ('edgeRoundness' in parameters) changes.edgeRoundness = Math.max(0.84, Number(parameters.edgeRoundness));
                  if ('edgeWear' in parameters) changes.edgeWear = Math.max(0.82, Number(parameters.edgeWear));
                  if ('outerPlasterCoverage' in parameters) changes.outerPlasterCoverage = Math.max(0.46, Number(parameters.outerPlasterCoverage));
                  if ('innerPlasterCoverage' in parameters) changes.innerPlasterCoverage = Math.max(0.70, Number(parameters.innerPlasterCoverage));
                  if ('strawDensity' in parameters) changes.strawDensity = Math.max(0.56, Number(parameters.strawDensity));
                  if ('largeErosion' in parameters) changes.largeErosion = Math.max(0.68, Number(parameters.largeErosion));
                  if ('erosionCluster' in parameters) changes.erosionCluster = Math.max(0.72, Number(parameters.erosionCluster));
                  if (typeof runtime.applyParameters === 'function') runtime.applyParameters(changes);
                  return changes;
                }"""
            )
            page.wait_for_timeout(1_100)
            after = runtime_snapshot(page)
            assert_runtime(after, "adjusted")

            for key, value in adjusted.items():
                actual = (after.get("parameters") or {}).get(key)
                if isinstance(value, (int, float)) and isinstance(actual, (int, float)):
                    if abs(float(actual) - float(value)) > 0.002:
                        raise RuntimeError(
                            f"adjusted parameter did not persist: {key} expected={value} actual={actual}"
                        )

            for button_id in ("toggleCore", "togglePlaster", "toggleWire"):
                locator = page.locator(f"#{button_id}")
                if locator.count() and locator.is_visible():
                    locator.evaluate("element => element.click()")
                    page.wait_for_timeout(120)
            close_view = page.locator('[data-view="close"]')
            if close_view.count() and close_view.is_visible():
                close_view.evaluate("element => element.click()")
                page.wait_for_timeout(500)

            canvas = page.locator("#wallSystemCanvas")
            canvas_box = canvas.bounding_box()
            if not canvas_box or canvas_box["width"] < 700 or canvas_box["height"] < 500:
                raise RuntimeError(f"wall canvas is too small: {canvas_box}")

            canvas.scroll_into_view_if_needed()
            page.wait_for_timeout(350)
            page.screenshot(path=str(SCREENSHOT), full_page=False)
            canvas_image = Image.open(BytesIO(canvas.screenshot())).convert("RGB").resize((360, 220))
            pixels = list(canvas_image.getdata())
            luminance = [
                0.2126 * red + 0.7152 * green + 0.0722 * blue
                for red, green, blue in pixels
            ]
            white_fraction = sum(
                red > 244 and green > 244 and blue > 244
                for red, green, blue in pixels
            ) / len(pixels)
            unique_colors = len(set(pixels))
            luminance_stddev = statistics.pstdev(luminance)
            if white_fraction > 0.72:
                raise RuntimeError(f"canvas is washed out: {white_fraction:.4f}")
            if unique_colors < 900 or luminance_stddev < 14:
                raise RuntimeError(
                    f"canvas lacks wall detail: colors={unique_colors}, "
                    f"luminance_stddev={luminance_stddev:.3f}"
                )
            if console_errors or page_errors:
                raise RuntimeError(
                    f"browser errors: console={console_errors}, page={page_errors}"
                )

            report = {
                "schemaVersion": "1.1.0",
                "page": PAGE_PATH,
                "studioVersion": "3.0.0",
                "initial": initial,
                "adjusted": after,
                "appliedChanges": adjusted,
                "controlCount": range_count,
                "visual": {
                    "source": "wallSystemCanvas-element-screenshot",
                    "whiteFraction": round(white_fraction, 6),
                    "uniqueColors": unique_colors,
                    "luminanceStddev": round(luminance_stddev, 6),
                },
                "consoleErrors": console_errors,
                "pageErrors": page_errors,
                "passed": True,
            }
            REPORT.write_text(
                json.dumps(report, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
