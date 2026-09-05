"""Verify this handoff after extraction, without external paths or network calls."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def verify():
    manifest = json.loads((ROOT / 'MANIFEST.json').read_text(encoding='utf-8'))
    assert manifest['recipient'] == '小妈'
    listed = {item['path'] for item in manifest['files']}
    assert len(listed) == manifest['file_count_excluding_manifest']
    actual = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*')
              if p.is_file() and '__pycache__' not in p.parts and p.name != 'MANIFEST.json'}
    assert actual == listed, {'missing': sorted(listed - actual), 'unlisted': sorted(actual - listed)}
    for item in manifest['files']:
        target = (ROOT / item['path']).resolve()
        assert target.is_relative_to(ROOT)
        raw = target.read_bytes()
        assert len(raw) == item['bytes'] and digest(raw) == item['sha256'], item['path']
    original = ROOT / 'details/input/original_research_pack.zip'
    assert digest(original.read_bytes()) == manifest['original_input_sha256']
    with zipfile.ZipFile(original) as archive:
        assert archive.testzip() is None
        for entry in archive.infolist():
            if not entry.is_dir():
                assert archive.read(entry) == (ROOT / 'details/input' / Path(entry.filename).name).read_bytes()
    return {'status': 'passed', 'recipient': manifest['recipient'], 'version': manifest['version'],
            'files_hash_checked': len(listed), 'original_input_files_match': True,
            'external_files_or_network_required': False,
            'scope': 'Package integrity only; does not validate proposed production or learning capabilities.'}


if __name__ == '__main__':
    print(json.dumps(verify(), ensure_ascii=False, indent=2))
