"""One-time source transfer. Does not overwrite an already materialized source."""
from pathlib import Path
import base64,hashlib,tarfile,io
r=Path(__file__).resolve().parents[1]
if (r/'source/app.js').exists():
    print('Canonical source already exists; transfer is skipped')
else:
    paths=[r/f'transport/source{i:02d}.b64' for i in range(6)]
    data=base64.b64decode(''.join(p.read_text() for p in paths),validate=True)
    assert hashlib.sha256(data).hexdigest()=='d51cfba09820eea02997031ecef60e2f78d4fde95c3f023f10ff19db7564a5d3'
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:xz') as archive:
        for m in archive.getmembers():
            target=(r/m.name).resolve()
            assert target.is_relative_to(r.resolve()) and m.isfile() and m.size<100000
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(archive.extractfile(m).read())
    print('Own source restored with exact archive identity')
