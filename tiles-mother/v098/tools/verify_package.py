"""Verify the unchanged V0.9.8 runtime and, when present, the export manifest."""
from pathlib import Path
import hashlib, json, re
root=Path(__file__).resolve().parents[1]
sha=lambda b:hashlib.sha256(b).hexdigest()
identity=json.loads((root/'provenance/IMMUTABLE_RUNTIME_HASHES.json').read_text())
for entry in identity['files']:
    path=root/entry['path']; data=path.read_bytes()
    assert len(data)==entry['bytes'] and sha(data)==entry['sha256'], entry['path']
html=(root/'START_HERE.html').read_text()
assert len(re.findall(r'<script type="module">',html))==1
assert re.search(r'<script type="module">(.*?)</script>',html,re.S).group(1).strip()==(root/'source/app.js').read_text().strip()
state=json.loads((root/'PACKAGE_STATE.json').read_text())
assert not state['visualApproved'] and not state['productionApproved']
manifest=root/'MANIFEST.json'
if manifest.exists():
    for entry in json.loads(manifest.read_text())['files']:
        data=(root/entry['path']).read_bytes()
        assert len(data)==entry['bytes'] and sha(data)==entry['sha256'],entry['path']
print('V0.9.8 identity, source/HTML, approvals and available manifest verified.')
