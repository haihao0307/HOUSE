#!/usr/bin/env python3
"""Read-only GLB structure and geometry inspector for Brick Mother references."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from pathlib import Path
from typing import Any

import numpy as np


PARSER_VERSION = "brick-mother-glb-inspector/0.1.0"
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
COMPONENTS = {
    5120: (np.dtype("i1"), 1),
    5121: (np.dtype("u1"), 1),
    5122: (np.dtype("<i2"), 2),
    5123: (np.dtype("<u2"), 2),
    5125: (np.dtype("<u4"), 4),
    5126: (np.dtype("<f4"), 4),
}
TYPE_SIZE = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def round_list(values: np.ndarray | list[float], digits: int = 6) -> list[float]:
    return [round(float(value), digits) for value in values]


def load_glb(path: Path) -> tuple[dict[str, Any], list[bytes], dict[str, Any]]:
    raw = path.read_bytes()
    if len(raw) < 20:
        raise ValueError("file shorter than GLB header and first chunk")
    magic, version, declared_length = struct.unpack_from("<4sII", raw, 0)
    if magic != b"glTF":
        raise ValueError(f"invalid magic {magic!r}")
    offset = 12
    json_doc: dict[str, Any] | None = None
    binary_chunks: list[bytes] = []
    chunks: list[dict[str, Any]] = []
    while offset + 8 <= len(raw):
        chunk_length, chunk_type = struct.unpack_from("<II", raw, offset)
        offset += 8
        end = offset + chunk_length
        if end > len(raw):
            raise ValueError("chunk extends beyond file length")
        payload = raw[offset:end]
        chunks.append({"type": f"0x{chunk_type:08x}", "bytes": chunk_length})
        if chunk_type == JSON_CHUNK:
            json_doc = json.loads(payload.decode("utf-8").rstrip("\x00 \t\r\n"))
        elif chunk_type == BIN_CHUNK:
            binary_chunks.append(payload)
        offset = end
    if json_doc is None:
        raise ValueError("missing JSON chunk")
    header = {
        "magic": magic.decode("ascii"),
        "version": version,
        "declaredLength": declared_length,
        "actualLength": len(raw),
        "lengthMatches": declared_length == len(raw),
        "chunks": chunks,
        "trailingBytes": len(raw) - offset,
    }
    return json_doc, binary_chunks, header


class Accessors:
    def __init__(self, document: dict[str, Any], binary_chunks: list[bytes]):
        self.document = document
        self.buffers: list[bytes | None] = [None] * len(document.get("buffers", []))
        if binary_chunks and self.buffers:
            self.buffers[0] = binary_chunks[0]

    def read(self, accessor_index: int) -> np.ndarray:
        accessor = self.document["accessors"][accessor_index]
        count = int(accessor.get("count", 0))
        components = TYPE_SIZE[accessor["type"]]
        component_type = int(accessor["componentType"])
        dtype, component_bytes = COMPONENTS[component_type]
        output = np.zeros((count, components), dtype=dtype)
        if "bufferView" in accessor:
            view = self.document["bufferViews"][accessor["bufferView"]]
            buffer_index = int(view.get("buffer", 0))
            buffer_data = self.buffers[buffer_index]
            if buffer_data is None:
                raise ValueError(f"accessor {accessor_index} uses external buffer {buffer_index}")
            base_offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
            element_bytes = components * component_bytes
            stride = int(view.get("byteStride", element_bytes))
            output = np.ndarray(
                shape=(count, components),
                dtype=dtype,
                buffer=buffer_data,
                offset=base_offset,
                strides=(stride, component_bytes),
            ).copy()
        sparse = accessor.get("sparse")
        if sparse:
            sparse_count = int(sparse["count"])
            indices_info = sparse["indices"]
            values_info = sparse["values"]
            index_view = self.document["bufferViews"][indices_info["bufferView"]]
            value_view = self.document["bufferViews"][values_info["bufferView"]]
            index_dtype, index_bytes = COMPONENTS[int(indices_info["componentType"])]
            index_buffer = self.buffers[int(index_view.get("buffer", 0))]
            value_buffer = self.buffers[int(value_view.get("buffer", 0))]
            if index_buffer is None or value_buffer is None:
                raise ValueError("sparse accessor uses external buffer")
            indices = np.ndarray(
                shape=(sparse_count,),
                dtype=index_dtype,
                buffer=index_buffer,
                offset=int(index_view.get("byteOffset", 0)) + int(indices_info.get("byteOffset", 0)),
                strides=(index_bytes,),
            ).copy()
            values = np.ndarray(
                shape=(sparse_count, components),
                dtype=dtype,
                buffer=value_buffer,
                offset=int(value_view.get("byteOffset", 0)) + int(values_info.get("byteOffset", 0)),
            ).copy()
            output[indices] = values
        return output


def quaternion_matrix(quaternion: list[float]) -> np.ndarray:
    x, y, z, w = [float(value) for value in quaternion]
    norm = math.sqrt(x * x + y * y + z * z + w * w)
    if norm == 0:
        return np.identity(4)
    x, y, z, w = x / norm, y / norm, z / norm, w / norm
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
            [0, 0, 0, 1],
        ],
        dtype=np.float64,
    )


def local_matrix(node: dict[str, Any]) -> np.ndarray:
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape((4, 4), order="F")
    translation = np.identity(4)
    translation[:3, 3] = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)
    scale = np.identity(4)
    scale_values = np.array(node.get("scale", [1, 1, 1]), dtype=np.float64)
    scale[0, 0], scale[1, 1], scale[2, 2] = scale_values
    rotation = quaternion_matrix(node.get("rotation", [0, 0, 0, 1]))
    return translation @ rotation @ scale


def scene_instances(document: dict[str, Any]) -> tuple[list[tuple[int, int, np.ndarray]], list[int]]:
    nodes = document.get("nodes", [])
    if document.get("scenes"):
        scene_index = int(document.get("scene", 0))
        roots = document["scenes"][scene_index].get("nodes", [])
    else:
        child_set = {child for node in nodes for child in node.get("children", [])}
        roots = [index for index in range(len(nodes)) if index not in child_set]
    visited: set[int] = set()
    instances: list[tuple[int, int, np.ndarray]] = []

    def walk(node_index: int, parent: np.ndarray) -> None:
        node = nodes[node_index]
        world = parent @ local_matrix(node)
        visited.add(node_index)
        if "mesh" in node:
            instances.append((node_index, int(node["mesh"]), world))
        for child in node.get("children", []):
            walk(int(child), world)

    for root in roots:
        walk(int(root), np.identity(4))
    return instances, sorted(set(range(len(nodes))) - visited)


def triangles_for_primitive(primitive: dict[str, Any], accessors: Accessors, vertex_count: int) -> tuple[np.ndarray, int]:
    if "indices" in primitive:
        indices = accessors.read(int(primitive["indices"])).reshape(-1).astype(np.int64)
    else:
        indices = np.arange(vertex_count, dtype=np.int64)
    mode = int(primitive.get("mode", 4))
    if mode == 4:
        usable = (len(indices) // 3) * 3
        return indices[:usable].reshape((-1, 3)), len(indices)
    if mode == 5 and len(indices) >= 3:
        rows = []
        for index in range(len(indices) - 2):
            if index % 2:
                rows.append([indices[index + 1], indices[index], indices[index + 2]])
            else:
                rows.append([indices[index], indices[index + 1], indices[index + 2]])
        return np.asarray(rows, dtype=np.int64), len(indices)
    if mode == 6 and len(indices) >= 3:
        return np.column_stack(
            [np.full(len(indices) - 2, indices[0]), indices[1:-1], indices[2:]]
        ).astype(np.int64), len(indices)
    return np.empty((0, 3), dtype=np.int64), len(indices)


def topology_stats(positions: np.ndarray, triangles: np.ndarray) -> dict[str, Any]:
    if triangles.size == 0:
        return {
            "triangleCount": 0,
            "degenerateTriangles": 0,
            "indexBoundaryEdges": 0,
            "indexNonManifoldEdges": 0,
            "positionWeldedBoundaryEdges": 0,
            "positionWeldedNonManifoldEdges": 0,
            "positionWeldedVertexCount": int(len(positions)),
            "indexOutOfRange": False,
        }
    index_out = bool(np.min(triangles) < 0 or np.max(triangles) >= len(positions))
    if index_out:
        return {
            "triangleCount": int(len(triangles)),
            "degenerateTriangles": None,
            "indexBoundaryEdges": None,
            "indexNonManifoldEdges": None,
            "positionWeldedBoundaryEdges": None,
            "positionWeldedNonManifoldEdges": None,
            "positionWeldedVertexCount": None,
            "indexOutOfRange": True,
        }
    tri_positions = positions[triangles]
    crosses = np.cross(tri_positions[:, 1] - tri_positions[:, 0], tri_positions[:, 2] - tri_positions[:, 0])
    twice_area = np.linalg.norm(crosses, axis=1)
    dimensions = np.ptp(positions, axis=0)
    scale = max(float(np.max(dimensions)), 1e-12)
    threshold = scale * scale * 1e-12
    repeated = (
        (triangles[:, 0] == triangles[:, 1])
        | (triangles[:, 1] == triangles[:, 2])
        | (triangles[:, 2] == triangles[:, 0])
    )
    degenerate = int(np.count_nonzero((twice_area <= threshold) | repeated))
    def edge_counts_for(input_triangles: np.ndarray) -> np.ndarray:
        edges = np.vstack(
            [
                input_triangles[:, [0, 1]],
                input_triangles[:, [1, 2]],
                input_triangles[:, [2, 0]],
            ]
        )
        edges.sort(axis=1)
        edges = edges[edges[:, 0] != edges[:, 1]]
        if len(edges) == 0:
            return np.empty((0,), dtype=np.int64)
        _, counts = np.unique(edges, axis=0, return_counts=True)
        return counts

    index_edge_counts = edge_counts_for(triangles)
    tolerance = scale * 1e-6
    quantized = np.rint(positions / tolerance).astype(np.int64)
    _, welded_inverse = np.unique(quantized, axis=0, return_inverse=True)
    welded_triangles = welded_inverse[triangles]
    welded_edge_counts = edge_counts_for(welded_triangles)
    return {
        "triangleCount": int(len(triangles)),
        "degenerateTriangles": degenerate,
        "indexBoundaryEdges": int(np.count_nonzero(index_edge_counts == 1)),
        "indexNonManifoldEdges": int(np.count_nonzero(index_edge_counts > 2)),
        "positionWeldedBoundaryEdges": int(np.count_nonzero(welded_edge_counts == 1)),
        "positionWeldedNonManifoldEdges": int(np.count_nonzero(welded_edge_counts > 2)),
        "positionWeldedVertexCount": int(np.max(welded_inverse) + 1) if len(welded_inverse) else 0,
        "indexOutOfRange": False,
    }


def texture_refs(material: dict[str, Any]) -> dict[str, int]:
    refs: dict[str, int] = {}
    pbr = material.get("pbrMetallicRoughness", {})
    fields = [
        ("baseColor", pbr.get("baseColorTexture")),
        ("metallicRoughness", pbr.get("metallicRoughnessTexture")),
        ("normal", material.get("normalTexture")),
        ("occlusion", material.get("occlusionTexture")),
        ("emissive", material.get("emissiveTexture")),
    ]
    spec_gloss = material.get("extensions", {}).get("KHR_materials_pbrSpecularGlossiness", {})
    fields.extend(
        [
            ("diffuse", spec_gloss.get("diffuseTexture")),
            ("specularGlossiness", spec_gloss.get("specularGlossinessTexture")),
        ]
    )
    for label, value in fields:
        if value and "index" in value:
            refs[label] = int(value["index"])
    return refs


def image_receipts(document: dict[str, Any], accessors: Accessors) -> list[dict[str, Any]]:
    receipts = []
    for index, image in enumerate(document.get("images", [])):
        entry: dict[str, Any] = {
            "index": index,
            "name": image.get("name"),
            "mimeType": image.get("mimeType"),
            "uri": image.get("uri"),
            "embedded": "bufferView" in image,
        }
        if "bufferView" in image:
            view = document["bufferViews"][image["bufferView"]]
            buffer_data = accessors.buffers[int(view.get("buffer", 0))]
            if buffer_data is not None:
                start = int(view.get("byteOffset", 0))
                end = start + int(view["byteLength"])
                payload = buffer_data[start:end]
                entry["bytes"] = len(payload)
                entry["sha256"] = sha256_bytes(payload)
        receipts.append(entry)
    return receipts


def pca_dimensions(points: np.ndarray) -> tuple[list[float], list[list[float]]]:
    if len(points) < 3:
        return [0.0, 0.0, 0.0], np.identity(3).tolist()
    centered = points - np.mean(points, axis=0)
    covariance = np.cov(centered, rowvar=False)
    values, vectors = np.linalg.eigh(covariance)
    order = np.argsort(values)[::-1]
    vectors = vectors[:, order]
    projected = centered @ vectors
    extents = np.ptp(projected, axis=0)
    return round_list(extents), [[round(float(value), 6) for value in row] for row in vectors.tolist()]


def evidence_role(filename: str) -> str:
    lower = filename.lower()
    if "white_wall" in lower:
        return "auxiliary plaster or wall-surface reference"
    if "stone" in lower:
        return "candidate STONE shape and surface evidence"
    if "clay" in lower:
        return "candidate ADOBE or FIRED_CLAY evidence pending visual confirmation"
    if "12th" in lower:
        return "historic fired or unfired brick evidence pending visual confirmation"
    return "generic brick evidence pending visual confirmation"


def inspect(path: Path) -> dict[str, Any]:
    document, binary_chunks, header = load_glb(path)
    accessor_reader = Accessors(document, binary_chunks)
    instances, unreferenced_nodes = scene_instances(document)
    mesh_cache: dict[int, list[dict[str, Any]]] = {}
    world_points: list[np.ndarray] = []
    used_materials: set[int] = set()
    anomalies: list[str] = []
    total_vertices = 0
    total_indices = 0
    total_triangles = 0
    total_degenerate = 0
    total_index_boundary = 0
    total_index_nonmanifold = 0
    total_welded_boundary = 0
    total_welded_nonmanifold = 0
    uv_sets: set[str] = set()

    for mesh_index, mesh in enumerate(document.get("meshes", [])):
        primitive_reports = []
        for primitive_index, primitive in enumerate(mesh.get("primitives", [])):
            attributes = primitive.get("attributes", {})
            if "POSITION" not in attributes:
                anomalies.append(f"mesh {mesh_index} primitive {primitive_index} has no POSITION")
                continue
            positions = accessor_reader.read(int(attributes["POSITION"])).astype(np.float64)
            triangles, index_count = triangles_for_primitive(primitive, accessor_reader, len(positions))
            topology = topology_stats(positions, triangles)
            material_index = primitive.get("material")
            if material_index is not None:
                used_materials.add(int(material_index))
            primitive_uv: dict[str, Any] = {}
            for semantic, accessor_index in attributes.items():
                if semantic.startswith("TEXCOORD_"):
                    uv_sets.add(semantic)
                    uv = accessor_reader.read(int(accessor_index)).astype(np.float64)
                    primitive_uv[semantic] = {
                        "count": int(len(uv)),
                        "min": round_list(np.min(uv, axis=0)),
                        "max": round_list(np.max(uv, axis=0)),
                    }
            local_min = np.min(positions, axis=0)
            local_max = np.max(positions, axis=0)
            report = {
                "meshIndex": mesh_index,
                "meshName": mesh.get("name"),
                "primitiveIndex": primitive_index,
                "mode": int(primitive.get("mode", 4)),
                "materialIndex": int(material_index) if material_index is not None else None,
                "vertexCount": int(len(positions)),
                "indexCount": int(index_count),
                "attributes": sorted(attributes.keys()),
                "localBounds": {
                    "min": round_list(local_min),
                    "max": round_list(local_max),
                    "dimensions": round_list(local_max - local_min),
                },
                "uv": primitive_uv,
                "topology": topology,
            }
            primitive_reports.append(report)
            total_vertices += int(len(positions))
            total_indices += int(index_count)
            total_triangles += int(topology["triangleCount"])
            total_degenerate += int(topology["degenerateTriangles"] or 0)
            total_index_boundary += int(topology["indexBoundaryEdges"] or 0)
            total_index_nonmanifold += int(topology["indexNonManifoldEdges"] or 0)
            total_welded_boundary += int(topology["positionWeldedBoundaryEdges"] or 0)
            total_welded_nonmanifold += int(topology["positionWeldedNonManifoldEdges"] or 0)
            if "NORMAL" not in attributes:
                anomalies.append(f"mesh {mesh_index} primitive {primitive_index} has no NORMAL")
            if not primitive_uv:
                anomalies.append(f"mesh {mesh_index} primitive {primitive_index} has no TEXCOORD set")
            if topology["indexOutOfRange"]:
                anomalies.append(f"mesh {mesh_index} primitive {primitive_index} has out-of-range indices")
            if topology["degenerateTriangles"]:
                anomalies.append(
                    f"mesh {mesh_index} primitive {primitive_index} has {topology['degenerateTriangles']} degenerate triangles"
                )
            if topology["positionWeldedBoundaryEdges"]:
                anomalies.append(
                    f"mesh {mesh_index} primitive {primitive_index} has {topology['positionWeldedBoundaryEdges']} position-welded boundary edges"
                )
            if topology["positionWeldedNonManifoldEdges"]:
                anomalies.append(
                    f"mesh {mesh_index} primitive {primitive_index} has {topology['positionWeldedNonManifoldEdges']} position-welded non-manifold edges"
                )
            if int(primitive.get("mode", 4)) != 4:
                anomalies.append(f"mesh {mesh_index} primitive {primitive_index} uses mode {primitive.get('mode')}")
        mesh_cache[mesh_index] = primitive_reports

    for node_index, mesh_index, matrix in instances:
        mesh = document["meshes"][mesh_index]
        for primitive in mesh.get("primitives", []):
            position_accessor = primitive.get("attributes", {}).get("POSITION")
            if position_accessor is None:
                continue
            positions = accessor_reader.read(int(position_accessor)).astype(np.float64)
            homogeneous = np.column_stack([positions, np.ones(len(positions))])
            transformed = (matrix @ homogeneous.T).T[:, :3]
            world_points.append(transformed)

    if world_points:
        points = np.vstack(world_points)
        scene_min = np.min(points, axis=0)
        scene_max = np.max(points, axis=0)
        dimensions = scene_max - scene_min
        pca_extents, pca_axes = pca_dimensions(points)
    else:
        points = np.empty((0, 3))
        scene_min = scene_max = dimensions = np.zeros(3)
        pca_extents, pca_axes = [0.0, 0.0, 0.0], np.identity(3).tolist()

    sorted_dimensions = sorted([float(value) for value in dimensions], reverse=True)
    largest = max(sorted_dimensions[0], 1e-12)
    dimension_ratio = [round(value / largest, 6) for value in sorted_dimensions]
    role = evidence_role(path.name)
    if "white_wall" not in path.name.lower() and (largest < 0.04 or largest > 1.0):
        anomalies.append(
            f"absolute scene scale {largest:.6g} m is implausible for a single brick; use normalized proportions until calibrated"
        )
    if unreferenced_nodes:
        anomalies.append(f"unreferenced nodes: {unreferenced_nodes}")
    if not header["lengthMatches"]:
        anomalies.append("GLB header length does not match actual bytes")
    if header["trailingBytes"]:
        anomalies.append(f"GLB contains {header['trailingBytes']} trailing bytes")
    unused_materials = sorted(set(range(len(document.get("materials", [])))) - used_materials)
    if unused_materials:
        anomalies.append(f"unused materials: {unused_materials}")

    asset = document.get("asset", {})
    asset_extras = asset.get("extras", {})
    license_name = asset_extras.get("license")
    license_risk = "review"
    if license_name and "CC-BY-NC" in license_name.upper():
        license_risk = "non-commercial restriction, keep reference-only"
        anomalies.append("source metadata declares a non-commercial license")
    elif license_name and "CC-BY" in license_name.upper():
        license_risk = "attribution required for redistribution of the source asset"

    materials = []
    for index, material in enumerate(document.get("materials", [])):
        pbr = material.get("pbrMetallicRoughness", {})
        materials.append(
            {
                "index": index,
                "name": material.get("name"),
                "alphaMode": material.get("alphaMode", "OPAQUE"),
                "doubleSided": bool(material.get("doubleSided", False)),
                "baseColorFactor": pbr.get("baseColorFactor", [1, 1, 1, 1]),
                "metallicFactor": pbr.get("metallicFactor", 1),
                "roughnessFactor": pbr.get("roughnessFactor", 1),
                "textureReferences": texture_refs(material),
                "extensions": sorted(material.get("extensions", {}).keys()),
            }
        )

    return {
        "file": path.name,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "header": header,
        "asset": {
            "version": asset.get("version"),
            "generator": asset.get("generator"),
            "title": asset_extras.get("title"),
            "author": asset_extras.get("author"),
            "source": asset_extras.get("source"),
            "license": license_name,
            "licenseRisk": license_risk,
        },
        "coordinateConvention": {
            "unit": "meter by glTF 2.0 convention",
            "handedness": "right-handed",
            "upAxis": "+Y",
            "forwardAxis": "+Z",
            "unitMetadataPresent": False,
        },
        "evidenceRole": role,
        "materialIdentityStatus": "pending visual and cross-section confirmation",
        "runtimeTextureAuthority": False,
        "counts": {
            "scenes": len(document.get("scenes", [])),
            "nodes": len(document.get("nodes", [])),
            "meshInstances": len(instances),
            "meshes": len(document.get("meshes", [])),
            "primitives": sum(len(mesh.get("primitives", [])) for mesh in document.get("meshes", [])),
            "accessors": len(document.get("accessors", [])),
            "bufferViews": len(document.get("bufferViews", [])),
            "buffers": len(document.get("buffers", [])),
            "materials": len(document.get("materials", [])),
            "textures": len(document.get("textures", [])),
            "images": len(document.get("images", [])),
            "vertices": total_vertices,
            "indices": total_indices,
            "triangles": total_triangles,
            "degenerateTriangles": total_degenerate,
            "indexBoundaryEdges": total_index_boundary,
            "indexNonManifoldEdges": total_index_nonmanifold,
            "positionWeldedBoundaryEdges": total_welded_boundary,
            "positionWeldedNonManifoldEdges": total_welded_nonmanifold,
        },
        "sceneBounds": {
            "minMeters": round_list(scene_min),
            "maxMeters": round_list(scene_max),
            "dimensionsMeters": round_list(dimensions),
            "sortedDimensionRatio": dimension_ratio,
            "pcaDimensionsMeters": pca_extents,
            "pcaAxesColumns": pca_axes,
        },
        "uvSets": sorted(uv_sets),
        "extensionsUsed": document.get("extensionsUsed", []),
        "extensionsRequired": document.get("extensionsRequired", []),
        "materials": materials,
        "textures": [
            {
                "index": index,
                "name": texture.get("name"),
                "source": texture.get("source"),
                "sampler": texture.get("sampler"),
                "extensions": sorted(texture.get("extensions", {}).keys()),
            }
            for index, texture in enumerate(document.get("textures", []))
        ],
        "images": image_receipts(document, accessor_reader),
        "meshes": [
            {
                "index": index,
                "name": mesh.get("name"),
                "primitives": mesh_cache.get(index, []),
            }
            for index, mesh in enumerate(document.get("meshes", []))
        ],
        "meshInstances": [
            {
                "nodeIndex": node_index,
                "nodeName": document["nodes"][node_index].get("name"),
                "meshIndex": mesh_index,
                "worldTranslation": round_list(matrix[:3, 3]),
                "worldScaleSingularValues": round_list(np.linalg.svd(matrix[:3, :3], compute_uv=False)),
                "worldDeterminant": round(float(np.linalg.det(matrix[:3, :3])), 9),
                "worldMatrixColumnMajor": round_list(matrix.reshape(-1, order="F")),
            }
            for node_index, mesh_index, matrix in instances
        ],
        "unreferencedNodes": unreferenced_nodes,
        "anomalies": anomalies,
    }


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Brick Mother GLB 只读结构审计 V0.1",
        "",
        f"解析器：`{report['parserVersion']}`",
        "",
        "本报告只测量几何与容器结构。原纹理不进入 Brick Mother 运行时，材料身份仍等待视觉和截面确认。",
        "",
        "## 总表",
        "",
        "| 文件 | bytes | 世界尺寸 m | 排序比例 | 顶点 | 三角形 | 网格/图元 | UV | 材质/图像 | 异常 |",
        "|---|---:|---|---|---:|---:|---:|---|---:|---:|",
    ]
    for item in report["files"]:
        counts = item["counts"]
        dims = " × ".join(f"{value:.4f}" for value in item["sceneBounds"]["dimensionsMeters"])
        ratio = ":".join(f"{value:.3f}" for value in item["sceneBounds"]["sortedDimensionRatio"])
        lines.append(
            f"| `{item['file']}` | {item['bytes']:,} | {dims} | {ratio} | {counts['vertices']:,} | "
            f"{counts['triangles']:,} | {counts['meshes']}/{counts['primitives']} | "
            f"{', '.join(item['uvSets']) or 'none'} | {counts['materials']}/{counts['images']} | {len(item['anomalies'])} |"
        )
    lines.extend(
        [
            "",
            "## 坐标与单位",
            "",
            "六个文件均按 glTF 2.0 约定读取：右手坐标、+Y 向上、单位按米解释。glTF 容器没有独立的单位声明字段，因此尺寸可信度还需要结合实物常识和用户确认。",
            "",
            "## 逐文件结果",
            "",
        ]
    )
    for item in report["files"]:
        counts = item["counts"]
        asset = item["asset"]
        lines.extend(
            [
                f"### {item['file']}",
                "",
                f"- 标题：{asset.get('title') or '未提供'}",
                f"- 作者：{asset.get('author') or '未提供'}",
                f"- 许可：{asset.get('license') or '未提供'}",
                f"- 许可提示：{asset.get('licenseRisk')}",
                f"- 证据角色：{item['evidenceRole']}",
                f"- 世界包围盒尺寸：`{item['sceneBounds']['dimensionsMeters']}` m",
                f"- PCA 主轴尺寸：`{item['sceneBounds']['pcaDimensionsMeters']}` m",
                f"- 顶点/索引/三角形：`{counts['vertices']}` / `{counts['indices']}` / `{counts['triangles']}`",
                f"- 退化三角形/索引边界边/焊接后边界边：`{counts['degenerateTriangles']}` / `{counts['indexBoundaryEdges']}` / `{counts['positionWeldedBoundaryEdges']}`",
                f"- 索引非流形边/焊接后非流形边：`{counts['indexNonManifoldEdges']}` / `{counts['positionWeldedNonManifoldEdges']}`",
                f"- 节点/网格实例/网格/图元：`{counts['nodes']}` / `{counts['meshInstances']}` / `{counts['meshes']}` / `{counts['primitives']}`",
                f"- UV 集：`{item['uvSets']}`",
                f"- 材质/纹理/图像：`{counts['materials']}` / `{counts['textures']}` / `{counts['images']}`",
                f"- 扩展：used=`{item['extensionsUsed']}` required=`{item['extensionsRequired']}`",
                "- 异常：",
            ]
        )
        if item["anomalies"]:
            lines.extend([f"  - {value}" for value in item["anomalies"]])
        else:
            lines.append("  - 未发现结构异常")
        lines.append("")
    lines.extend(
        [
            "## 可进入蒸馏的事实",
            "",
            "- 每个文件的世界尺寸、长宽高比例、顶点量、三角形量、UV 集和材质槽结构。",
            "- 轮廓与缺损的几何统计，可用于推导 BrickDNA 的范围和分布。",
            "- 源资产的作者、许可和来源，只用于证据追踪。",
            "",
            "## 暂停进入母体的内容",
            "",
            "- 原图像、原贴图像素和扫描噪点。",
            "- 仅由文件名推断的材料身份。",
            "- 缺少真实标尺确认时的绝对尺寸。",
            "- 带非商业限制资产的可再分发内容。",
            "",
            "## 下一门禁",
            "",
            "用中性材质渲染六个参考几何的固定正面、侧面和顶面，叠加统一标尺。完成视觉确认后，再把边角半径、缺口尺度谱、孔洞形状和面部起伏蒸馏为 BrickDNA 参数范围。",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--json", type=Path, required=True)
    parser.add_argument("--markdown", type=Path, required=True)
    args = parser.parse_args()
    files = sorted(args.input_dir.rglob("*.glb"), key=lambda path: path.name.lower())
    if not files:
        raise SystemExit("no GLB files found")
    report = {
        "schemaVersion": "0.1.0",
        "parserVersion": PARSER_VERSION,
        "inputPolicy": "read-only; original textures are evidence only",
        "fileCount": len(files),
        "files": [inspect(path) for path in files],
    }
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.markdown.write_text(markdown_report(report), encoding="utf-8")
    print(json.dumps({"ok": True, "files": len(files), "json": str(args.json), "markdown": str(args.markdown)}))


if __name__ == "__main__":
    main()
