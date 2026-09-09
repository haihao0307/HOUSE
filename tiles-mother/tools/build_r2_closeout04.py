from pathlib import Path
import re, gzip, base64, hashlib, json

ROOT = Path(__file__).resolve().parents[2]
SRC_WRAP = ROOT / 'tiles-mother/r2-closeout-03/START_HERE.html'
OUTDIR = ROOT / 'tiles-mother/r2-closeout-04'
OUTDIR.mkdir(parents=True, exist_ok=True)

w = SRC_WRAP.read_text('utf-8')
m = re.search(r'const b=([`\"])(.*?)\1', w, re.S)
if not m:
    raise SystemExit('R2 closeout 03 payload not found')
raw03 = gzip.decompress(base64.b64decode(re.sub(r'\s', '', m.group(2))))
sha03 = hashlib.sha256(raw03).hexdigest()
EXPECTED_03 = '5ad053603b397eebf4f30c63f296cfcc4b9fb825dd22f1c28c8705fa0d17a745'
if sha03 != EXPECTED_03:
    raise SystemExit(f'unexpected R2 closeout 03 source sha {sha03}')
s = raw03.decode('utf-8')
orig = s

def extract_balanced(src, token, open_char='{', close_char='}'):
    p = src.find(token)
    if p < 0:
        raise SystemExit(f'missing protected token {token}')
    b = src.find(open_char, p)
    if b < 0:
        raise SystemExit(f'missing protected opener {token}')
    depth = 0
    quote = None
    esc = False
    for i in range(b, len(src)):
        c = src[i]
        if quote:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == quote:
                quote = None
            continue
        if c in ('\"', "'", '`'):
            quote = c
            continue
        if c == open_char:
            depth += 1
        elif c == close_char:
            depth -= 1
            if depth == 0:
                return src[p:i+1]
    raise SystemExit(f'unclosed protected block {token}')

protected_tokens = ['function tilePoint', 'function ceramicGeometry', 'function lossFraction', 'function roofState']
protected = {t: hashlib.sha256(extract_balanced(orig, t).encode()).hexdigest() for t in protected_tokens}

s = s.replace('<title>Tiles Mother · R2 收尾候选 03</title>', '<title>Tiles Mother · R2 收尾候选 04</title>', 1)
s = s.replace('R2 收尾候选 03 · 连续材料取向 / 结构派生色区 / 独立粗糙度',
              'R2 收尾候选 04 · 去规则材质 / 菌落式微表面 / 可退出参数面板', 1)
s = s.replace('材质与失养 · R2 收尾 03', '材质与失养 · R2 收尾 04', 1)
s = s.replace('本版只调整材料取向与结构→色区→粗糙度链。',
              '本版继续锁定候选02/03的瓦形与色调，只去除规则纹理，增加片级—矿物区—局部菌落的非均匀组织，并修复手机参数面板退出。', 1)

needle = '''float ceramicTurn(vec3 p,float seed){\n vec3 z=p+vec3(seed*.0017,seed*.0023,seed*.0011);\n float mineral=n3(z*5.4+vec3(2.7,8.1,4.3));\n float local=n3(z*17.6+vec3(9.2,1.4,6.8));\n float tilePhase=sin(seed*.031+1.7)*.5+.5;\n return (tilePhase-.5)*.10+(mineral-.5)*.30+(local-.5)*.085;\n}\n'''
if needle not in s:
    raise SystemExit('ceramicTurn block missing')
