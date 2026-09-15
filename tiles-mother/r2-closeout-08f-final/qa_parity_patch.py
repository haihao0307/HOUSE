from pathlib import Path
import json
import re

root = Path(__file__).resolve().parent

# 08F.2 GPU field is authored in shape.glsl. Patch the generated CPU mirror to the exact same equations,
# then assert that no old face-specific field remains.
p = root / "qa_geometry.cjs"
text = p.read_text(encoding="utf-8")
old = re.compile(r"function micro\(p,m,seed,strength,scale\)\{[\s\S]*?return\[dx,dy,dz\]\n\}")
new = r'''function micro(p,m,seed,strength,scale){
 if(!strength||m[1]<.5)return[0,0,0];
 let len=m[1]>1.5?.222:.238,u=m[3],t=A.clamp(p[2]/len+.5),q=A.clamp(m[2],0,1);
 strength=Math.min(strength,3.6);
 let b=A.clamp(band(p,seed,6*scale,.0012),-1,1),mid=A.clamp(band(p,seed,26*scale,.0012),-1,1),pores=smooth(.56,.67,band(p,seed,80*scale,.0012));
 let shellValue=.00150*b+.00062*mid-.00138*pores,rawShell=A.clamp(strength*shellValue,-.0048,.0042);
 let isCover=m[1]>=1.5?1:0,isPan=1-isCover,topW=1-smooth(.12,.36,q),bottomW=smooth(.64,.88,q);
 let panTopBearing=isPan*topW*smooth(.46,.62,Math.abs(u)),panBottomBearing=isPan*bottomW*smooth(.58,.76,Math.abs(u));
 let coverLeftBearing=isCover*bottomW*smooth(.82,.96,-u),coverRightBearing=isCover*bottomW*(1-smooth(.045,.12,Math.abs(u-.075))),coverBottomBearing=Math.max(coverLeftBearing,coverRightBearing);
 let contactPatch=Math.max(panTopBearing,panBottomBearing,coverBottomBearing),contactFree=1-.9998*A.clamp(contactPatch,0,1),dy=rawShell*contactFree;
 let coverRearOverlap=isCover*smooth(.72,.82,t);dy*=1-.998*coverRearOverlap;
 let wall=16*q*q*(1-q)*(1-q),sideCarrier=smooth(.58,.96,Math.abs(u));
 let dx=Math.sign(u)*rawShell*(.36+.24*wall)*sideCarrier*contactFree;
 let front=1-smooth(.025,.18,t),rearLip=smooth(.82,.98,t),cornerCarry=.42+.58*(1-smooth(.58,.94,Math.abs(u)));
 let dz=rawShell*(front+.28*rearLip)*cornerCarry*(.34+.30*wall)*contactFree;
 return[dx,dy,dz]
}'''
text, count = old.subn(new, text, count=1)
if count != 1:
    raise SystemExit(f"08F.2 CPU micro replacement expected one function, got {count}")
text = text.replace("for(const strength of [0,3,4.2])", "for(const strength of [0,3,3.6])")
text = text.replace("version:'08F.1'", "version:'08F.2'")
required = [
    "rawShell=A.clamp(strength*shellValue,-.0048,.0042)",
    "panTopBearing=isPan*topW*smooth(.46,.62,Math.abs(u))",
    "panBottomBearing=isPan*bottomW*smooth(.58,.76,Math.abs(u))",
    "coverLeftBearing=isCover*bottomW*smooth(.82,.96,-u)",
    "coverRightBearing=isCover*bottomW*(1-smooth(.045,.12,Math.abs(u-.075)))",
    "contactFree=1-.9998*A.clamp(contactPatch,0,1)",
    "Math.min(strength,3.6)",
]
for marker in required:
    if text.count(marker) != 1:
        raise SystemExit(f"08F.2 CPU/GPU parity marker missing or duplicated: {marker}")
for obsolete in ["underPores", "sideField=A.clamp", "bodyDy=strength", "topDy=strength", "underDy=strength", "coverBottomBearing=isCover*bottomW*smooth(.32,.54"]:
    if obsolete in text:
        raise SystemExit(f"08F.2 still contains obsolete split or broad cover-bearing geometry state: {obsolete}")
p.write_text(text, encoding="utf-8", newline="")
print("08F.2 CPU mirror synchronized: one rawShell drives the whole shell; two measured cover underside seats remain rigid")

# Bring the full retained matrix and seat calibration onto the same user-middle envelope.
for name in ["qa_matrix.cjs", "calibrate_seats_v2.cjs"]:
    fp = root / name
    data = fp.read_text(encoding="utf-8")
    data = data.replace("[0,3,4.2]", "[0,3,3.6]")
    data = data.replace("stronger 4.2", "stronger 3.6")
    data = data.replace("08F.1", "08F.2")
    fp.write_text(data, encoding="utf-8", newline="")

# The 08E fragment already defines kilnDelta immediately before the replaced colour block.
# Reuse that declaration so real GLSL compilation succeeds, and materialize the middle/weak/strong UI.
hp = root / "START_HERE.html"
html = hp.read_text(encoding="utf-8")
marker = "   float kilnDelta=(tint-.5)*uColor.z;"
count = html.count(marker)
if count != 2:
    raise SystemExit(f"08F.2 colour compile patch expected exactly two kilnDelta declarations, got {count}")
html = html.replace(marker, "", 1)
html = html.replace("08F.1", "08F.2")
html, max_count = re.subn(r'(<input id="micStrength"[^>]*\bmax=")[^"]+("[^>]*>)', r'\g<1>3.6\2', html, count=1)
if max_count != 1:
    raise SystemExit("08F.2 micStrength maximum not patched")
html = html.replace('<button data-shape="4.2">较强</button>', '<button data-shape="3.6">较强</button>')
hp.write_text(html, encoding="utf-8", newline="")
print("08F.2 fragment/UI patch: middle 3.0 retained; stronger state bounded at 3.6")

# Keep build evidence explicit: amplitudes remain authored controls and approval remains with the user.
bp = root / "BUILD_QA.json"
if bp.exists():
    report = json.loads(bp.read_text(encoding="utf-8"))
    report["version"] = "08F.2"
    report["testedStrengthEnvelope"] = [0.0, 3.0, 3.6]
    report["singleFieldContinuity"] = True
    report["visualApproved"] = False
    report["productionApproved"] = False
    bp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
