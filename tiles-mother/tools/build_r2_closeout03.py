from pathlib import Path
import re, gzip, base64, hashlib, json
ROOT=Path(__file__).resolve().parents[2]
w=(ROOT/'tiles-mother/r2-closeout-02/START_HERE.html').read_text('utf-8')
m=re.search(r'const b=([`\"])(.*?)\1',w,re.S)
if not m: raise SystemExit('R2 closeout 02 payload not found')
s=gzip.decompress(base64.b64decode(re.sub(r'\s','',m.group(2)))).decode('utf-8')
orig=s

def rep(old,new,count=1):
    global s
    n=s.count(old)
    if n < count:
        raise SystemExit(f'missing replacement ({n}<{count}): {old[:120]!r}')
    s=s.replace(old,new,count)

rep('<title>Tiles Mother · R2 收尾候选 02</title>','<title>Tiles Mother · R2 收尾候选 03</title>')
rep('R2 收尾候选 02 · 结构闭环 / 窑色保真 / 环境苔生 / R2 对照','R2 收尾候选 03 · 连续材料取向 / 结构派生色区 / 独立粗糙度')
rep('材质与失养 · R2 收尾 02','材质与失养 · R2 收尾 03')
rep('默认瓦色锁定为回退基线范围。R2只补跨尺度微结构，不重新定义主色。','默认瓦色继续锁定于候选02基线。R2只补跨尺度微结构；本版只调整材料取向与结构→色区→粗糙度链。')
rep('<label for="twist">木纹局部转向</label>','<label for="twist">局部材料转向</label>')
rep('<p class="tiny">A=0/A&gt;0 只切换跨尺度微结构强度；相机、光线、种子、主体瓦形与支承保持不变。</p>',
    '<p class="tiny">A=0/A&gt;0 只切换跨尺度微结构强度；相机、光线、种子、主体瓦形与支承保持不变。</p><p class="tiny">材质链：先生成高度 / 边缘 / 破损，再由结构派生色区；粗糙度使用独立场并只接受结构修正。连续转向只来自稳定材料坐标，不来自相机。</p>')

old='''float band(float footprint,float scale){return 1.-smoothstep(.35,.95,footprint*scale);}
// Macroscopic microscope R2 is used here only as a stable, material-space
// cross-scale microstructure. It never defines the tile outline or roof seating.
float r2mm(vec3 p,float seed,float footprint){'''
new='''float band(float footprint,float scale){return 1.-smoothstep(.35,.95,footprint*scale);}
mat2 rot2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
// One fixed rotation would only change the reference frame. Independent meaning
// begins when orientation varies smoothly with stable material regions/position.
float ceramicTurn(vec3 p,float seed){
 vec3 z=p+vec3(seed*.0017,seed*.0023,seed*.0011);
 float mineral=n3(z*5.4+vec3(2.7,8.1,4.3));
 float local=n3(z*17.6+vec3(9.2,1.4,6.8));
 float tilePhase=sin(seed*.031+1.7)*.5+.5;
 return (tilePhase-.5)*.10+(mineral-.5)*.30+(local-.5)*.085;
}
// Macroscopic microscope R2 is used here only as a stable, material-space
// cross-scale microstructure. It never defines the tile outline or roof seating.
float r2mm(vec3 p,float seed,float footprint){'''
rep(old,new)

old=''' vec3 q=p+vec3(seed*.017,seed*.023,seed*.019);
 // Stable, smoothly varying material rotation. Geometry / view never enters identity.
 float turn=uBio.z*.37*sin(p.z*11.0+seed*.17),cs=cos(turn),sn=sin(turn);
 if(uType==1)q.xy=mat2(cs,-sn,sn,cs)*p.xy+vec2(seed*.017,seed*.023);
 else if(uType==0)q.xz=mat2(.932,-.362,.362,.932)*p.xz+vec2(seed*.017,seed*.019);
 float macro=.5,middle=.5;'''
new=''' vec3 q=p+vec3(seed*.017,seed*.023,seed*.019);
 // Stable orientation field: ceramic direction follows tile/mineral/local regions.
 // No view vector or world camera participates, and no stack of redundant fixed rotations remains.
 if(uType==1){float turn=uBio.z*.37*sin(p.z*11.0+seed*.17);q.xy=rot2(turn)*p.xy+vec2(seed*.017,seed*.023);}
 else if(uType==0){float turn=uBio.z*ceramicTurn(p,seed);q.xz=rot2(turn)*p.xz+vec2(seed*.017,seed*.019);}
 float macro=.5,middle=.5;'''
