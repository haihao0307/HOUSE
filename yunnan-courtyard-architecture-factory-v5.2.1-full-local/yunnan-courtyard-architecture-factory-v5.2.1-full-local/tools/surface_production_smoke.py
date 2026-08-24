#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import subprocess
import sys
import threading
import time
import traceback
import zlib
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "data/qa/yunnan_surface_production_smoke_v5_5_0.json"
DEFAULT_SCREENSHOTS = ROOT / "qa/screenshots"
PUBLIC_READINESS_TIMEOUT_SECONDS = 180.0
PUBLIC_READINESS_POLL_SECONDS = 2.0
PUBLIC_READINESS_REQUEST_TIMEOUT_SECONDS = 15.0
PUBLIC_READINESS_RESOURCES = (
    ("build", "build.json", "json"),
    ("surfaceLab", "surface-production-lab.html", "html"),
    ("surfaceSeed", "data/production/yunnan_surface_weathering_seed_v5_5_0.json", "json"),
)

EXPECTED_ROOFS = {
    "mainHouseDoublePitch",
    "leftEarAsymmetricDoublePitch",
    "rightEarAsymmetricDoublePitch",
    "entranceBlockDoublePitch",
    "mainGalleryLeanTo",
    "sideGalleryLeanTo",
    "gatehouseSmallRoof",
}
EXPECTED_SLOPE_COUNTS = {
    "mainHouseDoublePitch": 2,
    "leftEarAsymmetricDoublePitch": 2,
    "rightEarAsymmetricDoublePitch": 2,
    "entranceBlockDoublePitch": 2,
    "mainGalleryLeanTo": 1,
    "sideGalleryLeanTo": 3,
    "gatehouseSmallRoof": 2,
}
EXPECTED_ROOF_LAYERS = {
    "purlins",
    "rafters",
    "roofUnderlay",
    "panTileCourses",
    "coverTileCourses",
    "eaveCapsAndDrips",
    "ridgeAndClosures",
}
EXPECTED_WALL_LAYERS = {
    "structure",
    "plaster",
    "exposedEarth",
    "strawFibre",
    "stonePlinth",
    "brickCorner",
    "risingDamp",
    "verticalRainStreak",
    "surfaceLoss",
    "crackNetwork",
    "repairPatch",
    "sootAndDirt",
}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *args: object) -> None:
        pass


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _readiness_request(
    canonical_url: str,
    content_kind: str,
    attempt_number: int,
    remaining_seconds: float,
) -> dict[str, object]:
    separator = "&" if "?" in canonical_url else "?"
    requested_url = f"{canonical_url}{separator}qa_readiness={time.time_ns()}-{attempt_number}"
    request = Request(
        requested_url,
        headers={
            "Accept": "application/json" if content_kind == "json" else "text/html",
            "Cache-Control": "no-cache, no-store, max-age=0",
            "Pragma": "no-cache",
            "User-Agent": "HOUSE-V5.5.0-Pages-QA/1.0",
        },
    )
    started = time.perf_counter()
    status: int | None = None
    response_headers: dict[str, str] = {}
    payload = b""
    transport_error: dict[str, str] | None = None
    try:
        with urlopen(
            request,
            timeout=max(0.25, min(PUBLIC_READINESS_REQUEST_TIMEOUT_SECONDS, remaining_seconds)),
        ) as response:
            status = int(response.status)
            response_headers = {key.lower(): value for key, value in response.headers.items()}
            payload = response.read()
    except HTTPError as exc:
        status = int(exc.code)
        response_headers = {key.lower(): value for key, value in exc.headers.items()}
        try:
            payload = exc.read()
        except Exception:
            payload = b""
        transport_error = {"type": type(exc).__name__, "message": str(exc)}
    except (URLError, TimeoutError, OSError) as exc:
        transport_error = {"type": type(exc).__name__, "message": str(exc)}

    charset = "utf-8"
    content_type = response_headers.get("content-type", "")
    if "charset=" in content_type:
        charset = content_type.rsplit("charset=", 1)[-1].split(";", 1)[0].strip() or "utf-8"
    try:
        text = payload.decode(charset)
    except (LookupError, UnicodeDecodeError):
        charset = "utf-8"
        text = payload.decode("utf-8", errors="replace")

    parsed_json: object | None = None
    parse_error: dict[str, str] | None = None
    if content_kind == "json" and status == 200:
        try:
            parsed_json = json.loads(text)
        except (TypeError, ValueError) as exc:
            parse_error = {"type": type(exc).__name__, "message": str(exc)}

    accepted = (
        status == 200
        and bool(payload)
        and transport_error is None
        and (content_kind != "json" or (parse_error is None and parsed_json is not None))
    )
    return {
        "canonicalUrl": canonical_url,
        "requestedUrl": requested_url,
        "status": status,
        "accepted": accepted,
        "contentKind": content_kind,
        "contentType": content_type,
        "charset": charset,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest() if payload else None,
        "elapsedMs": round((time.perf_counter() - started) * 1000, 3),
        "transportError": transport_error,
        "parseError": parse_error,
        "json": parsed_json,
        "bodyPreview": text[:512],
        "_body": text,
    }


def poll_public_deployment(base_url: str, expected_sha: str | None) -> dict[str, object]:
    """Wait for one coherent public deployment before creating any browser context."""
    started = time.perf_counter()
    report: dict[str, object] = {
        "required": True,
        "startedAt": _utc_now(),
        "baseUrl": base_url,
        "expectedSha": expected_sha,
        "timeoutSeconds": PUBLIC_READINESS_TIMEOUT_SECONDS,
        "pollSeconds": PUBLIC_READINESS_POLL_SECONDS,
        "requestTimeoutSeconds": PUBLIC_READINESS_REQUEST_TIMEOUT_SECONDS,
        "attempts": [],
        "ready": False,
        "finalResources": {},
    }
    if not expected_sha:
        report.update({
            "finishedAt": _utc_now(),
            "elapsedMs": round((time.perf_counter() - started) * 1000, 3),
            "configurationError": "--expected-sha is required with --base-url",
        })
        return report

    attempt_number = 0
    while True:
        attempt_number += 1
        attempt_started = time.perf_counter()
        resources: dict[str, dict[str, object]] = {}
        for resource_name, relative_path, content_kind in PUBLIC_READINESS_RESOURCES:
            elapsed_seconds = time.perf_counter() - started
            remaining_seconds = max(0.25, PUBLIC_READINESS_TIMEOUT_SECONDS - elapsed_seconds)
            resources[resource_name] = _readiness_request(
                urljoin(base_url, relative_path),
                content_kind,
                attempt_number,
                remaining_seconds,
            )

        build_json = resources["build"].get("json")
        observed_sha = build_json.get("sha") if isinstance(build_json, dict) else None
        attempt_ready = (
            all(resource.get("accepted") is True for resource in resources.values())
            and observed_sha == expected_sha
        )
        public_resources = {
            name: {key: value for key, value in resource.items() if key != "_body"}
            for name, resource in resources.items()
        }
        attempt = {
            "attempt": attempt_number,
            "startedAt": _utc_now(),
            "elapsedMs": round((time.perf_counter() - attempt_started) * 1000, 3),
            "elapsedMsSinceStart": round((time.perf_counter() - started) * 1000, 3),
            "observedSha": observed_sha,
            "shaMatches": observed_sha == expected_sha,
            "ready": attempt_ready,
            "resources": public_resources,
        }
        report["attempts"].append(attempt)
        report["finalResources"] = {
            name: {
                **public_resources[name],
                "finalContent": {
                    "text": resource.get("_body"),
                    "json": resource.get("json"),
                },
            }
            for name, resource in resources.items()
        }
        if attempt_ready:
            report.update({
                "ready": True,
                "attemptCount": attempt_number,
                "observedSha": observed_sha,
                "finishedAt": _utc_now(),
                "elapsedMs": round((time.perf_counter() - started) * 1000, 3),
            })
            return report

        elapsed_seconds = time.perf_counter() - started
        if elapsed_seconds >= PUBLIC_READINESS_TIMEOUT_SECONDS:
            report.update({
                "attemptCount": attempt_number,
                "observedSha": observed_sha,
                "finishedAt": _utc_now(),
                "elapsedMs": round(elapsed_seconds * 1000, 3),
                "timeoutError": (
                    "public deployment did not expose three HTTP 200 resources with parseable JSON "
                    "and the expected build SHA before the readiness timeout"
                ),
            })
            return report
        time.sleep(min(PUBLIC_READINESS_POLL_SECONDS, PUBLIC_READINESS_TIMEOUT_SECONDS - elapsed_seconds))


def _paeth_predictor(left: int, above: int, upper_left: int) -> int:
    estimate = left + above - upper_left
    distance_left = abs(estimate - left)
    distance_above = abs(estimate - above)
    distance_upper_left = abs(estimate - upper_left)
    if distance_left <= distance_above and distance_left <= distance_upper_left:
        return left
    if distance_above <= distance_upper_left:
        return above
    return upper_left


