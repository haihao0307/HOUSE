#!/usr/bin/env python3
"""Reconstruct only the SHA-pinned Tiles Mother candidate; never publish Pages."""
from pathlib import Path
import argparse, base64, hashlib, json, lzma, os, re, subprocess


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--transport', type=Path, default=Path(__file__).parent / 'transport-46803939')
    parser.add_argument('--out', type=Path, default=Path(__file__).parent)
    parser.add_argument('--vendor-html', type=Path)
    args = parser.parse_args()
    manifest = json.loads((args.transport / 'manifest.json').read_text())
    encoded = []
    require(len(manifest['parts']) == 5, 'Unexpected part count')
    for part in manifest['parts']:
        require(Path(part['name']).name == part['name'], 'Unsafe part path')
        data = (args.transport / part['name']).read_bytes()
        require(len(data) == part['bytes'], 'Part length mismatch: ' + part['name'])
        require(sha(data) == part['sha256'], 'Part digest mismatch: ' + part['name'])
        encoded.append(data)
    packed = base64.b64decode(b''.join(encoded), validate=True)
    require(sha(packed) == manifest['archiveSha256'], 'Archive digest mismatch')
    template = lzma.decompress(packed)
    require(sha(template) == manifest['templateSha256'], 'Template digest mismatch')
    baseline = args.vendor_html.read_bytes() if args.vendor_html else subprocess.check_output([
        'git', 'show', manifest['vendorSourceCommit'] + ':' + manifest['vendorSourcePath']])
    scripts = re.findall(rb'<script\b[^>]*>(.*?)</script>', baseline, re.S | re.I)
    vendors = [s for s in scripts if b'var TilesReferenceRuntime=' in s]
    require(len(vendors) == 1, 'Pinned vendor not uniquely found')
    vendor = vendors[0]
    require(sha(vendor) == manifest['vendorSha256'], 'Pinned vendor digest mismatch')
    marker = b'__TILES_PINNED_VENDOR__'
    require(template.count(marker) == 1, 'Vendor marker mismatch')
    html = template.replace(marker, vendor)
    require(len(html) == manifest['htmlBytes'], 'HTML length mismatch')
    require(sha(html) == manifest['htmlSha256'], 'HTML digest mismatch')
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / 'index.html').write_bytes(html)
    source = args.out / 'source'
    source.mkdir(exist_ok=True)
    scripts = re.findall(rb'<script\b[^>]*>(.*?)</script>', html, re.S | re.I)
    require(len(scripts) == 9, 'Unexpected script count')
    for i, script in enumerate(scripts):
        if i != 1:
            (source / ('%02d.js' % i)).write_bytes(script)
    receipt = {**manifest, 'sourceCommit': os.environ.get('GITHUB_SHA'),
        'workflowRun': os.environ.get('GITHUB_RUN_ID'), 'reconstructionVerified': True,
        'publicPagesModified': False, 'exhaustiveTriangleCollisionVerified': False}
    (args.out / 'build-manifest.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'htmlSha256': sha(html), 'bytes': len(html), 'verified': True}))


if __name__ == '__main__':
    main()
