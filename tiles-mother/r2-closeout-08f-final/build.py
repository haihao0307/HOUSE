from __future__ import annotations

from pathlib import Path
import hashlib
import json
import re
import shutil

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "r2-closeout-08e-contact"

html = (SRC / "START_HERE.html").read_text(encoding="utf-8")
shape = (HERE / "shape.glsl").read_text(encoding="utf-8").strip()

# Replace both production and depth copies of the 08D/08E Microscope adapter.
shape_pattern = r"// 08D: geometry adapter\.[\s\S]*?return vec3\(dx,dy,dz\);\s*\}"
html, shape_count = re.subn(shape_pattern, lambda _m: shape, html)
if shape_count != 2:
    raise RuntimeError(f"expected two geometry adapters, got {shape_count}")

# The new scan is used as evidence for palette breadth/order only. Its diffuse contains baked lighting,
# so these are procedural material families rather than copied texels or claimed albedo measurements.
color_block = r'''// 08F scan-guided palette breadth. The photogrammetry diffuse contains lighting/shadow;
   // use it only to widen stable colour families, never as measured albedo or a texture dependency.
   float kilnDelta=(tint-.5)*uColor.z;
   float scanMacro=n3(q*5.4+vec3(1.2,4.7,2.1));
   float scanMiddle=n3(q*17.0+vec3(7.1,2.4,5.9));
   float family=clamp(.5+micro.value*.30,0.,1.);
   float warmGate=smoothstep(.42,.80,.55*scanMacro+.45*(1.-family));
   float coolGate=smoothstep(.64,.90,.58*scanMiddle+.42*family);
   float earthGate=smoothstep(.76,.94,n3(q*8.3+vec3(11.2,3.7,.8)));
   vec3 deepGrey=vec3(.052,.061,.064),ashGrey=vec3(.190,.184,.171);
   vec3 warmGrey=vec3(.170,.128,.096),coolGrey=vec3(.090,.121,.145),earthGrey=vec3(.235,.126,.052);
   float tileLight=clamp(.26+.67*individual+.17*(scanMacro-.5),0.,1.);
   vec3 body=mix(deepGrey,ashGrey,tileLight);
   body=mix(body,warmGrey,warmGate*(.22+.24*uSurface.y));
   body=mix(body,coolGrey,coolGate*.28);
   body=mix(body,earthGrey,earthGate*uSurface.y*.18);
   body=mix(body,vec3(.255,.247,.229),uSurface.z*.10);
   body*=1.+.17*kilnDelta;
   body+=vec3(.018,.006,-.009)*kilnDelta;
   float colorVariation=clamp(micro.value*.28,-.22,.22)*uMicroscope.z;
   body*=1.+colorVariation;
   body+=vec3(.016,.006,-.007)*clamp(micro.value,-1.,1.)*uMicroscope.z*uSurface.y;
   float sideFace=1.-smoothstep(.30,.78,abs(N.y));
   float underFace=1.-smoothstep(-.78,-.18,N.y);
   body=mix(body,body*vec3(1.06,.93,.80)+vec3(.008,.004,0.),sideFace*.10);
   body=mix(body,body*vec3(.88,.77,.68)+vec3(.014,.006,.001),underFace*.10);
   body*=vec3(1.+.13*uColor.y,1.+.015*uColor.y,1.-.14*uColor.y)*uColor.x;
   vec3 core=mix(vec3(.235,.162,.084),vec3(.410,.238,.078),uColor.w)*(.96+micro.fine*.12);
   base=mix(core,body,skin);
   rough=clamp(.855+micro.fine*uMicroscope.w*.30,.75,.97);'''
color_pattern = r"// Preserve the existing cool-grey tile palette and stable whole-tile differences\.[\s\S]*?rough=clamp\(\.86\+micro\.fine\*uMicroscope\.w\*\.32,\.76,\.97\);"
html, color_count = re.subn(color_pattern, color_block, html, count=1)
if color_count != 1:
    raise RuntimeError(f"expected one ceramic colour block, got {color_count}")


def replace_once(old: str, new: str) -> None:
    global html
    count = html.count(old)
    if count != 1:
        raise RuntimeError(f"expected one marker {old!r}, got {count}")
    html = html.replace(old, new, 1)


