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
SCREENSHOT = ROOT / "qa/screenshots/wall_v24_browser.png"
REPORT = ROOT / "data/qa/wall_v24_browser.json"
REFERENCE_COUNT = 36


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        return

    def do_GET(self) -> None:  # noqa: N802 - inherited HTTP handler API
        if self.path.partition("?")[0] == "/__idb_fixture__.html":
            body = b"<!doctype html><meta charset=utf-8><title>IndexedDB fixture</title>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def chrome_executable() -> str | None:
    for candidate in (
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
    ):
        value = shutil.which(candidate)
        if value:
            return value
    return None


def make_reference_fixture(path: Path, index: int) -> None:
    base = (132 + index % 9 * 5, 82 + index % 7 * 4, 52 + index % 5 * 3)
    image = Image.new("RGB", (260, 170), base)
    draw = ImageDraw.Draw(image)
    for row in range(5):
        y = 14 + row * 27
        offset = 18 if row % 2 else 0
        for column in range(7):
            x = -16 + offset + column * 43
            fill = (151 + (index + row) % 5 * 4, 98 + column % 3 * 4, 63 + index % 4 * 3)
            draw.rounded_rectangle((x, y, x + 39, y + 21), radius=4, fill=fill, outline=(80, 50, 34), width=2)
    draw.rectangle((0, 140, 260, 170), fill=(104 + index % 6 * 3, 100, 88))
    draw.text((8, 147), f"REF {index + 1:02d}", fill=(238, 226, 202))
    image.save(path, quality=90)


