#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import statistics
import threading
import time
import traceback
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import Browser, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGE_PATH = "component-studio/wall-system-lab.html"
DEFAULT_OUTPUT = ROOT / ".qa-output/wall-system-v30-local"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        return

    def do_GET(self) -> None:  # noqa: N802 - inherited HTTP handler API
        if self.path.partition("?")[0] == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture commit-bound Yunnan wall V3.0 browser evidence")
    parser.add_argument("--base-url", help="Existing Pages base URL; omit to start a local server")
    parser.add_argument("--expected-sha", help="Require build.json to contain this exact deployed SHA")
    parser.add_argument("--run-sha", default=os.environ.get("GITHUB_SHA", "local"))
    parser.add_argument("--run-ref", default=os.environ.get("GITHUB_REF_NAME", "local"))
    parser.add_argument(
        "--output-dir",
        default=os.environ.get("WALL_V30_QA_OUTPUT_DIR", str(DEFAULT_OUTPUT)),
    )
    return parser.parse_args()


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


def runtime_snapshot(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """() => {
          const runtime = window.__YUNNAN_WALL_SYSTEM_V30__;
          if (!runtime) return null;
          const cleanObject = (value) => {
            const out = {};
            for (const [key, item] of Object.entries(value || {})) {
              if (typeof item === 'number' || typeof item === 'string' || typeof item === 'boolean' || item === null) {
                out[key] = Number.isFinite(item) || typeof item !== 'number' ? item : null;
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
            revision: Number(runtime.revision || 0),
            view: runtime.view,
            layers: cleanObject(runtime.layers),
            controlKeys,
            hasApplyParameters: typeof runtime.applyParameters === 'function',
            hasRebuild: typeof runtime.rebuild === 'function',
            hasSetView: typeof runtime.setView === 'function',
            hasSetLayerState: typeof runtime.setLayerState === 'function'
          };
        }"""
    )


def require_number(mapping: dict[str, Any], key: str, label: str) -> float:
    value = mapping.get(key)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise RuntimeError(f"{label}: missing numeric {key}: {value!r}")
    return float(value)


def assert_runtime(snapshot: dict[str, Any], label: str) -> None:
    if not snapshot:
        raise RuntimeError(f"{label}: runtime snapshot is empty")
    if snapshot.get("version") != "3.0.0":
        raise RuntimeError(f"{label}: unexpected runtime version {snapshot.get('version')}")
    for method in ("hasApplyParameters", "hasRebuild", "hasSetView", "hasSetLayerState"):
        if not snapshot.get(method):
            raise RuntimeError(f"{label}: runtime method missing: {method}")

    parameters = snapshot.get("parameters") or {}
    for key in (
        "seed",
        "edgeRoundness",
        "stoneIrregularity",
        "stoneAdobeOverlap",
        "outerPlasterCoverage",
        "innerPlasterCoverage",
    ):
        if key not in parameters:
            raise RuntimeError(f"{label}: missing parameter {key}")

    geometry = snapshot.get("geometry") or {}
    if geometry.get("measurementMethod") != "world-space-box-sampling-and-indexed-edge-topology":
        raise RuntimeError(f"{label}: runtime uses an unverified measurement method")
    if require_number(geometry, "corePieceCount", label) != 3:
        raise RuntimeError(f"{label}: core piece count failed: {geometry}")
    if require_number(geometry, "openSurfaceCount", label) != 0:
        raise RuntimeError(f"{label}: indexed topology has open edges: {geometry}")
    if require_number(geometry, "jointSampleCount", label) < 20:
        raise RuntimeError(f"{label}: insufficient stone/adobe world samples: {geometry}")
    if require_number(geometry, "jointGapActual", label) > 0.002:
        raise RuntimeError(f"{label}: measured stone/adobe gap exceeds 2 mm: {geometry}")
    if require_number(geometry, "topGapActual", label) > 0.030:
        raise RuntimeError(f"{label}: measured wall-top adobe gap exceeds 30 mm: {geometry}")
    if require_number(geometry, "brickCount", label) < 120:
        raise RuntimeError(f"{label}: insufficient adobe geometry: {geometry}")
    if require_number(geometry, "stoneCount", label) < 20:
        raise RuntimeError(f"{label}: insufficient stone geometry: {geometry}")
    if require_number(geometry, "outerPatchCount", label) < 1:
        raise RuntimeError(f"{label}: exterior plaster geometry is absent: {geometry}")
    if require_number(geometry, "innerPatchCount", label) < 1:
        raise RuntimeError(f"{label}: interior plaster geometry is absent: {geometry}")
    if require_number(geometry, "outerPlasterCoverageActual", label) < 0.05:
        raise RuntimeError(f"{label}: exterior plaster measured coverage is too low: {geometry}")
    if require_number(geometry, "innerPlasterCoverageActual", label) < 0.05:
        raise RuntimeError(f"{label}: interior plaster measured coverage is too low: {geometry}")
    if require_number(geometry, "erosionSampleCount", label) < 500:
        raise RuntimeError(f"{label}: continuous erosion field is undersampled: {geometry}")
    if require_number(geometry, "erosionStddev", label) <= 0.001:
        raise RuntimeError(f"{label}: continuous erosion field is flat: {geometry}")
    if not geometry.get("surfaceFingerprint"):
        raise RuntimeError(f"{label}: deterministic surface fingerprint is absent")

    contract = snapshot.get("contract") or {}
    if contract.get("closurePassed") is not True:
        raise RuntimeError(f"{label}: door closure contract failed: {contract}")
    min_pier = require_number(contract, "minPierActual", label)
    required_pier = require_number(parameters, "minPierWidth", label)
    if min_pier + 0.001 < required_pier:
        raise RuntimeError(
            f"{label}: minimum pier width failed: actual={min_pier}, required={required_pier}"
        )


