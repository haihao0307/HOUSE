from pathlib import Path

root = Path(__file__).resolve().parent

# Synchronize the CPU contact mirror with the current 08F.1 one-field shader.
p = root / "qa_geometry.cjs"
text = p.read_text(encoding="utf-8")

old_block = "let common=.00150*b+.00062*mid-.00138*pores,rearCarrier=1-.34*smooth(.88,1,t),dy=A.clamp(strength*common*rearCarrier,-.0048,.0042);\n let bottomW=smooth(.78,.98,q),seatRail=bottomW*smooth(.58,.76,Math.abs(u));dy*=1-.994*seatRail;\n let panBearing=(m[1]<1.5?1:0)*(1-bottomW)*smooth(.72,.88,Math.abs(u)),coverBearing=(m[1]>=1.5?1:0)*bottomW*(1-smooth(.22,.44,Math.abs(u))),bearingGuard=Math.max(panBearing,coverBearing);dy*=1-.997*bearingGuard;"
new_block = "let common=.00150*b+.00062*mid-.00138*pores,dy=A.clamp(strength*common,-.0048,.0042);\n let frontOverlap=1-smooth(.16,.28,t),rearOverlap=smooth(.74,.86,t),overlapGuard=Math.max(frontOverlap,rearOverlap);dy*=1-.9995*overlapGuard;\n let bottomW=smooth(.78,.98,q),seatRail=bottomW*smooth(.52,.70,Math.abs(u));dy*=1-.9998*seatRail;\n let coverFlank=(m[1]>=1.5?1:0)*bottomW*smooth(.60,.74,Math.abs(u));dy*=1-.9995*coverFlank;"
count = text.count(old_block)
if count != 1:
    raise SystemExit(f"08F.1 parity patch expected one old structural block, got {count}")
text = text.replace(old_block, new_block, 1)

replacements = [
    ("strength=Math.min(strength,4.5);", "strength=Math.min(strength,3.3);"),
    ("sideCarrier=smooth(.72,.985,Math.abs(u))", "sideCarrier=smooth(.68,.985,Math.abs(u))"),
    ("let dx=Math.sign(u)*strength*(.00042*b+.00018*mid-.00030*pores)*through*sideCarrier;", "let dx=Math.sign(u)*strength*(.00040*b+.00018*mid-.00027*pores)*through*sideCarrier;dx*=1-.985*seatRail;"),
    ("rearLip=smooth(.88,.98,t)", "rearLip=smooth(.84,.98,t)"),
    ("cornerCarry=.34+.66*(1-smooth(.72,.96,Math.abs(u)))", "cornerCarry=.38+.62*(1-smooth(.70,.96,Math.abs(u)))"),
    ("edgeField=.00034*b+.00015*mid-.00024*pores", "edgeField=.00031*b+.00015*mid-.00021*pores"),
    ("(front+.24*rearLip)", "(front+.05*rearLip)"),
    ("for(const strength of [0,3,4.2])", "for(const strength of [0,3,3.3])"),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"08F.1 parity patch expected one CPU marker, got {count}: {old}")
    text = text.replace(old, new, 1)

required = [
    "let common=.00150*b+.00062*mid-.00138*pores",
    "frontOverlap=1-smooth(.16,.28,t)",
    "rearOverlap=smooth(.74,.86,t)",
    "seatRail=bottomW*smooth(.52,.70,Math.abs(u))",
    "coverFlank=(m[1]>=1.5?1:0)*bottomW*smooth(.60,.74,Math.abs(u))",
    "dx*=1-.985*seatRail",
    "edgeField=.00031*b+.00015*mid-.00021*pores",
]
for marker in required:
    if text.count(marker) != 1:
        raise SystemExit(f"08F.1 CPU/GPU parity marker missing or duplicated: {marker}")
for obsolete in ["underPores", "sideField=A.clamp", "bodyDy=strength", "topDy=strength", "underDy=strength", "panBearing=", "coverBearing=", "bearingGuard="]:
    if obsolete in text:
        raise SystemExit(f"08F.1 still contains obsolete face-specific geometry state: {obsolete}")

p.write_text(text, encoding="utf-8", newline="")
print("08F.1 CPU mirror synchronized: one field + overlap/rafter/cover-flank structural guards")

# Official weaker/middle/stronger envelope: 2.2 / 3.0 / 3.3. Middle is the user's screenshot state.
for name in ["calibrate_seats_v2.cjs", "qa_matrix.cjs"]:
    fp = root / name
    s = fp.read_text(encoding="utf-8")
    s = s.replace("[0,3,4.2]", "[0,3,3.3]")
    s = s.replace("stronger 4.2", "stronger 3.3")
    fp.write_text(s, encoding="utf-8", newline="")

# Reuse the existing kilnDelta declaration so real GLSL compilation succeeds, then set the public envelope.
hp = root / "START_HERE.html"
html = hp.read_text(encoding="utf-8")
marker = "   float kilnDelta=(tint-.5)*uColor.z;"
count = html.count(marker)
if count != 2:
    raise SystemExit(f"08F.1 colour compile patch expected exactly two kilnDelta declarations, got {count}")
html = html.replace(marker, "", 1)
html = html.replace('id="micStrength" type="range" min="0" max="4.5"', 'id="micStrength" type="range" min="0" max="3.3"', 1)
html = html.replace('<button data-shape="1.8">较弱</button><button data-shape="3">中值</button><button data-shape="4.2">较强</button>', '<button data-shape="2.2">较弱</button><button data-shape="3">中值</button><button data-shape="3.3">较强</button>', 1)
hp.write_text(html, encoding="utf-8", newline="")
print("08F.1 public envelope: weaker 2.2 / user middle 3.0 / stronger 3.3")
