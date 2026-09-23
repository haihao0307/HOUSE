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
EXPECTED_TOTAL_SLOPES = sum(EXPECTED_SLOPE_COUNTS.values())
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
EXPECTED_STATIC_WALL_BATCH_LAYERS = {
    "structure", "plaster", "exposedEarth", "stonePlinth", "risingDamp",
    "verticalRainStreak", "surfaceLoss", "repairPatch", "sootAndDirt",
}

PERFORMANCE_BEFORE = {
    "evidenceSource": "Surface-Production-QA-run-32680885207-artifact-9504170550",
    "sourceHead": "814f4538631eeb95b37740c717da755e73c1e910",
    "metricDefinitions": {
        "geometry": "renderer/scene counters captured by legacy Surface artifact after load",
        "loadMs": "legacy artifact page-ready timing; not guaranteed identical to current harness wall-clock load",
        "firstFrameMs": "legacy RAF-start timestamp; excluded the completed first production render cost",
        "fps": "legacy rolling FPS window; not identical to the current independent production-render-serial sample",
    },
    "desktop": {
        "triangles": 715884, "sceneTriangles": 715280, "instances": 12493,
        "drawCalls": 1526, "meshes": 1316, "loadMs": 5385.1,
        "firstFrameMs": 202.9, "fps": 7.128854,
    },
    "mobile": {
        "triangles": 715884, "sceneTriangles": 715280, "instances": 12493,
        "drawCalls": 1526, "meshes": 1316, "loadMs": 55004.2,
        "firstFrameMs": 310.5, "fps": 0.6593696426,
    },
}

PERFORMANCE_COMPARABILITY = {
    "triangles": True,
    "sceneTriangles": True,
    "instances": True,
    "drawCalls": True,
    "meshes": True,
    "loadMs": False,
    "firstFrameMs": False,
    "fps": False,
    "note": "Only like-for-like renderer/scene counters have numeric deltas; timing and FPS retain both real values but use changed measurement definitions.",
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
            "User-Agent": "HOUSE-V5.5.0-Pages-QA/2.0",
        },
    )
    started = time.perf_counter()
    status: int | None = None
    headers: dict[str, str] = {}
    payload = b""
    transport_error: dict[str, str] | None = None
    try:
        with urlopen(
            request,
            timeout=max(0.25, min(PUBLIC_READINESS_REQUEST_TIMEOUT_SECONDS, remaining_seconds)),
        ) as response:
            status = int(response.status)
            headers = {key.lower(): value for key, value in response.headers.items()}
            payload = response.read()
    except HTTPError as exc:
        status = int(exc.code)
        headers = {key.lower(): value for key, value in exc.headers.items()}
        try:
            payload = exc.read()
        except Exception:
            payload = b""
        transport_error = {"type": type(exc).__name__, "message": str(exc)}
    except (URLError, TimeoutError, OSError) as exc:
        transport_error = {"type": type(exc).__name__, "message": str(exc)}

    content_type = headers.get("content-type", "")
    charset = "utf-8"
    if "charset=" in content_type:
        charset = content_type.rsplit("charset=", 1)[-1].split(";", 1)[0].strip() or "utf-8"
    try:
        body = payload.decode(charset)
    except (LookupError, UnicodeDecodeError):
        body = payload.decode("utf-8", errors="replace")
    parsed_json: object | None = None
    parse_error: dict[str, str] | None = None
    if content_kind == "json" and status == 200:
        try:
            parsed_json = json.loads(body)
        except (TypeError, ValueError) as exc:
            parse_error = {"type": type(exc).__name__, "message": str(exc)}
    accepted = bool(
        status == 200
        and payload
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
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest() if payload else None,
        "elapsedMs": round((time.perf_counter() - started) * 1000, 3),
        "transportError": transport_error,
        "parseError": parse_error,
        "json": parsed_json,
        "bodyPreview": body[:512],
    }


def poll_public_deployment(
    base_url: str, expected_sha: str | None, expected_ref: str | None,
) -> dict[str, object]:
    """Wait until all public inputs expose one coherent commit before browser QA."""
    started = time.perf_counter()
    report: dict[str, object] = {
        "required": True,
        "startedAt": _utc_now(),
        "baseUrl": base_url,
        "expectedSha": expected_sha,
        "expectedRef": expected_ref,
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
            "configurationError": "--expected-sha is required with --base-url",
        })
        return report

    attempt_number = 0
    while True:
        attempt_number += 1
        resources: dict[str, dict[str, object]] = {}
        for resource_name, relative_path, content_kind in PUBLIC_READINESS_RESOURCES:
            remaining = max(0.25, PUBLIC_READINESS_TIMEOUT_SECONDS - (time.perf_counter() - started))
            resources[resource_name] = _readiness_request(
                urljoin(base_url, relative_path), content_kind, attempt_number, remaining,
            )
        build_json = resources["build"].get("json")
        observed_sha = build_json.get("sha") if isinstance(build_json, dict) else None
        observed_ref = build_json.get("ref") if isinstance(build_json, dict) else None
        ready = bool(
            all(resource.get("accepted") is True for resource in resources.values())
            and observed_sha == expected_sha
            and (not expected_ref or observed_ref == expected_ref)
        )
        attempt = {
            "attempt": attempt_number,
            "observedSha": observed_sha,
            "observedRef": observed_ref,
            "shaMatches": observed_sha == expected_sha,
            "refMatches": not expected_ref or observed_ref == expected_ref,
            "ready": ready,
            "resources": resources,
        }
        report["attempts"].append(attempt)
        report["finalResources"] = resources
        if ready:
            report.update({
                "ready": True,
                "attemptCount": attempt_number,
                "observedSha": observed_sha,
                "observedRef": observed_ref,
                "finishedAt": _utc_now(),
                "elapsedMs": round((time.perf_counter() - started) * 1000, 3),
            })
            return report
        elapsed = time.perf_counter() - started
        if elapsed >= PUBLIC_READINESS_TIMEOUT_SECONDS:
            report.update({
                "attemptCount": attempt_number,
                "observedSha": observed_sha,
                "observedRef": observed_ref,
                "finishedAt": _utc_now(),
                "elapsedMs": round(elapsed * 1000, 3),
                "timeoutError": (
                    "public deployment did not expose build.json, Surface Lab and seed "
                    "as HTTP 200 with the expected SHA/ref before timeout"
                ),
            })
            return report
        time.sleep(min(PUBLIC_READINESS_POLL_SECONDS, PUBLIC_READINESS_TIMEOUT_SECONDS - elapsed))


def _paeth_predictor(left: int, above: int, upper_left: int) -> int:
    estimate = left + above - upper_left
    distances = (
        (abs(estimate - left), left),
        (abs(estimate - above), above),
        (abs(estimate - upper_left), upper_left),
    )
    return min(distances, key=lambda item: item[0])[1]