def set_input_value(element_id: str, value: str) -> None:
    global html
    pattern = rf'(<input id="{re.escape(element_id)}"[^>]*\bvalue=")[^"]+("[^>]*>)'
    html, count = re.subn(pattern, lambda m: m.group(1) + value + m.group(2), html, count=1)
    if count != 1:
        raise RuntimeError(f"input {element_id} not updated")


def set_output(element_id: str, value: str) -> None:
    global html
    pattern = rf'(<output id="{re.escape(element_id)}">)[^<]*(</output>)'
    html, count = re.subn(pattern, lambda m: m.group(1) + value + m.group(2), html, count=1)
    if count != 1:
        raise RuntimeError(f"output {element_id} not updated")


replace_once("<title>Tiles Mother · R2 收尾候选 08E</title>", "<title>Tiles Mother · R2 收尾候选 08F</title>")
replace_once("<small>08E · 08D 外观基线 / 接触校正</small>", "<small>08F · 完整壳体 / 综合色彩</small>")
replace_once("<div class=\"tiny\">08E 接触校正版 · 08D 外观基线保持</div>", "<div class=\"tiny\">08F 收尾候选 · 正/侧/背面连续实体变化</div>")
replace_once("Yohei Microscope · 17级公式。真实面起伏、边口缺凹与有底气孔；底面保持。", "Yohei Microscope · 17级公式。正面、侧壁、边口与背面由同一稳定形态场连续生成。")
replace_once("讲武堂资料中的暖灰、灰褐与少量冷灰，保留原灰青基调。", "讲武堂精细扫描显示灰白、暖灰褐、冷灰与少量土赭并存；只蒸馏色族关系，不复制贴图。")
replace_once("08A 主体与尺寸保持。Microscope 同时驱动微形态与现有 PBR；不叠加旧刻线。", "08E 装配与尺寸关系保持。Microscope 驱动完整壳体微形态与综合色彩；不叠加旧刻线。")

# Final colour starting point: wider, still conservative. These are authored controls, not measured albedo.
for element_id, value, output in [
    ("micColor", "0.52", "0.52"),
    ("brightness", "0.98", "98%"),
    ("variation", "0.72", "72%"),
    ("warmth", ".54", "54%"),
    ("patina", ".34", "34%"),
    ("core", "0.56", "56%"),
]:
    set_input_value(element_id, value)
    set_output(element_id + "Val", output)

settings_pattern = r"const settings=\{scene:'pan',[^\n]+\};"
settings_new = "const settings={scene:'pan',seed:314159,year:0,care:false,relief:.76,warmth:.54,patina:.34,wet:0,moss:.22,mossHeight:.82,brightness:.98,variation:.72,core:.56,twist:.92,r2:.24,finish:.72,fracture:0,diagnostic:0,micStrength:1.6,micScale:1,micColor:.52,micRough:.30};"
html, count = re.subn(settings_pattern, settings_new, html, count=1)
if count != 1:
    raise RuntimeError("settings object not updated")

html = html.replace("const MIC_DEFAULTS=Object.freeze({micStrength:1.6,micScale:1,micColor:.30,micRough:.30});", "const MIC_DEFAULTS=Object.freeze({micStrength:1.6,micScale:1,micColor:.52,micRough:.30});", 1)
html = html.replace("let lastPbrColor=.30;", "let lastPbrColor=.52;", 1)
html = html.replace("lastPbrColor||.3", "lastPbrColor||.52", 1)
html = html.replace("option('micColor',.3);option('micRough',.3)", "option('micColor',.52);option('micRough',.3)", 1)
html = html.replace("Tiles 08D · ", "Tiles 08F · ")
html = html.replace("version:'r2-closeout-08D-microshape-pbr'", "version:'r2-closeout-08F-full-shell-color'")
html = html.replace("version:'R2-closeout-08D-microshape-pbr'", "version:'R2-closeout-08F-full-shell-color'")
html = html.replace("surface:'Yohei Microscope 17-scale field -> existing tile PBR'", "surface:'Yohei Microscope 17-scale field -> full shell geometry -> scan-guided procedural colour families'")
html = html.replace("preset==='neutral'?{brightness:.96,variation:.62,patina:.38,warmth:.36}", "preset==='neutral'?{brightness:.98,variation:.72,patina:.34,warmth:.54}", 1)
html = html.replace("{brightness:.96,variation:.58,patina:.38,warmth:.36,relief:.76,core:.48,twist:.92,r2:.24,wet:0,moss:.22,mossHeight:.82}", "{brightness:.98,variation:.72,patina:.34,warmth:.54,relief:.76,core:.56,twist:.92,r2:.24,wet:0,moss:.22,mossHeight:.82}", 1)

