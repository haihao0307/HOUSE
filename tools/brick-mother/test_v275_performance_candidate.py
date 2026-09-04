"""Review the additive V2.7.5 on-demand rendering candidate.

The test compares frozen and candidate canvas pixels in deterministic evidence
mode, then confirms that the candidate stops drawing while idle and resumes for
interaction and auto-rotation.
"""

from __future__ import annotations

import base64
import hashlib
import json
import shutil
import sys
import time
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import Page, sync_playwright

BASE = sys.argv[1].rstrip("/")
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
BASE_FILE = "brick-mother-standalone-v2.7.5.html"
CANDIDATE_FILE = "brick-mother-standalone-v2.7.5-perf.html"

report = {
    "schemaVersion": "1.0.0",
    "baseUrl": BASE,
    "baselineRuntime": "2.7.5-alpha.1",
    "candidateRuntime": "2.7.5-perf.1",
    "checks": [],
    "errors": [],
    "visualApproved": False,
    "productionApproved": False,
}


def save_report() -> None:
    (OUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")


def check(name: str, value: bool, details=None) -> None:
    report["checks"].append({"name": name, "passed": bool(value), "details": details})
    save_report()
    if not value:
        raise AssertionError((name, details))


def decode_canvas(page: Page, output: Path) -> bytes:
    encoded = page.locator("canvas").evaluate("canvas=>canvas.toDataURL('image/png')")
    data = base64.b64decode(encoded.split(",", 1)[1])
    output.write_bytes(data)
    return data


def wait_ready(page: Page) -> None:
    page.wait_for_function(
        "document.documentElement.dataset.brickMotherReady==='true' || document.body.classList.contains('runtime-failed')",
        timeout=180_000,
    )
    failed = page.evaluate("document.body.classList.contains('runtime-failed')")
    check("runtime healthy", not failed, page.locator("#fatal").inner_text() if failed else None)


with sync_playwright() as playwright:
    executable = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("google-chrome-stable")
    check("browser executable available", bool(executable), executable)
    browser = playwright.chromium.launch(
        executable_path=executable,
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--enable-unsafe-swiftshader",
            "--use-gl=angle",
            "--use-angle=swiftshader",
        ],
    )
    try:
        evidence_query = "?mobile=0&profile=old-pbr-fired&solo=1&focus=0&evidence=1&evidenceQuality=.55"
        images = {}
        runtime_expectations = {
            BASE_FILE: "2.7.5-alpha.1",
            CANDIDATE_FILE: "2.7.5-perf.1",
        }
        for file_name, output_name in ((BASE_FILE, "baseline.png"), (CANDIDATE_FILE, "candidate.png")):
            context = browser.new_context(viewport={"width": 800, "height": 500}, device_scale_factor=1)
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            response = page.goto(f"{BASE}/{file_name}{evidence_query}", wait_until="domcontentloaded", timeout=60_000)
            check(f"{file_name} HTTP 200", bool(response) and response.status == 200, response.status if response else None)
            wait_ready(page)
            page.wait_for_timeout(1_000)
            runtime = page.evaluate("window.__BRICK_MOTHER_QA__.version")
            check(f"{file_name} runtime identity", runtime == runtime_expectations[file_name], runtime)
            check(f"{file_name} page errors empty", not errors, errors)
            image_data = decode_canvas(page, OUT / output_name)
            check(f"{file_name} canvas captured", len(image_data) > 25_000, len(image_data))
            images[file_name] = image_data
            context.close()

        baseline_image = Image.open(OUT / "baseline.png").convert("RGBA")
        candidate_image = Image.open(OUT / "candidate.png").convert("RGBA")
        check("canvas dimensions unchanged", baseline_image.size == candidate_image.size, [baseline_image.size, candidate_image.size])
        difference = ImageChops.difference(baseline_image, candidate_image)
        pixel_equal = difference.getbbox() is None
        diff_path = OUT / "pixel-difference.png"
        difference.save(diff_path)
        check(
            "same-seed material pixels unchanged",
            pixel_equal,
            {
                "baselineSha256": hashlib.sha256(images[BASE_FILE]).hexdigest(),
                "candidateSha256": hashlib.sha256(images[CANDIDATE_FILE]).hexdigest(),
            },
        )

        context = browser.new_context(viewport={"width": 1000, "height": 700}, device_scale_factor=1)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        started = time.monotonic()
        response = page.goto(
            f"{BASE}/{CANDIDATE_FILE}?mobile=0&profile=old-pbr-fired&solo=1&focus=0",
            wait_until="domcontentloaded",
            timeout=60_000,
        )
        check("interactive candidate HTTP 200", bool(response) and response.status == 200, response.status if response else None)
        wait_ready(page)
        report["candidateReadyWallMs"] = round((time.monotonic() - started) * 1000.0, 3)
        check("interactive candidate runtime", page.evaluate("window.__BRICK_MOTHER_QA__.version") == "2.7.5-perf.1")
        check("performance candidate stamped", page.evaluate("document.documentElement.dataset.performanceCandidate") == "on-demand-render")

        page.wait_for_timeout(700)
        idle_start = page.evaluate("Number(document.documentElement.dataset.renderCount||0)")
        page.wait_for_timeout(1_200)
        idle_end = page.evaluate("Number(document.documentElement.dataset.renderCount||0)")
        check("idle rendering stops", idle_end - idle_start <= 1, {"start": idle_start, "end": idle_end})

        page.mouse.move(420, 360)
        page.mouse.down()
        page.mouse.move(560, 395, steps=12)
        page.mouse.up()
        page.wait_for_timeout(450)
        drag_count = page.evaluate("Number(document.documentElement.dataset.renderCount||0)")
        check("orbit interaction redraws", drag_count > idle_end, {"before": idle_end, "after": drag_count})

        page.click("#autoRotate")
        page.wait_for_timeout(1_200)
        rotating_count = page.evaluate("Number(document.documentElement.dataset.renderCount||0)")
        check("auto rotation redraws continuously", rotating_count - drag_count >= 2, {"before": drag_count, "after": rotating_count})
        page.click("#autoRotate")
        page.wait_for_timeout(450)
        stopped_count = page.evaluate("Number(document.documentElement.dataset.renderCount||0)")
        page.wait_for_timeout(1_000)
        stopped_idle_count = page.evaluate("Number(document.documentElement.dataset.renderCount||0)")
        check("rendering stops after auto rotation", stopped_idle_count - stopped_count <= 1, {"start": stopped_count, "end": stopped_idle_count})
        check("interactive page errors empty", not errors, errors)
        report["renderCounts"] = {
            "idleStart": idle_start,
            "idleEnd": idle_end,
            "afterDrag": drag_count,
            "duringAutoRotate": rotating_count,
            "afterStop": stopped_count,
            "afterStopIdle": stopped_idle_count,
        }
        context.close()
    except Exception as error:
        report["failure"] = str(error)
        raise
    finally:
        report["passed"] = not report.get("failure") and all(item["passed"] for item in report["checks"])
        save_report()
        browser.close()

print(json.dumps({
    "passed": report["passed"],
    "candidateReadyWallMs": report.get("candidateReadyWallMs"),
    "renderCounts": report.get("renderCounts"),
}, ensure_ascii=False, indent=2))
