from pathlib import Path
import json, re, statistics

ROOT = Path(__file__).resolve().parent
matrix = json.loads((ROOT / 'CONTACT_MATRIX_QA.json').read_text(encoding='utf-8'))
cal = json.loads((ROOT / 'SEAT_CALIBRATION.json').read_text(encoding='utf-8'))

# Final QA stays at the established [-0.05, 0.50] mm support window.
# The solver uses a 0.002 mm inset so floating-point/linearization noise cannot land exactly on the QA boundary.
qa_lower = -0.05
qa_upper = 0.50
margin = 0.002
solve_lower = qa_lower + margin
solve_upper = qa_upper - margin
target = 0.02

support = [x for x in matrix['checks'] if x.get('minGapMm') is not None]
rafter = [x['minGapMm'] for x in support if x['group'] == 'rafter-pan']
pan_cover = [x['minGapMm'] for x in support if x['group'] == 'pan-cover']
if not rafter or not pan_cover:
    raise SystemExit('missing support groups in pre-adjustment matrix')

def solve(values, label):
    lo = max(solve_lower - g for g in values)
    hi = min(solve_upper - g for g in values)
    if lo > hi + 1e-9:
        raise SystemExit(
            f'{label} has no feasible common rigid adjustment inside inset solver window: '
            f'[{lo:.6f},{hi:.6f}] mm; geometry field must be fixed, not hidden by translation'
        )
    desired = target - statistics.mean(values)
    delta = max(lo, min(hi, desired))
    return {
        'minInputMm': min(values),
        'maxInputMm': max(values),
        'qaWindowMm': [qa_lower, qa_upper],
        'solverMarginMm': margin,
        'solverWindowMm': [solve_lower, solve_upper],
        'feasibleIntervalMm': [lo, hi],
        'desiredMm': desired,
        'chosenMm': delta,
    }

pan = solve(rafter, 'rafter-pan')
rel = solve(pan_cover, 'pan-cover relative')
seats = dict(cal['solvedSeats'])
seats['panY'] += pan['chosenMm'] / 1000.0
seats['coverY'] += (pan['chosenMm'] + rel['chosenMm']) / 1000.0

cal['supportWindowMm'] = [qa_lower, qa_upper]
cal['solverMarginMm'] = margin
cal['solverWindowMm'] = [solve_lower, solve_upper]
cal['targetMm'] = target
cal['panRigidAdjust'] = pan
cal['coverRelativeRigidAdjust'] = rel
cal['solvedSeats'] = seats
(ROOT / 'SEAT_CALIBRATION.json').write_text(json.dumps(cal, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

hp = ROOT / 'START_HERE.html'
html = hp.read_text(encoding='utf-8')
pattern = r'const SEATS=Object\.freeze\((\{[^\n]+\})\);'
replacement = 'const SEATS=Object.freeze(' + json.dumps(seats, separators=(',', ':')) + ');'
html, n = re.subn(pattern, replacement, html, count=1)
if n != 1:
    raise SystemExit('SEATS replacement failed')
hp.write_text(html, encoding='utf-8', newline='')

print(json.dumps({
    'panRigidAdjust': pan,
    'coverRelativeRigidAdjust': rel,
    'seats': seats,
}, ensure_ascii=False, indent=2))
