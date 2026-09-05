"""Validate the review's internal artifacts and create a local handoff ZIP."""
from pathlib import Path
from urllib.parse import unquote, urlparse
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ZIP_PATH = ROOT.parent / 'Mother_System_Review_Recommendations_2026-09-05.zip'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def snapshot_local_evidence():
    base = ROOT.parent / 'tiles-mother-analysis-2026-09-01'
    mappings = {
        'tiles-mother-review.md': 'local_tiles_review_20260901.md',
        'fbx-model-contact-sheet.png': 'local_tiles_contact_sheet_20260901.png',
        'tiles-mother-analysis.json': 'local_tiles_analysis_20260901.json',
    }
    records = []
    for original, target in mappings.items():
        src = base / original
        dst = ROOT / 'evidence' / target
        dst.write_bytes(src.read_bytes())
        records.append({'original_path': str(src), 'snapshot': dst.relative_to(ROOT).as_posix(),
                        'sha256': digest(src), 'bytes': src.stat().st_size})
        assert digest(src) == digest(dst)
    write_json(ROOT / 'evidence/local_evidence_provenance.json', {
        'read_on': '2026-09-05', 'report_date': '2026-09-01',
        'scope': 'Existing analysis records read; contact sheet visually inspected. Original FBX and original tile ZIP were not re-analysed in this review.',
        'records': records
    })


def validate():
    json_paths = sorted(ROOT.rglob('*.json'))
    for path in json_paths:
        json.loads(path.read_text(encoding='utf-8'))
    examples = json.loads((ROOT / 'contracts/examples.json').read_text(encoding='utf-8'))
    source_ids = {x['id'] for x in examples['sources']}
    task_ids = {x['id'] for x in examples['tasks']}
    exp_ids = {x['id'] for x in examples['experiments']}
    for claim in examples['claims']:
        assert claim['subject_id'] in source_ids
        for support in claim['support_refs']:
            assert support['source_id'] in source_ids
            assert (ROOT / support['local_result']).is_file()
    for experiment in examples['experiments']:
        assert experiment['task_id'] in task_ids
        assert experiment['outcome'] == 'not_run' and not experiment['result_refs']
        assert not experiment['production_accepted'] and not experiment['visual_accepted']
    for task in examples['tasks']:
        assert task['next_experiment'] in exp_ids
        assert task['accepted_baseline'] is None
    for decision in examples['decisions']:
        assert decision['status'] == 'proposed' and decision['adopted_by'] is None
    bad_links = []
    local_link_count = 0
    for path in sorted(ROOT.glob('*.md')):
        body = path.read_text(encoding='utf-8')
        assert '\ufffd' not in body
        assert body.count('```') % 2 == 0
        for target in re.findall(r'\]\(([^)]+)\)', body):
            if target.startswith(('https://', 'http://', '#')):
                continue
            local_link_count += 1
            resolved = path.parent / unquote(target.split('#', 1)[0].strip('<>'))
            if resolved.name == 'delivery_validation.json':
                continue  # Written below after this check.
            if not resolved.is_file():
                bad_links.append({'document': path.name, 'target': target})
    assert not bad_links, bad_links
    audit = json.loads((ROOT / 'evidence/input_audit.json').read_text(encoding='utf-8'))
    assert digest(Path(audit['source'])) == audit['source_sha256']
    for entry in audit['entries']:
        assert digest(ROOT / 'input' / entry['name']) == entry['sha256']
    risk_text = (ROOT / '04_RISKS_AND_QUESTIONS.md').read_text(encoding='utf-8')
    table = risk_text.split('## 4. 原包 47 个问题的回答索引', 1)[1].split('## 5.', 1)[0]
    questions = [int(x) for x in re.findall(r'^\| (\d+) \|', table, re.M)]
    assert questions == list(range(1, 48))
    resource_text = (ROOT / '03_RESOURCE_MAP.md').read_text(encoding='utf-8')
    resource_ids = re.findall(r'^\| (R\d{2}) ', resource_text, re.M)
    assert resource_ids == [f'R{i:02d}' for i in range(1, 37)]
    report = {
        'review_date': '2026-09-05',
        'json_files_parsed': len(json_paths), 'example_reference_and_status_checks': 'passed',
        'authored_local_markdown_links_checked': local_link_count,
        'missing_local_markdown_links': bad_links, 'input_files_hash_checked': len(audit['entries']),
        'original_zip_unchanged': True, 'question_coverage': '1-47 present once in coverage table',
        'resource_entries': 36,
        'scope_limit': 'Does not validate production schemas, external page availability, real DEM accuracy, asset runtime quality, or completion of proposed Mother tasks.'
    }
    write_json(ROOT / 'evidence/delivery_validation.json', report)
    return report


def package():
    files = [p for p in sorted(ROOT.rglob('*')) if p.is_file()
             and '__pycache__' not in p.parts and p.name != 'DELIVERY_MANIFEST.json']
    manifest = {
        'package': 'Mother System Review and Recommendations', 'version': '1.0',
        'date': '2026-09-05', 'status': 'research_recommendations_not_adopted',
        'entry_point': 'README.md', 'file_count_excluding_this_manifest': len(files),
        'files': [{'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size,
                   'sha256': digest(p)} for p in files]
    }
    write_json(ROOT / 'DELIVERY_MANIFEST.json', manifest)
    files.append(ROOT / 'DELIVERY_MANIFEST.json')
    with zipfile.ZipFile(ZIP_PATH, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            archive.write(path, (Path(ROOT.name) / path.relative_to(ROOT)).as_posix())
    with zipfile.ZipFile(ZIP_PATH) as archive:
        assert archive.testzip() is None
        for path in files:
            packed = archive.read((Path(ROOT.name) / path.relative_to(ROOT)).as_posix())
            assert hashlib.sha256(packed).hexdigest() == digest(path)
    return {'path': str(ZIP_PATH), 'files': len(files), 'bytes': ZIP_PATH.stat().st_size,
            'sha256': digest(ZIP_PATH), 'zip_crc_and_file_hashes': 'passed'}


if __name__ == '__main__':
    snapshot_local_evidence()
    validation = validate()
    bundle = package()
    print(json.dumps({'validation': validation, 'bundle': bundle}, ensure_ascii=False, indent=2))
