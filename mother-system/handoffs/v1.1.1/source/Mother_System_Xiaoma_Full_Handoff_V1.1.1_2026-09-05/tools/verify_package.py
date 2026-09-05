"""Read-only validation of a local Xiaoma handoff; standard library only."""
from pathlib import Path
import hashlib, json, sys, zipfile

def validate(root):
    root = root.resolve()
    manifest = json.loads((root / 'MANIFEST.json').read_text(encoding='utf-8'))
    entries = manifest['files']
    names = [x['path'] for x in entries]
    if len(set(names)) != len(names): raise ValueError('Duplicate manifest paths')
    ignored = {'MANIFEST.json', 'SHA256SUMS'}
    actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p.relative_to(root).as_posix() not in ignored}
    if set(names) != actual: raise ValueError({'missing': sorted(set(names)-actual), 'unlisted': sorted(actual-set(names))})
    for item in entries:
        p = (root / item['path']).resolve()
        if not p.is_relative_to(root) or p.is_symlink(): raise ValueError('Unsafe path: '+item['path'])
        b = p.read_bytes()
        if len(b) != item['bytes'] or hashlib.sha256(b).hexdigest() != item['sha256']: raise ValueError('Hash mismatch: '+item['path'])
        if p.suffix == '.zip':
            with zipfile.ZipFile(p) as archive:
                if archive.testzip() is not None: raise ValueError('ZIP CRC mismatch: '+item['path'])
        if p.suffix == '.json': json.loads(b)
    sum_paths = set()
    for line in (root / 'SHA256SUMS').read_text(encoding='utf-8').splitlines():
        digest, rel = line.split('  ', 1)
        if rel in sum_paths: raise ValueError('Duplicate checksum path')
        sum_paths.add(rel)
        p = (root / rel).resolve()
        if not p.is_relative_to(root) or hashlib.sha256(p.read_bytes()).hexdigest() != digest: raise ValueError('Checksum mismatch: '+rel)
    if sum_paths != actual | {'MANIFEST.json'}: raise ValueError('SHA256SUMS coverage mismatch')
    originals = manifest['original_archives']
    for item in originals:
        if hashlib.sha256((root / item['path']).read_bytes()).hexdigest() != item['sha256']: raise ValueError('Source archive changed')
    return {'status':'passed', 'files_hash_checked':len(entries), 'source_archives_checked':len(originals), 'scope':'Package integrity only, not production approval or remote full publication'}

if __name__ == '__main__':
    try:
        print(json.dumps(validate(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]), ensure_ascii=False, indent=2))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