def image_metrics(data: bytes) -> dict[str, Any]:
    source = Image.open(BytesIO(data)).convert("RGB")
    sampled = source.resize((360, 220))
    pixels = list(sampled.getdata())
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
    if white_fraction > 0.78:
        raise RuntimeError(f"canvas is washed out: {white_fraction:.4f}")
    if unique_colors < 750 or luminance_stddev < 12:
        raise RuntimeError(
            f"canvas lacks wall detail: colors={unique_colors}, "
            f"luminance_stddev={luminance_stddev:.3f}"
        )
    return {
        "width": source.width,
        "height": source.height,
        "whiteFraction": round(white_fraction, 6),
        "uniqueColors": unique_colors,
        "luminanceStddev": round(luminance_stddev, 6),
    }


def apply_parameters(page: Page, values: dict[str, float]) -> dict[str, Any]:
    before = runtime_snapshot(page)
    page.evaluate(
        "values => window.__YUNNAN_WALL_SYSTEM_V30__.applyParameters(values)",
        values,
    )
    page.wait_for_function(
        "revision => window.__YUNNAN_WALL_SYSTEM_V30__?.revision > revision",
        arg=before["revision"],
        timeout=90_000,
    )
    page.wait_for_timeout(220)
    after = runtime_snapshot(page)
    for key, expected in values.items():
        actual = (after.get("parameters") or {}).get(key)
        if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
            if abs(float(expected) - float(actual)) > 0.002:
                raise RuntimeError(
                    f"parameter did not persist: {key} expected={expected} actual={actual}"
                )
    return after


def set_scene(page: Page, view: str, *, plaster: bool = True, core: bool = False, wire: bool = False) -> None:
    page.evaluate(
        """state => {
          const runtime = window.__YUNNAN_WALL_SYSTEM_V30__;
          runtime.setLayerState({
            plasterVisible: state.plaster,
            coreReview: state.core,
            wireVisible: state.wire
          });
          runtime.setView(state.view);
        }""",
        {"view": view, "plaster": plaster, "core": core, "wire": wire},
    )
    page.wait_for_timeout(480)