replacement = needle + r'''// Domain warp is deliberately low-amplitude and tied to stable material coordinates.
// It breaks periodic alignment without changing tile geometry or support relationships.
vec3 ceramicWarp(vec3 p,float seed){
 vec3 z=p+vec3(seed*.0019,seed*.0013,seed*.0027);
 vec3 w=vec3(
  n3(z*3.7+vec3(1.3,7.1,4.2)),
  n3(z*4.3+vec3(8.4,2.6,5.7)),
  n3(z*3.2+vec3(3.9,9.3,1.8))
 )-.5;
 vec3 w2=vec3(
  n3((z+w*.035)*13.7+vec3(6.2,1.1,9.4)),
  n3((z+w*.035)*11.9+vec3(2.4,8.8,3.5)),
  n3((z+w*.035)*15.1+vec3(7.6,4.3,2.2))
 )-.5;
 return p+w*.018+w2*.0045;
}
// Broad colony -> broken rim -> sparse pore logic. It is not uniform pepper noise.
float ceramicColony(vec3 p,float seed){
 vec3 z=p+vec3(seed*.0021,seed*.0011,seed*.0017);
 float broad=n3(z*6.2+vec3(2.6,7.4,1.9));
 vec3 bend=vec3(broad-.5,n3(z*5.1+vec3(8.1,2.2,4.7))-.5,n3(z*4.6+vec3(1.4,9.2,6.3))-.5);
 float middle=n3(z*21.3+bend*.085+vec3(4.3,1.8,8.7));
 float islands=smoothstep(.43,.70,broad*.58+middle*.42);
 float broken=smoothstep(.39,.72,middle*.62+n3(z*47.0+bend*.12)*.38);
 return clamp(islands*(.58+.42*broken),0.,1.);
}
float tileIdentity(float seed){return fract(sin(seed*12.9898+78.233)*43758.5453);}
'''
s = s.replace(needle, replacement, 1)

old = ''' else if(uType==0){float turn=uBio.z*ceramicTurn(p,seed);q.xz=rot2(turn)*p.xz+vec2(seed*.017,seed*.019);}\n float macro=.5,middle=.5;'''
new = ''' else if(uType==0){float turn=uBio.z*ceramicTurn(p,seed);q.xz=rot2(turn)*p.xz+vec2(seed*.017,seed*.019);q=ceramicWarp(q,seed);}\n float macro=.5,middle=.5;'''
if old not in s:
    raise SystemExit('ceramic q orientation line missing')
s = s.replace(old, new, 1)

old = '''   float scrape=smoothstep(.65,.83,n3(vec3(q.x*880.,q.y*390.,q.z*64.)))*smoothstep(.48,.68,middle)*band(fp,800.);\n   float pit=smoothstep(.73,.92,grain)*band(fp,390.);\n   float r2detail=r2mm(q,seed,fp)*uBio.w;\n   float crack=ceramicCrack(p.xz,fract(seed*.73),damage,fp);'''
new = '''   float tileId=tileIdentity(seed);\n   float colony=ceramicColony(q,seed);\n   float scrape=smoothstep(.66,.86,n3(vec3(q.x*731.,q.y*337.,q.z*71.)+vec3(tileId*5.3,1.7,6.2)))*smoothstep(.48,.70,middle)*band(fp,760.);\n   float pitThreshold=mix(.79,.88,tileId);\n   float sparsePit=smoothstep(pitThreshold-.045,pitThreshold+.055,grain)*band(fp,390.);\n   float pit=sparsePit*mix(.16,1.0,smoothstep(.20,.72,colony));\n   float r2Gate=mix(.24,.82,smoothstep(.18,.78,colony));\n   float r2detail=r2mm(q,seed+tileId*37.0,fp)*uBio.w*r2Gate;\n   float crack=ceramicCrack(p.xz,fract(seed*.73),damage,fp);'''
if old not in s:
    raise SystemExit('uniform pit/R2 span missing')
s = s.replace(old, new, 1)

old = '''   float mineralWarm=smoothstep(.73,.90,fired*.78+macro*.18)*uSurface.y;\n   float recessWash=weather*smoothstep(.30,.86,.54*recessed+.22*curvatureProxy+.16*middle+.08*macro);\n   float edgePale=weather*smoothstep(.30,.82,.58*shellEdge+.24*raised+.18*scrape);'''
new = '''   float mineralWarm=smoothstep(.73,.90,fired*.76+macro*.16+colony*.08)*uSurface.y;\n   float recessWash=weather*smoothstep(.31,.87,.50*recessed+.20*curvatureProxy+.14*middle+.08*macro+.08*colony);\n   float edgePale=weather*smoothstep(.31,.83,.58*shellEdge+.23*raised+.14*scrape+.05*(1.-colony));'''
if old not in s:
    raise SystemExit('colour derivation span missing')
