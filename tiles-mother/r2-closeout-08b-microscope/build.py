"""Assemble an existing workbench at build time; never patch downloaded source in the browser."""
from pathlib import Path
import argparse, hashlib, json, re, subprocess

HERE=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
ap.add_argument('--base',type=Path)
ap.add_argument('--loader',type=Path)
a=ap.parse_args()
root=HERE.parent.parent
base=a.base or root/'tiles-mother/r2-closeout-07-detail/START_HERE.html'
loader=a.loader or root/'tiles-mother/r2-closeout-08a-micro-tune/START_HERE.html'
if not base.exists() and a.base is None:base=HERE.parent/'r2-closeout-07-detail/START_HERE.html'
if not loader.exists() and a.loader is None:loader=HERE.parent/'r2-closeout-08a-micro-tune/START_HERE.html'
b=base.read_bytes()
sha=lambda data:hashlib.sha256(data).hexdigest()
assert sha(b)=='d101a20b0290cc20a148d65f64dfad1c4a00d402143e2492508138566100200b','Frozen 07 source byte mismatch'
script=re.search(r'<script>(.*?)</script>',loader.read_text(),re.S).group(1)
vm="""const fs=require('fs'),vm=require('vm');const x=JSON.parse(fs.readFileSync(0,'utf8'));let out='';const c={console,fetch:async()=>({ok:true,text:async()=>x.base}),document:{open(){},write(t){out=t},close(){},getElementById(){throw Error('08A loader failed')}}};vm.runInNewContext(x.script,c);setTimeout(()=>{if(!out)throw Error('empty 08A');process.stdout.write(out)},30);"""
run=subprocess.run(['node','-e',vm],input=json.dumps({'base':b.decode(),'script':script}),text=True,capture_output=True,check=True)
baseline=run.stdout
assert "R2-closeout-08A-micro-tune" in baseline
h=baseline
changes=[]
def once(old,new,label=None):
 global h
 assert h.count(old)==1, f'{label or old[:65]} occurrences={h.count(old)}'
 h=h.replace(old,new,1);changes.append(label or old[:65])
def between(start,end,replacement,label):
 global h
 assert h.count(start)==1 and h.count(end)==1,label
 i=h.index(start);j=h.index(end,i)
 h=h[:i]+replacement+h[j:];changes.append(label)

# Preserve the shared historical helper for WOOD ONLY. The tile no longer calls it.
start=baseline.index('float r2mm(');brace=baseline.index('{',start);depth=1;end=brace+1
while depth:
 if baseline[end]=='{':depth+=1
 elif baseline[end]=='}':depth-=1
 end+=1
wood_helper=baseline[start:end]+'\n'
between('// One fixed rotation would only change the reference frame.', 'vec3 srgb(vec3 c)',wood_helper+(HERE/'microscope-surface.glsl').read_text()+'\n','replace old tile pattern functions with source-verified Microscope')
once(" else if(uType==0){float turn=uBio.z*ceramicTurn(p,seed);q.xz=rot2(turn)*p.xz+vec2(seed*.017,seed*.019);q=ceramicWarp(q,seed);}","",'remove old ceramic rotation/warp path')
once("if(uType!=3){macro=n3(q*17.3);middle=mix(.5,n3(q*63.7+vec3(8.1,1.7,3.8)),band(fp,63.7));} if(uType==0){macro=ceramicWave(q,seed+11.,17.0);middle=mix(.5,ceramicWave(q,seed+29.,57.0),band(fp,57.0));}","if(uType==1||uType==2){macro=n3(q*17.3);middle=mix(.5,n3(q*63.7+vec3(8.1,1.7,3.8)),band(fp,63.7));}",'preserve wood and moss fields; no old tile pattern evaluation')
between(' if(uType==0){\n   float fired=', ' else if(uType==1){', (HERE/'tile-pbr.glsl').read_text(), 'connect one Microscope field to existing tile PBR')
once("'uShadow','uFinish']","'uShadow','uFinish','uMicroscope']",'register Microscope uniform')
once('g.uniform1f(U.uFinish,settings.finish);','g.uniform1f(U.uFinish,settings.finish);g.uniform4fv(U.uMicroscope,[settings.micStrength,settings.micScale,settings.micColor,settings.micRough]);','bind material controls without rebuilding geometry')
once('finish:.72,fracture:0,diagnostic:0};','finish:.72,fracture:0,diagnostic:0,micStrength:1,micScale:1,micColor:.30,micRough:.30};','add four bounded Microscope/PBR controls')
once('<h3>材质与失养 · R2 收尾 08A</h3>',(HERE/'microscope-controls.html').read_text()+'<h3>瓦色与失养</h3>','existing panel controls')
for key in ['relief','twist','r2']:
 pattern=r'<div class="row"><label for="'+key+r'".*?</div><input id="'+key+r'"[^>]*>'
 m=re.search(pattern,h,re.S);assert m,key
 h=h[:m.start()]+'<div hidden>'+m.group()+'</div>'+h[m.end():]