def capture_canvas(page: Page, output: Path, name: str) -> tuple[dict[str, Any], bytes]:
    canvas = page.locator("#wallSystemCanvas")
    box = canvas.bounding_box()
    if not box or box["width"] < 700 or box["height"] < 500:
        raise RuntimeError(f"{name}: wall canvas is too small: {box}")
    path = output / "screenshots" / f"{name}.png"
    data = canvas.screenshot(path=str(path))
    metrics = image_metrics(data)
    snapshot = runtime_snapshot(page)
    record = {
        "name": name,
        "file": str(path.name),
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
        "view": snapshot.get("view"),
        "layers": snapshot.get("layers"),
        "seed": (snapshot.get("parameters") or {}).get("seed"),
        "surfaceFingerprint": (snapshot.get("geometry") or {}).get("surfaceFingerprint"),
        "metrics": metrics,
    }
    return record, data


def image_difference(first: bytes, second: bytes) -> float:
    image_a = Image.open(BytesIO(first)).convert("RGB")
    image_b = Image.open(BytesIO(second)).convert("RGB")
    if image_a.size != image_b.size:
        raise RuntimeError(f"image dimensions differ: {image_a.size} != {image_b.size}")
    difference = ImageChops.difference(image_a, image_b)
    return sum(ImageStat.Stat(difference).mean) / 3


def wait_for_deployed_sha(base_url: str, expected_sha: str) -> dict[str, Any]:
    build_url = urllib.parse.urljoin(base_url.rstrip("/") + "/", "build.json")
    last_error = "not requested"
    for _attempt in range(30):
        try:
            request = urllib.request.Request(build_url, headers={"Cache-Control": "no-cache"})
            with urllib.request.urlopen(request, timeout=15) as response:
                build = json.load(response)
            if build.get("sha") == expected_sha:
                if build.get("wallSystemVersion") != "3.0.0":
                    raise RuntimeError(f"deployed build lacks wallSystemVersion 3.0.0: {build}")
                return build
            last_error = f"deployed SHA {build.get('sha')}"
        except Exception as error:  # network diagnostics are reported after bounded retry
            last_error = str(error)
        time.sleep(5)
    raise RuntimeError(f"public build did not reach exact SHA {expected_sha}: {last_error}")


def browser_launch(playwright: Any) -> Browser:
    launch_options: dict[str, Any] = {
        "headless": True,
        "args": [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--ignore-gpu-blocklist",
            "--enable-unsafe-swiftshader",
            "--use-angle=swiftshader",
        ],
    }
    executable = chrome_executable()
    if executable:
        launch_options["executable_path"] = executable
    return playwright.chromium.launch(**launch_options)


