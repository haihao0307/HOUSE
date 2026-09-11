from pathlib import Path
import re, hashlib, json

BASE = Path('tiles-mother/r2-closeout-05-mobile/START_HERE.html')
OUT_DIR = Path('tiles-mother/r2-closeout-06-handmade')
OUT = OUT_DIR / 'START_HERE.html'
QA = OUT_DIR / 'QA.json'

s = BASE.read_text('utf-8')
if 'R2 收尾候选 05' not in s:
    raise SystemExit('closeout 05 baseline marker missing')


def replace_once(pattern, repl, label, flags=0):
    global s
    s2, n = re.subn(pattern, lambda m: repl, s, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    s = s2

s = s.replace('<title>Tiles Mother · R2 收尾候选 05</title>', '<title>Tiles Mother · R2 收尾候选 06</title>')
s = s.replace('R2 收尾候选 05 · 移动端连续有机材质 / 静态退出面板', 'R2 收尾候选 06 · 手工成型体 / 连续有机材质')
s = s.replace('材质与失养 · R2 收尾 05', '材质与失养 · R2 收尾 06')
s = s.replace(
    '默认瓦色继续锁定于候选02基线。R2只补跨尺度微结构；本版锁定02/03的瓦形与色调；把04过重的噪波域改为移动端友好的连续方向波场，保留片级—矿物区—菌落—稀疏孔蚀层级。',
    '主冷灰与05的材质层级继续锁定。本版不再靠增加噪点制造“手工感”：板瓦与筒瓦先进入片级手工成型误差，包含宽尺度挠曲、轻微扭曲、端口与侧边不齐、厚薄变化；支承侧边的竖向扰动收敛到零。材质仍按片级—矿物区—菌落—稀疏孔蚀组织。'
)

# Make the CPU shell itself less mould-perfect while keeping the lateral seating
# height unchanged at u=+-1. These broad terms are deliberately not micro-noise.
replace_once(
    r"function tilePoint\(kind,u,t,seed=23\)\{.*?\n\}",
    r'''function tilePoint(kind,u,t,seed=23){
 const P=PROFILE[kind],w=mix(P.w0,P.w1,t),h=mix(P.h0,P.h1,t),R=(w*w*.25+h*h)/(2*h),x0=u*w*.5;
 const side=(noise(t*1.35,1,seed+7)-.5)*(1-u)*.00082+(noise(t*1.55,1,seed+97)-.5)*(1+u)*.00082;
 let x=x0+side;
 const endGate=Math.pow(Math.abs(2*t-1),8),endWave=(noise(u*1.55,5,seed+211)-.5)*.00110*endGate;
 const z=(t-.5)*P.l+mix((noise(u*1.45,2,seed+113)-.5)*.00135,(noise(u*1.72,2,seed+311)-.5)*.00135,t)+endWave;
 let y=(kind==='pan'?R-Math.sqrt(Math.max(1e-8,R*R-x0*x0)):Math.sqrt(Math.max(1e-8,R*R-x0*x0))-(R-h));
 const seatGate=Math.pow(Math.max(0,1-u*u),1.45),endKeep=Math.sin(Math.PI*t);
 const broad=(noise(u*1.15+2.3,t*1.35+1.7,seed)-.5)*.00220;
 const palm=(noise(u*2.10+.7,t*2.35+4.1,seed+11)-.5)*.00100;
 const skew=(hash(seed+331)-.5)*.00120*u*endKeep;
 y+=seatGate*(broad+palm+skew)*endKeep*endKeep;
 return [x,y,z];
}''',
    'hand-shaped tilePoint',
    re.S
)

# Give the closed shell real thickness drift instead of an almost uniform extrusion.
replace_once(
    r"function ceramic\(kind,seed=23,piece=0\)\{.*?\n\}\n// Wood reference",
    r'''function ceramic(kind,seed=23,piece=0){
 const P=PROFILE[kind],nu=28,nv=14,G=new Mesh(),surfs=[],bands=[0,.14,.5,.86,1],tag=kind==='pan'?1:2;
 const getT=(u,v)=>piece===1?v*fractureT(u,seed):piece===2?mix(fractureT(u,seed),1,v):v;
 function point(u,v,q){let t=getT(u,v),p=tilePoint(kind,u,t,seed),n=tileN(kind,u,t,seed);
  let th=P.t*(1+.070*(noise(t*1.55,u*1.35,seed+37)-.5)+.035*(noise(t*4.1,u*3.1,seed+137)-.5));
  let inset=q<.14?1-Math.sqrt(Math.max(0,1-(1-q/.14)**2)):q>.86?1-Math.sqrt(Math.max(0,1-(1-(1-q)/.14)**2)):0;
  let edge=[Math.sign(u)*Math.pow(Math.abs(u),18),0,Math.sign(v-.5)*Math.pow(Math.abs(2*v-1),18)];
  edge=V.sub(edge,V.scale(n,V.dot(edge,n)));
  let handLip=.00050+.00030*noise(u*1.8,t*2.2,seed+1901);
  return V.sub(V.sub(p,V.scale(n,q*th)),V.scale(edge,handLip*inset));
 }
 for(let q of [0,1]){let base=G.p.length/3;for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)G.vertex(point(2*i/nu-1,j/nv,q),1,tag);
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){let a=base+j*(nu+1)+i;G.quad(a,a+1,a+nu+1,a+nu+2,q===0)}
 }
 function edge(n,fn,flip,cut){let base=G.p.length/3;for(let i=0;i<=n;i++){let [u,v]=fn(i/n);for(let q of bands)G.vertex(point(u,v,q),cut?0:.78,tag)}
 for(let i=0;i<n;i++)for(let k=0;k<bands.length-1;k++){let a=base+i*bands.length+k;G.quad(a,a+bands.length,a+1,a+bands.length+1,flip)}}
 edge(nv,v=>[-1,v],true,false);edge(nv,v=>[1,v],false,false);
 edge(nu,u=>[2*u-1,0],false,piece===2);edge(nu,u=>[2*u-1,1],true,piece===1);
 G.kind=kind;G.seed=seed;G.piece=piece;return G.finish();
}
// Wood reference''',
    'handmade closed shell',
    re.S
)

# Meta.y carries ceramic family only; all other mesh types retain tag 0.
s = s.replace(
    "vertex(p,skin=1){let i=this.p.length/3;this.p.push(...p);this.meta.push(skin,0);return i}",
    "vertex(p,skin=1,tag=0){let i=this.p.length/3;this.p.push(...p);this.meta.push(skin,tag);return i}"
)
if 'vertex(p,skin=1,tag=0)' not in s:
    raise SystemExit('mesh meta tag patch failed')

VERT = r'''const VERT=`#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aMeta;
layout(location=3) in mat4 aModel;
layout(location=7) in vec4 aState;
uniform mat4 uVP,uLightVP;
uniform int uType;
out vec3 vWorld,vLocal,vNormal;
out vec4 vShadow;
out vec2 vMeta;
flat out vec4 vState;
float handHash(float x){return fract(sin(x*12.9898+78.233)*43758.5453123);}
vec3 handmadeOffset(vec3 p,vec2 meta,float sid){
 if(meta.y<.5)return vec3(0.);
 float halfW=meta.y>1.5?.0575:.1210;
 float len=meta.y>1.5?.2220:.2380;
 float u=clamp(p.x/halfW,-1.,1.),t=clamp(p.z/len+.5,0.,1.);
 float sideKeep=max(0.,1.-u*u);sideKeep*=sideKeep;
 float endKeep=sin(3.14159265*t);endKeep*=endKeep;
 float a=handHash(sid*1.113)-.5,b=handHash(sid*2.173+3.1)-.5,c=handHash(sid*4.317+1.7)-.5,d=handHash(sid*7.919+5.2)-.5;
 float broad=a*.00280+b*.00140*sin(2.3*u+1.7*t+c*4.0)+c*.00090*(2.*t-1.)+d*.00070*u;
 float dy=sideKeep*endKeep*broad;
 float sideEdge=pow(abs(u),12.),endEdge=pow(abs(2.*t-1.),12.);
 float dx=sideEdge*(a*.00034+b*.00018*sin(t*7.1+d*3.0))*sign(u);
 float dz=endEdge*(c*.00055+d*.00028*sin(u*5.3+a*4.0));
 return vec3(dx,dy,dz);
}
void main(){
 vec3 local=aPosition,localN=aNormal;
 if(uType==0 && aMeta.y>.5){
   vec3 off=handmadeOffset(aPosition,aMeta,aState.x);local+=off;
   if(abs(aNormal.y)>.25){
     float e=.0010;
     float dx=(handmadeOffset(aPosition+vec3(e,0,0),aMeta,aState.x).y-handmadeOffset(aPosition-vec3(e,0,0),aMeta,aState.x).y)/(2.*e);
     float dz=(handmadeOffset(aPosition+vec3(0,0,e),aMeta,aState.x).y-handmadeOffset(aPosition-vec3(0,0,e),aMeta,aState.x).y)/(2.*e);
     float sy=sign(aNormal.y);localN=normalize(aNormal+vec3(-dx*sy,0.,-dz*sy));
   }
 }
 vec4 p=aModel*vec4(local,1.);
 vec3 a=aModel[0].xyz,b=aModel[1].xyz,c=aModel[2].xyz;
 vNormal=normalize(a*localN.x/dot(a,a)+b*localN.y/dot(b,b)+c*localN.z/dot(c,c));
 vLocal=local;
 if(uType==1) vLocal=aPosition*vec3(length(a),length(b),length(c))+vec3(0,0,aState.w);
 vWorld=p.xyz;vShadow=uLightVP*p;vMeta=aMeta;vState=aState;gl_Position=uVP*p;
}`;'''
replace_once(r"const VERT=`#version 300 es.*?`;(?=\nconst DEPTH_VERTEX=)", VERT, 'handmade vertex shader', re.S)

DEPTH = r'''const DEPTH_VERTEX=`#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPosition;
layout(location=2) in vec2 aMeta;
layout(location=3) in mat4 aModel;
layout(location=7) in vec4 aState;
uniform mat4 uLightVP;
uniform int uType;
float handHash(float x){return fract(sin(x*12.9898+78.233)*43758.5453123);}
vec3 handmadeOffset(vec3 p,vec2 meta,float sid){
 if(meta.y<.5)return vec3(0.);
 float halfW=meta.y>1.5?.0575:.1210;
 float len=meta.y>1.5?.2220:.2380;
 float u=clamp(p.x/halfW,-1.,1.),t=clamp(p.z/len+.5,0.,1.);
 float sideKeep=max(0.,1.-u*u);sideKeep*=sideKeep;
 float endKeep=sin(3.14159265*t);endKeep*=endKeep;
 float a=handHash(sid*1.113)-.5,b=handHash(sid*2.173+3.1)-.5,c=handHash(sid*4.317+1.7)-.5,d=handHash(sid*7.919+5.2)-.5;
 float broad=a*.00280+b*.00140*sin(2.3*u+1.7*t+c*4.0)+c*.00090*(2.*t-1.)+d*.00070*u;
 float dy=sideKeep*endKeep*broad;
 float sideEdge=pow(abs(u),12.),endEdge=pow(abs(2.*t-1.),12.);
 float dx=sideEdge*(a*.00034+b*.00018*sin(t*7.1+d*3.0))*sign(u);
 float dz=endEdge*(c*.00055+d*.00028*sin(u*5.3+a*4.0));
 return vec3(dx,dy,dz);
}
void main(){vec3 local=aPosition;if(uType==0&&aMeta.y>.5)local+=handmadeOffset(aPosition,aMeta,aState.x);gl_Position=uLightVP*aModel*vec4(local,1.);}`;'''
replace_once(r"const DEPTH_VERTEX=`#version 300 es.*?`;(?=\nconst DEPTH_FRAGMENT=)", DEPTH, 'handmade depth shader', re.S)

# The depth pass must use the same ceramic deformation or shadows would reveal the old mould shape.
s = s.replace(
    "this.depthLoc=gl.getUniformLocation(this.depthProgram,'uLightVP');",
    "this.depthLoc=gl.getUniformLocation(this.depthProgram,'uLightVP');this.depthTypeLoc=gl.getUniformLocation(this.depthProgram,'uType');"
)
s = s.replace(
    "for(let m of this.groups)if(m.cast){g.bindVertexArray(m.vao);g.drawElementsInstanced(g.TRIANGLES,m.count,g.UNSIGNED_INT,0,m.instances)}",
    "for(let m of this.groups)if(m.cast){g.uniform1i(this.depthTypeLoc,m.type);g.bindVertexArray(m.vao);g.drawElementsInstanced(g.TRIANGLES,m.count,g.UNSIGNED_INT,0,m.instances)}"
)
if 'depthTypeLoc' not in s:
    raise SystemExit('depth type uniform patch failed')

replace_once(
    r"const BUILD_INFO=Object\.freeze\(\{.*?\}\);",
    "const BUILD_INFO=Object.freeze({version:'R2-closeout-06',parent:'R2-closeout-05-mobile',form:'handmade broad belly/twist + irregular lips + variable thickness; per-tile stable instance deformation',support:'vertical hand deformation converges to zero at lateral seating edges',materialOrder:'height-edge-damage -> structure-derived color -> independent roughness',surface:'tile identity -> mineral regions -> colony clusters -> sparse pores'});",
    'build info',
    re.S
)

# Make the visible single-tile label explicit: this is now a form change, not merely material noise.
s = s.replace("'闭合薄壳 · 灰青陶面 · 局部土赭'", "'手工成型薄壳 · 非模具平整 · 灰青陶面'")

required = [
    'R2-closeout-06', 'handmadeOffset', 'meta.y>1.5', 'depthTypeLoc',
    "vertex(p,skin=1,tag=0)", "tag=kind==='pan'?1:2",
    'seatGate=Math.pow(Math.max(0,1-u*u),1.45)', 'handLip=.00050'
]
for marker in required:
    if marker not in s:
        raise SystemExit('required marker missing: ' + marker)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(s, 'utf-8')
sha = hashlib.sha256(OUT.read_bytes()).hexdigest()
qa = {
    'version': 'R2-closeout-06-handmade',
    'parent': 'R2-closeout-05-mobile',
    'parentCommitAtDesign': 'e9cf0ed2a118a6eed19b294dcc6cf80e60393195',
    'scope': [
        'replace mould-perfect ceramic form with broad hand-forming variation',
        'make every ceramic instance receive a stable seed-driven belly/twist deformation',
        'add irregular end/side lips and materially plausible thickness drift',
        'keep lateral seating height protected by a zero-displacement gate',
        'match the shadow depth pass to the deformed visible geometry'
    ],
    'preserved': [
        'R2 closeout 05 material hierarchy and cold-gray baseline',
        'roof support closure / neglect history logic',
        'pan-cover dimensions and nominal seating system',
        'mobile close-panel interaction'
    ],
    'constraints': {
        'handmadeCenterDisplacementDesignMaxMmApprox': 2.9,
        'sideEdgeVerticalDisplacementMm': 0.0,
        'sideLipHorizontalDesignMaxMmApprox': 0.26,
        'endLipLongitudinalDesignMaxMmApprox': 0.42,
        'thicknessVariation': 'broad two-band drift, approximately within +/- 5.25% before lip rounding',
        'noUniqueMeshPer860Tile': 'per-instance vertex deformation keeps mobile draw-call budget bounded; individuality comes from stable instance seed plus material identity'
    },
    'sourceBytes': len(OUT.read_bytes()),
    'sourceSHA256': sha,
    'visualApproved': False,
    'productionApproved': False
}
QA.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + '\n', 'utf-8')
print(json.dumps({'sourceSHA256': sha, 'sourceBytes': qa['sourceBytes']}, indent=2))