def png_pixel_evidence(payload: bytes) -> dict[str, object]:
    """Decode an 8-bit browser PNG and prove it contains visible pixel variation."""
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
                palette = [
                    tuple(chunk_data[index:index + 3])
                    for index in range(0, len(chunk_data), 3)
                ]
            elif chunk_type == b"tRNS":
                palette_alpha = chunk_data
            elif chunk_type == b"IDAT":
                compressed_parts.append(chunk_data)
            elif chunk_type == b"IEND":
                break

        if not width or not height or bit_depth != 8 or interlace != 0:
            raise ValueError(
                f"unsupported PNG header width={width} height={height} "
                f"bitDepth={bit_depth} interlace={interlace}"
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
def playwright_session(factory: object, cleanup_errors: list[str], browser_holder: dict[str, object]):
    """Keep Playwright shutdown failures from replacing the first QA failure."""
    playwright = factory().start()
    try:
        yield playwright
    finally:
        active_browser = browser_holder.get("browser")
        if active_browser is not None:
            try:
                active_browser.close()
            except Exception as exc:
                cleanup_errors.append(f"browser.close: {type(exc).__name__}: {exc}")
            finally:
                browser_holder["browser"] = None
        try:
            playwright.stop()
        except Exception as exc:
            cleanup_errors.append(f"playwright.stop: {type(exc).__name__}: {exc}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="V5.5.0 surface-production browser QA")
    parser.add_argument("--base-url", help="Public Pages root. Defaults to a local ephemeral server.")
    parser.add_argument("--expected-sha", help="Require build.json to expose this deployed commit.")
    parser.add_argument("--run-sha", default=os.environ.get("GITHUB_SHA"), help="Commit under test (recorded in the report).")
    parser.add_argument("--run-ref", default=os.environ.get("GITHUB_REF_NAME"), help="Branch/ref under test (recorded as sourceRef).")
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
    source_ref = args.run_ref
    if not source_ref:
        resolved = subprocess.run(
            ["git", "branch", "--show-current"], cwd=ROOT, check=False,
            capture_output=True, text=True,
        )
        if resolved.returncode == 0:
            source_ref = resolved.stdout.strip() or None

    results: list[dict[str, object]] = []
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []
    http_errors: list[dict[str, object]] = []
    external_requests: list[str] = []
    cleanup_errors: list[str] = []
    server: ThreadingHTTPServer | None = None
    base_url = args.base_url
    public_mode = bool(args.base_url)
    browser = None
    browser_holder: dict[str, object] = {"browser": None}
    desktop_visual_default_snapshot: dict[str, object] | None = None
    desktop_snapshot: dict[str, object] | None = None
    mobile_snapshot: dict[str, object] | None = None
    desktop_visual_load_seconds: float | None = None
    desktop_load_seconds: float | None = None
    mobile_load_seconds: float | None = None
    ab_metadata: dict[str, object] | None = None
    visitor_playback: dict[str, object] | None = None
    uncaught_exception: dict[str, object] | None = None
    visual_evidence: dict[str, object] = {}
    build_json: dict[str, object] | None = None
    deployment_readiness: dict[str, object] = {
        "required": public_mode,
        "ready": not public_mode,
        "reason": "local-server-mode" if not public_mode else None,
    }
    desktop_fps_sample: dict[str, object] | None = None
    mobile_fps_sample: dict[str, object] | None = None
    mobile_visibility: dict[str, object] | None = None
    mobile_framebuffer_evidence: dict[str, object] | None = None
    desktop_performance_process_isolation: dict[str, object] | None = None
    desktop_visual_comparison: dict[str, object] | None = None
    mobile_layout_process_isolation: dict[str, object] | None = None
    mobile_performance_process_isolation: dict[str, object] | None = None
    desktop_performance_attempt_count = 0
    desktop_performance_completed = False
    mobile_performance_attempt_count = 0
    mobile_layout_completed = False
    mobile_performance_completed = False
    operated_controls: list[dict[str, object]] = []
    roof_topology_audit: dict[str, object] = {
        "expectedSlopeCounts": EXPECTED_SLOPE_COUNTS,
        "expectedTotalSlopes": EXPECTED_TOTAL_SLOPES,
        "actualSlopeCounts": {},
        "actualTotalSlopes": 0,
    }
    planned_phases = [
        "load", "ab-comparison", "roof-wall", "interactions", "visitor-playback",
        "screenshots", "desktop-performance", "mobile",
    ]
    executed_phases: list[str] = []

    def check(name: str, condition: object, detail: object = None) -> None:
        results.append({"name": name, "ok": bool(condition), "detail": detail})

    def visual_state(
        page: object, view_name: str = "production",
        supplied_render_evidence: dict[str, object] | None = None,
    ) -> dict[str, object]:
        """Record the live state that produced a screenshot, not a later summary."""
        return page.evaluate(
            """async ({viewName, suppliedRenderEvidence}) => {
              const renderEvidence = suppliedRenderEvidence
                || await window.__SURFACE_QA__.waitForNextProductionRender();
              const snapshot = window.__SURFACE_QA__.inspect(viewName);
              return {
                view: viewName,
                version: snapshot.version,
                profileId: snapshot.profileId,
                seed: snapshot.comparisonContract?.structuralSeed ?? null,
                camera: snapshot.camera,
                cameraPresetId: snapshot.cameraPresetId,
                cameraFingerprint: snapshot.cameraFingerprint,
                cameraFingerprintContract: snapshot.cameraFingerprintContract,
                cameraEvidence: snapshot.cameraEvidence,
                qaDisplayState: snapshot.qaDisplayState,
                renderQuality: snapshot.renderQuality,
                canvasFingerprint: snapshot.canvasFingerprint,
                lightFingerprint: snapshot.lightFingerprint,
                lightFingerprintContract: snapshot.lightFingerprintContract,
                lightEvidence: snapshot.lightEvidence,
                structuralFingerprint: snapshot.structuralFingerprint,
                actualStructureManifestFingerprint: snapshot.actualStructureManifestFingerprint,
                actualStructureManifestEvidence: snapshot.actualStructureManifestEvidence,
                surfaceFingerprint: snapshot.surfaceFingerprint,
                fullGeometryFingerprint: snapshot.fullGeometryFingerprint,
                completeBuilding: snapshot.completeBuilding,
                cutaway: snapshot.cutaway,
                roofExploded: snapshot.runtimeState?.roofExploded ?? false,
                openingProgress: snapshot.runtimeState?.openingProgress ?? null,
                visitorProgress: snapshot.runtimeState?.visitorProgress ?? null,
                renderer: snapshot.renderer,
                openings: snapshot.openings,
                runtimeState: snapshot.runtimeState,
                renderEvidence,
                viewport: {width: window.innerWidth, height: window.innerHeight},
              };
            }""",
            {"viewName": view_name, "suppliedRenderEvidence": supplied_render_evidence},
        )

    def callouts_visible(camera_evidence: dict[str, object]) -> bool:
        targets = (camera_evidence.get("callouts") or {}).get("targets") or []
        return bool(targets) and all(
            target.get("visible") is True
            and target.get("firstHitMatchesFeature") is True
            and target.get("firstHitSelectedRenderableMembershipMatches") is True
            and target.get("allowedSelectedRenderableCount", 0) > 0
            and str(target.get("allowedSelectedRenderableFingerprint", "")).startswith("fnv1a32:")
            and target.get("selectedRenderableContract")
            == "exact-object-and-instance-membership-derived-from-live-target-bounds"
            and target.get("viewportIntersectionAreaPx", 0) >= 16
            and len(target.get("projectedNdc") or []) == 3
            and all(-1 <= value <= 1 for value in target.get("projectedNdc") or [])
            and target.get("evidenceSource")
            == "live-camera-selected-renderable-instance-membership-and-first-visible-raycast-hit"
            for target in targets
        )

    def compiled_material_ok(material: dict[str, object], expected_mode: str) -> bool:
        compiled = material.get("compiledShaderEvidence") or {}
        revision = "v550-r5-sine-free-hash-two-octave-fbm-mode-key-and-instance-world-position"
        expected_key = f"{revision}:{expected_mode}"
        mode_branch_ok = compiled.get("fragmentHasExpectedModeBranch") is True
        opening_branch_ok = expected_mode != "openingTimber" or (
            compiled.get("fragmentHasOpeningGrainGroove") is True
            and compiled.get("fragmentHasOpeningRunoffColumn") is True
        )
        tile_branch_ok = expected_mode != "tile" or compiled.get("fragmentHasTileBranch") is True
        return bool(
            material.get("shaderRevision") == revision
            and material.get("programCacheKey") == expected_key
            and material.get("runtimeProgramCacheKey") == expected_key
            and compiled.get("revision") == revision
            and compiled.get("mode") == expected_mode
            and compiled.get("programCacheKey") == expected_key
            and mode_branch_ok
            and opening_branch_ok
            and tile_branch_ok
            and compiled.get("fragmentUsesSineFreeHash") is True
            and compiled.get("fragmentFbmOctaveCount") == 2
            and compiled.get("vertexHasInstanceWorldTransform") is True
            and compiled.get("evidenceSource") == "actual-onBeforeCompile-transformed-shader-source"
        )

    def feature_pixels_ok(
        evidence: dict[str, object], feature_id: str, minimum_luminance_std: float = 4.0,
        minimum_unique_colors: int = 40,
    ) -> bool:
        return bool(
            evidence.get("featureId") == feature_id
            and evidence.get("source")
            == "webgl-readPixels-centered-on-live-first-hit-projected-feature-without-DOM-callout-overlay"
            and evidence.get("firstHitClassification") == feature_id
            and evidence.get("renderFrameId", 0) > 0
            and evidence.get("sampleCount", 0) >= 1024
            and evidence.get("luminanceStandardDeviation", 0) >= minimum_luminance_std
            and evidence.get("uniqueRgbColorCount", 0) >= minimum_unique_colors
            and len(evidence.get("standardDeviationRgb") or []) == 3
            and min(evidence.get("standardDeviationRgb") or [0]) >= 2.0
        )

    try:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            check("Playwright installed", False, str(exc))
            raise RuntimeError("Playwright is required; run python -m pip install -r requirements-dev.txt") from exc

        if not base_url:
            server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
            threading.Thread(target=server.serve_forever, daemon=True).start()
            base_url = f"http://127.0.0.1:{server.server_port}/"
        if not base_url.endswith("/"):
            base_url += "/"
        if public_mode:
            deployment_readiness = poll_public_deployment(
                base_url, args.expected_sha, source_ref,
            )
            check(
                "public deployment exposes build, Surface Lab and seed for exact SHA/ref",
                deployment_readiness.get("ready") is True,
                deployment_readiness,
            )
            if deployment_readiness.get("ready") is not True:
                raise RuntimeError("Public deployment readiness gate did not converge")
            readiness_build = (deployment_readiness.get("finalResources") or {}).get("build", {}).get("json")
            if isinstance(readiness_build, dict):
                build_json = readiness_build
        cache_token = f"{run_sha or 'unversioned'}-{time.time_ns()}"
        page_url = f"{urljoin(base_url, 'surface-production-lab.html')}?qa={cache_token}"
        allowed_origin = urlparse(base_url).netloc

        with playwright_session(sync_playwright, cleanup_errors, browser_holder) as playwright:
            launch_options: dict[str, object] = {
                "headless": True,
                "args": [
                    "--use-angle=swiftshader",
                    "--enable-unsafe-swiftshader",
                    "--enable-webgl",
                    "--ignore-gpu-blocklist",
                    "--no-sandbox",
                ],
            }
            chromium_executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
            if chromium_executable:
                launch_options["executable_path"] = chromium_executable
            browser = playwright.chromium.launch(**launch_options)
            browser_holder["browser"] = browser
            context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
            page = context.new_page()
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url}: {request.failure}"))

            def capture_response(response: object, phase: str = "desktop") -> None:
                status = response.status
                request_url = response.url
                if status >= 400:
                    http_errors.append({"status": status, "url": request_url, "phase": phase})
                if urlparse(request_url).netloc != allowed_origin:
                    external_requests.append(f"{phase}: {request_url}")

            page.on("response", capture_response)

            def bind_page_diagnostics(target_page: object, phase: str) -> None:
                target_page.on("pageerror", lambda exc: page_errors.append(f"{phase}: {exc}"))
                target_page.on(
                    "console",
                    lambda msg: console_errors.append(f"{phase}: {msg.text}")
                    if msg.type == "error" else None,
                )
                target_page.on(
                    "requestfailed",
                    lambda request: failed_requests.append(
                        f"{phase}: {request.method} {request.url}: {request.failure}"
                    ),
                )
                target_page.on("response", lambda response: capture_response(response, phase))

            def click_control(selector: str, check_id: str) -> None:
                locator = page.locator(selector)
                locator.wait_for(state="visible", timeout=30_000)
                locator.click(timeout=30_000)
                operated_controls.append({"control": selector, "check": check_id, "method": "visible-click"})

            def select_control(value: str, check_id: str) -> None:
                locator = page.locator("#preset")
                locator.wait_for(state="visible", timeout=30_000)
                locator.select_option(value=value, timeout=30_000)
                operated_controls.append({"control": "#preset", "value": value, "check": check_id, "method": "visible-select"})

            if args.expected_sha:
                build_url = f"{urljoin(base_url, 'build.json')}?qa={cache_token}"
                response = context.request.get(
                    build_url,
                    headers={"Cache-Control": "no-cache, no-store", "Pragma": "no-cache"},
                    timeout=60_000,
                )
                if response.status >= 400:
                    http_errors.append({"status": response.status, "url": build_url, "phase": "preload-build-json"})
                try:
                    build_json = response.json() if response.ok else None
                except Exception:
                    build_json = None
                build_matches = bool(
                    response.ok
                    and build_json
                    and build_json.get("sha") == args.expected_sha
                    and (not source_ref or build_json.get("ref") == source_ref)
                )
                check(
                    "Pages build.json exact SHA and ref before page load",
                    build_matches,
                    {"url": build_url, "status": response.status, "buildJson": build_json,
                     "expectedSha": args.expected_sha, "expectedRef": source_ref},
                )
                if not build_matches:
                    raise RuntimeError("Public build.json does not identify the requested head SHA/ref")

            started = time.perf_counter()
            page.goto(page_url, wait_until="load", timeout=180_000)
            page.wait_for_function("window.__SURFACE_QA__?.ready === true", timeout=180_000)
            desktop_visual_load_seconds = time.perf_counter() - started
            load_seconds = desktop_visual_load_seconds
            page.wait_for_timeout(2200)
            executed_phases.append("load")

            click_control("[data-camera='ab']", "ab-same-camera")
            page.wait_for_timeout(150)
            baseline = page.evaluate("window.__SURFACE_QA__.inspect('baseline')")
            production = page.evaluate("window.__SURFACE_QA__.inspect('production')")
            baseline_structure_manifest = page.evaluate(
                "window.__SURFACE_QA__.actualStructureManifest('baseline', true)"
            )
            production_structure_manifest = page.evaluate(
                "window.__SURFACE_QA__.actualStructureManifest('production', true)"
            )
            ab_metadata = {
                "seed": production.get("comparisonContract", {}).get("structuralSeed"),
                "baselineVersion": baseline.get("version"),
                "productionVersion": production.get("version"),
                "cameraFingerprint": production.get("cameraFingerprint"),
                "baselineCameraFingerprint": baseline.get("cameraFingerprint"),
                "productionCameraFingerprint": production.get("cameraFingerprint"),
                "camera": production.get("camera"),
                "cameraFingerprintContract": production.get("cameraFingerprintContract"),
                "canvasFingerprint": production.get("canvasFingerprint"),
                "baselineCanvasFingerprint": baseline.get("canvasFingerprint"),
                "productionCanvasFingerprint": production.get("canvasFingerprint"),
                "lightFingerprint": production.get("lightFingerprint"),
                "baselineLightFingerprint": baseline.get("lightFingerprint"),
                "productionLightFingerprint": production.get("lightFingerprint"),
                "lightEvidence": production.get("lightEvidence"),
                "lightFingerprintContract": production.get("lightFingerprintContract"),
                "viewport": {"width": 1440, "height": 1000},
                "composition": {
                    "cameraPresetId": production.get("cameraPresetId"),
                    "cameraEvidence": production.get("cameraEvidence"),
                    "canvasFingerprint": production.get("canvasFingerprint"),
                },
                "baselineStructuralFingerprint": baseline.get("structuralFingerprint"),
                "productionStructuralFingerprint": production.get("structuralFingerprint"),
                "baselineActualStructureManifestFingerprint": baseline_structure_manifest.get("manifestFingerprint"),
                "productionActualStructureManifestFingerprint": production_structure_manifest.get("manifestFingerprint"),
                "baselineActualStructureManifestEvidence": baseline.get("actualStructureManifestEvidence"),
                "productionActualStructureManifestEvidence": production.get("actualStructureManifestEvidence"),
                "actualStructureManifestContract": production_structure_manifest.get("contract"),
                "actualStructureRenderableRecordCount": production_structure_manifest.get("renderableInstanceCount"),
                "baselineSurfaceFingerprint": baseline.get("surfaceFingerprint"),
                "productionSurfaceFingerprint": production.get("surfaceFingerprint"),
                "baselineMaterialRuntimeContract": baseline.get("materialRuntimeContract"),
                "productionMaterialRuntimeContract": production.get("materialRuntimeContract"),
                "baselineMaterialShaderPrograms": baseline.get("materialShaderPrograms"),
                "productionMaterialShaderPrograms": production.get("materialShaderPrograms"),
                "baselineFullGeometryFingerprint": baseline.get("fullGeometryFingerprint"),
                "productionFullGeometryFingerprint": production.get("fullGeometryFingerprint"),
                "fingerprintContract": production.get("fingerprintContract"),
            }
            executed_phases.append("ab-comparison")
            check("runtime versions", baseline.get("version") == "5.4.4" and production.get("version") == "5.5.0", {"baseline": baseline.get("version"), "production": production.get("version")})
            check(
                "live structural fingerprint covers actual position and index buffers",
                production.get("evidenceContract") == "live-geometry-v2-position-index"
                and "full-position-index" in (production.get("fingerprintContract", {}).get("structure") or "")
                and "excludes material, color" in (production.get("fingerprintContract", {}).get("structure") or ""),
                {"evidenceContract": production.get("evidenceContract"), "fingerprintContract": production.get("fingerprintContract")},
            )
            check("complete A/B buildings", baseline.get("completeBuilding") and production.get("completeBuilding"))
            runtime_optimization = production.get("runtimeOptimization") or {}
            check(
                "static Mesh local matrices are frozen while interactive parent groups remain live",
                runtime_optimization.get("productionPath") is True
                and runtime_optimization.get("strategy")
                == "freeze-static-mesh-local-matrices-keep-interactive-parent-groups-live"
                and runtime_optimization.get("frozenMeshCount", 0) > 0
                and set(runtime_optimization.get("dynamicParentContracts") or [])
                == {"opening-hinge-pivots", "visitor-route-actor", "roof-layer-explosion-groups"},
                runtime_optimization,
            )
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
            check(
                "A/B deep-equal canonical actual structure records and explicit manifest",
                baseline_structure_manifest.get("contract")
                == "canonical-live-structural-renderables-plus-explicit-building-roof-wall-opening-stair-manifest-v3-root-display-name-normalized"
                and baseline_structure_manifest.get("contract") == production_structure_manifest.get("contract")
                and baseline_structure_manifest.get("normalizedRootIdentity") == {
                    "name": "YunnanCourtyard_ComparisonStructure",
                    "excludedNonStructuralField": "version-facing root.name display label only",
                    "descendantNamesAndStructuralIdentityRetained": True,
                    "materialSurfaceAndVersionProfileExcluded": True,
                }
                and baseline_structure_manifest.get("normalizedRootIdentity")
                == production_structure_manifest.get("normalizedRootIdentity")
                and baseline_structure_manifest.get("manifest") == production_structure_manifest.get("manifest")
                and baseline_structure_manifest.get("records") == production_structure_manifest.get("records")
                and baseline_structure_manifest.get("recordFingerprint")
                == production_structure_manifest.get("recordFingerprint")
                and baseline_structure_manifest.get("manifestFingerprint")
                == production_structure_manifest.get("manifestFingerprint")
                and baseline.get("actualStructureManifestFingerprint")
                == baseline_structure_manifest.get("manifestFingerprint")
                and production.get("actualStructureManifestFingerprint")
                == production_structure_manifest.get("manifestFingerprint")
                and baseline.get("structuralRenderableFingerprint")
                and production.get("structuralRenderableFingerprint"),
                {
                    "baseline": {
                        "recordCount": baseline_structure_manifest.get("renderableInstanceCount"),
                        "recordFingerprint": baseline_structure_manifest.get("recordFingerprint"),
                        "manifestFingerprint": baseline_structure_manifest.get("manifestFingerprint"),
                    },
                    "production": {
                        "recordCount": production_structure_manifest.get("renderableInstanceCount"),
                        "recordFingerprint": production_structure_manifest.get("recordFingerprint"),
                        "manifestFingerprint": production_structure_manifest.get("manifestFingerprint"),
                    },
                },
            )
            structure_manifest = production_structure_manifest.get("manifest") or {}
            building_manifest = structure_manifest.get("buildingUnits") or {}
            roof_manifest = structure_manifest.get("roofUnits") or {}
            wall_manifest = structure_manifest.get("walls") or {}
            opening_manifest = structure_manifest.get("openings") or {}
            stair_manifest = structure_manifest.get("stairs") or {}
            roof_manifest_units = roof_manifest.get("units") or []
            check(
                "actual manifest explicitly identifies all building and roof sections with live structural layers",
                building_manifest.get("count") == 7
                and len(building_manifest.get("units") or []) == 7
                and all(
                    unit.get("buildingUnitId")
                    and unit.get("roofUnitCount", 0) > 0
                    and len(unit.get("roofUnitIds") or []) == unit.get("roofUnitCount")
                    and len(unit.get("structuralWorldBounds") or []) == 6
                    for unit in building_manifest.get("units") or []
                )
                and roof_manifest.get("count") == 7
                and set(roof_manifest.get("structuralLayerIds") or [])
                == {"purlins", "rafters", "roofUnderlay"}
                and {unit.get("roofUnitId") for unit in roof_manifest_units} == EXPECTED_ROOFS
                and all(
                    unit.get("buildingUnitId")
                    and unit.get("sectionCount", 0) == len(unit.get("sections") or [])
                    and unit.get("sectionCount", 0) > 0
                    and len(unit.get("structuralWorldBounds") or []) == 6
                    and unit.get("ancestorIdentityVisibility", {}).get("visibleInTree") is True
                    and unit.get("ancestorIdentityVisibility", {}).get("chain")
                    and all(
                        section.get("sectionId")
                        and section.get("roofUnitId") == unit.get("roofUnitId")
                        and section.get("structuralRenderableCount", 0) > 0
                        and len(section.get("structuralWorldBounds") or []) == 6
                        and section.get("ancestorIdentityVisibility", {}).get("visibleInTree") is True
                        and all(
                            section.get("structuralLayers", {}).get(layer_id, {}).get("actualRenderableCount", 0) > 0
                            and len(section.get("structuralLayers", {}).get(layer_id, {}).get("worldBounds") or []) == 6
                            for layer_id in {"purlins", "rafters", "roofUnderlay"}
                        )
                        for section in unit.get("sections") or []
                    )
                    for unit in roof_manifest_units
                ),
                {"buildingUnits": building_manifest, "roofUnits": roof_manifest},
            )
            wall_manifest_hosts = wall_manifest.get("hosts") or []
            check(
                "actual manifest exposes wall hosts, opening IDs, dimensions and bounds",
                wall_manifest.get("hostCount", 0) == len(wall_manifest_hosts)
                and wall_manifest.get("hostCount", 0) > 5
                and all(
                    host.get("componentId")
                    and host.get("hostId")
                    and "openingIds" in host
                    and host.get("dimensionsM") is not None
                    and host.get("actualElementCount", 0) > 0
                    and len(host.get("worldBounds") or []) == 6
                    and str(host.get("geometryFingerprint", "")).startswith("fnv1a32:")
                    and host.get("ancestorIdentityVisibility", {}).get("visibleInTree") is True
                    and host.get("ancestorIdentityVisibility", {}).get("chain")
                    for host in wall_manifest_hosts
                )
                and wall_manifest.get("openingHostCount", 0)
                == len(wall_manifest.get("openingHosts") or [])
                and all(
                    host.get("componentId") and host.get("openingIds")
                    and host.get("descendantWallComponentIds")
                    and len(host.get("worldBounds") or []) == 6
                    for host in wall_manifest.get("openingHosts") or []
                ),
                wall_manifest,
            )
            opening_manifest_assemblies = opening_manifest.get("assemblies") or []
            check(
                "actual manifest exposes every opening aperture, pivot, frame and leaf",
                opening_manifest.get("count") == 5
                and len(opening_manifest_assemblies) == 5
                and {item.get("kind") for item in opening_manifest_assemblies} == {"door", "window"}
                and all(
                    item.get("componentId") and item.get("hostId")
                    and item.get("apertureM", {}).get("width", 0) > 0
                    and item.get("apertureM", {}).get("height", 0) > 0
                    and item.get("pivots") and item.get("frames") and item.get("leaves")
                    and len(item.get("worldBounds") or []) == 6
                    and len(item.get("worldMatrix") or []) == 16
                    and item.get("ancestorIdentityVisibility", {}).get("visibleInTree") is True
                    and all(
                        pivot.get("componentId") and len(pivot.get("worldMatrix") or []) == 16
                        and len(pivot.get("worldBounds") or []) == 6
                        and pivot.get("ancestorIdentityVisibility", {}).get("visibleInTree") is True
                        for pivot in item.get("pivots") or []
                    )
                    and all(
                        component.get("componentId")
                        and len(component.get("worldBounds") or []) == 6
                        and str(component.get("geometryFingerprint", "")).startswith("fnv1a32:")
                        for component in (item.get("frames") or []) + (item.get("leaves") or [])
                    )
                    for item in opening_manifest_assemblies
                ),
                opening_manifest,
            )
            stair_manifest_assemblies = stair_manifest.get("assemblies") or []
            expected_flight_ids = {
                flight: [f"STAIR-WEST-01-F{flight}-T{step:02d}" for step in range(1, 9)]
                for flight in (1, 2)
            }
            check(
                "actual manifest exposes exact 8+8 steps, three landings, supports and upper exit",
                stair_manifest.get("count") == 1
                and len(stair_manifest_assemblies) == 1
                and stair_manifest_assemblies[0].get("componentId") == "STAIR-WEST-01"
                and stair_manifest_assemblies[0].get("flightCount") == 2
                and all(
                    flight.get("actualStepCount") == 8
                    and flight.get("exactStepIds") == expected_flight_ids.get(flight.get("flight"))
                    and all(
                        step.get("supportId") == step.get("componentId")
                        and len(step.get("worldBounds") or []) == 6
                        and step.get("ancestorIdentityVisibility", {}).get("visibleInTree") is True
                        for step in flight.get("steps") or []
                    )
                    for flight in stair_manifest_assemblies[0].get("flights") or []
                )
                and stair_manifest_assemblies[0].get("landingCount") == 3
                and {item.get("componentId") for item in stair_manifest_assemblies[0].get("landings") or []}
                == {"STAIR-WEST-01-LOWER", "STAIR-WEST-01-MIDDLE", "STAIR-WEST-01-UPPER"}
                and stair_manifest_assemblies[0].get("supportCount", 0) >= 8
                and {item.get("componentId") for item in stair_manifest_assemblies[0].get("upperExit") or []}
                == {"STAIR-WEST-01-UPPER-TURN", "STAIR-WEST-01-UPPER-CONNECTOR"}
                and stair_manifest_assemblies[0].get("routeAnchors")
                and stair_manifest_assemblies[0].get("ancestorIdentityVisibility", {}).get("visibleInTree") is True,
                stair_manifest,
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
            required_camera_fields = {
                "position", "target", "quaternion", "up", "zoom", "aspect", "near", "far", "fov",
                "projectionType", "projectionMatrix", "matrixWorld", "matrixWorldInverse",
            }
            check(
                "same complete actual camera transform and projection fingerprint",
                baseline.get("cameraFingerprint") == production.get("cameraFingerprint")
                and baseline.get("camera") == production.get("camera")
                and baseline.get("cameraFingerprintContract")
                == "actual-position-target-quaternion-up-zoom-aspect-near-far-fov-projection-matrixWorld-matrixWorldInverse-v2"
                and baseline.get("cameraFingerprintContract") == production.get("cameraFingerprintContract")
                and required_camera_fields.issubset(set(production.get("camera") or {}))
                and len(production.get("camera", {}).get("position") or []) == 3
                and len(production.get("camera", {}).get("target") or []) == 3
                and len(production.get("camera", {}).get("quaternion") or []) == 4
                and len(production.get("camera", {}).get("up") or []) == 3
                and len(production.get("camera", {}).get("projectionMatrix") or []) == 16
                and len(production.get("camera", {}).get("matrixWorld") or []) == 16
                and len(production.get("camera", {}).get("matrixWorldInverse") or []) == 16
                and str(production.get("cameraFingerprint", "")).startswith("fnv1a32:"),
                {"baseline": baseline.get("camera"), "production": production.get("camera")},
            )
            check("same canvas fingerprint", baseline.get("canvasFingerprint") == production.get("canvasFingerprint"))
            light_evidence = production.get("lightEvidence") or {}
            directional_lights = [
                light for light in light_evidence.get("lights") or []
                if light.get("type") == "DirectionalLight"
            ]
            check(
                "same complete lights, target transforms and render output contract",
                baseline.get("lightFingerprint") == production.get("lightFingerprint")
                and baseline.get("lightEvidence") == production.get("lightEvidence")
                and baseline.get("lightFingerprintContract") == "live-light-and-render-output-transform-v2"
                and baseline.get("lightFingerprintContract") == production.get("lightFingerprintContract")
                and str(production.get("lightFingerprint", "")).startswith("fnv1a32:")
                and light_evidence.get("background")
                and len(light_evidence.get("lights") or []) >= 2
                and len(directional_lights) == 1
                and len(directional_lights[0].get("matrixWorld") or []) == 16
                and len((directional_lights[0].get("target") or {}).get("worldPosition") or []) == 3
                and len((directional_lights[0].get("target") or {}).get("worldQuaternion") or []) == 4
                and len((directional_lights[0].get("target") or {}).get("matrixWorld") or []) == 16
                and light_evidence.get("renderer", {}).get("toneMapping") is not None
                and light_evidence.get("renderer", {}).get("toneMappingExposure", 0) > 0
                and light_evidence.get("renderer", {}).get("outputColorSpace")
                and light_evidence.get("renderer", {}).get("shadowEnabled") is False,
                {"baseline": baseline.get("lightEvidence"), "production": light_evidence},
            )
            check(
                "both A/B surface fingerprints are real and different",
                str(baseline.get("surfaceFingerprint", "")).startswith("fnv1a32:")
                and str(production.get("surfaceFingerprint", "")).startswith("fnv1a32:")
                and baseline.get("surfaceFingerprint") != production.get("surfaceFingerprint"),
                {"baseline": baseline.get("surfaceFingerprint"),
                 "production": production.get("surfaceFingerprint")},
            )
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
            baseline_material_runtime = baseline.get("materialRuntimeContract") or {}
            production_material_runtime = production.get("materialRuntimeContract") or {}
            baseline_material_modes = (baseline.get("materialShaderPrograms") or {}).get("modes") or {}
            frozen_material_modes = [baseline_material_modes.get(mode_id) or {} for mode_id in ("wall", "timber", "tile")]
            check(
                "A/B displays one shared structure with executed V5.4.4 and V5.5.0 material runtimes",
                comparison_contract.get("displayedBaselineRuntime")
                == "shared-current-structure-with-executed-frozen-v544-material-factory"
                and comparison_contract.get("frozenRuntimeRole")
                == "displayed-material-runtime-and-independent-full-generator-provenance"
                and comparison_contract.get("baselineMaterialFactory")
                == "threejs/v544/YunnanMaterialFactory.js"
                and comparison_contract.get("productionMaterialFactory")
                == "threejs/YunnanMaterialFactory.js"
                and baseline_material_runtime.get("runtimeVersion") == "5.4.4"
                and baseline_material_runtime.get("implementation")
                == "executed-frozen-material-factory-on-shared-current-structure"
                and baseline_material_runtime.get("factoryModule")
                == "threejs/v544/YunnanMaterialFactory.js"
                and baseline_material_runtime.get("sourceCommit")
                == "323a893a791b1d064a1591dcbd2063f2f6a172c1"
                and production_material_runtime.get("runtimeVersion") == "5.5.0"
                and production_material_runtime.get("factoryModule")
                == "threejs/YunnanMaterialFactory.js"
                and all(
                    mode.get("runtimeBranches") == ["5.4.4-frozen-material-factory"]
                    and mode.get("runtimeSources") == ["threejs/v544/YunnanMaterialFactory.js"]
                    and mode.get("frozenV544CompiledMaterialCount", 0) > 0
                    and all(
                        evidence.get("fragmentUsesLegacySineHash") is True
                        and evidence.get("fragmentUsesFourOctaveFbm") is True
                        and evidence.get("fragmentUsesCurrentSineFreeHash") is False
                        and evidence.get("evidenceSource")
                        == "actual-onBeforeCompile-populated-live-shader-source"
                        for evidence in mode.get("frozenV544CompiledEvidence") or []
                    )
                    for mode in frozen_material_modes
                )
                and baseline.get("displayedRuntimeFingerprint") != frozen_runtime.get("surfaceFingerprint"),
                {
                    "comparisonContract": comparison_contract,
                    "baselineMaterialRuntime": baseline_material_runtime,
                    "productionMaterialRuntime": production_material_runtime,
                    "baselineMaterialModes": baseline_material_modes,
                    "displayed": baseline.get("displayedRuntimeFingerprint"),
                    "independentFrozenGenerator": frozen_runtime.get("surfaceFingerprint"),
                },
            )

            roofs = production.get("roofUnits", [])
            roof_ids = {roof.get("roofUnitId") for roof in roofs}
            check("seven exact roof unit IDs", roof_ids == EXPECTED_ROOFS, sorted(roof_ids))
            check("roof registry complete", production.get("roofSystem", {}).get("complete") is True, production.get("roofSystem"))
            roof_diagnostics = production.get("roofGeometryDiagnostics") or {}
            diagnostic_units = roof_diagnostics.get("units") or []
            diagnostic_slopes = [slope for unit in diagnostic_units for slope in unit.get("slopeAudits", [])]
            diagnostic_slope_counts = {
                unit.get("roofUnitId"): len(unit.get("slopeAudits") or [])
                for unit in diagnostic_units
            }
            roof_slope_counts = {
                roof.get("roofUnitId"): len(roof.get("slopes") or []) for roof in roofs
            }
            roof_topology_audit = {
                "expectedSlopeCounts": EXPECTED_SLOPE_COUNTS,
                "expectedTotalSlopes": EXPECTED_TOTAL_SLOPES,
                "actualSlopeCounts": roof_slope_counts,
                "diagnosticSlopeCounts": diagnostic_slope_counts,
                "actualTotalSlopes": len(diagnostic_slopes),
                "roofSystemExpectedSlopeCounts": roof_diagnostics.get("expectedSlopeCounts"),
                "roofSystemExpectedTotalSlopes": roof_diagnostics.get("expectedTotalSlopeCount"),
                "roofSystemActualTotalSlopes": roof_diagnostics.get("actualTotalSlopeCount"),
            }
            rotated_slopes = [slope for slope in diagnostic_slopes if abs(abs(slope.get("sectionRotationY", 0)) - 1.57079632679) <= 1e-5]
            check(
                "roof QA is computed from actual matrices, bounds and geometry",
                roof_diagnostics.get("evidenceSource") == "actual-geometry-instance-matrices-and-world-bounds"
                and roof_diagnostics.get("rotationComposition") == "Qy*Qx"
                and roof_diagnostics.get("roofUnitCount") == 7
                and roof_diagnostics.get("allRoofUnitsPassed") is True
                and len(diagnostic_units) == 7
                and roof_diagnostics.get("expectedSlopeCounts") == EXPECTED_SLOPE_COUNTS
                and roof_diagnostics.get("expectedTotalSlopeCount") == EXPECTED_TOTAL_SLOPES
                and roof_diagnostics.get("actualTotalSlopeCount") == EXPECTED_TOTAL_SLOPES
                and diagnostic_slope_counts == EXPECTED_SLOPE_COUNTS
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
            for roof in roofs:
                for slope in roof.get("slopes", []):
                    slope_checks.append(
                        slope.get("coverColumns") == slope.get("panColumns", 0) - 1
                        and slope.get("coverBridgesPanSeams") is True
                        and abs(slope.get("coverCourseOffsetM", 1)) <= 0.004
                        and slope.get("seamSampleCount", 0) > 0
                        and slope.get("seamAlignmentMaxErrorM", 1) <= 0.004
                        and slope.get("dripCount") == slope.get("panColumns")
                        and slope.get("hookCount") == slope.get("coverColumns")
                        and slope.get("panConcavity") == "up"
                        and slope.get("coverConvexity") == "up"
                        and slope.get("panGeometryClosedShell") is True
                        and slope.get("coverGeometryClosedShell") is True
                        and slope.get("drainagePathCount") == slope.get("panColumns")
                        and slope.get("monotonicDrainagePathCount") == slope.get("drainagePathCount")
                        and slope.get("drainagePathsMonotonic") is True
                        and slope.get("eaveTerminationCount") == slope.get("drainagePathCount")
                        and slope.get("drainagePathsEndAtEave") is True
                        and slope.get("minimumCourseFallM", 0) > 0
                        and slope.get("measuredPitch", 0) > 0
                        and slope.get("tileBatchesAreInstanced") is True
                        and slope.get("longitudinalOverlapM", 0) > 0
                        and slope.get("evidenceSource") == "live-instance-matrices-buffer-geometry-and-world-bounds"
                    )
            roof_topology_audit.update({
                "passedSlopeChecks": slope_checks.count(True),
                "failedSlopeChecks": slope_checks.count(False),
            })
            check(
                "pan-cover topology and drainage across the exact fourteen slopes",
                len(slope_checks) == EXPECTED_TOTAL_SLOPES
                and roof_slope_counts == EXPECTED_SLOPE_COUNTS
                and diagnostic_slope_counts == EXPECTED_SLOPE_COUNTS
                and all(slope_checks),
                roof_topology_audit,
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
            static_batching = walls.get("staticBatching") or {}
            live_wall_batches = static_batching.get("liveBatches") or []
            live_wall_batches_by_layer = {
                batch.get("layerId"): batch for batch in live_wall_batches
            }
            declared_wall_batches = {
                batch.get("layerId"): batch for batch in static_batching.get("batches") or []
            }
            check(
                "nine merge-compatible static wall layers are real indexed RGB-plus-alpha geometry batches",
                static_batching.get("enabled") is True
                and static_batching.get("batchCount") == len(EXPECTED_STATIC_WALL_BATCH_LAYERS)
                and static_batching.get("liveBatchCount") == len(EXPECTED_STATIC_WALL_BATCH_LAYERS)
                and set(static_batching.get("layerIds") or []) == EXPECTED_STATIC_WALL_BATCH_LAYERS
                and {batch.get("layerId") for batch in live_wall_batches} == EXPECTED_STATIC_WALL_BATCH_LAYERS
                and all(
                    batch.get("indexed") is True
                    and batch.get("indexCount", 0) > 0
                    and batch.get("positionCount", 0) > 0
                    and batch.get("colorCount") == batch.get("positionCount")
                    and batch.get("vertexColorChannels") == 3
                    and batch.get("alphaCount") == batch.get("positionCount")
                    and batch.get("alphaItemSize") == 1
                    and batch.get("alphaShaderRevision") == "yunnan-wall-static-rgb-plus-alpha-batch-v2"
                    and batch.get("alphaCompiledShaderEvidence", {}).get("vertexAlphaAttribute") is True
                    and batch.get("alphaCompiledShaderEvidence", {}).get("fragmentAlphaApplied") is True
                    and batch.get("alphaCompiledShaderEvidence", {}).get(
                        "vertexColorAlphaSeparated"
                    ) is True
                    and batch.get("alphaCompiledShaderEvidence", {}).get("evidenceSource")
                    == "actual-onBeforeCompile-transformed-shader-source"
                    and batch.get("logicalPatchCount", 0) > 0
                    and batch.get("logicalPatchesPresent") is True
                    and batch.get("actualTriangleCount", 0) > 0
                    and batch.get("actualTriangleCount") == batch.get("declaredTriangleCount")
                    and batch.get("worldBounds") is not None
                    for batch in live_wall_batches
                ),
                static_batching,
            )
            check(
                "wall batching preserves source triangles, vertices and bounds per layer",
                set(declared_wall_batches) == EXPECTED_STATIC_WALL_BATCH_LAYERS
                and set(live_wall_batches_by_layer) == EXPECTED_STATIC_WALL_BATCH_LAYERS
                and all(
                    declared_wall_batches[layer_id].get("sourceTriangleCount", 0) > 0
                    and declared_wall_batches[layer_id].get("sourceTriangleCount")
                    == declared_wall_batches[layer_id].get("batchTriangleCount")
                    and declared_wall_batches[layer_id].get("sourceVertexCount", 0)
                    == declared_wall_batches[layer_id].get("batchPositionCount")
                    == declared_wall_batches[layer_id].get("batchColorCount")
                    == declared_wall_batches[layer_id].get("batchAlphaCount")
                    and declared_wall_batches[layer_id].get("batchColorItemSize") == 3
                    and declared_wall_batches[layer_id].get("batchAlphaItemSize") == 1
                    and declared_wall_batches[layer_id].get("vertexColorChannels") == 3
                    and declared_wall_batches[layer_id].get("localBoundsMaxDeltaM", 1) <= 1e-5
                    and len(declared_wall_batches[layer_id].get("sourceLocalBounds") or []) == 6
                    and len(declared_wall_batches[layer_id].get("batchLocalBounds") or []) == 6
                    and max(
                        abs(source - batched) for source, batched in zip(
                            declared_wall_batches[layer_id]["sourceLocalBounds"],
                            declared_wall_batches[layer_id]["batchLocalBounds"],
                        )
                    ) <= 1e-5
                    and live_wall_batches_by_layer[layer_id].get("sourceTriangleCount")
                    == declared_wall_batches[layer_id].get("sourceTriangleCount")
                    and live_wall_batches_by_layer[layer_id].get("actualTriangleCount")
                    == declared_wall_batches[layer_id].get("batchTriangleCount")
                    and live_wall_batches_by_layer[layer_id].get("worldBoundsMaxDeltaM", 1) <= 1e-5
                    and len(live_wall_batches_by_layer[layer_id].get("sourceWorldBounds") or []) == 6
                    for layer_id in EXPECTED_STATIC_WALL_BATCH_LAYERS
                ),
                {"declared": declared_wall_batches, "live": live_wall_batches},
            )
            specialized_batches = walls.get("specializedBatches") or {}
            crack_batches = specialized_batches.get("crackNetwork") or []
            straw_batches = specialized_batches.get("strawFibre") or []
            check(
                "crack network remains one real semantic instanced geometry batch",
                len(crack_batches) == 1
                and crack_batches[0].get("expectedKind") == "single-instanced-shared-geometry-batch"
                and crack_batches[0].get("instanced") is True
                and crack_batches[0].get("instanceCount", 0) > 0
                and crack_batches[0].get("instanceMapCount") == crack_batches[0].get("instanceCount")
                and crack_batches[0].get("positionCount", 0) > 0
                and crack_batches[0].get("triangleCount", 0) > 0
                and crack_batches[0].get("geometryEvidence")
                == "shared-buffer-geometry-with-actual-instance-matrices"
                and str(crack_batches[0].get("geometryFingerprint", "")).startswith("fnv1a32:")
                and len(crack_batches[0].get("worldBounds") or []) == 6,
                crack_batches,
            )
            check(
                "straw fibre remains one real exact vertex-range static patch batch",
                len(straw_batches) == 1
                and straw_batches[0].get("expectedKind") == "single-static-exact-vertex-range-batch"
                and straw_batches[0].get("instanced") is False
                and straw_batches[0].get("semanticElementCount", 0) > 0
                and straw_batches[0].get("geometryMapCount")
                == straw_batches[0].get("semanticElementCount")
                and straw_batches[0].get("mappedVertexCount") == straw_batches[0].get("positionCount")
                and straw_batches[0].get("contiguousGeometryMap") is True
                and straw_batches[0].get("positionCount", 0) > 0
                and straw_batches[0].get("triangleCount", 0) > 0
                and straw_batches[0].get("geometryEvidence")
                == "exact-host-mapped-polygons-statically-merged-by-vertex-range"
                and str(straw_batches[0].get("geometryFingerprint", "")).startswith("fnv1a32:")
                and len(straw_batches[0].get("worldBounds") or []) == 6,
                straw_batches,
            )
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
                select_control(profile_id, f"surface-preset-{profile_id}")
                page.wait_for_timeout(250)
                profile_snapshots[profile_id] = page.evaluate("window.__SURFACE_QA__.inspect('production')")
            check("three presets produce distinct surfaces", len({item["surfaceFingerprint"] for item in profile_snapshots.values()}) == 3)
            check("three presets preserve structure", len({item["structuralFingerprint"] for item in profile_snapshots.values()}) == 1)
            wulong_damage = sum(roof["damage"]["missingTiles"] + roof["damage"]["brokenTiles"] for roof in profile_snapshots["wulongWeathered"]["roofUnits"])
            dali_damage = sum(roof["damage"]["missingTiles"] + roof["damage"]["brokenTiles"] for roof in profile_snapshots["daliMaintained"]["roofUnits"])
            check("Wulong preset is more damaged than Dali", wulong_damage > dali_damage, {"wulong": wulong_damage, "dali": dali_damage})
            select_control("museum1940sBalanced", "restore-production-preset")

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
            click_control("#openings", "open-door-window-leaves")
            page.wait_for_timeout(120)
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
            click_control("#visitor", "play-visitor-gate-to-upper-floor")
            page.wait_for_function(
                """() => {
                  const playback = window.__SURFACE_QA__?.visitorPlayback?.();
                  return playback?.completed === true
                    || (playback?.durationSatisfied === true
                      && playback?.minimumFrameCount >= 36
                      && playback?.frameCount >= playback?.minimumFrameCount);
                }""",
                timeout=180_000,
            )
            visitor_playback = page.evaluate("window.__SURFACE_QA__.visitorPlayback()")
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
                and playback.get("evidenceSource") == "production-raf-post-render-world-position-plus-generator-raycast"
                and playback.get("clockSource") == "requestAnimationFrame-timestamp-duration-gated-by-minimum-rendered-frames"
                and playback.get("frameCount", 0) >= 36
                and playback.get("renderedFrameCount") == playback.get("frameCount")
                and playback.get("uniquePositionCount") == playback.get("frameCount")
                and len(playback.get("stages", [])) >= 6
                and not playback.get("frameFailures")
                and playback.get("durationSatisfied") is True
                and playback.get("elapsedMs", 0) >= playback.get("durationRequestedMs", 1)
                and str(playback.get("captureActualStructureManifestFingerprint", "")).startswith("fnv1a32:")
                and playback.get("captureActualStructureManifestFingerprint")
                == playback.get("completionActualStructureManifestFingerprint")
                and playback.get("captureManifestMatchesCompletion") is True
                and playback.get("routeManifestContract")
                == "canonical-live-visitor-route-anchors-supports-stages-and-world-points-v1"
                and str(playback.get("captureRouteManifestFingerprint", "")).startswith("fnv1a32:")
                and playback.get("captureRouteManifestFingerprint")
                == playback.get("completionRouteManifestFingerprint")
                and playback.get("captureRoutePointFingerprint")
                == playback.get("completionRoutePointFingerprint")
                and playback.get("captureRouteAnchorFingerprint")
                == playback.get("completionRouteAnchorFingerprint")
                and playback.get("captureRouteMatchesCompletion") is True
                and playback.get("captureRouteManifest", {}).get("anchors")
                and playback.get("captureRouteManifest", {}).get("worldPoints")
                and playback.get("captureProfileId") == playback.get("completionProfileId")
                and str(playback.get("captureSurfaceFingerprint", "")).startswith("fnv1a32:")
                and playback.get("captureSurfaceFingerprint")
                == playback.get("completionSurfaceFingerprint")
                and playback.get("captureSurfaceMatchesCompletion") is True
                and visitor.get("browserPlayback", {}).get("completed") is True,
                playback,
            )
            playback_frames = playback.get("frames") or []
            frame_ids = [frame.get("renderFrameId") for frame in playback_frames]
            frame_times = [frame.get("timestampMs") for frame in playback_frames]
            frame_progress = [frame.get("progress") for frame in playback_frames]
            check(
                "every visitor sample is a post-render real world-coordinate frame",
                len(playback_frames) >= 36
                and all(frame.get("capturedAfterProductionRender") is True for frame in playback_frames)
                and all(isinstance(frame.get("worldPosition"), list) and len(frame["worldPosition"]) == 3 for frame in playback_frames)
                and all(frame_ids[index] > frame_ids[index - 1] for index in range(1, len(frame_ids)))
                and all(frame_times[index] > frame_times[index - 1] for index in range(1, len(frame_times)))
                and all(frame_progress[index] > frame_progress[index - 1] for index in range(1, len(frame_progress)))
                and frame_progress[0] == 0
                and frame_progress[-1] == 1
                and all(
                    abs(frame.get("clockProgress", -1) - min(1, frame.get("clockElapsedMs", -1) / playback.get("durationRequestedMs", 1))) <= 0.001
                    and frame.get("progress", 2) <= frame.get("clockProgress", -1) + 1e-7
                    and frame.get("progress", 2) <= frame.get("minimumFrameProgress", -1) + 1e-7
                    for frame in playback_frames
                )
                and all(frame.get("wallIntersectionCount") == 0 for frame in playback_frames)
                and all(frame.get("openingCollisionCount") == 0 for frame in playback_frames)
                and all(frame.get("railCollisionCount") == 0 for frame in playback_frames)
                and all(frame.get("suspended") is False and frame.get("stuck") is False for frame in playback_frames),
                {"frameIds": frame_ids, "timestamps": frame_times, "progress": frame_progress,
                 "frames": playback_frames},
            )
            check(
                "visitor route uses raycast and world-bound evidence",
                visitor.get("evidenceSource") == "raycaster-plus-world-bounds"
                and visitor.get("routeSampleCount", 0) >= 300
                and visitor.get("maximumRouteSampleSpacingM", 1) <= 0.08
                and isinstance(visitor.get("maximumWorldPositionDeltaM"), (int, float))
                and visitor.get("maximumWorldPositionDeltaM", 0) >= visitor.get("maximumCollisionSampleSpacingM", 1)
                and visitor.get("collisionEvidenceSource") == "snapped-foot-segment-capsule-world-bounds-subdivision"
                and visitor.get("collisionSampleCount", 0) >= visitor.get("routeSampleCount", 0)
                and visitor.get("maximumCollisionSampleSpacingM", 1) <= 0.08
                and visitor.get("requiredMaximumCollisionSampleSpacingM") == 0.08
                and visitor.get("endpointWallIntersectionCount") == 0
                and visitor.get("endpointOpeningCollisionCount") == 0
                and visitor.get("endpointRailCollisionCount") == 0
                and visitor.get("wallIntersectionCount") == 0
                and visitor.get("openingCollisionCount") == 0
                and visitor.get("railCollisionCount") == 0
                and visitor.get("maximumSupportGapM", 1) <= 0.03
                and visitor.get("maximumRequestedSupportGapM", 1) <= 0.20
                and visitor.get("maximumAnchorSupportGapM", 1) <= 0.001
                and visitor.get("unsupportedAnchorCount") == 0
                and visitor.get("mismatchedAnchorSupportCount") == 0
                and visitor.get("auditObjectCounts", {}).get("partitionHostCount") == 1
                and visitor.get("auditObjectCounts", {}).get("partitionColliderCount") == 77
                and visitor.get("auditObjectCounts", {}).get("partitionCollisionEvidenceSource")
                == "live-instanced-member-buffer-geometry-times-instance-and-world-matrices"
                and len(visitor.get("auditedStages", [])) >= 6
                and len(visitor.get("auditedSupportIds", [])) >= 6,
                visitor,
            )
            executed_phases.append("visitor-playback")

            # Restore one explicit visual-process default state for later
            # equality checks.  Performance is intentionally not sampled in
            # this feature-heavy process; the sole desktop FPS window runs in
            # a fresh Chromium process after every visual screenshot is done.
            click_control("#reset", "reset-before-visual-default-snapshot")
            page.evaluate("window.__SURFACE_QA__.setQARouteEvidence(false)")
            visual_evidence["desktopVisualDefaultResolution"] = page.evaluate(
                "window.__SURFACE_QA__.setQACapturePixelRatio(null)"
            )
            page.evaluate("window.__SURFACE_QA__.waitForNextProductionRender()")
            desktop_visual_default_snapshot = page.evaluate(
                "window.__SURFACE_QA__.inspect('production')"
            )
            check(
                "desktop visual process restores the default complete comparison state",
                desktop_visual_default_snapshot.get("profileId") == "museum1940sBalanced"
                and desktop_visual_default_snapshot.get("completeBuilding") is True
                and desktop_visual_default_snapshot.get("cutaway") is False
                and desktop_visual_default_snapshot.get("cameraPresetId") == "overview"
                and desktop_visual_default_snapshot.get("renderQuality", {}).get("profileId")
                == "desktop-closed-shell-5-span"
                and len(desktop_visual_default_snapshot.get("roofSystem", {}).get("buildUp") or []) == 7
                and abs(desktop_visual_default_snapshot.get("renderer", {}).get("pixelRatio", 0) - 0.2)
                <= 1e-6,
                {
                    "profileId": desktop_visual_default_snapshot.get("profileId"),
                    "completeBuilding": desktop_visual_default_snapshot.get("completeBuilding"),
                    "cutaway": desktop_visual_default_snapshot.get("cutaway"),
                    "cameraPresetId": desktop_visual_default_snapshot.get("cameraPresetId"),
                    "renderQuality": desktop_visual_default_snapshot.get("renderQuality"),
                    "roofLayerCount": len(
                        desktop_visual_default_snapshot.get("roofSystem", {}).get("buildUp") or []
                    ),
                    "renderer": desktop_visual_default_snapshot.get("renderer"),
                },
            )

            click_control("#reset", "reset-before-visual-evidence")
            visual_evidence["captureResolution"] = page.evaluate(
                "window.__SURFACE_QA__.setQACapturePixelRatio(1)"
            )
            check(
                "visual evidence uses an explicit full-resolution render after default-state capture",
                visual_evidence["captureResolution"].get("mode") == "high-resolution-visual-evidence"
                and visual_evidence["captureResolution"].get("appliedPixelRatio") == 1
                and visual_evidence["captureResolution"].get("defaultInteractivePixelRatioCap") == 0.2,
                visual_evidence["captureResolution"],
            )
            click_control("[data-camera='overview']", "complete-building-overview")
            page.wait_for_timeout(180)
            visual_evidence["complete"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_complete_building.png"), timeout=180_000)
            click_control("[data-camera='ab']", "same-structure-same-camera-ab")
            page.wait_for_timeout(180)
            visual_evidence["ab"] = {
                "baseline": visual_state(page, "baseline"),
                "production": visual_state(page, "production"),
            }
            page.screenshot(path=str(screenshot_dir / "v550_ab_same_camera.png"), full_page=False, timeout=180_000)
            visual_evidence["featureLighting"] = page.evaluate("window.__SURFACE_QA__.setQALighting('raking')")
            page.evaluate("window.__SURFACE_QA__.setMode('roofOnly')")
            visual_evidence["eaveIsolation"] = page.evaluate(
                "window.__SURFACE_QA__.setQARoofIsolation('mainHouseDoublePitch')"
            )
            visual_evidence["eaveLayerIsolation"] = page.evaluate(
                "window.__SURFACE_QA__.setQARoofLayerIsolation(['panTileCourses','coverTileCourses','eaveCapsAndDrips'])"
            )
            click_control("[data-camera='eave']", "eave-pan-cover-overlap-drainage")
            visual_evidence["eaveCallouts"] = page.evaluate(
                "window.__SURFACE_QA__.setQAFeatureCallouts('eave')"
            )
            page.wait_for_timeout(180)
            visual_evidence["eave"] = visual_state(page)
            eave_camera = visual_evidence["eave"].get("cameraEvidence") or {}
            eave_checks = eave_camera.get("featureChecks") or {}
            eave_projection_axis = eave_checks.get("downhillProjectionAxis") or []
            eave_fascia_projection = eave_checks.get("fasciaExteriorDownhillProjectionM")
            eave_drip_projection = eave_checks.get("dripTerminalDownhillProjectionM")
            eave_hook_projection = eave_checks.get("hookTerminalDownhillProjectionM")
            eave_drip_clearance = eave_checks.get("dripTerminalBeyondFasciaM")
            eave_hook_clearance = eave_checks.get("hookTerminalBeyondFasciaM")
            check(
                "eave camera frames all physical tile and drainage features",
                set(eave_camera.get("featureKinds") or []) == {"pan", "cover", "drip", "hook", "fascia"}
                and eave_checks.get("panConcavity") == "up"
                and eave_checks.get("coverConvexity") == "up"
                and eave_checks.get("coverBridgesPanSeams") is True
                and eave_checks.get("longitudinalOverlapM", 0) > 0
                and eave_checks.get("drainagePathsEndAtEave") is True
                and eave_checks.get("dripCount", 0) > 0
                and eave_checks.get("hookCount", 0) > 0
                and eave_checks.get("fasciaPresent") is True
                and eave_checks.get("eaveFasciaThicknessM", 0) >= 0.16
                and eave_checks.get("eaveFasciaDepthM", 0) >= 0.09
                and eave_checks.get("terminalClearanceEvidenceSource")
                == "live-buffer-vertices-times-instance-and-world-matrices-projected-on-horizontal-downhill-axis"
                and len(eave_projection_axis) == 3
                and abs(sum(value * value for value in eave_projection_axis) ** 0.5 - 1) <= 1e-5
                and eave_checks.get("terminalProjectionSampleCounts", {}).get("fascia", 0) > 0
                and eave_checks.get("terminalProjectionSampleCounts", {}).get("drip", 0) > 0
                and eave_checks.get("terminalProjectionSampleCounts", {}).get("hook", 0) > 0
                and eave_checks.get("hookSelectionContract")
                == "independent-front-plate-batch-and-selected-instance-membership-only"
                and set(eave_checks.get("hookHeadBatchTypes") or []) == {"勾头-cover-eave-hook-heads"}
                and eave_checks.get("hookHeadGeometryFrontPlate") is True
                and isinstance(eave_fascia_projection, (int, float))
                and isinstance(eave_drip_projection, (int, float))
                and isinstance(eave_hook_projection, (int, float))
                and isinstance(eave_drip_clearance, (int, float)) and eave_drip_clearance > 0
                and isinstance(eave_hook_clearance, (int, float)) and eave_hook_clearance > 0
                and abs((eave_drip_projection - eave_fascia_projection) - eave_drip_clearance) <= 2e-6
                and abs((eave_hook_projection - eave_fascia_projection) - eave_hook_clearance) <= 2e-6
                and eave_camera.get("featureBounds", {}).get("fascia") is not None
                and eave_camera.get("callouts", {}).get("source")
                == "live-feature-world-bounds-selected-renderable-membership-and-first-visible-model-raycast-hit"
                and {target.get("featureId") for target in eave_camera.get("callouts", {}).get("targets", [])}
                == {"pan", "cover", "drip", "hook", "fascia"}
                and callouts_visible(eave_camera),
                eave_camera,
            )
            check(
                "eave closeup isolates only the generated main roof without deleting other roofs",
                visual_evidence["eaveIsolation"].get("visibleRoofUnitIds") == ["mainHouseDoublePitch"]
                and visual_evidence["eaveIsolation"].get("generatedRoofUnitCount") == 7,
                visual_evidence["eaveIsolation"],
            )
            check(
                "eave diagnostic preserves all seven generated layers while removing underlay occlusion",
                set(visual_evidence["eaveLayerIsolation"].get("generatedLayerIds") or []) == EXPECTED_ROOF_LAYERS
                and set(visual_evidence["eaveLayerIsolation"].get("visibleLayerIds") or [])
                == {"panTileCourses", "coverTileCourses", "eaveCapsAndDrips"},
                visual_evidence["eaveLayerIsolation"],
            )
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_pan_cover_eave_closeup.png"), timeout=180_000)
            page.evaluate("window.__SURFACE_QA__.setQARoofLayerIsolation(null)")
            visual_evidence["ridgeLayerIsolation"] = page.evaluate(
                "window.__SURFACE_QA__.setQARoofLayerIsolation(['ridgeAndClosures'])"
            )
            page.evaluate("window.__SURFACE_QA__.setCamera('qaRidge')")
            visual_evidence["ridgeCallouts"] = page.evaluate(
                "window.__SURFACE_QA__.setQAFeatureCallouts('ridge')"
            )
            page.wait_for_timeout(180)
            visual_evidence["ridge"] = visual_state(page)
            ridge_semantics = set((visual_evidence["ridge"].get("cameraEvidence") or {}).get("featureSemantics") or [])
            check(
                "ridge camera includes principal ridge, diagonal verge and end closure geometry",
                {"principalRidge", "vergeClosure", "endClosure"}.issubset(ridge_semantics)
                and {target.get("featureId") for target in (visual_evidence["ridge"].get("cameraEvidence") or {}).get("callouts", {}).get("targets", [])}
                == {"principalRidge", "vergeClosure", "endClosure"}
                and callouts_visible(visual_evidence["ridge"].get("cameraEvidence") or {})
                and set(visual_evidence["ridgeLayerIsolation"].get("generatedLayerIds") or []) == EXPECTED_ROOF_LAYERS
                and visual_evidence["ridgeLayerIsolation"].get("visibleLayerIds") == ["ridgeAndClosures"],
                visual_evidence["ridge"].get("cameraEvidence"),
            )
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_ridge_closures.png"), timeout=180_000)
            page.evaluate("window.__SURFACE_QA__.setQARoofLayerIsolation(null)")
            page.evaluate("window.__SURFACE_QA__.setQARoofIsolation(null)")
            page.evaluate("window.__SURFACE_QA__.setMode('complete')")
            visual_evidence["abutmentIsolation"] = page.evaluate(
                "window.__SURFACE_QA__.setQARoofIsolation('sideGalleryLeanTo')"
            )
            visual_evidence["abutmentLayerIsolation"] = page.evaluate(
                "window.__SURFACE_QA__.setQARoofLayerIsolation(['ridgeAndClosures'])"
            )
            visual_evidence["abutmentHostIsolation"] = page.evaluate(
                "window.__SURFACE_QA__.setQAAbutmentIsolation(true)"
            )
            page.evaluate("window.__SURFACE_QA__.setCamera('qaAbutment')")
            visual_evidence["abutmentCallouts"] = page.evaluate(
                "window.__SURFACE_QA__.setQAFeatureCallouts('abutment')"
            )
            page.wait_for_timeout(180)
            visual_evidence["abutment"] = visual_state(page)
            abutment_semantics = set((visual_evidence["abutment"].get("cameraEvidence") or {}).get("featureSemantics") or [])
            check(
                "wall-abutment camera proves live east-xiaoxia closure contact with its declared timber host",
                "wallAbutment" in abutment_semantics
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("roofUnitId") == "sideGalleryLeanTo"
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("sectionId") == "east-xiaoxia"
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("abutmentHostComponentId") == "FRAME-EAST-EAR-INNER-HIGH-EDGE"
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostSemanticRole") == "roof-abutment-host"
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostSourceRule") == "eastSmallGallery.highEdge=eastEarInnerWall"
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostOpenGalleryPreserved") is True
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostWallKind") == "framed-timber-panel-lattice"
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostMaterialKind") == "timber"
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostLiveMaterialMode") == "timber"
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostContinuousSolidInfill") is False
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostOpenBayCount") == 3
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostMemberCounts") == {
                    "head-plate": 1, "post": 4, "lower-panel": 6,
                    "lower-lattice-horizontal": 24, "lower-lattice-vertical": 12,
                    "open-bay-jamb": 6, "open-bay-lintel": 3,
                    "upper-lattice-horizontal": 9, "upper-lattice-vertical": 12,
                }
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostMemberCountSum")
                == (visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostInstanceCount") == 77
                and len((visual_evidence["abutment"].get("cameraEvidence") or {}).get("openBayEvidence") or []) == 3
                and all(
                    bay.get("complete") is True
                    and abs(bay.get("clearWidthM", 0) - 0.62) <= 1e-5
                    and abs(bay.get("clearHeightM", 0) - 2.04) <= 1e-5
                    and bay.get("blockingInstanceCount") == 0
                    and len(bay.get("clearWorldBounds") or []) == 6
                    for bay in (visual_evidence["abutment"].get("cameraEvidence") or {}).get("openBayEvidence") or []
                )
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("closureInstanceCount") == 1
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("contactSampleCount") == 33
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("maximumContactGapM", 999) <= 0.01
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("requiredMaximumContactGapM") == 0.01
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("contactCoverage", 0) >= 0.9
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("minimumRequiredContactCoverage") == 0.9
                and len((visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostHeadPlateWorldBounds") or []) == 6
                and len((visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostContextBounds") or []) == 6
                and set((visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostDetailMemberTypes") or [])
                == {
                    "head-plate", "post", "lower-panel", "lower-lattice-horizontal",
                    "lower-lattice-vertical", "open-bay-jamb", "open-bay-lintel",
                    "upper-lattice-horizontal", "upper-lattice-vertical",
                }
                and len((visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostDetailMemberIndices") or []) > 20
                and len((visual_evidence["abutment"].get("cameraEvidence") or {}).get("hostDetailWorldBounds") or []) == 6
                and {target.get("featureId") for target in (visual_evidence["abutment"].get("cameraEvidence") or {}).get("callouts", {}).get("targets", [])}
                == {"wallAbutment", "headPlate", "lowerPanel", "upperLattice"}
                and callouts_visible(visual_evidence["abutment"].get("cameraEvidence") or {})
                and (visual_evidence["abutment"].get("cameraEvidence") or {}).get("isolatedRoofUnitId") == "sideGalleryLeanTo"
                and visual_evidence["abutmentIsolation"].get("visibleRoofUnitIds") == ["sideGalleryLeanTo"]
                and visual_evidence["abutmentIsolation"].get("generatedRoofUnitCount") == 7
                and set(visual_evidence["abutmentLayerIsolation"].get("generatedLayerIds") or []) == EXPECTED_ROOF_LAYERS
                and visual_evidence["abutmentLayerIsolation"].get("visibleLayerIds") == ["ridgeAndClosures"]
                and visual_evidence["abutmentHostIsolation"].get("preservedHostVisible") is True
                and visual_evidence["abutmentHostIsolation"].get("preservedHostComponentId") == "FRAME-EAST-EAR-INNER-HIGH-EDGE"
                and visual_evidence["abutmentHostIsolation"].get("hiddenNonHostTimberRenderableCount", 0) > 0,
                {"camera": visual_evidence["abutment"].get("cameraEvidence"),
                 "roofIsolation": visual_evidence["abutmentIsolation"],
                 "layerIsolation": visual_evidence["abutmentLayerIsolation"],
                 "hostIsolation": visual_evidence["abutmentHostIsolation"]},
            )
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_wall_abutment_closeup.png"), timeout=180_000)
            page.evaluate("window.__SURFACE_QA__.setQAAbutmentIsolation(false)")
            page.evaluate("window.__SURFACE_QA__.setQARoofLayerIsolation(null)")
            page.evaluate("window.__SURFACE_QA__.setQARoofIsolation(null)")
            click_control("#explode", "visible-seven-layer-explode-toggle")
            page.evaluate("window.__SURFACE_QA__.setMode('roofOnly')")
            visual_evidence["explodedIsolation"] = page.evaluate(
                "window.__SURFACE_QA__.setQARoofIsolation('mainHouseDoublePitch')"
            )
            page.evaluate("window.__SURFACE_QA__.setRoofExploded(1.25)")
            page.evaluate("window.__SURFACE_QA__.setCamera('qaExploded')")
            page.wait_for_timeout(180)
            visual_evidence["exploded"] = visual_state(page)
            exploded_camera = visual_evidence["exploded"].get("cameraEvidence") or {}
            check(
                "exploded oblique camera separates all seven live layer bounds",
                set(exploded_camera.get("layerIds") or []) == EXPECTED_ROOF_LAYERS
                and exploded_camera.get("explodeDistanceM", 0) >= 1.2
                and exploded_camera.get("isolationActive") is True
                and exploded_camera.get("isolatedRoofUnitId") == "mainHouseDoublePitch"
                and exploded_camera.get("minimumLayerCenterSeparationM", 0) >= 0.5
                and all(exploded_camera.get("layerBounds", {}).get(layer) for layer in EXPECTED_ROOF_LAYERS),
                exploded_camera,
            )
            check(
                "exploded evidence preserves seven generated roofs while isolating one for legibility",
                visual_evidence["explodedIsolation"].get("generatedRoofUnitCount") == 7
                and visual_evidence["explodedIsolation"].get("visibleRoofUnitIds") == ["mainHouseDoublePitch"]
                and len(visual_evidence["explodedIsolation"].get("hiddenRoofUnitIds") or []) == 6,
                visual_evidence["explodedIsolation"],
            )
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_roof_exploded_layers.png"), timeout=180_000)
            page.evaluate("window.__SURFACE_QA__.setRoofExploded(false)")
            page.evaluate("window.__SURFACE_QA__.setQARoofIsolation(null)")
            page.evaluate("window.__SURFACE_QA__.setMode('complete')")
            click_control("[data-camera='wall']", "wall-weathering-closeup-camera")
            page.wait_for_timeout(180)
            visual_evidence["wall"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_wall_weathering_closeup.png"), timeout=180_000)
            page.evaluate("window.__SURFACE_QA__.setVisitorProgress(1)")
            select_control("wulongWeathered", "opening-weathering-evidence-preset")
            page.evaluate("window.__SURFACE_QA__.setVisitorProgress(1)")
            if page.locator("#openings").get_attribute("aria-pressed") == "true":
                click_control("#openings", "close-openings-for-evidence")
            page.evaluate("window.__SURFACE_QA__.setCamera('qaDoor')")
            page.evaluate("window.__SURFACE_QA__.setQAFeatureCallouts('door')")
            page.wait_for_timeout(180)
            visual_evidence["doorClosed"] = visual_state(page)
            visual_evidence["doorClosed"]["featurePixelEvidence"] = page.evaluate(
                "window.__SURFACE_QA__.measureQAFeaturePixels('doorLeaf')"
            )
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_door_closed_closeup.png"), timeout=180_000)
            page.evaluate("window.__SURFACE_QA__.setCamera('qaWindow')")
            page.evaluate("window.__SURFACE_QA__.setQAFeatureCallouts('window')")
            page.wait_for_timeout(180)
            visual_evidence["windowClosed"] = visual_state(page)
            visual_evidence["windowClosed"]["featurePixelEvidence"] = page.evaluate(
                "window.__SURFACE_QA__.measureQAFeaturePixels('windowLeaf')"
            )
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_window_closed_closeup.png"), timeout=180_000)
            click_control("#openings", "open-openings-for-evidence")
            page.evaluate("window.__SURFACE_QA__.setCamera('qaDoor')")
            page.evaluate("window.__SURFACE_QA__.setQAFeatureCallouts('door')")
            page.wait_for_timeout(180)
            visual_evidence["doorOpen"] = visual_state(page)
            visual_evidence["doorOpen"]["featurePixelEvidence"] = page.evaluate(
                "window.__SURFACE_QA__.measureQAFeaturePixels('doorLeaf')"
            )
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_door_open_closeup.png"), timeout=180_000)
            page.evaluate("window.__SURFACE_QA__.setCamera('qaWindow')")
            page.evaluate("window.__SURFACE_QA__.setQAFeatureCallouts('window')")
            page.wait_for_timeout(180)
            visual_evidence["windowOpen"] = visual_state(page)
            visual_evidence["windowOpen"]["featurePixelEvidence"] = page.evaluate(
                "window.__SURFACE_QA__.measureQAFeaturePixels('windowLeaf')"
            )
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_window_open_closeup.png"), timeout=180_000)
            door_closed_camera = visual_evidence["doorClosed"].get("cameraEvidence") or {}
            door_open_camera = visual_evidence["doorOpen"].get("cameraEvidence") or {}
            window_closed_camera = visual_evidence["windowClosed"].get("cameraEvidence") or {}
            window_open_camera = visual_evidence["windowOpen"].get("cameraEvidence") or {}
            check(
                "door closed/open closeups use one fixed camera and expose frame and replacement surfaces",
                visual_evidence["doorClosed"].get("cameraFingerprint") == visual_evidence["doorOpen"].get("cameraFingerprint")
                and door_closed_camera.get("openingState") == "closed"
                and door_open_camera.get("openingState") == "open"
                and max((abs(value) for value in door_closed_camera.get("pivotAnglesRad") or [99]), default=99) <= 1e-5
                and max((abs(value) for value in door_open_camera.get("pivotAnglesRad") or [0]), default=0) >= 1.0
                and door_open_camera.get("surfaceRoleCounts", {}).get("openingFrame", 0) >= 3
                and door_open_camera.get("surfaceRoleCounts", {}).get("replacementPart", 0) >= 1
                and door_open_camera.get("surfaceMaterials", {}).get("doorLeaf", {}).get("openingRole") == "doorLeaf"
                and door_open_camera.get("surfaceMaterials", {}).get("openingFrame", {}).get("openingRole") == "openingFrame"
                and door_open_camera.get("surfaceMaterials", {}).get("replacementPart", {}).get("openingRole") == "replacementPart"
                and door_open_camera.get("surfaceMaterials", {}).get("replacementPart", {}).get("channels", {}).get("replacementAge", 0) >= 0.8
                and door_open_camera.get("surfaceMaterials", {}).get("replacementPart", {}).get("surfaceFingerprint")
                != door_open_camera.get("surfaceMaterials", {}).get("doorLeaf", {}).get("surfaceFingerprint")
                and len({
                    door_open_camera.get("surfaceMaterials", {}).get(role, {}).get("baseColor")
                    for role in ("doorLeaf", "openingFrame", "replacementPart")
                }) == 3
                and all(
                    door_open_camera.get("surfaceMaterials", {}).get(role, {}).get("weatheringShaderMode") == "openingTimber"
                    and len(door_open_camera.get("surfaceMaterials", {}).get(role, {}).get("deterministicChannelNames") or []) == 6
                    and compiled_material_ok(door_open_camera.get("surfaceMaterials", {}).get(role, {}), "openingTimber")
                    for role in ("doorLeaf", "openingFrame", "replacementPart")
                )
                and {target.get("featureId") for target in door_open_camera.get("callouts", {}).get("targets", [])}
                == {"doorLeaf", "openingFrame", "replacementPart"}
                and callouts_visible(door_closed_camera)
                and callouts_visible(door_open_camera)
                and visual_evidence["doorClosed"].get("surfaceFingerprint") != visual_evidence["doorOpen"].get("surfaceFingerprint"),
                {"closed": door_closed_camera, "open": door_open_camera},
            )
            check(
                "window closed/open closeups use one fixed camera and expose frame and sill surfaces",
                visual_evidence["windowClosed"].get("cameraFingerprint") == visual_evidence["windowOpen"].get("cameraFingerprint")
                and window_closed_camera.get("openingState") == "closed"
                and window_open_camera.get("openingState") == "open"
                and max((abs(value) for value in window_closed_camera.get("pivotAnglesRad") or [99]), default=99) <= 1e-5
                and max((abs(value) for value in window_open_camera.get("pivotAnglesRad") or [0]), default=0) >= 0.9
                and window_open_camera.get("surfaceRoleCounts", {}).get("openingFrame", 0) >= 3
                and window_open_camera.get("surfaceRoleCounts", {}).get("openingSill", 0) >= 1
                and window_open_camera.get("surfaceMaterials", {}).get("windowLeaf", {}).get("openingRole") == "windowLeaf"
                and window_open_camera.get("surfaceMaterials", {}).get("openingFrame", {}).get("openingRole") == "openingFrame"
                and window_open_camera.get("surfaceMaterials", {}).get("openingSill", {}).get("openingRole") == "openingSill"
                and window_open_camera.get("surfaceMaterials", {}).get("openingSill", {}).get("channels", {}).get("rainExposure", 0) >= 0.7
                and window_open_camera.get("surfaceMaterials", {}).get("openingSill", {}).get("surfaceFingerprint")
                != window_open_camera.get("surfaceMaterials", {}).get("openingFrame", {}).get("surfaceFingerprint")
                and len({
                    window_open_camera.get("surfaceMaterials", {}).get(role, {}).get("baseColor")
                    for role in ("windowLeaf", "openingFrame", "openingSill")
                }) == 3
                and all(
                    window_open_camera.get("surfaceMaterials", {}).get(role, {}).get("weatheringShaderMode") == "openingTimber"
                    and len(window_open_camera.get("surfaceMaterials", {}).get(role, {}).get("deterministicChannelNames") or []) == 6
                    and compiled_material_ok(window_open_camera.get("surfaceMaterials", {}).get(role, {}), "openingTimber")
                    for role in ("windowLeaf", "openingFrame", "openingSill")
                )
                and {target.get("featureId") for target in window_open_camera.get("callouts", {}).get("targets", [])}
                == {"windowLeaf", "openingFrame", "openingSill"}
                and callouts_visible(window_closed_camera)
                and callouts_visible(window_open_camera)
                and visual_evidence["windowClosed"].get("surfaceFingerprint") != visual_evidence["windowOpen"].get("surfaceFingerprint"),
                {"closed": window_closed_camera, "open": window_open_camera},
            )
            check(
                "door and window closed/open screenshots contain non-flat live first-hit weathering pixels",
                feature_pixels_ok(visual_evidence["doorClosed"].get("featurePixelEvidence") or {}, "doorLeaf")
                and feature_pixels_ok(visual_evidence["doorOpen"].get("featurePixelEvidence") or {}, "doorLeaf")
                and feature_pixels_ok(visual_evidence["windowClosed"].get("featurePixelEvidence") or {}, "windowLeaf")
                and feature_pixels_ok(visual_evidence["windowOpen"].get("featurePixelEvidence") or {}, "windowLeaf"),
                {
                    state: visual_evidence[state].get("featurePixelEvidence")
                    for state in ("doorClosed", "doorOpen", "windowClosed", "windowOpen")
                },
            )
            check(
                "feature closeups use real raking illumination without changing materials",
                visual_evidence["featureLighting"].get("mode") == "raking"
                and visual_evidence["featureLighting"].get("intent")
                == "real-geometry-and-material-raking-light-without-material-mutation"
                and visual_evidence["doorClosed"].get("lightFingerprint")
                == visual_evidence["doorOpen"].get("lightFingerprint")
                and visual_evidence["windowClosed"].get("lightFingerprint")
                == visual_evidence["windowOpen"].get("lightFingerprint")
                and visual_evidence["doorClosed"].get("lightFingerprint")
                != visual_evidence["ab"].get("production", {}).get("lightFingerprint"),
                visual_evidence["featureLighting"],
            )
            page.evaluate("window.__SURFACE_QA__.setQALighting('default')")
            visitor_playback = page.evaluate("window.__SURFACE_QA__.playVisitorRoute(5600)")
            check(
                "route screenshot replays the current live model and surface",
                visitor_playback.get("completed") is True
                and visitor_playback.get("frameCount", 0) >= 36
                and visitor_playback.get("uniquePositionCount", 0) >= 25
                and not visitor_playback.get("frameFailures")
                and visitor_playback.get("captureManifestMatchesCompletion") is True
                and visitor_playback.get("captureRouteMatchesCompletion") is True
                and visitor_playback.get("captureSurfaceMatchesCompletion") is True,
                visitor_playback,
            )
            visual_evidence["routeOverlay"] = page.evaluate("window.__SURFACE_QA__.setQARouteEvidence(true)")
            page.evaluate("window.__SURFACE_QA__.setCamera('qaRoute')")
            page.wait_for_timeout(180)
            visual_evidence["route"] = visual_state(page)
            check(
                "route screenshot overlay uses only actual post-render visitor positions",
                visual_evidence["routeOverlay"].get("evidenceSource") == "actual-rendered-visitor-world-positions"
                and visual_evidence["routeOverlay"].get("capturedAfterProductionRender") is True
                and visual_evidence["routeOverlay"].get("pointCount", 0) >= 36
                and len(visual_evidence["routeOverlay"].get("renderFrameIds") or [])
                == visual_evidence["routeOverlay"].get("pointCount")
                and visual_evidence["routeOverlay"].get("strictlyIncreasingRenderFrameIds") is True
                and str(visual_evidence["routeOverlay"].get(
                    "captureActualStructureManifestFingerprint", ""
                )).startswith("fnv1a32:")
                and visual_evidence["routeOverlay"].get("captureActualStructureManifestFingerprint")
                == visual_evidence["routeOverlay"].get("currentActualStructureManifestFingerprint")
                and visual_evidence["routeOverlay"].get("actualStructureManifestFingerprintMatches") is True
                and visual_evidence["routeOverlay"].get("routeManifestContract")
                == "canonical-live-visitor-route-anchors-supports-stages-and-world-points-v1"
                and visual_evidence["routeOverlay"].get("captureRouteManifestFingerprint")
                == visual_evidence["routeOverlay"].get("currentRouteManifestFingerprint")
                and visual_evidence["routeOverlay"].get("routeManifestFingerprintMatches") is True
                and visual_evidence["routeOverlay"].get("captureRoutePointFingerprint")
                == visual_evidence["routeOverlay"].get("currentRoutePointFingerprint")
                and visual_evidence["routeOverlay"].get("captureRouteAnchorFingerprint")
                == visual_evidence["routeOverlay"].get("currentRouteAnchorFingerprint")
                and visual_evidence["routeOverlay"].get("captureRouteMatchesCompletion") is True
                and visual_evidence["routeOverlay"].get("captureProfileId")
                == visual_evidence["routeOverlay"].get("currentProfileId")
                and visual_evidence["routeOverlay"].get("captureSurfaceFingerprint")
                == visual_evidence["routeOverlay"].get("currentSurfaceFingerprint")
                and visual_evidence["routeOverlay"].get("profileAndSurfaceMatch") is True,
                visual_evidence["routeOverlay"],
            )
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_visitor_entry_to_upper_route.png"), timeout=180_000)
            click_control("#wallOnly", "stair-evidence-roof-cutaway")
            click_control("[data-camera='stair']", "eight-plus-eight-stair-camera")
            page.wait_for_timeout(180)
            visual_evidence["stair"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_stair_8_plus_8.png"), timeout=180_000)
            click_control("#wallOnly", "restore-complete-after-stair-cutaway")
            select_control("wulongWeathered", "roof-weathering-evidence-preset")
            visual_evidence["roofWeatheringLighting"] = page.evaluate("window.__SURFACE_QA__.setQALighting('raking')")
            page.evaluate("window.__SURFACE_QA__.setMode('roofOnly')")
            visual_evidence["roofWeatheringIsolation"] = page.evaluate(
                "window.__SURFACE_QA__.setQARoofIsolation('mainHouseDoublePitch')"
            )
            visual_evidence["roofWeatheringLayerIsolation"] = page.evaluate(
                "window.__SURFACE_QA__.setQARoofLayerIsolation(['panTileCourses','coverTileCourses'])"
            )
            page.evaluate("window.__SURFACE_QA__.setCamera('qaRoofWeathering')")
            page.wait_for_timeout(180)
            visual_evidence["roofWeathering"] = visual_state(page)
            roof_weathering_camera = visual_evidence["roofWeathering"].get("cameraEvidence") or {}
            check(
                "Wulong roof closeup frames real instance-color damage and repair variation",
                visual_evidence["roofWeathering"].get("profileId") == "wulongWeathered"
                and roof_weathering_camera.get("profileId") == "wulongWeathered"
                and roof_weathering_camera.get("instanceColorAttribute") is True
                and roof_weathering_camera.get("materialUsesInstanceColorShaderPath") is True
                and roof_weathering_camera.get("distinctInstanceColorCount", 0) >= 3
                and roof_weathering_camera.get("instanceColorLuminanceRange", 0) >= 0.03
                and roof_weathering_camera.get("brokenTileCount", 0) > 0
                and roof_weathering_camera.get("repairTileCount", 0) > 0
                and roof_weathering_camera.get("missingTileCount", 0) > 0
                and set((roof_weathering_camera.get("featureTiles") or {}).keys()) == {"broken", "repair", "missing"}
                and roof_weathering_camera.get("nonAgedTileCount", 0) >= 2
                and bool(roof_weathering_camera.get("materialPrograms"))
                and all(
                    program.get("mode") == "tile" and compiled_material_ok(program, "tile")
                    for program in roof_weathering_camera.get("materialPrograms") or []
                ),
                roof_weathering_camera,
            )
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_roof_weathering_closeup.png"), timeout=180_000)
            page.evaluate("window.__SURFACE_QA__.setQARoofLayerIsolation(null)")
            page.evaluate("window.__SURFACE_QA__.setQARoofIsolation(null)")
            page.evaluate("window.__SURFACE_QA__.setMode('complete')")
            page.evaluate("window.__SURFACE_QA__.setQALighting('default')")
            executed_phases.append("screenshots")
            context.close()

            # Desktop visual, desktop performance, mobile layout, and mobile
            # performance are four deliberately isolated Chromium processes.
            # No feature tour, screenshot, DPR override, or earlier FPS window
            # can warm or mutate either dedicated performance measurement.
            browser.close()
            browser = None
            browser_holder["browser"] = None

            desktop_performance_launch_token = f"desktop-performance-{time.time_ns()}"
            browser = playwright.chromium.launch(**launch_options)
            browser_holder["browser"] = browser
            desktop_performance_context = browser.new_context(
                viewport={"width": 1440, "height": 1000}, device_scale_factor=1,
            )
            desktop_performance_page = desktop_performance_context.new_page()
            bind_page_diagnostics(desktop_performance_page, "desktop-performance")
            desktop_performance_process_isolation = {
                "contract": "fresh-chromium-process-and-context-per-performance-branch-v1",
                "role": "desktop-performance-only",
                "processOrdinal": 2,
                "freshBrowserLaunch": True,
                "freshContext": True,
                "sharesBrowserWithVisual": False,
                "visualBrowserClosedBeforeLaunch": True,
                "sharesBrowserWithMobileLayout": False,
                "sharesBrowserWithMobilePerformance": False,
                "viewport": {"width": 1440, "height": 1000},
                "deviceScaleFactor": 1,
                "productionPixelRatio": 0.2,
                "launchToken": desktop_performance_launch_token,
                "fpsAttemptCount": 0,
            }
            desktop_performance_started = time.perf_counter()
            desktop_performance_page.goto(
                f"{page_url}&desktopPerformanceBranch={desktop_performance_launch_token}",
                wait_until="load", timeout=180_000,
            )
            desktop_performance_page.wait_for_function(
                "window.__SURFACE_QA__?.ready === true", timeout=180_000,
            )
            # Record navigation-to-ready immediately, before warm-up or any
            # performance evidence wait, so loadMs has the declared meaning.
            desktop_load_seconds = time.perf_counter() - desktop_performance_started
            desktop_performance_resolution = desktop_performance_page.evaluate(
                "window.__SURFACE_QA__.setQACapturePixelRatio(null)"
            )
            desktop_performance_process_isolation[
                "initialResolution"
            ] = desktop_performance_resolution
            desktop_performance_page.evaluate("window.__SURFACE_QA__.reset()")
            desktop_performance_page.evaluate("window.__SURFACE_QA__.setQARouteEvidence(false)")
            desktop_performance_page.locator("[data-camera='overview']").click(timeout=30_000)
            operated_controls.append({
                "control": "desktop-performance:[data-camera='overview']",
                "check": "dedicated-desktop-default-overview",
                "method": "visible-click",
            })
            desktop_performance_page.evaluate(
                "window.__SURFACE_QA__.waitForNextProductionRender()"
            )
            desktop_performance_attempt_count += 1
            desktop_performance_process_isolation[
                "fpsAttemptCount"
            ] = desktop_performance_attempt_count
            desktop_fps_sample = desktop_performance_page.evaluate(
                "window.__SURFACE_QA__.measureProductionFps(6000, 1500)"
            )
            desktop_snapshot = desktop_performance_page.evaluate(
                "window.__SURFACE_QA__.inspect('production')"
            )
            renderer = desktop_snapshot.get("renderer", {})
            check(
                "desktop performance uses one fresh isolated Chromium process and one FPS attempt",
                desktop_performance_process_isolation.get("freshBrowserLaunch") is True
                and desktop_performance_process_isolation.get("freshContext") is True
                and desktop_performance_process_isolation.get("sharesBrowserWithVisual") is False
                and desktop_performance_process_isolation.get(
                    "visualBrowserClosedBeforeLaunch"
                ) is True
                and desktop_performance_attempt_count == 1
                and desktop_performance_process_isolation.get("fpsAttemptCount") == 1
                and desktop_performance_resolution.get("mode") == "default-interactive"
                and abs(desktop_performance_resolution.get("appliedPixelRatio", 0) - 0.2)
                <= 1e-6,
                {
                    "processIsolation": desktop_performance_process_isolation,
                    "attemptCount": desktop_performance_attempt_count,
                },
            )
            check(
                "dedicated desktop process uses the default complete five-span seven-layer state",
                desktop_snapshot.get("profileId") == "museum1940sBalanced"
                and desktop_snapshot.get("completeBuilding") is True
                and desktop_snapshot.get("cutaway") is False
                and desktop_snapshot.get("cameraPresetId") == "overview"
                and desktop_snapshot.get("roofSystem", {}).get("complete") is True
                and len(desktop_snapshot.get("roofSystem", {}).get("buildUp") or []) == 7
                and desktop_snapshot.get("renderQuality", {}).get("profileId")
                == "desktop-closed-shell-5-span"
                and desktop_snapshot.get("renderQuality", {}).get("tileArcSegments") == 5
                and desktop_snapshot.get("renderQuality", {}).get(
                    "closedTileShellsRequired"
                ) is True
                and desktop_snapshot.get("renderQuality", {}).get(
                    "preservesAllSevenRoofLayers"
                ) is True
                and desktop_snapshot.get("renderQuality", {}).get(
                    "preservesWeatheringAndInteractions"
                ) is True,
                {
                    "profileId": desktop_snapshot.get("profileId"),
                    "completeBuilding": desktop_snapshot.get("completeBuilding"),
                    "cutaway": desktop_snapshot.get("cutaway"),
                    "cameraPresetId": desktop_snapshot.get("cameraPresetId"),
                    "roofSystem": desktop_snapshot.get("roofSystem"),
                    "renderQuality": desktop_snapshot.get("renderQuality"),
                },
            )
            desktop_visual_comparison = {
                "visualSeed": desktop_visual_default_snapshot.get(
                    "comparisonContract", {}
                ).get("structuralSeed"),
                "dedicatedSeed": desktop_snapshot.get("comparisonContract", {}).get(
                    "structuralSeed"
                ),
                "visualStructuralFingerprint": desktop_visual_default_snapshot.get(
                    "structuralFingerprint"
                ),
                "dedicatedStructuralFingerprint": desktop_snapshot.get(
                    "structuralFingerprint"
                ),
                "visualManifestFingerprint": desktop_visual_default_snapshot.get(
                    "actualStructureManifestFingerprint"
                ),
                "dedicatedManifestFingerprint": desktop_snapshot.get(
                    "actualStructureManifestFingerprint"
                ),
                "visualSurfaceFingerprint": desktop_visual_default_snapshot.get(
                    "surfaceFingerprint"
                ),
                "dedicatedSurfaceFingerprint": desktop_snapshot.get(
                    "surfaceFingerprint"
                ),
                "visualCompleteBuilding": desktop_visual_default_snapshot.get(
                    "completeBuilding"
                ),
                "dedicatedCompleteBuilding": desktop_snapshot.get("completeBuilding"),
                "visualRenderQuality": desktop_visual_default_snapshot.get("renderQuality"),
                "dedicatedRenderQuality": desktop_snapshot.get("renderQuality"),
                "visualRoofLayerCount": len(
                    desktop_visual_default_snapshot.get("roofSystem", {}).get("buildUp") or []
                ),
                "dedicatedRoofLayerCount": len(
                    desktop_snapshot.get("roofSystem", {}).get("buildUp") or []
                ),
                "visualScene": desktop_visual_default_snapshot.get("stats"),
                "dedicatedScene": desktop_snapshot.get("stats"),
            }
            check(
                "dedicated desktop performance scene exactly matches the visual default scene",
                desktop_visual_comparison.get("visualSeed")
                == desktop_visual_comparison.get("dedicatedSeed")
                and str(desktop_visual_comparison.get(
                    "dedicatedStructuralFingerprint", ""
                )).startswith("fnv1a32:")
                and desktop_visual_comparison.get("visualStructuralFingerprint")
                == desktop_visual_comparison.get("dedicatedStructuralFingerprint")
                and str(desktop_visual_comparison.get(
                    "dedicatedManifestFingerprint", ""
                )).startswith("fnv1a32:")
                and desktop_visual_comparison.get("visualManifestFingerprint")
                == desktop_visual_comparison.get("dedicatedManifestFingerprint")
                and str(desktop_visual_comparison.get(
                    "dedicatedSurfaceFingerprint", ""
                )).startswith("fnv1a32:")
                and desktop_visual_comparison.get("visualSurfaceFingerprint")
                == desktop_visual_comparison.get("dedicatedSurfaceFingerprint")
                and desktop_visual_comparison.get("visualCompleteBuilding") is True
                and desktop_visual_comparison.get("dedicatedCompleteBuilding") is True
                and desktop_visual_comparison.get("visualRenderQuality")
                == desktop_visual_comparison.get("dedicatedRenderQuality")
                and desktop_visual_comparison.get("visualRoofLayerCount") == 7
                and desktop_visual_comparison.get("dedicatedRoofLayerCount") == 7
                and desktop_visual_comparison.get("visualScene")
                == desktop_visual_comparison.get("dedicatedScene"),
                desktop_visual_comparison,
            )
            check("WebGL depth buffer active", renderer.get("depthBits", 0) >= 16, renderer)
            check(
                "dedicated acceptance renderer uses bounded honest performance settings",
                renderer.get("antialias") is False
                and renderer.get("shadowsEnabled") is False
                and renderer.get("sceneMatrixWorldAutoUpdate") is False
                and renderer.get("matrixUpdateContract")
                == "static-world-matrices-cached; explicit-opening-visitor-and-roof-actions-refresh-live-transforms"
                and abs(renderer.get("pixelRatio", 0) - 0.2) <= 1e-6
                and renderer.get("cssWidth", 0) > 0
                and renderer.get("cssHeight", 0) > 0
                and abs(renderer.get("drawingBufferWidth", 0)
                        - round(renderer.get("cssWidth", 0) * 0.2)) <= 1
                and abs(renderer.get("drawingBufferHeight", 0)
                        - round(renderer.get("cssHeight", 0) * 0.2)) <= 1,
                renderer,
            )
            material_programs = desktop_snapshot.get("materialShaderPrograms") or {}
            expected_shader_modes = {"wall", "timber", "tile", "openingTimber"}
            shader_modes = material_programs.get("modes") or {}
            check(
                "live wall, timber, tile and opening materials compile distinct mode-specific shader programs",
                material_programs.get("evidenceSource")
                == "live-render-material-userData-populated-after-actual-onBeforeCompile"
                and set(shader_modes) == expected_shader_modes
                and material_programs.get("keysUniqueAcrossModes") is True
                and all(
                    mode_evidence.get("materialCount", 0) > 0
                    and mode_evidence.get("compiledMaterialCount", 0) > 0
                    and mode_evidence.get("shaderRevisions")
                    == ["v550-r5-sine-free-hash-two-octave-fbm-mode-key-and-instance-world-position"]
                    and mode_evidence.get("programCacheKeys")
                    == [f"v550-r5-sine-free-hash-two-octave-fbm-mode-key-and-instance-world-position:{mode_id}"]
                    and all(
                        compiled.get("mode") == mode_id
                        and compiled.get("revision")
                        == "v550-r5-sine-free-hash-two-octave-fbm-mode-key-and-instance-world-position"
                        and compiled.get("programCacheKey")
                        == f"v550-r5-sine-free-hash-two-octave-fbm-mode-key-and-instance-world-position:{mode_id}"
                        and compiled.get("fragmentHasExpectedModeBranch") is True
                        and compiled.get("fragmentUsesSineFreeHash") is True
                        and compiled.get("fragmentFbmOctaveCount") == 2
                        and compiled.get("vertexHasInstanceWorldTransform") is True
                        and compiled.get("evidenceSource")
                        == "actual-onBeforeCompile-transformed-shader-source"
                        for compiled in mode_evidence.get("compiledEvidence") or []
                    )
                    for mode_id, mode_evidence in shader_modes.items()
                )
                and all(
                    compiled.get("fragmentHasOpeningGrainGroove") is True
                    and compiled.get("fragmentHasOpeningRunoffColumn") is True
                    for compiled in shader_modes.get(
                        "openingTimber", {}
                    ).get("compiledEvidence") or []
                )
                and all(
                    compiled.get("fragmentHasTileBranch") is True
                    for compiled in shader_modes.get("tile", {}).get("compiledEvidence") or []
                ),
                material_programs,
            )
            check(
                "dedicated desktop renderer reports positive geometry counters",
                renderer.get("triangles", 0) > 0
                and renderer.get("drawCalls", 0) > 0
                and renderer.get("meshCount", 0) > 0
                and renderer.get("instanceCount", 0) > 0,
                renderer,
            )
            check(
                "renderer draw calls improve on ba793",
                0 < renderer.get("drawCalls", 0) < 1_154,
                renderer,
            )
            check(
                "tile instancing active",
                renderer.get("instanceCount", 0) > 1000,
                renderer.get("instanceCount"),
            )
            check(
                "dedicated desktop first frame under 30 seconds",
                (desktop_snapshot.get("timings", {}).get("firstFrameMs") or 99_999)
                < 30_000,
                desktop_snapshot.get("timings"),
            )
            check(
                "desktop SwiftShader sustained FPS floor uses one dedicated sample",
                desktop_performance_attempt_count == 1
                and desktop_fps_sample.get("evidenceSource")
                == "production-render-serial-over-requestAnimationFrame-timestamps"
                and desktop_fps_sample.get("warmupMs", 0) >= 1500
                and desktop_fps_sample.get("elapsedMs", 0) >= 6000
                and desktop_fps_sample.get("renderedFrames", 0) >= 30
                and desktop_fps_sample.get("fps", 0) >= 5,
                desktop_fps_sample,
            )
            desktop_performance_context.close()
            browser.close()
            browser = None
            browser_holder["browser"] = None
            desktop_performance_completed = True
            executed_phases.append("desktop-performance")

            layout_launch_token = f"mobile-layout-{time.time_ns()}"
            browser = playwright.chromium.launch(**launch_options)
            browser_holder["browser"] = browser
            layout_context = browser.new_context(
                viewport={"width": 390, "height": 844}, device_scale_factor=1,
            )
            layout_page = layout_context.new_page()
            bind_page_diagnostics(layout_page, "mobile-layout")
            layout_page.goto(
                f"{page_url}&mobileBranch={layout_launch_token}",
                wait_until="load", timeout=180_000,
            )
            layout_page.wait_for_function("window.__SURFACE_QA__?.ready === true", timeout=180_000)
            layout_page.evaluate("window.scrollTo({top: 0, left: 0, behavior: 'instant'})")
            layout_page.wait_for_function("window.scrollY === 0", timeout=30_000)
            visual_evidence["mobileLayoutCaptureResolution"] = layout_page.evaluate(
                "window.__SURFACE_QA__.setQACapturePixelRatio(1)"
            )
            mobile_layout_process_isolation = {
                "contract": "fresh-chromium-process-and-context-per-mobile-branch-v1",
                "role": "layout-only",
                "processOrdinal": 3,
                "freshBrowserLaunch": True,
                "freshContext": True,
                "sharesBrowserWithDesktop": False,
                "sharesBrowserWithPerformance": False,
                "desktopPerformanceBrowserClosedBeforeLaunch": desktop_performance_completed,
                "viewport": {"width": 390, "height": 844},
                "deviceScaleFactor": 1,
                "productionPixelRatio": 1,
                "launchToken": layout_launch_token,
                "closedBeforePerformanceLaunch": False,
            }
            visual_evidence["mobileLayout"] = visual_state(layout_page)
            visual_evidence["mobileLayout"]["processIsolation"] = mobile_layout_process_isolation
            visual_evidence["mobileLayout"]["captureResolution"] = visual_evidence[
                "mobileLayoutCaptureResolution"
            ]
            mobile_layout_path = screenshot_dir / "v550_mobile_regression.png"
            layout_page.screenshot(path=str(mobile_layout_path), full_page=False, timeout=180_000)
            mobile_layout_png = mobile_layout_path.read_bytes()
            mobile_layout_dimensions = struct.unpack(">II", mobile_layout_png[16:24]) if len(mobile_layout_png) >= 24 else (None, None)
            check(
                "fresh DPR-1 mobile top-layout screenshot pixels are exactly 390x844",
                mobile_layout_dimensions == (390, 844)
                and visual_evidence["mobileLayout"].get("viewport") == {"width": 390, "height": 844}
                and abs(visual_evidence["mobileLayout"].get("renderer", {}).get("pixelRatio", 0) - 1) <= 1e-6,
                {"dimensions": mobile_layout_dimensions, "state": visual_evidence["mobileLayout"]},
            )
            mobile_layout_completed = True
            layout_context.close()
            browser.close()
            browser = None
            browser_holder["browser"] = None
            mobile_layout_process_isolation["closedBeforePerformanceLaunch"] = True

            performance_launch_token = f"mobile-performance-{time.time_ns()}"
            browser = playwright.chromium.launch(**launch_options)
            browser_holder["browser"] = browser
            performance_context = browser.new_context(
                viewport={"width": 390, "height": 844}, device_scale_factor=1,
            )
            mobile_page = performance_context.new_page()
            bind_page_diagnostics(mobile_page, "mobile-performance")
            mobile_performance_process_isolation = {
                "contract": "fresh-chromium-process-and-context-per-mobile-branch-v1",
                "role": "visible-production-performance-only",
                "processOrdinal": 4,
                "freshBrowserLaunch": True,
                "freshContext": True,
                "sharesBrowserWithDesktop": False,
                "sharesBrowserWithLayout": False,
                "desktopPerformanceBrowserClosedBeforeLaunch": desktop_performance_completed,
                "layoutBrowserClosedBeforeLaunch": mobile_layout_process_isolation[
                    "closedBeforePerformanceLaunch"
                ],
                "viewport": {"width": 390, "height": 844},
                "deviceScaleFactor": 1,
                "productionPixelRatio": 0.3,
                "launchToken": performance_launch_token,
                "fpsAttemptCount": 1,
            }
            mobile_started = time.perf_counter()
            mobile_page.goto(
                f"{page_url}&mobileBranch={performance_launch_token}",
                wait_until="load", timeout=180_000,
            )
            mobile_page.wait_for_function("window.__SURFACE_QA__?.ready === true", timeout=180_000)
            mobile_load_seconds = time.perf_counter() - mobile_started
            mobile_performance_resolution = mobile_page.evaluate(
                "window.__SURFACE_QA__.setQACapturePixelRatio(null)"
            )
            mobile_performance_process_isolation["initialResolution"] = mobile_performance_resolution
            mobile_page.locator("[data-camera='overview']").click(timeout=30_000)
            operated_controls.append({
                "control": "mobile-performance:[data-camera='overview']",
                "check": "mobile-visible-production-overview", "method": "visible-click",
            })
            mobile_page.evaluate("window.__SURFACE_QA__.setOpeningsProgress(1)")
            mobile_page.evaluate("window.__SURFACE_QA__.setVisitorProgress(1)")
            mobile_page.locator("#production canvas").scroll_into_view_if_needed(timeout=30_000)
            mobile_page.evaluate(
                "document.querySelector('#production canvas').scrollIntoView({block:'center', inline:'nearest'})"
            )
            mobile_page.wait_for_function(
                """() => {
                  const canvas = document.querySelector('#production canvas');
                  if (!canvas) return false;
                  const rect = canvas.getBoundingClientRect();
                  const left = Math.max(0, rect.left);
                  const top = Math.max(0, rect.top);
                  const right = Math.min(window.innerWidth, rect.right);
                  const bottom = Math.min(window.innerHeight, rect.bottom);
                  const intersectionArea = Math.max(0, right - left) * Math.max(0, bottom - top);
                  const area = Math.max(1, rect.width * rect.height);
                  return intersectionArea / area >= 0.90;
                }""",
                timeout=30_000,
            )
            mobile_page.evaluate("window.__SURFACE_QA__.waitForNextProductionRender()")
            mobile_performance_attempt_count += 1
            mobile_fps_sample = mobile_page.evaluate(
                "window.__SURFACE_QA__.measureProductionFps(6000, 1500)"
            )
            mobile_frame_capture = mobile_page.evaluate(
                """async () => {
                  const qa = window.__SURFACE_QA__;
                  const renderEvidence = await qa.waitForNextProductionRender();
                  const canvas = document.querySelector('#production canvas');
                  if (!canvas) throw new Error('Production renderer canvas is missing');
                  const rect = canvas.getBoundingClientRect();
                  const style = getComputedStyle(canvas);
                  const left = Math.max(0, rect.left);
                  const top = Math.max(0, rect.top);
                  const right = Math.min(window.innerWidth, rect.right);
                  const bottom = Math.min(window.innerHeight, rect.bottom);
                  const intersectionArea = Math.max(0, right - left) * Math.max(0, bottom - top);
                  const area = Math.max(1, rect.width * rect.height);
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  const centerHit = document.elementFromPoint(centerX, centerY);
                  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                  if (!gl) throw new Error('Production renderer WebGL context is unavailable');
                  const width = gl.drawingBufferWidth;
                  const height = gl.drawingBufferHeight;
                  const pixels = new Uint8Array(width * height * 4);
                  const priorError = gl.getError();
                  const framebufferBindingWasDefault = gl.getParameter(gl.FRAMEBUFFER_BINDING) === null;
                  const clear = Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE))
                    .map((value) => Math.round(value * 255));
                  gl.finish();
                  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                  const readError = gl.getError();
                  const sums = [0, 0, 0];
                  const squaredSums = [0, 0, 0];
                  let luminanceSum = 0;
                  let luminanceSquaredSum = 0;
                  let nonClearPixelCount = 0;
                  let checksum = 0x811c9dc5;
                  const uniqueColors = new Set();
                  for (let offset = 0; offset < pixels.length; offset += 4) {
                    const red = pixels[offset];
                    const green = pixels[offset + 1];
                    const blue = pixels[offset + 2];
                    const channels = [red, green, blue];
                    for (let channel = 0; channel < 3; channel += 1) {
                      sums[channel] += channels[channel];
                      squaredSums[channel] += channels[channel] * channels[channel];
                    }
                    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
                    luminanceSum += luminance;
                    luminanceSquaredSum += luminance * luminance;
                    if (Math.max(
                      Math.abs(red - clear[0]), Math.abs(green - clear[1]), Math.abs(blue - clear[2]),
                    ) > 2) nonClearPixelCount += 1;
                    uniqueColors.add((red << 16) | (green << 8) | blue);
                    checksum ^= red; checksum = Math.imul(checksum, 0x01000193) >>> 0;
                    checksum ^= green; checksum = Math.imul(checksum, 0x01000193) >>> 0;
                    checksum ^= blue; checksum = Math.imul(checksum, 0x01000193) >>> 0;
                    checksum ^= pixels[offset + 3]; checksum = Math.imul(checksum, 0x01000193) >>> 0;
                  }
                  const sampleCount = width * height;
                  const means = sums.map((value) => value / Math.max(1, sampleCount));
                  const rgbVariance = squaredSums.map((value, channel) => (
                    value / Math.max(1, sampleCount) - means[channel] * means[channel]
                  ));
                  const luminanceMean = luminanceSum / Math.max(1, sampleCount);
                  const luminanceVariance = luminanceSquaredSum / Math.max(1, sampleCount)
                    - luminanceMean * luminanceMean;
                  return {
                    renderEvidence,
                    visibility: {
                      evidenceSource: 'actual-production-renderer-canvas-dom-geometry-and-hit-test',
                      selector: '#production canvas',
                      isConnected: canvas.isConnected,
                      rect: {left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
                             width: rect.width, height: rect.height},
                      cssSize: {width: canvas.clientWidth, height: canvas.clientHeight},
                      viewport: {width: window.innerWidth, height: window.innerHeight},
                      intersectionArea,
                      intersectionRatio: intersectionArea / area,
                      computedStyle: {display: style.display, visibility: style.visibility,
                                      opacity: Number.parseFloat(style.opacity)},
                      center: {x: centerX, y: centerY},
                      centerHitTag: centerHit?.tagName || null,
                      centerHitMatchesCanvas: centerHit === canvas || canvas.contains(centerHit),
                      canvasPixels: {width: canvas.width, height: canvas.height},
                      drawingBuffer: {width, height},
                      devicePixelRatio: window.devicePixelRatio,
                      effectivePixelRatio: {
                        x: canvas.clientWidth ? canvas.width / canvas.clientWidth : null,
                        y: canvas.clientHeight ? canvas.height / canvas.clientHeight : null,
                      },
                    },
                    framebufferEvidence: {
                      evidenceSource: 'same-post-production-render-default-webgl-framebuffer-readPixels',
                      selector: '#production canvas',
                      renderFrameId: renderEvidence.renderFrameId,
                      previousRenderFrameId: renderEvidence.previousRenderFrameId,
                      width, height, sampleCount,
                      rgbaByteCount: pixels.length,
                      framebufferBindingWasDefault,
                      priorError, readError,
                      clearColorRgba8: clear,
                      nonClearPixelCount,
                      nonClearPixelRatio: nonClearPixelCount / Math.max(1, sampleCount),
                      meanRgb: means,
                      rgbVariance,
                      luminanceMean,
                      luminanceVariance,
                      uniqueColorCount: uniqueColors.size,
                      checksum: `fnv1a32:${checksum.toString(16).padStart(8, '0')}:${pixels.length}`,
                    },
                  };
                }"""
            )
            mobile_visibility = mobile_frame_capture.get("visibility") or {}
            mobile_framebuffer_evidence = mobile_frame_capture.get("framebufferEvidence") or {}
            mobile_capture_render_evidence = mobile_frame_capture.get("renderEvidence") or {}
            mobile_snapshot = mobile_page.evaluate("window.__SURFACE_QA__.inspect('production')")
            visual_evidence["mobileProductionPerformance"] = visual_state(
                mobile_page, supplied_render_evidence=mobile_capture_render_evidence,
            )
            visual_evidence["mobileProductionPerformance"]["visibility"] = mobile_visibility
            visual_evidence["mobileProductionPerformance"]["framebufferEvidence"] = mobile_framebuffer_evidence
            visual_evidence["mobileProductionPerformance"]["fpsSample"] = mobile_fps_sample
            visual_evidence["mobileProductionPerformance"]["fpsAttemptCount"] = mobile_performance_attempt_count
            visual_evidence["mobileProductionPerformance"]["measurementContract"] = (
                "one-6000ms-production-render-serial-sample-after-1500ms-warmup-no-retry"
            )
            visual_evidence["mobileProductionPerformance"]["processIsolation"] = mobile_performance_process_isolation
            mobile_fps_display = mobile_page.locator("#quality").inner_text()
            visual_evidence["mobileProductionPerformance"]["fpsDisplayText"] = mobile_fps_display
            mobile_renderer = mobile_snapshot.get("renderer", {})
            check(
                "mobile layout and performance use two closed, fresh, non-shared Chromium processes",
                mobile_layout_completed is True
                and mobile_layout_process_isolation.get("closedBeforePerformanceLaunch") is True
                and mobile_layout_process_isolation.get("processOrdinal") == 3
                and mobile_performance_process_isolation.get("processOrdinal") == 4
                and mobile_layout_process_isolation.get(
                    "desktopPerformanceBrowserClosedBeforeLaunch"
                ) is True
                and mobile_performance_process_isolation.get(
                    "desktopPerformanceBrowserClosedBeforeLaunch"
                ) is True
                and mobile_layout_process_isolation.get("launchToken")
                != mobile_performance_process_isolation.get("launchToken")
                and mobile_layout_process_isolation.get("sharesBrowserWithPerformance") is False
                and mobile_performance_process_isolation.get("sharesBrowserWithLayout") is False
                and mobile_performance_process_isolation.get("layoutBrowserClosedBeforeLaunch") is True
                and mobile_performance_process_isolation.get("initialResolution", {}).get("mode")
                == "default-interactive"
                and abs(mobile_performance_process_isolation.get("initialResolution", {}).get(
                    "appliedPixelRatio", 0
                ) - 0.3) <= 1e-6
                and mobile_performance_attempt_count == 1
                and mobile_performance_process_isolation.get("fpsAttemptCount") == 1,
                {"layout": mobile_layout_process_isolation,
                 "performance": mobile_performance_process_isolation,
                 "attemptCount": mobile_performance_attempt_count},
            )
            check(
                "mobile performance uses the visible live production canvas with honest CSS and drawing-buffer dimensions",
                mobile_visibility.get("evidenceSource")
                == "actual-production-renderer-canvas-dom-geometry-and-hit-test"
                and mobile_visibility.get("selector") == "#production canvas"
                and mobile_visibility.get("isConnected") is True
                and mobile_visibility.get("intersectionRatio", 0) >= 0.90
                and mobile_visibility.get("computedStyle", {}).get("display") != "none"
                and mobile_visibility.get("computedStyle", {}).get("visibility") == "visible"
                and mobile_visibility.get("computedStyle", {}).get("opacity", 0) > 0
                and mobile_visibility.get("centerHitMatchesCanvas") is True
                and mobile_visibility.get("centerHitTag") == "CANVAS"
                and mobile_visibility.get("viewport") == {"width": 390, "height": 844}
                and mobile_visibility.get("cssSize", {}).get("width") == mobile_renderer.get("cssWidth")
                and mobile_visibility.get("cssSize", {}).get("height") == mobile_renderer.get("cssHeight")
                and mobile_visibility.get("canvasPixels", {}).get("width") == mobile_renderer.get("drawingBufferWidth")
                and mobile_visibility.get("canvasPixels", {}).get("height") == mobile_renderer.get("drawingBufferHeight")
                and mobile_visibility.get("drawingBuffer", {}).get("width") == mobile_renderer.get("drawingBufferWidth")
                and mobile_visibility.get("drawingBuffer", {}).get("height") == mobile_renderer.get("drawingBufferHeight")
                and abs(
                    mobile_visibility.get("effectivePixelRatio", {}).get("x", 0)
                    - mobile_renderer.get("pixelRatio", 0)
                ) <= 1 / max(1, mobile_renderer.get("cssWidth", 0))
                and abs(
                    mobile_visibility.get("effectivePixelRatio", {}).get("y", 0)
                    - mobile_renderer.get("pixelRatio", 0)
                ) <= 1 / max(1, mobile_renderer.get("cssHeight", 0)),
                {"visibility": mobile_visibility, "renderer": mobile_renderer},
            )
            check(
                "mobile production framebuffer has same-frame non-clear varied real pixels",
                mobile_framebuffer_evidence.get("evidenceSource")
                == "same-post-production-render-default-webgl-framebuffer-readPixels"
                and mobile_framebuffer_evidence.get("selector") == "#production canvas"
                and mobile_framebuffer_evidence.get("renderFrameId")
                == mobile_capture_render_evidence.get("renderFrameId")
                == visual_evidence["mobileProductionPerformance"].get("renderEvidence", {}).get("renderFrameId")
                and mobile_framebuffer_evidence.get("previousRenderFrameId")
                == mobile_capture_render_evidence.get("previousRenderFrameId")
                and mobile_capture_render_evidence.get("previousRenderFrameId", 0)
                >= mobile_fps_sample.get("endRenderFrameId", 0)
                and mobile_capture_render_evidence.get("renderFrameId", 0)
                > mobile_capture_render_evidence.get("previousRenderFrameId", 0)
                and mobile_framebuffer_evidence.get("width") == mobile_renderer.get("drawingBufferWidth")
                and mobile_framebuffer_evidence.get("height") == mobile_renderer.get("drawingBufferHeight")
                and mobile_framebuffer_evidence.get("sampleCount", 0)
                == mobile_framebuffer_evidence.get("width", 0) * mobile_framebuffer_evidence.get("height", 0)
                and mobile_framebuffer_evidence.get("rgbaByteCount", 0)
                == mobile_framebuffer_evidence.get("sampleCount", 0) * 4
                and mobile_framebuffer_evidence.get("framebufferBindingWasDefault") is True
                and mobile_framebuffer_evidence.get("priorError") == 0
                and mobile_framebuffer_evidence.get("readError") == 0
                and mobile_framebuffer_evidence.get("nonClearPixelRatio", 0) >= 0.05
                and len(mobile_framebuffer_evidence.get("rgbVariance") or []) == 3
                and max(mobile_framebuffer_evidence.get("rgbVariance") or [0]) > 4
                and mobile_framebuffer_evidence.get("luminanceVariance", 0) > 4
                and mobile_framebuffer_evidence.get("uniqueColorCount", 0) >= 32
                and str(mobile_framebuffer_evidence.get("checksum", "")).startswith("fnv1a32:"),
                {"renderEvidence": mobile_capture_render_evidence,
                 "framebufferEvidence": mobile_framebuffer_evidence,
                 "fpsSample": mobile_fps_sample},
            )
            check("mobile complete building", mobile_snapshot.get("completeBuilding") is True and mobile_snapshot.get("roofSystem", {}).get("complete") is True)
            check(
                "mobile opening and visitor regression",
                all(value == 1 for value in mobile_snapshot.get("openings", {}).get("progress", []))
                and mobile_snapshot.get("visitor", {}).get("complete") is True
                and mobile_snapshot.get("visitor", {}).get("wallIntersectionCount") == 0,
                {"openings": mobile_snapshot.get("openings"), "visitor": mobile_snapshot.get("visitor")},
            )
            check("mobile viewport is 390x844", mobile_page.viewport_size == {"width": 390, "height": 844}, mobile_page.viewport_size)
            check(
                "mobile reports honest DPR, CSS viewport and renderbuffer",
                abs(mobile_renderer.get("pixelRatio", 0) - 0.3) <= 1e-6
                and abs(mobile_renderer.get("drawingBufferWidth", 0) - round(mobile_renderer.get("cssWidth", 0) * 0.3)) <= 1
                and abs(mobile_renderer.get("drawingBufferHeight", 0) - round(mobile_renderer.get("cssHeight", 0) * 0.3)) <= 1,
                mobile_renderer,
            )
            check(
                "mobile responsive quality keeps closed shells, seven layers, weathering and interactions",
                mobile_snapshot.get("renderQuality", {}).get("profileId") == "mobile-closed-shell-5-span"
                and mobile_snapshot.get("renderQuality", {}).get("tileArcSegments") == 5
                and mobile_snapshot.get("renderQuality", {}).get("minimumTileArcSegments") == 5
                and mobile_snapshot.get("renderQuality", {}).get("closedTileShellsRequired") is True
                and mobile_snapshot.get("renderQuality", {}).get("preservesAllSevenRoofLayers") is True
                and mobile_snapshot.get("renderQuality", {}).get("preservesWeatheringAndInteractions") is True
                and len(mobile_snapshot.get("roofSystem", {}).get("buildUp") or []) == 7
                and mobile_snapshot.get("openings", {}).get("doorLeafCount", 0) == 2
                and mobile_snapshot.get("visitor") is not None,
                mobile_snapshot.get("renderQuality"),
            )
            check(
                "mobile SwiftShader sustained FPS floor",
                mobile_performance_attempt_count == 1
                and mobile_fps_sample.get("evidenceSource")
                == "production-render-serial-over-requestAnimationFrame-timestamps"
                and mobile_fps_sample.get("elapsedMs", 0) >= 6000
                and mobile_fps_sample.get("warmupMs", 0) >= 1500
                and mobile_fps_sample.get("fps", 0) >= 5
                and mobile_fps_sample.get("renderedFrames", 0) >= 30,
                mobile_fps_sample,
            )
            check(
                "mobile screenshot and runtime display use the exact visible-production FPS sample",
                mobile_snapshot.get("runtimeState", {}).get("sustainedFpsEvidence") == mobile_fps_sample
                and f"Sustained FPS {mobile_fps_sample.get('fps', 0):.1f}" in mobile_fps_display,
                {"sample": mobile_fps_sample, "runtime": mobile_snapshot.get("runtimeState", {}).get("sustainedFpsEvidence"),
                 "display": mobile_fps_display},
            )
            mobile_performance_path = screenshot_dir / "v550_mobile_production_performance.png"
            mobile_page.screenshot(path=str(mobile_performance_path), full_page=False, timeout=180_000)
            mobile_performance_png = mobile_performance_path.read_bytes()
            mobile_performance_dimensions = struct.unpack(">II", mobile_performance_png[16:24]) if len(mobile_performance_png) >= 24 else (None, None)
            check(
                "mobile visible-production screenshot pixels are exactly 390x844",
                mobile_performance_dimensions == (390, 844),
                mobile_performance_dimensions,
            )
            mobile_performance_completed = True
            if mobile_layout_completed and mobile_performance_completed:
                executed_phases.append("mobile")
            performance_context.close()
            browser.close()
            browser = None
            browser_holder["browser"] = None

            check(
                "visual and dedicated desktop navigation-to-ready load times recorded",
                load_seconds > 0
                and isinstance(desktop_load_seconds, (int, float))
                and desktop_load_seconds > 0,
                {
                    "visualLoadSeconds": round(load_seconds, 3),
                    "dedicatedPerformanceLoadSeconds": round(
                        desktop_load_seconds, 3
                    ) if isinstance(desktop_load_seconds, (int, float)) else None,
                },
            )
            required_screenshots = {
                "v550_complete_building.png",
                "v550_ab_same_camera.png",
                "v550_pan_cover_eave_closeup.png",
                "v550_roof_weathering_closeup.png",
                "v550_ridge_closures.png",
                "v550_wall_abutment_closeup.png",
                "v550_roof_exploded_layers.png",
                "v550_wall_weathering_closeup.png",
                "v550_door_closed_closeup.png",
                "v550_door_open_closeup.png",
                "v550_window_closed_closeup.png",
                "v550_window_open_closeup.png",
                "v550_visitor_entry_to_upper_route.png",
                "v550_stair_8_plus_8.png",
                "v550_mobile_regression.png",
                "v550_mobile_production_performance.png",
            }
            generated_screenshots = {path.name for path in screenshot_dir.glob("v550_*.png") if path.stat().st_size > 0}
            check("required visual QA screenshots generated", required_screenshots <= generated_screenshots, sorted(generated_screenshots))
            check(
                "closed and open evidence pixels visibly differ for both door and window",
                hashlib.sha256((screenshot_dir / "v550_door_closed_closeup.png").read_bytes()).digest()
                != hashlib.sha256((screenshot_dir / "v550_door_open_closeup.png").read_bytes()).digest()
                and hashlib.sha256((screenshot_dir / "v550_window_closed_closeup.png").read_bytes()).digest()
                != hashlib.sha256((screenshot_dir / "v550_window_open_closeup.png").read_bytes()).digest(),
            )
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

    check("all required Surface QA phases executed", set(executed_phases) == set(planned_phases), {
        "planned": planned_phases, "executed": executed_phases,
        "notExecuted": [phase for phase in planned_phases if phase not in executed_phases],
    })
    check("browser and server cleanup", not cleanup_errors, cleanup_errors)

    def screenshot_evidence(path: Path) -> dict[str, object]:
        payload = path.read_bytes()
        pixel_evidence = png_pixel_evidence(payload)
        width = pixel_evidence.get("width")
        height = pixel_evidence.get("height")
        screenshot_contracts = {
            "v550_complete_building.png": {"camera": "overview", "state": "complete-building", "checks": ["complete-building-overview"]},
            "v550_ab_same_camera.png": {"camera": "ab", "state": "same-camera-same-seed-ab", "checks": ["same-structure", "same-camera", "same-light", "same-seed", "different-surface"]},
            "v550_pan_cover_eave_closeup.png": {"camera": "eave", "state": "pan-cover-eave-drainage", "checks": ["pan-concavity", "cover-convexity", "seam-cover", "longitudinal-overlap", "drip", "hook", "eave-thickness", "drainage-endpoint", "live-world-projected-callouts"]},
            "v550_roof_weathering_closeup.png": {"camera": "qaRoofWeathering", "state": "wulong-real-instance-color-damage-repair-patch", "checks": ["roof-weathering", "instance-color-variation", "broken-tile", "repair-tile", "missing-tile-neighborhood"]},
            "v550_ridge_closures.png": {"camera": "qaRidge", "state": "ridge-verge-end-closure-isolated-live-ridge-layer", "checks": ["principal-ridge", "diagonal-verge", "end-closure", "explicit-ridge-layer-isolation", "live-world-projected-callouts", "first-hit-visibility"]},
            "v550_wall_abutment_closeup.png": {"camera": "qaAbutment", "state": "east-xiaoxia-ceramic-closure-on-framed-timber-partition", "checks": ["wall-abutment", "live-head-plate-contact", "open-bay", "lower-panel", "lower-and-upper-lattice", "explicit-ridge-layer-isolation", "live-world-projected-callouts", "first-hit-visibility"]},
            "v550_roof_exploded_layers.png": {"camera": "qaExploded", "state": "main-roof-isolated-seven-layer-exploded-1.25m", "checks": ["seven-separated-roof-layers", "main-roof-visibility-isolation", "all-seven-roofs-still-generated"]},
            "v550_wall_weathering_closeup.png": {"camera": "wall", "state": "wall-weathering", "checks": ["wall-weathering"]},
            "v550_door_closed_closeup.png": {"camera": "qaDoor", "state": "door-closed-fixed-camera", "checks": ["door-closed", "door-frame-weathering", "replacement-part-weathering", "live-world-projected-callouts"]},
            "v550_door_open_closeup.png": {"camera": "qaDoor", "state": "door-open-fixed-camera", "checks": ["door-open", "hinge-angle-visible", "door-frame-weathering", "replacement-part-weathering", "live-world-projected-callouts"]},
            "v550_window_closed_closeup.png": {"camera": "qaWindow", "state": "window-closed-fixed-camera", "checks": ["window-closed", "window-frame-weathering", "window-sill-weathering", "live-world-projected-callouts"]},
            "v550_window_open_closeup.png": {"camera": "qaWindow", "state": "window-open-fixed-camera", "checks": ["window-open", "hinge-angle-visible", "window-frame-weathering", "window-sill-weathering", "live-world-projected-callouts"]},
            "v550_visitor_entry_to_upper_route.png": {"camera": "qaRoute", "state": "actual-rendered-route-overlay-entry-to-upper", "checks": ["visitor-gate-to-upper-floor-continuous-path"]},
            "v550_stair_8_plus_8.png": {"camera": "stair", "state": "roof-cutaway-eight-plus-eight-stair", "checks": ["flight-one-eight", "middle-landing", "flight-two-eight", "upper-exit"]},
            "v550_mobile_regression.png": {"camera": "overview", "state": "390x844-mobile-top-layout", "checks": ["mobile-layout-390x844", "responsive-navigation-and-controls"]},
            "v550_mobile_production_performance.png": {"camera": "overview", "state": "390x844-visible-production-performance", "checks": ["mobile-visible-production-canvas", "mobile-fps-at-least-5", "canvas-intersection-at-least-90-percent"]},
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
            "check": (screenshot_contracts.get(path.name) or {}).get("state"),
        }
        visual_keys = {
            "v550_complete_building.png": "complete",
            "v550_ab_same_camera.png": "ab",
            "v550_pan_cover_eave_closeup.png": "eave",
            "v550_roof_weathering_closeup.png": "roofWeathering",
            "v550_ridge_closures.png": "ridge",
            "v550_wall_abutment_closeup.png": "abutment",
            "v550_roof_exploded_layers.png": "exploded",
            "v550_wall_weathering_closeup.png": "wall",
            "v550_door_closed_closeup.png": "doorClosed",
            "v550_door_open_closeup.png": "doorOpen",
            "v550_window_closed_closeup.png": "windowClosed",
            "v550_window_open_closeup.png": "windowOpen",
            "v550_visitor_entry_to_upper_route.png": "route",
            "v550_stair_8_plus_8.png": "stair",
            "v550_mobile_regression.png": "mobileLayout",
            "v550_mobile_production_performance.png": "mobileProductionPerformance",
        }
        if path.name in visual_keys:
            evidence["qaState"] = visual_evidence.get(visual_keys[path.name])
            qa_state = evidence["qaState"] or {}
            if path.name == "v550_ab_same_camera.png":
                qa_state = qa_state.get("production") or {}
            evidence.update({
                "filename": path.name,
                "checks": (evidence.get("captureContract") or {}).get("checks", []),
                "cameraPresetId": qa_state.get("cameraPresetId"),
                "cameraFingerprint": qa_state.get("cameraFingerprint"),
                "camera": {
                    "presetId": qa_state.get("cameraPresetId"),
                    "fingerprint": qa_state.get("cameraFingerprint"),
                    "evidence": qa_state.get("cameraEvidence"),
                },
                "seed": qa_state.get("seed"),
                "structureFingerprint": qa_state.get("structuralFingerprint"),
                "structuralFingerprint": qa_state.get("structuralFingerprint"),
                "actualStructureManifestFingerprint": qa_state.get("actualStructureManifestFingerprint"),
                "actualStructureManifestEvidence": qa_state.get("actualStructureManifestEvidence"),
                "surfaceFingerprint": qa_state.get("surfaceFingerprint"),
                "lightFingerprint": qa_state.get("lightFingerprint"),
                "viewport": qa_state.get("viewport"),
                "renderer": qa_state.get("renderer"),
                "renderQuality": qa_state.get("renderQuality"),
                "renderEvidence": qa_state.get("renderEvidence"),
            })
        if path.name == "v550_visitor_entry_to_upper_route.png":
            evidence["routeOverlayEvidence"] = visual_evidence.get("routeOverlay")
        if path.name == "v550_ab_same_camera.png":
            evidence["abComparison"] = ab_metadata
        if path.name == "v550_mobile_regression.png":
            evidence["processIsolation"] = qa_state.get("processIsolation")
            evidence["captureResolution"] = qa_state.get("captureResolution")
        if path.name == "v550_mobile_production_performance.png":
            evidence["visibility"] = qa_state.get("visibility")
            evidence["framebufferEvidence"] = qa_state.get("framebufferEvidence")
            evidence["fpsSample"] = qa_state.get("fpsSample")
            evidence["fpsAttemptCount"] = qa_state.get("fpsAttemptCount")
            evidence["measurementContract"] = qa_state.get("measurementContract")
            evidence["processIsolation"] = qa_state.get("processIsolation")
        return evidence

    screenshots = [screenshot_evidence(path) for path in sorted(screenshot_dir.glob("v550_*.png")) if path.is_file()]
    check(
        "every Surface screenshot has complete run-scoped QA metadata",
        len(screenshots) >= 16
        and all(
            item.get("filename") == item.get("name")
            and item.get("bytes", 0) > 0
            and len(item.get("sha256", "")) == 64
            and isinstance(item.get("width"), int) and item.get("width", 0) > 0
            and isinstance(item.get("height"), int) and item.get("height", 0) > 0
            and item.get("pngPixelEvidence", {}).get("validPng") is True
            and item.get("pngPixelEvidence", {}).get("nonEmpty") is True
            and item.get("pngPixelEvidence", {}).get("decodeError") is None
            and item.get("pngPixelEvidence", {}).get("nonTransparentPixelCount", 0) > 0
            and item.get("pngPixelEvidence", {}).get("sampledUniqueColorCount", 0) >= 16
            and item.get("camera", {}).get("presetId")
            and item.get("captureContract") is not None
            and item.get("camera", {}).get("presetId") == item.get("captureContract", {}).get("camera")
            and item.get("camera", {}).get("fingerprint")
            and item.get("camera", {}).get("evidence")
            and item.get("seed") is not None
            and str(item.get("structureFingerprint", "")).startswith("fnv1a32:")
            and str(item.get("actualStructureManifestFingerprint", "")).startswith("fnv1a32:")
            and item.get("actualStructureManifestEvidence", {}).get("contract")
            == "canonical-live-structural-renderables-plus-explicit-building-roof-wall-opening-stair-manifest-v3-root-display-name-normalized"
            and item.get("actualStructureManifestEvidence", {}).get("normalizedRootIdentity", {}).get(
                "descendantNamesAndStructuralIdentityRetained"
            ) is True
            and item.get("actualStructureManifestEvidence", {}).get("renderableInstanceCount", 0) > 0
            and str(item.get("actualStructureManifestEvidence", {}).get("recordFingerprint", "")).startswith("fnv1a32:")
            and item.get("actualStructureManifestEvidence", {}).get("manifestFingerprint")
            == item.get("actualStructureManifestFingerprint")
            and item.get("actualStructureManifestEvidence", {}).get("manifest")
            and str(item.get("surfaceFingerprint", "")).startswith("fnv1a32:")
            and str(item.get("lightFingerprint", "")).startswith("fnv1a32:")
            and item.get("viewport", {}).get("width", 0) > 0
            and item.get("viewport", {}).get("height", 0) > 0
            and item.get("renderer", {}).get("pixelRatio", 0) > 0
            and item.get("renderer", {}).get("drawingBufferWidth", 0) > 0
            and item.get("renderer", {}).get("drawingBufferHeight", 0) > 0
            and item.get("renderQuality", {}).get("profileId")
            and item.get("renderQuality", {}).get("closedTileShellsRequired") is True
            and item.get("renderEvidence", {}).get("capturedAfterProductionRender") is True
            and item.get("renderEvidence", {}).get("renderFrameId", 0) > item.get("renderEvidence", {}).get("previousRenderFrameId", 0)
            and (
                item.get("filename") != "v550_mobile_regression.png"
                or (
                    item.get("processIsolation", {}).get("role") == "layout-only"
                    and item.get("processIsolation", {}).get("closedBeforePerformanceLaunch") is True
                    and item.get("captureResolution", {}).get("appliedPixelRatio") == 1
                    and item.get("renderer", {}).get("pixelRatio") == 1
                )
            )
            and (
                item.get("filename") != "v550_mobile_production_performance.png"
                or (
                    item.get("processIsolation", {}).get("role")
                    == "visible-production-performance-only"
                    and item.get("processIsolation", {}).get("fpsAttemptCount") == 1
                    and item.get("fpsAttemptCount") == 1
                    and item.get("measurementContract")
                    == "one-6000ms-production-render-serial-sample-after-1500ms-warmup-no-retry"
                    and item.get("fpsSample", {}).get("elapsedMs", 0) >= 6000
                    and item.get("visibility", {}).get("intersectionRatio", 0) >= 0.90
                    and item.get("framebufferEvidence", {}).get("renderFrameId")
                    == item.get("renderEvidence", {}).get("renderFrameId")
                    and item.get("framebufferEvidence", {}).get("nonClearPixelRatio", 0) >= 0.05
                    and item.get("framebufferEvidence", {}).get("luminanceVariance", 0) > 4
                )
            )
            and item.get("checks")
            for item in screenshots
        ),
        [{key: item.get(key) for key in (
            "filename", "pngPixelEvidence", "camera", "seed", "structureFingerprint",
            "surfaceFingerprint", "viewport", "renderer", "renderEvidence", "checks",
        )} for item in screenshots],
    )

    def performance_after(
        snapshot: dict[str, object] | None,
        fps_sample: dict[str, object] | None,
        initial_load_seconds: float | None,
    ) -> dict[str, object]:
        renderer = (snapshot or {}).get("renderer") or {}
        scene = (snapshot or {}).get("stats") or {}
        timings = (snapshot or {}).get("timings") or {}
        return {
            "triangles": renderer.get("triangles"),
            "sceneTriangles": scene.get("triangleCount"),
            "instances": renderer.get("instanceCount"),
            "drawCalls": renderer.get("drawCalls"),
            "meshes": renderer.get("meshCount"),
            "loadMs": round(initial_load_seconds * 1000, 4) if initial_load_seconds is not None else None,
            "firstFrameMs": timings.get("firstFrameMs"),
            "fps": (fps_sample or {}).get("fps"),
            "fpsSample": fps_sample,
            "timings": timings,
            "renderer": renderer,
            "scene": scene,
            "renderQuality": (snapshot or {}).get("renderQuality"),
        }

    performance_desktop = performance_after(desktop_snapshot, desktop_fps_sample, desktop_load_seconds)
    performance_desktop["attemptCount"] = desktop_performance_attempt_count
    performance_desktop["measurementContract"] = (
        "one-6000ms-production-render-serial-sample-after-1500ms-warmup-no-retry"
    )
    performance_desktop["processIsolation"] = desktop_performance_process_isolation
    performance_desktop["visualDefaultComparison"] = desktop_visual_comparison
    performance_mobile = performance_after(mobile_snapshot, mobile_fps_sample, mobile_load_seconds)
    performance_mobile["visibility"] = mobile_visibility
    performance_mobile["framebufferEvidence"] = mobile_framebuffer_evidence
    performance_mobile["attemptCount"] = mobile_performance_attempt_count
    performance_mobile["measurementContract"] = (
        "one-6000ms-production-render-serial-sample-after-1500ms-warmup-no-retry"
    )
    performance_mobile["processIsolation"] = mobile_performance_process_isolation
    performance_mobile["layoutProcessIsolation"] = mobile_layout_process_isolation

    def performance_delta(before: dict[str, object], after: dict[str, object]) -> dict[str, object]:
        return {
            key: round(float(after[key]) - float(before[key]), 6)
            if PERFORMANCE_COMPARABILITY.get(key) is True
            and isinstance(after.get(key), (int, float)) and isinstance(before.get(key), (int, float)) else None
            for key in ("triangles", "sceneTriangles", "instances", "drawCalls", "meshes", "loadMs", "firstFrameMs", "fps")
        }

    passed = sum(1 for item in results if item["ok"])
    report = {
        "schemaVersion": "5.5.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runSha": run_sha,
        "sourceRef": source_ref,
        "publicMode": public_mode,
        "baseUrl": base_url,
        "page": urljoin(base_url or "", "surface-production-lab.html"),
        "expectedSha": args.expected_sha,
        "buildJson": build_json,
        "deploymentReadiness": deployment_readiness,
        "abComparison": ab_metadata,
        "visitorPlayback": visitor_playback,
        "roofTopologyAudit": roof_topology_audit,
        "visualEvidence": visual_evidence,
        "operatedControls": operated_controls,
        "crossReportVisualEvidence": {
            "report": "production-line-regression.json",
            "artifactScope": "same-workflow-head-and-run",
            "checks": {
                "dali-complete-model": {
                    "file": "screenshots/regression/v550_regression_dali_reference.png",
                    "seed": None,
                    "seedPolicy": "fixed-asset-no-procedural-seed",
                },
                "wulong-complete-model": {
                    "file": "screenshots/regression/v550_regression_wulong_reference.png",
                    "seed": None,
                    "seedPolicy": "fixed-asset-no-procedural-seed",
                },
                "tuanjie-complete-model": {
                    "file": "screenshots/regression/v550_regression_tuanjie_reference.png",
                    "seed": None,
                    "seedPolicy": "fixed-asset-no-procedural-seed",
                },
            },
        },
        "execution": {
            "plannedPhases": planned_phases,
            "executedPhases": executed_phases,
            "notExecutedPhases": [phase for phase in planned_phases if phase not in executed_phases],
            "uncaughtException": uncaught_exception,
        },
        "viewports": {
            "desktop": {
                "width": 1440, "height": 1000, "loadSeconds": desktop_load_seconds,
                "pixelRatio": (desktop_snapshot or {}).get("renderer", {}).get("pixelRatio"),
                "role": "desktop-performance-only",
                "processIsolation": desktop_performance_process_isolation,
                "renderbuffer": {
                    "width": (desktop_snapshot or {}).get("renderer", {}).get("drawingBufferWidth"),
                    "height": (desktop_snapshot or {}).get("renderer", {}).get("drawingBufferHeight"),
                },
            },
            "desktopVisual": {
                "width": 1440, "height": 1000,
                "loadSeconds": desktop_visual_load_seconds,
                "role": "feature-and-screenshot-only-no-fps-sample",
                "pixelRatio": (desktop_visual_default_snapshot or {}).get(
                    "renderer", {}
                ).get("pixelRatio"),
            },
            "mobile": {
                "width": 390, "height": 844, "loadSeconds": mobile_load_seconds,
                "pixelRatio": (mobile_snapshot or {}).get("renderer", {}).get("pixelRatio"),
                "renderbuffer": {
                    "width": (mobile_snapshot or {}).get("renderer", {}).get("drawingBufferWidth"),
                    "height": (mobile_snapshot or {}).get("renderer", {}).get("drawingBufferHeight"),
                },
            },
            "mobileLayout": {
                "width": 390, "height": 844, "pixelRatio": 1,
                "processIsolation": mobile_layout_process_isolation,
            },
            "mobilePerformance": {
                "width": 390, "height": 844, "loadSeconds": mobile_load_seconds,
                "pixelRatio": (mobile_snapshot or {}).get("renderer", {}).get("pixelRatio"),
                "processIsolation": mobile_performance_process_isolation,
                "visibility": mobile_visibility,
                "framebufferEvidence": mobile_framebuffer_evidence,
            },
        },
        "performance": {
            "before": PERFORMANCE_BEFORE,
            "metricDefinitions": {
                "afterGeometry": "renderer.info plus live scene traversal after independent FPS measurement",
                "afterLoadMs": "Python wall clock from navigation start through window.__SURFACE_QA__.ready",
                "afterFirstFrameMs": "performance.now after the first completed production renderer.render minus module boot start",
                "afterFps": "productionRenderSerial delta over an independent 6-second RAF timestamp window after 1.5-second warmup",
                "adaptiveResolution": "default desktop renderer DPR cap is 0.2 and mobile is 0.3; both use five-segment closed tile shells; evidence closeups and mobile layout capture explicitly use DPR 1; mobile CSS viewport is 36vh with a 300px floor",
            },
            "comparability": PERFORMANCE_COMPARABILITY,
            "desktop": performance_desktop,
            "mobile": performance_mobile,
            "after": {"desktop": performance_desktop, "mobile": performance_mobile},
            "delta": {
                "desktop": performance_delta(PERFORMANCE_BEFORE["desktop"], performance_desktop),
                "mobile": performance_delta(PERFORMANCE_BEFORE["mobile"], performance_mobile),
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
