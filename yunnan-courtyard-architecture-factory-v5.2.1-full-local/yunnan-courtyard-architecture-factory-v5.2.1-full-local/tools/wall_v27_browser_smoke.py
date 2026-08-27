#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import statistics
import threading
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "qa/screenshots/wall_v27_browser.png"
REPORT = ROOT / "data/qa/wall_v27_browser.json"
REFERENCE_COUNT = 36


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        return

    def do_GET(self) -> None:  # noqa: N802
        if self.path.partition("?")[0] == "/__idb_fixture__.html":
            body = (
                b"<!doctype html><meta charset=utf-8><link rel=icon href=data:,>"
                b"<title>IndexedDB fixture</title>"
            )
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def chrome_executable() -> str | None:
    for candidate in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        value = shutil.which(candidate)
        if value:
            return value
    return None


def make_reference_fixture(path: Path, index: int) -> None:
    base = (132 + index % 9 * 5, 82 + index % 7 * 4, 52 + index % 5 * 3)
    image = Image.new("RGB", (320, 210), base)
    draw = ImageDraw.Draw(image)
    for row in range(6):
        y = 12 + row * 29
        offset = 21 if row % 2 else 0
        for column in range(8):
            x = -18 + offset + column * 45
            fill = (151 + (index + row) % 5 * 4, 98 + column % 3 * 4, 63 + index % 4 * 3)
            draw.rounded_rectangle((x, y, x + 41, y + 22), radius=4, fill=fill, outline=(80, 50, 34), width=2)
    for hole in range(3):
        x = 60 + (index * 37 + hole * 79) % 230
        y = 35 + (index * 23 + hole * 47) % 110
        radius = 7 + (index + hole) % 8
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(64, 39, 27))
    draw.rectangle((0, 178, 320, 210), fill=(104 + index % 6 * 3, 100, 88))
    draw.text((8, 186), f"WALL REF {index + 1:02d}", fill=(238, 226, 202))
    image.save(path, quality=90)


def assert_migration(browser, origin: str) -> dict[str, object]:
    context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = context.new_page()
    page.goto(f"{origin}/__idb_fixture__.html", wait_until="domcontentloaded", timeout=30_000)
    fixture = page.evaluate(
        """async () => {
          const remove = (name) => new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error(`failed to clear ${name}`));
          });
          const create = (name, storeName, keyPath, record) => new Promise((resolve, reject) => {
            const request = indexedDB.open(name, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath }).put(record);
            request.onsuccess = () => { request.result.close(); resolve(1); };
            request.onerror = () => reject(request.error);
          });
          await remove('YunnanComponentStudio');
          await remove('YunnanWallStudioV2');
          const attachmentBytes = new Uint8Array([11, 22, 33, 44, 55, 66]);
          const previewBytes = new Uint8Array([91, 82, 73, 64]);
          await create('YunnanComponentStudio', 'attachments', 'id', {
            id: 'legacy-attachment', moduleId: 'walls', name: 'legacy-wall.jpg',
            type: 'image/jpeg', size: attachmentBytes.byteLength,
            sha256: 'sha256-legacy-wall-evidence', createdAt: '2026-08-25T00:00:00.000Z',
            blob: new Blob([attachmentBytes], { type: 'image/jpeg' })
          });
          await create('YunnanWallStudioV2', 'previews', 'attachmentId', {
            attachmentId: 'legacy-attachment', blob: new Blob([previewBytes], { type: 'image/jpeg' })
          });
          return true;
        }"""
    )
    if fixture is not True:
        raise RuntimeError("failed to seed legacy IndexedDB fixture")

    page.goto(f"{origin}/component-studio/wall-lab-v24.html?githubMock=1", wait_until="networkidle", timeout=90_000)
    page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_LIBRARY_V24__)", timeout=90_000)
    migration = page.evaluate(
        """async () => {
          const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
          const attachmentsDb = await storage.openAttachments();
          const previewsDb = await storage.openPreviews();
          const read = (db, storeName, key) => new Promise((resolve, reject) => {
            const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
          });
          const attachment = await read(attachmentsDb, 'attachments', 'legacy-attachment');
          const preview = await read(previewsDb, 'previews', 'legacy-attachment');
          const bytes = async (blob) => Array.from(new Uint8Array(await blob.arrayBuffer()));
          return {
            attachmentsVersion: attachmentsDb.version,
            previewsVersion: previewsDb.version,
            moduleIndex: attachmentsDb.transaction('attachments', 'readonly').objectStore('attachments').indexNames.contains('moduleId'),
            attachmentSha256: attachment.sha256,
            attachmentBytes: await bytes(attachment.blob),
            previewBytes: await bytes(preview.blob)
          };
        }"""
    )
    expected = {
        "attachmentsVersion": 2,
        "previewsVersion": 2,
        "moduleIndex": True,
        "attachmentSha256": "sha256-legacy-wall-evidence",
        "attachmentBytes": [11, 22, 33, 44, 55, 66],
        "previewBytes": [91, 82, 73, 64],
    }
    if migration != expected:
        raise RuntimeError(f"legacy IndexedDB migration failed: {migration}")
    context.close()
    return migration