out_html = HERE / "START_HERE.html"
out_html.write_text(html, encoding="utf-8", newline="")

# CPU mirror: keep the existing contact evaluator, but mirror the 08F full-shell field and report
# top/side/bottom contributions separately. This revises the obsolete 08D bottom-micro-zero target.
qa = (SRC / "qa_geometry.cjs").read_text(encoding="utf-8")
js_micro = r'''function micro(p,m,seed,strength,scale){
 if(!strength||m[1]<.5)return[0,0,0];
 let len=m[1]>1.5?.222:.238,u=m[3],t=A.clamp(p[2]/len+.5),q=A.clamp(m[2],0,1);
 let b=A.clamp(band(p,seed,6*scale,.0012),-1,1),mid=A.clamp(band(p,seed,26*scale,.0012),-1,1),pores=smooth(.56,.67,band(p,seed,80*scale,.0012));
 let under=A.clamp(band(p,seed,18*scale,.0015),-1,1),underPores=smooth(.60,.73,band(p,seed,58*scale,.0011)),sideField=A.clamp(band(p,seed,11*scale,.012),-1,1);
 let topW=1-smooth(.34,.84,q),bottomW=smooth(.60,.90,q),rear=smooth(.86,1,t),back=1-rear,bottomBack=1-.70*rear,bodyBack=back*(1-bottomW)+bottomBack*bottomW;
 let supportTop=1-.55*smooth(.80,.96,Math.abs(u))*smooth(.20,.35,t)*(1-smooth(.65,.80,t));
 let seat=smooth(.72,.92,Math.abs(u))*smooth(.18,.30,t)*(1-smooth(.70,.84,t)),supportBottom=1-.78*seat,bodySupport=supportTop*(1-bottomW)+supportBottom*bottomW;
 let bodyDy=strength*(.00140*b+.00055*mid)*bodyBack*bodySupport,topDy=strength*(.00100*b+.00045*mid-.00220*pores)*topW*back*supportTop,underDy=strength*(.00022*b+.00028*under-.00055*underPores)*bottomW*bottomBack*supportBottom;
 let dy=A.clamp(bodyDy+topDy+underDy,-.0045,.0035);
 if(m[1]<1.5)dy-=Math.max(dy,0)*smooth(.35,.50,Math.abs(u));else dy+=Math.max(-dy,0)*smooth(.50,.70,Math.abs(u));
 let wall=16*q*q*(1-q)*(1-q),through=.28+.72*wall,sideCarrier=smooth(.90,.985,Math.abs(u));
 let dx=Math.sign(u)*strength*(.00026*sideField-.00042*pores+.00014*under)*through*sideCarrier;
 let notch=smooth(-.35,.55,band(p,seed,8*scale,.018)),front=1-smooth(.025,.16,t),rearLip=smooth(.88,.98,t),lip=1-smooth(.35,.50,Math.abs(u));
 let dz=strength*(.00025+.0020*notch)*topW*front*lip;
 dz+=strength*(.00010+.00075*notch)*bottomW*front*lip;
 dz+=strength*.00022*sideField*through*(front+.20*rearLip);
 dz+=strength*.00055*pores*through*front;
 return[dx,dy,dz]
}'''
qa, count = re.subn(r"function micro\(p,m,seed,strength,scale\)\{[\s\S]*?return\[dx,dy,dz\]\}", js_micro, qa, count=1)
if count != 1:
    raise RuntimeError("CPU micro mirror not replaced")