rep(old,new)

# Replace ceramic material branch in one exact span.
macro_pos=s.index(' float macro=.5,middle=.5;')
start=s.index(' if(uType==0){', macro_pos)
end=s.index('\n }\n else if(uType==1){', start)
oldbranch=s[start:end+3]
newbranch=r''' if(uType==0){
   float fired=n3(q*8.2+vec3(8.1,2.6,5.4));
   float weather=clamp(uSurface.z,0.,1.);
   float grain=.5,micro=.5;
   if(fp*390.<.95)grain=mix(.5,n3(q*390.1),band(fp,390.));
   if(fp*1167.<.95)micro=mix(.5,n3(q*1167.),band(fp,1167.));

   // Substance-like ordering adapted to ceramic: structure first.
   float scrape=smoothstep(.65,.83,n3(vec3(q.x*880.,q.y*390.,q.z*64.)))*smoothstep(.48,.68,middle)*band(fp,800.);
   float pit=smoothstep(.73,.92,grain)*band(fp,390.);
   float r2detail=r2mm(q,seed,fp)*uBio.w;
   float crack=ceramicCrack(p.xz,fract(seed*.73),damage,fp);
   float skin=smoothstep(.05,.92,vMeta.x);
   float shellEdge=1.-smoothstep(.76,.985,vMeta.x);
   float structuralHeight=(middle-.5)*.00018+(grain-.5)*.00012*band(fp,390.)+(micro-.5)*.000047*band(fp,1167.)+r2detail*.000095-pit*.00013-scrape*.000035;
   structuralHeight-=crack*.00038;
   structuralHeight+=(1.-skin)*(grain-.5)*.00018*band(fp,390.);
   structuralHeight-=shellEdge*.000045*(.35+.65*damage);
   height=structuralHeight*uSurface.x;

   // Curvature/structure proxy is material-space and comes from the generated relief,
   // edge state and damage masks. It is not an independent colour-noise layer.
   float reliefN=clamp(.5+structuralHeight/.00062,0.,1.);
   float raised=smoothstep(.56,.82,reliefN);
   float recessed=1.-smoothstep(.19,.46,reliefN);
   float curvatureProxy=clamp(.30*raised+.32*recessed+.30*shellEdge+.26*pit+.34*crack+.14*scrape,0.,1.);

   // Colour comes after structure. Firing/mineral identity is preserved, then weathered
   // colour zones are derived from recesses, edges, pits and cracks.
   float individual=clamp(.50+(tint-.5)*uColor.z,0.,1.);
   float kilnDelta=(tint-.5)*uColor.z;
   vec3 body=mix(vec3(.050,.064,.071),vec3(.142,.151,.149),individual);
   float mineralWarm=smoothstep(.73,.90,fired*.78+macro*.18)*uSurface.y;
   float recessWash=weather*smoothstep(.30,.86,.54*recessed+.22*curvatureProxy+.16*middle+.08*macro);
   float edgePale=weather*smoothstep(.30,.82,.58*shellEdge+.24*raised+.18*scrape);
   body=mix(body,vec3(.238,.229,.204),recessWash*.58);
   body=mix(body,vec3(.181,.108,.050),mineralWarm*.24);
   body=mix(body,vec3(.174,.181,.174),edgePale*.18);
   body*=1.+.18*kilnDelta;
   body+=vec3(-.008,-.002,.009)*kilnDelta;
   float cool=smoothstep(.57,.79,n3(q*5.1+vec3(4.7,8.2,1.3)));
   body=mix(body,vec3(.036,.050,.060),cool*.21);
   body*=1.-.075*recessed*weather;
   body*=1.-pit*.13-crack*.08;
   body+=vec3(.012,.013,.012)*scrape;
   body*=vec3(1.+.13*uColor.y,1.+.015*uColor.y,1.-.14*uColor.y)*uColor.x;
   base=mix(body,vec3(.026,.027,.022),crack*.82);

   // Exposed clay remains a specific reference-guided recipe.
   vec3 core=mix(vec3(.245,.182,.102),vec3(.38,.245,.102),uColor.w)*(.83+.30*grain+.08*middle);
   base=mix(core,base,skin);

   // Roughness is a separate field. Structure can modify it, but colour does not drive it.
   float roughField=.5;
   if(fp*247.<.95)roughField=mix(.5,n3(q*247.3+vec3(6.4,2.2,9.7)),band(fp,247.));
   rough=clamp(.835+.115*(roughField-.5)+.075*recessed+.060*pit+.095*crack+.045*shellEdge-.055*scrape-r2detail*.020,.69,.985);
   rough*=1.-uSurface.w*.16;base*=1.-uSurface.w*.15;
   ao=1.-crack*.25-pit*.15-recessed*.035;

   if(uBio.x>.001&&vMeta.x>.6&&vState.w>.015){
    float env=clamp(vState.w,0.,1.);
    float colony=.56*env+.20*macro+.12*middle+.12*n3(q*3.7+vec3(2.1,7.3,4.4));
    float edge=.90-.34*uBio.x;
    float cover=smoothstep(edge-.06,edge+.06,colony);
    cover*=smoothstep(-.10,.38,N.y);
    vec3 moss=mix(vec3(.026,.035,.010),vec3(.110,.125,.040),clamp(middle*.65+grain*.35,0.,1.));
    base=mix(base,moss,cover*.94);height+=(grain-.5)*.00020*cover*uSurface.x;
    rough=mix(rough,.98,cover);ao*=1.-cover*.08;
   }

 }'''
