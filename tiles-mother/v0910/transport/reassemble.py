"""Recover only the authored performance patch; no source scans or textures."""
from pathlib import Path
import base64, hashlib, io, zipfile
root=Path(__file__).resolve().parents[1]
b=base64.b64decode(''.join((root/'transport'/f'part{i}.b64').read_text() for i in range(4)),validate=True)
assert hashlib.sha256(b).hexdigest()=='5e7a4d4d20953ce44cd5c1bfcf6bd8f99215db4e7fb33f515bc67f2d3a608f34'
allowed={'source/contact_fast.js','source/performance.js','source/scheduler.js','tools/build.py','qa/node_bench.cjs','qa/browser_compare.py','README.md','REFERENCE_RECEIPT.json'}
with zipfile.ZipFile(io.BytesIO(b)) as z:
    assert set(z.namelist())==allowed
    assert z.testzip() is None
    for name in z.namelist():
        p=root/name
        assert p.resolve().is_relative_to(root)
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_bytes(z.read(name))
print('Recovered 8 authored patch files; baseline files untouched.')
