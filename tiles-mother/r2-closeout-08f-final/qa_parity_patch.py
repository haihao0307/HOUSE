from pathlib import Path

root = Path(__file__).resolve().parent

# 08F.1 CPU mirror is authored from the same one-field equations as shape.glsl.
# Patch only structural carrier constants so QA stays identical to the current shader.
p = root / "qa_geometry.cjs"
text = p.read_text(encoding="utf-8")
replacements = [
    ("rearCarrier=1-.34*smooth(.88,1,t)", "rearCarrier=1-.94*smooth(.82,.98,t)"),
    ("dy*=1-.994*seatRail", "dy*=1-.9998*seatRail"),
    ("panBearing=(m[1]<1.5?1:0)*(1-bottomW)*smooth(.72,.88,Math.abs(u)),coverBearing=(m[1]>=1.5?1:0)*bottomW*(1-smooth(.22,.44,Math.abs(u)))", "panBearing=(m[1]<1.5?1:0)*(1-bottomW)*smooth(.44,.58,Math.abs(u))*(1-smooth(.92,.985,Math.abs(u))),coverBearing=(m[1]>=1.5?1:0)*bottomW*smooth(.52,.66,Math.abs(u))"),
    ("dy*=1-.997*bearingGuard", "dy*=1-.9995*bearingGuard"),
    ("rearLip=smooth(.88,.98,t)", "rearLip=smooth(.84,.98,t)"),
    ("(front+.24*rearLip)", "(front+.04*rearLip)"),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"08F.1 parity patch expected one CPU marker, got {count}: {old}")
    text = text.replace(old, new, 1)

required = [
    "let common=.00150*b+.00062*mid-.00138*pores",
    "seatRail=bottomW*smooth(.58,.76,Math.abs(u))",
    "panBearing=(m[1]<1.5?1:0)*(1-bottomW)*smooth(.44,.58,Math.abs(u))",
    "edgeField=.00034*b+.00015*mid-.00024*pores",
]
for marker in required:
    if text.count(marker) != 1:
        raise SystemExit(f"08F.1 CPU/GPU parity marker missing or duplicated: {marker}")
for obsolete in ["underPores", "sideField=A.clamp", "bodyDy=strength", "topDy=strength", "underDy=strength"]:
    if obsolete in text:
        raise SystemExit(f"08F.1 still contains obsolete face-specific geometry state: {obsolete}")

p.write_text(text, encoding="utf-8", newline="")
print("08F.1 CPU mirror synchronized: one field + real bearing/overlap carriers")

# The 08E fragment already defines kilnDelta immediately before the replaced colour block.
# Reuse that declaration so real GLSL compilation succeeds.
hp = root / "START_HERE.html"
html = hp.read_text(encoding="utf-8")
marker = "   float kilnDelta=(tint-.5)*uColor.z;"
count = html.count(marker)
if count != 2:
    raise SystemExit(f"08F.1 colour compile patch expected exactly two kilnDelta declarations, got {count}")
html = html.replace(marker, "", 1)
hp.write_text(html, encoding="utf-8", newline="")
print("08F.1 fragment compile patch: reused existing kilnDelta declaration")
