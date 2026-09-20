"""Independent ray-parity classification against the FINAL extracted body mesh.
Finite anchor-point evidence only; this does not prove whole-strand intersection.
"""
from pathlib import Path
import numpy as np, json, sys
out=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'qa'
d=json.loads((out/'adobe-mesh.json').read_text());v=np.asarray(d['position']).reshape(-1,3);tri=v[np.asarray(d['index']).reshape(-1,3)]
a,b,c=tri[:,0],tri[:,1],tri[:,2]
det=(b[:,1]-a[:,1])*(c[:,2]-a[:,2])-(b[:,2]-a[:,2])*(c[:,1]-a[:,1])
mn=tri[:,:,1:].min(axis=1);mx=tri[:,:,1:].max(axis=1)
def inside(p):
 x,y,z=p
 y+=1.23e-10;z+=2.71e-10
 sel=(np.abs(det)>1e-14)&(mn[:,0]<=y)&(mx[:,0]>=y)&(mn[:,1]<=z)&(mx[:,1]>=z)
 aa,bb,cc,dd=a[sel],b[sel],c[sel],det[sel]
 u=((y-aa[:,1])*(cc[:,2]-aa[:,2])-(z-aa[:,2])*(cc[:,1]-aa[:,1]))/dd
 w=((bb[:,1]-aa[:,1])*(z-aa[:,2])-(bb[:,2]-aa[:,2])*(y-aa[:,1]))/dd
 hits=(u>=-1e-10)&(w>=-1e-10)&(u+w<=1+1e-10)
 xi=aa[:,0]+u*(bb[:,0]-aa[:,0])+w*(cc[:,0]-aa[:,0])
 crossings=np.unique(np.round(xi[hits & (xi>x)],9))
 return len(crossings)%2==1
fail=[x for x in d['anchors'] if not inside(x['point'])]
controls=[[4+i*.1,0,0] for i in range(24)]
assert not any(inside(p) for p in controls),'negative controls classified inside'
report={'version':'R5','sampleSeed':4517,'resolution':72,'method':'positive-x final triangle-mesh parity with yz candidate bounds','testedAnchorPoints':len(d['anchors']),'anchorFailures':fail,'negativeControls':len(controls),'falsePositiveControls':0,'fibers':d['stats']['fibers'],'sixFaces':sorted(set(x['face'] for x in d['anchors'])),'wholeStrandContactProof':False,'passed':not fail}
(out/'anchor-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
assert not fail,fail[:5]
print(json.dumps(report,ensure_ascii=False))
