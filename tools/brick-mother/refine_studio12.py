"""Finalize generated GLSL and refresh the exact-page release fingerprint."""
from pathlib import Path
import sys,re,json,hashlib
root=Path(sys.argv[1])
page=root/'studio.html'
text=page.read_text()
start=text.index('void deriveMaterial(')
end=text.index('\nvoid main(){',start)
shader=text[start:end]
shader=re.sub(r'\bpatch\b','patchField',shader)
shader=re.sub(r'\bevent\b','surfaceEvent',shader)
text=text[:start]+shader+text[end:]
page.write_text(text)
manifest_path=root/'STUDIO_BUILD.json'
manifest=json.loads(manifest_path.read_text())
for name in manifest['files']:
    data=(root/name).read_bytes()
    manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Finalized studio',manifest['files']['studio.html'])
