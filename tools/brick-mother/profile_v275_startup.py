"""Profile the frozen Brick Mother V2.7.5 without changing its visual output.

This records navigation, first canvas, readiness signals and browser errors. Headless
CI results are engineering timing evidence only and are never labelled as hardware
GPU performance.
"""
from __future__ import annotations

import json
import shutil
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
TARGET = f"{BASE}/brick-mother-standalone-v2.7.5.html"

report = {
    "target": TARGET,
    "coreVersion": "2.7.5",
    "preservedCoreBlob": "7b10389cb9367f7423619262820883cc94b07a61",
    "hardwareGpuBenchmark": False,
    "visualApproved": False,
    "productionApproved": False,
    "runs": [],
}


def snapshot(page):
    return page.evaluate(
        """() => {
          const root = document.documentElement;
          const body = document.body;
          const nav = performance.getEntriesByType('navigation')[0];
          const paints = Object.fromEntries(performance.getEntriesByType('paint').map(x => [x.name, x.startTime]));
          const canvas = document.querySelector('canvas');
          return {
            rootDataset: {...root.dataset},
            bodyDataset: body ? {...body.dataset} : {},
            navigation: nav ? {
              domInteractive: nav.domInteractive,
              domContentLoaded: nav.domContentLoadedEventEnd,
              loadEventEnd: nav.loadEventEnd,
              transferSize: nav.transferSize,
              decodedBodySize: nav.decodedBodySize
            } : null,
            paints,
            canvas: canvas ? {width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight} : null,
            loadingVisible: (() => {
              const node = document.querySelector('#loading,.loading,[data-loading]');
              if (!node) return null;
              const style = getComputedStyle(node);
              return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01;
            })(),
            runtimeFailure: root.dataset.runtimeFailure === 'true' || body?.dataset.runtimeFailure === 'true'
          };
        }"""
    )


with sync_playwright() as pw:
    executable = shutil.which("google-chrome") or shutil.which("google-chrome-stable") or shutil.which("chromium")
    if not executable:
        raise RuntimeError("No Chromium executable found")
    browser = pw.chromium.launch(
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
    cases = [
        ("desktop-cold", {"width": 1440, "height": 1000}, False),
        ("desktop-repeat", {"width": 1440, "height": 1000}, False),
        ("mobile-cold", {"width": 390, "height": 844}, True),
    ]
    context = None
    try:
        for index, (name, viewport, mobile) in enumerate(cases):
            if context is None or name.endswith("cold"):
                if context is not None:
                    context.close()
                context = browser.new_context(
                    viewport=viewport,
                    device_scale_factor=1,
                    is_mobile=mobile,
                    has_touch=mobile,
                )
            else:
                page0 = context.pages[0] if context.pages else None
                if page0:
                    page0.close()
            page = context.new_page()
            errors = []
            console_errors = []
            page.on("pageerror", lambda error, bucket=errors: bucket.append(str(error)))
            page.on(
                "console",
                lambda message, bucket=console_errors: bucket.append(message.text)
                if message.type == "error"
                else None,
            )
            started = time.monotonic()
            response = page.goto(f"{TARGET}?profile={name}-{time.time_ns()}", wait_until="domcontentloaded", timeout=90000)
            dom_ms = round((time.monotonic() - started) * 1000)
            page.wait_for_selector("canvas", state="attached", timeout=90000)
            canvas_ms = round((time.monotonic() - started) * 1000)
            readiness = "canvas-attached"
            try:
                page.wait_for_function(
                    """() => {
                      const r=document.documentElement.dataset,b=document.body?.dataset||{};
                      if(r.runtimeFailure==='true'||b.runtimeFailure==='true') return true;
                      return r.workbenchReady==='true'||r.visualReady==='true'||b.workbenchReady==='true'||b.visualReady==='true';
                    }""",
                    timeout=90000,
                )
                readiness = "dataset-ready-or-failure"
            except Exception:
                page.wait_for_timeout(2500)
                readiness = "canvas-settled-fallback"
            ready_ms = round((time.monotonic() - started) * 1000)
            state = snapshot(page)
            screenshot = OUT / f"{name}.png"
            page.screenshot(path=str(screenshot))
            item = {
                "name": name,
                "viewport": viewport,
                "mobile": mobile,
                "httpStatus": response.status if response else None,
                "contentType": response.headers.get("content-type", "") if response else "",
                "domContentLoadedObservedMs": dom_ms,
                "firstCanvasObservedMs": canvas_ms,
                "readyObservedMs": ready_ms,
                "readinessMethod": readiness,
                "pageErrors": errors,
                "consoleErrors": console_errors,
                "state": state,
                "screenshotBytes": screenshot.stat().st_size,
            }
            report["runs"].append(item)
            (OUT / "startup-profile.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
            if not response or response.status != 200:
                raise RuntimeError(f"{name}: HTTP response failed")
            if state["runtimeFailure"]:
                raise RuntimeError(f"{name}: runtime failure flag set")
            if errors:
                raise RuntimeError(f"{name}: page errors: {errors}")
            page.close()
    finally:
        if context is not None:
            context.close()
        browser.close()

report["passed"] = True
(OUT / "startup-profile.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(report, ensure_ascii=False, indent=2))
