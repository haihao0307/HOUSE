"""Finalize Brick Mother Studio V1.4 after the material rebuild.

The pass renames the one GLSL ES reserved local identifier introduced by the
fiber field, then refreshes the exact release identity and manifest digest.
"""
from pathlib import Path
import hashlib
import json
import re
import sys

root = Path(sys.argv[1])
studio = root / 'studio.html'
alias = root / 'studio-v1.4.html'
build_path = root / 'STUDIO_BUILD.json'
version = '1.4.0-alpha.2'

text = studio.read_text()
old_decl = 'float active=step(.44,r.x);'
old_use = ')*active;'
if old_decl not in text or old_use not in text:
    raise RuntimeError('Expected V1.4 fiber activation field was not found')
text = text.replace(old_decl, 'float fiberActive=step(.44,r.x);')
text = text.replace(old_use, ')*fiberActive;')
text = text.replace('1.4.0-alpha.1', version)

fragment_start = text.index('const fragmentSource=`')
fragment_end = text.index('`;', fragment_start)
fragment = text[fragment_start:fragment_end]
if re.search(r'\bactive\b', fragment):
    raise RuntimeError('Reserved GLSL identifier remains in fragment shader')
if f"version:'{version}'" not in text:
    raise RuntimeError('Final V1.4 runtime identity was not stamped')

studio.write_text(text)
alias.write_text(text)

digest = hashlib.sha256(studio.read_bytes()).hexdigest()
build = json.loads(build_path.read_text())
build['runtimeVersion'] = version
build['studioSha256'] = digest
build['studioBytes'] = studio.stat().st_size
build['directExample'] = 'studio-v1.4.html'
build['glslReservedIdentifierPass'] = True
build['humanVisualApproved'] = False
build['productionApproved'] = False
build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n')

print(json.dumps({
    'runtimeVersion': version,
    'studioSha256': digest,
    'studioBytes': studio.stat().st_size,
    'glslReservedIdentifierPass': True,
}))
