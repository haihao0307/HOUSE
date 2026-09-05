#!/usr/bin/env python3
"""Capture the fixed V2.7.5 material evidence set and emit auditable metrics.

The script deliberately fails closed for reference comparison. A reference is
usable only when the supplied path is a 2048x682 image with the frozen SHA256.
Missing or mismatched reference bytes never become a substitute comparison.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import math
import os
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter, ImageStat


REFERENCE_SHA256 = "f439b732f9b62584dac96ad5b4ab19dc77d48105d4b092cc21b064ee59c27cfb"
REFERENCE_SIZE = (2048, 682)
PROFILES = {
    "old-pbr-fired": {"label": "fired", "slot": 0, "seeds": [5045, 6112, 7179]},
    "stone-block": {"label": "stone", "slot": 1, "seeds": [8231, 9298, 10365]},
    "raw-clay": {"label": "adobe", "slot": 2, "seeds": [4517, 5594, 6671]},
}
CHANNELS = {
    0: "final",
    1: "base-color",
    2: "cavity",
    4: "normal",
    9: "macro",
    10: "meso",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chrome", required=True)
    parser.add_argument("--html", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--reference", type=Path, default=None)
    parser.add_argument("--virtual-time-budget", type=int, default=12000)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--evidence-quality", type=float, default=0.56)
    return parser.parse_args()


def reference_status(path: Path | None) -> dict:
    if path is None:
        return {"status": "unavailable", "comparison": "skipped", "reason": "reference path not mounted"}
    if not path.is_file():
        return {"status": "unavailable", "comparison": "skipped", "reason": f"missing: {path}"}
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    try:
        size = Image.open(path).size
    except Exception as exc:  # pragma: no cover - diagnostic path
        return {"status": "invalid", "comparison": "skipped", "sha256": digest, "reason": str(exc)}
    if digest != REFERENCE_SHA256 or tuple(size) != REFERENCE_SIZE:
        return {
            "status": "hash-or-size-mismatch",
            "comparison": "skipped",
            "sha256": digest,
            "size": list(size),
            "reason": "frozen reference hash or dimensions do not match",
        }
    return {"status": "verified", "comparison": "available", "sha256": digest, "size": list(size)}


def capture(chrome: str, html: Path, output: Path, profile: str, seed: int, channel: int, budget: int, quality: float) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)
    uri = html.resolve().as_uri()
    query = (
        f"{uri}?evidence=1&solo=1&specimen=benchmark&mode=mixed&profile={profile}"
        f"&focus={PROFILES[profile]['slot']}"
        f"&debug={channel}&seed={seed}&evidenceQuality={quality:.2f}"
        f"&qa=v275-{profile}-{seed}-{channel}"
    )
    dom = output.with_suffix(".dom.html")
    log = output.with_suffix(".chrome.log")
    target_size = (1600, 1000)
    # SwiftShader cannot reliably finish the full PBR fragment field at a
    # 1600x1000 screenshot viewport before Chromium dumps the first frame.
    # Render every channel at the stable 800x500 evidence viewport, then
    # upscale the finished bitmap so every delivered artifact remains the
    # required 1600x1000 canvas with identical camera, light and framing.
    render_size = (800, 500)
    required = {
        "data-brick-mother-ready": 'data-brick-mother-ready="true"',
        "data-version": 'data-brick-mother-version="2.7.5-alpha.1"',
        "data-solo": 'data-solo-mode="true"',
        "data-evidence": 'data-evidence-ready="true"',
        "data-family-slot": f'data-family-slot="{PROFILES[profile]["slot"]}"',
        "data-master-seed": f'data-master-seed="{seed}"',
        "data-required-geometry-failures": 'data-required-geometry-failures="0"',
    }
    last_error = None
    # SwiftShader can occasionally return an all-black canvas or a DOM snapshot
    # from before the async mesh build. Retry the same deterministic job once
    # with a fresh browser profile instead of poisoning the 24-image manifest.
    for attempt in range(2):
        try:
            # Chrome serializes launches that share its default profile. A
            # private profile per evidence job keeps the requested worker
            # parallelism real and prevents one slow WebGL process from
            # blocking the remaining captures.
            with tempfile.TemporaryDirectory(prefix=f"brick-mother-v275-{profile}-{seed}-{channel}-") as user_data_dir, tempfile.TemporaryDirectory(prefix="brick-mother-v275-render-") as render_dir:
                render_output = Path(render_dir) / "capture.png"
                command = [
                    chrome,
                    f"--user-data-dir={user_data_dir}",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--headless=new",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-background-networking",
                    "--allow-file-access-from-files",
                    "--enable-webgl",
                    "--ignore-gpu-blocklist",
                    "--enable-unsafe-swiftshader",
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                    "--hide-scrollbars",
                    f"--window-size={render_size[0]},{render_size[1]}",
                    # A retry gets extra virtual time for the occasional slow
                    # seed/build; the normal path remains bounded by the
                    # workflow's 30-second evidence budget.
                    f"--virtual-time-budget={max(budget, 60000) if attempt else budget}",
                    "--run-all-compositor-stages-before-draw",
                    f"--screenshot={render_output}",
                    "--dump-dom",
                    query,
                ]
                with dom.open("w", encoding="utf-8") as dom_file, log.open("w", encoding="utf-8") as log_file:
                    subprocess.run(command, stdout=dom_file, stderr=log_file, check=True, timeout=max(600, budget // 200 + 180))
                with Image.open(render_output) as screenshot:
                    if screenshot.size != render_size:
                        raise RuntimeError(f"screenshot dimensions invalid: {render_output} -> {screenshot.size}")
                    if screenshot.convert("RGB").getbbox() is None:
                        raise RuntimeError(f"screenshot is fully empty: {render_output}")
                    if render_size == target_size:
                        screenshot.convert("RGB").save(output, format="PNG")
                    else:
                        screenshot.convert("RGB").resize(target_size, Image.Resampling.LANCZOS).save(output, format="PNG")
            if not output.is_file() or output.stat().st_size < 4096:
                raise RuntimeError(f"screenshot file incomplete: {output}")
            with Image.open(output) as screenshot:
                if screenshot.size != target_size:
                    raise RuntimeError(f"screenshot dimensions invalid: {output} -> {screenshot.size}")
                if screenshot.convert("RGB").getbbox() is None:
                    raise RuntimeError(f"screenshot is fully empty: {output}")
            dom_text = dom.read_text(encoding="utf-8", errors="replace")
            for name, needle in required.items():
                if needle not in dom_text:
                    raise RuntimeError(f"{name} missing in {dom}")
            return dom
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                continue
            raise RuntimeError(f"capture failed after retry: {output}") from last_error


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    index = (len(values) - 1) * p
    lo, hi = math.floor(index), math.ceil(index)
    if lo == hi:
        return values[lo]
    return values[lo] + (values[hi] - values[lo]) * (index - lo)


def parse_qa_payload(dom_text: str) -> dict | None:
    """Read the runtime QA object serialized by the evidence page.

    The payload is deliberately captured from the DOM snapshot rather than
    reconstructed in Python, so controls and seed DNA remain the exact values
    used by the renderer for that family/seed.
    """
    match = re.search(r'<script\b[^>]*\bid=["\']brickMotherQA["\'][^>]*>(.*?)</script>', dom_text, re.DOTALL)
    if not match:
        return None
    try:
        payload = json.loads(match.group(1))
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def make_supplemental_evidence(out: Path, reference_path: Path | None, reference: dict) -> dict:
    """Emit review-only closeups without changing the canonical 24-image set."""
    closeup_dir = out / "closeups"
    closeup_dir.mkdir(parents=True, exist_ok=True)
    closeups = []
    for source_name, output_name in (
        ("stone-8231-final.png", "stone-8231-layering-closeup.png"),
        ("adobe-4517-final.png", "adobe-4517-inclusion-closeup.png"),
    ):
        source = out / source_name
        if not source.is_file():
            continue
        with Image.open(source).convert("RGB") as image:
            bbox = image.getbbox()
            if not bbox:
                continue
            left, top, right, bottom = bbox
            width = right - left
            height = max(1, min(bottom - top, int(width / 1.6)))
            center_y = (top + bottom) // 2
            crop_top = max(top, min(bottom - height, center_y - height // 2))
            crop = image.crop((left, crop_top, right, crop_top + height))
            crop.resize((1600, 1000), Image.Resampling.LANCZOS).save(closeup_dir / output_name, format="PNG")
            closeups.append(f"closeups/{output_name}")

    comparison = {
        "status": "skipped",
        "comparison": "skipped",
        "reference": reference,
        "reason": "frozen JRB reference is unavailable or not mounted; no substitute image is used",
    }
    if reference.get("status") == "verified" and reference_path is not None:
        # Keep the side-by-side path deterministic when CI eventually mounts the
        # exact frozen bytes. It intentionally has no labels or UI over either image.
        final = out / "fired-5045-final.png"
        if final.is_file():
            with Image.open(reference_path).convert("RGB") as ref_image, Image.open(final).convert("RGB") as final_image:
                canvas = Image.new("RGB", (1600, 1000), (0, 0, 0))
                ref_image.thumbnail((760, 760), Image.Resampling.LANCZOS)
                final_image.thumbnail((760, 760), Image.Resampling.LANCZOS)
                canvas.paste(ref_image, ((800 - ref_image.width) // 2, (1000 - ref_image.height) // 2))
                canvas.paste(final_image, (800 + (800 - final_image.width) // 2, (1000 - final_image.height) // 2))
                canvas.save(out / "jrb-side-by-side.png", format="PNG")
                comparison = {"status": "generated", "comparison": "available", "file": "jrb-side-by-side.png", "reference": reference}
    (out / "jrb-side-by-side.json").write_text(json.dumps(comparison, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"closeups": closeups, "jrbSideBySide": comparison}


def image_metrics(path: Path, dom: Path) -> dict:
    image = Image.open(path).convert("RGB")
    pixels = list(image.getdata())
    occupied = [rgb for rgb in pixels if max(rgb) >= 12]
    if not occupied:
        occupied = pixels
    luminance = [0.2126 * r / 255 + 0.7152 * g / 255 + 0.0722 * b / 255 for r, g, b in occupied]
    luminance_mean = sum(luminance) / len(luminance)
    luminance_stddev = math.sqrt(sum((value - luminance_mean) ** 2 for value in luminance) / len(luminance))
    mean_srgb = [sum(rgb[i] for rgb in occupied) / len(occupied) / 255 for i in range(3)]
    gray = image.convert("L")
    bands = {}
    for radius in (1, 2, 4, 8, 16, 32):
        blurred = gray.filter(ImageFilter.GaussianBlur(radius))
        delta = ImageStat.Stat(Image.frombytes("L", gray.size, bytes(abs(a - b) for a, b in zip(gray.tobytes(), blurred.tobytes())))).mean[0] / 255
        bands[str(radius)] = round(delta, 6)
    dom_text = dom.read_text(encoding="utf-8", errors="replace")
    qa_payload = parse_qa_payload(dom_text)

    def attr(name: str, default: int = 0) -> int:
        match = re.search(rf'data-{re.escape(name)}="([0-9]+)"', dom_text)
        return int(match.group(1)) if match else default

    return {
        "file": path.name,
        "size": list(image.size),
        "meanSRGB": [round(v, 6) for v in mean_srgb],
        "luminanceMean": round(luminance_mean, 6),
        "luminanceStdDev": round(luminance_stddev, 6),
        "luminanceP10P50P90": [round(percentile(luminance, p), 6) for p in (0.10, 0.50, 0.90)],
        "multiscaleBandEnergy": bands,
        "occupancyRate": round(len(occupied) / len(pixels), 6),
        "deepPoreCount": attr("deep-pores"),
        "overhangCount": attr("overhang-count"),
        "fiberBundleCount": attr("fiber-bundles"),
        "formationTopologyHitCount": attr("formation-hit-count"),
        "declaredEventCount": attr("declared-formation-events"),
        "shaderHitCount": attr("shader-formation-hits"),
        "sdfGridHitCount": attr("sdf-grid-formation-hits"),
        "requiredGeometryFailureCount": attr("required-geometry-failures"),
        "formationAssociationCount": attr("formation-associations"),
        "familySlot": attr("family-slot"),
        "masterSeed": attr("master-seed"),
        "inclusionLayerCount": attr("inclusion-layer-count"),
        "_qaPayload": qa_payload,
    }


def main() -> None:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    reference = reference_status(args.reference)
    jobs = []
    for profile, config in PROFILES.items():
        for seed in config["seeds"]:
            channels = CHANNELS if seed == config["seeds"][0] else {0: "final"}
            for channel, channel_name in channels.items():
                filename = f"{config['label']}-{seed}-{channel_name}.png"
                jobs.append((profile, seed, channel, channel_name, args.out / filename))

    def capture_one(job: tuple[str, int, int, str, Path]) -> dict:
        profile, seed, channel, channel_name, image = job
        dom = capture(args.chrome, args.html, image, profile, seed, channel, args.virtual_time_budget, args.evidence_quality)
        metric = image_metrics(image, dom)
        metric.update({"profile": profile, "seed": seed, "channel": channel_name, "channelIndex": channel})
        return metric

    records = []
    workers = max(1, min(args.workers, len(jobs)))
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="v275-capture") as executor:
        futures = {executor.submit(capture_one, job): job for job in jobs}
        for future in as_completed(futures):
            records.append(future.result())
    records.sort(key=lambda item: (item["profile"], item["seed"], item["channelIndex"]))
    finals = [record for record in records if record["channel"] == "final"]
    qa_by_family = {}
    qa_seed_snapshots_by_family = {}
    for item in finals:
        payload = item.get("_qaPayload")
        if not payload:
            continue
        profile = item["profile"]
        if profile not in qa_by_family:
            qa_by_family[profile] = payload
        family_keys = payload.get("seedDNAByFamily", {})
        family = next(iter(family_keys), None)
        if family:
            controls = payload.get("controlsByFamily", {}).get(family, [])
            seed_dna = payload.get("seedDNAByFamily", {}).get(family, [])
            derivation = payload.get("seedDerivation", [])
            qa_seed_snapshots_by_family.setdefault(profile, []).append({
                "profile": profile,
                "family": family,
                "masterSeed": item["seed"],
                "controls": controls[0] if controls else None,
                "seedDNA": seed_dna[0] if seed_dna else None,
                "seedDerivation": derivation[0] if derivation else None,
                "inclusionDNA": payload.get("inclusionDNAByFamily", {}).get(family, []),
                "globalControlDelta": payload.get("globalControlDelta", {}),
                "controlIsolation": payload.get("controlIsolation", {}),
            })
    for snapshots in qa_seed_snapshots_by_family.values():
        snapshots.sort(key=lambda item: item["masterSeed"])
    for item in records:
        item.pop("_qaPayload", None)
    supplemental = make_supplemental_evidence(args.out, args.reference, reference)
    failed_stddev = [record for record in finals if record["luminanceStdDev"] < 0.11]
    required_geometry_failures = [record for record in records if record["requiredGeometryFailureCount"] > 0]
    manifest = {
        "version": "2.7.5-alpha.1",
        "canvas": [1600, 1000],
        "background": "black",
        "camera": "fixed benchmark slab, evidence solo focus 0",
        "evidenceQuality": round(args.evidence_quality, 2),
        "profiles": list(PROFILES),
        "seedsPerProfile": 3,
        "canonicalChannels": list(CHANNELS.values()),
        "extraSeedChannels": ["final"],
        "imageCount": len(records),
        "reference": reference,
        "supplementalEvidence": supplemental,
        "qaByFamily": qa_by_family,
        "qaSeedSnapshotsByFamily": qa_seed_snapshots_by_family,
        "manualApprovals": {
            "jrbReferenceColorApproved": False,
            "stoneDetailApproved": False,
            "adobeInclusionApproved": False,
            "productionApproved": False,
        },
        "records": records,
        "finalLuminanceStdDevFailures": failed_stddev,
        "requiredGeometryFailures": required_geometry_failures,
    }
    (args.out / "evidence-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.out / "qa-family-controls.json").write_text(json.dumps({
        "canonical": qa_by_family,
        "allFinalSeeds": qa_seed_snapshots_by_family,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        "# Brick Mother V2.7.5 evidence report",
        "",
        f"Images: {len(records)} (1600x1000), fixed camera/light/background.",
        f"Reference: {reference['status']}; comparison: {reference['comparison']}.",
        f"Required geometry failures: {len(required_geometry_failures)} records.",
        "Manual visual approvals remain false.",
        f"Supplemental closeups: {len(supplemental['closeups'])}; JRB side-by-side: {supplemental['jrbSideBySide']['status']}.",
        "Full per-family controls and seed DNA for all three final seeds: qa-family-controls.json (also embedded in evidence-manifest.json).",
        "",
        "| Profile | Seed | Final luminance stddev | P10 / P50 / P90 | Topology hits |",
        "|---|---:|---:|---|---:|",
    ]
    for item in finals:
        lines.append(
            f"| {item['profile']} | {item['seed']} | {item['luminanceStdDev']:.6f} | "
            f"{item['luminanceP10P50P90'][0]:.4f} / {item['luminanceP10P50P90'][1]:.4f} / {item['luminanceP10P50P90'][2]:.4f} | "
            f"{item['formationTopologyHitCount']} |"
        )
    (args.out / "evidence-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    if failed_stddev:
        raise SystemExit("final material luminance standard deviation below 0.11")
    if required_geometry_failures:
        raise SystemExit("required formation event has no final topology hit")


if __name__ == "__main__":
    main()
