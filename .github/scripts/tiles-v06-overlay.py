#!/usr/bin/env python3
from pathlib import Path, PurePosixPath
import hashlib, json, os, shutil, tarfile

current = Path(os.environ.get('CURRENT_PAGES', '/tmp/tm-v06/current-pages'))
candidate = Path(os.environ.get('CANDIDATE', '/tmp/tm-v06/candidate/tiles-mother'))
site = Path(os.environ.get('SITE', '/tmp/tm-v06/full-site'))
site.mkdir(parents=True, exist_ok=True)
tars = list(current.rglob('*.tar'))
assert len(tars) == 1, tars
with tarfile.open(tars[0]) as archive:
    for member in archive.getmembers():
        rel = PurePosixPath(member.name)
        assert not rel.is_absolute() and '..' not in rel.parts, member.name
        dest = site / str(rel)
        if member.isdir():
            dest.mkdir(parents=True, exist_ok=True)
        elif member.isfile():
            dest.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(member) as src, dest.open('wb') as dst:
                shutil.copyfileobj(src, dst)
        else:
            raise AssertionError(f'unsafe Pages artifact member: {member.name}')

runtime = [
    'profile.js', 'geometry-operators.js', 'roof-joints.js',
    'studio.js', 'render-studio.js', 'integration.js', 'build-manifest.json'
]
allowed = {'tiles-mother/index.html', 'tiles-mother/knowledge/jiangwutang-001/material-candidate-v0.6.json'}
allowed.update({f'tiles-mother/v06/{name}' for name in runtime})

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def snapshot():
    return {
        str(path.relative_to(site)): digest(path)
        for path in site.rglob('*')
        if path.is_file() and str(path.relative_to(site)) not in allowed
    }

before = snapshot()
assert before and (site / 'tiles-mother/index.html').is_file()
for rel in sorted(allowed):
    source = candidate / rel.removeprefix('tiles-mother/')
    assert source.is_file(), source
    target = site / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
after = snapshot()
assert before == after, 'untargeted public files changed'
receipt = {
    'schema': 'tiles-mother-v06-site-preservation',
    'allowedWrites': sorted(allowed),
    'preservedFiles': len(before),
    'changedOutsideAllowed': [],
    'pagesSettingsChanged': False,
    'otherMotherAssetsChanged': False,
    'mainChanged': False,
    'visualApproved': False,
    'productionApproved': False,
    'distillationComplete': False,
}
Path('/tmp/tm-v06/site-preservation.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
