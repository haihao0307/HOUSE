from pathlib import Path
import hashlib,re,json
root=Path(__file__).resolve().parents[1];base=root.parent/'v0910';src=base/'source/app.js';s=src.read_text();old=s;html=(base/'START_HERE.html').read_text()
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(src.read_bytes())=='d942354f4e6207081a8e81a9760c7ab136c994ad7ca9cf0b9484b165549a801d'
assert sha((base/'START_HERE.html').read_bytes())=='1d52c47f56c0b502b889650949b1e05ca98c34ea8b7ef960cac3d9cac33442e7'
def rep(a,b,count=1):
 global s
 assert a in s,a[:120];s=s.replace(a,b,count)
rep('const state={',"const state={fieldMode:1,waveSurface:true,evolution:1,mossEnabled:true,mossThickness:.8,fibreEnds:true,rainInput:1,loadFactor:1,initialAge:25,openCut:.7,specimen:'both',")
rep("scene:'trio',trioFamily", "scene:'fracture',trioFamily")
rep("year:25,care:'maintained'", "year:8,care:'abandoned'")
# Build procedural microtexture only when the legacy comparison requests it.
rep('const detail=makeDetail();','const detail={normalRoughAO:null,fields:null};function ensureLegacyDetail(){if(!detail.normalRoughAO)Object.assign(detail,makeDetail());}')
rep('function clayMaterial(kind,variant,age,wet=0){','function clayMaterial(kind,variant,age,wet=0){ensureLegacyDetail();')
# Preserve reference implementations; call new implementations only on explicit new state.
for a,b in [('function studyClayMaterial(', 'function studyClayMaterialV0910('),('function woodGeometry(','function woodGeometryV0910('),('function woodUVGate(','function woodUVGateV0910('),('function getWoodMaterials(','function getWoodMaterialsV0910('),('function integrateTimber(','function integrateTimberV0910('),('function lifecycle(','function lifecycleV0910('),('function studyUI(){','function studyUIV0910(){')]:rep(a,b)
# Keep geometry identity and numeric seating; attach explicit zero fracture attributes.
rep("return state.geometryRevision===0?makeTileGeometryV098(kind,options):makeTileGeometryV099(kind,{edgeStrength:state.edgeStrength??1,...options});", "const g=state.geometryRevision===0?makeTileGeometryV098(kind,options):makeTileGeometryV099(kind,{edgeStrength:state.edgeStrength??1,...options});g.setAttribute('waveCut',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count),1));return g;")
# Include all state dependencies in caches.
rep("return ['v0910',kind,state.geometryRevision,state.edgeStrength,state.year,state.seed,state.care,state.mode]", "return ['v0911',kind,state.geometryRevision,state.edgeStrength,state.year,state.seed,state.care,state.mode,state.waveSurface,state.evolution,state.rainInput,state.loadFactor,state.mossEnabled,state.mossThickness,state.fibreEnds]")
rep("const layoutKey=[state.geometryRevision,state.edgeStrength,kind,state.year,state.seed,state.care]", "const layoutKey=[state.geometryRevision,state.edgeStrength,kind,state.year,state.seed,state.care,state.evolution,state.rainInput,state.loadFactor,state.fibreEnds]")
rep("key=[state.scene,state.seed,kind,variant,ageBand,wet]", "key=['legacy',state.scene,state.seed,kind,variant,ageBand,wet]")
# Rebuild dispatch and nonintrusive additions.
rep("else if(state.scene==='roof')buildRoofLike('roof');else buildUV();", "else if(state.scene==='roof')buildRoofLike('roof');else if(state.scene==='fracture')buildFieldLab();else buildUV();if(state.scene==='trio')fieldAddTrioMoss();waveUpdateAll();")
rep("function applyTimberOnly(){renderer.shadowMap.needsUpdate=true;", "function applyTimberOnly(){renderer.shadowMap.needsUpdate=true;")
rep("if(o.userData.kind==='tile-batch')o.visible=!state.timberOnly;", "if(o.userData.kind==='tile-batch'||o.userData.kind==='field-moss')o.visible=!state.timberOnly;")
rep("buildRoofLikeV099(kind);perfRememberRoof(key);", "buildRoofLikeV099(kind);fieldAddRoofMoss(lastRoof);perfRememberRoof(key);")
rep("if(m.userData.uniforms)m.userData.uniforms.ceramic.value.z=state.light==='rain'?1:0;", "if(m.userData.uniforms)m.userData.uniforms.ceramic.value.z=state.light==='rain'?1:0;waveUpdateMaterial(m);")
# Preserve original exact-contact solver. Direct support gaps propagate into rafter geometry.
needle="const anchors=beamZ.map((z,k)=>({z,h:beams[k].proxy.height(x,z)})).filter(a=>Number.isFinite(a.h));"
rep(needle,needle+"\n    if(model.fieldModel&&state.care==='abandoned'){if(anchors.length<2)broken.push([0,1]);else{const lo=(anchors[0].z-mid)/length+.5,hi=(anchors.at(-1).z-mid)/length+.5;if(anchors[0].z>beamZ[0]+1e-5)broken.push([0,lo]);if(anchors.at(-1).z<beamZ[3]-1e-5)broken.push([hi,1]);}const merged=fieldMergeRanges(broken);broken.splice(0,broken.length,...merged);}")
# Rough-end winding has a separate positive-axis gate, old shape blocks unchanged.
# All helper definitions precede startup setLight and first rebuild.
pos=s.index('function queued(action)')
modules=['field_model.js','wave_material.js','field_geometry.js','field_ui.js'];addition='\n'.join((root/'source'/x).read_text() for x in modules)
wrappers="""
function studyClayMaterial(kind,variant,age,wet=0){return state.waveSurface&&state.mode!=='clay'?waveMaterial(kind,variant,age,wet):studyClayMaterialV0910(kind,variant,age,wet);}
function getWoodMaterials(check=false){return state.waveSurface?waveWood(check):getWoodMaterialsV0910(check);}
function integrateTimber(rows,cols){return state.evolution?fieldIntegrateTimber(rows,cols):integrateTimberV0910(rows,cols);}
function lifecycle(r,c,k,rows,cols,y){return state.evolution?fieldLife(r,c,k,rows,cols,y??state.year):lifecycleV0910(r,c,k,rows,cols,y);}
"""
s=s[:pos]+addition+'\n'+wrappers+'\n'+s[pos:]
# Same existing controls remain; new wrappers only add extra invalidation.
rep('function updateStudySurface(){','function updateStudySurface(){waveUpdateAll();')
# Public reproducible interface includes explicit modeling limitations.
s+='''
fieldInstallUI();
window.TilesMotherV0911={...window.TilesMotherV0910,version:'0.9.11',getFieldReport:()=>fieldLabReport,getWaveState:()=>({waveSurface:state.waveSurface,evolution:state.evolution,mossEnabled:state.mossEnabled,year:state.year}),getRoofModel:()=>lastRoof?{maxRafterLoss:Math.max(...lastRoof.model.loss),maxBeamLoss:Math.max(...lastRoof.model.beamLoss),moss:lastRoof.fieldMoss,counts:lastRoof.counts,contacts:lastRoof.contactReport}:null,setView:x=>{Object.assign(state,x);rebuild();fieldSyncUI();},physics:'uncalibrated exposure + elementary beam/strip demand; no FEM or rigid-body collision',visualApproved:false,productionApproved:false};
Object.assign(window.__tilesDebug,{waveShader,fieldTileHalf,fieldBeamDemand,fieldTileDemand,fieldIntegrateTimber,fieldMossGroup,woodGeometry,fieldModel:true});
document.body.dataset.version='0.9.11';perfRequest();
'''
# DOM additions; keep vendor and original document dependencies embedded.
html=html.replace('V0.9.10','V0.9.11')
html=html.replace('<title>Tiles Mother Tiles Mother V0.9.11 · 边口与材质学习工作台</title>','<title>Tiles Mother V0.9.11 · 噪波场与断口</title>')
html=html.replace('<div class="nav">','<div class="nav"><button data-scene="fracture" id="showLab"><b>噪波与断口样台</b><small>真实断面 · 顺纹木口 · 厚苔</small></button>',1)
html=html.replace('<div class="studyTag" id="studyLabel">','<button id="waveSwitch" class="waveSwitch active">D 噪波材质</button><div class="studyTag" id="studyLabel">')
control='''<div class="section" id="fieldControls"><div class="kicker">FIELD / CAUSE</div><h3>噪波场与断口</h3>
<div class="seg" id="fieldSpecimens"><button data-specimen="both">组合</button><button data-specimen="tile">瓦断口</button><button data-specimen="wood">木断口</button></div>
<label class="study-control-label">受水倍率 <b id="fieldRainVal">1.00</b></label><input id="fieldRain" type="range" min="10" max="180" step="10" value="100">
<label class="study-control-label">样台荷载倍率 <b id="fieldLoadVal">1.00</b></label><input id="fieldLoad" type="range" min="30" max="200" step="10" value="100">
<button id="mossSwitch" class="active">独立厚苔层</button><label class="study-control-label">苔层厚度倍率 <b id="mossThicknessVal">0.80</b></label><input id="mossThickness" type="range" min="0" max="150" step="10" value="80">
<label class="study-control-label">断口检查展开 <b id="openCutVal">0.70</b></label><input id="openCut" type="range" min="0" max="100" step="10" value="70">
<p class="smallnote" id="fieldGateText">示意模型，非结构安全校核</p></div>'''
html=html.replace('<aside class="panel right">','<aside class="panel right">'+control,1)
timeline='''<div class="fieldTimeline"><button id="fieldPlay">播放</button><span>失养 <b id="fieldYear">8.0</b> 年</span><input id="fieldClock" type="range" min="0" max="15" step=".5" value="8"><small>0</small><small>15 年</small></div>'''
html=html.replace('<div class="viewerBottom">',timeline+'<div class="viewerBottom">',1)
css='''<style>
.field-details{border-bottom:1px solid var(--line);margin-bottom:14px;padding-bottom:12px}.field-details summary{cursor:pointer;font-size:12px;font-weight:600;padding:8px 0}.field-details .section{padding:8px 0 0;margin:0;border:0}
.fieldTimeline{position:absolute;left:18px;right:18px;bottom:14px;display:flex;align-items:center;gap:10px;border:1px solid #ffffff88;border-radius:12px;background:#f4f5eeeb;padding:9px 11px;backdrop-filter:blur(8px);font-size:11px}.fieldTimeline input{flex:1;width:30px}.fieldTimeline span{white-space:nowrap;min-width:90px}.fieldTimeline small{white-space:nowrap;color:#66736b}.viewerBottom{display:none}.studyAngles{bottom:78px}.studyTag{display:none}.waveSwitch{pointer-events:auto;background:#345b59;color:#fff;min-height:40px}.studyCompare{justify-content:center;top:92px}.top .pill:last-child{display:none}.viewerHead p{max-width:330px}.fieldTimeline button{min-width:50px}.app{grid-template-columns:226px minmax(380px,1fr) 294px}
@media(max-width:1120px){.app{grid-template-columns:210px 1fr}.right{display:none}}
@media(max-width:640px){.app{display:flex}.right{display:block}.fieldTimeline{left:8px;right:8px;gap:5px;padding:7px;font-size:10px}.fieldTimeline span{min-width:77px}.fieldTimeline small:first-of-type{display:none}.fieldTimeline button{padding:6px;min-width:41px}.viewer{min-height:525px;height:66vh}.studyCompare{top:117px;left:9px;right:9px;gap:4px}.studyCompare .seg{flex:1;width:auto;padding:3px}.studyCompare button{font-size:9px}.waveSwitch{font-size:9px!important;padding:6px!important;width:67px;line-height:1.4}.studyAngles{bottom:71px}.viewerHead h2{font-size:15px}.top .brand p{display:none}.right .stats{font-size:11px}}
</style>'''
html=html.replace('</head>',css+'</head>')
m=list(re.finditer(r'(<script type="module">)(.*?)(</script>)',html,re.S));assert len(m)==1
html=html[:m[0].start(2)]+'\n'+s+'\n'+html[m[0].end(2):]
(root/'source/app.js').write_text(s);(root/'START_HERE.html').write_text(html)
blocks={}
for name,a,b in [('tileShape','function studyBoundary','function uvGate('),('oldClayCore','const clayShader=','const materialCache='),('detail','function makeDetail','const detail='),('lighting','function setLight','function syncUI')]:
 oldblock=old[old.index(a):old.index(b,old.index(a))];newblock=s[s.index(a):s.index(b,s.index(a))]
 # tile wrapper has only a zero attribute addition; coordinate arrays remain identical.
 blocks[name]={'old':sha(oldblock.encode()),'new':sha(newblock.encode()),'byteIdentical':oldblock==newblock}
manifest={'version':'0.9.11','parentSourceCommit':'7ca99f831cd6ae1bb5d4a20274cd9a272bd2bd3c','baseVersion':'0.9.10','htmlSHA256':sha(html.encode()),'appSHA256':sha(s.encode()),'bytes':len(html.encode()),'inheritedBlocks':blocks,'visualApproved':False,'productionApproved':False,'publicSiteDeployed':False}
(root/'BUILD.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest,indent=2))
