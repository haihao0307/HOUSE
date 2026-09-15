from pathlib import Path
import re

root = Path(__file__).resolve().parent

# 08F.2 GPU field is authored in shape.glsl. Patch the generated CPU mirror to the same equations,
# then assert that no old face-specific field remains.
p = root / "qa_geometry.cjs"
text = p.read_text(encoding="utf-8")
old = re.compile(r"function micro\(p,m,seed,strength,scale\)\{[\s\S]*?return\[dx,dy,dz\]\n\}")
new = r'''function micro(p,m,seed,strength,scale){
 if(!strength||m[1]<.5)return[0,0,0];
 let len=m[1]>1.5?.222:.238,u=m[3],t=A.clamp(p[2]/len+.5),q=A.clamp(m[2],0,1);
 strength=Math.min(strength,4.5);
 let b=A.clamp(band(p,seed,6*scale,.0012),-1,1),mid=A.clamp(band(p,seed,26*scale,.0012),-1,1),pores=smooth(.56,.67,band(p,seed,80*scale,.0012));
 let common=.00150*b+.00062*mid-.00138*pores,rawShell=A.clamp(strength*common,-.0048,.0042),dy=rawShell;
 let bottomW=smooth(.78,.98,q),seatRail=bottomW*smooth(.40,.62,Math.abs(u));dy*=1-.9995*seatRail;
 let panBearing=(m[1]<1.5?1:0)*(1-bottomW)*smooth(.26,.52,Math.abs(u)),coverBearing=(m[1]>=1.5?1:0)*bottomW*(1-smooth(.28,.56,Math.abs(u))),bearingGuard=Math.max(panBearing,coverBearing);dy*=1-.9995*bearingGuard;
 let coverRearOverlap=(m[1]>=1.5?1:0)*smooth(.72,.82,t);dy*=1-.998*coverRearOverlap;
 let wall=16*q*q*(1-q)*(1-q),sideCarrier=smooth(.58,.96,Math.abs(u));
 let dx=Math.sign(u)*rawShell*(.36+.24*wall)*sideCarrier;
 let front=1-smooth(.025,.18,t),rearLip=smooth(.82,.98,t),cornerCarry=.42+.58*(1-smooth(.58,.94,Math.abs(u)));
 let dz=rawShell*(front+.28*rearLip)*cornerCarry*(.34+.30*wall);
 return[dx,dy,dz]
}'''
text, count = old.subn(new, text, count=1)
if count != 1:
    raise SystemExit(f"08F.2 CPU micro replacement expected one function, got {count}")
required = [
    "rawShell=A.clamp(strength*common,-.0048,.0042)",
    "seatRail=bottomW*smooth(.40,.62,Math.abs(u))",
    "smooth(.26,.52,Math.abs(u))",
    "coverRearOverlap=(m[1]>=1.5?1:0)*smooth(.72,.82,t)",
    "dx=Math.sign(u)*rawShell",
    "dz=rawShell*(front+.28*rearLip)",
]
for marker in required:
    if text.count(marker) != 1:
        raise SystemExit(f"08F.2 CPU/GPU parity marker missing or duplicated: {marker}")
for obsolete in ["underPores", "sideField=A.clamp", "bodyDy=strength", "topDy=strength", "underDy=strength", "rearCarrier=1-.34"]:
    if obsolete in text:
        raise SystemExit(f"08F.2 still contains obsolete split geometry state: {obsolete}")
p.write_text(text, encoding="utf-8", newline="")
print("08F.2 CPU mirror synchronized: one rawShell drives top/side/underside; only contact strips constrain vertical motion")

# The 08E fragment already defines kilnDelta immediately before the replaced colour block.
# Reuse that declaration so real GLSL compilation succeeds.
hp = root / "START_HERE.html"
html = hp.read_text(encoding="utf-8")
marker = "   float kilnDelta=(tint-.5)*uColor.z;"
count = html.count(marker)
if count != 2:
    raise SystemExit(f"08F.2 colour compile patch expected exactly two kilnDelta declarations, got {count}")
html = html.replace(marker, "", 1)
html = html.replace("08F.1", "08F.2")
hp.write_text(html, encoding="utf-8", newline="")
print("08F.2 fragment compile patch: reused existing kilnDelta declaration")
