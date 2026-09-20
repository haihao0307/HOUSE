"""Recover the user-reviewed R4 core, then package a minimal public UI.
The original failed candidate is never executed. Every recovered source must
match its independently recorded SHA256 before it is eligible for testing.
"""
from pathlib import Path
import hashlib, json, os, re, subprocess, sys, tempfile

REPAIR = Path(__file__).resolve().parent
REPO = REPAIR.parent.parent
BRICK = REPO / 'yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother'
OUT = Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
sha = lambda text: hashlib.sha256(text.encode('utf-8')).hexdigest()
recovered = {}
receipt = {}
with tempfile.TemporaryDirectory() as temporary:
    baseline = Path(temporary)
    subprocess.run([sys.executable, str(BRICK / 'experiments/atelier-r4/build_web.py'), str(baseline)], check=True)
    for filename in ['app.json', 'index.json', 'kernel.json', 'renderer.json']:
        change = json.loads((REPAIR / filename).read_text(encoding='utf-8'))
        name = change['path']
        text = (baseline / 'generated-src' / name).read_text(encoding='utf-8')
        if sha(text) != change['baseSHA256']:
            raise ValueError('Recovery baseline mismatch: ' + name)
        end = 0
        for first, last, replacement in change['edits']:
            if not (end <= first <= last <= len(text)) or not isinstance(replacement, str):
                raise ValueError('Invalid ordered source correction: ' + name)
            end = last
        for first, last, replacement in reversed(change['edits']):
            text = text[:first] + replacement + text[last:]
        if sha(text) != change['targetSHA256']:
            raise ValueError('Recovered source checksum mismatch: ' + name + ' actual=' + sha(text))
        recovered[name] = text
        receipt[name] = sha(text)

# The material, geometry, and application below retain reviewed bytes.
# Public layout is a small explicit replacement; no material changes are hidden in it.
recovered['style.css'] = (REPAIR / 'public-layout.css').read_text(encoding='utf-8')
template = recovered['index.template.html']
template = template.replace('<button data-history=', '<button disabled title="历史原件保存在完整源码备份中" data-history=')
template = template.replace('版本号与材料类别分别显示。旧版按原字节保留，一次只运行一个工作台。', '这是 R4 公开版，七类材料可直接查看。历史原件保存在完整源码备份中，本网址不自动载入旧版。')
template = template.replace('/*LEGACY_R2*/', '').replace('/*LEGACY_R3*/', '')
head = os.environ.get('GITHUB_SHA', 'local-unpublished')
template = template.replace('<title>', '<meta name="source-commit" content="'+head+'"><meta name="release-version" content="R4-public-1"><title>', 1)
compiled = template
for marker, name in [('STYLE','style.css'),('KERNEL','kernel.js'),('RENDERER','renderer.js'),('APP','app.js')]:
    token = '/*'+marker+'*/'
    if compiled.count(token) != 1:
        raise ValueError('Missing or repeated build marker: '+marker)
    compiled = compiled.replace(token, recovered[name])
assert 'window.BrickR4=' in compiled
assert not re.search(r'<script[^>]+src=', compiled, re.I)
assert len(compiled.encode('utf-8')) < 120000
(OUT / 'index.html').write_text(compiled, encoding='utf-8')
(OUT / 'generated-src').mkdir(exist_ok=True)
for name, text in recovered.items():
    (OUT / 'generated-src' / name).write_text(text, encoding='utf-8')
manifest = {
    'version':'R4-public-1', 'head':head,
    'reviewedStandaloneSHA256':'c7908e6c19ccbb3bf664b99c287ab775e7306f38547e000fe2a79ce278241695',
    'reviewedCoreHashes':receipt,
    'materialGeometryApplicationUnchangedFromReviewedR4':True,
    'publicLayout':'small explicit public layout; original offline layout retained in backup',
    'publicLegacy':'not mounted; original files preserved in previously delivered full source',
    'htmlSHA256':sha(compiled), 'bytes':len(compiled.encode('utf-8')),
    'defaultMaterial':'fired',
    'materials':['fired','kiln','adobe','dressed','rubble','stone','pebble'],
    'humanVisualApproved':False, 'productionApproved':False,
    'knownMaterialIssues':['kiln/fired distinction','straw blade rim definition','dressed stone cement-like appearance','pebble material'],
    'publicURLVerified':False
}
(OUT / 'RELEASE.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
for i, match in enumerate(re.finditer(r'<script([^>]*)>(.*?)</script>', compiled, re.S)):
    if 'application/octet-stream' in match.group(1):
        continue
    script = OUT / ('check-'+str(i)+'.js')
    script.write_text(match.group(2), encoding='utf-8')
    subprocess.run(['node', '--check', str(script)], check=True)
    script.unlink()
print(json.dumps(manifest, ensure_ascii=False, indent=2))
