from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent.parent
m=json.loads((root/'MANIFEST.json').read_text(encoding='utf-8'))
errors=[]
for row in m['files']:
 p=root/row['path']
 if not p.is_file():errors.append('missing: '+row['path']);continue
 b=p.read_bytes()
 if len(b)!=row['bytes'] or hashlib.sha256(b).hexdigest()!=row['sha256']:errors.append('changed: '+row['path'])
print(json.dumps({'checked':len(m['files']),'failures':errors},ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