metrics_block = r'''const results=[],checks=[];let maxOffset=0,flips=0;
function mesh(kind,sid,strength,scale){
 const g=A.ceramic(kind),original=Array.from(g.p),stats={topMicroMaxMm:0,sideMicroMaxMm:0,bottomMicroMaxMm:0,topTotalMaxMm:0,sideTotalMaxMm:0,bottomTotalMaxMm:0};
 for(let i=0;i<g.p.length/3;i++){
  const p=original.slice(i*3,i*3+3),m=Array.from(g.meta.slice(i*4,i*4+4)),o=micro(p,m,sid,strength,scale),b=hand(p,m,sid),total=o.map((v,k)=>v+b[k]);
  maxOffset=Math.max(maxOffset,Math.hypot(...o));
  const q=A.clamp(m[2],0,1),bucket=q<=.05?'top':q>=.95?'bottom':'side',microMm=Math.hypot(...o)*1000,totalMm=Math.hypot(...total)*1000;
  stats[bucket+'MicroMaxMm']=Math.max(stats[bucket+'MicroMaxMm'],microMm);stats[bucket+'TotalMaxMm']=Math.max(stats[bucket+'TotalMaxMm'],totalMm);
  g.p.set(p.map((v,k)=>v+total[k]),i*3);
 }
 g._offsetStats=stats;return g;
}

const report={version:'08F',method:'CPU double precision mirror of the actual 08F full-shell field; contacts use projected triangle intersections. Shape-presence metrics distinguish Microscope displacement from combined handmade+Microscope displacement.',contacts:[],shapeEvidence:[],visualApproved:false,productionApproved:false};'''
qa, count = re.subn(r"const results=\[\],checks=\[\];let maxOffset=0,bottomMax=0,flips=0;[\s\S]*?const report=\{version:'08E',[^\n]+\};", metrics_block, qa, count=1)
if count != 1:
    raise RuntimeError("QA metrics block not replaced")
qa = qa.replace("for(const strength of [0,1.6,3]){const pan=mesh('pan',sid(314159),strength,1),cover=mesh('cover',sid(314548),strength,1);", "for(const strength of [0,1.6,3]){const pan=mesh('pan',sid(314159),strength,1),cover=mesh('cover',sid(314548),strength,1);report.shapeEvidence.push({strength,pan:pan._offsetStats,cover:cover._offsetStats});", 1)
qa = qa.replace("report.contactPassed=report.contacts.every(x=>x.pass);report.maxOffsetMm=maxOffset*1000;report.bottomOffsetMm=bottomMax*1000;", "report.contactPassed=report.contacts.every(x=>x.pass);report.maxOffsetMm=maxOffset*1000;report.bottomOffsetMm=Math.max(...report.shapeEvidence.map(x=>Math.max(x.pan.bottomMicroMaxMm,x.cover.bottomMicroMaxMm)));report.bottomMicroZeroLegacyStatus='not_applicable_after_user_full_shell_goal_2026-09-14';report.shellFieldPresent=report.shapeEvidence.filter(x=>x.strength>0).every(x=>x.pan.bottomMicroMaxMm>1e-6&&x.pan.sideMicroMaxMm>1e-6&&x.cover.bottomMicroMaxMm>1e-6&&x.cover.sideMicroMaxMm>1e-6);", 1)
(HERE / "qa_geometry.cjs").write_text(qa, encoding="utf-8", newline="")

# Reuse the established contact relation evaluator and rigid-seat solver; only the geometry mirror/version changes.
shutil.copyfile(SRC / "contact-lib.cjs", HERE / "contact-lib.cjs")
for name in ["calibrate_seats_v2.cjs", "qa_matrix.cjs"]:
    text = (SRC / name).read_text(encoding="utf-8").replace("'08E'", "'08F'").replace("actual 08E", "actual 08F")
    (HERE / name).write_text(text, encoding="utf-8", newline="")

reference = json.loads((HERE / "REFERENCE_DISTILLATION_2026-09-14.json").read_text(encoding="utf-8"))
report = {
    "version": "08F",
    "sourceVersion": "08E",
    "scope": "final closeout candidate: preserve accepted top-face character, extend actual geometry continuously to side/edge/underside, widen procedural colour families from the supplied scan, then re-run retained contact constraints",
    "referencePackage": reference["package"],
    "referenceFiles": reference["referenceFiles"],
    "historicalChecks": {
        "08D_bottomMicroscopeZero": "not_applicable_to_current_user_goal",
        "08E_contactRelations": "retain_and_re_run",
        "08E_54_relation_matrix": "prior_execution_evidence_only_not_new_goal_completion"
    },
    "amplitudeStatus": "authored_design_controls_not_direct_scan_measurements",
    "sourceHtmlSha256": hashlib.sha256((SRC / "START_HERE.html").read_bytes()).hexdigest(),
    "outputHtmlSha256": hashlib.sha256(out_html.read_bytes()).hexdigest(),
    "contactPassed": False,
    "expandedMatrixPassed": False,
    "shellFieldPresent": False,
    "visualApproved": False,
    "productionApproved": False
}
(HERE / "BUILD_QA.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
