"""Finalize Brick Mother Studio V1.3 after the material-truth patch.
This pass removes GLSL reserved identifiers and refreshes the exact output fingerprint.
"""
from pathlib import Path
import hashlib
import json
import re
import sys

root = Path(sys.argv[1])
studio = root / 'studio.html'
alias = root / 'studio-v1.3.html'
build_path = root / 'STUDIO_BUILD.json'
version = '1.3.0-alpha.2'

text = studio.read_text()
text, count = re.subn(r'\bpatch\b', 'patchField', text)
text = text.replace('1.3.0-alpha.1', version)
if count == 0 and 'patchField' not in text:
    raise RuntimeError('Expected material field identifier was not found')
if re.search(r'\bpatch\b', text):
    raise RuntimeError('Reserved GLSL identifier remains in output')
if f"version:'{version}'" not in text:
    raise RuntimeError('Final runtime version was not stamped into the HTML')

studio.write_text(text)
alias.write_text(text)

digest = hashlib.sha256(studio.read_bytes()).hexdigest()
build = json.loads(build_path.read_text())
build['runtimeVersion'] = version
build['files']['studio.html'] = {'bytes': studio.stat().st_size, 'sha256': digest}
build['directExample'] = 'studio-v1.3.html'
build['glslReservedIdentifierPass'] = True
build['visualApproved'] = False
build['productionApproved'] = False
build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n')

print(json.dumps({'runtimeVersion': version, 'bytes': studio.stat().st_size, 'sha256': digest, 'renamedIdentifiers': count}))
