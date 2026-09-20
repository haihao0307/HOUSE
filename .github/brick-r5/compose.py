"""Apply transparent, ordered source edits, check exact source identities,
and save a clean, directly rebuildable R5 experiment. Never edits R4 files.
"""
from pathlib import Path
import hashlib, json, os, re, shutil, subprocess
HERE=Path(__file__).resolve().parent
REPO=HERE.parent.parent
BRICK=REPO/'yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother'
BASE=BRICK/'experiments/atelier-r4/web/generated-src'
DEST=BRICK/'experiments/atelier-r5'
FILES=['kernel.js','renderer.js','app.js','index.template.html','style.css']
def digest(text):return hashlib.sha256(text.encode('utf-8')).hexdigest()
(DEST/'src').mkdir(parents=True,exist_ok=True)
for name in FILES:
    spec=json.loads((HERE/'changes'/(Path(name).stem+'.json')).read_text(encoding='utf-8'))
    assert spec['path']==name
    original=(BASE/name).read_text(encoding='utf-8')
    assert digest(original)==spec['baseSHA256'], 'Baseline mismatch '+name
    end=0
    for a,b,replacement in spec['edits']:
        assert isinstance(a,int) and isinstance(b,int) and end<=a<=b<=len(original)
        assert isinstance(replacement,str)
        end=b
    text=original
    for a,b,replacement in reversed(spec['edits']):text=text[:a]+replacement+text[b:]
    assert digest(text)==spec['targetSHA256'], 'Final source mismatch '+name
    (DEST/'src'/name).write_text(text,encoding='utf-8')
shutil.copyfile(HERE/'build.py',DEST/'build.py')
(DEST/'tests').mkdir(exist_ok=True)
for name in ['geometry.cjs','anchors.py','browser.py']:
    shutil.copyfile(HERE/'tests'/name,DEST/'tests'/name)
subprocess.run(['python',str(DEST/'build.py')],check=True)
print('Clean R5 source and web files prepared at',DEST)
