#!/usr/bin/env python3
"""Create a GitHub-Pages-safe GLB by downscaling embedded PNG textures only.

Geometry, node hierarchy, accessors, materials and texture semantics remain
unchanged. The source GLB is never overwritten; this script writes a new
binary GLB with the same bufferView ordering and resized image bufferViews.
"""
from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

from PIL import Image


def read_glb(path: Path):
    raw = path.read_bytes()
    if raw[:4] != b"glTF":
        raise ValueError(f"not a GLB file: {path}")
    version, length = struct.unpack_from("<II", raw, 4)
    if version != 2 or length != len(raw):
        raise ValueError(f"unsupported GLB header: version={version}, length={length}, bytes={len(raw)}")
    offset = 12
    json_bytes = None
    bin_bytes = b""
    while offset < length:
        chunk_length, chunk_type = struct.unpack_from("<I4s", raw, offset)
        offset += 8
        chunk = raw[offset:offset + chunk_length]
        offset += chunk_length
        if chunk_type == b"JSON":
            json_bytes = chunk
        elif chunk_type == b"BIN\x00":
            bin_bytes = chunk
    if json_bytes is None:
        raise ValueError(f"GLB has no JSON chunk: {path}")
    return json.loads(json_bytes.rstrip(b" \t\r\n\x00").decode("utf-8")), bin_bytes


def encode_glb(doc: dict, binary: bytes) -> bytes:
    json_chunk = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    binary = binary + b"\x00" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(json_chunk) + 8 + len(binary)
    return b"glTF" + struct.pack("<II", 2, total) + struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk + struct.pack("<I4s", len(binary), b"BIN\x00") + binary


def resized_image(image_bytes: bytes, image_name: str, target: int):
    if target <= 0:
        return image_bytes, None
    from io import BytesIO
    with Image.open(BytesIO(image_bytes)) as image:
        original_size = image.size
        if max(original_size) <= target:
            return image_bytes, {"name": image_name, "sourceSize": original_size, "targetSize": original_size, "changed": False, "bytes": len(image_bytes)}
        image = image.convert("RGBA") if "A" in image.getbands() else image.convert("RGB")
        scale = target / max(original_size)
        size = (max(1, round(original_size[0] * scale)), max(1, round(original_size[1] * scale)))
        image = image.resize(size, Image.Resampling.LANCZOS)
        out = BytesIO()
        image.save(out, format="PNG", optimize=True, compress_level=9)
        encoded = out.getvalue()
    if len(encoded) >= len(image_bytes):
        return image_bytes, {"name": image_name, "sourceSize": original_size, "targetSize": original_size, "changed": False, "bytes": len(image_bytes), "reason": "resized output was not smaller"}
    return encoded, {"name": image_name, "sourceSize": original_size, "targetSize": size, "changed": True, "bytes": len(encoded), "sourceBytes": len(image_bytes)}


def build(source: Path, output: Path, image_max: int, normal_max: int):
    doc, original_bin = read_glb(source)
    buffer_views = doc.get("bufferViews", [])
    images = doc.get("images", [])
    replacements: dict[int, bytes] = {}
    image_reports = []
    for image in images:
        view_index = image.get("bufferView")
        if view_index is None or view_index >= len(buffer_views):
            continue
        view = buffer_views[view_index]
        start = view.get("byteOffset", 0)
        end = start + view["byteLength"]
        payload = original_bin[start:end]
        name = image.get("name", "").lower()
        target = normal_max if "normal" in name or "rough" in name else image_max
        encoded, report = resized_image(payload, image.get("name", "image"), target)
        if report:
            image_reports.append(report)
        replacements[view_index] = encoded

    rebuilt = bytearray()
    for index, view in enumerate(buffer_views):
        rebuilt.extend(b"\x00" * ((4 - len(rebuilt) % 4) % 4))
        view["byteOffset"] = len(rebuilt)
        old_start = view.get("byteOffset", 0)
        # byteOffset was updated above, so use the original payload via the
        # replacement map or the source slice captured from the original view.
        # The source offset is recovered from the old byteLength and the
        # original view table kept in _original_views below.
        payload = replacements.get(index)
        if payload is None:
            original_view = _original_views[index]
            start = original_view.get("byteOffset", 0)
            payload = original_bin[start:start + original_view["byteLength"]]
        rebuilt.extend(payload)
        view["byteLength"] = len(payload)
    if doc.get("buffers"):
        doc["buffers"][0]["byteLength"] = len(rebuilt)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encode_glb(doc, bytes(rebuilt)))
    return image_reports, len(original_bin), len(rebuilt)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--image-max-dim", type=int, default=4096)
    parser.add_argument("--normal-max-dim", type=int, default=2048)
    args = parser.parse_args()
    global _original_views
    doc, _ = read_glb(args.input)
    _original_views = [dict(view) for view in doc.get("bufferViews", [])]
    reports, old_bin, new_bin = build(args.input, args.output, args.image_max_dim, args.normal_max_dim)
    print(json.dumps({"input": str(args.input), "output": str(args.output), "images": reports, "sourceBinBytes": old_bin, "outputBinBytes": new_bin, "outputBytes": args.output.stat().st_size}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
