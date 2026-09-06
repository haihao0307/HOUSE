"""Recover the initial seven source files. Existing revisions are never overwritten."""
from pathlib import Path
import base64, hashlib, io, zipfile
root=Path(__file__).resolve().parents[1]
parts=[root/'transport/part00.b64']+[root/f'transport/part{i:02d}.b64' for i in range(6,32)]
data=base64.b64decode(''.join(p.read_text().strip() for p in parts),validate=True)
assert hashlib.sha256(data).hexdigest()=='a97a63853ad5f96b708e46c86cb7017a38399766e2e15864f3f8c21a03a71f36','transport mismatch'
allowed={'source/field_geometry.js','source/field_model.js','source/field_ui.js','source/wave_material.js','tools/build.py','qa/browser.py','qa/geometry.cjs'}
with zipfile.ZipFile(io.BytesIO(data)) as z:
 assert set(z.namelist())==allowed
 assert z.testzip() is None
 for name in z.namelist():
  p=root/name
  if p.exists():
   print('preserve current source',name)
  else:
   p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(name));print('recovered',name)
print('Initial payload verified. Normal rebuild uses tools/build.py.')
