"""Materialize clean R6 source, with exact input and independently tested output hashes."""
from pathlib import Path
import hashlib,shutil,subprocess,sys
HERE=Path(__file__).resolve().parent
BRICK=HERE.parent.parent/'yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother'
BASE=BRICK/'experiments/atelier-r5/src';DEST=BRICK/'experiments/atelier-r6'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inputs={'kernel.js':'2b30e9b7d00557a8632037e718a39c12296c5e77988a6463b2199491e0c537bf','renderer.js':'9ca030b93cd8d313e2aa2a1d54c7511e2914a589bd892c2feee965a467ff7076'}
for name,h in inputs.items():assert sha(BASE/name)==h,'Unexpected R5 input '+name
for name in ['kernel','renderer']:subprocess.run([sys.executable,str(HERE/('upgrade_'+name+'.py'))],check=True)
for f in (HERE/'payload').iterdir():
 if f.is_file():shutil.copyfile(f,DEST/'src'/f.name)
# Final reviewed granite adjustment: independent quartz mask avoids concentric halos.
p=DEST/'src/renderer.js';s=p.read_text()
for a,b in [('q*vec3(45.3,48.1,41.7)','q*vec3(65.3,68.1,61.7)'),('noise(gp*1.91+','noise(gp*1.31+'),('fp*48.1','fp*68.1'),('smoothstep(.23,.32,cr+.13*(other-.5))','smoothstep(.22,.29,cr+.13*(other-.5))'),('smoothstep(.42,.50,cr)*(1.-smoothstep(.64,.72,cr))','smoothstep(.51,.63,other)*(1.-mica)'),('warm=clamp(.3+.7*meso+uTone*.42','warm=clamp(.12+.38*meso+uTone*.35')]:
 assert a in s,a
 s=s.replace(a,b)
p.write_text(s)
expected={'kernel.js':'a282bdf38897ce19d88383c5dc653df07fe613432f41248ffc98187f530f81c5','renderer.js':'589699549f589847b3946bfda1672b97b29279235cd1dee8cb851f2bd6a739a0','app.js':'8a8d5775fb6b3804fa77cf23c18fca58ac30d85a58d714e645ece87033f75879','index.template.html':'7d3a0a35957e28723daf09e49d8c0d51b4d9cc5e06796d1298ee1772910d47f2','style.css':'abce4f15ef82d9afaf3c550cbee30ff5bf67ebfb3d5127b1dde13df72c6ae2cb'}
for name,h in expected.items():assert sha(DEST/'src'/name)==h,'R6 output differs '+name+' actual='+sha(DEST/'src'/name)
shutil.copyfile(HERE/'build.py',DEST/'build.py')
(DEST/'tests').mkdir(exist_ok=True)
for f in (HERE/'tests').iterdir():
 if f.is_file():shutil.copyfile(f,DEST/'tests'/f.name)
subprocess.run([sys.executable,str(DEST/'build.py')],check=True)