def run_browser(page: Page, url: str, output: Path, report: dict[str, Any]) -> None:
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []
    bad_responses: list[str] = []
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url}"))
    page.on(
        "response",
        lambda response: bad_responses.append(f"{response.status} {response.url}")
        if response.status >= 400
        else None,
    )

    page.goto(url, wait_until="networkidle", timeout=120_000)
    page.wait_for_function(
        "() => window.__YUNNAN_WALL_SYSTEM_V30__?.version === '3.0.0'",
        timeout=120_000,
    )
    page.wait_for_selector("body[data-wall-system-ready='true']", timeout=60_000)
    page.wait_for_selector("#wallSystemCanvas", state="visible", timeout=60_000)
    page.wait_for_timeout(900)

    initial = runtime_snapshot(page)
    assert_runtime(initial, "initial")
    control_count = page.locator('input[type="range"]').count()
    if control_count < 55:
        raise RuntimeError(f"wall system exposes too few controls: {control_count}")

    evidence: list[dict[str, Any]] = []
    set_scene(page, "oblique")
    record, _ = capture_canvas(page, output, "01-exterior-oblique")
    evidence.append(record)
    set_scene(page, "front")
    record, _ = capture_canvas(page, output, "02-exterior-front")
    evidence.append(record)
    set_scene(page, "interior")
    record, _ = capture_canvas(page, output, "03-interior-plaster")
    evidence.append(record)
    set_scene(page, "plaster")
    record, _ = capture_canvas(page, output, "04-plaster-break")
    evidence.append(record)
    set_scene(page, "joint")
    record, _ = capture_canvas(page, output, "05-stone-adobe-joint")
    evidence.append(record)

    rounded = apply_parameters(page, {"edgeRoundness": 0.92, "edgeWear": 0.90, "pitting": 0.82})
    assert_runtime(rounded, "rounded")
    set_scene(page, "close")
    record, _ = capture_canvas(page, output, "06-rounded-erosion")
    evidence.append(record)

    low_roundness = apply_parameters(page, {"edgeRoundness": 0.0})
    low_radius = require_number(low_roundness["geometry"], "brickRoundnessActual", "low-roundness")
    high_roundness = apply_parameters(page, {"edgeRoundness": 0.92})
    high_radius = require_number(high_roundness["geometry"], "brickRoundnessActual", "high-roundness")
    if high_radius <= low_radius + 0.02:
        raise RuntimeError(f"edgeRoundness does not change geometry enough: {low_radius} -> {high_radius}")

    low_stone = apply_parameters(page, {"stoneIrregularity": 0.0})
    low_stone_stddev = require_number(low_stone["geometry"], "stoneWidthStddev", "low-stone")
    high_stone = apply_parameters(page, {"stoneIrregularity": 0.95})
    high_stone_stddev = require_number(high_stone["geometry"], "stoneWidthStddev", "high-stone")
    if high_stone_stddev <= low_stone_stddev + 0.005:
        raise RuntimeError(
            f"stoneIrregularity does not control stone width distribution: "
            f"{low_stone_stddev} -> {high_stone_stddev}"
        )

    low_erosion = apply_parameters(
        page,
        {"largeWeathering": 0.05, "rainWash": 0.0, "dampRise": 0.0},
    )
    low_erosion_stddev = require_number(low_erosion["geometry"], "erosionStddev", "low-erosion")
    high_erosion = apply_parameters(
        page,
        {"largeWeathering": 0.95, "rainWash": 0.82, "dampRise": 0.62},
    )
    high_erosion_stddev = require_number(high_erosion["geometry"], "erosionStddev", "high-erosion")
    if high_erosion_stddev <= low_erosion_stddev * 1.8:
        raise RuntimeError(
            f"layered erosion field does not respond strongly enough: "
            f"{low_erosion_stddev} -> {high_erosion_stddev}"
        )
    assert_runtime(high_erosion, "high-erosion")
    set_scene(page, "plaster")
    record, _ = capture_canvas(page, output, "07-layered-erosion-heavy")
    evidence.append(record)

    zero_plaster = apply_parameters(page, {"outerPlasterCoverage": 0.0})
    if require_number(zero_plaster["geometry"], "outerPatchCount", "zero-plaster") != 0:
        raise RuntimeError(f"outer plaster coverage zero still creates geometry: {zero_plaster}")
    if require_number(zero_plaster["geometry"], "outerPlasterCoverageActual", "zero-plaster") != 0:
        raise RuntimeError(f"outer plaster coverage zero still reports area: {zero_plaster}")
    set_scene(page, "front", plaster=False)
    record, _ = capture_canvas(page, output, "08-plaster-off-adobe-reveal")
    evidence.append(record)

    seeded_values = {
        "seed": 731,
        "outerPlasterCoverage": 0.46,
        "innerPlasterCoverage": 0.72,
        "largeWeathering": 0.82,
        "rainWash": 0.68,
        "dampRise": 0.58,
        "edgeRoundness": 0.82,
        "stoneIrregularity": 0.82,
    }
    seed_a = apply_parameters(page, seeded_values)
    assert_runtime(seed_a, "seed-a")
    set_scene(page, "front", plaster=True)
    record_a, image_a = capture_canvas(page, output, "09-seed-731")
    evidence.append(record_a)
    seed_a_repeat = apply_parameters(page, seeded_values)
    assert_runtime(seed_a_repeat, "seed-a-repeat")
    set_scene(page, "front", plaster=True)
    repeat_record, image_a_repeat = capture_canvas(page, output, "10-seed-731-repeat")
    evidence.append(repeat_record)
    if seed_a["geometry"]["surfaceFingerprint"] != seed_a_repeat["geometry"]["surfaceFingerprint"]:
        raise RuntimeError("same seed produced a different surface fingerprint")
    deterministic_difference = image_difference(image_a, image_a_repeat)
    if deterministic_difference > 0.65:
        raise RuntimeError(f"same seed changed rendered pixels: mean difference={deterministic_difference}")

    seed_b = apply_parameters(page, {**seeded_values, "seed": 1931})
    assert_runtime(seed_b, "seed-b")
    if seed_b["geometry"]["surfaceFingerprint"] == seed_a["geometry"]["surfaceFingerprint"]:
        raise RuntimeError("different seeds produced the same surface fingerprint")
    set_scene(page, "front", plaster=True)
    record_b, image_b = capture_canvas(page, output, "11-seed-1931")
    evidence.append(record_b)
    cross_seed_difference = image_difference(image_a, image_b)
    if cross_seed_difference < 0.8:
        raise RuntimeError(f"different seeds do not visibly change the wall: {cross_seed_difference}")

    page.screenshot(path=str(output / "screenshots/00-workbench-overview.png"), full_page=False)
    if len(evidence) < 9:
        raise RuntimeError(f"insufficient visual evidence views: {len(evidence)}")
    if console_errors or page_errors or failed_requests or bad_responses:
        raise RuntimeError(
            "browser errors: "
            f"console={console_errors}, page={page_errors}, "
            f"requests={failed_requests}, responses={bad_responses}"
        )

    report.update(
        {
            "initial": initial,
            "final": seed_b,
            "controlCount": control_count,
            "parameterEffects": {
                "edgeRoundnessMeters": {"low": low_radius, "high": high_radius},
                "stoneWidthStddev": {"low": low_stone_stddev, "high": high_stone_stddev},
                "erosionStddev": {"low": low_erosion_stddev, "high": high_erosion_stddev},
                "sameSeedPixelMeanDifference": deterministic_difference,
                "differentSeedPixelMeanDifference": cross_seed_difference,
                "sameSeedFingerprintStable": True,
                "differentSeedFingerprintChanges": True,
                "zeroExteriorCoverageCreatesZeroPatches": True,
            },
            "evidence": evidence,
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "failedRequests": failed_requests,
            "badResponses": bad_responses,
        }
    )


