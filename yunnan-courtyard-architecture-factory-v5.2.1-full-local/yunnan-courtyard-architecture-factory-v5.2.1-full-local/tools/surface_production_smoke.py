#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="V5.5.0 surface-production browser QA")
    parser.add_argument("--base-url", help="Public Pages root. Defaults to a local ephemeral server.")
    parser.add_argument("--expected-sha", help="Require build.json to expose this deployed commit.")
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--screenshots", type=Path, default=DEFAULT_SCREENSHOTS)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report_path = args.report if args.report.is_absolute() else ROOT / args.report
    screenshot_dir = args.screenshots if args.screenshots.is_absolute() else ROOT / args.screenshots
    report_path.parent.mkdir(parents=True, exist_ok=True)
    screenshot_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict[str, object]] = []
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []
    http_errors: list[dict[str, object]] = []
    external_requests: list[str] = []
    server: ThreadingHTTPServer | None = None
    base_url = args.base_url
    browser = None

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

        with sync_playwright() as playwright:
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
            check("runtime version", production.get("version") == "5.5.0", production.get("version"))
            check("complete A/B buildings", baseline.get("completeBuilding") and production.get("completeBuilding"))
            check("same structural fingerprint", baseline.get("structuralFingerprint") == production.get("structuralFingerprint"))
            check("same camera fingerprint", baseline.get("cameraFingerprint") == production.get("cameraFingerprint"))
            check("same light fingerprint", baseline.get("lightFingerprint") == production.get("lightFingerprint"))
            check("different surface fingerprint", baseline.get("surfaceFingerprint") != production.get("surfaceFingerprint"))

            roofs = production.get("roofUnits", [])
            roof_ids = {roof.get("roofUnitId") for roof in roofs}
            check("seven exact roof unit IDs", roof_ids == EXPECTED_ROOFS, sorted(roof_ids))
            check("roof registry complete", production.get("roofSystem", {}).get("complete") is True, production.get("roofSystem"))
            check("all roof units contain renderable geometry", all(roof.get("actualRenderableCount", 0) > 0 and roof.get("bboxVolume", 0) > 0.01 for roof in roofs))
            check(
                "all seven build-up layers contain geometry",
                all(all(roof.get("layerCounts", {}).get(layer, 0) > 0 for layer in EXPECTED_ROOF_LAYERS) for roof in roofs),
                {roof.get("roofUnitId"): roof.get("layerCounts") for roof in roofs},
            )
            slope_checks: list[bool] = []
            for roof in roofs:
                for slope in roof.get("slopes", []):
                    slope_checks.append(
                        slope.get("coverColumns") == slope.get("panColumns", 0) - 1
                        and slope.get("coverBridgesPanSeams") is True
                        and abs(slope.get("coverCourseOffsetM", 1)) <= 1e-8
                        and slope.get("seamAlignmentMaxErrorM", 1) <= 1e-6
                        and slope.get("dripCount") == slope.get("panColumns")
                        and slope.get("hookCount") == slope.get("coverColumns")
                        and slope.get("panConcavity") == "up"
                        and slope.get("coverConvexity") == "up"
                        and slope.get("drainagePathCount") == slope.get("panColumns")
                        and slope.get("drainagePathsMonotonic") is True
                        and slope.get("drainagePathsEndAtEave") is True
                        and slope.get("tileBatchesAreInstanced") is True
                        and slope.get("longitudinalOverlapM", 0) > 0
                    )
            check("pan-cover topology and drainage", slope_checks and all(slope_checks), {"slopes": len(slope_checks), "failed": slope_checks.count(False)})
            check("roof height hierarchy", len({round(roof.get("ridgeElevationM", 0), 2) for roof in roofs}) >= 4)
            check("clustered missing or broken tiles", sum(roof.get("damage", {}).get("missingTiles", 0) + roof.get("damage", {}).get("brokenTiles", 0) for roof in roofs) >= 4)
            check("bounded repair tile patches", sum(roof.get("repairs", {}).get("tiles", 0) for roof in roofs) >= 4)

            walls = production.get("walls") or {}
            check("wall hosts generated", walls.get("hostCount", 0) >= 5, walls.get("hostCount"))
            check("all wall material and history layers visible", all(walls.get("layerCounts", {}).get(layer, 0) > 0 for layer in EXPECTED_WALL_LAYERS), walls.get("layerCounts"))
            damp = walls.get("dampSamples", {})
            check("rising damp decays upward", damp.get("bottom", 0) > damp.get("middle", 0) > damp.get("top", 0), damp)
            check("rain follows gravity", walls.get("physics", {}).get("minRainGravityDot", 0) >= 0.95, walls.get("physics"))
            check("eave shelter changes rain", walls.get("physics", {}).get("shelteredRainMean", 1) < walls.get("physics", {}).get("exposedRainMean", 0), walls.get("physics"))
            check("stone plinth has thickness", walls.get("plinthThicknessM", 0) > 0)
            check("brick corners have thickness", walls.get("cornerProtectionThicknessM", 0) > 0)

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
            check("continuous stair handrails", stair.get("continuousHandrails") is True)
            check("stair rise is 2.73 m", abs(stair.get("totalRiseM", 0) - 2.73) <= 0.01)
            openings_closed = page.evaluate("window.__SURFACE_QA__.inspect('production').openings")
            page.evaluate("window.__SURFACE_QA__.setOpeningsProgress(1)")
            openings_open = page.evaluate("window.__SURFACE_QA__.inspect('production').openings")
            check("door and window pivots exist", openings_open.get("doorLeafCount", 0) == 2 and openings_open.get("windowLeafCount", 0) >= 4, openings_open)
            check("door and window states changed", openings_closed.get("progress") != openings_open.get("progress") and all(value == 1 for value in openings_open.get("progress", [])))
            page.evaluate("window.__SURFACE_QA__.setVisitorProgress(1)")
            visitor = page.evaluate("window.__SURFACE_QA__.inspect('production').visitor")
            check("visitor completes entry route", visitor.get("complete") and visitor.get("reachedUpperFloor"), visitor)
            check("visitor reaches 2.73 m relative floor", abs(visitor.get("relativeUpperFloorM", 0) - 2.73) <= 0.01, visitor)
            check("visitor regression counters clear", visitor.get("wallIntersectionCount") == 0 and visitor.get("suspendedFrameCount") == 0 and visitor.get("stuckFrameCount") == 0, visitor)

            renderer = production.get("renderer", {})
            check("WebGL depth buffer active", renderer.get("depthBits", 0) >= 16, renderer)
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
            page.evaluate("window.__SURFACE_QA__.setVisitorProgress(1)")
            page.evaluate("window.__SURFACE_QA__.setCamera('stair')")
            page.locator("#production").screenshot(path=str(screenshot_dir / "v550_entry_door_stair_route.png"))

            mobile = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
            mobile_page = mobile.new_page()
            mobile_page.on("pageerror", lambda exc: page_errors.append(f"mobile: {exc}"))
            mobile_page.on("console", lambda msg: console_errors.append(f"mobile: {msg.text}") if msg.type == "error" else None)
            mobile_page.goto(page_url, wait_until="load", timeout=180_000)
            mobile_page.wait_for_function("window.__SURFACE_QA__?.ready === true", timeout=180_000)
            mobile_page.wait_for_timeout(800)
            mobile_snapshot = mobile_page.evaluate("window.__SURFACE_QA__.inspect('production')")
            check("mobile complete building", mobile_snapshot.get("completeBuilding") is True and mobile_snapshot.get("roofSystem", {}).get("complete") is True)
            mobile_page.screenshot(path=str(screenshot_dir / "v550_mobile_regression.png"), full_page=True)
            mobile.close()
            context.close()
            browser.close()
            browser = None

            check("page load time recorded", load_seconds > 0, round(load_seconds, 3))
            check("no console errors", not console_errors, console_errors)
            check("no page errors", not page_errors, page_errors)
            check("no failed requests", not failed_requests, failed_requests)
            check("no HTTP 4xx or 5xx", not http_errors, http_errors)
            check("no external runtime requests", not external_requests, external_requests)
    except Exception as exc:
        check("uncaught test exception", False, f"{type(exc).__name__}: {exc}")
    finally:
        if browser is not None:
            browser.close()
        if server is not None:
            server.shutdown()
            server.server_close()

    passed = sum(1 for item in results if item["ok"])
    report = {
        "schemaVersion": "5.5.0",
        "page": urljoin(base_url or "", "surface-production-lab.html"),
        "expectedSha": args.expected_sha,
        "results": results,
        "diagnostics": {
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "failedRequests": failed_requests,
            "httpErrors": http_errors,
            "externalRequests": external_requests,
        },
        "summary": {"passed": passed, "failed": len(results) - passed, "total": len(results)},
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    print(f"Report: {report_path}")
    return 0 if report["summary"]["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
