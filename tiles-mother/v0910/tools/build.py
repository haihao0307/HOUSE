from pathlib import Path
import re,json,hashlib
root=Path(__file__).resolve().parents[1];base=root.parent/'v099'
s=(base/'source/app.js').read_text();old=s
html=(base/'START_HERE.html').read_text()
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(s.encode())=='ed965aebdfb44754f81e478ad45508fa8392ca2331a735f4d1d101c61b551d3d'
assert sha(html.encode())=='06ad8f86f16afe8a58dbc83b14d206c712c4f48902cf5f8ac29e2ea0fcd209db'
s=s[:s.index('function exactGap(')]+(root/'source/contact_fast.js').read_text()+'\n'+s[s.index('function minSupportGap('):]
s=s.replace('function clearStage(){','function clearStageV099(){',1).replace('function buildRoofLike(kind){','function buildRoofLikeV099(kind){',1).replace('function runGlobalQA(){','function runGlobalQAV099(){',1)
# Cache identity separates scenes and seeds; single-tile tint never leaks into roofs.
s=s.replace("key=[kind,variant,ageBand,wet].join('/')","key=[state.scene,state.seed,kind,variant,ageBand,wet].join('/')")
# Right-size already populated buffers. Every used matrix and colour is preserved.
needle='for(const b of buckets.values()){b.m.count=b.n;'
assert needle in s
s=s.replace(needle,"for(const b of buckets.values()){b.m.instanceMatrix=new THREE.InstancedBufferAttribute(b.m.instanceMatrix.array.slice(0,b.n*16),16);if(b.m.instanceColor)b.m.instanceColor=new THREE.InstancedBufferAttribute(b.m.instanceColor.array.slice(0,b.n*3),3);b.m.count=b.n;")
# Cache and audit helpers are initialized before the first build.
pos=s.index('function queued(action)')
s=s[:pos]+(root/'source/performance.js').read_text()+'\n'+s[pos:]
# Every explicit invalidation schedules at most one frame.
s=s.replace('needsRender=true;','perfRequest();')
# Insert scheduler after the initial camera state declaration, before resize runs.
needle='let yaw=-.62,pitch=.54,distance=2.35,target=new THREE.Vector3(0,0,0),drag=null,panMode=false,needsRender=true;'
# The previous replacement touches the declaration, so restore it explicitly.
corrupted=needle.replace('needsRender=true;','perfRequest();')
assert corrupted in s
s=s.replace(corrupted,needle+'\n'+(root/'source/scheduler.js').read_text(),1)
start=s.index('let last=performance.now();function loop(');end=s.index('\nwindow.TilesMotherV098',start)
s=s[:start]+'perfRequest();'+s[end:]
# Visibility changes must invalidate cached shadows as well as colour rendering.
s=s.replace('function applyTimberOnly(){','function applyTimberOnly(){renderer.shadowMap.needsUpdate=true;',1)
# Original setLight and shader/detail blocks remain byte-identical.
s=s.replace("$('#revisionInfo').textContent='V0.9.9 · 候选审阅 · 基线 V0.9.8 保留';","$('#revisionInfo').textContent='V0.9.10 · 性能优化 · V0.9.9 画面保留';")
s += "\nwindow.TilesMotherV0910={...window.TilesMotherV099,version:'0.9.10',getPerformance:perfSnapshot,releaseAudit:()=>{if(lastRoof)perfCompactRecord(lastRoof);},clearSceneCache:()=>{const roots=[...perfSceneBank.values()].map(e=>e.record.roof);perfSceneBank.clear();for(const r of roots)if(!stageRoot.children.includes(r))perfDisposeRoot(r);}};document.body.dataset.version='0.9.10';perfUpdatePanel();perfRequest();\n"
s=s.replace('已计算的年份会缓存，灯光与回看继续沿用同一份几何。','最近两个屋面状态完整缓存；重复查看和切换灯光直接复用。形体、年份或维护状态改变后重新核算。')
html=html.replace('V0.9.9','V0.9.10')
html=html.replace('<aside class="panel left">','<aside class="panel left"><div class="section"><div class="kicker">PERFORMANCE / SAME GEOMETRY</div><h3>性能优化</h3><p id="perfStatus" class="smallnote">按需绘制；最近两个屋面完整缓存；形体与细分保持</p></div>')
m=list(re.finditer(r'(<script type="module">)(.*?)(</script>)',html,re.S));assert len(m)==1
html=html[:m[0].start(2)]+'\n'+s+'\n'+html[m[0].end(2):]
(root/'source/app.js').write_text(s);(root/'START_HERE.html').write_text(html)
locks={}
for name,a,b in [('detail','function makeDetail','const detail='),('shader','const clayShader=','const materialCache='),('lighting','function setLight','function syncUI'),('tileShape','function studyBoundary','function uvGate('),('timber','function woodGeometry','function makeDetail')]:
 x=old[old.index(a):old.index(b,old.index(a))];y=s[s.index(a):s.index(b,s.index(a))];assert x==y,name;locks[name]=sha(x.encode())
manifest={'version':'0.9.10','baseCommit':'3679d88d86493a1c3c756b0d20f2a6e048dd26ad','baseHTMLSHA256':sha((base/'START_HERE.html').read_bytes()),'htmlSHA256':sha(html.encode()),'appSHA256':sha(s.encode()),'bytes':len(html.encode()),'unchangedBlocks':locks,'visualApproved':False,'productionApproved':False,'publicSiteDeployed':False}
(root/'BUILD.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest,indent=2))