def main() -> None:
    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    reference_fixtures = [Path(f"/tmp/wall_reference_smoke_{index:02d}.jpg") for index in range(REFERENCE_COUNT)]
    bundle_path = Path("/tmp/yunnan-wall-evidence-smoke.zip")
    for index, path in enumerate(reference_fixtures):
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
            executable = chrome_executable()
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=executable,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--ignore-gpu-blocklist",
                    "--enable-unsafe-swiftshader",
                    "--use-angle=swiftshader",
                ],
            )

            preservation_console_errors: list[str] = []
            preservation_page_errors: list[str] = []
            preservation_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=3,
            )
            preservation_page = preservation_context.new_page()
            preservation_page.on(
                "console",
                lambda message: preservation_console_errors.append(message.text)
                if message.type == "error"
                else None,
            )
            preservation_page.on("pageerror", lambda error: preservation_page_errors.append(str(error)))
            preservation_page.goto(f"{origin}/__idb_fixture__.html", wait_until="domcontentloaded", timeout=30_000)
            preservation_fixture = preservation_page.evaluate(
                """async () => {
                  const remove = (name) => new Promise((resolve, reject) => {
                    const request = indexedDB.deleteDatabase(name);
                    request.onsuccess = resolve;
                    request.onerror = () => reject(request.error);
                    request.onblocked = () => reject(new Error(`failed to clear ${name}`));
                  });
                  const create = (name, upgrade) => new Promise((resolve, reject) => {
                    const request = indexedDB.open(name, 1);
                    request.onupgradeneeded = () => upgrade(request.result);
                    request.onsuccess = () => {
                      const version = request.result.version;
                      request.result.close();
                      resolve(version);
                    };
                    request.onerror = () => reject(request.error);
                  });
                  await remove('YunnanComponentStudio');
                  await remove('YunnanWallStudioV2');
                  const attachmentsVersion = await create('YunnanComponentStudio', (db) => {
                    const store = db.createObjectStore('attachments', { keyPath: 'id' });
                    const bytes = new Uint8Array([11, 22, 33, 44, 55, 66]);
                    store.put({
                      id: 'legacy-attachment',
                      moduleId: 'walls',
                      name: 'legacy-wall.jpg',
                      type: 'image/jpeg',
                      size: bytes.byteLength,
                      sha256: 'sha256-legacy-wall-evidence',
                      createdAt: '2026-08-25T00:00:00.000Z',
                      blob: new Blob([bytes], { type: 'image/jpeg' })
                    });
                  });
                  const previewsVersion = await create('YunnanWallStudioV2', (db) => {
                    const store = db.createObjectStore('previews', { keyPath: 'attachmentId' });
                    const bytes = new Uint8Array([91, 82, 73, 64]);
                    store.put({
                      attachmentId: 'legacy-attachment',
                      blob: new Blob([bytes], { type: 'image/jpeg' })
                    });
                  });
                  return { attachmentsVersion, previewsVersion };
                }"""
            )
            if preservation_fixture != {"attachmentsVersion": 1, "previewsVersion": 1}:
                raise RuntimeError(f"record-preservation fixture is invalid: {preservation_fixture}")
            preservation_page.goto(url, wait_until="networkidle", timeout=90_000)
            preservation_page.wait_for_function(
                "() => Boolean(window.__YUNNAN_WALL_LIBRARY_V24__)", timeout=90_000
            )
            preservation = preservation_page.evaluate(
                """async () => {
                  const listNames = (names) => {
                    const values = [];
                    for (let index = 0; index < names.length; index += 1) {
                      const value = typeof names.item === 'function' ? names.item(index) : names[index];
                      if (value !== null && value !== undefined) values.push(value);
                    }
                    return values;
                  };
                  const read = (db, storeName, key) => new Promise((resolve, reject) => {
                    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
                    request.onsuccess = () => resolve(request.result || null);
                    request.onerror = () => reject(request.error);
                  });
                  const queryModule = (db) => new Promise((resolve, reject) => {
                    const store = db.transaction('attachments', 'readonly').objectStore('attachments');
                    const request = store.index('moduleId').getAll(IDBKeyRange.only('walls'));
                    request.onsuccess = () => resolve((request.result || []).map((record) => record.id));
                    request.onerror = () => reject(request.error);
                  });
                  const bytes = async (blob) => Array.from(new Uint8Array(await blob.arrayBuffer()));
                  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
                  const attachmentsDb = await storage.openAttachments();
                  const previewsDb = await storage.openPreviews();
                  const attachment = await read(attachmentsDb, 'attachments', 'legacy-attachment');
                  const preview = await read(previewsDb, 'previews', 'legacy-attachment');
                  const attachmentStore = attachmentsDb
                    .transaction('attachments', 'readonly')
                    .objectStore('attachments');
                  return {
                    viewport: {
                      width: innerWidth,
                      height: innerHeight,
                      scrollWidth: document.documentElement.scrollWidth
                    },
                    attachmentsVersion: attachmentsDb.version,
                    previewsVersion: previewsDb.version,
                    attachmentIndexes: listNames(attachmentStore.indexNames),
                    indexedIds: await queryModule(attachmentsDb),
                    attachment: {
                      id: attachment.id,
                      moduleId: attachment.moduleId,
                      name: attachment.name,
                      type: attachment.type,
                      size: attachment.size,
                      sha256: attachment.sha256,
                      blobType: attachment.blob.type,
                      blobBytes: await bytes(attachment.blob)
                    },
                    preview: {
                      attachmentId: preview.attachmentId,
                      blobType: preview.blob.type,
                      blobBytes: await bytes(preview.blob)
                    }
                  };
                }"""
            )
            expected_attachment = {
                "id": "legacy-attachment",
                "moduleId": "walls",
                "name": "legacy-wall.jpg",
                "type": "image/jpeg",
                "size": 6,
                "sha256": "sha256-legacy-wall-evidence",
                "blobType": "image/jpeg",
                "blobBytes": [11, 22, 33, 44, 55, 66],
            }
            expected_preview = {
                "attachmentId": "legacy-attachment",
                "blobType": "image/jpeg",
                "blobBytes": [91, 82, 73, 64],
            }
            if (
                preservation.get("attachmentsVersion") != 2
                or preservation.get("previewsVersion") != 2
                or preservation.get("attachmentIndexes") != ["moduleId"]
                or preservation.get("indexedIds") != ["legacy-attachment"]
                or preservation.get("attachment") != expected_attachment
                or preservation.get("preview") != expected_preview
            ):
                raise RuntimeError(f"legacy Blob or index migration failed: {preservation}")
            preservation_page.reload(wait_until="networkidle", timeout=90_000)
            preservation_page.wait_for_function(
                "() => window.__YUNNAN_WALL_LIBRARY_V24__?.count === 1", timeout=90_000
            )
            reload_preservation = preservation_page.evaluate(
                """async () => {
                  const read = (db, storeName, key) => new Promise((resolve, reject) => {
                    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
                    request.onsuccess = () => resolve(request.result || null);
                    request.onerror = () => reject(request.error);
                  });
                  const bytes = async (blob) => Array.from(new Uint8Array(await blob.arrayBuffer()));
                  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
                  const attachmentsDb = await storage.openAttachments();
                  const previewsDb = await storage.openPreviews();
                  const attachment = await read(attachmentsDb, 'attachments', 'legacy-attachment');
                  const preview = await read(previewsDb, 'previews', 'legacy-attachment');
                  const attachmentStore = attachmentsDb
                    .transaction('attachments', 'readonly')
                    .objectStore('attachments');
                  return {
                    attachmentsVersion: attachmentsDb.version,
                    previewsVersion: previewsDb.version,
                    moduleIndexPresent: attachmentStore.indexNames.contains('moduleId'),
                    attachmentSha256: attachment.sha256,
                    attachmentBlobBytes: await bytes(attachment.blob),
                    previewBlobBytes: await bytes(preview.blob)
                  };
                }"""
            )
            expected_reload_preservation = {
                "attachmentsVersion": 2,
                "previewsVersion": 2,
                "moduleIndexPresent": True,
                "attachmentSha256": "sha256-legacy-wall-evidence",
                "attachmentBlobBytes": [11, 22, 33, 44, 55, 66],
                "previewBlobBytes": [91, 82, 73, 64],
            }
            if reload_preservation != expected_reload_preservation:
                raise RuntimeError(f"legacy data did not survive reload: {reload_preservation}")
            if preservation_console_errors or preservation_page_errors:
                raise RuntimeError(
                    "record-preservation browser errors: "
                    f"console={preservation_console_errors}, page={preservation_page_errors}"
                )
            preservation_context.close()

            context = browser.new_context(
                viewport={"width": 1600, "height": 1000},
                device_scale_factor=1,
                accept_downloads=True,
            )
            seed_page = context.new_page()
            seed_page.goto(f"{origin}/__idb_fixture__.html", wait_until="domcontentloaded", timeout=30_000)
            pre_migration = seed_page.evaluate(
                """async () => {
                  const listNames = (names) => {
                    const values = [];
                    for (let index = 0; index < names.length; index += 1) {
                      const value = typeof names.item === 'function' ? names.item(index) : names[index];
                      if (value !== null && value !== undefined) values.push(value);
                    }
                    return values;
                  };
                  const remove = (name) => new Promise((resolve, reject) => {
                    const request = indexedDB.deleteDatabase(name);
                    request.onsuccess = resolve;
                    request.onerror = () => reject(request.error);
                    request.onblocked = () => reject(new Error(`failed to clear ${name}`));
                  });
                  const create = (name, upgrade) => new Promise((resolve, reject) => {
                    const request = indexedDB.open(name, 1);
                    request.onupgradeneeded = () => upgrade(request.result);
                    request.onsuccess = () => {
                      const db = request.result;
                      const result = { version: db.version, stores: listNames(db.objectStoreNames) };
                      db.close();
                      resolve(result);
                    };
                    request.onerror = () => reject(request.error);
                  });
                  await remove('YunnanComponentStudio');
                  await remove('YunnanWallStudioV2');
                  const attachments = await create('YunnanComponentStudio', (db) => {
                    const store = db.createObjectStore('legacyState', { keyPath: 'id' });
                    store.put({ id: 'keep-me', value: 'preserve-attachments-db' });
                  });
                  const previews = await create('YunnanWallStudioV2', (db) => {
                    const store = db.createObjectStore('legacyCache', { keyPath: 'id' });
                    store.put({ id: 'keep-cache', value: 'preserve-preview-db' });
                  });
                  return { attachments, previews };
                }"""
            )
            if pre_migration != {
                "attachments": {"version": 1, "stores": ["legacyState"]},
                "previews": {"version": 1, "stores": ["legacyCache"]},
            }:
                raise RuntimeError(f"legacy IndexedDB fixture is invalid: {pre_migration}")
            seed_page.evaluate(
                """() => new Promise((resolve, reject) => {
                  const request = indexedDB.open('YunnanComponentStudio', 1);
                  request.onsuccess = () => {
                    window.__YUNNAN_LEGACY_ATTACHMENT_CONNECTION__ = request.result;
                    resolve(request.result.version);
                  };
                  request.onerror = () => reject(request.error);
                })"""
            )

            page = context.new_page()
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.goto(url, wait_until="networkidle", timeout=90_000)
            page.wait_for_function(
                """() => window.__YUNNAN_COMPONENT_STUDIO_STORAGE__
                  ?.states?.YunnanComponentStudio?.state === 'blocked'""",
                timeout=30_000,
            )
            page.wait_for_function(
                "() => document.querySelector('#libraryStatus')?.textContent.includes('等待其他 HOUSE 页面关闭')",
                timeout=30_000,
            )
            blocked_migration = page.evaluate(
                """() => ({
                  state: window.__YUNNAN_COMPONENT_STUDIO_STORAGE__.states.YunnanComponentStudio,
                  status: document.querySelector('#libraryStatus')?.textContent || ''
                })"""
            )
            seed_page.evaluate(
                """() => {
                  window.__YUNNAN_LEGACY_ATTACHMENT_CONNECTION__?.close();
                  window.__YUNNAN_LEGACY_ATTACHMENT_CONNECTION__ = null;
                }"""
            )
            seed_page.close()
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_V24__)", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_LIBRARY_V24__)", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_GITHUB_BRIDGE__)", timeout=90_000)
            page.wait_for_function("() => Boolean(window.__YUNNAN_WALL_EVIDENCE_BUNDLE__)", timeout=90_000)
            migration = page.evaluate(
                """async () => {
                  const listNames = (names) => {
                    const values = [];
                    for (let index = 0; index < names.length; index += 1) {
                      const value = typeof names.item === 'function' ? names.item(index) : names[index];
                      if (value !== null && value !== undefined) values.push(value);
                    }
                    return values;
                  };
                  const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
                  if (!storage) throw new Error('storage migration runtime is missing');
                  const attachmentsDb = await storage.openAttachments();
                  const previewsDb = await storage.openPreviews();
                  const read = (db, storeName, key) => new Promise((resolve, reject) => {
                    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
                    request.onsuccess = () => resolve(request.result || null);
                    request.onerror = () => reject(request.error);
                  });
                  const attachmentStore = attachmentsDb
                    .transaction('attachments', 'readonly')
                    .objectStore('attachments');
                  return {
                    runtimeVersion: storage.version,
                    attachments: {
                      version: attachmentsDb.version,
                      stores: listNames(attachmentsDb.objectStoreNames),
                      indexes: listNames(attachmentStore.indexNames),
                      legacySentinel: await read(attachmentsDb, 'legacyState', 'keep-me')
                    },
                    previews: {
                      version: previewsDb.version,
                      stores: listNames(previewsDb.objectStoreNames),
                      legacySentinel: await read(previewsDb, 'legacyCache', 'keep-cache')
                    },
                    libraryStatus: document.querySelector('#libraryStatus')?.textContent || '',
                    libraryGrid: document.querySelector('#referenceGrid')?.textContent || ''
                  };
                }"""
            )
            if migration.get("runtimeVersion") != "2.0.0":
                raise RuntimeError(f"unexpected storage runtime: {migration}")
            attachment_migration = migration.get("attachments") or {}
            if (
                attachment_migration.get("version") != 2
                or set(attachment_migration.get("stores") or []) != {"attachments", "legacyState"}
                or attachment_migration.get("indexes") != ["moduleId"]
                or attachment_migration.get("legacySentinel")
                != {"id": "keep-me", "value": "preserve-attachments-db"}
            ):
                raise RuntimeError(f"attachment database migration failed: {attachment_migration}")
            preview_migration = migration.get("previews") or {}
            if (
                preview_migration.get("version") != 2
                or set(preview_migration.get("stores") or []) != {"legacyCache", "previews"}
                or preview_migration.get("legacySentinel")
                != {"id": "keep-cache", "value": "preserve-preview-db"}
            ):
                raise RuntimeError(f"preview database migration failed: {preview_migration}")
            if migration.get("libraryStatus") != "资料窗口已准备好":
                raise RuntimeError(f"reference library did not recover after migration: {migration}")
            if "正在读取资料" in migration.get("libraryGrid", ""):
                raise RuntimeError(f"reference library remained stuck after migration: {migration}")
            runtime = page.evaluate("() => window.__YUNNAN_WALL_V24__")
            library_runtime = page.evaluate("() => ({version: window.__YUNNAN_WALL_LIBRARY_V24__.version, count: window.__YUNNAN_WALL_LIBRARY_V24__.count})")
            bridge_runtime = page.evaluate("() => ({version: window.__YUNNAN_WALL_GITHUB_BRIDGE__.version, mode: window.__YUNNAN_WALL_GITHUB_BRIDGE__.mode, mock: window.__YUNNAN_WALL_GITHUB_BRIDGE__.mock})")
            delivery_runtime = page.evaluate("() => ({version: window.__YUNNAN_WALL_EVIDENCE_BUNDLE__.version, mode: window.__YUNNAN_WALL_EVIDENCE_BUNDLE__.mode})")
            canvas_box = page.locator("#wallCanvas").bounding_box()
            library_box = page.locator("#referenceLibrary").bounding_box()
            bridge_box = page.locator("#githubBridge").bounding_box()
            if not canvas_box or canvas_box["width"] < 700 or canvas_box["height"] < 450:
                raise RuntimeError(f"program wall canvas is too small: {canvas_box}")
            if not library_box or library_box["width"] < 240 or library_box["height"] < 550:
                raise RuntimeError(f"reference library is not usable: {library_box}")
            if not bridge_box or bridge_box["width"] < 220 or bridge_box["height"] < 250:
                raise RuntimeError(f"wall delivery center is not usable: {bridge_box}")
            if runtime.get("version") != "2.4.0":
                raise RuntimeError(f"unexpected runtime version: {runtime}")
            if runtime.get("noise") != ["Perlin", "Simplex", "Worley"]:
                raise RuntimeError(f"noise stack mismatch: {runtime.get('noise')}")
            if library_runtime.get("version") != "2.4.1":
                raise RuntimeError(f"unexpected reference library version: {library_runtime}")
            if bridge_runtime != {
                "version": "2.5.0",
                "mode": "temporary-branch-exif-stripped-proxies",
                "mock": True,
            }:
                raise RuntimeError(f"unexpected GitHub bridge runtime: {bridge_runtime}")
            if delivery_runtime != {
                "version": "2.6.0",
                "mode": "token-assisted-github-or-tokenless-zip",
            }:
                raise RuntimeError(f"unexpected delivery runtime: {delivery_runtime}")
            geometry = runtime.get("geometry") or {}
            if geometry.get("brickCount", 0) < 150 or geometry.get("stoneCount", 0) < 20:
                raise RuntimeError(f"generated geometry is incomplete: {geometry}")
            if geometry.get("openSurfaceCount") != 0:
                raise RuntimeError(f"open surface contract failed: {geometry}")

            page.set_input_files("#libraryFileInput", [str(path) for path in reference_fixtures])
            page.wait_for_function(
                f"() => window.__YUNNAN_WALL_LIBRARY_V24__.count >= {REFERENCE_COUNT}",
                timeout=60_000,
            )
            page.wait_for_selector(".reference-card", timeout=30_000)
            page.locator(".reference-card").first.click()
            page.wait_for_function("() => !document.querySelector('#referenceImage').hidden", timeout=30_000)
            card_count = page.locator(".reference-card").count()
            if card_count < REFERENCE_COUNT:
                raise RuntimeError(f"reference library lost cards: {card_count}/{REFERENCE_COUNT}")

            button_boxes: dict[str, dict[str, float] | None] = {}
            for button_id in (
                "githubTokenCreateLink",
                "githubTestButton",
                "githubPushButton",
                "githubCleanupButton",
                "githubExportButton",
            ):
                locator = page.locator(f"#{button_id}")
                if not locator.is_visible():
                    raise RuntimeError(f"delivery control is hidden: {button_id}")
                box = locator.bounding_box()
                button_boxes[button_id] = box
                if not box:
                    raise RuntimeError(f"delivery control has no layout box: {button_id}")
                if box["y"] < library_box["y"] or box["y"] + box["height"] > library_box["y"] + library_box["height"]:
                    raise RuntimeError(f"delivery control is outside the visible library panel: {button_id} {box}")

            page.locator("#githubToken").fill("")
            page.locator("#githubTestButton").click()
            page.wait_for_function(
                "() => document.querySelector('#githubBridgeState')?.textContent === '尚未授权'",
                timeout=10_000,
            )
            blank_token_message = page.locator("#githubBridgeStatus").inner_text()
            if "下载整批资料包" not in blank_token_message:
                raise RuntimeError(f"blank-token fallback was not explained: {blank_token_message}")

            with page.expect_download(timeout=180_000) as download_info:
                page.locator("#githubExportButton").click()
            download = download_info.value
            download.save_as(bundle_path)
            page.wait_for_function(
                f"() => window.__YUNNAN_WALL_EVIDENCE_BUNDLE__.lastResult?.packagedCount >= {REFERENCE_COUNT}",
                timeout=30_000,
            )
            bundle_result = page.evaluate("() => window.__YUNNAN_WALL_EVIDENCE_BUNDLE__.lastResult")
            if bundle_result.get("packagedCount", 0) < REFERENCE_COUNT or bundle_result.get("bytes", 0) < 10_000:
                raise RuntimeError(f"tokenless evidence bundle is incomplete: {bundle_result}")
            with zipfile.ZipFile(bundle_path) as archive:
                names = archive.namelist()
                image_names = [name for name in names if name.startswith("images/") and name.endswith(".jpg")]
                if "manifest.json" not in names or "README.txt" not in names:
                    raise RuntimeError(f"bundle contract files are missing: {names[:10]}")
                if len(image_names) < REFERENCE_COUNT:
                    raise RuntimeError(f"bundle lost image proxies: {len(image_names)}/{REFERENCE_COUNT}")
                manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
                if manifest.get("counts", {}).get("packagedProxies", 0) < REFERENCE_COUNT:
                    raise RuntimeError(f"bundle manifest count mismatch: {manifest.get('counts')}")

            page.locator("#githubToken").fill("github_pat_" + "A" * 40)
            page.locator("#githubPushButton").click()
            page.wait_for_function(
                f"() => window.__YUNNAN_WALL_GITHUB_BRIDGE__.lastResult?.uploadedCount >= {REFERENCE_COUNT}",
                timeout=90_000,
            )
            push_result = page.evaluate("() => window.__YUNNAN_WALL_GITHUB_BRIDGE__.lastResult")
            if push_result.get("mock") is not True or push_result.get("uploadedCount", 0) < REFERENCE_COUNT:
                raise RuntimeError(f"mock GitHub evidence push failed: {push_result}")

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
            if white_fraction > 0.72:
                raise RuntimeError(f"canvas is visually washed out: white_fraction={white_fraction:.4f}")
            if unique_colors < 500 or luminance_stddev < 12:
                raise RuntimeError(
                    f"canvas lacks visible wall detail: unique_colors={unique_colors}, luminance_stddev={luminance_stddev:.3f}"
                )
            if console_errors or page_errors:
                raise RuntimeError(f"browser errors: console={console_errors}, page={page_errors}")

            report = {
                "schemaVersion": "1.6.0",
                "page": "component-studio/wall-lab-v24.html",
                "indexedDbMigration": {
                    "before": pre_migration,
                    "after": migration,
                    "blockedByLegacyTab": blocked_migration,
                    "recordPreservation": {
                        "before": preservation_fixture,
                        "afterMigration": preservation,
                        "afterReload": reload_preservation,
                        "consoleErrors": preservation_console_errors,
                        "pageErrors": preservation_page_errors,
                    },
                    "legacyDataPreserved": True,
                    "attachmentBlobBytesPreserved": True,
                    "previewBlobBytesPreserved": True,
                    "missingModuleIndexCreated": True,
                    "reloadPersistencePassed": True,
                    "automaticDatabaseDeletion": False,
                },
                "runtime": runtime,
                "referenceLibrary": {
                    "runtime": library_runtime,
                    "box": library_box,
                    "uploadedCardCount": card_count,
                    "activeReferenceVisible": True,
                },
                "delivery": {
                    "githubRuntime": bridge_runtime,
                    "bundleRuntime": delivery_runtime,
                    "box": bridge_box,
                    "buttonBoxes": button_boxes,
                    "controlsVisibleWithReferenceCount": REFERENCE_COUNT,
                    "blankTokenMessage": blank_token_message,
                    "tokenlessBundle": bundle_result,
                    "bundleImageCount": len(image_names),
                    "mockPushResult": push_result,
                },
                "canvas": canvas_box,
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
        bundle_path.unlink(missing_ok=True)
        for path in reference_fixtures:
            path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
