#!/usr/bin/env python3
"""Native-resolution UV coverage and evidence analysis for Jiangwutang tiles.

This script never edits the source ZIP or its extracted source copy. It rasterizes
the loaded FBX UV triangles into per-texture pixel masks, then computes statistics
only on the union of pixels covered by those triangles. The FBX geometry arrays
come from the local Three.js FBXLoader parse recorded in operation-log.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image


BASELINE_NORMAL = np.array([128, 128, 255], dtype=np.uint8)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def archive_evidence(path: Path):
    rows = []
    bad = None
    with zipfile.ZipFile(path, "r") as z:
        bad = z.testzip()
        for info in z.infolist():
            if not info.is_dir():
                with z.open(info, "r") as stream:
                    while stream.read(1024 * 1024):
                        pass
            rows.append({
                "path": info.filename,
                "compressedBytes": info.compress_size,
                "uncompressedBytes": info.file_size,
                "crc32": f"{info.CRC:08x}",
                "isDirectory": info.is_dir(),
                "readOK": True,
            })
    return rows, bad


def raster_uv_coverage(uvs: np.ndarray, width: int, height: int) -> np.ndarray:
    """Return native-resolution triangle-union overlap counts.

    UVs use the FBX/Three convention U -> image X and V -> image Y from the
    top after y = (1 - V) * (height - 1). Pixel centers are sampled at integer
    image coordinates. No padding, dilation, alpha filtering or inpainting is
    applied. Counts >1 preserve evidence of UV overlap.
    """
    coverage = np.zeros((height, width), dtype=np.uint16)
    triangles = uvs.reshape(-1, 3, 2).astype(np.float64)
    for tri in triangles:
        xy = np.empty((3, 2), dtype=np.float64)
        xy[:, 0] = tri[:, 0] * (width - 1)
        xy[:, 1] = (1.0 - tri[:, 1]) * (height - 1)
        min_x = max(0, int(np.floor(xy[:, 0].min())))
        max_x = min(width - 1, int(np.ceil(xy[:, 0].max())))
        min_y = max(0, int(np.floor(xy[:, 1].min())))
        max_y = min(height - 1, int(np.ceil(xy[:, 1].max())))
        if min_x > max_x or min_y > max_y:
            continue
        x = np.arange(min_x, max_x + 1, dtype=np.float64)
        y = np.arange(min_y, max_y + 1, dtype=np.float64)
        xx, yy = np.meshgrid(x, y)
        x0, y0 = xy[0]
        x1, y1 = xy[1]
        x2, y2 = xy[2]
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-12:
            continue
        w0 = ((y1 - y2) * (xx - x2) + (x2 - x1) * (yy - y2)) / den
        w1 = ((y2 - y0) * (xx - x2) + (x0 - x2) * (yy - y2)) / den
        w2 = 1.0 - w0 - w1
        inside = (w0 >= -1e-9) & (w1 >= -1e-9) & (w2 >= -1e-9)
        iy, ix = np.nonzero(inside)
        if len(ix):
            coverage[min_y + iy, min_x + ix] += 1
    return coverage


def quantized_colors(pixels: np.ndarray, weights: np.ndarray | None = None, limit=12):
    if len(pixels) == 0:
        return []
    q = (pixels[:, :3].astype(np.uint16) // 16)
    keys = q[:, 0] * 256 + q[:, 1] * 16 + q[:, 2]
    if weights is None:
        values, totals = np.unique(keys, return_counts=True)
        total_weight = float(len(keys))
    else:
        values = np.unique(keys)
        totals = np.array([weights[keys == key].sum() for key in values], dtype=np.float64)
        total_weight = float(weights.sum())
    order = np.argsort(totals)[::-1][:limit]
    out = []
    for i in order:
        key = int(values[i])
        bins = [key // 256, (key // 16) % 16, key % 16]
        out.append({
            "rgbBinCenter": [int(v * 16 + 8) for v in bins],
            "weightFraction": float(totals[i] / total_weight) if total_weight else 0.0,
            "weight": float(totals[i]),
        })
    return out


def rgb_summary(pixels: np.ndarray, weights: np.ndarray | None = None):
    if len(pixels) == 0:
        return {"count": 0}
    p = pixels[:, :3].astype(np.float64)
    if weights is None:
        mean = p.mean(axis=0)
        std = p.std(axis=0)
        total = float(len(p))
        wmean = mean
    else:
        total = float(weights.sum())
        w = weights[:, None]
        wmean = (p * w).sum(axis=0) / max(total, 1e-12)
        std = np.sqrt((((p - wmean) ** 2) * w).sum(axis=0) / max(total, 1e-12))
        mean = wmean
    return {
        "count": int(len(pixels)),
        "weight": total,
        "mean": [float(v) for v in mean],
        "std": [float(v) for v in std],
        "p05": [float(v) for v in np.percentile(p, 5, axis=0)],
        "p50": [float(v) for v in np.percentile(p, 50, axis=0)],
        "p95": [float(v) for v in np.percentile(p, 95, axis=0)],
        "min": [int(v) for v in p.min(axis=0)],
        "max": [int(v) for v in p.max(axis=0)],
    }


def luminance_bands(pixels: np.ndarray, weights: np.ndarray | None = None):
    if len(pixels) == 0:
        return {"thresholdsSrgbCode": [48, 128, 192], "bands": []}
    p = pixels[:, :3].astype(np.float32)
    lum = 0.2126 * p[:, 0] + 0.7152 * p[:, 1] + 0.0722 * p[:, 2]
    names = ("dark", "midDark", "midLight", "light")
    bounds = (0, 48, 128, 192, 256)
    if weights is None:
        weights = np.ones(len(lum), dtype=np.float64)
    total = float(weights.sum())
    rows = []
    for name, lo, hi in zip(names, bounds[:-1], bounds[1:]):
        m = (lum >= lo) & (lum < hi)
        rows.append({"name": name, "thresholdSrgbCode": [lo, hi], "weightFraction": float(weights[m].sum() / total) if total else 0.0, "samples": int(m.sum())})
    return {"thresholdsSrgbCode": [48, 128, 192], "bands": rows, "luminanceMean": float(np.average(lum, weights=weights)), "luminanceStd": float(np.sqrt(np.average((lum - np.average(lum, weights=weights)) ** 2, weights=weights)))}


def warm_cool(pixels: np.ndarray, weights: np.ndarray | None = None):
    if len(pixels) == 0:
        return {"thresholdRgbRMinusB": 8, "bands": []}
    p = pixels[:, :3].astype(np.int16)
    delta = p[:, 0] - p[:, 2]
    if weights is None:
        weights = np.ones(len(delta), dtype=np.float64)
    total = float(weights.sum())
    bands = [
        ("warmCandidate", delta > 8),
        ("neutralCandidate", np.abs(delta) <= 8),
        ("coolCandidate", delta < -8),
    ]
    return {"thresholdRgbRMinusB": 8, "bands": [{"name": name, "weightFraction": float(weights[m].sum() / total) if total else 0.0, "samples": int(m.sum())} for name, m in bands], "note": "candidate image-color grouping; not a material-temperature measurement"}


def native_grid_variation(rgb: np.ndarray, mask: np.ndarray):
    rows = []
    h, w = mask.shape
    for block in (8, 32, 128):
        hh, ww = (h // block) * block, (w // block) * block
        m = mask[:hh, :ww].reshape(hh // block, block, ww // block, block)
        a = rgb[:hh, :ww, :3].astype(np.float32).reshape(hh // block, block, ww // block, block, 3)
        count = m.sum(axis=(1, 3))
        summed = (a * m[..., None]).sum(axis=(1, 3))
        valid = count > 0
        means = summed[valid] / count[valid, None]
        if len(means):
            grid = np.zeros((hh // block, ww // block, 3), dtype=np.float32)
            grid[valid] = summed[valid] / count[valid, None]
            horiz_mask = valid[:, 1:] & valid[:, :-1]
            vert_mask = valid[1:] & valid[:-1]
            xdiff = np.abs(grid[:, 1:] - grid[:, :-1]).mean(axis=2)
            ydiff = np.abs(grid[1:] - grid[:-1]).mean(axis=2)
            rows.append({
                "blockSizeNativePx": block,
                "usableNativeExtentPx": [ww, hh],
                "validBlocks": int(valid.sum()),
                "meanBlockRgbStd": float(means.std(axis=0).mean()),
                "meanNeighborAbsDiffX": float(xdiff[horiz_mask].mean()) if horiz_mask.any() else None,
                "meanNeighborAbsDiffY": float(ydiff[vert_mask].mean()) if vert_mask.any() else None,
            })
    return rows


def native_gradient(rgb: np.ndarray, mask: np.ndarray):
    gray = 0.2126 * rgb[..., 0].astype(np.float32) + 0.7152 * rgb[..., 1].astype(np.float32) + 0.0722 * rgb[..., 2].astype(np.float32)
    mx = mask[:, 1:] & mask[:, :-1]
    my = mask[1:] & mask[:-1]
    dx = np.abs(gray[:, 1:] - gray[:, :-1])
    dy = np.abs(gray[1:] - gray[:-1])
    ex = float(dx[mx].mean()) if mx.any() else None
    ey = float(dy[my].mean()) if my.any() else None
    return {
        "resolutionNativePx": [int(rgb.shape[1]), int(rgb.shape[0])],
        "meanAbsGradientX": ex,
        "meanAbsGradientY": ey,
        "xOverY": float(ex / ey) if ex is not None and ey else None,
        "validHorizontalPairs": int(mx.sum()),
        "validVerticalPairs": int(my.sum()),
        "interpretation": "native image-gradient anisotropy only; not a claim about manufacturing direction",
    }


def overlap_summary(coverage: np.ndarray):
    valid = coverage > 0
    counts = coverage[valid].astype(np.float64)
    return {
        "fullImagePixels": int(coverage.size),
        "effectiveUvPixels": int(valid.sum()),
        "effectiveUvFraction": float(valid.mean()),
        "maxTriangleOverlap": int(coverage.max()),
        "meanTriangleCoverageCountOnEffectivePixels": float(counts.mean()) if len(counts) else 0.0,
        "p95TriangleCoverageCount": float(np.percentile(counts, 95)) if len(counts) else 0.0,
        "fractionEffectivePixelsWithOverlapGt1": float(np.mean(counts > 1)) if len(counts) else 0.0,
        "pixelsOutsideEffectiveUv": int((~valid).sum()),
    }


def alpha_summary(arr: np.ndarray, mask: np.ndarray):
    if arr.shape[-1] < 4:
        return {"present": False, "handling": "normal texture has no alpha channel"}
    alpha = arr[..., 3]
    out = {"present": True, "channel": "A", "full": {}, "effectiveUv": {}, "outsideEffectiveUv": {}}
    for name, m in (("full", np.ones(mask.shape, dtype=bool)), ("effectiveUv", mask), ("outsideEffectiveUv", ~mask)):
        a = alpha[m]
        out[name] = {
            "pixels": int(len(a)),
            "min": int(a.min()) if len(a) else None,
            "max": int(a.max()) if len(a) else None,
            "mean": float(a.mean()) if len(a) else None,
            "fractionTransparentEq0": float(np.mean(a == 0)) if len(a) else None,
            "fractionSemitransparent1to254": float(np.mean((a > 0) & (a < 255))) if len(a) else None,
            "fractionOpaqueEq255": float(np.mean(a == 255)) if len(a) else None,
        }
    out["handling"] = "alpha is reported but not used to expand or shrink the UV mask; RGB statistics include all UV-covered pixels"
    return out


def effective_color_stats(image: Image.Image, coverage: np.ndarray):
    arr = np.asarray(image)
    mask = coverage > 0
    pixels = arr[mask]
    return {
        "fullFrame": rgb_summary(arr.reshape(-1, arr.shape[-1])),
        "effectiveUvRegion": rgb_summary(pixels),
        "dominantQuantizedColorsEffectiveUv": quantized_colors(pixels),
        "brightnessEffectiveUv": luminance_bands(pixels),
        "warmCoolEffectiveUv": warm_cool(pixels),
        "nativeSpatialVariationEffectiveUv": native_grid_variation(arr, mask),
        "nativeDirectionalityEffectiveUv": native_gradient(arr, mask),
        "alpha": alpha_summary(arr, mask),
        "maskRule": "union of native-resolution FBX UV triangle rasterization; invalid/outside pixels excluded from effective-region statistics",
    }, arr, mask


def choose_evidence_crop(rgb: np.ndarray, mask: np.ndarray, size=1024, step=256):
    h, w = mask.shape
    size = min(size, h, w)
    best = None
    gray = 0.2126 * rgb[..., 0].astype(np.float32) + 0.7152 * rgb[..., 1].astype(np.float32) + 0.0722 * rgb[..., 2].astype(np.float32)
    for y0 in range(0, max(1, h - size + 1), step):
        for x0 in range(0, max(1, w - size + 1), step):
            y1, x1 = y0 + size, x0 + size
            m = mask[y0:y1, x0:x1]
            frac = float(m.mean())
            if frac < 0.35:
                continue
            vals = gray[y0:y1, x0:x1][m]
            score = frac * float(vals.std())
            candidate = (score, x0, y0, x1, y1, frac, float(vals.std()))
            if best is None or candidate[0] > best[0]:
                best = candidate
    if best is None:
        best = (0.0, 0, 0, size, size, float(mask[:size, :size].mean()), 0.0)
    _, x0, y0, x1, y1, frac, std = best
    return {"x0": int(x0), "y0": int(y0), "x1Exclusive": int(x1), "y1Exclusive": int(y1), "nativeSizePx": [int(x1 - x0), int(y1 - y0)], "effectiveUvFraction": frac, "luminanceStd": std}


def rsinfo_fields(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    def attr(name):
        m = re.search(rf'{re.escape(name)}="([^"]*)"', text)
        return m.group(1) if m else None
    m = re.search(r"<transformToModel>([^<]+)</transformToModel>", text)
    transform = [float(x) for x in m.group(1).split()] if m else None
    return {
        "globalCoordinateSystem": attr("globalCoordinateSystem"),
        "globalCoordinateSystemName": attr("globalCoordinateSystemName"),
        "exportCoordinateSystemType": attr("exportCoordinateSystemType"),
        "transformToModel16Values": transform,
        "settingsScale": attr("settingsScale"),
        "normalSpace": attr("normalSpace"),
        "normalRange": attr("normalRange"),
        "normalFlip": attr("normalFlip"),
        "tileType": attr("tileType"),
        "exportToOneTexture": attr("exportToOneTexture"),
        "embedTextures": attr("embedTextures"),
        "oneTextureMaxSide": attr("oneTextureMaxSide"),
        "units": None,
        "unitsNote": "no real-world unit field found; dimensions remain in FBX file units",
    }


def area_weighted_surface_samples(points, uvs, image: Image.Image):
    p = points.reshape(-1, 3, 3).astype(np.float64)
    uv = uvs.reshape(-1, 3, 2).astype(np.float64)
    tri_area = np.linalg.norm(np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0]), axis=1) * 0.5
    uv_centers = uv.mean(axis=1)
    tex = np.asarray(image.convert("RGB"))
    xs = np.clip(np.rint(uv_centers[:, 0] * (tex.shape[1] - 1)).astype(np.int64), 0, tex.shape[1] - 1)
    ys = np.clip(np.rint((1.0 - uv_centers[:, 1]) * (tex.shape[0] - 1)).astype(np.int64), 0, tex.shape[0] - 1)
    colors = tex[ys, xs]
    valid = tri_area > 1e-12
    colors = colors[valid]
    weights = tri_area[valid]
    return {
        "sampling": "one nearest native texel at each FBX triangle UV centroid",
        "weight": "3D triangle area in FBX file units squared",
        "trianglesSampled": int(len(colors)),
        "totalSurfaceAreaWeight": float(weights.sum()),
        "rgb": rgb_summary(colors, weights),
        "dominantQuantizedColors": quantized_colors(colors, weights),
        "brightness": luminance_bands(colors, weights),
        "warmCool": warm_cool(colors, weights),
        "limitation": "area weighting reduces UV-stretch bias but one texel sample per triangle is still an approximation; it is not a per-pixel surface integral",
    }


def normal_effective_stats(image: Image.Image, coverage: np.ndarray):
    arr = np.asarray(image.convert("RGB"))
    mask = coverage > 0
    full = arr.reshape(-1, 3)
    valid = arr[mask]
    def summary(p):
        exact = np.all(p == BASELINE_NORMAL, axis=1)
        tol1 = np.all(np.abs(p.astype(np.int16) - BASELINE_NORMAL.astype(np.int16)) <= 1, axis=1)
        tol2 = np.all(np.abs(p.astype(np.int16) - BASELINE_NORMAL.astype(np.int16)) <= 2, axis=1)
        return {
            "pixels": int(len(p)),
            "exactBaselineRgb128128255": int(exact.sum()),
            "exactBaselineFraction": float(exact.mean()) if len(p) else None,
            "toleranceDefinition": "per-channel absolute RGB distance <= N from [128,128,255]",
            "tolerance1Pixels": int(tol1.sum()),
            "tolerance1Fraction": float(tol1.mean()) if len(p) else None,
            "tolerance2Pixels": int(tol2.sum()),
            "tolerance2Fraction": float(tol2.mean()) if len(p) else None,
            "anyNonBaselinePixels": int((~exact).sum()),
            "anyNonBaselineFraction": float((~exact).mean()) if len(p) else None,
        }
    signed = valid.astype(np.float32) / 255.0 * 2.0 - 1.0
    lengths = np.linalg.norm(signed, axis=1)
    nz = np.clip(signed[:, 2] / np.maximum(lengths, 1e-8), -1, 1)
    tilt = np.degrees(np.arccos(nz))
    delta = np.sqrt(((valid.astype(np.float32) - BASELINE_NORMAL.astype(np.float32)) ** 2).sum(axis=1))
    return {
        "fullFrame": summary(full),
        "effectiveUvRegion": summary(valid),
        "effectiveUvRegionFractionOfFullImage": float(mask.mean()),
        "validPixelCount": int(mask.sum()),
        "decodedSignedNormalAssumption": {
            "meanXYZ": [float(x) for x in signed.mean(axis=0)],
            "p50TiltDegrees": float(np.percentile(tilt, 50)) if len(tilt) else None,
            "p95TiltDegrees": float(np.percentile(tilt, 95)) if len(tilt) else None,
            "p99TiltDegrees": float(np.percentile(tilt, 99)) if len(tilt) else None,
            "maxTiltDegrees": float(tilt.max()) if len(tilt) else None,
            "deltaRgbP50": float(np.percentile(delta, 50)) if len(delta) else None,
            "deltaRgbP95": float(np.percentile(delta, 95)) if len(delta) else None,
            "deltaRgbMax": float(delta.max()) if len(delta) else None,
            "tiltBinsDegrees": [
                {"range": "0-1", "fraction": float(np.mean(tilt < 1)) if len(tilt) else None},
                {"range": "1-2", "fraction": float(np.mean((tilt >= 1) & (tilt < 2))) if len(tilt) else None},
                {"range": "2-5", "fraction": float(np.mean((tilt >= 2) & (tilt < 5))) if len(tilt) else None},
                {"range": "5-10", "fraction": float(np.mean((tilt >= 5) & (tilt < 10))) if len(tilt) else None},
                {"range": "10+", "fraction": float(np.mean(tilt >= 10)) if len(tilt) else None},
            ],
            "note": "normal map directional detail only; no height reconstruction or physical bump amplitude is inferred",
        },
        "nativeSpatialVariationEffectiveUv": native_grid_variation(arr, mask),
        "nativeDirectionalityEffectiveUv": native_gradient(arr, mask),
        "alpha": {"present": False, "handling": "normal image is RGB; no alpha channel to include or exclude"},
    }


def save_mask_preview(coverage: np.ndarray, path: Path):
    mask = (coverage > 0).astype(np.uint8) * 255
    Image.fromarray(mask, mode="L").resize((900, 900), Image.Resampling.LANCZOS).save(path, "PNG")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", dest="zip_path", required=True, type=Path)
    ap.add_argument("--source-dir", required=True, type=Path)
    ap.add_argument("--mesh-json", required=True, type=Path)
    ap.add_argument("--prior-json", required=True, type=Path)
    ap.add_argument("--out-dir", required=True, type=Path)
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    prior = json.loads(args.prior_json.read_text(encoding="utf-8"))
    mesh = json.loads(args.mesh_json.read_text(encoding="utf-8"))
    gd = mesh["geometryData"][0]
    points = np.asarray(gd["positions"], dtype=np.float64)
    uvs = np.asarray(gd["uvs"], dtype=np.float64)
    source_asset = args.source_dir / "讲武堂瓦片精细"
    fbx = source_asset / "01.fbx"
    rsinfo = source_asset / "01.fbx.rsInfo"
    diffuse_path = source_asset / "01_u1_v1_diffuse.png"
    normal_path = source_asset / "01_u1_v1_normal.png"
    diffuse = Image.open(diffuse_path)
    diffuse.load()
    normal = Image.open(normal_path)
    normal.load()

    archive_rows, bad = archive_evidence(args.zip_path)
    diffuse_cov = raster_uv_coverage(uvs, diffuse.width, diffuse.height)
    normal_cov = raster_uv_coverage(uvs, normal.width, normal.height)
    diffuse_color, diffuse_arr, diffuse_mask = effective_color_stats(diffuse, diffuse_cov)
    normal_stats = normal_effective_stats(normal, normal_cov)
    diffuse_area_weighted = area_weighted_surface_samples(points, uvs, diffuse)
    crop = choose_evidence_crop(diffuse_arr, diffuse_mask)
    x0, y0, x1, y1 = crop["x0"], crop["y0"], crop["x1Exclusive"], crop["y1Exclusive"]
    diffuse_crop_path = args.out_dir / "diffuse-effective-crop.png"
    normal_x0 = round(x0 / (diffuse.width - 1) * (normal.width - 1))
    normal_y0 = round(y0 / (diffuse.height - 1) * (normal.height - 1))
    normal_x1 = min(normal.width, round((x1 - 1) / (diffuse.width - 1) * (normal.width - 1)) + 1)
    normal_y1 = min(normal.height, round((y1 - 1) / (diffuse.height - 1) * (normal.height - 1)) + 1)
    normal_crop_path = args.out_dir / "normal-effective-crop.png"
    diffuse.crop((x0, y0, x1, y1)).save(diffuse_crop_path, "PNG")
    normal.crop((normal_x0, normal_y0, normal_x1, normal_y1)).save(normal_crop_path, "PNG")
    diffuse_mask_path = args.out_dir / "diffuse-uv-coverage-mask.png"
    normal_mask_path = args.out_dir / "normal-uv-coverage-mask.png"
    save_mask_preview(diffuse_cov, diffuse_mask_path)
    save_mask_preview(normal_cov, normal_mask_path)

    uv_tri = uvs.reshape(-1, 3, 2)
    out_vertices = int(np.sum((uvs < 0) | (uvs > 1)))
    out_triangles = int(np.sum(np.any((uv_tri < 0) | (uv_tri > 1), axis=(1, 2))))
    coordinate_fields = rsinfo_fields(rsinfo)
    out = {
        "schema": "tiles-mother-jiangwutang-effective-analysis-v2",
        "analysisDate": "2026-09-01",
        "sourceIntegrity": {
            "originalZip": str(args.zip_path),
            "originalZipBytes": args.zip_path.stat().st_size,
            "originalZipSHA256": sha256_file(args.zip_path),
            "lockedBytes": 58671527,
            "lockedSHA256": "ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365",
            "matchesLockedIdentity": args.zip_path.stat().st_size == 58671527 and sha256_file(args.zip_path) == "ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365",
            "zipCRCCheck": "passed" if bad is None else f"failed:{bad}",
            "allEntriesRead": bad is None,
            "originalModified": False,
        },
        "archiveDirectory": archive_rows,
        "fbx": prior["fbx"],
        "rsInfo": {**prior.get("rsInfoDirectData", {}), "coordinateAndUnitFields": coordinate_fields},
        "effectiveUvCoverage": {
            "definition": "native-resolution union mask of the actual loaded FBX triangle UVs; no thumbnail, padding, alpha expansion or manual paint",
            "uvDirection": {"u": "left-to-right image X", "v": "top-to-bottom image Y via y=(1-v)*(height-1)", "basis": "FBXLoader/Three UV convention used for analysis"},
            "uvVerticesOutside01": out_vertices,
            "trianglesWithAnyUvOutside01": out_triangles,
            "diffuse": {"image": diffuse_path.name, "sizePx": [diffuse.width, diffuse.height], "coverage": overlap_summary(diffuse_cov), "invalidHandling": "coverage==0 excluded; covered dark/black RGB is retained as observed material texel"},
            "normal": {"image": normal_path.name, "sizePx": [normal.width, normal.height], "coverage": overlap_summary(normal_cov), "invalidHandling": "coverage==0 excluded; RGB normal pixels inside coverage retained without height conversion"},
            "uvOverlap": {"note": "coverage counts are retained; overlap statistics are reported per texture and are not collapsed into unique surface area"},
            "boundaryFill": {"method": "no fill or dilation; pixels outside union mask are invalid and reported separately", "diffuseAlphaOutsideMask": diffuse_color["alpha"]["outsideEffectiveUv"], "normalHasAlpha": False},
        },
        "diffuseEffectiveRegion": {
            "imageMetadata": {"file": diffuse_path.name, "bytes": diffuse_path.stat().st_size, "sha256": sha256_file(diffuse_path), "format": diffuse.format, "mode": diffuse.mode, "sizePx": [diffuse.width, diffuse.height]},
            "statistics": diffuse_color,
            "surfaceAreaWeightedTriangleCentroidSamples": diffuse_area_weighted,
            "crop": {"diffuseNativePixelCoordinates": [x0, y0, x1, y1], "normalNativePixelCoordinates": [normal_x0, normal_y0, normal_x1, normal_y1], "uvApprox": [x0 / (diffuse.width - 1), 1 - y1 / (diffuse.height - 1), x1 / (diffuse.width - 1), 1 - y0 / (diffuse.height - 1)], "selection": "1024px native window maximizing effective-mask fraction multiplied by native luminance standard deviation"},
        },
        "normalEffectiveRegion": {
            "imageMetadata": {"file": normal_path.name, "bytes": normal_path.stat().st_size, "sha256": sha256_file(normal_path), "format": normal.format, "mode": normal.mode, "sizePx": [normal.width, normal.height]},
            "statistics": normal_stats,
            "crop": {"diffuseNativePixelCoordinates": [x0, y0, x1, y1], "normalNativePixelCoordinates": [normal_x0, normal_y0, normal_x1, normal_y1], "selectionInheritedFromDiffuseWindow": True},
        },
        "bakedLightingAndPhysicalSeparation": {
            "observed": "Diffuse RGB contains dark/light/color variation in the effective UV region; the normal map is separately bound and nearly flat.",
            "notSeparableFromPackage": ["baked ambient occlusion versus base color", "baked cast/contact shadow versus dark pigment", "specular/reflection versus light diffuse patch", "true roughness"],
            "rule": "these signals remain observed or unknown; no base-color, roughness or height recovery is claimed",
        },
        "evidenceClassification": {
            "directlyObserved": [
                "Source ZIP bytes, SHA256, central-directory CRC and every entry were rechecked locally.",
                "FBX is parsed as one mesh/material; the existing FBX parse and material bindings are preserved in the analysis.",
                "Diffuse and normal effective regions are native-resolution UV triangle unions, with outside pixels excluded and overlaps measured.",
                "Normal full-frame and effective-region exact/tolerance counts are measured from raw RGB pixels.",
                "Diffuse color, brightness, warm/cool candidate bands, native spatial scales and native X/Y gradients are measured inside the effective UV mask.",
                "Diffuse surface-area-weighted samples use loaded FBX 3D triangle areas and native texels at UV centroids.",
            ],
            "inferredWithBasis": [
                "The model image is visually consistent with a combined roof-tile patch containing repeated flat and curved forms; exact board/tube/top-tile semantics are not encoded.",
                "Diffuse dark/light variation may include baked lighting or occlusion as well as pigment; the package cannot reliably separate them.",
                "The normal map carries only sparse, low-amplitude directional detail under the stated decode assumption; this is not a measured physical height.",
            ],
            "unknownOrNotFilled": [
                "No verified semantic label for板瓦、筒瓦 or user-called顶瓦.",
                "No real-world unit or dimensional scale; FBX dimensions remain file units.",
                "No measured roughness, base-color recovery, height/displacement or physical bump amplitude.",
                "Normal tangent basis, green-channel handedness and renderer-specific strength are unvalidated.",
                "No manufacturing direction, firing history, clay composition or provenance can be established from this package alone.",
            ],
        },
        "state": {
            "sourceReadVerified": True,
            "modelParsed": True,
            "texturesDecoded": True,
            "featureExtractionComplete": True,
            "comparisonRecorded": True,
            "programmaticReplicationComplete": False,
            "distillationComplete": False,
            "temporaryCopiesRemoved": False,
            "visualApproved": False,
            "productionApproved": False,
        },
        "artifacts": {
            "analysisJson": "tiles-mother/knowledge/jiangwutang-001/analysis.json",
            "review": "tiles-mother/knowledge/jiangwutang-001/review.md",
            "operationLog": "tiles-mother/knowledge/jiangwutang-001/operation-log.md",
            "effectiveDiffuseCrop": "tiles-mother/knowledge/jiangwutang-001/diffuse-effective-crop.png",
            "effectiveNormalCrop": "tiles-mother/knowledge/jiangwutang-001/normal-effective-crop.png",
            "diffuseCoverageMask": "tiles-mother/knowledge/jiangwutang-001/diffuse-uv-coverage-mask.png",
            "normalCoverageMask": "tiles-mother/knowledge/jiangwutang-001/normal-uv-coverage-mask.png",
            "initialAnalysisPreserved": "tiles-mother/knowledge/jiangwutang-001/initial-analysis.json",
        },
    }
    analysis_path = args.out_dir / "analysis.json"
    analysis_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest = {
        "schema": "tiles-mother-jiangwutang-file-checksums-v1",
        "sourceFiles": [
            {"path": str(args.zip_path), "bytes": args.zip_path.stat().st_size, "sha256": sha256_file(args.zip_path)},
            {"path": fbx.name, "bytes": fbx.stat().st_size, "sha256": sha256_file(fbx)},
            {"path": rsinfo.name, "bytes": rsinfo.stat().st_size, "sha256": sha256_file(rsinfo)},
            {"path": diffuse_path.name, "bytes": diffuse_path.stat().st_size, "sha256": sha256_file(diffuse_path)},
            {"path": normal_path.name, "bytes": normal_path.stat().st_size, "sha256": sha256_file(normal_path)},
        ],
        "repoArtifacts": [
            {"path": "analysis.json", "bytes": analysis_path.stat().st_size, "sha256": sha256_file(analysis_path)},
            {"path": diffuse_crop_path.name, "bytes": diffuse_crop_path.stat().st_size, "sha256": sha256_file(diffuse_crop_path)},
            {"path": normal_crop_path.name, "bytes": normal_crop_path.stat().st_size, "sha256": sha256_file(normal_crop_path)},
            {"path": diffuse_mask_path.name, "bytes": diffuse_mask_path.stat().st_size, "sha256": sha256_file(diffuse_mask_path)},
            {"path": normal_mask_path.name, "bytes": normal_mask_path.stat().st_size, "sha256": sha256_file(normal_mask_path)},
        ],
        "rawSourceInRepo": False,
        "completeLargeTexturesInRepo": False,
        "selfHashExcluded": True,
    }
    (args.out_dir / "file-checksums.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "analysis": str(analysis_path),
        "diffuseCoverage": out["effectiveUvCoverage"]["diffuse"]["coverage"],
        "normalCoverage": out["effectiveUvCoverage"]["normal"]["coverage"],
        "normalEffective": out["normalEffectiveRegion"]["statistics"]["effectiveUvRegion"],
        "diffuseCrop": str(diffuse_crop_path),
        "normalCrop": str(normal_crop_path),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
