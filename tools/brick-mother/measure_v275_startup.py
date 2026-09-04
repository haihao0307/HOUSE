"""Measure Brick Mother V2.7.5 startup without changing its visual baseline.

The report is written incrementally before optional screenshots so evidence is
retained even when a software-rendered CI screenshot stalls. The measurements
are relative software-WebGL diagnostics, not a hardware GPU benchmark.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import statistics
import sys
import time
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, sync_playwright

BASE = sys.argv[1].rstrip("/")
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
RUNS = int(sys.argv[3]) if len(sys.argv) > 3 else 3
REPORT_PATH = OUT / "v275-startup-baseline.json"
CORE_BLOB = "7b10389cb9367f7423619262820883cc94b07a61"

CASES = [
    {
        "id": "standalone-hero",
        "path": "brick-mother-standalone-v2.7.5.html?mobile=0&profile=old-pbr-fired&solo=1&focus=0",
    },
    {
        "id": "standalone-three-family",
        "path": "brick-mother-standalone-v2.7.5.html?mobile=0&full=1",
    },
    {
        "id": "modular-hero",
        "path": "index.html?mobile=0&profile=old-pbr-fired&solo=1&focus=0",
    },
    {
        "id": "modular-three-family",
        "path": "index.html?mobile=0&full=1",
    },
]

INSTRUMENTATION = r"""
(() => {
  const boot = window.__BM_BOOT_PROFILE__ = {
    scriptStartMs: performance.now(),
    contextCalls: [],
    shaderCompileCount: 0,
    shaderCompileCpuMs: 0,
    programLinkCount: 0,
    programLinkCpuMs: 0,
    firstWebGLContextMs: null,
    firstShaderCompileMs: null,
    firstProgramLinkMs: null,
    firstAnimationFrameMs: null
  };
  requestAnimationFrame(() => { boot.firstAnimationFrameMs = performance.now(); });
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const started = performance.now();
    const context = originalGetContext.call(this, type, ...args);
    const ended = performance.now();
    boot.contextCalls.push({type, durationMs: ended - started, success: !!context});
    if (context && (type === 'webgl2' || type === 'webgl')) {
      if (boot.firstWebGLContextMs === null) boot.firstWebGLContextMs = ended;
      if (!context.__bmProfileWrapped) {
        context.__bmProfileWrapped = true;
        const compileShader = context.compileShader.bind(context);
        context.compileShader = shader => {
          const t0 = performance.now();
          const result = compileShader(shader);
          const t1 = performance.now();
          boot.shaderCompileCount += 1;
          boot.shaderCompileCpuMs += t1 - t0;
          if (boot.firstShaderCompileMs === null) boot.firstShaderCompileMs = t1;
          return result;
        };
        const linkProgram = context.linkProgram.bind(context);
        context.linkProgram = program => {
          const t0 = performance.now();
          const result = linkProgram(program);
          const t1 = performance.now();
          boot.programLinkCount += 1;
          boot.programLinkCpuMs += t1 - t0;
          if (boot.firstProgramLinkMs === null) boot.firstProgramLinkMs = t1;
          return result;
        };
      }
    }
    return context;
  };
})();
"""


def percentile(values: list[float], ratio: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * ratio
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] * (1.0 - fraction) + ordered[upper] * fraction


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    fields = [
        "domContentLoadedMs",
        "loadEventMs",
        "firstPaintMs",
        "firstContentfulPaintMs",
        "firstAnimationFrameMs",
        "firstWebGLContextMs",
        "firstShaderCompileMs",
        "firstProgramLinkMs",
        "readyWallMs",
        "shaderCompileCpuMs",
        "programLinkCpuMs",
        "taskDurationMs",
        "scriptDurationMs",
        "layoutDurationMs",
        "recalcStyleDurationMs",
    ]
    summary: dict[str, Any] = {}
    for field in fields:
        values = [float(row[field]) for row in rows if isinstance(row.get(field), (int, float))]
        if values:
            summary[field] = {
                "median": round(statistics.median(values), 3),
                "p90": round(float(percentile(values, 0.9)), 3),
                "min": round(min(values), 3),
                "max": round(max(values), 3),
            }
    return summary


def persist(report: dict[str, Any]) -> None:
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")


def collect(page: Page, started: float, case: dict[str, str], run_index: int) -> dict[str, Any]:
    response = page.goto(
        f"{BASE}/{case['path']}",
        wait_until="domcontentloaded",
        timeout=60_000,
    )
    dom_wall_ms = (time.monotonic() - started) * 1000.0
    page.wait_for_function(
        "document.documentElement.dataset.brickMotherReady==='true' || document.body.classList.contains('runtime-failed')",
        timeout=180_000,
    )
    ready_wall_ms = (time.monotonic() - started) * 1000.0
    if page.evaluate("document.body.classList.contains('runtime-failed')"):
        fatal = page.locator("#fatal")
        raise AssertionError(fatal.inner_text() if fatal.count() else "Brick Mother runtime failed")
    page.wait_for_timeout(350)

    payload = page.evaluate(
        """() => {
          const nav = performance.getEntriesByType('navigation')[0];
          const paints = Object.fromEntries(performance.getEntriesByType('paint').map(item => [item.name, item.startTime]));
          const resources = performance.getEntriesByType('resource').map(item => ({
            name: item.name.split('/').pop(),
            initiatorType: item.initiatorType,
            startTime: item.startTime,
            responseEnd: item.responseEnd,
            duration: item.duration,
            transferSize: item.transferSize,
            encodedBodySize: item.encodedBodySize,
            decodedBodySize: item.decodedBodySize
          }));
          const qa = window.__BRICK_MOTHER_QA__ || {};
          const boot = window.__BM_BOOT_PROFILE__ || {};
          const canvas = document.querySelector('canvas');
          return {
            nav: nav ? {
              responseEnd: nav.responseEnd,
              domContentLoaded: nav.domContentLoadedEventEnd,
              loadEvent: nav.loadEventEnd,
              transferSize: nav.transferSize,
              encodedBodySize: nav.encodedBodySize,
              decodedBodySize: nav.decodedBodySize
            } : null,
            paints,
            resources,
            boot,
            dataset: {...document.documentElement.dataset},
            batchStats: document.querySelector('#batchStats')?.textContent || '',
            qa: {
              runtimeVersion: qa.version || null,
              profileCount: Array.isArray(qa.profiles) ? qa.profiles.length : null,
              profiles: qa.profiles || [],
              totalTriangles: qa.totalTriangles || null,
              renderMode: qa.renderMode || null
            },
            canvas: canvas ? {
              width: canvas.width,
              height: canvas.height,
              clientWidth: canvas.clientWidth,
              clientHeight: canvas.clientHeight
            } : null
          };
        }"""
    )

    cdp = page.context.new_cdp_session(page)
    cdp.send("Performance.enable")
    cdp_metrics = {
        entry["name"]: entry["value"] * 1000.0
        for entry in cdp.send("Performance.getMetrics")["metrics"]
    }
    cdp.detach()

    nav = payload.get("nav") or {}
    boot = payload.get("boot") or {}
    row: dict[str, Any] = {
        "case": case["id"],
        "run": run_index,
        "httpStatus": response.status if response else None,
        "domWallMs": round(dom_wall_ms, 3),
        "readyWallMs": round(ready_wall_ms, 3),
        "domContentLoadedMs": nav.get("domContentLoaded"),
        "loadEventMs": nav.get("loadEvent"),
        "firstPaintMs": payload.get("paints", {}).get("first-paint"),
        "firstContentfulPaintMs": payload.get("paints", {}).get("first-contentful-paint"),
        "firstAnimationFrameMs": boot.get("firstAnimationFrameMs"),
        "firstWebGLContextMs": boot.get("firstWebGLContextMs"),
        "firstShaderCompileMs": boot.get("firstShaderCompileMs"),
        "firstProgramLinkMs": boot.get("firstProgramLinkMs"),
        "shaderCompileCount": boot.get("shaderCompileCount"),
        "shaderCompileCpuMs": round(float(boot.get("shaderCompileCpuMs", 0.0)), 3),
        "programLinkCount": boot.get("programLinkCount"),
        "programLinkCpuMs": round(float(boot.get("programLinkCpuMs", 0.0)), 3),
        "taskDurationMs": round(float(cdp_metrics.get("TaskDuration", 0.0)), 3),
        "scriptDurationMs": round(float(cdp_metrics.get("ScriptDuration", 0.0)), 3),
        "layoutDurationMs": round(float(cdp_metrics.get("LayoutDuration", 0.0)), 3),
        "recalcStyleDurationMs": round(float(cdp_metrics.get("RecalcStyleDuration", 0.0)), 3),
        "jsHeapUsedBytes": int(cdp_metrics.get("JSHeapUsedSize", 0.0)),
        "documentBytes": nav.get("decodedBodySize"),
        "resourceCount": len(payload.get("resources", [])),
        "resourceBytes": sum(int(item.get("decodedBodySize") or 0) for item in payload.get("resources", [])),
        "dataset": payload.get("dataset", {}),
        "batchStats": payload.get("batchStats"),
        "qa": payload.get("qa"),
        "canvas": payload.get("canvas"),
    }
    if row["httpStatus"] != 200:
        raise AssertionError(f"{case['id']} returned HTTP {row['httpStatus']}")
    if row["dataset"].get("brickMotherReady") != "true":
        raise AssertionError(f"{case['id']} did not set brickMotherReady")
    return row


report: dict[str, Any] = {
    "schemaVersion": "1.0.1",
    "identity": "Brick Mother V2.7.5 startup baseline",
    "baseUrl": BASE,
    "runsPerCase": RUNS,
    "coreBlobExpected": CORE_BLOB,
    "cases": {},
    "environment": {},
    "status": "running",
    "visualApproved": False,
    "productionApproved": False,
}
persist(report)

with sync_playwright() as playwright:
    executable = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("google-chrome-stable")
    if not executable:
        raise RuntimeError("No Chromium-compatible browser executable found")
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
    report["environment"] = {
        "browserExecutable": executable,
        "hardwareGpuBenchmark": False,
        "note": "Software WebGL measurements identify relative startup phases and cannot establish production hardware FPS.",
    }
    persist(report)
    try:
        for case in CASES:
            rows: list[dict[str, Any]] = []
            report["cases"][case["id"]] = {"runs": rows, "summary": {}}
            persist(report)
            for run_index in range(1, RUNS + 1):
                context = browser.new_context(viewport={"width": 1280, "height": 850}, device_scale_factor=1)
                page = context.new_page()
                page.add_init_script(INSTRUMENTATION)
                page_errors: list[str] = []
                page.on("pageerror", lambda error: page_errors.append(str(error)))
                started = time.monotonic()
                try:
                    row = collect(page, started, case, run_index)
                    row["pageErrors"] = page_errors
                    if page_errors:
                        raise AssertionError(page_errors)
                    rows.append(row)
                    report["cases"][case["id"]]["summary"] = summarize(rows)
                    persist(report)

                    screenshot = OUT / f"{case['id']}-run-{run_index}.png"
                    try:
                        page.screenshot(path=str(screenshot), timeout=12_000, animations="disabled")
                        row["screenshot"] = {
                            "file": screenshot.name,
                            "bytes": screenshot.stat().st_size,
                            "sha256": hashlib.sha256(screenshot.read_bytes()).hexdigest(),
                        }
                    except Exception as screenshot_error:
                        row["screenshot"] = {
                            "optional": True,
                            "captured": False,
                            "error": str(screenshot_error),
                        }
                    persist(report)
                finally:
                    context.close()
            report["cases"][case["id"]]["summary"] = summarize(rows)
            persist(report)
    except Exception as error:
        report["status"] = "failed"
        report["failure"] = str(error)
        persist(report)
        raise
    finally:
        browser.close()

report["status"] = "complete"
report["completedCases"] = len(report["cases"])
persist(report)
print(json.dumps({
    "report": str(REPORT_PATH),
    "status": report["status"],
    "cases": {name: data["summary"] for name, data in report["cases"].items()},
}, ensure_ascii=False, indent=2))
