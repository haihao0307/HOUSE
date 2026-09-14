from pathlib import Path

root = Path(__file__).resolve().parent
p = root / "qa_geometry.cjs"
text = p.read_text(encoding="utf-8")
old = "let seat=smooth(.72,.92,Math.abs(u))*smooth(.18,.30,t)*(1-smooth(.70,.84,t)),supportBottom=1-.78*seat,bodySupport=supportTop*(1-bottomW)+supportBottom*bottomW;"
new = "let seatRail=smooth(.55,.75,Math.abs(u)),supportBottom=1-.995*seatRail,bodySupport=supportTop*(1-bottomW)+supportBottom*bottomW;"
count = text.count(old)
if count != 1:
    raise SystemExit(f"08F CPU/GPU parity patch expected one legacy support expression, got {count}")
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8", newline="")
print("08F CPU mirror seating-rail guard synchronized with shape.glsl")
