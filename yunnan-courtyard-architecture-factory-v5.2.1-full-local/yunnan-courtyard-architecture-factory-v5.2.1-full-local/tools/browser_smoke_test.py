#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
import re
import struct
import subprocess
import sys
import threading
import time
import traceback
from collections import Counter
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, unquote_to_bytes, urlencode, urlparse

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
OPTIONAL_CONSOLE_WINDOW_SECONDS = 2.0


def chromium_proxy_from_environment() -> str | None:
    """Pass the task runner's explicit HTTPS proxy to Chromium when present.

    Chromium does not inherit Python/curl proxy environment handling. Without
    this bridge the regression can report ERR_EMPTY_RESPONSE for every exact
    GitHub source URL even though the same URLs are reachable by the runner.
    Loopback stays direct so the locally served application is still tested.
    GitHub-hosted runners normally provide no proxy here and keep the default
    direct-network behavior.
    """
    proxy_server = (
        os.environ.get("HTTPS_PROXY")
        or os.environ.get("https_proxy")
        or os.environ.get("HTTP_PROXY")
        or os.environ.get("http_proxy")
    )
    if not proxy_server:
        return None
    parsed = urlparse(proxy_server)
    if parsed.scheme not in {"http", "https", "socks5"} or not parsed.hostname:
        raise ValueError("Unsupported browser proxy URL in the execution environment")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Credential-bearing browser proxy URLs are not supported")
    return proxy_server


def git_value(*args: str) -> str | None:
    completed = subprocess.run(
        ["git", *args], cwd=ROOT, check=False, capture_output=True, text=True,
    )
    value = completed.stdout.strip()
    return value if completed.returncode == 0 and value else None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Complete production-line browser regression")
    parser.add_argument("--report", type=Path, default=ROOT / "data/qa/local_browser_smoke_test.json")
    parser.add_argument("--screenshots", type=Path, default=ROOT / "qa/screenshots")
    parser.add_argument(
        "--run-sha", default=os.environ.get("GITHUB_SHA") or git_value("rev-parse", "HEAD"),
        help="Commit under test and immutable GitHub Sync read ref.",
    )
    parser.add_argument(
        "--run-ref",
        default=os.environ.get("GITHUB_REF_NAME") or git_value("branch", "--show-current"),
        help="Branch name recorded by GitHub Sync.",
    )
    return parser.parse_args()


ARGS = parse_args()
GITHUB_API_ORIGIN = "https://api.github.com"
GITHUB_REPOSITORY_PATH = "/repos/haihao0307/HOUSE"
GITHUB_SYNC_SOURCE_ROOT = (
    "yunnan-courtyard-architecture-factory-v5.2.1-full-local/"
    "yunnan-courtyard-architecture-factory-v5.2.1-full-local"
)
OPTIONAL_API_CONTRACTS = {
    "api:commits": {
        "path": f"{GITHUB_REPOSITORY_PATH}/commits",
        "query": {
            "sha": ARGS.run_sha,
            "path": f"{GITHUB_SYNC_SOURCE_ROOT}/data/system_v5_2_1.json",
            "per_page": "1",
        },
    },
    "api:issues": {
        "path": f"{GITHUB_REPOSITORY_PATH}/issues",
        "query": {
            "state": "all",
            "per_page": "30",
            "sort": "updated",
            "direction": "desc",
        },
    },
}
REPORT = ARGS.report if ARGS.report.is_absolute() else ROOT / ARGS.report
SCREENSHOT_DIR = ARGS.screenshots if ARGS.screenshots.is_absolute() else ROOT / ARGS.screenshots
SCREEN = SCREENSHOT_DIR / "local_browser_smoke_test.png"
TUANJIE_SCREEN = SCREENSHOT_DIR / "v550_regression_tuanjie_reference.png"
TUANJIE_LOCAL_SCREEN = SCREENSHOT_DIR / "v550_regression_tuanjie_file_loader.png"
DALI_SCREEN = SCREENSHOT_DIR / "v550_regression_dali_reference.png"
WULONG_SCREEN = SCREENSHOT_DIR / "v550_regression_wulong_reference.png"
MOBILE_SCREEN = SCREENSHOT_DIR / "v550_regression_mobile_390x844.png"
STALE_HIGH_SCREEN = SCREENSHOT_DIR / "v550_regression_tuanjie_reference_high.png"
STALE_STANDARD_SCREEN = SCREENSHOT_DIR / "v550_regression_tuanjie_reference_standard.png"

REPORT.parent.mkdir(parents=True, exist_ok=True)
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
for previous in [
    REPORT,
    SCREEN,
    TUANJIE_SCREEN,
    TUANJIE_LOCAL_SCREEN,
    DALI_SCREEN,
    WULONG_SCREEN,
    MOBILE_SCREEN,
    STALE_HIGH_SCREEN,
    STALE_STANDARD_SCREEN,
]:
    if previous.is_file():
        previous.unlink()

results: list[dict[str, Any]] = []
process_failures: list[dict[str, Any]] = []
page_errors: list[str] = []
console_errors: list[dict[str, Any]] = []
network_console_diagnostics: list[dict[str, Any]] = []
failed_requests: list[dict[str, Any]] = []
http_errors: list[dict[str, Any]] = []
forbidden_high_requests: list[dict[str, Any]] = []
allowed_optional_http: list[dict[str, Any]] = []
allowed_network_console: list[dict[str, Any]] = []
model_runtime: dict[str, dict[str, Any]] = {}
screenshot_contracts: dict[Path, dict[str, Any]] = {}
model_asset_paths = {
    "Tuanjie": ROOT / "assets/models/YN_TUANJIE_001_EDITABLE.glb",
    "TuanjieLocal": ROOT / "assets/models/YN_TUANJIE_001_EDITABLE.glb",
    "Dali": ROOT / "assets/models/YN_DALI_001_REFERENCE_WEB.glb",
    "Wulong": ROOT / "assets/models/YN_HAOSI1_WULONG_WL_001_REFERENCE_WEB.glb",
}
model_asset_hashes: dict[Path, str] = {}
model_glb_fingerprints: dict[Path, dict[str, Any]] = {}
sync_stats: dict[str, Any] = {}
mobile_sync_stats: dict[str, Any] = {}
state = None
measured_state = None
upper = None
mobile_state = None
upper_structure: dict[str, Any] | None = None
mobile_structure: dict[str, Any] | None = None


def add_result(name: str, ok: bool, detail: Any = None) -> None:
    result: dict[str, Any] = {"name": name, "ok": bool(ok)}
    if detail is not None:
        result["detail"] = detail
    results.append(result)


def add_process_failure(kind: str, detail: Any, *, failure_type: str | None = None) -> None:
    process_failures.append({"kind": kind, "type": failure_type or kind, "detail": detail})


def canonical_fingerprint(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"


def viewport_snapshot(page: Any) -> dict[str, Any]:
    return page.evaluate("""() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    })""")


def camera_snapshot(stats: dict[str, Any]) -> dict[str, Any] | None:
    camera = stats.get("camera")
    if not isinstance(camera, dict):
        return None
    distance = camera.get("distance", camera.get("dist"))
    target = camera.get("target")
    if not isinstance(target, list) or len(target) != 3:
        return None
    return {
        "yaw": camera.get("yaw"),
        "pitch": camera.get("pitch"),
        "distance": distance,
        "target": list(target),
    }


def valid_camera(camera: Any) -> bool:
    if not isinstance(camera, dict):
        return False
    values = [camera.get("yaw"), camera.get("pitch"), camera.get("distance")]
    target = camera.get("target")
    if not isinstance(target, list) or len(target) != 3:
        return False
    values.extend(target)
    return all(isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) for value in values)


def runtime_scene_snapshot(stats: dict[str, Any]) -> dict[str, Any] | None:
    fingerprint_inputs = stats.get("fingerprintInputs")
    if not isinstance(fingerprint_inputs, dict):
        return None
    snapshot = dict(fingerprint_inputs)
    snapshot.pop("canvasChecksum", None)
    return snapshot


def runtime_scene_values_match(actual: Any, expected: Any) -> bool:
    if isinstance(expected, bool) or isinstance(actual, bool):
        return actual is expected
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return math.isfinite(float(expected)) and math.isfinite(float(actual)) and math.isclose(
            float(actual), float(expected), rel_tol=1e-6, abs_tol=2e-5,
        )
    if isinstance(expected, str) or expected is None:
        return actual == expected
    if isinstance(expected, list):
        return isinstance(actual, list) and len(actual) == len(expected) and all(
            runtime_scene_values_match(actual_item, expected_item)
            for actual_item, expected_item in zip(actual, expected)
        )
    if isinstance(expected, dict):
        return isinstance(actual, dict) and set(actual) == set(expected) and all(
            runtime_scene_values_match(actual[key], value) for key, value in expected.items()
        )
    return actual == expected


def production_capture_contract(page: Any, stats: dict[str, Any], check: str) -> dict[str, Any]:
    options = stats.get("options") if isinstance(stats.get("options"), dict) else {}
    tuanjie_layer = stats.get("tuanjieLayer") if isinstance(stats.get("tuanjieLayer"), dict) else {}
    structural_inputs = {
        "fallback": stats.get("fallback"),
        "triangles": stats.get("triangles"),
        "lines": stats.get("lines"),
        "options": options,
        "tuanjieLayer": tuanjie_layer,
    }
    runtime_seed = stats.get("seed") if "seed" in stats else None
    runtime_surface_fingerprint = stats.get("surfaceFingerprint") if "surfaceFingerprint" in stats else None
    return {
        "check": check,
        "captureContract": {
            "schemaVersion": "house-regression-screenshot-v1",
            "runtimeSource": "window.__V521_TEST__.stats()",
            "run": {"sha": ARGS.run_sha, "ref": ARGS.run_ref},
            "fingerprintBasis": structural_inputs,
        },
        "viewport": viewport_snapshot(page),
        "camera": camera_snapshot(stats),
        "seed": runtime_seed,
        "structuralFingerprint": canonical_fingerprint(structural_inputs),
        "surfaceFingerprint": runtime_surface_fingerprint,
        "evidenceLimit": {
            "seed": None if runtime_seed is not None else "N/A: __V521_TEST__.stats() exposes no weathering seed.",
            "surfaceFingerprint": None if runtime_surface_fingerprint is not None else "N/A: the production-line runtime exposes no deterministic surface-material fingerprint.",
            "structuralFingerprint": "Derived only from live aggregate geometry/options/Tuanjie-layer stats; the runtime exposes no stable per-object IDs or world bounds.",
        },
    }


