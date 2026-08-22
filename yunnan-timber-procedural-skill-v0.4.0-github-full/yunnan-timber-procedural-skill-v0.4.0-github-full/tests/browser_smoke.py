from __future__ import annotations
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "tests" / "browser-smoke.png"
RESULT = ROOT / "tests" / "browser-smoke-result.json"

def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])

def wait_http(url: str, timeout: float = 8.0) -> None:
    started = time.time()
    while time.time() - started < timeout:
        try:
            with urllib.request.urlopen(url, timeout=0.5) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError("Local preview server did not become ready")

result = {
    "status": "not-run",
    "rendererReady": False,
    "frameCount": 0,
    "pageErrors": [],
    "consoleErrors": [],
    "screenshot": str(SCREENSHOT)
}

port = free_port()
server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
    cwd=ROOT,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)
url = f"http://127.0.0.1:{port}/preview-standalone.html"

try:
    wait_http(url)
    if importlib.util.find_spec("playwright") is not None:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--ignore-gpu-blocklist",
                    "--enable-webgl",
                    "--use-angle=swiftshader",
                    "--disable-dev-shm-usage"
                ]
            )
            page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
            page.on("pageerror", lambda error: result["pageErrors"].append(str(error)))
            page.on(
                "console",
                lambda message: result["consoleErrors"].append(message.text)
                if message.type == "error" else None
            )
            page.goto(url, wait_until="load", timeout=30000)
            page.wait_for_timeout(3500)
            result["rendererReady"] = bool(page.evaluate("window.__YUNNAN_TIMBER_READY__"))
            result["frameCount"] = int(page.evaluate("window.__YUNNAN_TIMBER_FRAME_COUNT__ || 0"))
            result["runtimeErrors"] = page.evaluate("window.__YUNNAN_TIMBER_ERRORS__ || []")
            error_display = page.locator("#error").evaluate("(el)=>getComputedStyle(el).display")
            result["errorLayerDisplay"] = error_display
            page.screenshot(path=str(SCREENSHOT), full_page=True)
            browser.close()
            result["status"] = (
                "pass"
                if result["rendererReady"]
                and result["frameCount"] >= 3
                and not result["pageErrors"]
                and not result["consoleErrors"]
                and not result.get("runtimeErrors")
                and error_display == "none"
                else "fail"
            )
    else:
        browser_path = next(
            (
                shutil.which(name)
                for name in (
                    "chromium",
                    "chromium-browser",
                    "google-chrome",
                    "google-chrome-stable",
                    "chrome"
                )
                if shutil.which(name)
            ),
            None
        )
        if browser_path:
            command = [
                browser_path,
                "--headless=new",
                "--no-sandbox",
                "--ignore-gpu-blocklist",
                "--enable-webgl",
                "--use-angle=swiftshader",
                "--disable-dev-shm-usage",
                "--hide-scrollbars",
                "--window-size=1440,1000",
                f"--screenshot={SCREENSHOT}",
                url
            ]
            completed = subprocess.run(command, capture_output=True, text=True, timeout=45)
            result["browserPath"] = browser_path
            result["browserReturnCode"] = completed.returncode
            result["browserStderr"] = completed.stderr[-4000:]
            result["status"] = (
                "pass-cli"
                if completed.returncode == 0 and SCREENSHOT.exists() and SCREENSHOT.stat().st_size > 20000
                else "fail"
            )
        else:
            result["status"] = "skipped-no-browser"
finally:
    server.terminate()
    with contextlib.suppress(Exception):
        server.wait(timeout=3)
    RESULT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

if result["status"] in {"fail"}:
    raise SystemExit(1)
