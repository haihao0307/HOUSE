from pathlib import Path
import re, json, hashlib

BASE=Path('tiles-mother/r2-closeout-06-handmade/START_HERE.html')
OUT_DIR=Path('tiles-mother/r2-closeout-07-visible-handmade')
OUT=OUT_DIR/'START_HERE.html'
QA=OUT_DIR/'QA.json'

s=BASE.read_text('utf-8')
if 'R2 收尾候选 06' not in s:
    raise SystemExit('closeout 06 baseline marker missing')

s=s.replace('<title>Tiles Mother · R2 收尾候选 06</title>','<title>Tiles Mother · R2 收尾候选 07</title>')
s=s.replace('R2 收尾候选 06 · 手工成型体 / 连续有机材质','R2 收尾候选 07 · 可见手工轮廓 / Microscope 形体场')
s=s.replace('材质与失养 · R2 收尾 06','材质与失养 · R2 收尾 07')
s=s.replace('主冷灰与05的材质层级继续锁定。本版不再靠增加噪点制造“手工感”：板瓦与筒瓦先进入片级手工成型误差，包含宽尺度挠曲、轻微扭曲、端口与侧边不齐、厚薄变化；支承侧边的竖向扰动收敛到零。材质仍按片级—矿物区—菌落—稀疏孔蚀组织。','本版先证明“灰模也像手工瓦”。低频宽窄、弧度、弓曲、扭转、侧边和端口波动进入真实轮廓；Microscope 多尺度方向只作为稳定形体场，不靠颜色噪点冒充手工感。材质层级继续继承06。')

# Expose a twelve-piece silhouette comparison scene.
s=s.replace('<button data-scene="pan" class="active">单瓦</button><button data-scene="wood">木构</button>', '<button data-scene="pan" class="active">单瓦</button><button data-scene="trio">12片灰模</button><button data-scene="wood">木构</button>')
s=s.replace("trio:'三片 · 同一材料，不同窑色'", "trio:'12片 · 手工灰模形体对照'")

# Replace both visible and depth-pass deformation functions.  The old version
# drove almost everything to zero at the outline; this version deliberately
# changes the silhouette while keeping deformation bounded for roof seating.
new_fn=r'''vec3 handmadeOffset(vec3 p,vec2 meta,float sid){
 if(meta.y<.5)return vec3(0.);
 float halfW=meta.y>1.5?.0575:.1210;
 float len=meta.y>1.5?.2220:.2380;
 float u=clamp(p.x/halfW,-1.,1.),t=clamp(p.z/len+.5,0.,1.);
 float a=handHash(sid*1.113)-.5,b=handHash(sid*2.173+3.1)-.5,c=handHash(sid*4.317+1.7)-.5,d=handHash(sid*7.919+5.2)-.5;
 float e=handHash(sid*11.37+2.2)-.5,f=handHash(sid*17.71+4.6)-.5;
 float zc=2.*t-1.;
 float belly=max(0.,1.-u*u);
 // width and edge rhythm: visible at the silhouette, not only in the interior
 float widthDrift=(a*.010+b*.005*zc+c*.0025*sin(3.14159265*t+d*5.0));
 float edgeWave=(d*.0018*sin(t*8.3+e*5.0)+e*.0011*sin(t*15.7+a*4.0));
 float dx=u*widthDrift+sign(u)*pow(abs(u),2.2)*edgeWave;
 // camber, bow and twist: broad hand-forming terms, then a smaller rotated-scale term
 float camber=belly*(a*.0070+b*.0038*sin(3.14159265*t)+c*.0025*sin(2.0*3.14159265*t+d*4.0));
 float bow=belly*(d*.0060*(1.-zc*zc)+e*.0028*sin(3.14159265*t+a*3.0));
 float twist=u*(f*.0050*zc+b*.0025*sin(3.14159265*t+c*4.0));
 float r1=sin((u*.83+t*.47)*6.2+a*6.0),r2=sin((u*.31-t*.91)*11.7+d*5.0);
 float microShape=belly*(.0016*r1+.0009*r2);
 float dy=camber+bow+twist+microShape;
 // irregular end cuts and a small longitudinal skew make end lines non-perfect
 float endEdge=pow(abs(zc),6.0);
 float dz=endEdge*(c*.0026+d*.0014*sin(u*5.7+a*4.0))+u*(e*.0008+f*.0006*zc);
 return vec3(dx,dy,dz);
}'''
pat=r"vec3 handmadeOffset\(vec3 p,vec2 meta,float sid\)\{.*?\n\}"
s,n=re.subn(pat,new_fn,s,count=2,flags=re.S)
if n!=2:
    raise SystemExit(f'expected 2 handmadeOffset replacements, got {n}')

# Replace the old 3-piece comparison with twelve pan tiles in a clear 4x3 array.
pat2=r"let trio=s\.scene==='trio',kind=s\.scene==='cover'\?'cover':'pan';\s*let tiles=trio\?.*?:\[\{kind,x:0,z:0,seed:s\.seed\}\];"
repl2="""let trio=s.scene==='trio',kind=s.scene==='cover'?'cover':'pan';\n   let tiles=trio?Array.from({length:12},(_,i)=>({kind:'pan',x:(i%4-1.5)*.285,z:(Math.floor(i/4)-1)*.285,seed:s.seed+i*9973})): [{kind,x:0,z:0,seed:s.seed}];"""
s,n=re.subn(pat2,repl2,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit(f'12-piece scene replacement failed: {n}')

s=s.replace("this.bounds={center:[0,.036,0],radius:trio?.56:.23};this.fit={target:[trio?-.008:0,.025,0],distance:trio?1.43:.67,yaw:-.57,pitch:.69};",
            "this.bounds={center:[0,.036,0],radius:trio?.88:.23};this.fit={target:[0,.025,0],distance:trio?2.32:.67,yaw:-.57,pitch:.69};")
s=s.replace("const BUILD_INFO=Object.freeze({version:'R2-closeout-06'", "const BUILD_INFO=Object.freeze({version:'R2-closeout-07'")
s=s.replace("parent:'R2-closeout-05-mobile'", "parent:'R2-closeout-06-handmade'")

required=['R2 收尾候选 07','12片灰模','widthDrift','camber=','microShape','endEdge=pow(abs(zc),6.0)','R2-closeout-07']
for marker in required:
    if marker not in s:
        raise SystemExit('missing marker '+marker)

OUT_DIR.mkdir(parents=True,exist_ok=True)
OUT.write_text(s,'utf-8')
sha=hashlib.sha256(OUT.read_bytes()).hexdigest()
qa={
 'version':'R2-closeout-07-visible-handmade',
 'parent':'R2-closeout-06-handmade',
 'goal':'make handmade form visible in silhouette before material judgement',
 'changes':['per-tile visible width drift','broad camber and long-axis bow','twist across tile body','wavy side silhouette','irregular end cut','12-piece comparison scene'],
 'materialHierarchy':'inherited from 06',
 'visualApproved':False,
 'productionApproved':False,
 'sourceSHA256':sha,
 'note':'automatic checks can only prove code identity; fixed-view human visual comparison is still required'
}
QA.write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'bytes':OUT.stat().st_size,'sha256':sha},indent=2))