s=s[:start]+newbranch+s[end+3:]

# Add version-specific QA markers near settings.
rep("const settings={scene:'pan',seed:314159,year:0,care:false,relief:.82,warmth:.36,patina:.38,wet:0,moss:.22,mossHeight:.82,brightness:.96,variation:.62,core:.48,twist:1.15,r2:.38,fracture:0,diagnostic:0};",
    "const settings={scene:'pan',seed:314159,year:0,care:false,relief:.82,warmth:.36,patina:.38,wet:0,moss:.22,mossHeight:.82,brightness:.96,variation:.62,core:.48,twist:1.15,r2:.38,fracture:0,diagnostic:0};\nconst BUILD_INFO=Object.freeze({version:'R2-closeout-03',parent:'R2-closeout-02',materialOrder:'height-edge-damage -> structure-derived color -> independent roughness',orientation:'stable tile/mineral/local material field'});")

# Add build info to metrics without changing drawing logic.
rep("$('#metrics').textContent=`绘制 ${lastStats.drawCalls} 次 · 三角形 ${lastStats.triangles.toLocaleString()} · 几何缓冲 ${(lastStats.geometryBytes/1048576).toFixed(2)} MiB · 最近生成 ${workshop.buildMs.toFixed(1)} ms · 静止停绘`;",
    "$('#metrics').textContent=`${BUILD_INFO.version} · 绘制 ${lastStats.drawCalls} 次 · 三角形 ${lastStats.triangles.toLocaleString()} · 几何缓冲 ${(lastStats.geometryBytes/1048576).toFixed(2)} MiB · 最近生成 ${workshop.buildMs.toFixed(1)} ms · 静止停绘`;")

outdir=ROOT/'tiles-mother/r2-closeout-03'
outdir.mkdir(parents=True,exist_ok=True)
raw=s.encode('utf-8')
source_sha=hashlib.sha256(raw).hexdigest()
if source_sha!='5ad053603b397eebf4f30c63f296cfcc4b9fb825dd22f1c28c8705fa0d17a745': raise SystemExit('unexpected source sha '+source_sha)
comp=gzip.compress(raw,compresslevel=9,mtime=0)
b64=base64.b64encode(comp).decode('ascii')
wrapper=f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tiles Mother · R2 收尾候选 03</title><body style="margin:0;background:#e0e2dd;font:14px system-ui;color:#283532"><div id="boot" style="padding:24px">加载 Tiles Mother R2 收尾候选 03…</div><script>(async()=>{{try{{const b=`{b64}`.replace(/\\s/g,''),u=Uint8Array.from(atob(b),c=>c.charCodeAt(0)),h=await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).text();document.open();document.write(h);document.close()}}catch(e){{document.getElementById("boot").textContent="启动失败："+e.message}}}})();</script>'''
wrapper_sha=hashlib.sha256(wrapper.encode()).hexdigest()
print('wrapperSHA256',wrapper_sha)
(outdir/'START_HERE.html').write_text(wrapper,'utf-8')
print(json.dumps({'sourceSHA256':source_sha,'standaloneSHA256':wrapper_sha,'bytes':len(wrapper.encode())},indent=2))
