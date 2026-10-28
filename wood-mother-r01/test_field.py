import math,json,random,pathlib,re
# Independent CPU mirror of shader growth field, used only for numeric regression.
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def growth(p,knot=True,kh=0,kr=.18):
 x,y,z=p;r=math.hypot(x,z);ts=r*(1+.035*math.sin(3*math.atan2(z,x)+y*.8)) if r>1e-6 else 0
 if not knot:return ts
 db=math.dist(p,(r,kh+.22*r*r,0));tb=db/max(.035,kr*(1-.18*math.sqrt(r)));a=min(ts,tb);b=max(ts,tb,1e-6);k=3.25+1.75*(ts-tb)/(.3+abs(ts-tb));s=a/(1+(a/b)**k)**(1/k);w=1-smooth(.1+.25*r,.32+.42*r,db);return ts*(1-w)+s*w
random.seed(42);points=[tuple(random.uniform(-1,1)for _ in range(3))for _ in range(10000)]+[(0,0,0)]
assert all(math.isfinite(growth(p))for p in points)
assert growth((0,0,0))==0
assert all(growth((-.6,y,.4))==growth((-.6,y,.4),False)for y in [0,.4,1])
assert abs(growth((.6,.1,0))-growth((.600001,.1,0)))<.0001
text=pathlib.Path(__file__).with_name('index.html').read_text();shader=re.search(r'<script id="fragment"[^>]*>(.*?)</script>',text,re.S).group(1)
assert min(1+.12*1.618*math.cos(1.618*q) for q in [i/100 for i in range(10000)])>.805
assert 'if(rho>1e-6)' in shader
assert '木节与纤维的共同生长场' not in text
assert all(math.isfinite(growth(p,kh=h,kr=r)) for p in points[:200] for h in [-.65,0,.65] for r in [.08,.18,.3])
result={'finite_points':len(points),'axis_finite':True,'outside_branch_support_unchanged':True,'small_cut_step_continuous':True,'html_bytes':len(text.encode()),'fragment_source_bytes':len(shader.encode()),'runtime_external_assets':0,'browser':'BLOCKED: sandbox socket; escalation bwrap infrastructure failure; CUA file scheme denied','public':'NOT_PUBLISHED','shareAllowed':False}
pathlib.Path(__file__).with_name('numeric-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
