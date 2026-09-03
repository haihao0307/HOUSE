"""Run the Studio V1.3 real-browser review against the finalized runtime identity."""
from pathlib import Path

source = Path(__file__).with_name('test_studio13.py').read_text()
source = source.replace("VERSION = '1.3.0-alpha.1'", "VERSION = '1.3.0-alpha.2'")
source = source.replace(
    "page.click('.light-btn[data-light=\"studio\"]')",
    "page.evaluate(\"document.querySelector('.light-btn[data-light=\\\"studio\\\"]').click()\")",
)
if "VERSION = '1.3.0-alpha.2'" not in source:
    raise RuntimeError('Unable to bind the finalized test version')
if "document.querySelector('.light-btn[data-light=\\\"studio\\\"]').click()" not in source:
    raise RuntimeError('Unable to bind deterministic light selection')
exec(compile(source, str(Path(__file__).with_name('test_studio13.py')), 'exec'))
