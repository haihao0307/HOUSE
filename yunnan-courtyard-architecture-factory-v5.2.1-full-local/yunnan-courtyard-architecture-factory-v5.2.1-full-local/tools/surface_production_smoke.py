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
    ab_metadata: dict[str, object] | None = None
    visitor_playback: dict[str, object] | None = None
    uncaught_exception: dict[str, object] | None = None
    visual_evidence: dict[str, object] = {}
    planned_phases = ["load", "ab-comparison", "roof-wall", "interactions", "visitor-playback", "screenshots", "mobile"]
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
            page.wait_for_function(
                "window.__SURFACE_QA__.performanceEvidence().sampleCount >= 3",
                timeout=60_000,
            )
            load_seconds = time.perf_counter() - started
            desktop_load_seconds = load_seconds
            executed_phases.append("load")

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
                and 0 < renderer.get("pixelRatio", 0) <= 1.25,
                renderer,
            )
            check("renderer produced geometry", renderer.get("triangles", 0) > 0 and renderer.get("drawCalls", 0) > 0, renderer)
            check("renderer draw calls improve on ba793", 0 < renderer.get("drawCalls", 0) < 1_154, renderer)
            check("tile instancing active", renderer.get("instanceCount", 0) > 1000, renderer.get("instanceCount"))
            check("first frame under 30 seconds", (production.get("timings", {}).get("firstFrameMs") or 99_999) < 30_000, production.get("timings"))
            desktop_fps_evidence = production.get("performanceEvidence") or {}
            check(
                "SwiftShader FPS floor is stable across repeated desktop samples",
                desktop_fps_evidence.get("steadySampleCount", 0) >= 2
                and len(desktop_fps_evidence.get("recentSteadyFps", [])) == 2
                and desktop_fps_evidence.get("stableFps", 0) >= 5
                and all(value >= 5 for value in desktop_fps_evidence.get("recentSteadyFps", [])),
                desktop_fps_evidence,
            )

            page.evaluate("window.__SURFACE_QA__.reset()")
            page.evaluate("window.__SURFACE_QA__.setCamera('overview')")
            visual_evidence["complete"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_complete_building.png"))
            visual_evidence["ab"] = {
                "baseline": visual_state(page, "baseline"),
                "production": visual_state(page, "production"),
            }
            page.screenshot(path=str(screenshot_dir / "v550_ab_same_camera.png"), full_page=True)
            page.evaluate("window.__SURFACE_QA__.setCamera('qaEave')")
            visual_evidence["eave"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_pan_cover_eave_closeup.png"))
            normal_display_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            visual_evidence["ridgeIsolation"] = page.evaluate("window.__SURFACE_QA__.setQADisplayState('ridge')")
            page.evaluate("window.__SURFACE_QA__.setCamera('qaRidge')")
            visual_evidence["ridge"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_ridge_closures.png"))
            page.evaluate("window.__SURFACE_QA__.setCamera('qaWallAbutment')")
            visual_evidence["wallAbutment"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_wall_abutment_closeup.png"))
            visual_evidence["ridgeRestore"] = page.evaluate("window.__SURFACE_QA__.restoreQADisplayState()")
            ridge_restored_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            page.evaluate("window.__SURFACE_QA__.setRoofExploded(true)")
            visual_evidence["explodedIsolation"] = page.evaluate("window.__SURFACE_QA__.setQADisplayState('exploded')")
            page.evaluate("window.__SURFACE_QA__.setCamera('qaExploded')")
            visual_evidence["exploded"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_roof_exploded_layers.png"))
            visual_evidence["explodedRestore"] = page.evaluate("window.__SURFACE_QA__.restoreQADisplayState()")
            page.evaluate("window.__SURFACE_QA__.setRoofExploded(false)")
            exploded_restored_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            page.evaluate("window.__SURFACE_QA__.setCamera('wall')")
            visual_evidence["wall"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_wall_weathering_closeup.png"))
            page.evaluate("window.__SURFACE_QA__.setCamera('qaOpenings')")
            page.evaluate("window.__SURFACE_QA__.setOpeningsProgress(0)")
            visual_evidence["openingsClosed"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_openings_closed.png"))
            page.evaluate("window.__SURFACE_QA__.setOpeningsProgress(1)")
            visual_evidence["openingsOpen"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_openings_open.png"))
            page.evaluate("window.__SURFACE_QA__.setVisitorProgress(1)")
            visual_evidence["routeOverlay"] = page.evaluate("window.__SURFACE_QA__.setQARouteEvidence(true)")
            page.evaluate("window.__SURFACE_QA__.setCamera('qaRoute')")
            visual_evidence["route"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_visitor_entry_to_upper_route.png"))
            stair_normal_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
            visual_evidence["stairIsolation"] = page.evaluate("window.__SURFACE_QA__.setQADisplayState('stair')")
            page.evaluate("window.__SURFACE_QA__.setCamera('qaStair')")
            visual_evidence["stair"] = visual_state(page)
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_stair_8_plus_8.png"))
            visual_evidence["stairRestore"] = page.evaluate("window.__SURFACE_QA__.restoreQADisplayState()")
            stair_restored_fingerprint = page.evaluate("window.__SURFACE_QA__.inspect('production').structuralFingerprint")
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
                and visual_evidence["ridgeIsolation"].get("hiddenObjectCount", 0) > 0
                and visual_evidence["ridgeIsolation"].get("visibleRidgeSemanticCounts", {}).get("wallAbutment", 0) > 0
                and visual_evidence["stairIsolation"].get("hiddenObjectCount") == 1
                and visual_evidence["openingsClosed"].get("openingProgress") == 0
                and visual_evidence["openingsOpen"].get("openingProgress") == 1
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
                and exploded_restored_fingerprint == normal_display_fingerprint
                and stair_restored_fingerprint == stair_normal_fingerprint
                and all(visual_evidence[key].get("restored") is True for key in (
                    "ridgeRestore", "explodedRestore", "stairRestore"
                )),
                {
                    "normal": normal_display_fingerprint, "ridge": ridge_restored_fingerprint,
                    "exploded": exploded_restored_fingerprint, "stairNormal": stair_normal_fingerprint,
                    "stair": stair_restored_fingerprint,
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
                "window.__SURFACE_QA__.performanceEvidence().sampleCount >= 3",
                timeout=60_000,
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
                "mobile SwiftShader FPS floor is stable across repeated samples",
                mobile_fps_evidence.get("steadySampleCount", 0) >= 2
                and len(mobile_fps_evidence.get("recentSteadyFps", [])) == 2
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
        width = height = None
        if len(payload) >= 24 and payload[:8] == b"\x89PNG\r\n\x1a\n":
            width, height = struct.unpack(">II", payload[16:24])
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
            "captureContract": screenshot_contracts.get(path.name),
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
    check(
        "every screenshot has a complete run-time capture contract",
        len(screenshots) == 12
        and all(
            item.get("filename")
            and item.get("check")
            and isinstance(item.get("camera"), dict)
            and item.get("cameraPresetId")
            and item.get("cameraFingerprint")
            and item.get("seed") is not None
            and item.get("structuralFingerprint")
            and item.get("surfaceFingerprint")
            and isinstance(item.get("viewport"), dict)
            for item in screenshots
        ),
        screenshots,
    )
    passed = sum(1 for item in results if item["ok"])
    report = {
        "schemaVersion": "5.5.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runSha": run_sha,
        "page": urljoin(base_url or "", "surface-production-lab.html"),
        "expectedSha": args.expected_sha,
        "abComparison": ab_metadata,
        "visitorPlayback": visitor_playback,
        "visualEvidence": visual_evidence,
        "execution": {
            "plannedPhases": planned_phases,
            "executedPhases": executed_phases,
            "notExecutedPhases": [phase for phase in planned_phases if phase not in executed_phases],
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
