from pathlib import Path
import base64, re, hashlib,json
root=Path(__file__).resolve().parents[1]
vendor=root/'reference/runtime.b64'
if not vendor.exists():
 raise FileNotFoundError('Missing licensed runtime.b64 platform file')
parts=['core.js','geometry.js','material.js','app.js']
s='\n'.join((root/'source'/p).read_text() for p in parts)
h=(root/'source/shell.html').read_text().replace('__RUNTIME__',vendor.read_text()).replace('__SOURCE__',s)
(root/'START_HERE.html').write_text(h)
manifest={"version":"field-core-r1-macroscopic","files":{p:hashlib.sha256((root/'source'/p).read_bytes()).hexdigest() for p in parts},"htmlBytes":len(h.encode()),"htmlSHA256":hashlib.sha256(h.encode()).hexdigest(),"oldApplicationDependency":False,"vendor":"Three.js platform only; MIT; no old app code loaded","publicDeployed":False,"visualApproved":False,"productionApproved":False}
(root/'BUILD.json').write_text(json.dumps(manifest,indent=2)+'\n');print(manifest)
