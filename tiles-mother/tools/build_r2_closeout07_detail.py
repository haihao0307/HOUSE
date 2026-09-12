from pathlib import Path
import hashlib, json, re

ROOT = Path(__file__).resolve().parent
LOCAL = (ROOT / 'upstream/tiles-mother').exists()
PROJECT = ROOT / 'upstream/tiles-mother' if LOCAL else ROOT.parent
BASE = PROJECT / 'r2-closeout-06-handmade/START_HERE.html'
OUT = ROOT / 'candidate/r2-closeout-07-detail' if LOCAL else PROJECT / 'r2-closeout-07-detail'
s = original = BASE.read_text(encoding='utf-8')
assert hashlib.sha256(BASE.read_bytes()).hexdigest() == 'd9ef30d5d9284a2ffb831793d8114534e20982bc2476ffc2e3d1d7f382eaaa8e'

def replace(a, b):
    global s
    assert s.count(a) == 1, (a[:90], s.count(a))
    s = s.replace(a, b)

replace('uniform float uShadowTexel,uShadowEnabled;', 'uniform float uShadowTexel,uShadowEnabled,uFinish;')
finish = '''// R2 final-detail layer. All coordinates are tile-local; seeds and slowly
// varying material regions control direction. These display-relief amplitudes
// are design parameters, NOT physical measurements from the reference texture.
// Original r2mm and all low-frequency body/geometry fields remain unchanged.
vec4 r2Finish(vec3 p,float seed,float footprint){
 float visible=band(footprint,460.);
 if(visible<=0.)return vec4(0.);
 float identity=tileIdentity(seed+131.);
 vec3 offset=vec3(identity*17.3,seed*.037,identity*9.7);
 float region=n3(p*33.7+offset+vec3(2.1,7.8,4.2));
 float turn=(identity-.5)*1.7+ceramicTurn(p,seed)*2.1+(region-.5)*.42;
 vec2 directed=rot2(turn)*p.xz;
 vec3 q=vec3(directed.x,p.y,directed.y);
 q.x+=(n3(p*61.3+offset+vec3(7.3,1.1,5.2))-.5)*.0026;
 // Finite, interrupted strokes: no repeated sinusoidal ridges or dot lattice.
 float pressure=n3(q*vec3(41.,67.,32.)+offset);
 float strokeField=n3(q*vec3(571.,217.,47.)+offset+vec3(3.1,9.4,2.7));
 float strokeGate=smoothstep(.53,.78,pressure);
 float groove=smoothstep(.60,.82,strokeField)*strokeGate*band(footprint,640.);
 float shoulder=(smoothstep(.41,.59,strokeField)-smoothstep(.59,.76,strokeField))*strokeGate*band(footprint,640.);
 // Pores concentrate in broken patches; compacted zones remain quieter.
 float patch=n3(p*89.3+offset+vec3(5.7,1.3,8.1));
 float grain=n3(q*733.7+offset+vec3(9.7,3.2,6.3));
 float pore=smoothstep(.70,.88,grain)*smoothstep(.43,.74,patch)*(1.-.65*strokeGate)*band(footprint,820.);
 float pressed=(n3(q*vec3(167.,109.,113.)+offset+vec3(8.1,6.7,1.3))-.5)*strokeGate;
 float relief=(pressed*.00038-groove*.00062+shoulder*.00014-pore*.00048)*visible;
 // Independent roughness field, conditioned on the forming structure, never RGB.
 float roughField=n3(p*211.3+offset+vec3(19.1,4.3,13.7))-.5;
 float roughDelta=(roughField*.042-groove*.055+pore*.070)*visible;
 return vec4(relief,groove*visible,pore*visible,roughDelta);
}
'''
replace('vec3 srgb(vec3 c)', finish+'vec3 srgb(vec3 c)')
replace('   structuralHeight-=crack*.00038;', '''   // A=06 bypasses the new layer exactly, without rebuilding or moving camera.
   vec4 finishDetail=vec4(0.);
   float finishGain=uFinish*uBio.w;
   if(finishGain>0.00001)finishDetail=r2Finish(p,seed,fp)*finishGain;
   structuralHeight+=finishDetail.x;
   structuralHeight-=crack*.00038;''')
