"""Build additive V0.4 from exact V0.3, keeping legacy/reference code intact."""
from pathlib import Path
import argparse,hashlib,json,re
p=argparse.ArgumentParser();p.add_argument('--base',required=True);p.add_argument('--out',required=True);a=p.parse_args()
root=Path(__file__).resolve().parent
base=Path(a.base).read_bytes();basehash=hashlib.sha256(base).hexdigest()
assert basehash=='43e5a6d2e0121da469b07d2e5452829e5c00ba4e2440aa65930776fab6184887','unexpected V0.3 baseline'
html=base.decode()
# Preserve the real V0.3 helper without a relative URL that breaks a self-contained candidate.
# Missing helper previously made the inherited QA report a false geometry failure.
legacy_path=root.parent/'v03/jiangwutang-material.js'
legacy=legacy_path.read_bytes()
assert hashlib.sha256(legacy).hexdigest()=='7a6ce022a21cf15f42a65bd7ec618474cbf97c620fa06d548f6ce163841cf6a0','unexpected legacy helper'
legacy_tag='<script src="v03/jiangwutang-material.js"></script>'
assert html.count(legacy_tag)==1,'legacy dependency marker changed'
html=html.replace(legacy_tag,'<script id="tm-v03-compatibility">'+legacy.decode().replace('</script','<\\/script')+'</script>')
pattern=r'(<script id="tiles-mother-app">)([\s\S]*?)(</script>)';m=re.search(pattern,html);assert m
app=m.group(2)
def change(old,new):
 global app
 assert old in app,old[:100]
 app=app.replace(old,new)