def main() -> None:
    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    fixtures = [Path(f"/tmp/wall_v27_reference_{index:02d}.jpg") for index in range(REFERENCE_COUNT)]
    bundle_path = Path("/tmp/yunnan-wall-v27-evidence.zip")
    for index, path in enumerate(fixtures):
        make_reference_fixture(path, index)

    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    url = f"{origin}/component-studio/wall-lab-v24.html?githubMock=1"

    console_errors: list[str] = []
    page_errors: list[str] = []
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
            migration = assert_migration(browser, origin)

            context = browser.new_context(
                viewport={"width": 1800, "height": 1200},
                device_scale_factor=1,
                accept_downloads=True,
            )
            page = context.new_page()
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.goto(url, wait_until="networkidle", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_V27__)", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_LIBRARY_V24__)", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_GITHUB_BRIDGE__)", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_EVIDENCE_BUNDLE__)", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_DISTILLATION__)", timeout=90_000)

            page.set_input_files("#libraryFileInput", [str(path) for path in fixtures])
            page.wait_for_function(
                f"() => window.__YUNNAN_WALL_LIBRARY_V24__.count >= {REFERENCE_COUNT}",
                timeout=60_000,
            )
            page.wait_for_selector(".reference-card .evidence-select", timeout=30_000)
            card_count = page.locator(".reference-card").count()
            if card_count < REFERENCE_COUNT:
                raise RuntimeError(f"reference library lost cards: {card_count}/{REFERENCE_COUNT}")

            for index in range(4):
                page.locator(".reference-card .evidence-select").nth(index).click()
            selected_count = page.evaluate("() => window.__YUNNAN_WALL_DISTILLATION__.selectedIds.length")
            if selected_count != 4:
                raise RuntimeError(f"batch selection failed: {selected_count}")

            for tag in ("stone-plinth", "brick-edge-wear", "missing-corner", "pitting", "small-holes", "straw-fiber", "plaster-loss", "rain-wash"):
                page.locator(f'.distill-tag[data-tag="{tag}"]').click()
            page.locator("#distillEvidenceGrade").select_option("direct-photo")
            page.locator("#distillNote").fill("Browser QA wall evidence batch")
            page.locator("#distillApplyAnnotation").click()
            page.wait_for_function(
                "() => Object.keys(window.__YUNNAN_WALL_DISTILLATION__.annotations).length >= 4",
                timeout=30_000,
            )
            page.locator("#distillGenerate").click()
            page.wait_for_function(
                "() => !document.querySelector('#distillApplyParams').disabled",
                timeout=30_000,
            )
            before_params = page.evaluate("() => ({...window.__YUNNAN_WALL_V27__.parameters})")
            distillation = page.evaluate("() => window.__YUNNAN_WALL_DISTILLATION__.generate()")
            required_suggestions = {"stoneHeight", "edgeWear", "edgeBreak", "pitting", "holeDensity", "strawDensity", "plasterLoss", "rain"}
            missing_suggestions = sorted(required_suggestions - set(distillation["suggestedParameters"]))
            if missing_suggestions:
                raise RuntimeError(f"distillation suggestions missing: {missing_suggestions}")

            page.locator("#distillApplyParams").click()
            page.wait_for_function(
                "() => window.__YUNNAN_WALL_V27__.geometry.holeCount > 0 && window.__YUNNAN_WALL_V27__.geometry.strawCount > 0",
                timeout=60_000,
            )
            after_params = page.evaluate("() => ({...window.__YUNNAN_WALL_V27__.parameters})")
            if after_params == before_params:
                raise RuntimeError("distillation did not update program wall parameters")

            page.evaluate(
                """() => window.__YUNNAN_WALL_V27__.applyParameters({
                  brickLength: 0.58,
                  brickHeight: 0.24,
                  stoneWidth: 0.70,
                  stoneCourseHeight: 0.34,
                  plasterPatchCount: 7,
                  holeDensity: 0.78,
                  strawDensity: 0.82
                })"""
            )
            page.wait_for_function(
                "() => window.__YUNNAN_WALL_V27__.geometry.patchCount === 7 && window.__YUNNAN_WALL_V27__.geometry.holeCount > 0",
                timeout=60_000,
            )
            runtime = page.evaluate("() => window.__YUNNAN_WALL_V27__.snapshot()")
            geometry = runtime["geometry"]
            if geometry["brickCount"] < 90 or geometry["stoneCount"] < 15 or geometry["openSurfaceCount"] != 0:
                raise RuntimeError(f"generated geometry contract failed: {geometry}")

            page.locator("#distillSaveSnapshot").click()
            page.wait_for_function("() => window.__YUNNAN_WALL_DISTILLATION__.snapshots.length >= 1", timeout=30_000)

            with page.expect_download(timeout=120_000) as download_info:
                page.locator("#githubExportButton").click()
            download = download_info.value
            download.save_as(bundle_path)
            with zipfile.ZipFile(bundle_path) as archive:
                names = set(archive.namelist())
                manifest = json.loads(archive.read("manifest.json"))
            image_names = [name for name in names if name.startswith("images/") and name.endswith(".jpg")]
            if len(image_names) < REFERENCE_COUNT or "README.txt" not in names:
                raise RuntimeError(f"evidence ZIP incomplete: images={len(image_names)}, names={sorted(names)[:5]}")
            if manifest["counts"]["packagedProxies"] < REFERENCE_COUNT or manifest["counts"]["skipped"] != 0:
                raise RuntimeError(f"evidence manifest failed: {manifest['counts']}")

            page.locator("#githubPushButton").click()
            page.wait_for_function(
                f"() => window.__YUNNAN_WALL_GITHUB_BRIDGE__.lastResult?.uploadedCount >= {REFERENCE_COUNT}",
                timeout=90_000,
            )
            mock_push = page.evaluate("() => window.__YUNNAN_WALL_GITHUB_BRIDGE__.lastResult")

            canvas_box = page.locator("#wallCanvas").bounding_box()
            if not canvas_box or canvas_box["width"] < 800 or canvas_box["height"] < 500:
                raise RuntimeError(f"program wall canvas is too small: {canvas_box}")
            screenshot = page.screenshot(path=str(SCREENSHOT), full_page=False)
            image = Image.open(BytesIO(screenshot)).convert("RGB")
            left = max(0, round(canvas_box["x"]))
            top = max(0, round(canvas_box["y"]))
            right = min(image.width, round(canvas_box["x"] + canvas_box["width"]))
            bottom = min(image.height, round(canvas_box["y"] + canvas_box["height"]))
            crop = image.crop((left, top, right, bottom)).resize((320, 180))
            pixels = list(crop.getdata())
            luminance = [0.2126 * red + 0.7152 * green + 0.0722 * blue for red, green, blue in pixels]
            white_fraction = sum(red > 244 and green > 244 and blue > 244 for red, green, blue in pixels) / len(pixels)
            unique_colors = len(set(pixels))
            luminance_stddev = statistics.pstdev(luminance)
            if white_fraction > 0.72 or unique_colors < 500 or luminance_stddev < 12:
                raise RuntimeError(
                    f"canvas visual contract failed: white={white_fraction:.4f}, colors={unique_colors}, stddev={luminance_stddev:.3f}"
                )
            if console_errors or page_errors:
                raise RuntimeError(f"browser errors: console={console_errors}, page={page_errors}")

            report = {
                "schemaVersion": "2.0.0",
                "page": "component-studio/wall-lab-v24.html",
                "studioVersion": "2.7.0",
                "migration": migration,
                "referenceCount": card_count,
                "selectedCount": selected_count,
                "annotationCount": len(page.evaluate("() => Object.keys(window.__YUNNAN_WALL_DISTILLATION__.annotations)")),
                "distillation": distillation,
                "beforeParams": before_params,
                "afterParams": after_params,
                "runtime": runtime,
                "bundle": {
                    "imageCount": len(image_names),
                    "manifestCounts": manifest["counts"],
                    "hasReadme": "README.txt" in names,
                },
                "mockGithubPush": mock_push,
                "visual": {
                    "whiteFraction": round(white_fraction, 6),
                    "uniqueColors": unique_colors,
                    "luminanceStddev": round(luminance_stddev, 6),
                },
                "consoleErrors": console_errors,
                "pageErrors": page_errors,
                "passed": True,
            }
            REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        for path in fixtures:
            path.unlink(missing_ok=True)
        bundle_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
