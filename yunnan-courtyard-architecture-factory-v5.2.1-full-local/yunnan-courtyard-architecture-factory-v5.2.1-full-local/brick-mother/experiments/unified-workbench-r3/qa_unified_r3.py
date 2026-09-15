#!/usr/bin/env python3
"""Static and 390x844 browser QA for Brick Mother Unified Workbench R3.

The HTML is intentionally treated as a distributable artifact: the static checks
reject runtime composition, remote assets, and the reference GLB as a dependency.
Browser checks use the page's stable ``window.__BRICK_QA__`` test seam instead of
reaching into private renderer functions.
"""

from __future__ import annotations

import argparse
import contextlib
import functools
import hashlib
import http.server
import json
import re
import sys
import threading
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


HERE = Path(__file__).resolve().parent
DEFAULT_HTML = HERE.parents[1] / "Brick_Mother_Unified_Workbench_R3.html"
EXPECTED_MODES = (
    "single-brick",
    "brick-wall-plaster",
    "stone",
    "earth-wall-plaster",
)
B_DEFAULTS = {
    "strength": 1,
    "scale": 1,
    "heightContribution": 1,
    "roughnessContribution": 0,
}


class ArtifactParser(HTMLParser):
    """Collect tags and asset-bearing attributes without third-party packages."""

    ASSET_ATTRS = {
        "script": ("src",),
        "link": ("href",),
        "img": ("src", "srcset"),
        "source": ("src", "srcset"),
        "video": ("src", "poster"),
        "audio": ("src",),
        "object": ("data",),
        "embed": ("src",),
        "model-viewer": ("src", "ios-src",),
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tags: list[tuple[str, dict[str, str]]] = []
        self.assets: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key.lower(): value or "" for key, value in attrs}
        tag = tag.lower()
        self.tags.append((tag, attr_map))
        for key in self.ASSET_ATTRS.get(tag, ()):
            value = attr_map.get(key, "").strip()
            if value:
                self.assets.append({"tag": tag, "attribute": key, "value": value})


def check(report: dict[str, Any], name: str, passed: bool, evidence: Any) -> None:
    report["checks"][name] = {"passed": bool(passed), "evidence": evidence}


def _number_property(text: str, key: str, expected: float) -> bool:
    pattern = rf"(?:['\"]?{re.escape(key)}['\"]?)\s*:\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))"
    return any(abs(float(value) - expected) < 1e-9 for value in re.findall(pattern, text))


def static_audit(html_path: Path, report: dict[str, Any]) -> str:
    if not html_path.is_file():
        check(report, "html_exists", False, str(html_path))
        return ""

    raw = html_path.read_bytes()
    text = raw.decode("utf-8")
    parser = ArtifactParser()
    parser.feed(text)
    check(report, "html_exists", True, str(html_path))
    report["artifact"].update(
        {
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
        }
    )

    canvas_tags = [attrs for tag, attrs in parser.tags if tag == "canvas"]
    check(report, "one_canvas_in_artifact", len(canvas_tags) == 1, len(canvas_tags))

    mode_values = [attrs.get("data-mode", "") for _, attrs in parser.tags if "data-mode" in attrs]
    mode_counts = {mode: mode_values.count(mode) for mode in EXPECTED_MODES}
    check(
        report,
        "four_exact_modes",
        set(mode_values) == set(EXPECTED_MODES) and all(count == 1 for count in mode_counts.values()),
        {"found": mode_values, "counts": mode_counts, "expected": list(EXPECTED_MODES)},
    )

    runtime_composition = {
        "fetch": bool(re.search(r"\bfetch\s*\(", text)),
        "XMLHttpRequest": bool(re.search(r"\bXMLHttpRequest\b", text)),
        "document.write": bool(re.search(r"\bdocument\s*\.\s*write\s*\(", text)),
        "iframe": any(tag == "iframe" for tag, _ in parser.tags),
        "dynamic_import": bool(re.search(r"\bimport\s*\(", text)),
    }
    check(
        report,
        "no_runtime_composition",
        not any(runtime_composition.values()),
        runtime_composition,
    )

    allowed_embedded_prefixes = ("data:", "blob:", "#")
    external_assets = []
    for asset in parser.assets:
        value = asset["value"]
        if not value.startswith(allowed_embedded_prefixes):
            external_assets.append(asset)
    css_external = re.findall(r"(?:@import\s+|url\s*\(\s*)['\"]?https?://[^)'\"\s]+", text, re.I)
    module_external = re.findall(r"\bfrom\s*['\"]https?://|\bimport\s*['\"]https?://", text)
    check(
        report,
        "no_external_assets",
        not external_assets and not css_external and not module_external,
        {
            "assetAttributes": external_assets,
            "cssReferences": css_external,
            "moduleImports": module_external,
        },
    )

    glb_refs = re.findall(r"[^\s'\"()<>]{0,80}\.glb(?:\?[^\s'\"()<>]*)?", text, re.I)
    check(report, "no_glb_runtime_dependency", not glb_refs, glb_refs)

    frozen_b_match = re.search(
        r"\bFROZEN_B\s*=\s*Object\.freeze\s*\(\s*\{([^}]*)\}\s*\)",
        text,
        re.S,
    )
    frozen_b_source = frozen_b_match.group(1) if frozen_b_match else text
    frozen_aliases = {
        "strength": ("strength",),
        "scale": ("scale",),
        "heightContribution": ("heightContribution", "height"),
        "roughnessContribution": ("roughnessContribution", "roughness"),
    }
    b_found = {
        key: any(_number_property(frozen_b_source, alias, float(value)) for alias in frozen_aliases[key])
        for key, value in B_DEFAULTS.items()
    }
    check(
        report,
        "frozen_b_defaults_embedded",
        all(b_found.values()),
        {
            "expectedPublicSemantics": B_DEFAULTS,
            "found": b_found,
            "source": "FROZEN_B" if frozen_b_match else "artifact-wide fallback",
        },
    )
    check(
        report,
        "qa_api_declared",
        bool(re.search(r"window\s*\.\s*__BRICK_QA__|globalThis\s*\.\s*__BRICK_QA__", text)),
        "window.__BRICK_QA__",
    )
    check(
        report,
        "ready_contract_declared",
        "ready" in text and "setMode" in text and "getState" in text,
        ["ready", "setMode", "getState"],
    )
    return text


