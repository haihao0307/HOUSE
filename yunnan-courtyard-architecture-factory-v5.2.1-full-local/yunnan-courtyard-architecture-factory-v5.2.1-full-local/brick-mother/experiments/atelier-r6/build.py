from pathlib import Path
import hashlib,json,os,re,subprocess
root=Path(__file__).resolve().parent;out=root/'web';out.mkdir(exist_ok=True)
src={p.name:p.read_text() for p in (root/'src').iterdir() if p.is_file()}
text=src['index.template.html']
for tag,name in [('STYLE','style.css'),('KERNEL','kernel.js'),('RENDERER','renderer.js'),('APP','app.js')]:
 assert text.count('/*'+tag+'*/')==1
 text=text.replace('/*'+tag+'*/',src[name])
head=os.environ.get('GITHUB_SHA','local-r6-candidate')
text=text.replace('<title>','<meta name="source-commit" content="'+head+'"><meta name="release-version" content="R6.0.0"><title>',1)
for i,js in enumerate(re.findall(r'<script[^>]*>(.*?)</script>',text,re.S)):
 f=out/f'check-{i}.js';f.write_text(js);subprocess.run(['node','--check',str(f)],check=True);f.unlink()
assert len(text.encode())<115000 and not re.search(r'<script[^>]+src=',text)
(out/'index.html').write_text(text)
hash=lambda t:hashlib.sha256(t.encode()).hexdigest()
manifest={'version':'R6.0.0','sourceHead':head,'htmlSHA256':hash(text),'bytes':len(text.encode()),'sourceSHA256':{n:hash(t) for n,t in src.items()},'previous':'R5 retained','humanVisualApproved':False,'productionApproved':False}
(out/'RELEASE.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False))
print(json.dumps(manifest,ensure_ascii=False))