change("const VERSION='0.3.0';","const VERSION='0.4.0';")
change("channel:'final',materialPreset:'jiangwutang-v03'","channel:'final',materialPreset:'relief-v04',study:studyDefaults()")
change('function buildGeometry(', 'function buildLegacyGeometry(')
change('class Renderer{','class LegacyRenderer{')
change('function rebuild(fit=false){','function legacyRebuild(fit=false){')
# Delete the obsolete duplicate validator, then amend the final migration gate.
a0=app.index('function validateProject(raw)');a1=app.index('function validateProject(raw)',a0+1)
app=app[:a0]+app[a1:]
change("!['0.1.0','0.2.0','0.3.0'].includes(raw.version)","!['0.1.0','0.2.0','0.3.0','0.4.0'].includes(raw.version)")
change('支持 V0.1、V0.2 和 V0.3。','支持 V0.1 至 V0.4。')
change("p.layout=['single','trio'].includes(raw.layout)","p.layout=['single','trio','roof'].includes(raw.layout)")
change("['final','source','albedo','normal','cavity','roughness','weather','macro','meso'].includes(raw.channel)","['final','source','albedo','normal','cavity','roughness','weather','macro','meso','relief','wetness','damage','wire'].includes(raw.channel)")
change("p.materialPreset=raw.version==='0.3.0'?(raw.materialPreset==='legacy-v02'?'legacy-v02':'jiangwutang-v03'):'legacy-v02';", "p.study=validateStudy(raw.study);p.materialPreset=raw.version==='0.4.0'&&['relief-v04','legacy-v02','jiangwutang-v03'].includes(raw.materialPreset)?raw.materialPreset:'relief-v04';")
change('makeUI();wire();try{db=', 'makeUI();wire();setupStudyUI();try{db=')
change(' attachReferenceAPI();',' attachReferenceAPI();attachStudyAPI();')
change("if(!['single','trio'].includes(l))", "if(!['single','trio','roof'].includes(l))")
change('Math.abs(minT-c.thickness*.01)<1e-5',"(studyActive()?minT>=c.thickness*.0055:Math.abs(minT-c.thickness*.01)<1e-5)")
change("package:'JIANGWUTANG_MATERIAL_CANDIDATE_V0.3',version:'0.3.0'", "package:'TILES_THIN_SHELL_EVOLUTION_V0.4',version:'0.4.0'")
change("generator:'v03/jiangwutang-material.js'", "generator:'v04/operators.js',renderer:'v04/studio.js',adapter:'v04/integration.js',historyCalibration:'illustrative_not_calibrated'")
change("['shape','warp','structure','damage'].includes(key)", "(['shape','warp','structure','damage'].includes(key)||(studyActive()&&key==='weather'))")
change("['master','shape','warp','structure','damage'].includes(key)", "(['master','shape','warp','structure','damage'].includes(key)||(studyActive()&&key==='weather'))")
change('Tiles_Mother_V02_Work_Record_', 'Tiles_Mother_V04_Work_Record_')
change('async function init(){',(root/'integration.js').read_text()+'\nasync function init(){')
html=html[:m.start(2)]+app+html[m.end(2):]
pre='\n'.join('<script id="tm-v04-'+name+'">'+(root/(name+'.js')).read_text().replace('</script','<\\/script')+'</script>' for name in ['operators','studio'])
html=html.replace('<script id="tiles-mother-app">',pre+'\n<script id="tiles-mother-app">')
html=html.replace('<title>Tiles Mother V0.3 · 讲武堂材质候选</title>','<title>Tiles Mother V0.4 · 立体瓦面与共享岁月</title>')
html=html.replace('V0.3 · 讲武堂材质候选','V0.4 · 立体瓦面研究候选')
html=html.replace('独立实体几何；“原色观察”显示候选 albedo，“完整光照”显示同一候选经过固定光照。参考照片仅用于对照，不贴到模型上。','V0.4 使用真实起伏网格和共享湿润历史。尺寸、微结构和时间响应均为待校准候选。')
css='''<style id="tm-v04-style">.study-canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;outline:none}#gl-legacy{position:absolute;inset:0;width:100%;height:100%}.study-panel select{width:100%}.study-panel .explain{margin-top:8px;font-size:10px}.study-panel details{margin:14px 0}.study-panel summary{cursor:pointer}#studyStatus{color:#866137;font-size:10px;line-height:1.7}#diagnosticLegend{padding:8px;background:#e9ece7;border-radius:6px}.viewer-chip{max-width:80%;line-height:1.6}.shell{grid-template-columns:255px minmax(330px,1fr) 290px}.viewer-head,.viewer-chip{color:#303c3e}.viewer-head .eyebrow,.specimen-caption{color:#626f73}@media(max-width:1000px){.shell{grid-template-columns:225px minmax(280px,1fr)}.reference-rail{grid-column:1/-1}}@media(max-width:600px){.shell{display:flex}.study-panel{order:0}.viewer-chip{font-size:9px;top:78px}.viewer{min-height:440px}}input:disabled,select:disabled{opacity:.45}</style>'''
html=html.replace('</head>',css+'\n</head>')
out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(html.encode())
manifest={'version':'0.4.0','baseCommit':'f55949d3d2c03f58951856e8d4e384f3b831d3ea','baseSHA256':basehash,'bytes':out.stat().st_size,'indexSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'legacyHelperSHA256':hashlib.sha256(legacy).hexdigest(),'sources':{name:{'bytes':(root/name).stat().st_size,'sha256':hashlib.sha256((root/name).read_bytes()).hexdigest()} for name in ['operators.js','studio.js','integration.js','build.py']},'policyVersionRead':'1.0.0','fullPolicyRuntimeAdoption':False,'policySchemaAndValidatorIdentity':'not_received','rawSourceInRuntime':False,'visualApproved':False,'productionApproved':False}
(out.parent/'build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for i,js in enumerate(re.findall(r'<script(?: id="(?:tm-v04-[^"]+|tiles-mother-app)")>([\s\S]*?)</script>',html)):(out.parent/f'check-{i}.js').write_text(js)
print(json.dumps(manifest,indent=2))
