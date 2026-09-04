"""Verify that Brick Mother opens the frozen V2.7.5 core by default.

Screenshots are optional evidence. A software-rendered screenshot timeout cannot
turn a valid runtime check into a deployment failure.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
EXPECTED_RUNTIME = "2.7.5-alpha.1"
EXPECTED_ENTRY = "brick-mother-standalone-v2.7.5.html"

report = {
    "schemaVersion": "1.0.0",
    "baseUrl": BASE,
    "canonicalEntry": EXPECTED_ENTRY,
    "runtime": EXPECTED_RUNTIME,
    "checks": [],
    "errors": [],
    "screenshot": None,
    "humanVisualApproved": False,
    "productionApproved": False,
}


def check(name: str, value: bool, details=None) -> None:
    report["checks"].append({"name": name, "passed": bool(value), "details": details})
    (OUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if not value:
        raise AssertionError((name, details))


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
    page = browser.new_page(viewport={"width": 1280, "height": 850}, device_scale_factor=1)
    page.on("pageerror", lambda error: report["errors"].append(str(error)))
    try:
        response = page.goto(f"{BASE}/workbench.html", wait_until="domcontentloaded", timeout=60_000)
        check("workbench HTTP 200", bool(response) and response.status == 200, response.status if response else None)
        page.wait_for_function(
            "document.documentElement.dataset.brickMotherWorkbenchReady==='true'",
            timeout=30_000,
        )
        check("core is default section", page.evaluate("document.documentElement.dataset.activeWorkbench") == "core")
        check("canonical entry identity", page.evaluate("document.documentElement.dataset.canonicalEntry") == EXPECTED_ENTRY)
        check("core panel visible", page.locator("#core").evaluate("node=>node.classList.contains('on')"))
        check("PBR candidate not loaded at startup", not page.locator("#weathering iframe").evaluate("node=>node.hasAttribute('src')"))
        page.wait_for_function(
            "document.querySelector('#core iframe').contentDocument?.documentElement?.dataset.brickMotherReady==='true'",
            timeout=180_000,
        )
        runtime = page.locator("#core iframe").evaluate("node=>node.contentWindow.__BRICK_MOTHER_QA__.version")
        check("frozen core runtime", runtime == EXPECTED_RUNTIME, runtime)
        check("no page errors", not report["errors"], report["errors"])

        screenshot = OUT / "canonical-workbench.png"
        try:
            page.screenshot(path=str(screenshot), timeout=10_000, animations="disabled")
            report["screenshot"] = {
                "captured": True,
                "file": screenshot.name,
                "bytes": screenshot.stat().st_size,
            }
        except Exception as screenshot_error:
            report["screenshot"] = {
                "captured": False,
                "optional": True,
                "error": str(screenshot_error),
            }
    except Exception as error:
        report["failure"] = str(error)
        raise
    finally:
        report["passed"] = not report.get("failure") and all(item["passed"] for item in report["checks"])
        (OUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        browser.close()

print(json.dumps({
    "passed": report["passed"],
    "canonicalEntry": report["canonicalEntry"],
    "runtime": report["runtime"],
    "screenshotCaptured": bool(report["screenshot"] and report["screenshot"].get("captured")),
}, ensure_ascii=False))
