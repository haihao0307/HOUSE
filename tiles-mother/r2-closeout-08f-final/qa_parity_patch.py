from pathlib import Path

root = Path(__file__).resolve().parent

# Keep the CPU contact mirror synchronized with the actual 08F full-shell shader.
p = root / "qa_geometry.cjs"
text = p.read_text(encoding="utf-8")

old_support = "let seat=smooth(.72,.92,Math.abs(u))*smooth(.18,.30,t)*(1-smooth(.70,.84,t)),supportBottom=1-.78*seat,bodySupport=supportTop*(1-bottomW)+supportBottom*bottomW;"
new_support = "let seatRail=smooth(.55,.75,Math.abs(u)),supportBottom=1-.995*seatRail,bodySupport=supportTop*(1-bottomW)+supportBottom*bottomW;"
count = text.count(old_support)
if count != 1:
    raise SystemExit(f"08F CPU/GPU parity patch expected one legacy underside support expression, got {count}")
text = text.replace(old_support, new_support, 1)

old_dy = "let dy=A.clamp(bodyDy+topDy+underDy,-.0045,.0035);"
new_dy = old_dy + "let panBearing=(m[1]<1.5?1:0)*(1-bottomW)*smooth(.68,.86,Math.abs(u)),coverBearing=(m[1]>=1.5?1:0)*bottomW*(1-smooth(.24,.46,Math.abs(u))),bearingGuard=Math.max(panBearing,coverBearing);dy*=1-.997*bearingGuard;"
count = text.count(old_dy)
if count != 1:
    raise SystemExit(f"08F CPU/GPU parity patch expected one vertical dy expression, got {count}")
text = text.replace(old_dy, new_dy, 1)

p.write_text(text, encoding="utf-8", newline="")
print("08F CPU mirror synchronized: rafter rails + pan/cover bearing strips")

# The 08E fragment already defines kilnDelta immediately before the replaced colour block.
# 08F's scan-guided block must reuse that value rather than redeclare it; otherwise real GLSL compilation fails
# even though JavaScript syntax checking passes.
hp = root / "START_HERE.html"
html = hp.read_text(encoding="utf-8")
marker = "   float kilnDelta=(tint-.5)*uColor.z;"
count = html.count(marker)
if count != 2:
    raise SystemExit(f"08F colour compile patch expected exactly two kilnDelta declarations, got {count}")
html = html.replace(marker, "", 1)
hp.write_text(html, encoding="utf-8", newline="")
print("08F fragment compile patch: reused existing kilnDelta declaration")
