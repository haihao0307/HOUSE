#!/usr/bin/env python3
"""Deterministic neutral three-view evidence renderer for Brick Mother GLBs."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inspect_glb_reference import Accessors, load_glb, scene_instances, triangles_for_primitive


RENDERER_VERSION = "brick-mother-neutral-point-renderer/0.1.0"
WIDTH = 640
HEIGHT = 480
PADDING = 54
BACKGROUND = np.array([238, 234, 225], dtype=np.uint8)
SURFACE = np.array([143, 128, 109], dtype=np.float64)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    if path.exists():
        return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def deterministic_sign(vector: np.ndarray) -> np.ndarray:
    index = int(np.argmax(np.abs(vector)))
    return vector if vector[index] >= 0 else -vector


def canonical_frame(points: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    center = np.mean(points, axis=0)
    centered = points - center
    values, vectors = np.linalg.eigh(np.cov(centered, rowvar=False))
    order = np.argsort(values)[::-1]
    vectors = vectors[:, order]
    extents = np.ptp(centered @ vectors, axis=0)
    extent_order = np.argsort(extents)[::-1]
    x_axis = deterministic_sign(vectors[:, extent_order[0]])
    y_axis = deterministic_sign(vectors[:, extent_order[2]])
    z_axis = np.cross(x_axis, y_axis)
    z_axis /= max(np.linalg.norm(z_axis), 1e-12)
    frame = np.column_stack([x_axis, y_axis, z_axis])
    canonical = centered @ frame
    bounds_center = (np.min(canonical, axis=0) + np.max(canonical, axis=0)) * 0.5
    canonical -= bounds_center
    dimensions = np.ptp(canonical, axis=0)
    return canonical, frame, dimensions


def load_surface(path: Path) -> tuple[np.ndarray, np.ndarray]:
    document, binary_chunks, _ = load_glb(path)
    accessors = Accessors(document, binary_chunks)
    instances, _ = scene_instances(document)
    point_parts: list[np.ndarray] = []
    normal_parts: list[np.ndarray] = []
    for _, mesh_index, matrix in instances:
        normal_matrix = np.linalg.inv(matrix[:3, :3]).T
        for primitive in document["meshes"][mesh_index].get("primitives", []):
            attrs = primitive.get("attributes", {})
            if "POSITION" not in attrs:
                continue
            positions = accessors.read(int(attrs["POSITION"])).astype(np.float64)
            homogeneous = np.column_stack([positions, np.ones(len(positions))])
            world_positions = (matrix @ homogeneous.T).T[:, :3]
            triangles, _ = triangles_for_primitive(primitive, accessors, len(positions))
            if len(triangles) == 0:
                continue
            tri = world_positions[triangles]
            face_normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
            norm = np.linalg.norm(face_normals, axis=1)
            valid = norm > 1e-15
            tri = tri[valid]
            face_normals = face_normals[valid] / norm[valid, None]
            triangle_count = len(tri)
            if triangle_count < 5_000:
                barycentric = np.array(
                    [
                        [1, 0, 0], [0, 1, 0], [0, 0, 1],
                        [0.75, 0.25, 0], [0.75, 0, 0.25], [0.25, 0.75, 0],
                        [0, 0.75, 0.25], [0.25, 0, 0.75], [0, 0.25, 0.75],
                        [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5],
                        [1 / 3, 1 / 3, 1 / 3],
                    ],
                    dtype=np.float64,
                )
            elif triangle_count < 50_000:
                barycentric = np.array(
                    [
                        [1, 0, 0], [0, 1, 0], [0, 0, 1],
                        [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5],
                        [1 / 3, 1 / 3, 1 / 3],
                    ],
                    dtype=np.float64,
                )
            else:
                barycentric = np.array([[1 / 3, 1 / 3, 1 / 3]], dtype=np.float64)
            sampled = np.einsum("bi,tij->tbj", barycentric, tri).reshape((-1, 3))
            sampled_normals = np.repeat(face_normals, len(barycentric), axis=0)
            point_parts.append(sampled)
            normal_parts.append(sampled_normals)
    if not point_parts:
        raise ValueError(f"no triangle geometry in {path.name}")
    points = np.vstack(point_parts)
    normals = np.vstack(normal_parts)
    if len(points) > 500_000:
        indices = np.linspace(0, len(points) - 1, 500_000, dtype=np.int64)
        points = points[indices]
        normals = normals[indices]
    return points, normals


def render_view(
    points: np.ndarray,
    normals: np.ndarray,
    axes: tuple[int, int, int],
    label: str,
    dimensions: np.ndarray,
    master_scale: float,
) -> Image.Image:
    horizontal, vertical, depth_axis = axes
    x = points[:, horizontal]
    y = points[:, vertical]
    depth = points[:, depth_axis]
    scale = min((WIDTH - 2 * PADDING) / master_scale, (HEIGHT - 2 * PADDING) / master_scale)
    px = np.rint(WIDTH * 0.5 + x * scale).astype(np.int64)
    py = np.rint(HEIGHT * 0.5 - y * scale).astype(np.int64)
    light = np.array([0.38, 0.72, 0.58], dtype=np.float64)
    light /= np.linalg.norm(light)
    intensity = 0.36 + 0.64 * np.abs(normals @ light)
    depth_range = max(float(np.ptp(depth)), 1e-12)
    depth_tint = 0.86 + 0.14 * (depth - np.min(depth)) / depth_range
    colors = np.clip(SURFACE[None, :] * intensity[:, None] * depth_tint[:, None] + 28, 0, 255).astype(np.uint8)
    image = np.empty((HEIGHT, WIDTH, 3), dtype=np.uint8)
    image[:] = BACKGROUND
    zbuffer = np.full(HEIGHT * WIDTH, -np.inf, dtype=np.float64)
    flat = image.reshape((-1, 3))
    radius = 2 if len(points) < 100_000 else 1
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            qx = px + dx
            qy = py + dy
            valid = (qx >= 0) & (qx < WIDTH) & (qy >= 0) & (qy < HEIGHT)
            if not np.any(valid):
                continue
            ids = qy[valid] * WIDTH + qx[valid]
            depths = depth[valid]
            np.maximum.at(zbuffer, ids, depths)
            nearest = depths >= zbuffer[ids] - 1e-12
            flat[ids[nearest]] = colors[valid][nearest]
    output = Image.fromarray(image, mode="RGB")
    draw = ImageDraw.Draw(output)
    draw.rectangle((0, 0, WIDTH - 1, HEIGHT - 1), outline=(185, 176, 162), width=2)
    draw.text((18, 14), label, fill=(48, 43, 37), font=font(24))
    dim_text = f"canonical X/Y/Z: {dimensions[0]:.4g} / {dimensions[1]:.4g} / {dimensions[2]:.4g} m"
    draw.text((18, HEIGHT - 34), dim_text, fill=(70, 64, 56), font=font(15))
    return output


def render_asset(path: Path, output_dir: Path) -> tuple[Path, dict[str, object]]:
    points, normals = load_surface(path)
    canonical, frame, dimensions = canonical_frame(points)
    canonical_normals = normals @ frame
    master_scale = float(max(np.max(dimensions), 1e-12) * 1.18)
    views = [
        render_view(canonical, canonical_normals, (0, 1, 2), "FRONT", dimensions, master_scale),
        render_view(canonical, canonical_normals, (2, 1, 0), "SIDE", dimensions, master_scale),
        render_view(canonical, canonical_normals, (0, 2, 1), "TOP", dimensions, master_scale),
    ]
    title_height = 58
    sheet = Image.new("RGB", (WIDTH * 3, HEIGHT + title_height), tuple(BACKGROUND.tolist()))
    sheet_draw = ImageDraw.Draw(sheet)
    sheet_draw.text((22, 14), path.name, fill=(38, 34, 29), font=font(26))
    for index, view in enumerate(views):
        sheet.paste(view, (WIDTH * index, title_height))
    output_path = output_dir / f"{path.stem.replace(' ', '_')}_neutral_3view.png"
    sheet.save(output_path, optimize=True)
    receipt = {
        "sourceFile": path.name,
        "sourceSha256": sha256_file(path),
        "outputFile": output_path.name,
        "outputBytes": output_path.stat().st_size,
        "outputSha256": sha256_file(output_path),
        "samplePoints": int(len(points)),
        "canonicalDimensionsMeters": [round(float(value), 6) for value in dimensions],
        "canonicalFrameColumns": [[round(float(value), 6) for value in row] for row in frame.tolist()],
        "views": ["FRONT", "SIDE", "TOP"],
        "originalTexturesUsed": False,
    }
    return output_path, receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--contact-sheet", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(args.input_dir.rglob("*.glb"), key=lambda path: path.name.lower())
    outputs = []
    receipts = []
    for path in files:
        output_path, receipt = render_asset(path, args.output_dir)
        outputs.append(output_path)
        receipts.append(receipt)
        print(f"rendered {path.name} -> {output_path.name}")
    thumb_width = 960
    thumb_height = 269
    contact = Image.new("RGB", (thumb_width, thumb_height * len(outputs)), tuple(BACKGROUND.tolist()))
    for row, output_path in enumerate(outputs):
        image = Image.open(output_path).convert("RGB")
        image.thumbnail((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        contact.paste(image, (0, row * thumb_height))
    args.contact_sheet.parent.mkdir(parents=True, exist_ok=True)
    contact.save(args.contact_sheet, optimize=True)
    receipt_document = {
        "schemaVersion": "0.1.0",
        "rendererVersion": RENDERER_VERSION,
        "renderMode": "deterministic neutral geometry point sampling",
        "originalTexturesUsed": False,
        "cameraPolicy": "canonical PCA frame, orthographic front/side/top, common per-asset scale",
        "files": receipts,
        "contactSheet": {
            "path": args.contact_sheet.name,
            "bytes": args.contact_sheet.stat().st_size,
            "sha256": sha256_file(args.contact_sheet),
        },
    }
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt_document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "files": len(files), "contactSheet": str(args.contact_sheet)}))


if __name__ == "__main__":
    main()
