from pathlib import Path

root = Path(__file__).resolve().parent

# 08F.1 CPU mirror is now authored directly from the same one-field equations as shape.glsl.
# Do not rewrite it into the older top/side/underside split. Assert the shared-field markers instead.
p = root / "qa_geometry.cjs"
text = p.read_text(encoding="utf-8")
required = [
    "let common=.00150*b+.00062*mid-.00138*pores",
    "seatRail=bottomW*smooth(.58,.76,Math.abs(u))",
    "edgeField=.00034*b+.00015*mid-.00024*pores",
]
for marker in required:
    if text.count(marker) != 1:
        raise SystemExit(f"08F.1 CPU/GPU parity marker missing or duplicated: {marker}")
for obsolete in ["underPores", "sideField=A.clamp", "bodyDy=strength", "topDy=strength", "underDy=strength"]:
    if obsolete in text:
        raise SystemExit(f"08F.1 still contains obsolete face-specific geometry state: {obsolete}")
print("08F.1 CPU mirror asserted: one stable field drives top/side/underside")

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
