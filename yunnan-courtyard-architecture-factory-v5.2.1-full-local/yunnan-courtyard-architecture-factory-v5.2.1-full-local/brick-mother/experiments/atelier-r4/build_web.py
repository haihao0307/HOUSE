"""Build the R4 review page without changing any frozen legacy asset.
The sources initially committed during this review are kept readable. Small,
explicit corrections below are also written out as generated-src for audit.
"""
from pathlib import Path
import hashlib, json, os, re, sys
ROOT=Path(__file__).resolve().parent
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'web'
OUT.mkdir(parents=True,exist_ok=True)
def replace(s,old,new):
    if new in s: return s
    if old not in s: raise ValueError('Expected source marker missing: '+old[:100])
    return s.replace(old,new)
sources={p.name:p.read_text() for p in (ROOT/'src').iterdir() if p.is_file()}
s=sources['kernel.js']
s=replace(s,"function surface(p,N){let lo=-.58,hi=.19;const value=t=>sample(...p.map((v,k)=>v+N[k]*t));if(value(lo)>=0||value(hi)<=0)return null;for(let j=0;j<22;j++){const mid=(lo+hi)/2;if(value(mid)<0)lo=mid;else hi=mid;}return p.map((v,k)=>v+N[k]*(lo+hi)/2);}","function surface(p,N){let lo=null,hi=.19;const value=t=>sample(...p.map((v,k)=>v+N[k]*t));if(value(hi)<=0)return null;for(let j=1;j<=64;j++){const t=.19-.77*j/64;if(value(t)<0){lo=t;break;}hi=t;}if(lo===null)return null;for(let j=0;j<22;j++){const mid=(lo+hi)/2;if(value(mid)<0)lo=mid;else hi=mid;}return p.map((v,k)=>v+N[k]*(lo+hi)/2);}")
sources['kernel.js']=s
s=sources['renderer.js']
s=replace(s,'out vec3 vQ;out vec3 vP;','out float vDrift;out vec3 vQ;out vec3 vP;')
s=replace(s,'in vec3 vQ;in vec3 vP;','in float vDrift;in vec3 vQ;in vec3 vP;')
s=replace(s,'void main(){vQ=detailCoordinates(aLocal);vP=aPosition;','void main(){vQ=aLocal;vDrift=.5;if(aKind<.5){vQ=detailCoordinates(aLocal);vec3 q=vQ+vec3(uPhase*.47,-uPhase*.31,uPhase*.19);vDrift=noise(q*4.3+vec3(7.8,-11.3,4.1));}vP=aPosition;')
s=replace(s,'sum+=w*(microscopeCell(q)-.6556965)*amp;','if(w<=.0001)break;\n  sum+=w*(microscopeCell(q)-.6556965)*amp;')
s=replace(s,'vec3 q=vQ+vec3(uPhase*.47,-uPhase*.31,uPhase*.19);\n float footprint=','float field=0.;\n if(vKind<.5){\n vec3 q=vQ+vec3(uPhase*.47,-uPhase*.31,uPhase*.19);\n float footprint=')
s=replace(s,'float field=microscopeSum(q*uFrequency*2.4);','field=microscopeSum(q*uFrequency*2.4);')
s=replace(s,'float grain=noise(q*211.7+vec3(4.1,8.3,-2.1));\n float fineFilter=1.-smoothstep(.0015,.006,footprint);\n grain=mix(.5,grain,fineFilter);\n float drift=noise(q*4.3+vec3(7.8,-11.3,4.1));','float fineFilter=1.-smoothstep(.0015,.006,footprint);\n float grain=.5;if(fineFilter>.0001)grain=mix(.5,noise(q*211.7+vec3(4.1,8.3,-2.1)),fineFilter);\n float drift=vDrift;')
s=replace(s,' }\n if(vKind>.5){\n  float fiber=',' }\n }\n if(vKind>.5){\n  float fiber=')
s=replace(s,'vec3 F=vec3(.04)+vec3(.96)*pow(1.-vh,5.);','float f=1.-vh,f2=f*f;vec3 F=vec3(.04)+vec3(.96)*(f2*f2*f);')
s=replace(s,'const norm=a=>',"const gpuInfo=gl.getExtension('WEBGL_debug_renderer_info');\nconst gpuName=gpuInfo?String(gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL)):'';\nconst softwareGPU=/SwiftShader|llvmpipe|softpipe|software raster/i.test(gpuName);\nconst norm=a=>")
s=replace(s,'const stats={frames:0','if(softwareGPU)state.pixelRatio=.67;\nconst stats={softwareGPU,gpuName,frames:0')
sources['renderer.js']=s
s=sources['app.js']
s=replace(s,"r1:'legacy/R1.html',v26:'legacy/V2.6.html',v275:'legacy/V2.7.5.html'","r1:'legacy/R1_Performance.html',v26:'legacy/V2.6_Performance.html',v275:'legacy/V2.7.5_Performance.html'")
s=replace(s,"if(api?.selectFamily&&counterpart){api.selectFamily(counterpart);","if((api?.selectFamily||api?.setFamily)&&counterpart){(api.selectFamily||api.setFamily)(counterpart);")
s=replace(s,"const f=api?.parameters?.().family;","const f=api?.parameters?.().family||api?.stats?.().parameters?.family;")
s=replace(s,"renderer=createBrickRenderer($('view'));renderer.reset();","renderer=createBrickRenderer($('view'));renderer.reset();$('pixelRatio').value=renderer.stats.softwareGPU?'.67':String(renderer.state.pixelRatio);")
s=replace(s,"+'k 面');$('metrics')","+'k 面'+(renderer.stats.softwareGPU?' · 软件图形 '+renderer.state.pixelRatio+'×':''));$('metrics')")
# Online release intentionally loads R4 only. All historical bytes stay in the delivered backup.
s=replace(s,"$('versionDialog').close();if(v==='r4')", "$('versionDialog').close();if(window.BRICK_ONLINE_ONLY&&v!=='r4'){setStatus('旧版原件已归档，本在线入口只运行 R4');return;}if(v==='r4')")
sources['app.js']=s
s=sources['index.template.html']
s=replace(s,'<option value="1">1× 原生</option>','<option value="1">1× 原生</option><option value=".67">0.67× 软件图形</option>')
s=s.replace('R1 · 七类原件','R1 · 七类保留版').replace('V2.6 · 深孔原件','V2.6 · 深孔保留版').replace('V2.7.5 · 三材质原件','V2.7.5 · 三材质保留版')
s=re.sub(r'<button data-version="(r3|r2|r1|v26|v275)"',r'<button disabled title="原件完整保存在源码备份包，此网页不加载旧版重计算" data-version="\1"',s)
s=re.sub(r'<p>R1、V2\.6、V2\.7\.5 使用之前的线程封装版.*?</p>','<p>本在线入口只运行 R4。R1、R2、R3、V2.6、V2.7.5 原件完整保存在源码备份包中；离线备份还包含可切换的线程封装入口。旧版未在本网址重新挂载，避免混淆当前候选与原件。</p>',s)
s=s.replace('</head>','<script>window.BRICK_ONLINE_ONLY=true;</script></head>')
sources['index.template.html']=s
compiled=s
for key,name in [('STYLE','style.css'),('CATALOG','catalog.js'),('KERNEL','kernel.js'),('RENDERER','renderer.js'),('APP','app.js')]:
    compiled=compiled.replace('/*'+key+'*/',sources[name])
head=os.environ.get('GITHUB_SHA','local-not-deployed')
compiled=compiled.replace('<title>','<meta name="source-commit" content="'+head+'"><title>',1)
(OUT/'index.html').write_text(compiled)
(OUT/'generated-src').mkdir(exist_ok=True)
for name,text in sources.items(): (OUT/'generated-src'/name).write_text(text)
manifest={'version':'R4.0.0','head':head,'defaultMaterial':'fired','materials':['fired','kiln','adobe','dressed','rubble','stone','pebble'],'htmlSHA256':hashlib.sha256(compiled.encode()).hexdigest(),'bytes':len(compiled.encode()),'humanVisualApproved':False,'productionApproved':False,'publicLegacy':'not_mounted; exact originals retained in user source backup','sources':{k:hashlib.sha256(v.encode()).hexdigest() for k,v in sources.items()}}
(OUT/'RELEASE.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