s = s.replace(old, new, 1)

old = '''   float cool=smoothstep(.57,.79,n3(q*5.1+vec3(4.7,8.2,1.3)));\n   body=mix(body,vec3(.036,.050,.060),cool*.21);'''
new = '''   float coolBroad=n3(q*4.7+vec3(4.7,8.2,1.3)+vec3(tileId*2.3,0.,tileId*1.7));\n   float coolMid=n3(q*16.9+vec3(1.9,5.6,9.1)+vec3(colony*.11));\n   float cool=smoothstep(.58,.80,coolBroad*.68+coolMid*.22+colony*.10);\n   body=mix(body,vec3(.036,.050,.060),cool*.19);'''
if old not in s:
    raise SystemExit('cool zone span missing')
s = s.replace(old, new, 1)

old = '''   rough=clamp(.835+.115*(roughField-.5)+.075*recessed+.060*pit+.095*crack+.045*shellEdge-.055*scrape-r2detail*.020,.69,.985);'''
new = '''   float localWear=n3(q*32.7+vec3(7.1,2.8,5.2)+vec3(tileId*3.7));\n   rough=clamp(.835+.105*(roughField-.5)+.070*recessed+.070*pit+.095*crack+.042*shellEdge-.050*scrape-r2detail*.016+.028*(localWear-.5)*mix(.35,1.,colony),.69,.985);'''
if old not in s:
    raise SystemExit('roughness span missing')
s = s.replace(old, new, 1)

old = '''    float colony=.56*env+.20*macro+.12*middle+.12*n3(q*3.7+vec3(2.1,7.3,4.4));\n    float edge=.90-.34*uBio.x;\n    float cover=smoothstep(edge-.06,edge+.06,colony);'''
new = '''    float bioColony=.50*env+.17*macro+.10*middle+.11*n3(q*3.7+vec3(2.1,7.3,4.4))+.12*ceramicColony(q,seed);\n    float edge=.90-.34*uBio.x;\n    float cover=smoothstep(edge-.06,edge+.06,bioColony);'''
if old not in s:
    raise SystemExit('moss colony span missing')
s = s.replace(old, new, 1)

old = "const BUILD_INFO=Object.freeze({version:'R2-closeout-03',parent:'R2-closeout-02',materialOrder:'height-edge-damage -> structure-derived color -> independent roughness',orientation:'stable tile/mineral/local material field'});"
new = "const BUILD_INFO=Object.freeze({version:'R2-closeout-04',parent:'R2-closeout-03',materialOrder:'height-edge-damage -> structure-derived color -> independent roughness',orientation:'stable tile/mineral/local material field + bounded domain warp',surface:'tile identity -> mineral regions -> colony clusters -> sparse pores'});"
if old not in s:
    raise SystemExit('BUILD_INFO 03 missing')
s = s.replace(old, new, 1)

ui_css = r'''
<style id="r2-closeout04-ui-fix">
.r2-param-panel-04{max-height:min(72svh,680px)!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding-top:max(18px,env(safe-area-inset-top))!important}
.r2-param-close-04{position:sticky;float:right;top:0;z-index:30;min-width:44px;min-height:44px;border:1px solid rgba(41,57,52,.18);border-radius:14px;background:rgba(246,247,242,.94);color:#263934;font:600 15px system-ui;padding:0 14px;box-shadow:0 4px 16px rgba(0,0,0,.08)}
@media(max-width:600px){.r2-param-panel-04{width:calc(100vw - 28px)!important;max-width:none!important;margin:0 14px!important}}
</style>
'''
if '</head>' in s:
    s = s.replace('</head>', ui_css + '</head>', 1)
else:
    s = s.replace('</style>', '</style>' + ui_css, 1)

