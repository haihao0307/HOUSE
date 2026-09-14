from __future__ import annotations

from pathlib import Path
import hashlib
import json
import re
import shutil

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "r2-closeout-08d-relief"
TARGET_CLEARANCE_MM = 0.02

source_html_path = SRC / "START_HERE.html"
source_contact_path = SRC / "CONTACT_QA.json"
source_qa_path = SRC / "qa_geometry.cjs"
source_contact_lib_path = SRC / "contact-lib.cjs"

html = source_html_path.read_text(encoding="utf-8")
contact = json.loads(source_contact_path.read_text(encoding="utf-8"))


def recorded_gap(name: str, strength: float = 0.0) -> float:
    matches = [
        item for item in contact["contacts"]
        if item["name"] == name and float(item.get("strength", 0)) == float(strength)
    ]
    if len(matches) != 1:
        raise RuntimeError(f"expected one recorded contact for {name!r} at strength={strength}, got {len(matches)}")
    return float(matches[0]["minGapMm"])


rafter_pan_gap_mm = recorded_gap("left rafter-pan", 0)
pan_cover_gap_mm = recorded_gap("pan-cover default first pair", 0)

# A pure Y translation changes these projected height gaps linearly.
# Move the pan only enough to remove the recorded rafter penetration, then
# move the cover by the pan translation plus the relative pan/cover correction.
pan_delta_m = (TARGET_CLEARANCE_MM - rafter_pan_gap_mm) / 1000.0
cover_delta_m = pan_delta_m + (TARGET_CLEARANCE_MM - pan_cover_gap_mm) / 1000.0

seat_match = re.search(r"const SEATS=Object\.freeze\((\{[^\n]+\})\);", html)
if not seat_match:
    raise RuntimeError("SEATS literal not found in 08D page")
seats = json.loads(seat_match.group(1))
old_seats = dict(seats)
seats["panY"] = float(seats["panY"]) + pan_delta_m
seats["coverY"] = float(seats["coverY"]) + cover_delta_m
new_seat_literal = "const SEATS=Object.freeze(" + json.dumps(seats, ensure_ascii=False, separators=(",", ":")) + ");"
html = html[:seat_match.start()] + new_seat_literal + html[seat_match.end():]

replacements = {
    "<title>Tiles Mother · R2 收尾候选 08D</title>": "<title>Tiles Mother · R2 收尾候选 08E</title>",
    "<small>08D · 瓦面 / 边口 / 气孔</small>": "<small>08E · 08D 外观基线 / 接触校正</small>",
    "<div class=\"tiny\">08D 形态候选 · 屋面接触待验收</div>": "<div class=\"tiny\">08E 接触校正版 · 08D 外观基线保持</div>",
}
for old, new in replacements.items():
    count = html.count(old)
    if count != 1:
        raise RuntimeError(f"expected exactly one UI marker {old!r}, got {count}")
    html = html.replace(old, new, 1)

out_html = HERE / "START_HERE.html"
out_html.write_text(html, encoding="utf-8", newline="")

# Reuse the exact 08D contact evaluator and only update the report identity.
qa = source_qa_path.read_text(encoding="utf-8")
qa = qa.replace("version:'08D'", "version:'08E'", 1)
(HERE / "qa_geometry.cjs").write_text(qa, encoding="utf-8", newline="")
shutil.copyfile(source_contact_lib_path, HERE / "contact-lib.cjs")

predicted = {
    "leftRafterPanMm": rafter_pan_gap_mm + pan_delta_m * 1000.0,
    "panCoverMm": pan_cover_gap_mm + (cover_delta_m - pan_delta_m) * 1000.0,
}
report = {
    "version": "08E",
    "sourceVersion": "08D",
    "scope": "rigid seating correction only; 08D tile geometry, Microscope field, PBR, dimensions and layout are unchanged",
    "targetClearanceMm": TARGET_CLEARANCE_MM,
    "sourceRecordedContactsMm": {
        "leftRafterPan": rafter_pan_gap_mm,
        "panCoverDefaultFirstPair": pan_cover_gap_mm,
    },
    "seatDeltaMm": {
        "panY": pan_delta_m * 1000.0,
        "coverY": cover_delta_m * 1000.0,
    },
    "oldSeats": old_seats,
    "newSeats": seats,
    "predictedContactsMm": predicted,
    "sourceHtmlSha256": hashlib.sha256(source_html_path.read_bytes()).hexdigest(),
    "outputHtmlSha256": hashlib.sha256(out_html.read_bytes()).hexdigest(),
    "automaticPredictionOnly": True,
    "contactPassed": False,
    "visualApproved": False,
    "productionApproved": False,
}
(HERE / "BUILD_QA.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(json.dumps(report, ensure_ascii=False, indent=2))