def main() -> None:
    args = parse_args()
    output = Path(args.output_dir).resolve()
    screenshots = output / "screenshots"
    screenshots.mkdir(parents=True, exist_ok=True)
    report_path = output / "report.json"
    report: dict[str, Any] = {
        "schemaVersion": "2.0.0",
        "page": PAGE_PATH,
        "studioVersion": "3.0.0",
        "run": {
            "sha": args.run_sha,
            "ref": args.run_ref,
            "runId": os.environ.get("GITHUB_RUN_ID", "local"),
            "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT", "local"),
        },
        "expectedSha": args.expected_sha,
        "baseUrl": args.base_url or "local",
        "passed": False,
    }

    server: ThreadingHTTPServer | None = None
    page: Page | None = None
    browser: Browser | None = None
    try:
        if args.base_url:
            if args.expected_sha:
                report["deployedBuild"] = wait_for_deployed_sha(args.base_url, args.expected_sha)
            url = urllib.parse.urljoin(args.base_url.rstrip("/") + "/", f"{PAGE_PATH}?qa=1")
        else:
            handler = lambda *items, **kwargs: QuietHandler(*items, directory=str(ROOT), **kwargs)
            server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            url = f"http://127.0.0.1:{server.server_port}/{PAGE_PATH}?qa=1"
        report["url"] = url

        with sync_playwright() as playwright:
            browser = browser_launch(playwright)
            page = browser.new_page(
                viewport={"width": 1720, "height": 1080},
                device_scale_factor=1,
            )
            run_browser(page, url, output, report)
            report["passed"] = True
    except Exception as error:
        report["error"] = str(error)
        report["traceback"] = traceback.format_exc()
        if page is not None:
            try:
                page.screenshot(path=str(screenshots / "99-failure-diagnostic.png"), full_page=False)
            except Exception as screenshot_error:
                report["diagnosticScreenshotError"] = str(screenshot_error)
    finally:
        if browser is not None:
            browser.close()
        if server is not None:
            server.shutdown()
            server.server_close()
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False),
            encoding="utf-8",
        )

    if not report["passed"]:
        raise SystemExit(f"wall system V3.0 browser QA failed; see {report_path}")
    print(f"Wall system V3.0 browser QA passed: {report_path}")


if __name__ == "__main__":
    main()
