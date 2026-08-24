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
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "data/qa/yunnan_surface_production_smoke_v5_5_0.json"
DEFAULT_SCREENSHOTS = ROOT / "qa/screenshots"

EXPECTED_ROOFS = {
    "mainHouseDoublePitch",
    "leftEarAsymmetricDoublePitch",
    "rightEarAsymmetricDoublePitch",
    "entranceBlockDoublePitch",
    "mainGalleryLeanTo",
    "sideGalleryLeanTo",
    "gatehouseSmallRoof",
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
    browser = None
    desktop_snapshot: dict[str, object] | None = None
    mobile_snapshot: dict[str, object] | None = None
    desktop_load_seconds: float | None = None
    mobile_load_seconds: float | None = None

    def check(name: str, condition: object, detail: object = None) -> None:
        results.append({"name": name, "ok": bool(condition), "detail": detail})

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
        page_url = urljoin(base_url, "surface-production-lab.html")
        allowed_origin = urlparse(base_url).netloc

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
            page.wait_for_timeout(2200)
            load_seconds = time.perf_counter() - started
            desktop_load_seconds = load_seconds

            if args.expected_sha:
                build_url = urljoin(base_url, "build.json")
                deployed = None
                for _ in range(20):
                    response = page.request.get(build_url)
                    if response.ok:
                        deployed = response.json()
                        if deployed.get("sha") == args.expected_sha:
                            break
                    page.wait_for_timeout(1500)
                check("Pages deployed SHA", deployed and deployed.get("sha") == args.expected_sha, deployed)

            page.evaluate("window.__SURFACE_QA__.setCamera('ab')")
            baseline = page.evaluate("window.__SURFACE_QA__.inspect('baseline')")
            production = page.evaluate("window.__SURFACE_QA__.inspect('production')")
            desktop_snapshot = production
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
                "exact V5.4.4 generator and materials execute as a complete frozen runtime",
                frozen_runtime.get("executable") is True
                and frozen_runtime.get("evidenceSource") == "executed-exact-v544-git-blob-modules"
                and frozen_runtime.get("sourceCommit") == "323a893a791b1d064a1591dcbd2063f2f6a172c1"
                and frozen_runtime.get("generatorBlobSha") == "7b254beeffde1325329101b50784e694249081bd"
                and frozen_runtime.get("materialBlobSha") == "d16baad4ff18c5a9e97f7796f9e68d45cd6f9ff9"
                and str(frozen_runtime.get("structuralFingerprint", "")).startswith("fnv1a32:")
                and frozen_runtime.get("stats", {}).get("meshCount", 0) > 100
                and frozen_runtime.get("stats", {}).get("triangleCount", 0) > 1000
                and len(frozen_runtime.get("worldBounds", [])) == 6,
                frozen_runtime,
            )
            check(
                "A/B baseline canvas executes the exact frozen runtime",
                baseline.get("displayedRuntimeFingerprint") == frozen_runtime.get("surfaceFingerprint"),
                {"displayed": baseline.get("displayedRuntimeFingerprint"), "frozen": frozen_runtime.get("surfaceFingerprint")},
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
            check("pan-cover topology and drainage", slope_checks and all(slope_checks), {"slopes": len(slope_checks), "failed": slope_checks.count(False)})
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
            playback = page.evaluate("window.__SURFACE_QA__.playVisitorRoute(3200)")
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
                and playback.get("frameCount", 0) >= 30
                and playback.get("uniquePositionCount", 0) >= 25
                and len(playback.get("stages", [])) >= 6
                and visitor.get("browserPlayback", {}).get("completed") is True,
                playback,
            )
            check(
                "visitor route uses raycast and world-bound evidence",
                visitor.get("evidenceSource") == "raycaster-plus-world-bounds"
                and visitor.get("routeSampleCount", 0) >= 193
                and visitor.get("maximumSupportGapM", 1) <= 0.03
                and visitor.get("maximumRequestedSupportGapM", 1) <= 0.20
                and visitor.get("maximumAnchorSupportGapM", 1) <= 0.001
                and visitor.get("unsupportedAnchorCount") == 0
                and visitor.get("mismatchedAnchorSupportCount") == 0
                and len(visitor.get("auditedStages", [])) >= 6
                and len(visitor.get("auditedSupportIds", [])) >= 6,
                visitor,
            )

            renderer = production.get("renderer", {})
            check("WebGL depth buffer active", renderer.get("depthBits", 0) >= 16, renderer)
            check(
                "acceptance renderer uses bounded honest performance settings",
                renderer.get("antialias") is False
                and renderer.get("shadowsEnabled") is False
                and 0 < renderer.get("pixelRatio", 0) <= 1.25,
                renderer,
            )
            check("renderer produced geometry", renderer.get("triangles", 0) > 0 and renderer.get("drawCalls", 0) > 0, renderer)
            check("tile instancing active", renderer.get("instanceCount", 0) > 1000, renderer.get("instanceCount"))
            check("first frame under 30 seconds", (production.get("timings", {}).get("firstFrameMs") or 99_999) < 30_000, production.get("timings"))
            check("SwiftShader FPS floor", production.get("fps", 0) >= 5, production.get("fps"))

            page.evaluate("window.__SURFACE_QA__.reset()")
            page.evaluate("window.__SURFACE_QA__.setCamera('overview')")
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_complete_building.png"))
            page.screenshot(path=str(screenshot_dir / "v550_ab_same_camera.png"), full_page=True)
            page.evaluate("window.__SURFACE_QA__.setCamera('eave')")
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_pan_cover_eave_closeup.png"))
            page.evaluate("window.__SURFACE_QA__.setRoofExploded(true)")
            page.evaluate("window.__SURFACE_QA__.setCamera('roof')")
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_roof_exploded_layers.png"))
            page.evaluate("window.__SURFACE_QA__.setRoofExploded(false)")
            page.evaluate("window.__SURFACE_QA__.setCamera('wall')")
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_wall_weathering_closeup.png"))
            page.evaluate("window.__SURFACE_QA__.setOpeningsProgress(1)")
            page.evaluate("window.__SURFACE_QA__.playVisitorRoute(1800)")
            page.evaluate("window.__SURFACE_QA__.setCamera('stair')")
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_entry_door_stair_route.png"))

            mobile = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
            mobile_page = mobile.new_page()
            mobile_page.on("pageerror", lambda exc: page_errors.append(f"mobile: {exc}"))
            mobile_page.on("console", lambda msg: console_errors.append(f"mobile: {msg.text}") if msg.type == "error" else None)
            mobile_page.on("requestfailed", lambda request: failed_requests.append(f"mobile: {request.method} {request.url}: {request.failure}"))
            mobile_page.on("response", capture_response)
            mobile_started = time.perf_counter()
            mobile_page.goto(page_url, wait_until="load", timeout=180_000)
            mobile_page.wait_for_function("window.__SURFACE_QA__?.ready === true", timeout=180_000)
            mobile_page.wait_for_timeout(800)
            mobile_load_seconds = time.perf_counter() - mobile_started
            mobile_page.evaluate("window.__SURFACE_QA__.setOpeningsProgress(1)")
            mobile_page.evaluate("window.__SURFACE_QA__.playVisitorRoute(1600)")
            mobile_snapshot = mobile_page.evaluate("window.__SURFACE_QA__.inspect('production')")
            check("mobile complete building", mobile_snapshot.get("completeBuilding") is True and mobile_snapshot.get("roofSystem", {}).get("complete") is True)
            check(
                "mobile opening and visitor regression",
                all(value == 1 for value in mobile_snapshot.get("openings", {}).get("progress", []))
                and mobile_snapshot.get("visitor", {}).get("complete") is True
                and mobile_snapshot.get("visitor", {}).get("wallIntersectionCount") == 0,
                {"openings": mobile_snapshot.get("openings"), "visitor": mobile_snapshot.get("visitor")},
            )
            check("mobile viewport is 390x844", mobile_page.viewport_size == {"width": 390, "height": 844}, mobile_page.viewport_size)
            mobile_page.screenshot(path=str(screenshot_dir / "v550_mobile_regression.png"), full_page=True)
            mobile.close()
            context.close()
            browser.close()
            browser = None

            check("page load time recorded", load_seconds > 0, round(load_seconds, 3))
            required_screenshots = {
                "v550_complete_building.png",
                "v550_ab_same_camera.png",
                "v550_pan_cover_eave_closeup.png",
                "v550_roof_exploded_layers.png",
                "v550_wall_weathering_closeup.png",
                "v550_entry_door_stair_route.png",
                "v550_mobile_regression.png",
            }
            generated_screenshots = {path.name for path in screenshot_dir.glob("v550_*.png") if path.stat().st_size > 0}
            check("six QA classes plus mobile screenshot generated", required_screenshots <= generated_screenshots, sorted(generated_screenshots))
            check("no console errors", not console_errors, console_errors)
            check("no page errors", not page_errors, page_errors)
            check("no failed requests", not failed_requests, failed_requests)
            check("no HTTP 4xx or 5xx", not http_errors, http_errors)
            check("no external runtime requests", not external_requests, external_requests)
    except Exception as exc:
        check("uncaught test exception", False, f"{type(exc).__name__}: {exc}")
    finally:
        if browser is not None:
            try:
                browser.close()
            except Exception as exc:
                cleanup_errors.append(f"browser.close: {type(exc).__name__}: {exc}")
        if server is not None:
            try:
                server.shutdown()
                server.server_close()
            except Exception as exc:
                cleanup_errors.append(f"server.close: {type(exc).__name__}: {exc}")

    check("browser and server cleanup", not cleanup_errors, cleanup_errors)

    def screenshot_evidence(path: Path) -> dict[str, object]:
        payload = path.read_bytes()
        width = height = None
        if len(payload) >= 24 and payload[:8] == b"\x89PNG\r\n\x1a\n":
            width, height = struct.unpack(">II", payload[16:24])
        return {
            "name": path.name,
            "bytes": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
            "width": width,
            "height": height,
        }

    screenshots = [screenshot_evidence(path) for path in sorted(screenshot_dir.glob("v550_*.png")) if path.is_file()]
    passed = sum(1 for item in results if item["ok"])
    report = {
        "schemaVersion": "5.5.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runSha": run_sha,
        "page": urljoin(base_url or "", "surface-production-lab.html"),
        "expectedSha": args.expected_sha,
        "viewports": {
            "desktop": {"width": 1440, "height": 1000, "loadSeconds": desktop_load_seconds},
            "mobile": {"width": 390, "height": 844, "loadSeconds": mobile_load_seconds},
        },
        "performance": {
            "desktop": {
                "renderer": (desktop_snapshot or {}).get("renderer"),
                "scene": (desktop_snapshot or {}).get("stats"),
                "fps": (desktop_snapshot or {}).get("fps"),
                "timings": (desktop_snapshot or {}).get("timings"),
            },
            "mobile": {
                "renderer": (mobile_snapshot or {}).get("renderer"),
                "scene": (mobile_snapshot or {}).get("stats"),
                "fps": (mobile_snapshot or {}).get("fps"),
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
