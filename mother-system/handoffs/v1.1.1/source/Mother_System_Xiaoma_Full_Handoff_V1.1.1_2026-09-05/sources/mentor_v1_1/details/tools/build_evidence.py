"""Read-only input audit and a clearly synthetic compression demonstration."""
from pathlib import Path, PurePosixPath
from array import array
import hashlib
import json
import math
import platform
import random
import sys
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('C:/Users/Administrator/Downloads/Mother_System_Astra_Research_Pack_V1.0_2026-09-05.zip')
EXPECTED_SHA256 = 'da096ec58003b4081912758f8615db9f9b645d6d8192d18c2abc35127473971b'


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def audit():
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == EXPECTED_SHA256, 'Input archive changed; review source before continuing.'
    entries = []
    with zipfile.ZipFile(SOURCE) as archive:
        assert archive.testzip() is None
        names = set()
        for info in archive.infolist():
            if info.is_dir():
                continue
            relative = PurePosixPath(info.filename)
            assert not relative.is_absolute() and '..' not in relative.parts
            assert relative.suffix in {'.md', '.json'} and info.file_size < 1_000_000
            assert relative.name not in names
            names.add(relative.name)
            raw = archive.read(info)
            content = raw.decode('utf-8')
            destination = (ROOT / 'input' / relative.name).resolve()
            assert destination.is_relative_to((ROOT / 'input').resolve())
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(raw)
            entries.append({'name': relative.name, 'archive_path': info.filename,
                            'bytes': len(raw), 'lines': len(content.splitlines()),
                            'sha256': hashlib.sha256(raw).hexdigest()})
    manifest = json.loads((ROOT / 'input/MANIFEST.json').read_text(encoding='utf-8'))
    declared = set(manifest['files'])
    actual_content = names - {'MANIFEST.json'}
    assert declared == actual_content and manifest['file_count'] == len(declared)
    result = {'date': '2026-09-05', 'source': str(SOURCE), 'source_bytes': SOURCE.stat().st_size,
              'source_sha256': digest, 'zip_crc_check': 'passed', 'files_read': len(entries),
              'content_files_excluding_manifest': len(actual_content),
              'manifest_matches': True, 'uncompressed_bytes': sum(x['bytes'] for x in entries),
              'entries': entries,
              'scope': 'All 14 archive files read. No code, raw DEM, production assets, or benchmark runs are included in this input archive.'}
    save_json(ROOT / 'evidence/input_audit.json', result)
    return result


def compression_demo():
    # Synthetic int16 raster values at 0.1 metre units. This is not a surveyed DEM.
    size = 512
    rng = random.Random(20260905)
    rows = []
    for name in ['smooth_integer_field', 'unstructured_integer_field']:
        if name == 'smooth_integer_field':
            values = array('h', (round(1000 + 200 * math.sin(x / 40) + 150 * math.cos(y / 70))
                                 for y in range(size) for x in range(size)))
        else:
            values = array('h', (rng.randint(650, 1350) for _ in range(size * size)))
        little = array('h', values)
        if sys.byteorder != 'little':
            little.byteswap()
        raw = little.tobytes()
        compressed = zlib.compress(raw, 9)
        assert zlib.decompress(compressed) == raw
        residuals = array('h')
        for y in range(size):
            previous = 0
            for x in range(size):
                current = values[y * size + x]
                residuals.append(current - previous)
                previous = current
        restored = array('h')
        for y in range(size):
            previous = 0
            for x in range(size):
                previous += residuals[y * size + x]
                restored.append(previous)
        assert restored == values
        if sys.byteorder != 'little':
            residuals.byteswap()
        residual_raw = residuals.tobytes()
        residual_z = zlib.compress(residual_raw, 9)
        assert zlib.decompress(residual_z) == residual_raw
        rows.append({'case': name, 'cells': size * size, 'raw_bytes': len(raw),
                     'zlib_bytes': len(compressed), 'zlib_fraction': len(compressed) / len(raw),
                     'row_delta_zlib_bytes': len(residual_z),
                     'row_delta_zlib_fraction': len(residual_z) / len(raw),
                     'sample_value_roundtrip_exact': True})
    return_value = {
        'kind': 'SYNTHETIC_DEMONSTRATION_NOT_REAL_DEM_BENCHMARK',
        'python': platform.python_version(), 'zlib': zlib.ZLIB_RUNTIME_VERSION,
        'seed': 20260905, 'shape': [size, size], 'stored_type': 'int16 little endian',
        'codec': 'zlib level 9, with and without simple per-row delta predictor',
        'scope': 'Payload byte counts exclude container metadata, decoder code, dependency storage, and indexes. Random generator seed only reproduces this invented dataset; it does not encode unknown real-world measurements.',
        'rows': rows,
        'illustrative_area_arithmetic': {
            'area_km2': 60, 'cell_spacing_m': 1, 'assumption': 'exact 60,000,000 grid cells; no rectangular padding',
            'float32_raw_bytes': 240_000_000, 'float32_raw_MiB': 240_000_000 / 2**20,
            'int16_raw_bytes': 120_000_000, 'full_2d_overview_limit_multiplier': 4 / 3,
            'float32_with_overviews_limit_bytes': 320_000_000,
            'rgba8_7000_square_base_bytes': 7000 * 7000 * 4,
            'rgba8_7000_square_with_mips_approx_bytes': round(7000 * 7000 * 4 * 4 / 3)
        }
    }
    save_json(ROOT / 'evidence/compression_demo.json', return_value)
    return return_value


if __name__ == '__main__':
    checked = audit()
    demonstrated = compression_demo()
    print(json.dumps({'audit': {k: checked[k] for k in ['files_read', 'manifest_matches', 'uncompressed_bytes']},
                      'synthetic_demo': demonstrated['rows'],
                      'arithmetic': demonstrated['illustrative_area_arithmetic']}, ensure_ascii=False, indent=2))
