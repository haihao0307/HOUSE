"""Prepare the actual V0.4 study inputs without duplicating a Mother package.
Generated engine/evidence files are deployment outputs, not new source assets.
"""
from pathlib import Path
import hashlib,json,os,re
from PIL import Image
ROOT=Path(__file__).resolve().parent
BASE=ROOT.parent/'index.html'
raw=BASE.read_bytes()
expected='43e5a6d2e0121da469b07d2e5452829e5c00ba4e2440aa65930776fab6184887'
assert hashlib.sha256(raw).hexdigest()==expected,'Review the changed V0.3 baseline before rebuilding'
html=raw.decode('utf-8')
m=re.search(r'<script id="tm-reference-runtime">([\s\S]*?)</script>',html)
assert m,'Pinned numerical runtime is missing'
runtime=m.group(1)+'\nwindow.TMThree=TilesReferenceRuntime;\n'
(ROOT/'three-runtime.js').write_text(runtime,encoding='utf-8',newline='\n')
marker='<!-- THIRD PARTY NOTICES'
assert marker in html
notices=html.split(marker,1)[1].split('-->',1)[0]
(ROOT/'THIRD-PARTY-NOTICES.txt').write_text(notices,encoding='utf-8',newline='\n')
source=ROOT.parent/'knowledge/jiangwutang-001/initial-fbx-model-contact-sheet.png'
with Image.open(source) as image:
 image.convert('RGB').save(ROOT/'reference-contact.jpg',quality=88)
files={}
for name in ['index.html','operators.js','viewer.js','three-runtime.js','reference-contact.jpg','THIRD-PARTY-NOTICES.txt']:
 p=ROOT/name;data=p.read_bytes();files[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
manifest={'version':'0.4.0','sourceCommit':os.environ.get('GITHUB_SHA','local-unpublished'),'baselineIndexSHA256':expected,'files':files,'numericalRuntime':'Three.js 0.180.0 reused from pinned V0.3','rawSourceInRuntime':False,'completeSourceTexturesInRuntime':False,'referenceThumbnailOnly':True,'physicalDimensionsCalibrated':False,'agingRatesCalibrated':False,'visualApproved':False,'productionApproved':False,'distillationComplete':False}
(ROOT/'build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
(ROOT/'CHECKSUMS.sha256').write_text(''.join(v['sha256']+'  '+k+'\n' for k,v in files.items()),encoding='utf-8',newline='\n')
print(json.dumps(manifest,indent=2))
