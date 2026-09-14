from pathlib import Path
import re,subprocess,hashlib,json
H=Path(__file__).parent
h=(H/'base-08C1.html').read_text(encoding='utf-8')
shape=(H/'shape.glsl').read_text(encoding='utf-8')
pattern=r'// 08C\.1 adapter:.*?return vec3\(dx,dy,dz\);\n}'
h,n=re.subn(pattern,lambda m:shape.rstrip(),h,flags=re.S)
assert n==2,n
# Fine geometric sampling only for the inspected specimen. Roof template unchanged.
h=h.replace('function ceramic(kind,seed=23,piece=0){','function ceramic(kind,seed=23,piece=0,detail=40){')
h=h.replace('nu=40,nv=40','nu=detail,nv=detail')
h=h.replace('bands=[0,.14,.5,.86,1]','bands=detail>40?[0,.05,.10,.14,.22,.32,.42,.5,.58,.68,.78,.86,.90,.95,1]:[0,.14,.5,.86,1]')
h=h.replace("()=>ceramic(t.kind,23,piece)","()=>ceramic(t.kind,23,piece,192)")
# Actual displaced faces determine normals, including cavity walls and edge notches.
start=h.index('   if(abs(aNormal.y)>.25){')
end=h.index('\n }\n vec4 p=aModel',start)
h=h[:start]+'''   vec3 tangent=normalize(cross(abs(aNormal.z)<.9?vec3(0,0,1):vec3(1,0,0),aNormal));
   vec3 bitangent=cross(aNormal,tangent);
   float e=.00045,halfW=mix(aMeta.y>1.5?.0575:.121,aMeta.y>1.5?.045:.1105,clamp(aPosition.z/(aMeta.y>1.5?.222:.238)+.5,0.,1.));
   vec3 px=aPosition+tangent*e,pz=aPosition+bitangent*e;
   vec4 mx=aMeta,mz=aMeta;mx.w=clamp(aMeta.w+tangent.x*e/halfW,-1.,1.);mz.w=clamp(aMeta.w+bitangent.x*e/halfW,-1.,1.);
   vec3 tx=px+handmadeOffset(px,mx.xy,aState.x)+microshape(px,mx,aState.x)-local;
   vec3 tz=pz+handmadeOffset(pz,mz.xy,aState.x)+microshape(pz,mz,aState.x)-local;
   localN=normalize(cross(tx,tz));
''' +h[end:]
# Keep fine normal response secondary to real relief; avoid brushed/etched appearance.
h=h.replace('micro.gradient*(.0012*uMicroscope.x)','micro.gradient*(.00018*uMicroscope.x)')
h=h.replace('rough=clamp(.855+micro.fine*uMicroscope.w*.60,.69,.985);','rough=clamp(.86+micro.fine*uMicroscope.w*.32,.76,.97);')
h=h.replace('if(uDiagnostic==1){base=', 'if(uType==0 && vMeta.x<.9){vec3 face=normalize(cross(dFdx(vWorld),dFdy(vWorld)));N=dot(face,N)<0.?-face:face;}\n if(uDiagnostic==1){base=')
h=h.replace('08C.1','08D')
h=h.replace('micStrength:1,','micStrength:1.6,').replace('lastMicStrength=1;','lastMicStrength=1.6;').replace('data-shape="1"','data-shape="1.6"')
h=h.replace('瓦面微起伏与前口微不齐；支承边和底面保持。','真实面起伏、边口缺凹与有底气孔；底面保持。')
h=h.replace('默认 1×','默认形态').replace('增强 3×','增强形态')
h=h.replace("(key==='micStrength'||key==='micScale'?'×':'')","(key==='micScale'?'×':'')")
h=h.replace('08D · 微形态 / 独立 PBR','08D · 瓦面 / 边口 / 气孔')
h=h.replace('形态审阅版 · 屋面接触尚未验收','08D 形态候选 · 屋面接触待验收')
(H/'START_HERE.html').write_text(h,encoding='utf-8')
(H/'syntax.js').write_text(re.search(r'<script>(.*?)</script>',h,re.S)[1],encoding='utf-8')
subprocess.run(['node','--check',str(H/'syntax.js')],check=True)
(H/'syntax.js').unlink()
print(json.dumps({'version':'08D','bytes':len(h.encode()),'sha256':hashlib.sha256(h.encode()).hexdigest()}))