def reference_capture_contract(page: Any, stats: dict[str, Any], check: str) -> dict[str, Any]:
    return {
        "check": check,
        "captureContract": {
            "schemaVersion": "house-regression-screenshot-v1",
            "runtimeSource": "window.__TUANJIE_TEST__.stats()",
            "run": {"sha": ARGS.run_sha, "ref": ARGS.run_ref},
            "structuralRenderFingerprint": stats.get("structuralRenderFingerprint"),
            "runtimeStructuralFingerprint": stats.get("structuralFingerprint"),
            "runtimeStructureManifestContract": stats.get("runtimeStructureManifestContract"),
            "runtimeStructureManifest": runtime_scene_snapshot(stats),
            "fingerprintBasis": stats.get("fingerprintInputs"),
        },
        "viewport": viewport_snapshot(page),
        "camera": camera_snapshot(stats),
        "seed": None,
        "structuralFingerprint": stats.get("structuralFingerprint"),
        "surfaceFingerprint": None,
        "evidenceLimit": {
            "seed": "N/A: reference GLB models have no weathering seed contract.",
            "surfaceFingerprint": "N/A: the reference viewer renders source textures but has no semantic weathering/surface-system fingerprint.",
            "structuralFingerprint": "Source and aggregate mesh/vertex/triangle counts identify structure; structuralRenderFingerprint additionally binds the current framebuffer checksum and is not a GLB byte hash.",
        },
    }


def register_screenshot_contract(path: Path, contract: dict[str, Any]) -> None:
    screenshot_contracts[path] = contract


def optional_api_expected_url(request_id: str) -> str | None:
    contract = OPTIONAL_API_CONTRACTS.get(request_id)
    if contract is None:
        return None
    return f"{GITHUB_API_ORIGIN}{contract['path']}?{urlencode(contract['query'])}"


def optional_api_request_matches(request_id: Any, request_url: Any) -> bool:
    contract = OPTIONAL_API_CONTRACTS.get(request_id)
    if contract is None or not isinstance(request_url, str):
        return False
    try:
        parsed = urlparse(request_url)
        query_items = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
    except (TypeError, ValueError):
        return False
    expected_query = contract["query"]
    return (
        parsed.scheme == "https"
        and parsed.netloc == "api.github.com"
        and parsed.path == contract["path"]
        and not parsed.params
        and not parsed.fragment
        and len(query_items) == len(expected_query)
        and Counter(query_items) == Counter(
            (key, str(value)) for key, value in expected_query.items()
        )
    )


def optional_api_request_id_for_url(request_url: Any) -> str | None:
    matches = [
        request_id for request_id in OPTIONAL_API_CONTRACTS
        if optional_api_request_matches(request_id, request_url)
    ]
    return matches[0] if len(matches) == 1 else None


def optional_api_stats_contract_matches(stats: dict[str, Any]) -> bool:
    requests = stats.get("requests") or []
    api_requests = [
        request for request in requests
        if isinstance(request.get("id"), str) and request["id"].startswith("api:")
    ]
    optional_requests = [request for request in requests if request.get("required") is False]
    if (
        len(api_requests) != 2
        or len(optional_requests) != 2
        or {request.get("id") for request in optional_requests} != set(OPTIONAL_API_CONTRACTS)
    ):
        return False
    for request in optional_requests:
        status = request.get("status")
        outcome = request.get("outcome")
        if (
            request.get("allowedStatuses") != [403, 429]
            or not request.get("optionalReason")
            or not optional_api_request_matches(request.get("id"), request.get("url"))
            or not isinstance(status, int)
            or not (
                (outcome == "fulfilled" and 200 <= status < 300)
                or (outcome == "allowed-optional-http" and status in {403, 429})
            )
        ):
            return False
    return True


if not isinstance(ARGS.run_sha, str) or not re.fullmatch(r"[0-9a-fA-F]{40}", ARGS.run_sha):
    add_process_failure(
        "run-identity",
        {"runSha": ARGS.run_sha, "reason": "a full commit SHA is required"},
        failure_type="configuration",
    )
if (
    not isinstance(ARGS.run_ref, str)
    or not ARGS.run_ref
    or len(ARGS.run_ref) > 160
    or ARGS.run_ref.startswith("/")
    or ARGS.run_ref.endswith("/")
    or ".." in ARGS.run_ref
    or re.fullmatch(r"[0-9A-Za-z._/-]+", ARGS.run_ref) is None
):
    add_process_failure(
        "run-identity",
        {"runRef": ARGS.run_ref, "reason": "a valid source branch is required"},
        failure_type="configuration",
    )


def capture_console(message: Any, page_id: str) -> None:
    if message.type != "error":
        return
    entry = {
        "text": message.text,
        "location": message.location,
        "pageId": page_id,
        "capturedMonotonic": time.monotonic(),
    }
    status_match = re.search(r"\bstatus(?: of)?\s+(\d{3})\b", message.text, re.IGNORECASE)
    if "Failed to load resource" in message.text and status_match:
        entry["status"] = int(status_match.group(1))
        network_console_diagnostics.append(entry)
    else:
        console_errors.append(entry)


def capture_response(response: Any, page_id: str) -> None:
    if response.status >= 400:
        http_errors.append({
            "status": response.status,
            "url": response.url,
            "method": response.request.method,
            "pageId": page_id,
            "capturedMonotonic": time.monotonic(),
        })


def capture_request_failure(request: Any, page_id: str) -> None:
    failed_requests.append({
        "method": request.method,
        "url": request.url,
        "failure": request.failure,
        "pageId": page_id,
        "capturedMonotonic": time.monotonic(),
    })


def capture_request(request: Any, page_id: str) -> None:
    if "YN_TUANJIE_001_EDITABLE_HIGH.glb" in request.url:
        forbidden_high_requests.append({"method": request.method, "url": request.url, "pageId": page_id})


def bind_page_diagnostics(page: Any, page_id: str) -> None:
    page.on("pageerror", lambda exc: page_errors.append(f"{page_id}: {exc}"))
    page.on("console", lambda message: capture_console(message, page_id))
    page.on("request", lambda request: capture_request(request, page_id))
    page.on("response", lambda response: capture_response(response, page_id))
    page.on("requestfailed", lambda request: capture_request_failure(request, page_id))


def file_sha256(path: Path) -> str | None:
    if path in model_asset_hashes:
        return model_asset_hashes[path]
    if not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    value = digest.hexdigest()
    model_asset_hashes[path] = value
    return value