@contextlib.contextmanager
def local_server(directory: Path):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_port
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def browser_audit(url: str, report: dict[str, Any]) -> None:
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        report["browser"] = {"status": "skipped", "reason": f"Playwright unavailable: {exc}"}
        return

    browser_errors: list[str] = []
    external_requests: list[str] = []
    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch(
                headless=True,
                args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            )
        except Exception as exc:  # Browser binary may be absent in a lean checkout.
            report["browser"] = {"status": "skipped", "reason": f"Chromium unavailable: {exc}"}
            return

        context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        page = context.new_page()
        host = urlparse(url).hostname

        def record_request(request) -> None:
            parsed = urlparse(request.url)
            if parsed.scheme in ("http", "https") and parsed.hostname != host:
                external_requests.append(request.url)

        page.on("request", record_request)
        page.on("pageerror", lambda error: browser_errors.append(f"pageerror: {error}"))
        page.on(
            "console",
            lambda message: browser_errors.append(f"console: {message.text}")
            if message.type == "error"
            else None,
        )
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            page.wait_for_function(
                """() => {
                    const qa = window.__BRICK_QA__;
                    return !!qa && (qa.ready === true ||
                        (typeof qa.isReady === 'function' && qa.isReady() === true));
                }""",
                timeout=30_000,
            )
        except PlaywrightTimeoutError as exc:
            browser_errors.append(f"readiness timeout: {exc}")

        qa_shape = page.evaluate(
            """() => {
                const qa = window.__BRICK_QA__;
                if (!qa) return null;
                return {
                    ready: qa.ready === true || (typeof qa.isReady === 'function' && qa.isReady()),
                    setMode: typeof qa.setMode === 'function',
                    getState: typeof qa.getState === 'function',
                    getGeometryAudit: typeof qa.getGeometryAudit === 'function',
                    getResourceAudit: typeof qa.getResourceAudit === 'function'
                };
            }"""
        )
        check(
            report,
            "browser_qa_api_ready",
            bool(qa_shape and qa_shape["ready"] and qa_shape["setMode"] and qa_shape["getState"]),
            qa_shape,
        )

        canvas_info = page.evaluate(
            """() => {
                const canvases = [...document.querySelectorAll('canvas')];
                const canvas = canvases[0];
                if (!canvas) return {count: 0};
                const r = canvas.getBoundingClientRect();
                return {
                    count: canvases.length,
                    cssWidth: r.width,
                    cssHeight: r.height,
                    backingWidth: canvas.width,
                    backingHeight: canvas.height,
                    backingPixels: canvas.width * canvas.height,
                    readyAttr: canvas.dataset.ready || null,
                    visible: r.width > 0 && r.height > 0
                };
            }"""
        )
        check(report, "browser_one_visible_canvas", canvas_info.get("count") == 1 and canvas_info.get("visible"), canvas_info)
        check(report, "mobile_canvas_height", canvas_info.get("cssHeight", 0) >= 360, canvas_info.get("cssHeight"))
        check(report, "mobile_backing_pixel_budget", canvas_info.get("backingPixels", 10**12) <= 520_000, canvas_info)

        layout = page.evaluate(
            """() => ({
                innerWidth,
                innerHeight,
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
                modeControls: [...document.querySelectorAll('[data-mode]')].map(el => {
                    const r = el.getBoundingClientRect();
                    return {mode: el.dataset.mode, width: r.width, height: r.height};
                })
            })"""
        )
        check(report, "mobile_no_horizontal_overflow", layout["scrollWidth"] <= layout["innerWidth"], layout)
        check(
            report,
            "mobile_mode_targets_44px",
            len(layout["modeControls"]) == 4
            and all(item["width"] >= 44 and item["height"] >= 44 for item in layout["modeControls"]),
            layout["modeControls"],
        )

        mode_results: dict[str, Any] = {}
        if qa_shape and qa_shape.get("setMode") and qa_shape.get("getState"):
            for mode in EXPECTED_MODES:
                mode_results[mode] = page.evaluate(
                    """async mode => {
                        const qa = window.__BRICK_QA__;
                        await qa.setMode(mode);
                        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                        const state = qa.getState();
                        return {state, activeMode: state.activeMode || state.mode || null};
                    }""",
                    mode,
                )
        check(
            report,
            "browser_four_modes_switch",
            len(mode_results) == 4 and all(result.get("activeMode") == mode for mode, result in mode_results.items()),
            mode_results,
        )

        b_state = page.evaluate(
            """() => {
                const qa = window.__BRICK_QA__;
                if (!qa || typeof qa.getState !== 'function') return null;
                const state = qa.getState();
                return state.B || state.bDefaults || state.microscope || null;
            }"""
        )
        b_runtime_ok = bool(b_state) and all(float(b_state.get(key, float("nan"))) == value for key, value in B_DEFAULTS.items())
        check(report, "browser_frozen_b_defaults", b_runtime_ok, {"expected": B_DEFAULTS, "actual": b_state})

        geometry_audit = None
        resource_audit = None
        if qa_shape and qa_shape.get("getGeometryAudit"):
            geometry_audit = page.evaluate("() => window.__BRICK_QA__.getGeometryAudit()")
        if qa_shape and qa_shape.get("getResourceAudit"):
            resource_audit = page.evaluate("() => window.__BRICK_QA__.getResourceAudit()")
        report["browser"] = {
            "status": "completed",
            "viewport": {"width": 390, "height": 844, "deviceScaleFactor": 1},
            "qaShape": qa_shape,
            "geometryAudit": geometry_audit,
            "resourceAudit": resource_audit,
            "errors": browser_errors,
            "externalRequests": external_requests,
        }
        check(report, "browser_no_errors", not browser_errors, browser_errors)
        check(report, "browser_no_external_requests", not external_requests, external_requests)
        browser.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, default=DEFAULT_HTML, help="R3 HTML artifact")
    parser.add_argument("--url", help="Optional fixed public/local URL for browser QA")
    parser.add_argument("--out", type=Path, default=HERE / "QA_REPORT.json")
    parser.add_argument("--static-only", action="store_true", help="Skip Playwright smoke test")
    parser.add_argument(
        "--require-browser",
        action="store_true",
        help="Treat a missing Playwright/Chromium runtime as a failure",
    )
    args = parser.parse_args()
    html_path = args.html.resolve()
    report: dict[str, Any] = {
        "schemaVersion": "brick-mother-unified-qa-r3.1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "artifact": {"path": str(html_path)},
        "checks": {},
        "browser": {"status": "not-run"},
        "passed": False,
        "humanVisualApproval": False,
        "note": "Automated technical QA only; visual acceptance remains with the user.",
    }
    static_audit(html_path, report)

    if html_path.is_file() and not args.static_only:
        if args.url:
            browser_audit(args.url, report)
        else:
            with local_server(html_path.parent) as port:
                browser_audit(f"http://127.0.0.1:{port}/{html_path.name}", report)

    browser_skipped = report["browser"].get("status") == "skipped"
    if args.require_browser and browser_skipped:
        check(report, "browser_runtime_available", False, report["browser"].get("reason"))
    report["passed"] = bool(report["checks"]) and all(
        item["passed"] for item in report["checks"].values()
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