h=re.sub(r'<div class="presets"><button data-r2=.*?</div><p class="tiny">.*?</p>','',h,flags=re.S)
h=re.sub(r'<div class="presets"><button data-finish=.*?</div><p class="tiny">.*?</p>','',h,flags=re.S)
h=re.sub(r'<p class="tiny">主冷灰与05.*?</p>','<p class="tiny">08A 主体与尺寸保持。瓦面仅使用 Microscope 多尺度场接入现有 PBR；不叠加旧刻线。</p>',h,flags=re.S)
h=re.sub(r'<p class="tiny">材质链：.*?</p>','',h,flags=re.S)
once('function init(){try{',(HERE/'microscope-controls.js').read_text()+'\nfunction init(){try{','wire controls in same workbench')
once('workshop.build(settings);fit();', 'workshop.build(settings);fit();initMicroscopeControls();','initialize controls after renderer')
h=h.replace('R2 收尾候选 08A · 只做表面强度微调','R2 收尾候选 08B · Microscope + PBR')
h=h.replace('Tiles Mother · R2 收尾候选 08A','Tiles Mother · R2 收尾候选 08B')
h=h.replace("version:'R2-closeout-08A-micro-tune'","version:'R2-closeout-08B-microscope-pbr'")
h=h.replace("version:'r2-closeout-07'","version:'r2-closeout-08B-microscope-pbr'")
h=h.replace("surface:'tile identity -> mineral regions -> colony clusters -> sparse pores'","surface:'Yohei Microscope 17-scale field -> existing tile PBR'")
h=h.replace('灰青陶面','灰青瓦面')
h=h.replace('</head>','<style>#microscopeControls{border-bottom:1px solid #5e716a28;padding-bottom:12px;margin-bottom:16px}#microscopeControls input{min-height:24px}#microscopeControls .presets{flex-wrap:wrap}#micValues{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}</style></head>')
assert 'fetch(' not in h and 'document.write(' not in h, 'Delivered HTML must be self-contained'
for name in ['ceramicWave','ceramicColony','r2Finish','ceramicTurn','ceramicWarp']:
 assert name not in h,name+' was not completely removed from active tile path'
assert not re.search(r'\bfloat\s+patch\b',h)
protected={}
for name,start,end in [
 ('geometry_and_vertex_depth','// Original, dependency-free math.','const FRAG='),
 ('roof_state_and_workshop','function roofState(',"const $=s=>"),
 ('camera_fit',"function fit(view='iso')",'function rebuild('),
 ('pointer_controls',' canvas.onpointerdown=', ' window.TilesClean=')]:
 old=baseline[baseline.index(start):baseline.index(end,baseline.index(start))]
 new=h[h.index(start):h.index(end,h.index(start))]
 assert old==new,name+' unexpectedly changed'
 protected[name]={'equal':True,'sha256':sha(old.encode())}
(HERE/'START_HERE.html').write_text(h)
(HERE/'.qa-baseline08a.html').write_text(baseline)
js=re.search(r'<script>(.*?)</script>',h,re.S).group(1)
(HERE/'.qa-script.js').write_text(js)
subprocess.run(['node','--check',str(HERE/'.qa-script.js')],check=True)
report={'version':'08B-microscope-pbr','source07SHA256':sha(b),'materialized08ASHA256':sha(baseline.encode()),'outputSHA256':sha(h.encode()),'bytes':len(h.encode()),'protected':protected,'selfContained':True,'oldTilePatternsRemoved':True,'JSsyntaxPassed':True,'microscopeFormula':'cos(dot(cos(xi.zyy*s),cos(xi.xyx*s)))/s','scaleCount':17,'noGuessedRotationSchedule':True,'visualApproved':False,'productionApproved':False,'changes':changes}
(HERE/'BUILD_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
