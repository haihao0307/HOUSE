"""Reproduce the supplied two synthetic examples, without touching the received pack."""
from array import array
from pathlib import Path
import hashlib
import json
import math
import platform
import random
import sys
import zlib

ROOT = Path(__file__).resolve().parent
INPUT = ROOT / 'reference' / 'compression_demo.json'


def little_endian(values: array) -> bytes:
    copy = array('h', values)
    if sys.byteorder != 'little':
        copy.byteswap()
    return copy.tobytes()


def parse_i16(raw: bytes) -> array:
    result = array('h')
    result.frombytes(raw)
    if sys.byteorder != 'little':
        result.byteswap()
    return result


def main() -> None:
    expected = json.loads(INPUT.read_text(encoding='utf-8'))
    n = 512
    rng = random.Random(20260905)
    rows = []
    for kind in ('smooth_integer_field', 'unstructured_integer_field'):
        if kind == 'smooth_integer_field':
            values = array('h', (round(1000 + 200 * math.sin(x / 40) + 150 * math.cos(y / 70))
                                 for y in range(n) for x in range(n)))
        else:
            values = array('h', (rng.randint(650, 1350) for _ in range(n * n)))
        raw = little_endian(values)
        plain_z = zlib.compress(raw, 9)
        residuals = array('h')
        for y in range(n):
            prev = 0
            for x in range(n):
                cur = values[y * n + x]
                residuals.append(cur - prev)
                prev = cur
        delta_z = zlib.compress(little_endian(residuals), 9)
        decoded_residuals = parse_i16(zlib.decompress(delta_z))
        decoded = array('h')
        for y in range(n):
            value = 0
            for x in range(n):
                value += decoded_residuals[y * n + x]
                decoded.append(value)
        exp = next(v for v in expected['rows'] if v['case'] == kind)
        rows.append({
            'case': kind, 'cells': len(values), 'raw_bytes': len(raw),
            'raw_sha256': hashlib.sha256(raw).hexdigest(),
            'direct_zlib_bytes': len(plain_z), 'row_delta_zlib_bytes': len(delta_z),
            'direct_roundtrip_exact': zlib.decompress(plain_z) == raw,
            'delta_full_decode_roundtrip_exact': decoded == values,
            'reported_direct_bytes': exp['zlib_bytes'],
            'reported_delta_bytes': exp['row_delta_zlib_bytes'],
            'byte_counts_match_report': len(plain_z) == exp['zlib_bytes'] and len(delta_z) == exp['row_delta_zlib_bytes']
        })
    result = {
        'reviewer': '小妈', 'date': '2026-09-05',
        'method': 'Independently implemented from the supplied generator and codec recipe; complete compressed-data decode tested.',
        'scope': 'Synthetic examples only. No real DEM, geospatial data or production asset tested.',
        'input_report_sha256': hashlib.sha256(INPUT.read_bytes()).hexdigest(),
        'environment': {'python': platform.python_version(), 'zlib_runtime': zlib.ZLIB_RUNTIME_VERSION,
                        'zlib_compile': zlib.ZLIB_VERSION, 'byteorder': sys.byteorder},
        'reported_environment': {'python': expected['python'], 'zlib': expected['zlib']},
        'results': rows
    }
    (ROOT / 'synthetic_reproduction.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
