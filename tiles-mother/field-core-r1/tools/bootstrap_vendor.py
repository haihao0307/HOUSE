from pathlib import Path
import hashlib,re,base64,json
root=Path(__file__).resolve().parents[1]
ref=root/'reference'
ref.mkdir(exist_ok=True)
p=ref/'runtime.b64'
expected="fc83af2e8f32e53d9d064fe3e466f786552ef80fba3289fe69168e7d94e8916e"
if not p.exists():
    old=root.parent/'v0911/START_HERE.html'
    raw=old.read_bytes()
    assert hashlib.sha256(raw).hexdigest()=='f66f5832bc5186033219e9c80a394fb159627ade8195c2fd58e424f39ad6cb83'
    vendor=re.search(r'<script id="three-b64"[^>]*>(.*?)</script>',raw.decode(),re.S).group(1)
    assert hashlib.sha256(vendor.encode()).hexdigest()==expected
    p.write_text(vendor)
assert hashlib.sha256(p.read_bytes()).hexdigest()==expected
code=base64.b64decode(p.read_bytes()).decode()
assert all(word not in code for word in ['integrateTimber','clayShader','TilesMotherV0911'])
(ref/'three_runtime.cjs').write_text('module.exports=new Function('+json.dumps(code+'\nreturn TilesReferenceRuntime;')+')();\n')
print('Only third-party renderer extracted and verified')
