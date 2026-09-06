from pathlib import Path
import hashlib,json
r=Path(__file__).parent
names=['math.js','geometry.js','shaders.js','renderer.js','scene.js','app.js']
code='\n'.join((r/'source'/n).read_text() for n in names)
shell=(r/'source/shell.html').read_text()
out=shell.replace('/*__APP__*/',code)
assert '<script src' not in out and 'base64,' not in out
(r/'START_HERE.html').write_text(out)
info={'version':'clean-02','bytes':len(out.encode()),'sha256':hashlib.sha256(out.encode()).hexdigest(),'ownImplementation':True,'bundledThirdPartyRuntimeBytes':0,'externalMaterialImages':0,'sourceSHA256':{n:hashlib.sha256((r/'source'/n).read_bytes()).hexdigest() for n in names},'visualApproved':False,'productionApproved':False}
(r/'BUILD.json').write_text(json.dumps(info,indent=2)+'\n')
print(info['bytes'],info['sha256'])
