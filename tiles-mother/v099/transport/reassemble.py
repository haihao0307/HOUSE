"""Checksum-verified transport of locally tested original source files only."""
from pathlib import Path, PurePosixPath
import base64,hashlib,io,zipfile
root=Path(__file__).resolve().parent
parts=[(root/f'part{i}.b64').read_text().strip() for i in range(4)]
# Restore a specifically identified omitted span in the text transfer.
marker='G9wYK+MPVny70XK1tXDF'
span='5sonZNkXOW9kTofH9+kArZTOkHOb5QlYiz6NEC6OqtQijpOVaNNZMz2cTY/lSZAzFZYFcBMyJDt8NEDUJ18t1ICojAkb3ZRPV2QzJP2OfOHtG53EuqT+WUoeedPZedyIWt9LYXH2kUTQQWittsulsUqgGZBH4qcWnThjrprkR7mMlio/0BfS1zVAlSa0aZVUjizAaaIHXzu7YWmgDNmEpGycXyQWLGUnEUvqJ2UoZe1VxC6aoYRJu1PpRzDayKdXGfA92K8R7EEKULH3H4bJARXW6EDc/Xj5/9Zql3hKJWXEYh6G7/837y+v3+Y9vr98mK'
assert parts[2].count(marker)==1
parts[2]=parts[2].replace(marker,'G9wYK+MPVny70XK'+span+'1tXDF')
raw=base64.b64decode(''.join(parts),validate=True)
assert len(raw)==21209
assert hashlib.sha256(raw).hexdigest()=='d753f19ca52f1674095acf4368635243a3ef1c1615980ad5d6184512cc4a9dea'
repo=root.parents[2]
with zipfile.ZipFile(io.BytesIO(raw)) as z:
 assert z.testzip() is None
 assert len(z.infolist())==9
 for entry in z.infolist():
  p=PurePosixPath(entry.filename)
  assert not p.is_absolute() and '..' not in p.parts
  assert str(p).startswith('tiles-mother/v099/')
  target=repo/str(p)
  assert not target.exists(),f'Refuse to overwrite edited source: {target}'
  target.parent.mkdir(parents=True,exist_ok=True)
  target.write_bytes(z.read(entry))
print('Verified and restored 9 source files, no reference assets.')