ui_js = r'''
<script id="r2-closeout04-ui-runtime">
(()=>{
 const buttons=()=>Array.from(document.querySelectorAll('button'));
 const trigger=()=>buttons().find(b=>(b.textContent||'').replace(/\s/g,'').includes('色彩/参数'));
 function panel(){
  const cs=Array.from(document.querySelectorAll('section,aside,div')).filter(el=>
   /材质与失养/.test(el.textContent||'') && el.querySelectorAll('input[type="range"]').length>=4);
  cs.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length);
  return cs[0]||null;
 }
 function augment(){
  const p=panel(),t=trigger(); if(!p||!t)return;
  p.classList.add('r2-param-panel-04');
  if(!p.querySelector('.r2-param-close-04')){
   const x=document.createElement('button');x.type='button';x.className='r2-param-close-04';x.textContent='关闭';x.setAttribute('aria-label','关闭色彩与参数');
   x.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();t.click();});
   p.insertBefore(x,p.firstChild);
  }
 }
 document.addEventListener('click',e=>{const t=trigger();if(t&&(e.target===t||t.contains(e.target)))setTimeout(augment,0);},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const p=panel(),t=trigger();if(p&&t&&p.getClientRects().length)t.click();}});
 const mo=new MutationObserver(()=>augment());mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden']});
 setTimeout(augment,250);
})();
</script>
'''
if '</body>' not in s:
    raise SystemExit('body close missing for UI runtime')
s = s.replace('</body>', ui_js + '</body>', 1)

required = ['ceramicWarp(', 'ceramicColony(', 'tileIdentity(', 'r2-param-close-04', "version:'R2-closeout-04'", 'float pitThreshold=mix(.79,.88,tileId)']
for marker in required:
    if marker not in s:
        raise SystemExit('missing R2 closeout 04 marker '+marker)
if 'mat2(.932,-.362,.362,.932)' in s:
    raise SystemExit('legacy fixed ceramic rotation unexpectedly present')

for t, h in protected.items():
    now = hashlib.sha256(extract_balanced(s, t).encode()).hexdigest()
    if now != h:
        raise SystemExit(f'protected geometry/life block changed: {t}')

raw04 = s.encode('utf-8')
source_sha = hashlib.sha256(raw04).hexdigest()
comp = gzip.compress(raw04, compresslevel=9, mtime=0)
b64 = base64.b64encode(comp).decode('ascii')
wrapper = f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tiles Mother · R2 收尾候选 04</title><body style="margin:0;background:#e0e2dd;font:14px system-ui;color:#283532"><div id="boot" style="padding:24px">加载 Tiles Mother R2 收尾候选 04…</div><script>(async()=>{{try{{const b=`{b64}`.replace(/\\s/g,''),u=Uint8Array.from(atob(b),c=>c.charCodeAt(0)),h=await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).text();document.open();document.write(h);document.close()}}catch(e){{document.getElementById("boot").textContent="启动失败："+e.message}}}})();</script>'''
wrapper_sha = hashlib.sha256(wrapper.encode()).hexdigest()
(OUTDIR/'START_HERE.html').write_text(wrapper,'utf-8')
qa = {
 'version':'R2-closeout-04','parent':'R2-closeout-03','parentSourceSHA256':sha03,
 'scope':['mobile parameter panel explicit close/re-entry','remove regular microtexture alignment with bounded domain warp','per-tile/mineral/local colony hierarchy','cluster-gated sparse pores and R2 detail'],
 'preserved':{**{t:True for t in protected_tokens},'candidate02PathUnchanged':True,'candidate03PathUnchanged':True},
 'checks':{'sourceParentIdentity':'pass','legacyFixedCeramicRotationAbsent':True,'boundedDomainWarpPresent':True,'colonyHierarchyPresent':True,'uniformPepperPitReplaced':True,'mobilePanelCloseInjected':True,'independentRoughnessRetained':True,'structureDerivedColorRetained':True},
 'sourceBytes':len(raw04),'sourceSHA256':source_sha,'wrapperSHA256':wrapper_sha,
 'visualApproved':False,'productionApproved':False
}
(OUTDIR/'QA.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps(qa,ensure_ascii=False,indent=2))
