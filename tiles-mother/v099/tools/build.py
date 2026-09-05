"""Reproducible derivative of the preserved V098. No raw scan or texture dependency."""
from pathlib import Path
import re,sys,json,hashlib
here=Path(__file__).resolve().parents[1]
base=Path(sys.argv[1]) if len(sys.argv)>1 else here.parent/'v098'
assert (base/'source/app.js').is_file(),base
s=(base/'source/app.js').read_text(); old=s
html=(base/'START_HERE.html').read_text()
assert hashlib.sha256((base/'START_HERE.html').read_bytes()).hexdigest()=='c8b8211f8d14512b2f29c067894be563e2710053b648b39427a87986bcf34c9b','Unexpected V098 HTML'
geom=(here/'source/edge_geometry.js').read_text();mat=(here/'source/material_study.js').read_text();ui=(here/'source/study_ui.js').read_text()
s=s.replace("const state={showContacts:","const state={geometryRevision:1,surfaceRevision:1,edgeStrength:1,colorLayer:1,striations:.7,focusSingle:false,showContacts:")
s=s.replace("function makeTileGeometry(kind='pan',options={}){","function makeTileGeometryV098(kind='pan',options={}){",1)
s=s.replace('function uvGate(geometry){','function uvGateV098(geometry){',1)
s=s.replace('/* Rigid shell contact solver.',geom+'\n/* Rigid shell contact solver.',1)
s=s.replace('function legacyTileTint(',mat+'\nfunction legacyTileTint(',1)
s=s.replace(':clayMaterial(kind,variant,age,state.light',':studyClayMaterial(kind,variant,age,state.light')
s=s.replace(':clayMaterial(family,variant,ageTier,state.light',':studyClayMaterial(family,variant,ageTier,state.light')
s=s.replace("if(mode!=='uv')m.material.color", "if(mode!=='uv'&&mode!=='clay')m.material.color")
s=s.replace("if(state.mode!=='uv')b.m.setColorAt", "if(state.mode!=='uv'&&state.mode!=='clay')b.m.setColorAt")
s=s.replace("const layoutKey=[kind,state.year,state.seed,state.care]", "const layoutKey=[state.geometryRevision,state.edgeStrength,kind,state.year,state.seed,state.care]")
# Candidate uses more longitudinal samples at the roof. Fixed geometry within a mode.
s=s.replace("lod=is48?{nu:16,nv:22}:{nu:10,nv:14}","lod=state.geometryRevision===0?(is48?{nu:16,nv:22}:{nu:10,nv:14}):(is48?{nu:16,nv:22}:{nu:10,nv:14})")
# Add a close-up without removing any of the inherited scenes.
a=s.index('function buildTrio(){'); b=s.index('\nfunction lifecycle',a)
trio='''function buildTrio(){
 clearStage();const fam=state.trioFamily,kinds=state.focusSingle?[fam==='mix'?'pan':fam]:(fam==='mix'?['pan','cover','pan']:[fam,fam,fam]);
 const xs=state.focusSingle?[0]:[-.42,0,.42];
 kinds.forEach((kind,i)=>{const v=state.focusSingle?1:i,age=[8,38,74][v],m=tileMesh(kind,v,age,{damageClass:v===2?1:0});m.position.set(xs[i],kind==='pan'?.03:.01,0);m.rotation.set(-.11,state.focusSingle?0:(i-1)*.05,state.focusSingle?0:(i-1)*.028);m.scale.setScalar(1.58);stageRoot.add(m);if(!state.focusSingle)caption(`${kind==='pan'?'板瓦':'筒瓦'} 0${v+1}`,new THREE.Vector3(xs[i],-.31,.08),.40);});
 $('#sceneStats').innerHTML=`<b>${state.focusSingle?'单片边口近景':'三片独立瓦母体'}</b><span>板瓦 23.8 cm；宽 24.2 / 22.1 cm；厚约 1.2 cm</span><span>筒瓦 22.2 cm；两处宽 11.5 / 9.0 cm；厚约 1.0 cm。端位语义与部分手写读数待核。</span><span>${state.geometryRevision?'独立边线种子；6带圆钝剖面；缓变厚度；连续法线':'V0.9.8 原始生成器'}</span><span>孔隙与观察光继承；表面增强可独立关闭。</span>`;
 fitCamera('trio',state.cameraSide);if(state.focusSingle){target.set(0,.025,0);yaw=-.63;pitch=state.cameraSide==='under'?-.5:.48;distance=(fam==='cover'?.80:1.05)*Math.max(1,.9/camera.aspect);updateCamera();}
}
'''
s=s[:a]+trio+s[b:]
s=s.replace("state.scene=b.dataset.scene;state.cameraSide='iso';", "state.scene=b.dataset.scene;state.focusSingle=false;state.cameraSide='iso';")
s=s.replace("syncUI();runGlobalQA();}","syncUI();runGlobalQA();studyUI();}")
# Give geometry changes a specific cache identity, avoiding old placement reuse.
s += '\n'+ui
s=s.replace("function rebuild(){lastRoof=null;","function rebuild(){renderer.shadowMap.needsUpdate=true;lastRoof=null;")
s += '\nrenderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;needsRender=true;\n'
s=s.replace('首次打开860片屋面需要几秒至十余秒。','首次打开860片需要计算实际接触，等待时间取决于设备。')
html=html.replace('V0.9.8 · 接触解算与四梁承托','Tiles Mother V0.9.9 · 边口与材质学习工作台')
html=html.replace('V0.9.8 · 继承陶瓦材质 · 接触解算 · 四梁承托','V0.9.9 · 边口造型 · 参考分层材质 · 原版可对照')
html=html.replace('</head>','<style>\n'+(here/'source/study.css').read_text()+'\n</style></head>')
controls='''<div class="section study-controls"><div class="kicker" id="revisionInfo">V0.9.9 / STUDY STUDIO</div><h2>学习成果控制</h2>
<button id="closeup" style="width:100%">单片边口特写</button><button id="neutralClay" style="width:100%;margin-top:6px">灰模检查 / 恢复材质</button>
<div class="study-control-label"><span>手工边线与厚薄变化</span><b id="edgeValue">100%</b></div><input type="range" id="edgeRange" min="0" max="150" value="100" step="5"><button id="applyEdge" style="width:100%">应用形体变化</button>
<div class="study-control-label"><span>参考色层</span><b id="colorValue">100%</b></div><input type="range" id="colorRange" min="0" max="150" value="100" step="5">
<div class="study-control-label"><span>细条痕</span><b id="reliefValue">70%</b></div><input type="range" id="reliefRange" min="0" max="150" value="70" step="5"><p class="smallnote" id="surfaceNote">原微孔与观察光保持</p>
<label class="reference-load">放入自己的参考图<input id="referenceFile" type="file" accept="image/*"></label><p class="smallnote">图片只在本机查看，不上传、不用作瓦片贴图。</p><button id="saveStudy" style="width:100%">保存当前审阅参数</button></div>'''
html=html.replace('<aside class="panel left">','<aside class="panel left">'+controls)
html=html.replace('<option value="uv">UV 方向纹理</option>','<option value="uv">UV 方向纹理</option><option value="clay">灰模形体检查</option>')
compare='''<div class="studyCompare"><div class="seg"><button data-study="original">A 原形原材质</button><button data-study="shape">B 新形原材质</button><button data-study="surface" class="active">C 新形新材质</button></div><div class="studyTag" id="studyLabel">C · 新边口 / 分层材质</div></div>
<div class="studyAngles"><button data-study-angle="iso">斜视</button><button data-study-angle="edge">边口</button><button data-study-angle="end">端面</button><button data-study-angle="top">俯视</button><button data-study-angle="under">底面</button></div>
<div class="referencePanel" id="referencePanel" hidden><div class="row"><span id="referenceName"></span><button id="closeReference">关闭</button></div><img id="referenceImage" alt="本地参考图"></div>'''
html=html.replace('<section class="viewer"><canvas', '<section class="viewer">'+compare+'<canvas')
notes='''<div class="section"><div class="kicker">LEARNING IN GEOMETRY</div><h3>这一版看哪里</h3><div class="change-note"><strong>01 · 看边口</strong>左右边线独立；檐口与搭接端分别变化；厚度方向有圆钝过渡。<strong>02 · 看明暗</strong>边口法线连续，UV保持分面；灰模可以单独检查形体。<strong>03 · 看色层</strong>冷灰、暖赭、浅灰覆盖与细条痕分开控制，避免均匀铺噪声。</div><p class="smallnote">A/B/C 保持同机位和观察光。线描约束比例，扫描资料指导外观，新增幅度仍为可调候选。</p></div>'''
html=html.replace('<aside class="panel right">','<aside class="panel right">'+notes)
# Runtime library bytes are taken unchanged from the original HTML.
pattern=r'(<script type="module">)(.*?)(</script>)'
m=list(re.finditer(pattern,html,re.S));assert len(m)==1
html=html[:m[0].start(2)]+'\n'+s+'\n'+html[m[0].end(2):]
(here/'source/app.js').write_text(s)
(here/'START_HERE.html').write_text(html)
# Persist only checksums, not copies of the large reference assets.
def block(src,start,end):return src[src.index(start):src.index(end,src.index(start))]
checks={}
for name,a,b in [('detail','function makeDetail','const detail='),('shader','const clayShader=','const materialCache='),('lighting','function setLight','function syncUI')]:
 before=block(old,a,b);after=block(s,a,b);checks[name]={'unchanged':before==after,'sha256':hashlib.sha256(after.encode()).hexdigest()};assert before==after,name
manifest={'version':'0.9.9','baselineVersion':'0.9.8','startHead':'ab18ac365be1444587f42f483af5d2a08cf8a815','workbenchSHA256':hashlib.sha256(html.encode()).hexdigest(),'appSHA256':hashlib.sha256(s.encode()).hexdigest(),'bytes':len(html.encode()),'inheritedLock':checks,'visualApproved':False,'productionApproved':False,'publicSiteDeployed':False}
(here/'BUILD.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps(manifest,indent=2))
