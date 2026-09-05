"""Assemble the reviewed single-package delivery. Does not execute input documents."""
from pathlib import Path
from urllib.parse import unquote
import hashlib
import json
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DETAILS = ROOT / 'details'
OUTPUT = ROOT.parent / 'Mother_System_小妈交接包_V1.1_2026-09-05.zip'
ORIGINAL_SHA = 'da096ec58003b4081912758f8615db9f9b645d6d8192d18c2abc35127473971b'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def combine():
    parts = [
        '# Mother System：给小妈的完整研究与复核\n\n'
        'V1.1 · 2026-09-05。本文合并全部主要意见、第二次复核、工作安排、资料导航、风险、协议和存储分析。'
        '第二次复核已直接改入各章节；原始资料与校验记录在附件中。'
        '先了解下一步可读 [小妈先读](00_小妈先读.md)。\n'
    ]
    modules = ['00_SECOND_REVIEW.md', '01_REVIEW.md', '02_HANDOFF_AND_ROADMAP.md',
               '03_RESOURCE_MAP.md', '04_RISKS_AND_QUESTIONS.md', '05_CONTRACTS.md',
               '06_DEM_AND_STORAGE.md', 'CHANGELOG.md']
    for name in modules:
        body = (DETAILS / name).read_text(encoding='utf-8')
        def adjust_link(match):
            target = match.group(1)
            if target.startswith(('https://', 'http://', '#')):
                return match.group(0)
            return '](' + 'details/' + target + ')'
        body = re.sub(r'\]\(([^)]+)\)', adjust_link, body)
        # Only promote actual Markdown headings outside code blocks.
        lines = []
        fenced = False
        for line in body.splitlines():
            if line.startswith('```'):
                fenced = not fenced
            if not fenced and line.startswith('#'):
                line = '#' + line
            lines.append(line)
        parts.append('\n---\n\n' + '\n'.join(lines) + '\n')
    target = ROOT / '01_完整研究与复核.md'
    target.write_text('\n'.join(parts), encoding='utf-8')
    return modules


def validate_content(modules):
    for path in ROOT.rglob('*.json'):
        json.loads(path.read_text(encoding='utf-8'))
    links = 0
    authored = list(ROOT.glob('*.md')) + list(DETAILS.glob('*.md')) + [ROOT / 'tools/README.md']
    for path in authored:
        text = path.read_text(encoding='utf-8')
        assert '小马' not in text, path.name
        assert '\ufffd' not in text and text.count('```') % 2 == 0, path.name
        for raw in re.findall(r'\]\(([^)]+)\)', text):
            if raw.startswith(('http://', 'https://', '#')):
                continue
            target = (path.parent / unquote(raw.split('#', 1)[0].strip('<>'))).resolve()
            assert target.is_relative_to(ROOT) and target.is_file(), (path, raw)
            links += 1
    risk = (DETAILS / '04_RISKS_AND_QUESTIONS.md').read_text(encoding='utf-8')
    table = risk.split('## 4. 原包 47 个问题的回答索引', 1)[1].split('## 5.', 1)[0]
    assert [int(n) for n in re.findall(r'^\| (\d+) \|', table, re.M)] == list(range(1, 48))
    resource = (DETAILS / '03_RESOURCE_MAP.md').read_text(encoding='utf-8')
    assert re.findall(r'^\| (R\d{2}) ', resource, re.M) == [f'R{i:02}' for i in range(1, 37)]
    examples = json.loads((DETAILS / 'contracts/examples.json').read_text(encoding='utf-8'))
    assert examples['recipient'] == '小妈'
    assert all(x['outcome'] == 'not_run' and not x['result_refs'] for x in examples['experiments'])
    assert all(x['status'] == 'proposed' and x['adopted_by'] is None for x in examples['decisions'])
    assert all(x['accepted_baseline'] is None for x in examples['tasks'])
    original = DETAILS / 'input/original_research_pack.zip'
    assert sha(original) == ORIGINAL_SHA
    with zipfile.ZipFile(original) as archive:
        assert archive.testzip() is None
        for item in archive.infolist():
            if not item.is_dir():
                assert archive.read(item) == (DETAILS / 'input' / Path(item.filename).name).read_bytes()
    return {'date': '2026-09-05', 'version': '1.1', 'recipient': '小妈',
            'authored_name_check': 'passed', 'local_links_checked': links,
            'merged_modules': modules, 'original_input_files_checked': 14,
            'question_coverage': '1-47', 'resource_entries': 36,
            'proposals_not_marked_complete': True,
            'scope': 'Local delivery, naming, references, input integrity and proposed-status checks; no production validation.'}


def inventory(base, exclude):
    return [{'path': p.relative_to(base).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}
            for p in sorted(base.rglob('*')) if p.is_file() and p.name not in exclude
            and '__pycache__' not in p.parts]


if __name__ == '__main__':
    modules = combine()
    validation = validate_content(modules)
    write_json(DETAILS / 'evidence/delivery_validation.json', validation)
    detail_files = inventory(DETAILS, {'DELIVERY_MANIFEST.json'})
    write_json(DETAILS / 'DELIVERY_MANIFEST.json', {
        'package': 'Mother System detailed review attachments', 'version': '1.1',
        'recipient': '小妈', 'entry_point': '../00_小妈先读.md',
        'file_count_excluding_this_manifest': len(detail_files), 'files': detail_files
    })
    files = inventory(ROOT, {'MANIFEST.json'})
    write_json(ROOT / 'MANIFEST.json', {
        'package': 'Mother System 小妈完整交接包', 'version': '1.1', 'date': '2026-09-05',
        'recipient': '小妈', 'entry_point': '00_小妈先读.md',
        'complete_report': '01_完整研究与复核.md',
        'original_input_sha256': ORIGINAL_SHA,
        'status': 'reviewed_recommendations_not_production_upgrade',
        'file_count_excluding_manifest': len(files), 'files': files
    })
    result = subprocess.run([sys.executable, '-X', 'utf8', str(ROOT / 'tools/verify_handoff.py')],
                            cwd=ROOT, check=True, text=True, encoding='utf-8', capture_output=True)
    print(result.stdout)
    with zipfile.ZipFile(OUTPUT, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(ROOT.rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts:
                archive.write(path, (Path('Mother_System_小妈交接包_V1.1') / path.relative_to(ROOT)).as_posix())
    with zipfile.ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        for entry in files:
            packed = archive.read('Mother_System_小妈交接包_V1.1/' + entry['path'])
            assert hashlib.sha256(packed).hexdigest() == entry['sha256']
    print(json.dumps({'output_zip': str(OUTPUT), 'zip_bytes': OUTPUT.stat().st_size,
                      'zip_sha256': sha(OUTPUT), 'total_files': len(files) + 1,
                      'zip_crc_and_payload_hashes': 'passed', 'validation': validation}, ensure_ascii=False, indent=2))
