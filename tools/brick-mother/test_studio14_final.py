"""Run the stable Studio V1.4 review against the finalized runtime identity."""
from pathlib import Path

source_path = Path(__file__).with_name('test_studio14.py')
source = source_path.read_text()
source = source.replace("VERSION = '1.4.0-alpha.1'", "VERSION = '1.4.0-alpha.2'")
if "VERSION = '1.4.0-alpha.2'" not in source:
    raise RuntimeError('Unable to bind finalized V1.4 runtime identity')
exec(compile(source, str(source_path), 'exec'))
