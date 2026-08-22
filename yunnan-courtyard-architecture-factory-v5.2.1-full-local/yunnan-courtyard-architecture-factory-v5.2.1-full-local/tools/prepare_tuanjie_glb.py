#!/usr/bin/env python3
"""Build editable GLB quality profiles for YN_TUANJIE_001.

The source scan remains private and untouched.  This script creates one
uncompressed glTF 2.0 GLB with stable ASCII names, an explicit spatial
hierarchy, embedded textures and evidence-boundary metadata.  ``high`` keeps
the source texture resolution; ``web`` creates the lighter browser profile.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "references-private/c2-meirenkao/C2_Meirenkao_Reference_High.glb"
DEFAULT_OUTPUT = ROOT / "assets/models/YN_TUANJIE_001_EDITABLE.glb"
HIGH_OUTPUT = ROOT / "assets/models/YN_TUANJIE_001_EDITABLE_HIGH.glb"

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def align4(data: bytearray, pad: int = 0) -> None:
    while len(data) % 4:
        data.append(pad)


def read_glb(path: Path) -> tuple[dict, bytes]:
    raw = path.read_bytes()
    if len(raw) < 20:
        raise ValueError("GLB is too short")
    magic, version, declared = struct.unpack_from("<III", raw, 0)
    if magic != 0x46546C67 or version != 2 or declared != len(raw):
        raise ValueError("Not a valid glTF 2.0 GLB")
    offset = 12
    document = None
    binary = None
    while offset < len(raw):
        length, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        payload = raw[offset : offset + length]
        offset += length
        if kind == JSON_CHUNK:
            document = json.loads(payload.rstrip(b" \t\r\n\0").decode("utf-8"))
        elif kind == BIN_CHUNK:
            binary = payload
    if document is None or binary is None:
        raise ValueError("GLB must contain JSON and BIN chunks")
    return document, binary


def write_glb(path: Path, document: dict, binary: bytes) -> None:
    json_bytes = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    binary += b"\0" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    out = bytearray(struct.pack("<III", 0x46546C67, 2, total))
    out += struct.pack("<II", len(json_bytes), JSON_CHUNK) + json_bytes
    out += struct.pack("<II", len(binary), BIN_CHUNK) + binary
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(out)


def image_bytes(document: dict, binary: bytes, image_index: int) -> bytes:
    image = document["images"][image_index]
    view = document["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    return binary[start : start + view["byteLength"]]


def texture_source(document: dict, texture_index: int) -> int:
    texture = document["textures"][texture_index]
    source = texture.get("source")
    if source is None:
        source = texture.get("extensions", {}).get("KHR_texture_basisu", {}).get("source")
    if source is None:
        raise ValueError(f"Texture {texture_index} has no image source")
    return source


def resize_base_color(payload: bytes, maximum: int) -> tuple[bytes, tuple[int, int], bool, str]:
    with Image.open(io.BytesIO(payload)) as source:
        had_alpha = "A" in source.getbands()
        alpha_is_opaque = True
        if had_alpha:
            lo, hi = source.getchannel("A").getextrema()
            alpha_is_opaque = lo == hi == 255
        image = source.convert("RGB" if alpha_is_opaque else "RGBA")
        image.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        if alpha_is_opaque:
            image.save(output, "JPEG", quality=88, subsampling=0, optimize=True, progressive=True)
            mime_type = "image/jpeg"
        else:
            image.save(output, "PNG", optimize=True)
            mime_type = "image/png"
        return output.getvalue(), image.size, alpha_is_opaque, mime_type


def resize_normal(payload: bytes, maximum: int) -> tuple[bytes, tuple[int, int]]:
    with Image.open(io.BytesIO(payload)) as source:
        image = source.convert("RGB")
        image.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, "PNG", optimize=True)
        return output.getvalue(), image.size


def rename_and_group(document: dict) -> None:
    nodes = document["nodes"]
    meshes = document["meshes"]
    if len(nodes) != 49 or len(meshes) != 48:
        raise ValueError(f"Unexpected source hierarchy: {len(nodes)} nodes, {len(meshes)} meshes")

    stable_names = ["YN_TUANJIE_001_SITE_BASE_STAIRS"]
    stable_names.extend(f"YN_TUANJIE_001_DETAIL_{i:03d}" for i in range(1, 45))
    stable_names.extend(
        [
            "YN_TUANJIE_001_LEVEL_01_SCAN",
            "YN_TUANJIE_001_LEVEL_02_SCAN",
            "YN_TUANJIE_001_ROOF_SCAN",
        ]
    )
    roles = ["site-base-and-steps"] + ["unresolved-scan-detail"] * 44 + [
        "level-01-spatial-scan",
        "level-02-spatial-scan",
        "roof-spatial-scan",
    ]

    for index, (name, role) in enumerate(zip(stable_names, roles)):
        node = nodes[index]
        node["name"] = name
        node["extras"] = {
            **node.get("extras", {}),
            "sampleId": "YN_TUANJIE_001",
            "role": role,
            "semanticStatus": "spatial-reference-only",
            "warning": "Scan partition; not a verified BIM component.",
        }
        if "mesh" in node:
            meshes[node["mesh"]]["name"] = name
            meshes[node["mesh"]]["extras"] = {
                "sampleId": "YN_TUANJIE_001",
                "semanticStatus": "spatial-reference-only",
            }

    groups = [
        ("YN_TUANJIE_001_GROUP_SITE", [0], "site"),
        ("YN_TUANJIE_001_GROUP_DETAILS_UNRESOLVED", list(range(1, 45)), "unresolved-details"),
        ("YN_TUANJIE_001_GROUP_LEVEL_01", [45], "level-01"),
        ("YN_TUANJIE_001_GROUP_LEVEL_02", [46], "level-02"),
        ("YN_TUANJIE_001_GROUP_ROOF", [47], "roof"),
    ]
    group_indices = []
    for name, children, role in groups:
        group_indices.append(len(nodes))
        nodes.append(
            {
                "name": name,
                "children": children,
                "extras": {
                    "sampleId": "YN_TUANJIE_001",
                    "role": role,
                    "semanticStatus": "coarse-spatial-group",
                },
            }
        )

    root = nodes[48]
    root["name"] = "YN_TUANJIE_001_ROOT"
    root["children"] = group_indices
    root["extras"] = {
        **root.get("extras", {}),
        "sampleId": "YN_TUANJIE_001",
        "location": "Yunnan Tuanjie Township (user confirmed)",
        "physicalScaleStatus": "unverified-no-survey-control",
        "editingBoundary": "Editable scan hierarchy, not parametric BIM.",
    }
    scene_index = document.get("scene", 0)
    document["scenes"][scene_index]["name"] = "YN_TUANJIE_001_EDITABLE_SCENE"
    document["scenes"][scene_index]["nodes"] = [48]


def repack(document: dict, binary: bytes, base_max: int, normal_max: int) -> tuple[dict, bytes, dict]:
    if document.get("animations") or document.get("skins") or document.get("cameras"):
        raise ValueError("Source unexpectedly contains animations, skins, or cameras")
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            for target in primitive.get("targets", []):
                if target:
                    raise ValueError("Source unexpectedly contains morph targets")

    material = document["materials"][0]
    pbr = material["pbrMetallicRoughness"]
    base_image_index = texture_source(document, pbr["baseColorTexture"]["index"])
    normal_image_index = texture_source(document, material["normalTexture"]["index"])
    old_image_views = {image["bufferView"] for image in document.get("images", [])}

    base_payload, base_size, alpha_is_opaque, base_mime = resize_base_color(
        image_bytes(document, binary, base_image_index), base_max
    )
    normal_payload, normal_size = resize_normal(
        image_bytes(document, binary, normal_image_index), normal_max
    )

    old_views = document["bufferViews"]
    new_views = []
    new_binary = bytearray()
    remap = {}
    for old_index, view in enumerate(old_views):
        if old_index in old_image_views:
            continue
        align4(new_binary)
        start = view.get("byteOffset", 0)
        payload = binary[start : start + view["byteLength"]]
        new_view = {k: v for k, v in view.items() if k != "byteOffset"}
        new_view["buffer"] = 0
        new_view["byteOffset"] = len(new_binary)
        remap[old_index] = len(new_views)
        new_views.append(new_view)
        new_binary.extend(payload)

    def update_view_reference(container: dict, key: str = "bufferView") -> None:
        if key in container:
            container[key] = remap[container[key]]

    for accessor in document.get("accessors", []):
        update_view_reference(accessor)
        sparse = accessor.get("sparse")
        if sparse:
            update_view_reference(sparse["indices"])
            update_view_reference(sparse["values"])

    base_label = f"{base_size[0]}X{base_size[1]}"
    normal_label = f"{normal_size[0]}X{normal_size[1]}"
    image_specs = [
        (base_image_index, base_payload, base_mime, f"YN_TUANJIE_001_BASECOLOR_{base_label}"),
        (normal_image_index, normal_payload, "image/png", f"YN_TUANJIE_001_NORMAL_{normal_label}"),
    ]
    for image_index, payload, mime, name in image_specs:
        align4(new_binary)
        view_index = len(new_views)
        new_views.append(
            {
                "buffer": 0,
                "byteOffset": len(new_binary),
                "byteLength": len(payload),
                "name": f"{name}_BUFFER_VIEW",
            }
        )
        new_binary.extend(payload)
        document["images"][image_index] = {
            "name": name,
            "bufferView": view_index,
            "mimeType": mime,
        }

    document["bufferViews"] = new_views
    document["buffers"] = [{"byteLength": len(new_binary), "name": "YN_TUANJIE_001_BINARY"}]
    material["name"] = "YN_TUANJIE_001_SURVEY_PBR"
    material["alphaMode"] = "OPAQUE" if alpha_is_opaque else material.get("alphaMode", "BLEND")
    material["doubleSided"] = True
    material.pop("extensions", None)
    document["extensionsUsed"] = [
        extension for extension in document.get("extensionsUsed", []) if extension != "KHR_materials_specular"
    ]
    if not document["extensionsUsed"]:
        document.pop("extensionsUsed", None)
    document.pop("extensionsRequired", None)

    return document, bytes(new_binary), {
        "baseColor": {"size": list(base_size), "bytes": len(base_payload), "mimeType": base_mime},
        "normal": {"size": list(normal_size), "bytes": len(normal_payload), "mimeType": "image/png"},
        "alphaIsOpaque": alpha_is_opaque,
    }


def model_stats(document: dict) -> dict:
    triangles = 0
    vertices = 0
    primitives = 0
    bounds_min = [float("inf")] * 3
    bounds_max = [float("-inf")] * 3
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            primitives += 1
            indices = document["accessors"][primitive["indices"]]
            triangles += indices["count"] // 3
            position = document["accessors"][primitive["attributes"]["POSITION"]]
            vertices += position["count"]
            for axis in range(3):
                bounds_min[axis] = min(bounds_min[axis], position["min"][axis])
                bounds_max[axis] = max(bounds_max[axis], position["max"][axis])
    return {
        "nodes": len(document.get("nodes", [])),
        "meshNodes": sum(1 for node in document.get("nodes", []) if "mesh" in node),
        "meshes": len(document.get("meshes", [])),
        "primitives": primitives,
        "vertices": vertices,
        "triangles": triangles,
        "materials": len(document.get("materials", [])),
        "images": len(document.get("images", [])),
        "animations": len(document.get("animations", [])),
        "skins": len(document.get("skins", [])),
        "morphTargets": sum(
            len(primitive.get("targets", []))
            for mesh in document.get("meshes", [])
            for primitive in mesh.get("primitives", [])
        ),
        "cameras": len(document.get("cameras", [])),
        "bounds": {"min": bounds_min, "max": bounds_max},
        "displayBounds": [bounds_max[i] - bounds_min[i] for i in range(3)],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--profile", choices=("web", "high"), default="web")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--base-max", type=int)
    parser.add_argument("--normal-max", type=int)
    args = parser.parse_args()

    profile_defaults = {
        "web": {"output": DEFAULT_OUTPUT, "base": 3072, "normal": 1024},
        "high": {"output": HIGH_OUTPUT, "base": 7000, "normal": 2500},
    }[args.profile]
    output = args.output or profile_defaults["output"]
    base_max = args.base_max or profile_defaults["base"]
    normal_max = args.normal_max or profile_defaults["normal"]

    document, binary = read_glb(args.source)
    source_stats = model_stats(document)
    rename_and_group(document)
    document, binary, texture_stats = repack(document, binary, base_max, normal_max)
    document["asset"] = {
        **document.get("asset", {}),
        "generator": "Yunnan Courtyard Factory prepare_tuanjie_glb.py",
        "extras": {
            "sampleId": "YN_TUANJIE_001",
            "displayName": "Tuanjie Township Sample 01",
            "qualityProfile": args.profile,
            "masterRole": (
                "editable-high-fidelity-scan-reference"
                if args.profile == "high"
                else "editable-web-optimized-scan-reference"
            ),
            "sourceTexturePreservation": args.profile == "high",
            "sourceRuntimeDependency": "none; FBX is provenance-only",
            "physicalScaleStatus": "unverified-no-survey-control",
            "semanticBoundary": "Spatial scan partitions are not verified architectural components.",
        },
    }
    output_stats = model_stats(document)
    write_glb(output, document, binary)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    report = {
        "sampleId": "YN_TUANJIE_001",
        "source": str(args.source.relative_to(ROOT)).replace("\\", "/"),
        "profile": args.profile,
        "output": str(output.relative_to(ROOT)).replace("\\", "/"),
        "sourceStats": source_stats,
        "outputStats": output_stats,
        "textureStats": texture_stats,
        "outputBytes": output.stat().st_size,
        "sha256": digest,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
