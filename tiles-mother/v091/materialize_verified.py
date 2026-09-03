#!/usr/bin/env python3
"""Reconstruct the SHA-pinned Tiles Mother V0.9.1 HTML and readable source."""
from pathlib import Path
import argparse, base64, hashlib, json, lzma, os, re, subprocess

FRIENDLY_SOURCE_NAMES = {
    0: "fatal-guard.js",
    2: "core.js",
    3: "profile.js",
    4: "geometry.js",
    5: "roof.js",
    6: "material.js",
    7: "app.js",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def main() -> None:
    parser = argparse.ArgumentParser()
    here = Path(__file__).resolve().parent
    parser.add_argument("--transport", type=Path, default=here / "transport")
    parser.add_argument("--out", type=Path, default=here)
    parser.add_argument("--vendor-html", type=Path)
    args = parser.parse_args()

    manifest = json.loads((args.transport / "manifest.json").read_text(encoding="utf-8"))
    encoded = []
    require(bool(manifest["parts"]), "Transport part list is empty")
    for part in manifest["parts"]:
        require(Path(part["name"]).name == part["name"], "Unsafe part path")
        data = (args.transport / part["name"]).read_bytes()
        require(len(data) == part["bytes"], "Part length mismatch: " + part["name"])
        require(digest(data) == part["sha256"], "Part digest mismatch: " + part["name"])
        encoded.append(data)

    packed = base64.b64decode(b"".join(encoded), validate=True)
    require(len(packed) == manifest["archiveBytes"], "Archive size mismatch")
    require(digest(packed) == manifest["archiveSha256"], "Archive digest mismatch")
    template = lzma.decompress(packed)
    require(len(template) == manifest["templateBytes"], "Template size mismatch")
    require(digest(template) == manifest["templateSha256"], "Template digest mismatch")

    baseline = (
        args.vendor_html.read_bytes()
        if args.vendor_html
        else subprocess.check_output(
            ["git", "show", manifest["vendorSourceCommit"] + ":" + manifest["vendorSourcePath"]]
        )
    )
    scripts = re.findall(rb"<script\b[^>]*>(.*?)</script>", baseline, re.S | re.I)
    vendors = [script for script in scripts if b"var TilesReferenceRuntime=" in script]
    require(len(vendors) == 1, "Pinned vendor not uniquely found")
    source_vendor = vendors[0]
    if (
        source_vendor[:1] == b"\n"
        and source_vendor[-1:] == b"\n"
        and len(source_vendor) == manifest["vendorSourceBytes"] + 2
    ):
        source_vendor = source_vendor[1:-1]
    require(len(source_vendor) == manifest["vendorSourceBytes"], "Pinned vendor size mismatch")
    require(digest(source_vendor) == manifest["vendorSourceSha256"], "Pinned vendor digest mismatch")

    embedded_vendor = b"\n" + source_vendor + b"\n"
    require(len(embedded_vendor) == manifest["embeddedVendorBytes"], "Embedded vendor size mismatch")
    require(digest(embedded_vendor) == manifest["embeddedVendorSha256"], "Embedded vendor digest mismatch")
    marker = manifest["marker"].encode("utf-8")
    require(template.count(marker) == 1, "Vendor marker mismatch")
    html = template.replace(marker, embedded_vendor)
    require(len(html) == manifest["htmlBytes"], "HTML length mismatch")
    require(digest(html) == manifest["htmlSha256"], "HTML digest mismatch")

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "index.html").write_bytes(html)
    workbench = args.out / "workbench"
    workbench.mkdir(exist_ok=True)
    (workbench / "index.html").write_bytes(html)

    source = args.out / "source"
    runtime = source / "runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    scripts = re.findall(rb"<script\b[^>]*>(.*?)</script>", html, re.S | re.I)
    require(len(scripts) == 8, "Unexpected script count: %s" % len(scripts))
    for index, script in enumerate(scripts):
        if b"var TilesReferenceRuntime=" in script:
            payload = script[1:-1] if script[:1] == b"\n" and script[-1:] == b"\n" else script
            (runtime / "tiles-reference-runtime-three-r180.js").write_bytes(payload)
            continue
        numbered = source / ("%02d.js" % index)
        numbered.write_bytes(script)
        friendly = FRIENDLY_SOURCE_NAMES.get(index)
        if friendly:
            (source / friendly).write_bytes(script)

    state = {
        "schema": "tiles-mother-v091-package-state-v1",
        "packageVersion": "0.9.1",
        "packageKind": "complete_restart_handoff",
        "generatedDate": "2026-09-03",
        "repository": os.environ.get("GITHUB_REPOSITORY", "haihao0307/HOUSE"),
        "branch": os.environ.get("GITHUB_REF_NAME", "feature/tiles-mother-v0.1-workbench"),
        "sourceCommit": os.environ.get("GITHUB_SHA"),
        "workflowRun": os.environ.get("GITHUB_RUN_ID"),
        "primaryArtifact": "workbench/index.html",
        "primaryArtifactBytes": len(html),
        "primaryArtifactSHA256": digest(html),
        "tileCount": 28,
        "panCount": 12,
        "coverCount": 16,
        "stageOneAccepted": True,
        "detailRefinementPending": True,
        "visualApproved": False,
        "productionApproved": False,
        "distillationComplete": False,
        "physicalIPhoneSafariValidated": False,
        "publicPagesDeploymentIncluded": False,
    }
    (args.out / "PACKAGE_STATE.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    build = {
        **manifest,
        "sourceCommit": os.environ.get("GITHUB_SHA"),
        "workflowRun": os.environ.get("GITHUB_RUN_ID"),
        "reconstructionVerified": True,
        "publicPagesModified": False,
        "exhaustiveTriangleCollisionVerified": False,
    }
    (args.out / "build-manifest.json").write_text(
        json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"htmlSha256": digest(html), "bytes": len(html), "verified": True}))


if __name__ == "__main__":
    main()
