"""Run the Studio V1.3 real-browser review against the finalized runtime identity."""
from pathlib import Path

source = Path(__file__).with_name('test_studio13.py').read_text()
source = source.replace("VERSION = '1.3.0-alpha.1'", "VERSION = '1.3.0-alpha.2'")
if "VERSION = '1.3.0-alpha.2'" not in source:
    raise RuntimeError('Unable to bind the finalized test version')
exec(compile(source, str(Path(__file__).with_name('test_studio13.py')), 'exec'))
