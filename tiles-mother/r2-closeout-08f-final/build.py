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

# Scan evidence widens the palette only. Do not inject orientation-specific colour states:
# top, side and underside are the same ceramic field and lighting is allowed to separate them naturally.
color_block = r'''// 08F.1 scan-guided palette breadth. The photogrammetry diffuse contains lighting/shadow;
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


replace_once("<title>Tiles Mother · R2 收尾候选 08E</title>", "<title>Tiles Mother · R2 收尾候选 08F.1</title>")
replace_once("<small>08E · 08D 外观基线 / 接触校正</small>", "<small>08F.1 · 同场连续壳体 / 用户中值</small>")
replace_once("<div class=\"tiny\">08E 接触校正版 · 08D 外观基线保持</div>", "<div class=\"tiny\">08F.1 收尾候选 · 正/侧/背面同一连续依据</div>")
replace_once("Yohei Microscope · 17级公式。真实面起伏、边口缺凹与有底气孔；底面保持。", "Yohei Microscope · 17级公式。正面、侧壁、边口与背面只使用同一稳定形态场；仅真实承托带受结构保护。")
replace_once("讲武堂资料中的暖灰、灰褐与少量冷灰，保留原灰青基调。", "讲武堂精细扫描显示灰白、暖灰褐、冷灰与少量土赭并存；正/侧/背同一材质状态，只蒸馏色族关系。")
replace_once("08A 主体与尺寸保持。Microscope 同时驱动微形态与现有 PBR；不叠加旧刻线。", "08E 装配与尺寸关系保持。当前用户屋面参数作为中值，可向较弱/较强两侧调整。")

# Side wall geometry: richer through-thickness bands, still one shared mesh for all roof instances.
replace_once("bands=detail>40?[0,.05,.10,.14,.22,.32,.42,.5,.58,.68,.78,.86,.90,.95,1]:[0,.14,.5,.86,1]", "bands=[0,.04,.08,.12,.18,.28,.40,.5,.60,.72,.82,.88,.92,.96,1]")
# Non-cut side walls are the same ceramic skin as top/underside; only fracture cuts expose core.
replace_once("G.vertex(point(u,v,q),cut?0:.78,tag,q,u)", "G.vertex(point(u,v,q),cut?0:1,tag,q,u)")

# User-approved roof48/roof860 settings become the middle reference, not the upper limit.
for element_id, value, output in [
    ("micStrength", "3", "3.00×"),
    ("micScale", "0.5", "0.50×"),
    ("micColor", "1", "1.00"),
    ("brightness", "0.78", "78%"),
    ("variation", "1.5", "150%"),
    ("warmth", "1.5", "150%"),
    ("patina", "1", "100%"),
    ("wet", ".30", "30%"),
    ("moss", "1.5", "150%"),
    ("core", "0.56", "56%"),
]:
    set_input_value(element_id, value)
    set_output(element_id + "Val", output)

# Give the accepted middle room in both directions.
html = html.replace('id="micStrength" type="range" min="0" max="3" step="0.05"', 'id="micStrength" type="range" min="0" max="4.5" step="0.05"', 1)
html = html.replace('id="micScale" type="range" min="0.5" max="3" step="0.05"', 'id="micScale" type="range" min="0.25" max="1.5" step="0.05"', 1)
html = html.replace('id="micColor" type="range" min="0" max="1" step="0.01"', 'id="micColor" type="range" min="0" max="1.5" step="0.01"', 1)
html = html.replace('id="variation" type="range" min="0" max="1.5" step="0.05"', 'id="variation" type="range" min="0" max="2.25" step="0.05"', 1)
html = html.replace('id="warmth" type="range" min="0" max="1.5" step=".05"', 'id="warmth" type="range" min="0" max="2.25" step=".05"', 1)
html = html.replace('id="patina" type="range" min="0" max="1" step=".05"', 'id="patina" type="range" min="0" max="1.5" step=".05"', 1)
html = html.replace('id="moss" type="range" min="0" max="1.5" step=".1"', 'id="moss" type="range" min="0" max="2.25" step=".1"', 1)
html = html.replace('<button data-shape="0">关闭对照</button><button data-shape="1.6">默认形态</button><button data-shape="3">增强形态</button>', '<button data-shape="1.8">较弱</button><button data-shape="3">中值</button><button data-shape="4.2">较强</button>', 1)
html = html.replace('切换仅改变起伏强度，保留镜头、种子和色彩。', '较弱/中值/较强只改变起伏强度；中值即本轮用户确认的屋面参数。', 1)

settings_pattern = r"const settings=\{scene:'pan',[^\n]+\};"
settings_new = "const settings={scene:'pan',seed:314159,year:0,care:false,relief:.76,warmth:1.5,patina:1,wet:.30,moss:1.5,mossHeight:.82,brightness:.78,variation:1.5,core:.56,twist:.92,r2:.24,finish:.72,fracture:0,diagnostic:0,micStrength:3,micScale:.5,micColor:1,micRough:.30};"
html, count = re.subn(settings_pattern, settings_new, html, count=1)
if count != 1:
    raise RuntimeError("settings object not updated")

html = html.replace("const MIC_DEFAULTS=Object.freeze({micStrength:1.6,micScale:1,micColor:.30,micRough:.30});", "const MIC_DEFAULTS=Object.freeze({micStrength:3,micScale:.5,micColor:1,micRough:.30});", 1)
html = html.replace("let lastMicStrength=1.6;", "let lastMicStrength=3;", 1)
html = html.replace("lastMicStrength||1", "lastMicStrength||3", 1)
html = html.replace("lastMicStrength=1.6", "lastMicStrength=3", 1)
html = html.replace("let lastPbrColor=.30;", "let lastPbrColor=1;", 1)
html = html.replace("lastPbrColor||.3", "lastPbrColor||1", 1)
html = html.replace("option('micColor',.3);option('micRough',.3)", "option('micColor',1);option('micRough',.3)", 1)
html = html.replace("Tiles 08D · ", "Tiles 08F.1 · ")
html = html.replace("version:'r2-closeout-08D-microshape-pbr'", "version:'r2-closeout-08F1-unified-shell-user-mid'")
html = html.replace("version:'R2-closeout-08D-microshape-pbr'", "version:'R2-closeout-08F1-unified-shell-user-mid'")
html = html.replace("surface:'Yohei Microscope 17-scale field -> existing tile PBR'", "surface:'one Yohei Microscope 17-scale field -> top/side/underside unified shell -> scan-guided procedural colour families'")
html = html.replace("preset==='neutral'?{brightness:.96,variation:.62,patina:.38,warmth:.36}", "preset==='neutral'?{brightness:.78,variation:1.5,patina:1,warmth:1.5}", 1)
html = html.replace("{brightness:.96,variation:.58,patina:.38,warmth:.36,relief:.76,core:.48,twist:.92,r2:.24,wet:0,moss:.22,mossHeight:.82}", "{brightness:.78,variation:1.5,patina:1,warmth:1.5,relief:.76,core:.56,twist:.92,r2:.24,wet:.30,moss:1.5,mossHeight:.82}", 1)

out_html = HERE / "START_HERE.html"
out_html.write_text(html, encoding="utf-8", newline="")

# CPU mirror of exactly the same unified 08F.1 field.
qa = (SRC / "qa_geometry.cjs").read_text(encoding="utf-8")
js_micro = r'''function micro(p,m,seed,strength,scale){
 if(!strength||m[1]<.5)return[0,0,0];
 let len=m[1]>1.5?.222:.238,u=m[3],t=A.clamp(p[2]/len+.5),q=A.clamp(m[2],0,1);
 strength=Math.min(strength,4.5);
 let b=A.clamp(band(p,seed,6*scale,.0012),-1,1),mid=A.clamp(band(p,seed,26*scale,.0012),-1,1),pores=smooth(.56,.67,band(p,seed,80*scale,.0012));
 let common=.00150*b+.00062*mid-.00138*pores,rearCarrier=1-.34*smooth(.88,1,t),dy=A.clamp(strength*common*rearCarrier,-.0048,.0042);
 let bottomW=smooth(.78,.98,q),seatRail=bottomW*smooth(.58,.76,Math.abs(u));dy*=1-.994*seatRail;
 let panBearing=(m[1]<1.5?1:0)*(1-bottomW)*smooth(.72,.88,Math.abs(u)),coverBearing=(m[1]>=1.5?1:0)*bottomW*(1-smooth(.22,.44,Math.abs(u))),bearingGuard=Math.max(panBearing,coverBearing);dy*=1-.997*bearingGuard;
 let wall=16*q*q*(1-q)*(1-q),through=.42+.58*wall,sideCarrier=smooth(.72,.985,Math.abs(u));
 let dx=Math.sign(u)*strength*(.00042*b+.00018*mid-.00030*pores)*through*sideCarrier;
 let front=1-smooth(.025,.16,t),rearLip=smooth(.88,.98,t),cornerCarry=.34+.66*(1-smooth(.72,.96,Math.abs(u))),edgeField=.00034*b+.00015*mid-.00024*pores;
 let dz=strength*edgeField*(front+.24*rearLip)*cornerCarry*(.46+.54*wall);
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

const report={version:'08F.1',method:'CPU double precision mirror of the unified 08F.1 full-shell field; one stable field drives top, side and underside. Contacts use projected triangle intersections.',contacts:[],shapeEvidence:[],visualApproved:false,productionApproved:false};'''
qa, count = re.subn(r"const results=\[\],checks=\[\];let maxOffset=0,bottomMax=0,flips=0;[\s\S]*?const report=\{version:'08E',[^\n]+\};", metrics_block, qa, count=1)
if count != 1:
    raise RuntimeError("QA metrics block not replaced")
qa = qa.replace("for(const strength of [0,1.6,3]){const pan=mesh('pan',sid(314159),strength,1),cover=mesh('cover',sid(314548),strength,1);", "for(const strength of [0,3,4.2]){const pan=mesh('pan',sid(314159),strength,.5),cover=mesh('cover',sid(314548),strength,.5);report.shapeEvidence.push({strength,scale:.5,pan:pan._offsetStats,cover:cover._offsetStats});", 1)
qa = qa.replace("report.contactPassed=report.contacts.every(x=>x.pass);report.maxOffsetMm=maxOffset*1000;report.bottomOffsetMm=bottomMax*1000;", "report.contactPassed=report.contacts.every(x=>x.pass);report.maxOffsetMm=maxOffset*1000;report.bottomOffsetMm=Math.max(...report.shapeEvidence.map(x=>Math.max(x.pan.bottomMicroMaxMm,x.cover.bottomMicroMaxMm)));report.bottomMicroZeroLegacyStatus='not_applicable_after_user_full_shell_goal_2026-09-14';report.shellFieldPresent=report.shapeEvidence.filter(x=>x.strength>0).every(x=>x.pan.bottomMicroMaxMm>1e-6&&x.pan.sideMicroMaxMm>1e-6&&x.cover.bottomMicroMaxMm>1e-6&&x.cover.sideMicroMaxMm>1e-6);", 1)
(HERE / "qa_geometry.cjs").write_text(qa, encoding="utf-8", newline="")

# Reuse established contact evaluator and rigid-seat solver, but make them target the new strength/scale envelope.
shutil.copyfile(SRC / "contact-lib.cjs", HERE / "contact-lib.cjs")
for name in ["calibrate_seats_v2.cjs", "qa_matrix.cjs"]:
    text = (SRC / name).read_text(encoding="utf-8").replace("'08E'", "'08F.1'").replace("actual 08E", "actual 08F.1")
    text = text.replace("for(const strength of [0,1.6,3])", "for(const strength of [0,3,4.2])")
    if name == "qa_matrix.cjs":
        text = text.replace("const strengths=[0,1.6,3];", "const strengths=[0,3,4.2];")
        text = text.replace("strength,1)", "strength,.5)")
        text = text.replace("three Microscope strengths", "user-middle envelope: off, middle 3.0 and stronger 4.2 at scale 0.5")
    (HERE / name).write_text(text, encoding="utf-8", newline="")

reference = json.loads((HERE / "REFERENCE_DISTILLATION_2026-09-14.json").read_text(encoding="utf-8"))
report = {
    "version": "08F.1",
    "sourceVersion": "08E",
    "scope": "final continuity closeout: preserve accepted roof appearance, use the user's roof48/860 settings as the middle reference, unify top/side/underside under one geometry field, soften side-wall/corner construction, and retain contact constraints",
    "referencePackage": reference["package"],
    "referenceFiles": reference["referenceFiles"],
    "userMiddleDefaults": {"micStrength":3.0,"micScale":0.5,"micColor":1.0,"brightness":0.78,"variation":1.5,"warmth":1.5,"patina":1.0,"wet":0.30,"moss":1.5},
    "historicalChecks": {
        "08D_bottomMicroscopeZero": "not_applicable_to_current_user_goal",
        "08E_contactRelations": "retain_and_re_run",
        "08F_54_relation_matrix": "prior_execution_evidence_only_not_new_goal_completion"
    },
    "amplitudeStatus": "authored_design_controls_not_direct_scan_measurements",
    "sourceHtmlSha256": hashlib.sha256((SRC / "START_HERE.html").read_bytes()).hexdigest(),
    "outputHtmlSha256": hashlib.sha256(out_html.read_bytes()).hexdigest(),
    "contactPassed": False,
    "expandedMatrixPassed": False,
    "shellFieldPresent": False,
    "singleFieldContinuity": True,
    "visualApproved": False,
    "productionApproved": False
}
(HERE / "BUILD_QA.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
