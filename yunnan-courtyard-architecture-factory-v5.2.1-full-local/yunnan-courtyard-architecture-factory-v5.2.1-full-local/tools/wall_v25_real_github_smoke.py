#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import threading
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "data/qa/wall_v25_real_github_push.json"
SCREENSHOT = ROOT / "qa/screenshots/wall_v25_real_github_push.png"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        return


def chrome_executable() -> str | None:
    for candidate in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        value = shutil.which(candidate)
        if value:
            return value
    return None


def make_fixture(path: Path) -> None:
    image = Image.new("RGB", (960, 640), (149, 96, 61))
    draw = ImageDraw.Draw(image)
    for row in range(15):
        y = 26 + row * 36
        offset = 27 if row % 2 else 0
        for column in range(19):
            x = -25 + offset + column * 54
            draw.rounded_rectangle(
                (x, y, x + 49, y + 29),
                radius=6,
                fill=(158 + row % 3 * 4, 103, 67),
                outline=(86, 55, 38),
                width=3,
            )
    draw.rectangle((0, 535, 960, 640), fill=(112, 107, 94))
    image.save(path, quality=94)


def delete_branch(repository: str, branch: str, token: str) -> None:
    encoded = urllib.parse.quote(branch, safe="/")
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}/git/refs/heads/{encoded}",
        method="DELETE",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "HOUSE-wall-v25-real-smoke",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status not in (204,):
                raise RuntimeError(f"unexpected cleanup status {response.status}")
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise


def main() -> None:
    token = os.environ.get("WALL_GITHUB_TOKEN", "").strip()
    repository = os.environ.get("WALL_GITHUB_REPOSITORY", "haihao0307/HOUSE").strip()
    base_branch = os.environ.get("WALL_GITHUB_BASE_BRANCH", "feature/yunnan-component-studio-v1").strip()
    run_id = os.environ.get("WALL_GITHUB_RUN_ID", "local").strip()
    if not token:
        raise RuntimeError("WALL_GITHUB_TOKEN is required for the real GitHub push test")

    branch = f"wall-evidence-ci-{run_id}"
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    fixture = Path("/tmp/wall_v25_real_push_fixture.jpg")
    make_fixture(fixture)

    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/component-studio/wall-lab-v24.html"

    console_errors: list[str] = []
    page_errors: list[str] = []
    result: dict[str, object] | None = None
    cleanup_state = "not-started"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=chrome_executable(),
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--ignore-gpu-blocklist",
                    "--enable-unsafe-swiftshader",
                    "--use-angle=swiftshader",
                ],
            )
            page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.goto(url, wait_until="networkidle", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_GITHUB_BRIDGE__)", timeout=90_000)
            page.set_input_files("#libraryFileInput", str(fixture))
            page.wait_for_function("() => window.__YUNNAN_WALL_LIBRARY_V24__.count >= 1", timeout=30_000)

            page.locator("#githubRepository").fill(repository)
            page.locator("#githubBranch").fill(branch)
            page.locator("#githubBaseBranch").fill(base_branch)
            page.locator("#githubToken").fill(token)
            page.locator("#githubTestButton").click()
            page.wait_for_function(
                "() => document.querySelector('#githubBridgeState')?.textContent === '连接可用'",
                timeout=45_000,
            )

            page.locator("#githubPushButton").click()
            page.wait_for_function(
                "() => window.__YUNNAN_WALL_GITHUB_BRIDGE__.lastResult?.uploadedCount >= 1",
                timeout=120_000,
            )
            result = page.evaluate("() => window.__YUNNAN_WALL_GITHUB_BRIDGE__.lastResult")
            if result.get("mock") is not False:
                raise RuntimeError(f"real push unexpectedly used mock mode: {result}")
            if result.get("repository") != repository or result.get("branch") != branch:
                raise RuntimeError(f"real push targeted the wrong location: {result}")

            page.screenshot(path=str(SCREENSHOT), full_page=False)

            page.locator("#githubToken").fill(token)
            page.once("dialog", lambda dialog: dialog.accept())
            page.locator("#githubCleanupButton").click()
            page.wait_for_function(
                "() => document.querySelector('#githubBridgeState')?.textContent === '已清理'",
                timeout=60_000,
            )
            cleanup_state = "browser-deleted"
            if console_errors or page_errors:
                raise RuntimeError(f"browser errors: console={console_errors}, page={page_errors}")
            browser.close()
    finally:
        try:
            delete_branch(repository, branch, token)
            if cleanup_state == "not-started":
                cleanup_state = "fallback-deleted"
        finally:
            server.shutdown()
            server.server_close()
            fixture.unlink(missing_ok=True)

    REPORT.write_text(
        json.dumps(
            {
                "schemaVersion": "1.0.0",
                "page": "component-studio/wall-lab-v24.html",
                "repository": repository,
                "temporaryBranch": branch,
                "baseBranch": base_branch,
                "pushResult": result,
                "cleanup": cleanup_state,
                "consoleErrors": console_errors,
                "pageErrors": page_errors,
                "passed": True,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
