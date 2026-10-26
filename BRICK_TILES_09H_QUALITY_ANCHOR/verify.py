from pathlib import Path
import json, hashlib
base=json.loads((Path(__file__).parent/'BASELINE.json').read_text(encoding='utf8'))
root=Path(base['source_root']); failures=[]
for item in base['files']:
 p=root/item['path']
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=item['sha256']: failures.append(item['path'])
print(json.dumps({'pass':not failures,'checked':len(base['files']),'changed_or_missing':failures},ensure_ascii=False))
raise SystemExit(bool(failures))