def glb_fingerprints(path: Path) -> dict[str, Any]:
    """Hash POSITION/index structure separately from surface and deformation data."""
    if path in model_glb_fingerprints:
        return model_glb_fingerprints[path]
    with path.open("rb") as handle:
        header = handle.read(12)
        if len(header) != 12 or struct.unpack("<II", header[:8]) != (0x46546C67, 2):
            raise ValueError(f"invalid GLB header: {path}")
        total_length = struct.unpack("<I", header[8:12])[0]
        document: dict[str, Any] | None = None
        binary_offset: int | None = None
        while handle.tell() < total_length:
            chunk_header = handle.read(8)
            if len(chunk_header) != 8:
                raise ValueError(f"truncated GLB chunk header: {path}")
            chunk_length, chunk_type = struct.unpack("<II", chunk_header)
            chunk_offset = handle.tell()
            if chunk_type == 0x4E4F534A:
                document = json.loads(handle.read(chunk_length).decode("utf-8").rstrip("\x00 \t\r\n"))
            elif chunk_type == 0x004E4942:
                binary_offset = chunk_offset
                handle.seek(chunk_length, 1)
            else:
                handle.seek(chunk_length, 1)
    if document is None or binary_offset is None:
        raise ValueError(f"GLB lacks JSON or BIN data: {path}")

    accessors = document.get("accessors") or []
    buffer_views = document.get("bufferViews") or []
    structural_accessor_roles: list[tuple[str, int]] = []
    surface_accessor_roles: list[tuple[str, int]] = []
    deformation_accessor_roles: list[tuple[str, int]] = []
    structural_meshes = []
    material_assignments = []

    def assign_accessor(role: str, semantic: str, accessor_id: Any) -> None:
        if accessor_id is None:
            return
        record = (role, int(accessor_id))
        if semantic == "POSITION" or semantic == "INDICES":
            structural_accessor_roles.append(record)
        elif semantic.startswith("JOINTS_") or semantic.startswith("WEIGHTS_"):
            # Skin deformation is neither the static structural shell nor a
            # surface/material channel.  Keep it in an explicit third contract.
            deformation_accessor_roles.append(record)
        else:
            surface_accessor_roles.append(record)

    for mesh_index, mesh in enumerate(document.get("meshes") or []):
        structural_primitives = []
        for primitive_index, primitive in enumerate(mesh.get("primitives") or []):
            prefix = f"mesh:{mesh_index}:primitive:{primitive_index}"
            attributes = primitive.get("attributes") or {}
            for semantic, accessor_id in sorted(attributes.items()):
                assign_accessor(f"{prefix}:attribute:{semantic}", semantic, accessor_id)
            assign_accessor(f"{prefix}:indices", "INDICES", primitive.get("indices"))
            target_contracts = []
            for target_index, target in enumerate(primitive.get("targets") or []):
                target_semantics = []
                for semantic, accessor_id in sorted(target.items()):
                    assign_accessor(f"{prefix}:target:{target_index}:{semantic}", semantic, accessor_id)
                    if semantic == "POSITION":
                        target_semantics.append("POSITION")
                target_contracts.append(target_semantics)
            structural_primitives.append({
                "mode": primitive.get("mode", 4),
                "position": "POSITION" in attributes,
                "indices": primitive.get("indices") is not None,
                "targets": target_contracts,
            })
            material_assignments.append({
                "mesh": mesh_index,
                "primitive": primitive_index,
                "material": primitive.get("material"),
                "surfaceAttributes": sorted(
                    semantic for semantic in attributes
                    if semantic != "POSITION"
                    and not semantic.startswith("JOINTS_")
                    and not semantic.startswith("WEIGHTS_")
                ),
            })
        structural_meshes.append({"primitives": structural_primitives})

    for skin_index, skin in enumerate(document.get("skins") or []):
        assign_accessor(
            f"skin:{skin_index}:inverseBindMatrices",
            "JOINTS_INVERSE_BIND_MATRICES",
            skin.get("inverseBindMatrices"),
        )
    for animation_index, animation in enumerate(document.get("animations") or []):
        for sampler_index, sampler in enumerate(animation.get("samplers") or []):
            assign_accessor(
                f"animation:{animation_index}:sampler:{sampler_index}:input",
                "JOINTS_ANIMATION_INPUT",
                sampler.get("input"),
            )
            assign_accessor(
                f"animation:{animation_index}:sampler:{sampler_index}:output",
                "JOINTS_ANIMATION_OUTPUT",
                sampler.get("output"),
            )

    structural_nodes = [
        {
            key: node[key] for key in (
                "children", "mesh", "matrix", "translation", "rotation", "scale"
            ) if key in node
        }
        for node in document.get("nodes") or []
    ]
    structural_scenes = [
        {"nodes": scene.get("nodes") or []}
        for scene in document.get("scenes") or []
    ]
    structural_metadata = {
        "scene": document.get("scene"),
        "scenes": structural_scenes,
        "nodes": structural_nodes,
        "meshes": structural_meshes,
        "accessorPolicy": "POSITION-indices-and-morph-target-POSITION-only",
    }
    surface_metadata = {
        "materialAssignments": material_assignments,
        "materials": document.get("materials") or [],
        "textures": document.get("textures") or [],
        "samplers": document.get("samplers") or [],
        "images": document.get("images") or [],
        "accessorPolicy": "NORMAL-TANGENT-TEXCOORD-COLOR-and-custom-non-deformation",
    }
    deformation_metadata = {
        "skins": document.get("skins") or [],
        "animations": document.get("animations") or [],
        "meshWeights": [mesh.get("weights") for mesh in document.get("meshes") or []],
        "nodeDeformation": [
            {key: node[key] for key in ("skin", "weights") if key in node}
            for node in document.get("nodes") or []
        ],
        "accessorPolicy": "JOINTS-WEIGHTS-inverse-bind-matrices-and-animation-samplers",
    }

    component_bytes = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
    type_components = {
        "SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4,
        "MAT2": 4, "MAT3": 9, "MAT4": 16,
    }

    def accessor_element_size(accessor: dict[str, Any]) -> int:
        component_size = component_bytes[int(accessor["componentType"])]
        accessor_type = accessor["type"]
        component_count = type_components[accessor_type]
        # glTF pads each matrix column to a four-byte boundary when its
        # component width is one or two bytes.  Other accessor elements are
        # tightly packed before any bufferView byteStride is applied.
        if accessor_type in {"MAT2", "MAT3"} and component_size < 4:
            column_components = 2 if accessor_type == "MAT2" else 3
            column_count = column_components
            column_size = component_size * column_components
            padded_column_size = (column_size + 3) // 4 * 4
            return column_count * padded_column_size
        return component_size * component_count

    def read_view_bytes(handle: Any, view_id: int, relative_offset: int, byte_length: int) -> bytes:
        view = buffer_views[view_id]
        if int(view.get("buffer", 0)) != 0:
            raise ValueError(f"external GLB buffer is unsupported: {path}")
        view_length = int(view["byteLength"])
        if relative_offset < 0 or byte_length < 0 or relative_offset + byte_length > view_length:
            raise ValueError(f"GLB read exceeds bufferView {view_id}: {path}")
        start = binary_offset + int(view.get("byteOffset", 0)) + relative_offset
        handle.seek(start)
        payload = handle.read(byte_length)
        if len(payload) != byte_length:
            raise ValueError(f"truncated GLB bufferView {view_id}: {path}")
        return payload

    def hash_accessor(handle: Any, digest: Any, role: str, accessor_id: int) -> None:
        accessor = accessors[accessor_id]
        element_size = accessor_element_size(accessor)
        count = int(accessor["count"])
        metadata = {
            key: accessor[key] for key in (
                "componentType", "count", "type", "normalized"
            ) if key in accessor
        }
        digest.update(role.encode("utf-8"))
        digest.update(json.dumps(metadata, sort_keys=True, separators=(",", ":")).encode("utf-8"))
        if accessor.get("bufferView") is None:
            digest.update(bytes(element_size * count))
        else:
            view_id = int(accessor["bufferView"])
            stride = int(buffer_views[view_id].get("byteStride", element_size))
            if stride < element_size:
                raise ValueError(f"invalid GLB accessor stride: {path}")
            relative_offset = int(accessor.get("byteOffset", 0))
            span = 0 if count == 0 else stride * (count - 1) + element_size
            payload = read_view_bytes(handle, view_id, relative_offset, span)
            if stride == element_size:
                digest.update(payload)
            else:
                for index in range(count):
                    start = index * stride
                    digest.update(payload[start:start + element_size])
        sparse = accessor.get("sparse") or {}
        if sparse:
            sparse_count = int(sparse["count"])
            indices = sparse["indices"]
            index_size = component_bytes[int(indices["componentType"])]
            digest.update(b"sparse")
            digest.update(struct.pack("<I", sparse_count))
            digest.update(struct.pack("<I", int(indices["componentType"])))
            digest.update(read_view_bytes(
                handle, int(indices["bufferView"]), int(indices.get("byteOffset", 0)),
                sparse_count * index_size,
            ))
            values = sparse["values"]
            digest.update(read_view_bytes(
                handle, int(values["bufferView"]), int(values.get("byteOffset", 0)),
                sparse_count * element_size,
            ))

    image_view_roles = [
        (f"image:{index}", int(image["bufferView"]))
        for index, image in enumerate(document.get("images") or [])
        if image.get("bufferView") is not None
    ]

    def image_uri_bytes(image: dict[str, Any]) -> bytes:
        uri = image.get("uri")
        if not isinstance(uri, str):
            return b""
        if uri.startswith("data:"):
            header, separator, payload = uri.partition(",")
            if not separator:
                raise ValueError(f"invalid image data URI: {path}")
            return base64.b64decode(payload) if ";base64" in header else unquote_to_bytes(payload)
        parsed = urlparse(uri)
        if parsed.scheme or parsed.netloc:
            # Network I/O would make the regression nondeterministic.  The URI
            # remains in surface metadata, but an external remote asset is not
            # accepted as local image-byte evidence.
            raise ValueError(f"remote GLB image URI is unsupported: {uri}")
        image_path = (path.parent / unquote_to_bytes(uri).decode("utf-8")).resolve()
        if path.parent.resolve() not in image_path.parents and image_path != path.parent.resolve():
            raise ValueError(f"GLB image URI escapes asset directory: {uri}")
        return image_path.read_bytes()

    image_uri_roles = [
        (f"image-uri:{index}", image_uri_bytes(image))
        for index, image in enumerate(document.get("images") or [])
        if image.get("uri") is not None
    ]

    def hash_contract(
        metadata: Any,
        accessor_roles: list[tuple[str, int]],
        raw_view_roles: list[tuple[str, int]] | None = None,
        raw_byte_roles: list[tuple[str, bytes]] | None = None,
    ) -> str:
        digest = hashlib.sha256()
        digest.update(json.dumps(metadata, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"))
        with path.open("rb") as handle:
            for role, accessor_id in accessor_roles:
                hash_accessor(handle, digest, role, accessor_id)
            for role, view_id in raw_view_roles or []:
                view = buffer_views[view_id]
                digest.update(role.encode("utf-8"))
                digest.update(read_view_bytes(handle, view_id, 0, int(view["byteLength"])))
            for role, payload in raw_byte_roles or []:
                digest.update(role.encode("utf-8"))
                digest.update(payload)
        return "sha256:" + digest.hexdigest()

    def referenced_view_ids(accessor_roles: list[tuple[str, int]]) -> set[int]:
        view_ids: set[int] = set()
        for _, accessor_id in accessor_roles:
            accessor = accessors[accessor_id]
            if accessor.get("bufferView") is not None:
                view_ids.add(int(accessor["bufferView"]))
            sparse = accessor.get("sparse") or {}
            for sparse_part in (sparse.get("indices"), sparse.get("values")):
                if sparse_part and sparse_part.get("bufferView") is not None:
                    view_ids.add(int(sparse_part["bufferView"]))
        return view_ids

    structural_views = referenced_view_ids(structural_accessor_roles)
    surface_views = referenced_view_ids(surface_accessor_roles) | {
        view_id for _, view_id in image_view_roles
    }
    deformation_views = referenced_view_ids(deformation_accessor_roles)
    cross_contract_shared_views = (
        (structural_views & surface_views)
        | (structural_views & deformation_views)
        | (surface_views & deformation_views)
    )

    def f32(value: Any) -> float:
        return struct.unpack("<f", struct.pack("<f", float(value)))[0]

    def matrix_multiply(left: list[float], right: list[float]) -> list[float]:
        return [
            f32(sum(left[row + offset * 4] * right[offset + column * 4] for offset in range(4)))
            for column in range(4)
            for row in range(4)
        ]

    def finite_vector(node: dict[str, Any], key: str, length: int, default: list[float]) -> list[float]:
        value = node.get(key, default)
        if (
            not isinstance(value, list)
            or len(value) != length
            or any(not isinstance(item, (int, float)) or isinstance(item, bool) or not math.isfinite(item) for item in value)
        ):
            raise ValueError(f"invalid GLB node {key}: {path}")
        return [float(item) for item in value]

    def local_node_matrix(node: dict[str, Any]) -> list[float]:
        if "matrix" in node:
            if any(key in node for key in ("translation", "rotation", "scale")):
                raise ValueError(f"GLB node declares matrix and TRS: {path}")
            return [f32(value) for value in finite_vector(node, "matrix", 16, [])]
        translation = finite_vector(node, "translation", 3, [0.0, 0.0, 0.0])
        quaternion = finite_vector(node, "rotation", 4, [0.0, 0.0, 0.0, 1.0])
        scale = finite_vector(node, "scale", 3, [1.0, 1.0, 1.0])
        quaternion_length = math.hypot(*quaternion)
        if quaternion_length < 1e-12:
            raise ValueError(f"zero-length GLB node quaternion: {path}")
        x, y, z, w = (value / quaternion_length for value in quaternion)
        xx, xy, xz, xw = x * x, x * y, x * z, x * w
        yy, yz, yw, zz, zw = y * y, y * z, y * w, z * z, z * w
        sx, sy, sz = scale
        return [
            f32((1 - 2 * (yy + zz)) * sx), f32((2 * (xy + zw)) * sx), f32((2 * (xz - yw)) * sx), 0.0,
            f32((2 * (xy - zw)) * sy), f32((1 - 2 * (xx + zz)) * sy), f32((2 * (yz + xw)) * sy), 0.0,
            f32((2 * (xz + yw)) * sz), f32((2 * (yz - xw)) * sz), f32((1 - 2 * (xx + yy)) * sz), 0.0,
            f32(translation[0]), f32(translation[1]), f32(translation[2]), 1.0,
        ]

    def matrix_snapshot(matrix: list[float]) -> list[float]:
        return [round(f32(value), 7) for value in matrix]

    def transform_point(matrix: list[float], point: list[float]) -> list[float]:
        return [
            matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
            matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
            matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
        ]

    scenes = document.get("scenes") or []
    nodes = document.get("nodes") or []
    meshes = document.get("meshes") or []
    if not scenes:
        raise ValueError(f"GLB lacks an auditable scene: {path}")
    if "scene" in document:
        if not isinstance(document["scene"], int) or isinstance(document["scene"], bool):
            raise ValueError(f"invalid GLB default scene: {path}")
        active_scene = document["scene"]
        scene_selection = "declared-active-scene"
    else:
        if len(scenes) != 1:
            raise ValueError(f"GLB has multiple scenes without a default: {path}")
        active_scene = 0
        scene_selection = "single-scene-default"
    if active_scene < 0 or active_scene >= len(scenes):
        raise ValueError(f"GLB default scene is out of range: {path}")
    scene_roots = scenes[active_scene].get("nodes") or []
    if not isinstance(scene_roots, list) or not scene_roots:
        raise ValueError(f"GLB active scene has no roots: {path}")

    identity_matrix = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0]
    visited_nodes: set[int] = set()
    active_path: set[int] = set()
    rendered_mesh_definitions: set[int] = set()
    applied_world_matrices: list[dict[str, Any]] = []
    draw_instance_manifest: list[dict[str, Any]] = []
    world_min = [math.inf, math.inf, math.inf]
    world_max = [-math.inf, -math.inf, -math.inf]
    rendered_vertices = 0
    rendered_triangles = 0.0

    def expand_expected_bounds(accessor: dict[str, Any], world: list[float]) -> None:
        accessor_min = accessor.get("min")
        accessor_max = accessor.get("max")
        if (
            not isinstance(accessor_min, list)
            or len(accessor_min) != 3
            or not isinstance(accessor_max, list)
            or len(accessor_max) != 3
            or any(not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) for value in accessor_min + accessor_max)
        ):
            raise ValueError(f"GLB POSITION accessor lacks finite min/max: {path}")
        for mask in range(8):
            point = transform_point(world, [
                accessor_max[0] if mask & 1 else accessor_min[0],
                accessor_max[1] if mask & 2 else accessor_min[1],
                accessor_max[2] if mask & 4 else accessor_min[2],
            ])
            for axis in range(3):
                world_min[axis] = min(world_min[axis], point[axis])
                world_max[axis] = max(world_max[axis], point[axis])

    def visit_expected_node(node_index: Any, parent_world: list[float]) -> None:
        nonlocal rendered_vertices, rendered_triangles
        if (
            not isinstance(node_index, int)
            or isinstance(node_index, bool)
            or node_index < 0
            or node_index >= len(nodes)
        ):
            raise ValueError(f"invalid GLB active-scene node index: {path}")
        if node_index in active_path:
            raise ValueError(f"cyclic GLB active scene: {path}")
        if node_index in visited_nodes:
            raise ValueError(f"duplicate GLB active-scene node reference: {path}")
        active_path.add(node_index)
        visited_nodes.add(node_index)
        node = nodes[node_index]
        children = node.get("children") or []
        if not isinstance(children, list):
            raise ValueError(f"invalid GLB node children: {path}")
        world = matrix_multiply(parent_world, local_node_matrix(node))
        if "mesh" in node:
            mesh_index = node["mesh"]
            if (
                not isinstance(mesh_index, int)
                or isinstance(mesh_index, bool)
                or mesh_index < 0
                or mesh_index >= len(meshes)
            ):
                raise ValueError(f"invalid GLB node mesh: {path}")
            mesh = meshes[mesh_index]
            instance_primitive_count = 0
            for primitive_index, primitive in enumerate(mesh.get("primitives") or []):
                mode = primitive.get("mode", 4)
                if mode != 4:
                    raise ValueError(f"non-TRIANGLES GLB primitive is unsupported: {path}")
                if primitive.get("targets"):
                    raise ValueError(f"GLB morph target is unsupported: {path}")
                attributes = primitive.get("attributes") or {}
                position_index = attributes.get("POSITION")
                index_accessor_id = primitive.get("indices")
                if (
                    not isinstance(position_index, int)
                    or isinstance(position_index, bool)
                    or position_index < 0
                    or position_index >= len(accessors)
                    or not isinstance(index_accessor_id, int)
                    or isinstance(index_accessor_id, bool)
                    or index_accessor_id < 0
                    or index_accessor_id >= len(accessors)
                ):
                    raise ValueError(f"GLB primitive lacks POSITION or indices: {path}")
                position_accessor = accessors[position_index]
                index_accessor = accessors[index_accessor_id]
                if position_accessor.get("sparse") or index_accessor.get("sparse"):
                    raise ValueError(f"sparse GLB accessor is unsupported by runtime viewer: {path}")
                vertex_count = int(position_accessor["count"])
                index_count = int(index_accessor["count"])
                rendered_vertices += vertex_count
                rendered_triangles += index_count / 3
                instance_primitive_count += 1
                expand_expected_bounds(position_accessor, world)
                draw_instance_manifest.append({
                    "nodeIndex": node_index,
                    "meshIndex": mesh_index,
                    "primitiveIndex": primitive_index,
                    "mode": mode,
                    "positionAccessor": position_index,
                    "indexAccessor": index_accessor_id,
                    "vertexCount": vertex_count,
                    "indexCount": index_count,
                    "worldMatrix": matrix_snapshot(world),
                })
            if instance_primitive_count:
                rendered_mesh_definitions.add(mesh_index)
                applied_world_matrices.append({
                    "nodeIndex": node_index,
                    "meshIndex": mesh_index,
                    "nodeName": node.get("name") or None,
                    "meshName": mesh.get("name") or None,
                    "primitiveCount": instance_primitive_count,
                    "worldMatrix": matrix_snapshot(world),
                })
        for child in children:
            visit_expected_node(child, world)
        active_path.remove(node_index)

    for root_node in scene_roots:
        visit_expected_node(root_node, identity_matrix)
    if not draw_instance_manifest or not math.isfinite(world_min[0]):
        raise ValueError(f"GLB active scene has no rendered triangles: {path}")
    runtime_scene_expectation = {
        "contract": "active-gltf-scene-draw-instances-world-matrix-v1",
        "activeScene": active_scene,
        "sceneSelection": scene_selection,
        "sceneRoots": list(scene_roots),
        "visitedNodeCount": len(visited_nodes),
        "meshes": len(meshes),
        "renderedMeshDefinitionCount": len(rendered_mesh_definitions),
        "meshInstanceCount": len(applied_world_matrices),
        "primitiveInstanceCount": len(draw_instance_manifest),
        "vertices": rendered_vertices,
        "triangles": round(rendered_triangles),
        "worldBounds": {"min": world_min, "max": world_max},
        "worldBoundsPolicy": "transformed-position-accessor-minmax-corners-conservative",
        "appliedWorldMatrices": applied_world_matrices,
        "drawInstanceManifest": draw_instance_manifest,
    }
    runtime_scene_expectation_fingerprint = "sha256:" + hashlib.sha256(
        json.dumps(
            runtime_scene_expectation,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()

    value = {
        "structural": hash_contract(structural_metadata, structural_accessor_roles),
        "surface": hash_contract(
            surface_metadata,
            surface_accessor_roles,
            image_view_roles,
            image_uri_roles,
        ),
        "deformation": hash_contract(deformation_metadata, deformation_accessor_roles),
        "runtimeSceneExpectation": runtime_scene_expectation,
        "runtimeSceneExpectationFingerprint": runtime_scene_expectation_fingerprint,
        "contract": {
            "structuralAccessorRoles": len(structural_accessor_roles),
            "surfaceAccessorRoles": len(surface_accessor_roles),
            "deformationAccessorRoles": len(deformation_accessor_roles),
            "sharedBufferViewsHandledByAccessorSlices": True,
            "crossContractSharedBufferViewCount": len(cross_contract_shared_views),
            "structuralPolicy": "POSITION+indices+morph-target-POSITION+node-transforms+primitive-mode",
            "surfacePolicy": "non-deformation-render-attributes+material-assignments+materials+image-bytes",
            "deformationPolicy": "JOINTS+WEIGHTS+skin+animation",
            "runtimeScenePolicy": "active-scene-draw-instances-with-resolved-world-matrices",
        },
    }
    model_glb_fingerprints[path] = value
    return value


def canvas_probe(page: Any) -> dict[str, Any]:
    return page.evaluate("""() => {
      const canvas = document.querySelector('#tuanjieCanvas');
      const gl = canvas?.getContext('webgl');
      if (!canvas || !gl) return {width: canvas?.width || 0, height: canvas?.height || 0, webgl: false};
      const width = canvas.width;
      const height = canvas.height;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const pixelCount = width * height;
      const stride = Math.max(1, Math.floor(pixelCount / 4096));
      const colors = new Set();
      let checksum = 2166136261;
      let opaqueSamples = 0;
      let samples = 0;
      for (let pixel = 0; pixel < pixelCount; pixel += stride) {
        const offset = pixel * 4;
        const signature = `${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]},${pixels[offset + 3]}`;
        colors.add(signature);
        if (pixels[offset + 3] > 0) opaqueSamples += 1;
        samples += 1;
      }
      for (let offset = 0; offset < pixels.length; offset += 1) {
        checksum ^= pixels[offset];
        checksum = Math.imul(checksum, 16777619);
      }
      return {width, height, webgl: true, samples, opaqueSamples, uniqueColorSamples: colors.size, checksum: checksum >>> 0};
    }""")


def live_m3_structure_probe(page: Any) -> dict[str, Any]:
    """Fingerprint the live face/line geometry that the production renderer owns."""
    return page.evaluate("""() => {
      if (typeof M3D === 'undefined' || !Array.isArray(M3D.faces) || !Array.isArray(M3D.lines)) {
        return {evidenceSource: 'unavailable', fingerprint: null};
      }
      let hash = 2166136261;
      let surfaceHash = 2166136261;
      const hashText = (current, value) => {
        const text = String(value ?? '');
        for (let index = 0; index < text.length; index += 1) {
          current ^= text.charCodeAt(index);
          current = Math.imul(current, 16777619);
        }
        return current;
      };
      const add = value => { hash = hashText(hash, value); };
      const addSurface = value => { surfaceHash = hashText(surfaceHash, value); };
      const addVertices = vertices => {
        for (const vertex of vertices || []) {
          add((vertex || []).map(value => Number(value).toFixed(6)).join(','));
          add(';');
        }
      };
      const digestVertices = vertices => {
        let digest = 2166136261;
        for (const vertex of vertices || []) {
          digest = hashText(digest, (vertex || []).map(value => Number(value).toFixed(6)).join(','));
          digest = hashText(digest, ';');
        }
        return (digest >>> 0).toString(16).padStart(8, '0');
      };
      const visibleFaces = M3D.faces
        .map((face, originalIndex) => ({primitive: face, originalIndex}))
        .filter(item => typeof m3Visible !== 'function' || m3Visible(item.primitive));
      const visibleLines = M3D.lines
        .map((line, originalIndex) => ({primitive: line, originalIndex}))
        .filter(item => typeof m3Visible !== 'function' || m3Visible(item.primitive));
      add(`bounds:${JSON.stringify(M3D.bounds || null)}|`);
      for (const {primitive: face} of visibleFaces) {
        add(`F|${face.name || ''}|${face.layer || ''}|${face.stage ?? ''}|`);
        addVertices(face.v);
      }
      for (const {primitive: line} of visibleLines) {
        add(`L|${line.name || ''}|${line.layer || ''}|${line.stage ?? ''}|`);
        addVertices(line.v);
      }
      const surfaceRecords = [
        ...visibleFaces.map(({primitive: face, originalIndex}) => JSON.stringify({
          primitive: 'face', originalIndex, name: face.name || null,
          stage: face.stage ?? null, layer: face.layer || null,
          worldVertexDigest: digestVertices(face.v),
          color: face.c ?? null, edge: face.edge ?? null,
          alpha: face.alpha ?? 1, material: face.material ?? face.materialKey ?? null,
        })),
        ...visibleLines.map(({primitive: line, originalIndex}) => JSON.stringify({
          primitive: 'line', originalIndex, name: line.name || null,
          stage: line.stage ?? null, layer: line.layer || null,
          worldVertexDigest: digestVertices(line.v),
          color: line.c ?? null, alpha: line.alpha ?? 1,
          width: line.w ?? 1, material: line.material ?? line.materialKey ?? null,
        })),
      ].sort();
      for (const record of surfaceRecords) {
        addSurface(record);
        addSurface(';');
      }
      const primitiveCount = visibleFaces.length + visibleLines.length;
      return {
        evidenceSource: 'live-renderer-visible-face-line-world-geometry',
        fingerprint: `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}:${primitiveCount}`,
        surfaceEvidenceSource: 'live-renderer-visible-face-line-surface-properties',
        surfaceFingerprint: `fnv1a32:${(surfaceHash >>> 0).toString(16).padStart(8, '0')}:${surfaceRecords.length}`,
        surfaceChannels: [
          'primitiveIdentity', 'worldVertexDigest', 'layer', 'color', 'edge',
          'alpha', 'lineWidth', 'materialKey',
        ],
        faceCount: M3D.faces.length,
        lineCount: M3D.lines.length,
        visibleFaceCount: visibleFaces.length,
        visibleLineCount: visibleLines.length,
        bounds: M3D.bounds ? JSON.parse(JSON.stringify(M3D.bounds)) : null,
      };
    }""")


def capture_model(page: Any, model_id: str, path: Path, expected_stats: dict[str, Any], check: str) -> dict[str, Any]:
    page.locator("#tuanjieViewer").scroll_into_view_if_needed()
    page.wait_for_timeout(450)
    stats = page.evaluate("window.__TUANJIE_TEST__.stats()")
    probe = canvas_probe(page)
    capture_state = page.evaluate("""() => {
      const viewer = typeof TUANJIE === 'undefined' ? null : TUANJIE.viewer;
      const canvas = document.querySelector('#tuanjieCanvas');
      const rect = canvas?.getBoundingClientRect();
      return {
        camera: viewer?.camera ? {
          yaw: viewer.camera.yaw,
          pitch: viewer.camera.pitch,
          distance: viewer.camera.distance,
          target: [...viewer.camera.target],
        } : null,
        viewport: {width: window.innerWidth, height: window.innerHeight},
        canvasCss: rect ? {left: rect.left, top: rect.top, width: rect.width, height: rect.height} : null,
      };
    }""")
    page.locator("#tuanjieCanvas").screenshot(path=str(path), timeout=180_000)
    payload = path.read_bytes() if path.is_file() else b""
    asset_path = model_asset_paths.get(model_id)
    asset_sha256 = file_sha256(asset_path) if asset_path else None
    asset_fingerprints = glb_fingerprints(asset_path) if asset_path else {}
    structural_fingerprint = asset_fingerprints.get("structural")
    surface_fingerprint = asset_fingerprints.get("surface")
    fingerprint_contract = asset_fingerprints.get("contract") or {}
    expected_runtime_scene = asset_fingerprints.get("runtimeSceneExpectation")
    runtime_scene = runtime_scene_snapshot(stats)
    runtime_scene_matches_asset = runtime_scene_values_match(runtime_scene, expected_runtime_scene)
    identity_world_matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    runtime_non_identity_matrix_count = sum(
        not runtime_scene_values_match(item.get("worldMatrix"), identity_world_matrix)
        for item in (stats.get("appliedWorldMatrices") or [])
        if isinstance(item, dict)
    )
    contract = reference_capture_contract(page, stats, check)
    contract.update({
        "seed": None,
        "seedPolicy": "source-scan-has-no-procedural-seed",
        "structuralFingerprint": structural_fingerprint,
        "surfaceFingerprint": surface_fingerprint,
        "evidenceLimit": {
            "seed": "N/A: reference GLB models have no procedural weathering seed.",
            "structuralFingerprint": "Derived from the actual GLB structural accessor slices and node transforms.",
            "surfaceFingerprint": "Derived from actual GLB surface accessor slices, material assignments, materials, and image bytes.",
        },
    })
    register_screenshot_contract(path, contract)
    evidence = {
        "modelId": model_id,
        "fileName": path.name,
        "checkItems": ["distinct-reference-model", "real-loaded-WebGL-frame", "production-line-regression"],
        "check": check,
        "expectedSource": expected_stats.get("source"),
        "source": stats.get("source"),
        "sourceAsset": str(asset_path.relative_to(ROOT)) if asset_path else None,
        "sourceSha256": asset_sha256,
        "seed": None,
        "seedPolicy": "source-scan-has-no-procedural-seed",
        "camera": capture_state.get("camera"),
        "viewport": capture_state.get("viewport"),
        "canvasCss": capture_state.get("canvasCss"),
        "structuralFingerprint": structural_fingerprint,
        "structuralFingerprintEvidence": {
            "evidenceSource": "actual-glb-position-index-accessor-slices-and-node-transforms",
            "sourceAsset": str(asset_path.relative_to(ROOT)) if asset_path else None,
            "sourceSha256": asset_sha256,
            "contract": fingerprint_contract,
            "runtimeStructureManifestContract": stats.get("runtimeStructureManifestContract"),
            "runtimeStructureManifest": runtime_scene,
            "expectedRuntimeStructureManifest": expected_runtime_scene,
            "expectedRuntimeStructureManifestFingerprint": asset_fingerprints.get(
                "runtimeSceneExpectationFingerprint"
            ),
            "runtimeStructureManifestMatchesAsset": runtime_scene_matches_asset,
            "runtimeNonIdentityWorldMatrixCount": runtime_non_identity_matrix_count,
        },
        "assetSurfaceFingerprint": asset_fingerprints.get("surface"),
        "surfaceFingerprint": surface_fingerprint,
        "surfaceFingerprintEvidence": {
            "evidenceSource": "actual-glb-surface-accessor-slices-material-and-image-bytes",
            "textures": stats.get("textures"),
            "normalMapActive": stats.get("normalMapActive"),
            "contract": fingerprint_contract,
        },
        "deformationFingerprint": asset_fingerprints.get("deformation"),
        "loaded": stats.get("loaded"),
        "meshes": stats.get("meshes"),
        "vertices": stats.get("vertices"),
        "triangles": stats.get("triangles"),
        "textures": stats.get("textures"),
        "canvas": probe,
        "viewerStructuralFingerprint": stats.get("structuralFingerprint"),
        "structuralRenderFingerprint": stats.get("structuralRenderFingerprint"),
        "runtimeStructureManifest": runtime_scene,
        "runtimeStructureManifestMatchesAsset": runtime_scene_matches_asset,
        "runtimeNonIdentityWorldMatrixCount": runtime_non_identity_matrix_count,
        "fingerprintInputs": stats.get("fingerprintInputs"),
        "captureContract": contract,
        "screenshot": {
            "path": str(path),
            "bytes": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest() if payload else None,
        },
    }
    model_runtime[model_id] = evidence
    add_result(
        f"{model_id} real WebGL frame",
        stats.get("loaded") is True
        and stats.get("source") == expected_stats.get("source")
        and probe.get("webgl") is True
        and probe.get("width", 0) > 100
        and probe.get("height", 0) > 100
        and probe.get("opaqueSamples", 0) > 0
        and probe.get("uniqueColorSamples", 0) > 4
        and stats.get("canvasChecksum") == probe.get("checksum")
        and valid_camera(camera_snapshot(stats))
        and isinstance(stats.get("structuralFingerprint"), str)
        and isinstance(stats.get("structuralRenderFingerprint"), str)
        and isinstance(stats.get("fingerprintInputs"), dict)
        and stats.get("fingerprintInputs", {}).get("canvasChecksum") == probe.get("checksum")
        and evidence.get("camera") is not None
        and evidence.get("structuralFingerprint") is not None
        and evidence.get("surfaceFingerprint") is not None
        and evidence.get("deformationFingerprint") is not None
        and fingerprint_contract.get("structuralAccessorRoles", 0) > 0
        and fingerprint_contract.get("sharedBufferViewsHandledByAccessorSlices") is True
        and fingerprint_contract.get("structuralPolicy")
        == "POSITION+indices+morph-target-POSITION+node-transforms+primitive-mode"
        and fingerprint_contract.get("surfacePolicy")
        == "non-deformation-render-attributes+material-assignments+materials+image-bytes"
        and fingerprint_contract.get("runtimeScenePolicy")
        == "active-scene-draw-instances-with-resolved-world-matrices"
        and stats.get("runtimeStructureManifestContract")
        == "active-gltf-scene-draw-instances-world-matrix-v1"
        and runtime_scene_matches_asset
        and isinstance(runtime_scene, dict)
        and runtime_scene.get("meshInstanceCount") == stats.get("meshInstanceCount")
        and runtime_scene.get("primitiveInstanceCount") == stats.get("primitiveInstanceCount")
        and len(runtime_scene.get("appliedWorldMatrices") or []) == stats.get("meshInstanceCount")
        and len(runtime_scene.get("drawInstanceManifest") or []) == stats.get("primitiveInstanceCount")
        and (model_id not in {"Dali", "Wulong"} or runtime_non_identity_matrix_count > 0)
        and len(payload) > 1_000,
        evidence,
    )
    return evidence


def classify_browser_diagnostics(stats_collection: list[tuple[str, dict[str, Any]]]) -> None:
    optional_contracts: Counter[tuple[str, str, int]] = Counter()
    for page_id, stats in stats_collection:
        for request in stats.get("requestHistory") or stats.get("requests", []):
            status = request.get("status")
            request_id = request.get("id")
            request_url = request.get("url", "")
            if (
                optional_api_request_matches(request_id, request_url)
                and request.get("required") is False
                and request.get("outcome") == "allowed-optional-http"
                and isinstance(status, int)
                and request.get("allowedStatuses") == [403, 429]
                and status in request.get("allowedStatuses", [])
            ):
                optional_contracts[(page_id, request_id, status)] += 1

    for response in http_errors:
        request_id = optional_api_request_id_for_url(response["url"])
        key = (response["pageId"], request_id, response["status"])
        if optional_contracts[key] > 0:
            optional_contracts[key] -= 1
            allowed = dict(response)
            allowed["contract"] = {
                "requestId": request_id,
                "url": response["url"],
                "expectedUrl": optional_api_expected_url(request_id),
                "status": response["status"],
                "pageId": response["pageId"],
                "singleUse": True,
            }
            allowed["consoleMatched"] = False
            allowed_optional_http.append(allowed)
        else:
            add_process_failure("unexpected-http-response", response, failure_type="http")

    for (page_id, request_id, status), unmatched_count in optional_contracts.items():
        if unmatched_count > 0:
            add_process_failure(
                "optional-http-diagnostic-mismatch",
                {
                    "pageId": page_id,
                    "requestId": request_id,
                    "status": status,
                    "expectedUrl": optional_api_expected_url(request_id),
                    "unmatchedCount": unmatched_count,
                },
                failure_type="http",
            )

    for diagnostic in network_console_diagnostics:
        status = diagnostic.get("status")
        location_url = (diagnostic.get("location") or {}).get("url") or ""
        candidates = [
            response for response in allowed_optional_http
            if response["status"] == status
            and response["pageId"] == diagnostic.get("pageId")
            and not response["consoleMatched"]
            and abs(response["capturedMonotonic"] - diagnostic["capturedMonotonic"])
            <= OPTIONAL_CONSOLE_WINDOW_SECONDS
            and (not location_url or location_url == response["url"])
        ]
        if not candidates:
            add_process_failure("unexpected-network-console-error", diagnostic, failure_type="console")
            continue
        matched = min(
            candidates,
            key=lambda response: abs(response["capturedMonotonic"] - diagnostic["capturedMonotonic"]),
        )
        matched["consoleMatched"] = True
        allowed = dict(diagnostic)
        allowed["matchedRequest"] = {
            "url": matched["url"],
            "status": matched["status"],
            "pageId": matched["pageId"],
            "timeDeltaMs": round(
                abs(matched["capturedMonotonic"] - diagnostic["capturedMonotonic"]) * 1000,
                3,
            ),
            "locationUrl": location_url or None,
            "maximumTimeDeltaMs": int(OPTIONAL_CONSOLE_WINDOW_SECONDS * 1000),
            "singleUse": True,
        }
        allowed_network_console.append(allowed)

    for error in page_errors:
        add_process_failure("pageerror", error, failure_type="pageerror")
    for error in console_errors:
        add_process_failure("console-error", error, failure_type="console")
    for failure in failed_requests:
        add_process_failure("failed-request", failure, failure_type="requestfailed")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *args: object) -> None:
        pass


server: ThreadingHTTPServer | None = None
browser = None
try:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        add_process_failure(
            "playwright-import",
            {"message": str(exc), "traceback": traceback.format_exc()},
            failure_type=type(exc).__name__,
        )
        sync_playwright = None

    if sync_playwright is not None:
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        with sync_playwright() as playwright:
            launch_args = [
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--no-sandbox",
            ]
            browser_proxy = chromium_proxy_from_environment()
            if browser_proxy is not None:
                # Playwright's high-level proxy option appends <-loopback>,
                # which sends the local QA server through the proxy despite
                # an explicit bypass. Use Chromium's native switches so the
                # app stays local while exact GitHub URLs use the runner proxy.
                launch_args.extend([
                    f"--proxy-server={browser_proxy}",
                    "--proxy-bypass-list=localhost;127.0.0.1;[::1]",
                ])
            configured_executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
            executable = configured_executable or (
                "/usr/bin/chromium" if Path("/usr/bin/chromium").exists() else None
            )
            if not configured_executable and sys.platform.startswith("win"):
                for candidate in [
                    os.environ.get("CHROME_PATH"),
                    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                ]:
                    if candidate and Path(candidate).exists():
                        executable = candidate
                        break
            try:
                launch_options: dict[str, Any] = {
                    "headless": True,
                    "executable_path": executable,
                    "args": launch_args,
                }
                browser = playwright.chromium.launch(**launch_options)
                page = browser.new_page(
                    viewport={"width": 1440, "height": 1000},
                    device_scale_factor=1,
                    # The managed local runner terminates TLS at its explicit
                    # proxy with a private CA. Limit this exception to that
                    # proxy case; direct CI/browser runs retain normal TLS
                    # verification while all URL/status/content gates remain.
                    ignore_https_errors=browser_proxy is not None,
                )
                bind_page_diagnostics(page, "desktop")
                injected_deployment = {}
                if isinstance(ARGS.run_sha, str) and re.fullmatch(r"[0-9a-fA-F]{40}", ARGS.run_sha):
                    injected_deployment["sha"] = ARGS.run_sha
                if isinstance(ARGS.run_ref, str) and ARGS.run_ref:
                    injected_deployment["ref"] = ARGS.run_ref
                if injected_deployment:
                    page.add_init_script(
                        script="window.__GITHUB_SYNC_DEPLOYMENT__ = " + json.dumps(injected_deployment) + ";"
                    )

                page.goto(f"http://127.0.0.1:{server.server_port}/index.html", wait_until="load", timeout=120_000)
                page.wait_for_function("window.__APP_READY__ === true && !!window.__V521_TEST__", timeout=120_000)
                page.wait_for_timeout(1_000)

                title = page.title()
                add_result("title", VERSION in title, title)
                add_result("canvas", page.locator("#buildingCanvas").count() == 1)
                for selector, name in [
                    ("#m3OpenDemo", "openings button"),
                    ("#m3Tour", "visitor button"),
                    ("#m3Cut", "cutaway button"),
                ]:
                    add_result(name, page.locator(selector).count() == 1)

                state = page.evaluate("window.__V521_TEST__.stats()")
                add_result("WebGL active", not state.get("fallback", True), state)
                add_result("geometry populated", state.get("triangles", 0) > 500 and state.get("lines", 0) > 100)
                add_result("default complete geometry", state["options"]["cut"] is False and state["tour"]["revealUpper"] is False)
                stair_topology = page.evaluate("""() => {
                  const names = [...new Set(M3D.faces.map(face => face.name).filter(Boolean))];
                  const count = (stair, flight) => names.filter(name =>
                    name.startsWith(`${stair}-${flight}-flight-tread-`) && name.endsWith('-of-8')
                  ).length;
                  return {
                    west: {lower: count('west-daily-use-dogleg-stair-16-risers', 'lower'), upper: count('west-daily-use-dogleg-stair-16-risers', 'upper')},
                    east: {lower: count('east-daily-use-dogleg-stair-16-risers', 'lower'), upper: count('east-daily-use-dogleg-stair-16-risers', 'upper')},
                    treadNames: names.filter(name => /daily-use-dogleg-stair-16-risers-(lower|upper)-flight-tread-/.test(name))
                  };
                }""")
                add_result(
                    "8+8 double-flight stair topology",
                    all(
                        stair_topology.get(side, {}).get(flight) == 8
                        for side in ("west", "east")
                        for flight in ("lower", "upper")
                    ),
                    stair_topology,
                )
                tuanjie_layer = state.get("tuanjieLayer") or {}
                add_result("Tuanjie production-layer control", page.locator("#m3Tuanjie").count() == 1)
                add_result(
                    "Tuanjie evidence integrated into main generator",
                    tuanjie_layer.get("enabled") is True
                    and tuanjie_layer.get("integratedInto") == "current-main-generator"
                    and tuanjie_layer.get("standalone") is False
                    and tuanjie_layer.get("wallFaces", 0) > 0
                    and tuanjie_layer.get("roofTiles", 0) > 0
                    and tuanjie_layer.get("timberFaces", 0) > 0,
                    tuanjie_layer,
                )
                page.locator("#m3Tuanjie").click()
                page.wait_for_timeout(120)
                tuanjie_off = page.evaluate("window.__V521_TEST__.stats()")
                add_result(
                    "Tuanjie evidence layer can be disabled",
                    tuanjie_off["options"].get("tuanjie") is False
                    and (tuanjie_off.get("tuanjieLayer") or {}).get("enabled") is False,
                    tuanjie_off.get("tuanjieLayer"),
                )
                page.locator("#m3Tuanjie").click()
                page.wait_for_timeout(120)
                tuanjie_on_again = page.evaluate("window.__V521_TEST__.stats()")
                add_result(
                    "Tuanjie evidence layer can be restored",
                    tuanjie_on_again["options"].get("tuanjie") is True
                    and (tuanjie_on_again.get("tuanjieLayer") or {}).get("enabled") is True,
                    tuanjie_on_again.get("tuanjieLayer"),
                )

                page.locator('[data-branch="measured"]').click()
                page.wait_for_timeout(300)
                measured_text = page.locator("body").inner_text()
                measured_state = page.evaluate("window.__V521_TEST__.stats()")
                add_result("measured case selectable", "三开间带前廊两层建筑" in measured_text)
                add_result("measured dimensions visible", "11.53×7.92米" in measured_text)
                add_result(
                    "measured geometry populated",
                    measured_state.get("triangles", 0) > 500 and measured_state.get("lines", 0) > 100,
                    measured_state,
                )
                measured_layer = measured_state.get("tuanjieLayer") or {}
                add_result(
                    "Tuanjie layer follows measured branch",
                    measured_layer.get("enabled") is True
                    and measured_layer.get("integratedInto") == "current-main-generator"
                    and measured_layer.get("branch") == "measured",
                    measured_layer,
                )
                page.locator('[data-branch="yikeyin"]').click()
                page.wait_for_timeout(300)

                page.evaluate("window.__V521_TEST__.startOpenings()")
                page.wait_for_timeout(3_400)
                opened = page.evaluate("window.__V521_TEST__.stats()")
                add_result(
                    "openings demo",
                    opened["motion"]["gate"] > 0.95
                    and opened["motion"]["windows"] > 0.95
                    and opened["motion"]["inner"] > 0.95,
                    opened["motion"],
                )

                page.evaluate("window.__V521_TEST__.setTourTime(13.2)")
                page.wait_for_timeout(200)
                stair = page.evaluate("window.__V521_TEST__.stats()")
                add_result("visitor climbs stairs", 0.2 < stair.get("personFloor", 0) < 2.7, stair.get("personFloor"))
                page.evaluate("window.__V521_TEST__.setTourTime(24.0)")
                page.wait_for_timeout(200)
                upper = page.evaluate("window.__V521_TEST__.stats()")
                add_result("visitor reaches second floor", abs(upper.get("personFloor", 0) - 2.73) < 0.03, upper.get("personFloor"))
                add_result("tour keeps cutaway disabled", upper["options"]["cut"] is False)
                upper_structure = live_m3_structure_probe(page)
                page.screenshot(path=str(SCREEN), full_page=False)
                production_contract = production_capture_contract(
                    page,
                    upper,
                    "Main production line after openings and visitor reaches the second floor",
                )
                register_screenshot_contract(SCREEN, production_contract)
                add_result(
                    "main production screenshot capture contract",
                    valid_camera(production_contract.get("camera"))
                    and isinstance(production_contract.get("structuralFingerprint"), str)
                    and production_contract.get("seed") is None
                    and production_contract.get("surfaceFingerprint") is None,
                    production_contract,
                )

                page.locator('[data-view="reference"]').click()
                add_result("Tuanjie viewer visible before load", page.locator("#tuanjieViewer").is_visible())
                add_result("Tuanjie local-file control", page.locator("#tuanjieFileInput").count() == 1)

                html_source = (ROOT / "index.html").read_text(encoding="utf-8")
                add_result(
                    "high-precision model has no public URL",
                    "YN_TUANJIE_001_EDITABLE_HIGH.glb" not in html_source
                    and page.locator('[href*="YN_TUANJIE_001_EDITABLE_HIGH.glb"]').count() == 0,
                )
                chooser_detail: dict[str, Any] = {"opened": False}
                try:
                    with page.expect_file_chooser(timeout=5_000) as chooser_info:
                        page.locator("#openTuanjieReference").click()
                    chooser_detail["opened"] = chooser_info.value is not None
                except BaseException as exc:
                    chooser_detail.update({"type": type(exc).__name__, "message": str(exc)})
                add_result("high-precision control opens local file chooser", chooser_detail["opened"], chooser_detail)
                page.wait_for_timeout(200)
                add_result(
                    "high-precision control makes no network request",
                    not forbidden_high_requests,
                    forbidden_high_requests,
                )

                page.locator("#openTuanjieStandard").click()
                page.wait_for_function(
                    "window.__TUANJIE_TEST__.stats().loaded === true && /EDITABLE\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')",
                    timeout=180_000,
                )
                tuanjie_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
                add_result("Tuanjie GLB canvas", page.locator("#tuanjieCanvas").count() == 1)
                add_result(
                    "Tuanjie editable meshes",
                    tuanjie_reference.get("meshes") == 48 and tuanjie_reference.get("primitives") == 48,
                    tuanjie_reference,
                )
                add_result(
                    "Tuanjie geometry",
                    tuanjie_reference.get("triangles") == 464_288
                    and tuanjie_reference.get("animations") == 0
                    and tuanjie_reference.get("skins") == 0
                    and tuanjie_reference.get("cameras") == 0,
                )
                add_result(
                    "Tuanjie standard texture profile",
                    tuanjie_reference.get("textures", {}).get("base", {}).get("width") == 3_072
                    and tuanjie_reference.get("textures", {}).get("base", {}).get("height") == 3_072
                    and tuanjie_reference.get("textures", {}).get("normal", {}).get("width") == 1_024
                    and tuanjie_reference.get("textures", {}).get("normal", {}).get("height") == 1_024,
                    tuanjie_reference.get("textures"),
                )
                add_result(
                    "Tuanjie normal-map rendering",
                    tuanjie_reference.get("normalMapActive") is True,
                    {
                        "normalMapActive": tuanjie_reference.get("normalMapActive"),
                        "maxTextureSize": tuanjie_reference.get("maxTextureSize"),
                        "dpr": tuanjie_reference.get("dpr"),
                    },
                )
                page.locator('[data-tj-group="roof"]').click()
                page.wait_for_timeout(200)
                roof_hidden = page.evaluate("window.__TUANJIE_TEST__.stats()")
                add_result("Tuanjie editable roof group", roof_hidden.get("groups", {}).get("roof") is False, roof_hidden.get("groups"))
                page.locator('[data-tj-group="roof"]').click()
                capture_model(
                    page,
                    "Tuanjie",
                    TUANJIE_SCREEN,
                    page.evaluate("window.__TUANJIE_TEST__.stats()"),
                    "Tuanjie public standard GLB renders a real WebGL frame",
                )

                add_result(
                    "file protocol recovery instruction",
                    "location.protocol==='file:'" in html_source
                    and "YN_TUANJIE_001_EDITABLE.glb" in html_source
                    and "选择本地 GLB" in html_source,
                )
                page.locator("#tuanjieFileInput").set_input_files(str(ROOT / "assets/models/YN_TUANJIE_001_EDITABLE.glb"))
                page.wait_for_function("window.__TUANJIE_TEST__.stats().loaded === true", timeout=120_000)
                local_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
                add_result(
                    "local GLB re-import",
                    local_reference.get("meshes") == 48
                    and local_reference.get("triangles") == 464_288
                    and local_reference.get("source") == "YN_TUANJIE_001_EDITABLE.glb"
                    and local_reference.get("textures", {}).get("base", {}).get("width") == 3_072
                    and local_reference.get("normalMapActive") is True,
                    local_reference,
                )
                capture_model(
                    page,
                    "TuanjieLocal",
                    TUANJIE_LOCAL_SCREEN,
                    local_reference,
                    "Tuanjie local GLB re-import renders a real WebGL frame",
                )

                page.locator("#openDaliReference").click()
                page.wait_for_function(
                    "window.__TUANJIE_TEST__.stats().loaded === true && /YN_DALI_001_REFERENCE_WEB\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')",
                    timeout=180_000,
                )
                dali_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
                add_result(
                    "Dali reference geometry",
                    dali_reference.get("source", "").endswith("YN_DALI_001_REFERENCE_WEB.glb")
                    and dali_reference.get("meshes") == 1
                    and dali_reference.get("triangles") == 997_659
                    and dali_reference.get("vertices") == 809_883,
                    dali_reference,
                )
                add_result(
                    "Dali reference texture profile",
                    dali_reference.get("textures", {}).get("base", {}).get("width") == 4_096
                    and dali_reference.get("textures", {}).get("base", {}).get("height") == 4_096,
                    dali_reference.get("textures"),
                )
                capture_model(
                    page,
                    "Dali",
                    DALI_SCREEN,
                    dali_reference,
                    "Dali reference GLB renders a real WebGL frame",
                )

                page.locator("#openWulongReference").click()
                page.wait_for_function(
                    "window.__TUANJIE_TEST__.stats().loaded === true && /YN_HAOSI1_WULONG_WL_001_REFERENCE_WEB\\.glb$/.test(window.__TUANJIE_TEST__.stats().source || '')",
                    timeout=180_000,
                )
                wulong_reference = page.evaluate("window.__TUANJIE_TEST__.stats()")
                add_result(
                    "Wulong reference geometry",
                    wulong_reference.get("source", "").endswith("YN_HAOSI1_WULONG_WL_001_REFERENCE_WEB.glb")
                    and wulong_reference.get("meshes") == 1
                    and wulong_reference.get("triangles") == 300_084
                    and wulong_reference.get("vertices") == 357_794,
                    wulong_reference,
                )
                add_result(
                    "Wulong reference texture profile",
                    wulong_reference.get("textures", {}).get("base", {}).get("width") == 4_096
                    and wulong_reference.get("textures", {}).get("base", {}).get("height") == 4_096
                    and wulong_reference.get("textures", {}).get("normal", {}).get("width") == 2_048
                    and wulong_reference.get("textures", {}).get("normal", {}).get("height") == 2_048,
                    wulong_reference.get("textures"),
                )
                capture_model(
                    page,
                    "Wulong",
                    WULONG_SCREEN,
                    wulong_reference,
                    "Wulong reference GLB renders a real WebGL frame",
                )

                runtime_hashes = [model_runtime[name]["screenshot"]["sha256"] for name in ("Tuanjie", "Dali", "Wulong")]
                runtime_checksums = [model_runtime[name]["canvas"]["checksum"] for name in ("Tuanjie", "Dali", "Wulong")]
                runtime_sources = [model_runtime[name]["source"] for name in ("Tuanjie", "Dali", "Wulong")]
                add_result(
                    "three reference models produce distinct rendered frames",
                    all(runtime_hashes)
                    and all(isinstance(checksum, int) for checksum in runtime_checksums)
                    and len(set(runtime_sources)) == 3
                    and len(set(runtime_hashes)) == 3
                    and len(set(runtime_checksums)) == 3,
                    {
                        "sources": runtime_sources,
                        "screenshotSha256": runtime_hashes,
                        "canvasChecksums": runtime_checksums,
                    },
                )

                add_result("GitHub sync bridge", page.evaluate("!!window.__GITHUB_SYNC__"))
                page.wait_for_function(
                    "window.__GITHUB_SYNC__.stats().refreshState === 'complete'",
                    timeout=120_000,
                )
                refresh_generation = page.evaluate("window.__GITHUB_SYNC__.stats().refreshGeneration || 0")
                page.locator("#githubSyncLauncher").click()
                page.evaluate("() => { window.__GITHUB_SYNC__.refresh(true); }")
                page.wait_for_function(
                    "(previous) => { const stats = window.__GITHUB_SYNC__.stats(); return stats.refreshGeneration > previous && stats.refreshState === 'complete'; }",
                    arg=refresh_generation,
                    timeout=120_000,
                )
                add_result(
                    "GitHub sync panel",
                    page.locator("#githubSyncOverlay").is_visible() and page.locator("#githubSyncAdd").count() == 1,
                )
                sync_stats = page.evaluate("window.__GITHUB_SYNC__.stats()")
                required_requests = [request for request in sync_stats.get("requests", []) if request.get("required")]
                deployment = sync_stats.get("deployment") or {}
                add_result(
                    "GitHub sync uses commit under test",
                    deployment.get("headSha") == ARGS.run_sha
                    and deployment.get("revision") == ARGS.run_sha
                    and deployment.get("ref") == ARGS.run_sha
                    and deployment.get("branch") == ARGS.run_ref
                    and deployment.get("source") == "runtime-injected"
                    and deployment.get("ready") is True,
                    deployment,
                )
                add_result(
                    "GitHub sync required source reads",
                    sync_stats.get("schemaVersion") == VERSION
                    and not sync_stats.get("error")
                    and not sync_stats.get("deploymentError")
                    and sync_stats.get("files") == 4
                    and len(required_requests) == 4
                    and all(request.get("outcome") == "fulfilled" and request.get("status") == 200 for request in required_requests),
                    sync_stats,
                )
                optional_requests = [request for request in sync_stats.get("requests", []) if request.get("required") is False]
                add_result(
                    "GitHub sync optional requests explicitly modeled",
                    optional_api_stats_contract_matches(sync_stats),
                    {
                        "requests": optional_requests,
                        "expectedUrls": {
                            request_id: optional_api_expected_url(request_id)
                            for request_id in OPTIONAL_API_CONTRACTS
                        },
                    },
                )

                # Release the desktop GLB buffers and 4K texture before the
                # independent mobile capture. This keeps the screenshot bound
                # to the live mobile renderer instead of contending with a
                # hidden desktop WebGL context in constrained CI/SwiftShader.
                page.close()
                mobile_page = browser.new_page(
                    viewport={"width": 390, "height": 844},
                    device_scale_factor=1,
                    ignore_https_errors=browser_proxy is not None,
                )
                bind_page_diagnostics(mobile_page, "mobile")
                if injected_deployment:
                    mobile_page.add_init_script(
                        script="window.__GITHUB_SYNC_DEPLOYMENT__ = " + json.dumps(injected_deployment) + ";"
                    )
                mobile_page.goto(
                    f"http://127.0.0.1:{server.server_port}/index.html",
                    wait_until="load",
                    timeout=120_000,
                )
                mobile_page.wait_for_function("window.__APP_READY__ === true && !!window.__V521_TEST__", timeout=120_000)
                # setView() updates the fragment with history.replaceState.
                # The control has no document navigation; do not let
                # Playwright mistake that fragment update for a navigation
                # whose completion should block the real renderer assertion.
                mobile_page.locator('[data-view="building"]').click(no_wait_after=True)
                mobile_page.wait_for_function(
                    "document.querySelector('#buildingCanvas') && window.__V521_TEST__.stats().fallback === false",
                    timeout=120_000,
                )
                mobile_page.wait_for_function(
                    "window.__GITHUB_SYNC__.stats().refreshState === 'complete'",
                    timeout=120_000,
                )
                mobile_sync_stats = mobile_page.evaluate("window.__GITHUB_SYNC__.stats()")
                mobile_state = mobile_page.evaluate("window.__V521_TEST__.stats()")
                mobile_required = [
                    request for request in mobile_sync_stats.get("requests", []) if request.get("required")
                ]
                mobile_deployment = mobile_sync_stats.get("deployment") or {}
                add_result(
                    "mobile GitHub sync uses commit under test",
                    mobile_deployment.get("headSha") == ARGS.run_sha
                    and mobile_deployment.get("revision") == ARGS.run_sha
                    and mobile_deployment.get("ref") == ARGS.run_sha
                    and mobile_deployment.get("branch") == ARGS.run_ref
                    and mobile_deployment.get("source") == "runtime-injected"
                    and mobile_deployment.get("ready") is True,
                    mobile_deployment,
                )
                add_result(
                    "mobile GitHub sync required source reads",
                    len(mobile_required) == 4
                    and all(
                        request.get("outcome") == "fulfilled" and request.get("status") == 200
                        for request in mobile_required
                    ),
                    mobile_sync_stats,
                )
                mobile_optional = [
                    request for request in mobile_sync_stats.get("requests", [])
                    if request.get("required") is False
                ]
                add_result(
                    "mobile GitHub sync optional requests explicitly modeled",
                    optional_api_stats_contract_matches(mobile_sync_stats),
                    {
                        "requests": mobile_optional,
                        "expectedUrls": {
                            request_id: optional_api_expected_url(request_id)
                            for request_id in OPTIONAL_API_CONTRACTS
                        },
                    },
                )
                mobile_metrics = mobile_page.evaluate("""() => {
                  const root = document.documentElement;
                  const body = document.body;
                  const canvas = document.querySelector('#buildingCanvas')?.getBoundingClientRect();
                  const controls = ['#m3OpenDemo', '#m3Tour', '#m3Cut'].map(selector => {
                    const rect = document.querySelector(selector)?.getBoundingClientRect();
                    return {
                      selector,
                      left: rect?.left ?? null,
                      right: rect?.right ?? null,
                      width: rect?.width || 0,
                      height: rect?.height || 0
                    };
                  });
                  const layoutSelectors = [
                    '.app', '.topbar', '.shell', '.workspace', '.toolbar',
                    '.tabs', '.tools', '.viewport', '.model3dWrap',
                    '.modelHud', '.modelControls', '.status', '.stageCtl'
                  ];
                  const layoutBoxes = layoutSelectors.map(selector => {
                    const rect = document.querySelector(selector)?.getBoundingClientRect();
                    return {
                      selector,
                      left: rect?.left ?? null,
                      right: rect?.right ?? null,
                      width: rect?.width || 0,
                      height: rect?.height || 0
                    };
                  });
                  const overflowingElements = [...document.body.querySelectorAll('*')]
                    .map(element => {
                      const rect = element.getBoundingClientRect();
                      return {
                        tag: element.tagName.toLowerCase(),
                        id: element.id || null,
                        className: typeof element.className === 'string' ? element.className : null,
                        left: rect.left,
                        right: rect.right,
                        width: rect.width,
                        height: rect.height
                      };
                    })
                    .filter(item => item.width > 0 && item.height > 0 && (item.left < -1 || item.right > window.innerWidth + 1))
                    .slice(0, 40);
                  return {
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight,
                    scrollWidth: Math.max(root.scrollWidth, body.scrollWidth),
                    canvas: canvas ? {left: canvas.left, right: canvas.right, width: canvas.width, height: canvas.height} : null,
                    controls,
                    layoutBoxes,
                    overflowingElements
                  };
                }""")
                add_result(
                    "390px mobile layout",
                    mobile_metrics.get("innerWidth") == 390
                    and mobile_metrics.get("innerHeight") == 844
                    and mobile_metrics.get("scrollWidth", 9999) <= 391
                    and mobile_metrics.get("canvas") is not None
                    and mobile_metrics["canvas"].get("left", -1) >= 0
                    and mobile_metrics["canvas"].get("right", 9999) <= 391
                    and mobile_metrics["canvas"].get("width", 0) > 0
                    and mobile_metrics["canvas"].get("height", 0) > 0
                    and all(
                        control.get("width", 0) > 0
                        and control.get("height", 0) > 0
                        and control.get("left") is not None
                        and control.get("left", -1) >= -1
                        and control.get("right", 9999) <= 391
                        for control in mobile_metrics.get("controls", [])
                    )
                    and all(
                        box.get("width", 0) > 0
                        and box.get("height", 0) > 0
                        and box.get("left") is not None
                        and box.get("left", -1) >= -1
                        and box.get("right", 9999) <= 391
                        for box in mobile_metrics.get("layoutBoxes", [])
                    )
                    and not mobile_metrics.get("overflowingElements"),
                    mobile_metrics,
                )
                mobile_state = mobile_page.evaluate("window.__V521_TEST__.stats()")
                mobile_structure = live_m3_structure_probe(mobile_page)
                mobile_page.screenshot(
                    path=str(MOBILE_SCREEN),
                    full_page=False,
                    timeout=180_000,
                )
                mobile_contract = production_capture_contract(
                    mobile_page,
                    mobile_state,
                    "Complete production line at the strict 390x844 mobile viewport",
                )
                register_screenshot_contract(MOBILE_SCREEN, mobile_contract)
                add_result(
                    "mobile screenshot capture contract",
                    mobile_contract.get("viewport", {}).get("width") == 390
                    and mobile_contract.get("viewport", {}).get("height") == 844
                    and valid_camera(mobile_contract.get("camera"))
                    and isinstance(mobile_contract.get("structuralFingerprint"), str)
                    and mobile_contract.get("seed") is None
                    and mobile_contract.get("surfaceFingerprint") is None,
                    mobile_contract,
                )
                mobile_page.close()
            finally:
                if browser is not None:
                    try:
                        browser.close()
                    except BaseException as exc:
                        add_process_failure(
                            "browser-cleanup",
                            {"message": str(exc), "traceback": traceback.format_exc()},
                            failure_type=type(exc).__name__,
                        )
                    browser = None
except BaseException as exc:
    add_process_failure(
        "uncaught-test-exception",
        {"message": str(exc), "traceback": traceback.format_exc()},
        failure_type=type(exc).__name__,
    )
finally:
    if server is not None:
        try:
            server.shutdown()
            server.server_close()
        except BaseException as exc:
            add_process_failure(
                "local-server-cleanup",
                {"message": str(exc), "traceback": traceback.format_exc()},
                failure_type=type(exc).__name__,
            )

classify_browser_diagnostics([("desktop", sync_stats), ("mobile", mobile_sync_stats)])

expected_screenshots = [SCREEN, TUANJIE_SCREEN, TUANJIE_LOCAL_SCREEN, DALI_SCREEN, WULONG_SCREEN, MOBILE_SCREEN]
required_contract_keys = {
    "check",
    "captureContract",
    "viewport",
    "camera",
    "seed",
    "structuralFingerprint",
    "surfaceFingerprint",
    "evidenceLimit",
}
for path in expected_screenshots:
    if not path.is_file():
        add_process_failure(
            "missing-regression-screenshot",
            {"filename": path.name},
            failure_type="evidence",
        )
for path in expected_screenshots:
    if not path.is_file():
        continue
    contract = screenshot_contracts.get(path)
    if (
        not isinstance(contract, dict)
        or not required_contract_keys.issubset(contract)
        or not isinstance(contract.get("check"), str)
        or not isinstance(contract.get("captureContract"), dict)
        or not isinstance(contract.get("viewport"), dict)
        or not valid_camera(contract.get("camera"))
        or not isinstance(contract.get("structuralFingerprint"), str)
        or not isinstance(contract.get("evidenceLimit"), dict)
        or (contract.get("seed") is None and not contract.get("evidenceLimit", {}).get("seed"))
        or (
            contract.get("surfaceFingerprint") is None
            and not contract.get("evidenceLimit", {}).get("surfaceFingerprint")
        )
    ):
        add_process_failure(
            "invalid-regression-screenshot-contract",
            {"filename": path.name, "contract": contract},
            failure_type="evidence",
        )

screenshots = []
model_evidence_by_filename = {
    evidence.get("fileName"): evidence for evidence in model_runtime.values()
    if evidence.get("fileName")
}
for path in expected_screenshots:
    if not path.is_file():
        continue
    payload = path.read_bytes()
    screenshot = {
        "name": path.name,
        "filename": path.name,
        "fileName": path.name,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        **screenshot_contracts.get(path, {}),
    }
    model_evidence = model_evidence_by_filename.get(path.name)
    if model_evidence:
        screenshot.update({
            "checkItems": model_evidence["checkItems"],
            "camera": model_evidence["camera"],
            "seed": model_evidence["seed"],
            "seedPolicy": model_evidence["seedPolicy"],
            "structuralFingerprint": model_evidence["structuralFingerprint"],
            "structuralFingerprintEvidence": model_evidence["structuralFingerprintEvidence"],
            "surfaceFingerprint": model_evidence["surfaceFingerprint"],
            "surfaceFingerprintEvidence": model_evidence["surfaceFingerprintEvidence"],
            "viewport": model_evidence["viewport"],
        })
    else:
        runtime_state = mobile_state if path == MOBILE_SCREEN else upper
        runtime_structure = mobile_structure if path == MOBILE_SCREEN else upper_structure
        screenshot.update({
            "checkItems": ["complete-production-line", "visitor-and-opening-regression"]
            if path == SCREEN else ["mobile-390x844-production-line"],
            "camera": (runtime_state or {}).get("camera"),
            "seed": None,
            "seedPolicy": "legacy-production-view-has-no-procedural-seed",
            "structuralFingerprint": (runtime_structure or {}).get("fingerprint"),
            "structuralFingerprintEvidence": runtime_structure,
            "surfaceFingerprint": (runtime_structure or {}).get("surfaceFingerprint"),
            "surfaceFingerprintEvidence": {
                "evidenceSource": (runtime_structure or {}).get("surfaceEvidenceSource"),
                "channels": (runtime_structure or {}).get("surfaceChannels"),
            },
            "viewport": {"width": 390, "height": 844}
            if path == MOBILE_SCREEN else {"width": 1440, "height": 1000},
        })
    screenshots.append(screenshot)

add_result(
    "all production regression screenshots have complete QA metadata",
    len(screenshots) == 6
    and all(
        item.get("camera") is not None
        and "seed" in item
        and item.get("seedPolicy")
        and item.get("structuralFingerprint")
        and (item.get("structuralFingerprintEvidence") or {}).get("evidenceSource")
        in {
            "actual-glb-position-index-accessor-slices-and-node-transforms",
            "live-renderer-visible-face-line-world-geometry",
        }
        and item.get("surfaceFingerprint")
        and (item.get("surfaceFingerprintEvidence") or {}).get("evidenceSource")
        in {
            "actual-glb-surface-accessor-slices-material-and-image-bytes",
            "live-renderer-visible-face-line-surface-properties",
        }
        and item.get("viewport")
        and item.get("fileName")
        and item.get("checkItems")
        for item in screenshots
    ),
    screenshots,
)

assertion_passed = sum(1 for item in results if item.get("ok"))
assertion_failed = len(results) - assertion_passed
process_failure_count = len(process_failures)
summary = {
    "passed": assertion_passed,
    "assertionFailed": assertion_failed,
    "processFailures": process_failure_count,
    "failed": assertion_failed + process_failure_count,
    "total": assertion_passed + assertion_failed + process_failure_count,
}
report = {
    "schemaVersion": VERSION,
    "version": VERSION,
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "runSha": ARGS.run_sha,
    "sourceRef": ARGS.run_ref,
    "runRef": ARGS.run_ref,
    "viewport": {"width": 1440, "height": 1000},
    "performance": {
        "initial": state,
        "measuredBranch": measured_state,
        "upperFloorRegression": upper,
        "mobile": mobile_state,
    },
    "modelRuntime": model_runtime,
    "githubSync": sync_stats,
    "mobileGithubSync": mobile_sync_stats,
    "screenshots": screenshots,
    "results": results,
    "processFailures": process_failures,
    "errors": process_failures,
    "diagnostics": {
        "pageErrors": page_errors,
        "consoleErrors": console_errors,
        "networkConsoleDiagnostics": network_console_diagnostics,
        "failedRequests": failed_requests,
        "httpErrors": http_errors,
        "forbiddenHighRequests": forbidden_high_requests,
        "allowedOptionalHttp": allowed_optional_http,
        "allowedNetworkConsole": allowed_network_console,
    },
    "summary": summary,
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(summary, ensure_ascii=False))
if summary["failed"]:
    raise SystemExit(1)
