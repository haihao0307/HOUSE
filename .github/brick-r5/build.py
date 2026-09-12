"""Deterministic self-contained R5 review page; no external runtime assets."""
from pathlib import Path
import hashlib, json, re, os, sys, subprocess
ROOT=Path(__file__).resolve().parent
out=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'web'
out.mkdir(parents=True,exist_ok=True)
sources={n:(ROOT/'src'/n).read_text(encoding='utf-8') for n in ['index.template.html','style.css','app.js','renderer.js','kernel.js']}
html=sources['index.template.html']
for token,name in [('STYLE','style.css'),('KERNEL','kernel.js'),('RENDERER','renderer.js'),('APP','app.js')]:
 assert html.count('/*'+token+'*/')==1
 html=html.replace('/*'+token+'*/',sources[name])
head=os.environ.get('GITHUB_SHA','local-candidate')
html=html.replace('<title>',f'<meta name="source-commit" content="{head}"><meta name="release-version" content="R5.0.0"><title>',1)
assert not re.search(r'<script[^>]+src=',html)
assert len(html.encode())<110000
(out/'index.html').write_text(html,encoding='utf-8')
for i,script in enumerate(re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)):
 p=out/f'check-{i}.js';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
h=lambda b:hashlib.sha256(b).hexdigest()
manifest={'version':'R5.0.0','sourceHead':head,'htmlSHA256':h(html.encode()),'bytes':len(html.encode()),'sourceSHA256':{n:h(t.encode()) for n,t in sources.items()},'defaultMaterial':'fired','materials':['fired','kiln','adobe','dressed','rubble','stone','pebble'],'lithologies':['R4-layer-preserved','granite-candidate','sandstone-candidate','basalt-candidate','quartzite-candidate'],'R4_preserved':True,'referenceGLBLoaded':False,'humanVisualApproved':False,'productionApproved':False,'publicURLVerified':False}
(out/'RELEASE.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False))