replace('   body*=1.-pit*.13-crack*.08;', '   body*=1.-pit*.13-crack*.08;\n   body*=1.-finishDetail.z*.14;')
replace('   rough*=1.-uSurface.w*.16;base*=1.-uSurface.w*.15;', '   rough=clamp(rough+finishDetail.w,.69,.985);\n   rough*=1.-uSurface.w*.16;base*=1.-uSurface.w*.15;')
replace("'uShadowEnabled','uShadow']", "'uShadowEnabled','uShadow','uFinish']")
replace('g.uniform1i(U.uDiagnostic,settings.diagnostic);', 'g.uniform1f(U.uFinish,settings.finish);g.uniform1i(U.uDiagnostic,settings.diagnostic);')
replace('r2:.38,fracture:0,diagnostic:0', 'r2:.38,finish:1,fracture:0,diagnostic:0')
replace("document.querySelectorAll('[data-r2]').forEach(b=>b.onclick=()=>option('r2',+b.dataset.r2));", "document.querySelectorAll('[data-r2]').forEach(b=>b.onclick=()=>option('r2',+b.dataset.r2));\n document.querySelectorAll('[data-finish]').forEach(b=>b.onclick=()=>{option('finish',+b.dataset.finish);document.querySelectorAll('[data-finish]').forEach(x=>x.classList.toggle('active',x===b))});")
replace('<p class="tiny">A=0/A&gt;0 只切换跨尺度微结构强度；相机、光线、种子、主体瓦形与支承保持不变。</p>', '<p class="tiny">A=0/A&gt;0 只切换跨尺度微结构强度；相机、光线、种子、主体瓦形与支承保持不变。</p><div class="presets"><button data-finish="0">对照 A · 06</button><button data-finish="1" class="active">对照 B · 07</button></div><p class="tiny">同机位切换最后细节：局部刮抹、压实与稀疏麻面。建议放大单片观察；大形、灯光与窑色基线保持一致。</p>')
replace('Tiles Mother · R2 收尾候选 06', 'Tiles Mother · R2 收尾候选 07')
replace("version:'R2-closeout-06',parent:'R2-closeout-05-mobile'", "version:'R2-closeout-07',parent:'R2-closeout-06-handmade'")
s=s.replace("version:'r2-closeout-05'", "version:'r2-closeout-07'")
s=s.replace('R2 收尾候选 06 · 手工成型体 / 连续有机材质', 'R2 收尾候选 07 · 局部刮抹 / 压实麻面')
s=s.replace('材质与失养 · R2 收尾 06', '材质与失养 · R2 收尾 07')

# Entire persistent geometry, scene/history code and both vertex/depth shaders
# must stay byte-identical. The only visual implementation change is FRAG.
blocks=[('const PROFILE=', 'const FRAG='), ('// User-directed neglect scenario.', 'const $=')]
for start,end in blocks:
    assert original.split(start,1)[1].split(end,1)[0] == s.split(start,1)[1].split(end,1)[0], start
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'START_HERE.html').write_text(s,encoding='utf-8',newline='\n')
qa={'version':'R2-closeout-07-detail','parent':'R2-closeout-06-handmade',
    'sourceSHA256':hashlib.sha256((OUT/'START_HERE.html').read_bytes()).hexdigest(),
    'sourceBytes':(OUT/'START_HERE.html').stat().st_size,
    'geometryVertexDepthAndHistoryUnchanged':True,
    'referenceSHA256':'ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365',
    'detailAmplitudes':'design display-relief values, not measured reference heights',
    'browserVerified':False,'publicBrowserVerified':False,'visualApproved':False,'productionApproved':False}
(OUT/'QA.json').write_text(json.dumps(qa,indent=2)+'\n',encoding='utf-8')
(OUT/'check.js').write_text('\n'.join(re.findall(r'<script>(.*?)</script>',s,re.S)),encoding='utf-8')
print(json.dumps(qa,indent=2))
