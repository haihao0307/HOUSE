"""Materialize the hash-locked V0.9.8 handoff without modifying its runtime."""
from pathlib import Path, PurePosixPath
import base64, hashlib, json, lzma, subprocess
root=Path(__file__).resolve().parent
parts=[root/'transport'/f'payload.part{i:02d}' for i in range(6)]
packed=b''.join(p.read_bytes() for p in parts)
assert len(packed)==45136
assert hashlib.sha256(packed).hexdigest()=='26ef9b6eb013996045cb9719827219f7f7cee37c47406b6f1c373c60e9f45ef4'
data=json.loads(lzma.decompress(packed))
files=data['files']
assert len(files)==34
for name,text in files.items():
    rel=PurePosixPath(name)
    assert not rel.is_absolute() and '..' not in rel.parts and isinstance(text,str)
    target=root.joinpath(*rel.parts)
    assert target.resolve().is_relative_to(root)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(text,encoding='utf-8')
identity=json.loads((root/'provenance/IMMUTABLE_RUNTIME_HASHES.json').read_text())
runtime=(root.parents[1]/identity['runtimeSourcePath']).read_bytes()
assert hashlib.sha256(runtime).hexdigest()==identity['runtimeSHA256']
app=(root/'source/app.js').read_text(encoding='utf-8')
shell=(root/'source/shell.html').read_text(encoding='utf-8')
assert shell.count('__V098_RUNTIME_BASE64__')==1 and shell.count('__V098_APP_SOURCE__')==1
html=shell.replace('__V098_RUNTIME_BASE64__',base64.b64encode(runtime).decode('ascii')).replace('__V098_APP_SOURCE__','\n'+app+'\n')
(root/'START_HERE.html').write_text(html,encoding='utf-8')
vendor=root/'source/vendor/three_runtime.cjs'; vendor.parent.mkdir(parents=True,exist_ok=True)
vendor.write_text('module.exports=new Function('+json.dumps(runtime.decode('utf-8')+'\nreturn TilesReferenceRuntime;')+')();',encoding='utf-8')
subprocess.run(['python3',str(root/'tools/verify_package.py')],check=True)
print('Materialized 34 text files and exact offline V0.9.8 runtime.')