def png_pixel_evidence(payload: bytes) -> dict[str, object]:
    """Decode browser PNG scanlines and prove the screenshot contains visible variation."""
    evidence: dict[str, object] = {
        "validPng": False,
        "width": None,
        "height": None,
        "nonTransparentPixelCount": 0,
        "sampledPixelCount": 0,
        "sampledUniqueColorCount": 0,
        "nonEmpty": False,
        "decodeError": None,
    }
    try:
        if len(payload) < 24 or payload[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError("missing PNG signature or IHDR")
        offset = 8
        width = height = bit_depth = color_type = interlace = None
        compressed_parts: list[bytes] = []
        palette: list[tuple[int, int, int]] = []
        palette_alpha = b""
        while offset + 12 <= len(payload):
            length = struct.unpack(">I", payload[offset:offset + 4])[0]
            chunk_type = payload[offset + 4:offset + 8]
            chunk_data = payload[offset + 8:offset + 8 + length]
            if len(chunk_data) != length:
                raise ValueError("truncated PNG chunk")
            offset += 12 + length
            if chunk_type == b"IHDR":
                width, height, bit_depth, color_type, _compression, _filter, interlace = struct.unpack(
                    ">IIBBBBB", chunk_data,
                )
            elif chunk_type == b"PLTE":
                palette = [tuple(chunk_data[index:index + 3]) for index in range(0, len(chunk_data), 3)]
            elif chunk_type == b"tRNS":
                palette_alpha = chunk_data
            elif chunk_type == b"IDAT":
                compressed_parts.append(chunk_data)
            elif chunk_type == b"IEND":
                break

        if not width or not height or bit_depth != 8 or interlace != 0:
            raise ValueError(
                f"unsupported PNG header width={width} height={height} bitDepth={bit_depth} interlace={interlace}"
            )
        channels_by_color_type = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}
        if color_type not in channels_by_color_type:
            raise ValueError(f"unsupported PNG color type {color_type}")
        channels = channels_by_color_type[color_type]
        row_bytes = width * channels
        decoded = zlib.decompress(b"".join(compressed_parts))
        expected_bytes = height * (row_bytes + 1)
        if len(decoded) != expected_bytes:
            raise ValueError(f"unexpected decoded PNG bytes {len(decoded)} != {expected_bytes}")

        previous = bytearray(row_bytes)
        rows: list[bytearray] = []
        cursor = 0
        for _row_number in range(height):
            filter_type = decoded[cursor]
            cursor += 1
            filtered = decoded[cursor:cursor + row_bytes]
            cursor += row_bytes
            row = bytearray(row_bytes)
            for index, byte in enumerate(filtered):
                left = row[index - channels] if index >= channels else 0
                above = previous[index]
                upper_left = previous[index - channels] if index >= channels else 0
                if filter_type == 0:
                    value = byte
                elif filter_type == 1:
                    value = byte + left
                elif filter_type == 2:
                    value = byte + above
                elif filter_type == 3:
                    value = byte + ((left + above) // 2)
                elif filter_type == 4:
                    value = byte + _paeth_predictor(left, above, upper_left)
                else:
                    raise ValueError(f"unsupported PNG filter type {filter_type}")
                row[index] = value & 0xFF
            rows.append(row)
            previous = row

        total_pixels = width * height
        sample_stride = max(1, total_pixels // 100_000)
        sampled_colors: set[tuple[int, int, int, int]] = set()
        sampled_pixel_count = 0
        non_transparent = 0
        pixel_number = 0
        for row in rows:
            for column in range(width):
                index = column * channels
                if color_type == 0:
                    red = green = blue = row[index]
                    alpha = 255
                elif color_type == 2:
                    red, green, blue = row[index:index + 3]
                    alpha = 255
                elif color_type == 3:
                    palette_index = row[index]
                    if palette_index >= len(palette):
                        raise ValueError(f"palette index {palette_index} is outside PLTE")
                    red, green, blue = palette[palette_index]
                    alpha = palette_alpha[palette_index] if palette_index < len(palette_alpha) else 255
                elif color_type == 4:
                    red = green = blue = row[index]
                    alpha = row[index + 1]
                else:
                    red, green, blue, alpha = row[index:index + 4]
                if alpha > 0:
                    non_transparent += 1
                if pixel_number % sample_stride == 0:
                    sampled_colors.add((red, green, blue, alpha))
                    sampled_pixel_count += 1
                pixel_number += 1

        evidence.update({
            "validPng": True,
            "width": width,
            "height": height,
            "bitDepth": bit_depth,
            "colorType": color_type,
            "nonTransparentPixelCount": non_transparent,
            "sampledPixelCount": sampled_pixel_count,
            "sampledUniqueColorCount": len(sampled_colors),
            "nonEmpty": non_transparent > 0 and len(sampled_colors) >= 2,
        })
    except Exception as exc:
        evidence["decodeError"] = {"type": type(exc).__name__, "message": str(exc)}
    return evidence


@contextmanager
def playwright_session(factory: object, cleanup_errors: list[str]):
    """Keep Playwright shutdown failures from replacing the first QA failure."""
    playwright = factory().start()
    try:
        yield playwright
    finally:
        try:
            playwright.stop()
        except Exception as exc:
            cleanup_errors.append(f"playwright.stop: {type(exc).__name__}: {exc}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="V5.5.0 surface-production browser QA")
    parser.add_argument("--base-url", help="Public Pages root. Defaults to a local ephemeral server.")
    parser.add_argument("--expected-sha", help="Require build.json to expose this deployed commit.")
    parser.add_argument("--run-sha", default=os.environ.get("GITHUB_SHA"), help="Commit under test (recorded in the report).")
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--screenshots", type=Path, default=DEFAULT_SCREENSHOTS)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report_path = args.report if args.report.is_absolute() else ROOT / args.report
    screenshot_dir = args.screenshots if args.screenshots.is_absolute() else ROOT / args.screenshots
    report_path.parent.mkdir(parents=True, exist_ok=True)
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    if report_path.is_file():
        report_path.unlink()
    for old_screenshot in screenshot_dir.glob("v550_*.png"):
        if old_screenshot.is_file():
            old_screenshot.unlink()

    run_sha = args.run_sha or args.expected_sha
    if not run_sha:
        resolved = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, check=False,
            capture_output=True, text=True,
        )
        if resolved.returncode == 0:
            run_sha = resolved.stdout.strip()

    results: list[dict[str, object]] = []
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []
    http_errors: list[dict[str, object]] = []
    external_requests: list[str] = []
    cleanup_errors: list[str] = []
    server: ThreadingHTTPServer | None = None
    base_url = args.base_url
    public_base_url = bool(args.base_url)
    browser = None
    desktop_snapshot: dict[str, object] | None = None
    mobile_snapshot: dict[str, object] | None = None
    desktop_load_seconds: float | None = None
    mobile_load_seconds: float | None = None
    ab_metadata: dict[str, object] | None = None
    visitor_playback: dict[str, object] | None = None
    uncaught_exception: dict[str, object] | None = None
    visual_evidence: dict[str, object] = {}
    roof_topology_audit: list[dict[str, object]] = []
    ui_control_evidence: dict[str, object] = {}
    deployment_readiness: dict[str, object] = {
        "required": public_base_url,
        "ready": not public_base_url,
        "reason": "local ephemeral server does not require public deployment polling" if not public_base_url else None,
    }
    planned_phases = (
        (["deployment-readiness"] if public_base_url else [])
        + [
            "load", "ab-comparison", "roof-wall", "interactions", "visitor-playback",
            "ui-controls", "screenshots", "mobile",
        ]
    )
    executed_phases: list[str] = []

    def check(name: str, condition: object, detail: object = None) -> None:
        results.append({"name": name, "ok": bool(condition), "detail": detail})

    def visual_state(page: object, view_name: str = "production") -> dict[str, object]:
        """Record the live state that produced a screenshot, not a later summary."""
        return page.evaluate(
            """(viewName) => {
              const snapshot = window.__SURFACE_QA__.inspect(viewName);
              return {
                view: viewName,
                version: snapshot.version,
                seed: snapshot.comparisonContract?.structuralSeed ?? null,
                camera: snapshot.camera,
                cameraPresetId: snapshot.cameraPresetId,
                cameraFingerprint: snapshot.cameraFingerprint,
                cameraEvidence: snapshot.cameraEvidence,
                qaDisplayState: snapshot.qaDisplayState,
                canvasFingerprint: snapshot.canvasFingerprint,
                lightFingerprint: snapshot.lightFingerprint,
                structuralFingerprint: snapshot.structuralFingerprint,
                surfaceFingerprint: snapshot.surfaceFingerprint,
                fullGeometryFingerprint: snapshot.fullGeometryFingerprint,
                cutaway: snapshot.cutaway,
                roofExploded: snapshot.runtimeState?.roofExploded ?? false,
                openingProgress: snapshot.runtimeState?.openingProgress ?? null,
                visitorProgress: snapshot.runtimeState?.visitorProgress ?? null,
                viewport: {width: window.innerWidth, height: window.innerHeight},
              };
            }""",
            view_name,
        )

    def rendering_values_are_valid(contract: dict[str, object]) -> bool:
        ratio = contract.get("pixelRatio", 0)
        cap = contract.get("pixelRatioCap")
        css_viewport = contract.get("cssViewport") or {}
        drawing_buffer = contract.get("drawingBuffer") or {}
        css_width = css_viewport.get("width", 0)
        css_height = css_viewport.get("height", 0)
        buffer_width = drawing_buffer.get("width", 0)
        buffer_height = drawing_buffer.get("height", 0)
        return (
            cap == 0.6
            and 0 < ratio <= 0.6
            and css_width > 0
            and css_height > 0
            and buffer_width > 0
            and buffer_height > 0
            and abs(buffer_width - round(css_width * ratio)) <= 2
            and abs(buffer_height - round(css_height * ratio)) <= 2
        )

    def rendering_contract_is_valid(snapshot: dict[str, object]) -> bool:
        performance = snapshot.get("performanceEvidence") or {}
        contract = performance.get("renderingContract") or {}
        return rendering_values_are_valid(contract)

    try:
        if not base_url:
            server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
            threading.Thread(target=server.serve_forever, daemon=True).start()
            base_url = f"http://127.0.0.1:{server.server_port}/"
        if not base_url.endswith("/"):
            base_url += "/"
        page_url = urljoin(base_url, "surface-production-lab.html")
        allowed_origin = urlparse(base_url).netloc

        if public_base_url:
            deployment_readiness = poll_public_deployment(base_url, args.expected_sha)
            check(
                "public Pages deployment is coherent before browser launch",
                deployment_readiness.get("ready") is True,
                deployment_readiness,
            )
            if deployment_readiness.get("ready") is not True:
                raise RuntimeError(
                    deployment_readiness.get("configurationError")
                    or deployment_readiness.get("timeoutError")
                    or "public deployment readiness failed"
                )
            executed_phases.append("deployment-readiness")

        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            check("Playwright installed", False, str(exc))
            raise RuntimeError("Playwright is required; run python -m pip install -r requirements-dev.txt") from exc

        with playwright_session(sync_playwright, cleanup_errors) as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=[
                    "--use-angle=swiftshader",
                    "--enable-unsafe-swiftshader",
                    "--enable-webgl",
                    "--ignore-gpu-blocklist",
                    "--no-sandbox",
                ],
            )
            context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
            if public_base_url:
                deployment_readiness["formalUiContext"] = {
                    "freshContext": True,
                    "createdAfterReadiness": True,
                    "createdAt": _utc_now(),
                }
                check(
                    "public UI uses a fresh browser context created after deployment readiness",
                    deployment_readiness.get("ready") is True
                    and deployment_readiness["formalUiContext"].get("freshContext") is True
                    and deployment_readiness["formalUiContext"].get("createdAfterReadiness") is True,
                    deployment_readiness["formalUiContext"],
                )
            page = context.new_page()
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url}: {request.failure}"))

            def capture_response(response: object) -> None:
                status = response.status
                request_url = response.url
                if status >= 400:
                    http_errors.append({"status": status, "url": request_url})
                if urlparse(request_url).netloc != allowed_origin:
                    external_requests.append(request_url)

            page.on("response", capture_response)
            started = time.perf_counter()
            page.goto(page_url, wait_until="load", timeout=180_000)
            page.wait_for_function("window.__SURFACE_QA__?.ready === true", timeout=180_000)
            page.wait_for_function(
                """() => {
                  const evidence = window.__SURFACE_QA__.performanceEvidence();
                  return evidence.sampleCount >= 4
                    && evidence.steadySampleCount >= 3
                    && evidence.recentSteadyFps.length >= 3;
                }""",
                timeout=120_000,
            )
            load_seconds = time.perf_counter() - started
            desktop_load_seconds = load_seconds
            executed_phases.append("load")

            page.evaluate("window.__SURFACE_QA__.setCamera('ab')")
            baseline = page.evaluate("window.__SURFACE_QA__.inspect('baseline')")
            production = page.evaluate("window.__SURFACE_QA__.inspect('production')")
            desktop_snapshot = production
            ab_metadata = {
                "seed": production.get("comparisonContract", {}).get("structuralSeed"),
                "baselineVersion": baseline.get("version"),
                "productionVersion": production.get("version"),
                "cameraFingerprint": production.get("cameraFingerprint"),
                "canvasFingerprint": production.get("canvasFingerprint"),
                "lightFingerprint": production.get("lightFingerprint"),
                "baselineStructuralFingerprint": baseline.get("structuralFingerprint"),
                "productionStructuralFingerprint": production.get("structuralFingerprint"),
                "baselineSurfaceFingerprint": baseline.get("surfaceFingerprint"),
                "productionSurfaceFingerprint": production.get("surfaceFingerprint"),
                "baselineFullGeometryFingerprint": baseline.get("fullGeometryFingerprint"),
                "productionFullGeometryFingerprint": production.get("fullGeometryFingerprint"),
            }
            executed_phases.append("ab-comparison")
            check("runtime versions", baseline.get("version") == "5.4.4" and production.get("version") == "5.5.0", {"baseline": baseline.get("version"), "production": production.get("version")})
            check("live geometry evidence contract", production.get("evidenceContract") == "live-geometry-v1", production.get("evidenceContract"))
            check("complete A/B buildings", baseline.get("completeBuilding") and production.get("completeBuilding"))
            check(
                "actual structure fingerprints contain transforms, bounds and geometry",
                str(baseline.get("structuralFingerprint", "")).startswith("fnv1a32:")
                and str(production.get("structuralFingerprint", "")).startswith("fnv1a32:")
                and str(baseline.get("fullGeometryFingerprint", "")).startswith("fnv1a32:")
                and str(production.get("fullGeometryFingerprint", "")).startswith("fnv1a32:"),
                {"baseline": baseline.get("structuralFingerprint"), "production": production.get("structuralFingerprint")},
            )
            check(
                "same complete-building structural fingerprint",
                baseline.get("structuralFingerprint") == production.get("structuralFingerprint"),
                {"baseline": baseline.get("structuralFingerprint"), "production": production.get("structuralFingerprint")},
            )
            check("same frozen building inputs", baseline.get("comparisonInputFingerprint") == production.get("comparisonInputFingerprint"), {"baseline": baseline.get("comparisonInputFingerprint"), "production": production.get("comparisonInputFingerprint")})
            comparison_contract = production.get("comparisonContract") or {}
            check(
                "A/B shares building inputs while preserving version-specific tile systems",
                comparison_contract.get("sharedSeed") is True
                and comparison_contract.get("sharedBuildingParameters") is True
                and comparison_contract.get("baselineTileProfile", {}).get("tileWidth") == 0.28
                and comparison_contract.get("productionTileProfile", {}).get("tileProfileId") == "YUNNAN-PAN-COVER-V550"
                and comparison_contract.get("productionTileProfile", {}).get("tileWidth") == 0.242
                and comparison_contract.get("productionTileProfile", {}).get("tileLength") == 0.223
                and comparison_contract.get("productionTileProfile", {}).get("tileCourse") == 0.18,
                comparison_contract,
            )
            check("same camera fingerprint", baseline.get("cameraFingerprint") == production.get("cameraFingerprint"))
            check("same canvas fingerprint", baseline.get("canvasFingerprint") == production.get("canvasFingerprint"))
            check("same light fingerprint", baseline.get("lightFingerprint") == production.get("lightFingerprint"))
            check("different surface fingerprint", baseline.get("surfaceFingerprint") != production.get("surfaceFingerprint"))
            provenance = baseline.get("baselineProvenance") or {}
            frozen_runtime = baseline.get("frozenV544Runtime") or {}
            check(
                "V5.4.4 baseline is traceable and frozen",
                provenance.get("version") == "5.4.4"
                and provenance.get("sourceCommit") == "323a893a791b1d064a1591dcbd2063f2f6a172c1"
                and provenance.get("controlledComparison", {}).get("sharedBuildingParameters") is True
                and provenance.get("controlledComparison", {}).get("sharedSeed") is True
                and provenance.get("controlledComparison", {}).get("sharedCamera") is True
                and provenance.get("controlledComparison", {}).get("sharedCanvasSize") is True
                and provenance.get("controlledComparison", {}).get("sharedLighting") is True,
                provenance,
            )
            check(
                "V5.4.4 source runtime remains executable provenance",
                frozen_runtime.get("executable") is True
                and frozen_runtime.get("evidenceSource") == "executed-v544-runtime-with-whitespace-normalized-material"
                and frozen_runtime.get("sourceCommit") == "323a893a791b1d064a1591dcbd2063f2f6a172c1"
                and frozen_runtime.get("generatorBlobSha") == "7b254beeffde1325329101b50784e694249081bd"
                and frozen_runtime.get("sourceMaterialBlobSha") == "d16baad4ff18c5a9e97f7796f9e68d45cd6f9ff9"
                and frozen_runtime.get("materialBlobSha") == "0bcf25b39ebf65047b2f4628ce4ee9306395aa45"
                and frozen_runtime.get("materialNormalization") == "removed-one-trailing-blank-line-for-repository-whitespace-gate"
                and str(frozen_runtime.get("structuralFingerprint", "")).startswith("fnv1a32:")
                and frozen_runtime.get("stats", {}).get("meshCount", 0) > 100
                and frozen_runtime.get("stats", {}).get("triangleCount", 0) > 1000
                and len(frozen_runtime.get("worldBounds", [])) == 6,
                frozen_runtime,
            )
            check(
                "A/B displays the shared structural shell while retaining frozen provenance",
                comparison_contract.get("displayedBaselineRuntime") == "current-generator-baselineV544-branch"
                and comparison_contract.get("frozenRuntimeRole") == "provenance-evidence-only"
                and baseline.get("displayedRuntimeFingerprint") != frozen_runtime.get("surfaceFingerprint"),
                {
                    "comparisonContract": comparison_contract,
                    "displayed": baseline.get("displayedRuntimeFingerprint"),
                    "frozen": frozen_runtime.get("surfaceFingerprint"),
                },
            )

            roofs = production.get("roofUnits", [])
            roof_ids = {roof.get("roofUnitId") for roof in roofs}
            check("seven exact roof unit IDs", roof_ids == EXPECTED_ROOFS, sorted(roof_ids))
            check("roof registry complete", production.get("roofSystem", {}).get("complete") is True, production.get("roofSystem"))
            roof_diagnostics = production.get("roofGeometryDiagnostics") or {}
            diagnostic_units = roof_diagnostics.get("units") or []
            diagnostic_slopes = [slope for unit in diagnostic_units for slope in unit.get("slopeAudits", [])]
            rotated_slopes = [slope for slope in diagnostic_slopes if abs(abs(slope.get("sectionRotationY", 0)) - 1.57079632679) <= 1e-5]
            check(
                "roof QA is computed from actual matrices, bounds and geometry",
                roof_diagnostics.get("evidenceSource") == "actual-geometry-instance-matrices-and-world-bounds"
                and roof_diagnostics.get("rotationComposition") == "Qy*Qx"
                and roof_diagnostics.get("roofUnitCount") == 7
                and roof_diagnostics.get("allRoofUnitsPassed") is True
                and len(diagnostic_units) == 7
                and all(unit.get("rotationComposition") == "Qy*Qx" for unit in diagnostic_units)
                and all(unit.get("patchTotalsValid") is True for unit in diagnostic_units)
                and all(all(unit.get("layerCounts", {}).get(layer, 0) > 0 for layer in EXPECTED_ROOF_LAYERS) for unit in diagnostic_units)
                and diagnostic_slopes
                and all(
                    slope.get("passed") is True
                    and slope.get("worldBounds", {}).get("all", {}).get("volumeM3", 0) > 0
                    and slope.get("minTileSlopeAlignment", 0) >= 0.999
                    and slope.get("drainageDirectionDot", 0) >= 0.999999
                    and slope.get("longitudinalOverlapM", 0) > 0
                    and slope.get("seamAlignmentMaxErrorM", 1) <= 1e-6
                    and slope.get("coverCourseOffsetMaxM", 1) <= 1e-6
                    for slope in diagnostic_slopes
                ),
                roof_diagnostics,
            )
            check(
                "rotated roof tile axes retain real vertical slope components",
                len(rotated_slopes) >= 4
                and all(slope.get("minTileVerticalComponent", 0) > 0.35 for slope in rotated_slopes)
                and all(abs(slope.get("minTileVerticalComponent", 0) - slope.get("expectedTileVerticalComponent", 1)) <= 1e-6 for slope in rotated_slopes),
                rotated_slopes,
            )
            check("all roof units contain renderable geometry", all(roof.get("actualRenderableCount", 0) > 0 and roof.get("bboxVolume", 0) > 0.01 for roof in roofs))
            check(
                "all seven build-up layers contain geometry",
                all(
                    all(
                        roof.get("layerCounts", {}).get(layer, 0) > 0
                        and str(roof.get("layerFingerprints", {}).get(layer, "")).startswith("fnv1a32:")
                        and roof.get("layerWorldBounds", {}).get(layer) is not None
                        for layer in EXPECTED_ROOF_LAYERS
                    )
                    for roof in roofs
                ),
                {
                    roof.get("roofUnitId"): {
                        "counts": roof.get("layerCounts"),
                        "fingerprints": roof.get("layerFingerprints"),
                        "bounds": roof.get("layerWorldBounds"),
                    }
                    for roof in roofs
                },
            )
            slope_checks: list[bool] = []
            slope_count_by_roof: dict[str, int] = {}

            def non_degenerate_bounds(bounds: object) -> bool:
                return (
                    isinstance(bounds, list)
                    and len(bounds) == 6
                    and all(isinstance(value, (int, float)) for value in bounds)
                    and all(bounds[index + 3] > bounds[index] for index in range(3))
                )

            for roof in roofs:
                roof_unit_id = roof.get("roofUnitId")
                slope_count_by_roof[str(roof_unit_id)] = len(roof.get("slopes", []))
                for slope in roof.get("slopes", []):
                    bounds = slope.get("worldBounds") or {}
                    conditions = {
                        "coverColumnsEqualPanSeams": slope.get("coverColumns") == slope.get("panColumns", 0) - 1,
                        "coverBridgesPanSeams": slope.get("coverBridgesPanSeams") is True,
                        "threeDimensionalCourseOffsetReference": slope.get("courseOffsetReference") == "three-dimensional-pan-route-downhill-tangent",
                        "coverCourseOffsetWithin4mm": abs(slope.get("coverCourseOffsetM", 1)) <= 0.004,
                        "seamSamplesPresent": slope.get("seamSampleCount", 0) > 0,
                        "seamAlignmentWithin4mm": slope.get("seamAlignmentMaxErrorM", 1) <= 0.004,
                        "dripPerPanColumn": slope.get("dripCount") == slope.get("panColumns"),
                        "hookPerCoverColumn": slope.get("hookCount") == slope.get("coverColumns"),
                        "panConcavityUp": slope.get("panConcavity") == "up",
                        "coverConvexityUp": slope.get("coverConvexity") == "up",
                        "panGeometryClosedShell": slope.get("panGeometryClosedShell") is True,
                        "coverGeometryClosedShell": slope.get("coverGeometryClosedShell") is True,
                        "independentTopologyPassed": slope.get("independentTopologyPassed") is True,
                        "allInstanceMatricesFinite": (
                            slope.get("allInstanceMatricesFinite") is True
                            and slope.get("instanceMatrixCount", 0) > 0
                        ),
                        "bufferGeometryPassed": slope.get("bufferGeometryPassed") is True,
                        "boundsPassed": slope.get("boundsPassed") is True,
                        "panBufferGeometryNonDegenerate": (
                            slope.get("panGeometryNonDegenerate") is True
                            and slope.get("panGeometryVertexCount", 0) > 0
                            and slope.get("panGeometryTriangleCount", 0) > 0
                        ),
                        "coverBufferGeometryNonDegenerate": (
                            slope.get("coverGeometryNonDegenerate") is True
                            and slope.get("coverGeometryVertexCount", 0) > 0
                            and slope.get("coverGeometryTriangleCount", 0) > 0
                        ),
                        "dripBufferGeometryNonDegenerate": all(
                            (
                                (slope.get("bufferGeometry") or {}).get("drip", {}).get("isBufferGeometry") is True,
                                (slope.get("bufferGeometry") or {}).get("drip", {}).get("positionCount", 0) > 0,
                                (slope.get("bufferGeometry") or {}).get("drip", {}).get("triangleCount", 0) > 0,
                                (slope.get("bufferGeometry") or {}).get("drip", {}).get("closedShell") is True,
                            )
                        ),
                        "hookBufferGeometryNonDegenerate": all(
                            (
                                (slope.get("bufferGeometry") or {}).get("hook", {}).get("isBufferGeometry") is True,
                                (slope.get("bufferGeometry") or {}).get("hook", {}).get("positionCount", 0) > 0,
                                (slope.get("bufferGeometry") or {}).get("hook", {}).get("triangleCount", 0) > 0,
                                (slope.get("bufferGeometry") or {}).get("hook", {}).get("closedShell") is True,
                            )
                        ),
                        "panAndCoverInstanceCountsPositive": (
                            slope.get("panInstanceCount", 0) > 0 and slope.get("coverInstanceCount", 0) > 0
                        ),
                        "allWorldBoundsNonDegenerate": non_degenerate_bounds(bounds.get("all")),
                        "panWorldBoundsNonDegenerate": non_degenerate_bounds(bounds.get("panTiles")),
                        "coverWorldBoundsNonDegenerate": non_degenerate_bounds(bounds.get("coverTiles")),
                        "eaveWorldBoundsNonDegenerate": non_degenerate_bounds(bounds.get("eaveDripsAndHooks")),
                        "dripWorldBoundsNonDegenerate": non_degenerate_bounds(bounds.get("drips")),
                        "hookWorldBoundsNonDegenerate": non_degenerate_bounds(bounds.get("hooks")),
                        "drainagePathPerPanColumn": slope.get("drainagePathCount") == slope.get("panColumns"),
                        "allDrainagePathsMonotonic": (
                            slope.get("monotonicDrainagePathCount") == slope.get("drainagePathCount")
                            and slope.get("drainagePathsMonotonic") is True
                        ),
                        "allDrainagePathsEndAtEave": (
                            slope.get("eaveTerminationCount") == slope.get("drainagePathCount")
                            and slope.get("drainagePathsEndAtEave") is True
                        ),
                        "positiveCourseFallAndPitch": (
                            slope.get("minimumCourseFallM", 0) > 0 and slope.get("measuredPitch", 0) > 0
                        ),
                        "positiveColumnAndCoursePitch": (
                            slope.get("columnPitchM", 0) > 0 and slope.get("courseSpacingM", 0) > 0
                        ),
                        "drainageTargetDeclared": bool(slope.get("drainageTargetId")),
                        "tileBatchesInstanced": slope.get("tileBatchesAreInstanced") is True,
                        "longitudinalOverlapPositive": slope.get("longitudinalOverlapM", 0) > 0,
                        "evidenceUsesLiveGeometry": slope.get("evidenceSource") == "live-instance-matrices-buffer-geometry-and-world-bounds",
                        "topologyFingerprintPresent": str(slope.get("topologyFingerprint", "")).startswith("fnv1a32:"),
                    }
                    slope_passed = all(conditions.values())
                    slope_checks.append(slope_passed)
                    roof_topology_audit.append({
                        "roofUnitId": roof_unit_id,
                        "slopeId": slope.get("slopeId"),
                        "passed": slope_passed,
                        "failedConditions": [name for name, passed_condition in conditions.items() if not passed_condition],
                        "conditions": conditions,
                        "evidence": slope,
                    })
            topology_detail = {
                "expectedRoofCount": 7,
                "expectedSlopeCount": 14,
                "roofIds": sorted(slope_count_by_roof),
                "slopeCountByRoof": slope_count_by_roof,
                "passed": slope_checks.count(True),
                "failed": slope_checks.count(False),
                "slopes": roof_topology_audit,
            }
            check(
                "pan-cover topology and drainage",
                len(slope_checks) == 14
                and slope_count_by_roof == EXPECTED_SLOPE_COUNTS
                and len({item.get("slopeId") for item in roof_topology_audit}) == 14
                and all(slope_checks),
                topology_detail,
            )
            ridge_checks = []
            for roof in roofs:
                audit = roof.get("ridgeAudit") or {}
                topology = roof.get("ridgeTopology") or []
                ridge_checks.append(
                    audit.get("evidenceSource") == "live-ridge-mesh-world-bounds-and-semantics"
                    and audit.get("geometryCount", 0) > 0
                    and len(audit.get("worldBounds") or []) == 6
                    and all(value > 0 for value in audit.get("boundsSizeM") or [])
                    and str(audit.get("geometryFingerprint", "")).startswith("fnv1a32:")
                    and len(topology) == roof.get("sectionCount")
                    and all(
                        section.get("vergeClosureCount", 0) >= 2
                        and section.get("endClosureCount") == 2
                        and (
                            section.get("verticalRidgeCount", 0) > 0
                            if section.get("verticalRidgeApplicable")
                            else bool(section.get("verticalRidgeReason"))
                        )
                        for section in topology
                    )
                )
            check("ridge, verge and end closures use bounded real geometry", ridge_checks and all(ridge_checks), {"roofs": len(ridge_checks), "failed": ridge_checks.count(False)})
            check("roof height hierarchy", len({round(roof.get("ridgeElevationM", 0), 2) for roof in roofs}) >= 4)
            check("clustered missing or broken tiles", sum(roof.get("damage", {}).get("missingTiles", 0) + roof.get("damage", {}).get("brokenTiles", 0) for roof in roofs) >= 4)
            check("bounded repair tile patches", sum(roof.get("repairs", {}).get("tiles", 0) for roof in roofs) >= 4)

            walls = production.get("walls") or {}
            check("wall hosts generated", walls.get("hostCount", 0) >= 5, walls.get("hostCount"))
            check("all wall material and history layers visible", all(walls.get("layerCounts", {}).get(layer, 0) > 0 for layer in EXPECTED_WALL_LAYERS), walls.get("layerCounts"))
            damp = walls.get("dampGeometry", {})
            check(
                "rising damp geometry remains ground-up",
                damp.get("bandCount", 0) >= walls.get("hostCount", 0)
                and damp.get("maxBottomOffsetRatio", 1) <= 0.04
                and damp.get("maxTopRatio", 1) <= 0.32
                and damp.get("opacityByLevel", {}).get("bottom", 0) > damp.get("opacityByLevel", {}).get("middle", 0)
                and damp.get("opacityByLevel", {}).get("middle", 0) > damp.get("opacityByLevel", {}).get("top", 0),
                damp,
            )
            rain = walls.get("rainGeometry", {})
            check(
                "rain streak geometry follows gravity",
                rain.get("streakCount", 0) >= walls.get("hostCount", 0)
                and rain.get("minVerticalAspect", 0) >= 2.0
                and rain.get("minGravityDot", 0) >= 0.95,
                rain,
            )
            solar = walls.get("solarGeometry", {})
            check(
                "wall weathering responds to eave shelter, drainage and sun",
                rain.get("shelteredLoadMean") is not None
                and rain.get("exposedLoadMean") is not None
                and rain.get("shelteredLoadMean") < rain.get("exposedLoadMean")
                and rain.get("lowDrainageLoadMean") is not None
                and rain.get("highDrainageLoadMean") is not None
                and rain.get("lowDrainageLoadMean") < rain.get("highDrainageLoadMean")
                and solar.get("lowExposureLuminance") is not None
                and solar.get("highExposureLuminance") is not None
                and solar.get("lowExposureLuminance") != solar.get("highExposureLuminance"),
                {"rain": rain, "solar": solar},
            )
            check("stone plinth has thickness", walls.get("plinthThicknessM", 0) > 0)
            check("brick corners have thickness", walls.get("cornerProtectionThicknessM", 0) > 0)
            repair_geometry = walls.get("repairGeometry", {})
            check(
                "wall repairs are bounded real patches",
                repair_geometry.get("patchCount", 0) > 0
                and repair_geometry.get("boundedToHostCount") == repair_geometry.get("patchCount"),
                repair_geometry,
            )
            executed_phases.append("roof-wall")

            profile_snapshots: dict[str, dict[str, object]] = {}
            for profile_id in ("museum1940sBalanced", "wulongWeathered", "daliMaintained"):
                page.evaluate("(id) => window.__SURFACE_QA__.setPreset(id)", profile_id)
                page.wait_for_timeout(250)
                profile_snapshots[profile_id] = page.evaluate("window.__SURFACE_QA__.inspect('production')")
            check("three presets produce distinct surfaces", len({item["surfaceFingerprint"] for item in profile_snapshots.values()}) == 3)
            check("three presets preserve structure", len({item["structuralFingerprint"] for item in profile_snapshots.values()}) == 1)
            wulong_damage = sum(roof["damage"]["missingTiles"] + roof["damage"]["brokenTiles"] for roof in profile_snapshots["wulongWeathered"]["roofUnits"])
            dali_damage = sum(roof["damage"]["missingTiles"] + roof["damage"]["brokenTiles"] for roof in profile_snapshots["daliMaintained"]["roofUnits"])
            check("Wulong preset is more damaged than Dali", wulong_damage > dali_damage, {"wulong": wulong_damage, "dali": dali_damage})
            page.evaluate("window.__SURFACE_QA__.setPreset('museum1940sBalanced')")

            stair = production.get("stair") or {}
            check("single 8+8 double-flight stair", stair.get("flightStepCounts") == [8, 8] and stair.get("totalRisers") == 16, stair)
            check("stair has lower, middle and upper landings", stair.get("landingCount") == 3, stair)
            check("continuous stair handrails", stair.get("continuousHandrails") is True and stair.get("handrailCount", 0) >= 4 and stair.get("handrailFlights") == [1, 2], stair)
            check("stair rise is 2.73 m", abs(stair.get("totalRiseM", 0) - 2.73) <= 0.01)
            interaction = production.get("interactionGeometry") or {}
            stair_geometry = interaction.get("stair") or {}
            check(
                "stair geometry and component identities audit",
                not interaction.get("duplicateComponentIds")
                and stair_geometry.get("flightStepCounts") == [8, 8]
                and stair_geometry.get("maxRiserErrorM", 1) <= 1e-5
                and stair_geometry.get("stringerCount", 0) >= 4
                and stair_geometry.get("supportCount", 0) >= 4
                and stair_geometry.get("handrailConnectedComponentCount") == 2
                and stair_geometry.get("continuousHandrails") is True,
                interaction,
            )
            openings_closed = page.evaluate("window.__SURFACE_QA__.inspect('production').openings")
            page.evaluate("window.__SURFACE_QA__.setOpeningsProgress(1)")
            openings_open = page.evaluate("window.__SURFACE_QA__.inspect('production').openings")
            check("door and window pivots exist", openings_open.get("doorLeafCount", 0) == 2 and openings_open.get("windowLeafCount", 0) >= 4, openings_open)
            check("door and window states changed", openings_closed.get("progress") != openings_open.get("progress") and all(value == 1 for value in openings_open.get("progress", [])))
            required_opening_roles = {"doorLeaf", "windowLeaf", "openingFrame", "openingSill", "replacementPart"}
            check(
                "role-specific deterministic opening weathering",
                required_opening_roles.issubset(set(openings_open.get("surfaceRoles", {})))
                and len(set(openings_open.get("deterministicSeeds", []))) >= len(required_opening_roles)
                and len(set(openings_open.get("materialChannelFingerprints", []))) >= len(required_opening_roles),
                openings_open,
            )
            opening_geometry = openings_open.get("geometryAudit", [])
            check(
                "opening hinges and leaf bounds are geometric",
                opening_geometry
                and all(item.get("leafWorldBoundsM") for item in opening_geometry)
                and all(item.get("hostExists") is True and item.get("hostId") for item in opening_geometry)
                and all(
                    abs(pivot.get("actualAngleRad", 0) - pivot.get("expectedOpenAngleRad", 1)) <= 1e-6
                    and pivot.get("hingeDriftM", 1) <= 1e-6
                    and pivot.get("collisionEnvelope", {}).get("containsGeometry") is True
                    for item in opening_geometry
                    for pivot in item.get("pivots", [])
                )
                and all(item.get("actualClearWidthM", 0) > 0.6 for item in opening_geometry if item.get("kind") == "door"),
                opening_geometry,
            )
            executed_phases.append("interactions")
            visitor_playback = page.evaluate("window.__SURFACE_QA__.playVisitorRoute(3200)")
            playback = visitor_playback
            visitor = page.evaluate("window.__SURFACE_QA__.inspect('production').visitor")
            check("visitor completes entry route", visitor.get("complete") and visitor.get("reachedUpperFloor"), visitor)
            check("visitor reaches 2.73 m relative floor", abs(visitor.get("relativeUpperFloorM", 0) - 2.73) <= 0.01, visitor)
            check(
                "visitor collision and support audit clear",
                visitor.get("wallIntersectionCount") == 0
                and visitor.get("openingCollisionCount") == 0
                and visitor.get("railCollisionCount") == 0
                and visitor.get("suspendedFrameCount") == 0
                and visitor.get("unsupportedSampleCount") == 0
                and visitor.get("stuckFrameCount") == 0
                and visitor.get("currentCollision") is False,
                visitor,
            )
            check(
                "visitor route actually plays frame by frame",
                playback.get("completed") is True
                and playback.get("requestedFrameCount") == 33
                and playback.get("frameCount") == 33
                and playback.get("renderedFrameCount") == playback.get("frameCount")
                and playback.get("uniquePositionCount") == playback.get("frameCount")
                and len(playback.get("stages", [])) >= 6
                and not playback.get("frameFailures")
                and visitor.get("browserPlayback", {}).get("completed") is True,
                playback,
            )
            nested_playback = (playback.get("destination") or {}).get("browserPlayback") or {}
            check(
                "visitor destination carries the same real playback evidence",
                nested_playback.get("frameCount") == playback.get("frameCount")
                and nested_playback.get("renderedFrameCount") == playback.get("renderedFrameCount")
                and nested_playback.get("uniquePositionCount") == playback.get("uniquePositionCount")
                and nested_playback.get("completed") is playback.get("completed") is True,
                {"topLevel": playback, "destinationPlayback": nested_playback},
            )
            check(
                "visitor route uses raycast and world-bound evidence",
                visitor.get("evidenceSource") == "raycaster-plus-world-bounds"
                and visitor.get("routeSampleCount", 0) >= 300
                and visitor.get("maximumRouteSampleSpacingM", 1) <= 0.08
                and visitor.get("maximumSupportGapM", 1) <= 0.03
                and visitor.get("maximumRequestedSupportGapM", 1) <= 0.20
                and visitor.get("maximumAnchorSupportGapM", 1) <= 0.001
                and visitor.get("unsupportedAnchorCount") == 0
                and visitor.get("mismatchedAnchorSupportCount") == 0
                and len(visitor.get("auditedStages", [])) >= 6
                and len(visitor.get("auditedSupportIds", [])) >= 6,
                visitor,
            )
            executed_phases.append("visitor-playback")

            renderer = production.get("renderer", {})
            check("WebGL depth buffer active", renderer.get("depthBits", 0) >= 16, renderer)
            check(
                "acceptance renderer uses bounded honest performance settings",
                renderer.get("antialias") is False
                and renderer.get("shadowsEnabled") is False
                and 0 < renderer.get("pixelRatio", 0) <= 0.6
                and rendering_contract_is_valid(production),
                {
                    "renderer": renderer,
                    "renderingContract": (production.get("performanceEvidence") or {}).get("renderingContract"),
                },
            )
            check("renderer produced geometry", renderer.get("triangles", 0) > 0 and renderer.get("drawCalls", 0) > 0, renderer)
            check("renderer draw calls do not exceed the b5ea 731 ceiling", 0 < renderer.get("drawCalls", 0) <= 731, renderer)
            check("tile instancing active", renderer.get("instanceCount", 0) > 1000, renderer.get("instanceCount"))
            check("first frame under 30 seconds", (production.get("timings", {}).get("firstFrameMs") or 99_999) < 30_000, production.get("timings"))
            desktop_fps_evidence = production.get("performanceEvidence") or {}
            check(
                "SwiftShader FPS floor is stable across repeated desktop samples",
                desktop_fps_evidence.get("sampleCount", 0) >= 4
                and desktop_fps_evidence.get("steadySampleCount", 0) >= 3
                and len(desktop_fps_evidence.get("recentSteadyFps", [])) >= 3
                and desktop_fps_evidence.get("stableFps", 0) >= 5
                and all(value >= 5 for value in desktop_fps_evidence.get("recentSteadyFps", [])),
                desktop_fps_evidence,
            )

            def capture_desktop(filename: str) -> None:
                capture_state = page.evaluate("window.__SURFACE_QA__.inspect('production')")
                camera_id = capture_state.get("cameraPresetId")
                render_serial_before = current_render_serial()
                page.evaluate("(id) => window.__SURFACE_QA__.setCamera(id)", camera_id)
                render_serial_after = wait_for_new_render(render_serial_before)
                page.screenshot(
                    path=str(screenshot_dir / filename),
                    clip={"x": 0, "y": 0, "width": 1440, "height": 1000},
                    timeout=120_000,
                )
                visual_evidence.setdefault("captureFrames", {})[filename] = {
                    "cameraId": camera_id,
                    "renderSerialBefore": render_serial_before,
                    "renderSerialAfter": render_serial_after,
                    "renderedNewFrame": render_serial_after > render_serial_before,
                    "capturedAt": _utc_now(),
                }

            def current_render_serial() -> int:
                return page.evaluate(
                    "window.__SURFACE_QA__.inspect('production').renderer.renderSerial",
                )

            def wait_for_new_render(render_serial_before: int) -> int:
                page.wait_for_function(
                    """(before) => (
                      window.__SURFACE_QA__.inspect('production').renderer.renderSerial > before
                    )""",
                    arg=render_serial_before,
                    timeout=15_000,
                )
                return current_render_serial()

            def set_camera_and_wait(camera_id: str) -> dict[str, object]:
                render_serial_before = current_render_serial()
                page.evaluate("(id) => window.__SURFACE_QA__.setCamera(id)", camera_id)
                page.wait_for_function(
                    "(id) => window.__SURFACE_QA__.inspect('production').cameraPresetId === id",
                    arg=camera_id,
                    timeout=10_000,
                )
                render_serial_after = wait_for_new_render(render_serial_before)
                return {
                    "cameraId": camera_id,
                    "renderSerialBefore": render_serial_before,
                    "renderSerialAfter": render_serial_after,
                    "renderedNewFrame": render_serial_after > render_serial_before,
                }

            def set_openings_and_wait(progress: int) -> dict[str, object]:
                render_serial_before = current_render_serial()
                page.evaluate("(value) => window.__SURFACE_QA__.setOpeningsProgress(value)", progress)
                render_serial_after = wait_for_new_render(render_serial_before)
                return {
                    "progress": progress,
                    "renderSerialBefore": render_serial_before,
                    "renderSerialAfter": render_serial_after,
                    "renderedNewFrame": render_serial_after > render_serial_before,
                }

            def dom_layout_state() -> dict[str, object]:
                return page.evaluate(
                    """() => {
                      const main = document.querySelector('main');
                      const baselineArticle = document.querySelector('#baseline')?.closest('article');
                      const productionArticle = document.querySelector('#production')?.closest('article');
                      const productionViewport = document.querySelector('#production');
                      const rect = productionViewport?.getBoundingClientRect();
                      const snapshot = window.__SURFACE_QA__.inspect('production');
                      return {
                        viewport: {width: window.innerWidth, height: window.innerHeight},
                        inline: {
                          mainGridTemplateColumns: main?.style.gridTemplateColumns || '',
                          baselineDisplay: baselineArticle?.style.display || '',
                          productionDisplay: productionArticle?.style.display || '',
                        },
                        computed: {
                          mainGridTemplateColumns: main ? getComputedStyle(main).gridTemplateColumns : null,
                          baselineDisplay: baselineArticle ? getComputedStyle(baselineArticle).display : null,
                          productionDisplay: productionArticle ? getComputedStyle(productionArticle).display : null,
                        },
                        productionViewportRect: rect ? {
                          x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                        } : null,
                        productionClientSize: productionViewport ? {
                          width: productionViewport.clientWidth,
                          height: productionViewport.clientHeight,
                        } : null,
                        renderingContract: snapshot.performanceEvidence?.renderingContract ?? null,
                        structuralFingerprint: snapshot.structuralFingerprint,
                        surfaceFingerprint: snapshot.surfaceFingerprint,
                        fullGeometryFingerprint: snapshot.fullGeometryFingerprint,
                        renderSerial: snapshot.renderer?.renderSerial ?? null,
                      };
                    }""",
                )

            def wait_for_layout_render(render_serial_before: int) -> int:
                page.wait_for_function(
                    """(before) => {
                      const viewport = document.querySelector('#production');
                      const snapshot = window.__SURFACE_QA__.inspect('production');
                      const contract = snapshot.performanceEvidence?.renderingContract;
                      if (!viewport || !contract || snapshot.renderer?.renderSerial <= before) return false;
                      const ratio = Number(contract.pixelRatio);
                      const css = contract.cssViewport || {};
                      const buffer = contract.drawingBuffer || {};
                      return Math.abs(Number(css.width) - viewport.clientWidth) <= 1
                        && Math.abs(Number(css.height) - viewport.clientHeight) <= 1
                        && Math.abs(Number(buffer.width) - Math.round(viewport.clientWidth * ratio)) <= 2
                        && Math.abs(Number(buffer.height) - Math.round(viewport.clientHeight * ratio)) <= 2;
                    }""",
                    arg=render_serial_before,
                    timeout=15_000,
                )
                return current_render_serial()

            def enter_production_only_layout() -> dict[str, object]:
                before = dom_layout_state()
                render_serial_before = current_render_serial()
                restore_token = page.evaluate(
                    """() => {
                      const main = document.querySelector('main');
                      const baselineArticle = document.querySelector('#baseline')?.closest('article');
                      const productionArticle = document.querySelector('#production')?.closest('article');
                      const token = {
                        mainGridTemplateColumns: main?.style.gridTemplateColumns || '',
                        baselineDisplay: baselineArticle?.style.display || '',
                        productionDisplay: productionArticle?.style.display || '',
                      };
                      if (main) main.style.gridTemplateColumns = 'minmax(0, 1fr)';
                      if (baselineArticle) baselineArticle.style.display = 'none';
                      if (productionArticle) productionArticle.style.display = '';
                      return token;
                    }""",
                )
                render_serial_after = wait_for_layout_render(render_serial_before)
                after = dom_layout_state()
                return {
                    "restoreToken": restore_token,
                    "before": before,
                    "isolated": after,
                    "renderSerialBefore": render_serial_before,
                    "renderSerialAfter": render_serial_after,
                    "renderedAfterResize": render_serial_after > render_serial_before,
                }

            def restore_production_only_layout(restore_token: dict[str, object]) -> dict[str, object]:
                before_restore = dom_layout_state()
                render_serial_before = current_render_serial()
                page.evaluate(
                    """(token) => {
                      const main = document.querySelector('main');
                      const baselineArticle = document.querySelector('#baseline')?.closest('article');
                      const productionArticle = document.querySelector('#production')?.closest('article');
                      if (main) main.style.gridTemplateColumns = token.mainGridTemplateColumns;
                      if (baselineArticle) baselineArticle.style.display = token.baselineDisplay;
                      if (productionArticle) productionArticle.style.display = token.productionDisplay;
                    }""",
                    restore_token,
                )
                render_serial_after = wait_for_layout_render(render_serial_before)
                after_restore = dom_layout_state()
                return {
                    "beforeRestore": before_restore,
                    "restored": after_restore,
                    "renderSerialBefore": render_serial_before,
                    "renderSerialAfter": render_serial_after,
                    "renderedAfterResize": render_serial_after > render_serial_before,
                }

            def click_reset_and_wait() -> dict[str, object]:
                render_serial_before = current_render_serial()
                page.locator("#reset").click()
                page.wait_for_function(
                    """() => {
                      const state = window.__SURFACE_QA__.inspect('production');
                      return state.cameraPresetId === 'overview'
                        && state.runtimeState.openingProgress === 0
                        && state.runtimeState.visitorProgress === 0
                        && state.runtimeState.roofExploded === false
                        && state.cutaway === false
                        && state.profileId === 'museum1940sBalanced';
                    }""",
                    timeout=15_000,
                )
                render_serial_after = wait_for_new_render(render_serial_before)
                return {
                    "selector": "#reset",
                    "renderSerialBefore": render_serial_before,
                    "renderSerialAfter": render_serial_after,
                    "renderedNewFrame": render_serial_after > render_serial_before,
                    "state": page.evaluate("window.__SURFACE_QA__.inspect('production')"),
                }

            ui_control_evidence["initialReset"] = click_reset_and_wait()
            camera_button_count = page.locator("[data-camera]").count()
            camera_controls: list[dict[str, object]] = []
            for camera_id in ("overview", "ab", "eave", "roof", "wall", "stair"):
                selector = f'[data-camera="{camera_id}"]'
                render_serial_before = current_render_serial()
                page.locator(selector).click()
                page.wait_for_function(
                    "(id) => window.__SURFACE_QA__.inspect('production').cameraPresetId === id",
                    arg=camera_id,
                    timeout=10_000,
                )
                render_serial_after = wait_for_new_render(render_serial_before)
                camera_state = page.evaluate("window.__SURFACE_QA__.inspect('production')")
                camera_controls.append({
                    "selector": selector,
                    "cameraId": camera_id,
                    "activeCameraId": camera_state.get("cameraPresetId"),
                    "cameraFingerprint": camera_state.get("cameraFingerprint"),
                    "renderSerialBefore": render_serial_before,
                    "renderSerialAfter": render_serial_after,
                    "renderedNewFrame": render_serial_after > render_serial_before,
                })
            ui_control_evidence["cameraButtons"] = camera_controls

            ui_control_evidence["beforeExplode"] = click_reset_and_wait()
            explode_before = current_render_serial()
            page.locator("#explode").click()
            page.wait_for_function(
                "window.__SURFACE_QA__.inspect('production').runtimeState.roofExploded === true",
                timeout=10_000,
            )
            explode_after = wait_for_new_render(explode_before)
            exploded_ui_state = page.evaluate("window.__SURFACE_QA__.inspect('production')")
            page.locator("#explode").click()
            page.wait_for_function(
                "window.__SURFACE_QA__.inspect('production').runtimeState.roofExploded === false",
                timeout=10_000,
            )
            explode_off_after = wait_for_new_render(explode_after)
            ui_control_evidence["explode"] = {
                "selector": "#explode",
                "renderSerialBefore": explode_before,
                "renderSerialExploded": explode_after,
                "renderSerialRestored": explode_off_after,
                "explodedState": {
                    "roofExploded": exploded_ui_state.get("runtimeState", {}).get("roofExploded"),
                    "roofUnitCount": len(exploded_ui_state.get("roofUnits", [])),
                    "layerCounts": {
                        roof.get("roofUnitId"): roof.get("layerCounts")
                        for roof in exploded_ui_state.get("roofUnits", [])
                    },
                },
                "restored": page.evaluate(
                    "window.__SURFACE_QA__.inspect('production').runtimeState.roofExploded === false",
                ),
            }

            preset_controls: list[dict[str, object]] = []
            for profile_id in ("wulongWeathered", "daliMaintained", "museum1940sBalanced"):
                render_serial_before = current_render_serial()
                page.locator("#preset").select_option(profile_id)
                page.wait_for_function(
                    "(id) => window.__SURFACE_QA__.inspect('production').profileId === id",
                    arg=profile_id,
                    timeout=15_000,
                )
                render_serial_after = wait_for_new_render(render_serial_before)
                preset_state = page.evaluate("window.__SURFACE_QA__.inspect('production')")
                preset_controls.append({
                    "selector": "#preset",
                    "selectedOption": profile_id,
                    "profileId": preset_state.get("profileId"),
                    "surfaceFingerprint": preset_state.get("surfaceFingerprint"),
                    "structuralFingerprint": preset_state.get("structuralFingerprint"),
                    "renderSerialBefore": render_serial_before,
                    "renderSerialAfter": render_serial_after,
                    "renderedNewFrame": render_serial_after > render_serial_before,
                })
            ui_control_evidence["presets"] = preset_controls

            mode_controls: list[dict[str, object]] = []
            for selector in ("#roofOnly", "#wallOnly", "#historyOnly"):
                ui_control_evidence[f"resetBefore{selector}"] = click_reset_and_wait()
                render_serial_before = current_render_serial()
                page.locator(selector).click()
                page.wait_for_function(
                    "(selector) => document.querySelector(selector)?.getAttribute('aria-pressed') === 'true'",
                    arg=selector,
                    timeout=10_000,
                )
                render_serial_after = wait_for_new_render(render_serial_before)
                active_state = page.evaluate("window.__SURFACE_QA__.inspect('production')")
                reset_evidence = click_reset_and_wait()
                mode_controls.append({
                    "selector": selector,
                    "renderSerialBefore": render_serial_before,
                    "renderSerialAfter": render_serial_after,
                    "renderedNewFrame": render_serial_after > render_serial_before,
                    "activeCutaway": active_state.get("cutaway"),
                    "activeStructuralFingerprint": active_state.get("structuralFingerprint"),
                    "reset": reset_evidence,
                })
            ui_control_evidence["viewModes"] = mode_controls

            ui_control_evidence["resetBeforeOpenings"] = click_reset_and_wait()
            openings_before = current_render_serial()
            page.locator("#openings").click()
            page.wait_for_function(
                "window.__SURFACE_QA__.inspect('production').runtimeState.openingProgress === 1",
                timeout=10_000,
            )
            openings_after = wait_for_new_render(openings_before)
            openings_ui_open = page.evaluate("window.__SURFACE_QA__.inspect('production')")
            page.locator("#openings").click()
            page.wait_for_function(
                "window.__SURFACE_QA__.inspect('production').runtimeState.openingProgress === 0",
                timeout=10_000,
            )
            openings_closed_after = wait_for_new_render(openings_after)
            openings_ui_closed = page.evaluate("window.__SURFACE_QA__.inspect('production')")
            ui_control_evidence["openings"] = {
                "selector": "#openings",
                "renderSerialBefore": openings_before,
                "renderSerialOpen": openings_after,
                "renderSerialClosed": openings_closed_after,
                "openProgress": openings_ui_open.get("runtimeState", {}).get("openingProgress"),
                "closedProgress": openings_ui_closed.get("runtimeState", {}).get("openingProgress"),
                "openLeafProgress": openings_ui_open.get("openings", {}).get("progress"),
                "closedLeafProgress": openings_ui_closed.get("openings", {}).get("progress"),
            }

            ui_control_evidence["resetBeforeVisitor"] = click_reset_and_wait()
            visitor_before = current_render_serial()
            page.locator("#visitor").click()
            page.wait_for_function(
                """() => {
                  const visitor = window.__SURFACE_QA__.inspect('production').visitor;
                  return visitor.complete === true
                    && visitor.reachedUpperFloor === true
                    && visitor.browserPlayback?.completed === true;
                }""",
                timeout=30_000,
            )
            visitor_after = current_render_serial()
            visitor_ui_complete = page.evaluate("window.__SURFACE_QA__.inspect('production').visitor")
            page.locator("#visitor").click()
            page.wait_for_function(
                "window.__SURFACE_QA__.inspect('production').runtimeState.visitorProgress === 0",
                timeout=10_000,
            )
            visitor_reset_after = wait_for_new_render(visitor_after)
            ui_control_evidence["visitor"] = {
                "selector": "#visitor",
                "renderSerialBefore": visitor_before,
                "renderSerialComplete": visitor_after,
                "renderSerialReset": visitor_reset_after,
                "completed": visitor_ui_complete.get("complete"),
                "reachedUpperFloor": visitor_ui_complete.get("reachedUpperFloor"),
                "browserPlayback": visitor_ui_complete.get("browserPlayback"),
                "routeSampleCount": visitor_ui_complete.get("routeSampleCount"),
                "wallIntersectionCount": visitor_ui_complete.get("wallIntersectionCount"),
                "suspendedFrameCount": visitor_ui_complete.get("suspendedFrameCount"),
                "stuckFrameCount": visitor_ui_complete.get("stuckFrameCount"),
            }
            ui_control_evidence["finalReset"] = click_reset_and_wait()

            camera_fingerprints = {
                item["cameraId"]: item["cameraFingerprint"] for item in camera_controls
            }

            def camera_fingerprint_is_valid(value: object) -> bool:
                if not isinstance(value, str) or not value:
                    return False
                try:
                    parsed = json.loads(value)
                except (TypeError, ValueError):
                    return False
                return (
                    isinstance(parsed, dict)
                    and isinstance(parsed.get("position"), list)
                    and len(parsed["position"]) == 3
                    and isinstance(parsed.get("target"), list)
                    and len(parsed["target"]) == 3
                    and isinstance(parsed.get("fov"), (int, float))
                )

            explode_layers_valid = (
                ui_control_evidence["explode"]["explodedState"]["roofUnitCount"] == 7
                and all(
                    all((layers or {}).get(layer, 0) > 0 for layer in EXPECTED_ROOF_LAYERS)
                    for layers in ui_control_evidence["explode"]["explodedState"]["layerCounts"].values()
                )
            )
            check(
                "all public UI controls execute through real locator clicks and selection",
                camera_button_count == 6
                and len(camera_controls) == 6
                and all(
                    item.get("activeCameraId") == item.get("cameraId")
                    and item.get("renderedNewFrame") is True
                    and camera_fingerprint_is_valid(item.get("cameraFingerprint"))
                    for item in camera_controls
                )
                and camera_fingerprints.get("overview") == camera_fingerprints.get("ab")
                and len(set(camera_fingerprints.values())) == 5
                and explode_after > explode_before
                and explode_off_after > explode_after
                and explode_layers_valid
                and ui_control_evidence["explode"].get("restored") is True
                and len({item.get("surfaceFingerprint") for item in preset_controls}) == 3
                and len({item.get("structuralFingerprint") for item in preset_controls}) == 1
                and all(item.get("profileId") == item.get("selectedOption") and item.get("renderedNewFrame") is True for item in preset_controls)
                and all(
                    item.get("activeCutaway") is True
                    and item.get("renderedNewFrame") is True
                    and item.get("reset", {}).get("state", {}).get("cutaway") is False
                    and item.get("reset", {}).get("renderedNewFrame") is True
                    for item in mode_controls
                )
                and ui_control_evidence["openings"].get("openProgress") == 1
                and ui_control_evidence["openings"].get("closedProgress") == 0
                and all(value == 1 for value in ui_control_evidence["openings"].get("openLeafProgress", []))
                and all(value == 0 for value in ui_control_evidence["openings"].get("closedLeafProgress", []))
                and openings_after > openings_before
                and openings_closed_after > openings_after
                and ui_control_evidence["visitor"].get("completed") is True
                and ui_control_evidence["visitor"].get("reachedUpperFloor") is True
                and ui_control_evidence["visitor"].get("browserPlayback", {}).get("frameCount") == 33
                and ui_control_evidence["visitor"].get("browserPlayback", {}).get("renderedFrameCount") == 33
                and ui_control_evidence["visitor"].get("browserPlayback", {}).get("uniquePositionCount") == 33
                and ui_control_evidence["visitor"].get("routeSampleCount", 0) >= 300
                and ui_control_evidence["visitor"].get("wallIntersectionCount") == 0
                and ui_control_evidence["visitor"].get("suspendedFrameCount") == 0
                and ui_control_evidence["visitor"].get("stuckFrameCount") == 0
                and visitor_after > visitor_before
                and visitor_reset_after > visitor_after
                and ui_control_evidence["finalReset"].get("renderedNewFrame") is True,
                ui_control_evidence,
            )
            executed_phases.append("ui-controls")

            page.evaluate("window.__SURFACE_QA__.reset()")
            visual_evidence["abCameraRender"] = set_camera_and_wait("overview")
            visual_evidence["abDomLayout"] = dom_layout_state()
            visual_evidence["ab"] = {
                "baseline": visual_state(page, "baseline"),
                "production": visual_state(page, "production"),
            }
            capture_desktop("v550_ab_same_camera.png")
            visual_evidence["productionOnlyLayout"] = enter_production_only_layout()
            visual_evidence["complete"] = visual_state(page)
            capture_desktop("v550_complete_building.png")
            visual_evidence["eaveCameraRender"] = set_camera_and_wait("qaEave")
            visual_evidence["eave"] = visual_state(page)
            capture_desktop("v550_pan_cover_eave_closeup.png")
            normal_display_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            visual_evidence["ridgeIsolation"] = page.evaluate("window.__SURFACE_QA__.setQADisplayState('ridge')")
            visual_evidence["ridgeCameraRender"] = set_camera_and_wait("qaRidge")
            visual_evidence["ridge"] = visual_state(page)
            capture_desktop("v550_ridge_closures.png")
            visual_evidence["ridgeRestore"] = page.evaluate("window.__SURFACE_QA__.restoreQADisplayState()")
            ridge_restored_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            visual_evidence["wallAbutmentIsolation"] = page.evaluate("window.__SURFACE_QA__.setQADisplayState('wallAbutment')")
            visual_evidence["wallAbutmentCameraRender"] = set_camera_and_wait("qaWallAbutment")
            visual_evidence["wallAbutment"] = visual_state(page)
            capture_desktop("v550_wall_abutment_closeup.png")
            visual_evidence["wallAbutmentRestore"] = page.evaluate("window.__SURFACE_QA__.restoreQADisplayState()")
            wall_abutment_restored_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            page.evaluate("window.__SURFACE_QA__.setRoofExploded(true)")
            visual_evidence["explodedIsolation"] = page.evaluate("window.__SURFACE_QA__.setQADisplayState('exploded')")
            visual_evidence["explodedCameraRender"] = set_camera_and_wait("qaExploded")
            visual_evidence["exploded"] = visual_state(page)
            capture_desktop("v550_roof_exploded_layers.png")
            visual_evidence["explodedRestore"] = page.evaluate("window.__SURFACE_QA__.restoreQADisplayState()")
            page.evaluate("window.__SURFACE_QA__.setRoofExploded(false)")
            exploded_restored_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            visual_evidence["wallCameraRender"] = set_camera_and_wait("wall")
            visual_evidence["wall"] = visual_state(page)
            capture_desktop("v550_wall_weathering_closeup.png")
            visual_evidence["openingsCameraRender"] = set_camera_and_wait("qaOpenings")
            visual_evidence["openingsClosedRender"] = set_openings_and_wait(0)
            visual_evidence["openingsClosed"] = visual_state(page)
            capture_desktop("v550_openings_closed.png")
            visual_evidence["openingsOpenRender"] = set_openings_and_wait(1)
            visual_evidence["openingsOpen"] = visual_state(page)
            capture_desktop("v550_openings_open.png")
            visual_evidence["doorClosedRender"] = set_openings_and_wait(0)
            door_normal_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            visual_evidence["doorIsolation"] = page.evaluate("window.__SURFACE_QA__.setQADisplayState('door')")
            visual_evidence["doorCameraRender"] = set_camera_and_wait("qaDoor")
            visual_evidence["doorClosed"] = visual_state(page)
            capture_desktop("v550_door_closed_closeup.png")
            visual_evidence["doorOpenRender"] = set_openings_and_wait(1)
            visual_evidence["doorOpen"] = visual_state(page)
            capture_desktop("v550_door_open_closeup.png")
            visual_evidence["doorResetRender"] = set_openings_and_wait(0)
            visual_evidence["doorRestore"] = page.evaluate("window.__SURFACE_QA__.restoreQADisplayState()")
            door_restored_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            window_normal_fingerprint = door_restored_fingerprint
            visual_evidence["windowIsolation"] = page.evaluate("window.__SURFACE_QA__.setQADisplayState('window')")
            visual_evidence["windowCameraRender"] = set_camera_and_wait("qaWindow")
            visual_evidence["windowClosedRender"] = set_openings_and_wait(0)
            visual_evidence["windowClosed"] = visual_state(page)
            capture_desktop("v550_window_closed_closeup.png")
            visual_evidence["windowOpenRender"] = set_openings_and_wait(1)
            visual_evidence["windowOpen"] = visual_state(page)
            capture_desktop("v550_window_open_closeup.png")
            visual_evidence["windowResetRender"] = set_openings_and_wait(0)
            visual_evidence["windowRestore"] = page.evaluate("window.__SURFACE_QA__.restoreQADisplayState()")
            window_restored_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            visual_evidence["routeOpeningsRender"] = set_openings_and_wait(1)
            page.evaluate("window.__SURFACE_QA__.setVisitorProgress(1)")
            visual_evidence["routeOverlay"] = page.evaluate("window.__SURFACE_QA__.setQARouteEvidence(true)")
            visual_evidence["routeCameraRender"] = set_camera_and_wait("qaRoute")
            visual_evidence["route"] = visual_state(page)
            capture_desktop("v550_visitor_entry_to_upper_route.png")
            stair_normal_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            visual_evidence["stairIsolation"] = page.evaluate("window.__SURFACE_QA__.setQADisplayState('stair')")
            visual_evidence["stairCameraRender"] = set_camera_and_wait("qaStair")
            visual_evidence["stair"] = visual_state(page)
            capture_desktop("v550_stair_8_plus_8.png")
            visual_evidence["stairRestore"] = page.evaluate("window.__SURFACE_QA__.restoreQADisplayState()")
            stair_restored_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            visual_evidence["productionOnlyLayoutRestore"] = restore_production_only_layout(
                visual_evidence["productionOnlyLayout"]["restoreToken"],
            )
            layout_transition = visual_evidence["productionOnlyLayout"]
            layout_before = layout_transition["before"]
            layout_isolated = layout_transition["isolated"]
            layout_restore = visual_evidence["productionOnlyLayoutRestore"]
            layout_restored = layout_restore["restored"]
            isolated_rect = layout_isolated.get("productionViewportRect") or {}
            isolated_client_size = layout_isolated.get("productionClientSize") or {}
            original_rect = layout_before.get("productionViewportRect") or {}
            restored_rect = layout_restored.get("productionViewportRect") or {}
            isolated_contract = layout_isolated.get("renderingContract") or {}
            check(
                "production-only screenshot layout is full-width, rendered, fingerprint-safe and exactly restored",
                visual_evidence["abDomLayout"].get("inline") == layout_before.get("inline")
                and visual_evidence["abDomLayout"].get("computed") == layout_before.get("computed")
                and visual_evidence["abDomLayout"].get("productionViewportRect") == original_rect
                and layout_before.get("computed", {}).get("baselineDisplay") != "none"
                and len(str(layout_before.get("computed", {}).get("mainGridTemplateColumns", "")).split()) == 2
                and layout_isolated.get("computed", {}).get("baselineDisplay") == "none"
                and layout_isolated.get("computed", {}).get("productionDisplay") != "none"
                and len(str(layout_isolated.get("computed", {}).get("mainGridTemplateColumns", "")).split()) == 1
                and isolated_rect.get("width", 0) > original_rect.get("width", 0) * 1.5
                and (isolated_contract.get("cssViewport") or {}).get("width") == isolated_client_size.get("width")
                and (isolated_contract.get("cssViewport") or {}).get("height") == isolated_client_size.get("height")
                and abs(isolated_client_size.get("width", 0) - isolated_rect.get("width", 0)) <= 2
                and abs(isolated_client_size.get("height", 0) - isolated_rect.get("height", 0)) <= 2
                and rendering_values_are_valid(isolated_contract)
                and layout_transition.get("renderedAfterResize") is True
                and layout_before.get("structuralFingerprint") == layout_isolated.get("structuralFingerprint")
                and layout_before.get("surfaceFingerprint") == layout_isolated.get("surfaceFingerprint")
                and layout_before.get("fullGeometryFingerprint") == layout_isolated.get("fullGeometryFingerprint")
                and layout_restore.get("renderedAfterResize") is True
                and layout_restored.get("inline") == layout_before.get("inline")
                and layout_restored.get("computed") == layout_before.get("computed")
                and restored_rect == original_rect
                and layout_restored.get("structuralFingerprint") == layout_before.get("structuralFingerprint")
                and layout_restored.get("surfaceFingerprint") == layout_before.get("surfaceFingerprint")
                and layout_restored.get("fullGeometryFingerprint") == layout_before.get("fullGeometryFingerprint")
                and rendering_values_are_valid(layout_restored.get("renderingContract") or {}),
                {
                    "abOriginal": visual_evidence["abDomLayout"],
                    "transition": layout_transition,
                    "restore": layout_restore,
                },
            )
            check(
                "visual QA states match their real camera and interaction contracts",
                visual_evidence["eave"].get("cameraPresetId") == "qaEave"
                and visual_evidence["ridge"].get("cameraPresetId") == "qaRidge"
                and {"principalRidge", "vergeClosure", "endClosure"}.issubset(
                    set(visual_evidence["ridge"].get("cameraEvidence", {}).get("featureSemantics", []))
                )
                and len(visual_evidence["ridge"].get("cameraEvidence", {}).get("bounds") or []) == 6
                and all(
                    visual_evidence["ridge"]["cameraEvidence"]["bounds"][index + 3]
                    > visual_evidence["ridge"]["cameraEvidence"]["bounds"][index]
                    for index in range(3)
                )
                and visual_evidence["wallAbutment"].get("cameraPresetId") == "qaWallAbutment"
                and "wallAbutment" in visual_evidence["wallAbutment"].get("cameraEvidence", {}).get("featureSemantics", [])
                and visual_evidence["exploded"].get("roofExploded") is True
                and visual_evidence["explodedIsolation"].get("visibleRoofLayerCount") == 7
                and visual_evidence["explodedIsolation"].get("minimumLayerCenterSeparationM", 0) >= 1.0
                and visual_evidence["ridgeIsolation"].get("mode") == "ridge"
                and visual_evidence["ridgeIsolation"].get("selectedRoofUnitId") == "mainHouseDoublePitch"
                and visual_evidence["ridgeIsolation"].get("hiddenObjectCount", 0) > 0
                and all(
                    visual_evidence["ridgeIsolation"].get("visibleRidgeSemanticCounts", {}).get(semantic, 0) > 0
                    for semantic in ("principalRidge", "vergeClosure", "endClosure", "verticalRidge")
                )
                and visual_evidence["wallAbutmentIsolation"].get("mode") == "wallAbutment"
                and visual_evidence["wallAbutmentIsolation"].get("selectedRoofUnitId") == "mainGalleryLeanTo"
                and visual_evidence["wallAbutmentIsolation"].get("hiddenObjectCount", 0) > 0
                and visual_evidence["wallAbutmentIsolation"].get("visibleRidgeSemanticCounts", {}).get("wallAbutment", 0) > 0
                and visual_evidence["doorIsolation"].get("mode") == "door"
                and visual_evidence["doorIsolation"].get("selectedOpeningId") == "GATE-SOUTH-01"
                and visual_evidence["doorIsolation"].get("hiddenObjectCount", 0) > 0
                and visual_evidence["windowIsolation"].get("mode") == "window"
                and visual_evidence["windowIsolation"].get("selectedOpeningId") == "WINDOW-NORTH-LEFT"
                and visual_evidence["windowIsolation"].get("hiddenObjectCount", 0) > 0
                and visual_evidence["stairIsolation"].get("hiddenObjectCount") == 1
                and visual_evidence["openingsClosed"].get("openingProgress") == 0
                and visual_evidence["openingsOpen"].get("openingProgress") == 1
                and visual_evidence["doorClosed"].get("cameraPresetId") == "qaDoor"
                and visual_evidence["doorOpen"].get("cameraPresetId") == "qaDoor"
                and visual_evidence["doorClosed"].get("openingProgress") == 0
                and visual_evidence["doorOpen"].get("openingProgress") == 1
                and {"doorLeaf", "openingFrame", "replacementPart", "openingHinge"}.issubset(
                    set(visual_evidence["doorClosed"].get("cameraEvidence", {}).get("featureSemantics", []))
                )
                and any(
                    "PIVOT" in component_id or "HINGE" in component_id
                    for component_id in visual_evidence["doorClosed"].get("cameraEvidence", {}).get("componentIds", [])
                )
                and len(visual_evidence["doorClosed"].get("cameraEvidence", {}).get("bounds") or []) == 6
                and visual_evidence["doorClosed"].get("qaDisplayState", {}).get("mode") == "door"
                and visual_evidence["doorClosed"].get("qaDisplayState", {}).get("active") is True
                and visual_evidence["doorClosed"].get("qaDisplayState", {}).get("geometryMutation") is False
                and visual_evidence["doorClosed"].get("qaDisplayState", {}).get("materialMutation") is False
                and visual_evidence["doorOpen"].get("qaDisplayState", {}).get("mode") == "door"
                and visual_evidence["windowClosed"].get("cameraPresetId") == "qaWindow"
                and visual_evidence["windowOpen"].get("cameraPresetId") == "qaWindow"
                and visual_evidence["windowClosed"].get("openingProgress") == 0
                and visual_evidence["windowOpen"].get("openingProgress") == 1
                and {"windowLeaf", "openingFrame", "openingSill", "openingHinge"}.issubset(
                    set(visual_evidence["windowClosed"].get("cameraEvidence", {}).get("featureSemantics", []))
                )
                and any(
                    "PIVOT" in component_id or "HINGE" in component_id
                    for component_id in visual_evidence["windowClosed"].get("cameraEvidence", {}).get("componentIds", [])
                )
                and len(visual_evidence["windowClosed"].get("cameraEvidence", {}).get("bounds") or []) == 6
                and visual_evidence["windowClosed"].get("qaDisplayState", {}).get("mode") == "window"
                and visual_evidence["windowClosed"].get("qaDisplayState", {}).get("active") is True
                and visual_evidence["windowClosed"].get("qaDisplayState", {}).get("geometryMutation") is False
                and visual_evidence["windowClosed"].get("qaDisplayState", {}).get("materialMutation") is False
                and visual_evidence["windowOpen"].get("qaDisplayState", {}).get("mode") == "window"
                and all(visual_evidence[key].get("renderedNewFrame") is True for key in (
                    "openingsClosedRender", "openingsOpenRender", "doorClosedRender", "doorOpenRender",
                    "doorResetRender", "windowClosedRender", "windowOpenRender", "windowResetRender",
                    "routeOpeningsRender"
                ))
                and all(visual_evidence[key].get("renderedNewFrame") is True for key in (
                    "abCameraRender", "eaveCameraRender", "ridgeCameraRender",
                    "wallAbutmentCameraRender", "explodedCameraRender", "wallCameraRender",
                    "openingsCameraRender", "doorCameraRender", "windowCameraRender",
                    "routeCameraRender", "stairCameraRender"
                ))
                and len(visual_evidence.get("captureFrames", {})) == 15
                and all(
                    item.get("renderedNewFrame") is True
                    for item in visual_evidence.get("captureFrames", {}).values()
                )
                and visual_evidence["route"].get("visitorProgress") == 1
                and visual_evidence["stair"].get("cameraPresetId") == "qaStair"
                and all(visual_evidence[key].get("cutaway") is False for key in (
                    "eave", "openingsClosed", "openingsOpen", "route"
                )),
                visual_evidence,
            )
            check(
                "temporary QA display states restore the exact structural fingerprint",
                ridge_restored_fingerprint == normal_display_fingerprint
                and wall_abutment_restored_fingerprint == normal_display_fingerprint
                and exploded_restored_fingerprint == normal_display_fingerprint
                and door_restored_fingerprint == door_normal_fingerprint
                and window_restored_fingerprint == window_normal_fingerprint
                and stair_restored_fingerprint == stair_normal_fingerprint
                and all(visual_evidence[key].get("restored") is True for key in (
                    "ridgeRestore", "wallAbutmentRestore", "explodedRestore", "doorRestore",
                    "windowRestore", "stairRestore"
                )),
                {
                    "normal": normal_display_fingerprint, "ridge": ridge_restored_fingerprint,
                    "wallAbutment": wall_abutment_restored_fingerprint,
                    "exploded": exploded_restored_fingerprint,
                    "doorNormal": door_normal_fingerprint, "door": door_restored_fingerprint,
                    "windowNormal": window_normal_fingerprint, "window": window_restored_fingerprint,
                    "stairNormal": stair_normal_fingerprint, "stair": stair_restored_fingerprint,
                },
            )
            executed_phases.append("screenshots")
            context.close()

            mobile = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
            mobile_page = mobile.new_page()
            mobile_page.on("pageerror", lambda exc: page_errors.append(f"mobile: {exc}"))
            mobile_page.on("console", lambda msg: console_errors.append(f"mobile: {msg.text}") if msg.type == "error" else None)
            mobile_page.on("requestfailed", lambda request: failed_requests.append(f"mobile: {request.method} {request.url}: {request.failure}"))
            mobile_page.on("response", capture_response)
            mobile_started = time.perf_counter()
            mobile_page.goto(page_url, wait_until="load", timeout=180_000)
            mobile_page.wait_for_function("window.__SURFACE_QA__?.ready === true", timeout=180_000)
            mobile_load_seconds = time.perf_counter() - mobile_started
            mobile_page.evaluate("window.__SURFACE_QA__.setOpeningsProgress(1)")
            mobile_page.evaluate("window.__SURFACE_QA__.setVisitorProgress(1)")
            mobile_page.wait_for_function(
                """() => {
                  const evidence = window.__SURFACE_QA__.performanceEvidence();
                  return evidence.sampleCount >= 4
                    && evidence.steadySampleCount >= 3
                    && evidence.recentSteadyFps.length >= 3;
                }""",
                timeout=120_000,
            )
            mobile_snapshot = mobile_page.evaluate("window.__SURFACE_QA__.inspect('production')")
            visual_evidence["mobile"] = visual_state(mobile_page)
            check("mobile complete building", mobile_snapshot.get("completeBuilding") is True and mobile_snapshot.get("roofSystem", {}).get("complete") is True)
            check(
                "mobile opening and visitor regression",
                all(value == 1 for value in mobile_snapshot.get("openings", {}).get("progress", []))
                and mobile_snapshot.get("visitor", {}).get("complete") is True
                and mobile_snapshot.get("visitor", {}).get("wallIntersectionCount") == 0,
                {"openings": mobile_snapshot.get("openings"), "visitor": mobile_snapshot.get("visitor")},
            )
            check("mobile viewport is 390x844", mobile_page.viewport_size == {"width": 390, "height": 844}, mobile_page.viewport_size)
            mobile_fps_evidence = mobile_snapshot.get("performanceEvidence") or {}
            check(
                "mobile production rendering resolution contract",
                rendering_contract_is_valid(mobile_snapshot)
                and 0 < (mobile_snapshot.get("renderer") or {}).get("drawCalls", 0) <= 731,
                {
                    "renderer": mobile_snapshot.get("renderer"),
                    "renderingContract": mobile_fps_evidence.get("renderingContract"),
                },
            )
            check(
                "mobile SwiftShader FPS floor is stable across repeated samples",
                mobile_fps_evidence.get("sampleCount", 0) >= 4
                and mobile_fps_evidence.get("steadySampleCount", 0) >= 3
                and len(mobile_fps_evidence.get("recentSteadyFps", [])) >= 3
                and mobile_fps_evidence.get("stableFps", 0) >= 5
                and all(value >= 5 for value in mobile_fps_evidence.get("recentSteadyFps", [])),
                mobile_fps_evidence,
            )
            mobile_path = screenshot_dir / "v550_mobile_regression.png"
            mobile_page.screenshot(
                path=str(mobile_path),
                clip={"x": 0, "y": 0, "width": 390, "height": 844},
                timeout=120_000,
            )
            mobile_payload = mobile_path.read_bytes() if mobile_path.is_file() else b""
            mobile_dimensions = struct.unpack(">II", mobile_payload[16:24]) if (
                len(mobile_payload) >= 24 and mobile_payload[:8] == b"\x89PNG\r\n\x1a\n"
            ) else (None, None)
            mobile_screenshot_valid = len(mobile_payload) > 0 and mobile_dimensions == (390, 844)
            check(
                "mobile screenshot is a verified 390x844 PNG",
                mobile_screenshot_valid,
                {"bytes": len(mobile_payload), "dimensions": mobile_dimensions},
            )
            if not mobile_screenshot_valid:
                raise AssertionError("mobile screenshot was not written as a valid 390x844 PNG")
            executed_phases.append("mobile")
            mobile.close()
            browser.close()
            browser = None

            check("page load time recorded", load_seconds > 0, round(load_seconds, 3))
            required_screenshots = {
                "v550_complete_building.png",
                "v550_ab_same_camera.png",
                "v550_pan_cover_eave_closeup.png",
                "v550_ridge_closures.png",
                "v550_wall_abutment_closeup.png",
                "v550_roof_exploded_layers.png",
                "v550_wall_weathering_closeup.png",
                "v550_openings_closed.png",
                "v550_openings_open.png",
                "v550_door_closed_closeup.png",
                "v550_door_open_closeup.png",
                "v550_window_closed_closeup.png",
                "v550_window_open_closeup.png",
                "v550_visitor_entry_to_upper_route.png",
                "v550_stair_8_plus_8.png",
                "v550_mobile_regression.png",
            }
            generated_screenshots = {path.name for path in screenshot_dir.glob("v550_*.png") if path.stat().st_size > 0}
            check("required visual QA screenshots generated", required_screenshots <= generated_screenshots, sorted(generated_screenshots))
            check("no console errors", not console_errors, console_errors)
            check("no page errors", not page_errors, page_errors)
            check("no failed requests", not failed_requests, failed_requests)
            check("no HTTP 4xx or 5xx", not http_errors, http_errors)
            check("no external runtime requests", not external_requests, external_requests)
    except Exception as exc:
        uncaught_exception = {
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback": traceback.format_exc(),
        }
        check("uncaught test exception", False, uncaught_exception)
    finally:
        # Playwright-owned objects are either closed on the success path above or
        # released by playwright.stop() while its event loop is still valid.
        # Never call browser.close() here after leaving the Playwright context:
        # doing so masks the original failure with "Event loop is closed".
        if server is not None:
            try:
                server.shutdown()
                server.server_close()
            except Exception as exc:
                cleanup_errors.append(f"server.close: {type(exc).__name__}: {exc}")

    check("browser and server cleanup", not cleanup_errors, cleanup_errors)

    def screenshot_evidence(path: Path) -> dict[str, object]:
        payload = path.read_bytes()
        pixel_evidence = png_pixel_evidence(payload)
        width = pixel_evidence.get("width")
        height = pixel_evidence.get("height")
        screenshot_contracts = {
            "v550_complete_building.png": {"camera": "overview", "state": "complete-building"},
            "v550_ab_same_camera.png": {"camera": "overview", "state": "same-camera-same-seed-ab"},
            "v550_pan_cover_eave_closeup.png": {"camera": "qaEave", "state": "pan-cover-eave-drainage"},
            "v550_ridge_closures.png": {"camera": "qaRidge", "state": "principal-ridge-verge-end-closure"},
            "v550_wall_abutment_closeup.png": {"camera": "qaWallAbutment", "state": "wall-abutment-closeup"},
            "v550_roof_exploded_layers.png": {"camera": "qaExploded", "state": "seven-layer-separated-oblique"},
            "v550_wall_weathering_closeup.png": {"camera": "wall", "state": "wall-weathering"},
            "v550_openings_closed.png": {"camera": "qaOpenings", "state": "doors-windows-closed"},
            "v550_openings_open.png": {"camera": "qaOpenings", "state": "doors-windows-open"},
            "v550_door_closed_closeup.png": {"camera": "qaDoor", "state": "door-leaves-frame-sill-closed-closeup"},
            "v550_door_open_closeup.png": {"camera": "qaDoor", "state": "door-leaves-frame-sill-open-closeup"},
            "v550_window_closed_closeup.png": {"camera": "qaWindow", "state": "window-leaves-frame-sill-closed-closeup"},
            "v550_window_open_closeup.png": {"camera": "qaWindow", "state": "window-leaves-frame-sill-open-closeup"},
            "v550_visitor_entry_to_upper_route.png": {"camera": "qaRoute", "state": "actual-route-overlay-entry-to-upper"},
            "v550_stair_8_plus_8.png": {"camera": "qaStair", "state": "eight-plus-eight-stair"},
            "v550_mobile_regression.png": {"camera": "overview", "state": "390x844-mobile"},
        }
        evidence = {
            "name": path.name,
            "filename": path.name,
            "bytes": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
            "width": width,
            "height": height,
            "pngPixelEvidence": pixel_evidence,
            "captureContract": screenshot_contracts.get(path.name),
            "captureFrame": visual_evidence.get("captureFrames", {}).get(path.name),
            "captureLayout": (
                "dual-view-ab" if path.name == "v550_ab_same_camera.png"
                else "mobile-390x844" if path.name == "v550_mobile_regression.png"
                else "production-only-full-width"
            ),
            "check": (screenshot_contracts.get(path.name) or {}).get("state"),
        }
        visual_keys = {
            "v550_complete_building.png": "complete",
            "v550_ab_same_camera.png": "ab",
            "v550_pan_cover_eave_closeup.png": "eave",
            "v550_ridge_closures.png": "ridge",
            "v550_wall_abutment_closeup.png": "wallAbutment",
            "v550_roof_exploded_layers.png": "exploded",
            "v550_wall_weathering_closeup.png": "wall",
            "v550_openings_closed.png": "openingsClosed",
            "v550_openings_open.png": "openingsOpen",
            "v550_door_closed_closeup.png": "doorClosed",
            "v550_door_open_closeup.png": "doorOpen",
            "v550_window_closed_closeup.png": "windowClosed",
            "v550_window_open_closeup.png": "windowOpen",
            "v550_visitor_entry_to_upper_route.png": "route",
            "v550_stair_8_plus_8.png": "stair",
            "v550_mobile_regression.png": "mobile",
        }
        if path.name in visual_keys:
            qa_state = visual_evidence.get(visual_keys[path.name])
            evidence["qaState"] = qa_state
            flat_state = qa_state.get("production") if path.name == "v550_ab_same_camera.png" and isinstance(qa_state, dict) else qa_state
            if isinstance(flat_state, dict):
                evidence.update({
                    "camera": flat_state.get("camera"),
                    "cameraPresetId": flat_state.get("cameraPresetId"),
                    "cameraFingerprint": flat_state.get("cameraFingerprint"),
                    "seed": flat_state.get("seed"),
                    "structuralFingerprint": flat_state.get("structuralFingerprint"),
                    "surfaceFingerprint": flat_state.get("surfaceFingerprint"),
                    "viewport": flat_state.get("viewport"),
                })
        if path.name == "v550_visitor_entry_to_upper_route.png":
            evidence["routeOverlayEvidence"] = visual_evidence.get("routeOverlay")
        if path.name == "v550_ab_same_camera.png":
            evidence["abComparison"] = ab_metadata
        return evidence

    screenshots = [screenshot_evidence(path) for path in sorted(screenshot_dir.glob("v550_*.png")) if path.is_file()]
    screenshots_by_name = {item.get("filename"): item for item in screenshots}
    check(
        "door and window closed/open screenshots contain different rendered pixels",
        screenshots_by_name.get("v550_door_closed_closeup.png", {}).get("sha256")
        != screenshots_by_name.get("v550_door_open_closeup.png", {}).get("sha256")
        and screenshots_by_name.get("v550_window_closed_closeup.png", {}).get("sha256")
        != screenshots_by_name.get("v550_window_open_closeup.png", {}).get("sha256")
        and all(
            screenshots_by_name.get(filename, {}).get("sha256")
            for filename in (
                "v550_door_closed_closeup.png", "v550_door_open_closeup.png",
                "v550_window_closed_closeup.png", "v550_window_open_closeup.png",
            )
        ),
        {
            filename: screenshots_by_name.get(filename, {}).get("sha256")
            for filename in (
                "v550_door_closed_closeup.png", "v550_door_open_closeup.png",
                "v550_window_closed_closeup.png", "v550_window_open_closeup.png",
            )
        },
    )

    def camera_semantics_are_valid(item: dict[str, object]) -> bool:
        contract = item.get("captureContract") or {}
        qa_state = item.get("qaState") or {}
        if item.get("cameraPresetId") != contract.get("camera"):
            return False
        if item.get("filename") == "v550_door_closed_closeup.png" or item.get("filename") == "v550_door_open_closeup.png":
            expected_semantics = {"doorLeaf", "openingFrame", "replacementPart", "openingHinge"}
        elif item.get("filename") == "v550_window_closed_closeup.png" or item.get("filename") == "v550_window_open_closeup.png":
            expected_semantics = {"windowLeaf", "openingFrame", "openingSill", "openingHinge"}
        else:
            return True
        camera_evidence = qa_state.get("cameraEvidence") if isinstance(qa_state, dict) else None
        camera_evidence = camera_evidence if isinstance(camera_evidence, dict) else {}
        bounds = camera_evidence.get("bounds") or []
        return (
            expected_semantics.issubset(set(camera_evidence.get("featureSemantics", [])))
            and any(
                "PIVOT" in component_id or "HINGE" in component_id
                for component_id in camera_evidence.get("componentIds", [])
            )
            and len(bounds) == 6
            and all(bounds[index + 3] > bounds[index] for index in range(3))
        )

    check(
        "every screenshot has a complete run-time capture contract",
        len(screenshots) == 16
        and all(
            item.get("filename")
            and item.get("check")
            and item.get("bytes", 0) >= 1_024
            and (
                (item.get("width"), item.get("height")) == (390, 844)
                if item.get("filename") == "v550_mobile_regression.png"
                else (item.get("width"), item.get("height")) == (1440, 1000)
            )
            and item.get("pngPixelEvidence", {}).get("validPng") is True
            and item.get("pngPixelEvidence", {}).get("nonEmpty") is True
            and (
                item.get("filename") == "v550_mobile_regression.png"
                or item.get("captureFrame", {}).get("renderedNewFrame") is True
            )
            and isinstance(item.get("camera"), dict)
            and item.get("cameraPresetId")
            and item.get("cameraFingerprint")
            and item.get("seed") is not None
            and item.get("structuralFingerprint")
            and item.get("surfaceFingerprint")
            and isinstance(item.get("viewport"), dict)
            and camera_semantics_are_valid(item)
            for item in screenshots
        ),
        screenshots,
    )
    not_executed_phases = [phase for phase in planned_phases if phase not in executed_phases]
    check("every planned QA phase executed", not not_executed_phases, not_executed_phases)
    passed = sum(1 for item in results if item["ok"])
    report = {
        "schemaVersion": "5.5.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runSha": run_sha,
        "page": urljoin(base_url or "", "surface-production-lab.html"),
        "expectedSha": args.expected_sha,
        "deploymentReadiness": deployment_readiness,
        "roofTopologyAudit": {
            "expectedSlopeCounts": EXPECTED_SLOPE_COUNTS,
            "expectedTotalSlopes": 14,
            "actualTotalSlopes": len(roof_topology_audit),
            "passed": sum(1 for item in roof_topology_audit if item.get("passed") is True),
            "failed": sum(1 for item in roof_topology_audit if item.get("passed") is not True),
            "slopes": roof_topology_audit,
        },
        "uiControls": ui_control_evidence,
        "abComparison": ab_metadata,
        "visitorPlayback": visitor_playback,
        "visualEvidence": visual_evidence,
        "execution": {
            "plannedPhases": planned_phases,
            "executedPhases": executed_phases,
            "notExecutedPhases": not_executed_phases,
            "uncaughtException": uncaught_exception,
        },
        "viewports": {
            "desktop": {"width": 1440, "height": 1000, "loadSeconds": desktop_load_seconds},
            "mobile": {"width": 390, "height": 844, "loadSeconds": mobile_load_seconds},
        },
        "performance": {
            "desktop": {
                "renderer": (desktop_snapshot or {}).get("renderer"),
                "scene": (desktop_snapshot or {}).get("stats"),
                "fps": (desktop_snapshot or {}).get("fps"),
                "repeatedFps": (desktop_snapshot or {}).get("performanceEvidence"),
                "timings": (desktop_snapshot or {}).get("timings"),
            },
            "mobile": {
                "renderer": (mobile_snapshot or {}).get("renderer"),
                "scene": (mobile_snapshot or {}).get("stats"),
                "fps": (mobile_snapshot or {}).get("fps"),
                "repeatedFps": (mobile_snapshot or {}).get("performanceEvidence"),
                "timings": (mobile_snapshot or {}).get("timings"),
            },
        },
        "screenshots": screenshots,
        "results": results,
        "diagnostics": {
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "failedRequests": failed_requests,
            "httpErrors": http_errors,
            "externalRequests": external_requests,
            "cleanupErrors": cleanup_errors,
        },
        "summary": {"passed": passed, "failed": len(results) - passed, "total": len(results)},
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    print(f"Report: {report_path}")
    return 0 if report["summary"]["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
