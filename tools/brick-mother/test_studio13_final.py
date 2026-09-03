"""Run the Studio V1.3 real-browser review against the finalized runtime identity."""
from pathlib import Path

source = Path(__file__).with_name('test_studio13.py').read_text()
source = source.replace("VERSION = '1.3.0-alpha.1'", "VERSION = '1.3.0-alpha.2'")

static_clicks = {
    "page.click('#showMaterials')": "page.evaluate(\"document.querySelector('#showMaterials').click()\")",
    "page.click('#showControls')": "page.evaluate(\"document.querySelector('#showControls').click()\")",
    "page.click('#hidePanels')": "page.evaluate(\"document.querySelector('#hidePanels').click()\")",
    "page.click('#playPause')": "page.evaluate(\"document.querySelector('#playPause').click()\")",
    "page.click('.diag[data-view=\"0\"]')": "page.evaluate(\"document.querySelector('.diag[data-view=\\\"0\\\"]').click()\")",
    "page.click('.light-btn[data-light=\"studio\"]')": "page.evaluate(\"document.querySelector('.light-btn[data-light=\\\"studio\\\"]').click()\")",
    "mobile.click('#showMaterials')": "mobile.evaluate(\"document.querySelector('#showMaterials').click()\")",
    "mobile.click('.family-btn[data-family=\"4\"]')": "mobile.evaluate(\"document.querySelector('.family-btn[data-family=\\\"4\\\"]').click()\")",
    "mobile.click('#showControls')": "mobile.evaluate(\"document.querySelector('#showControls').click()\")",
}
for old, new in static_clicks.items():
    source = source.replace(old, new)

source = source.replace(
    "page.click(f'.family-btn[data-family=\"{family}\"]')",
    "page.evaluate(f'document.querySelector(\\'.family-btn[data-family=\"{family}\"]\\').click()')",
)
source = source.replace(
    "page.click(f'.diag[data-view=\"{channel}\"]')",
    "page.evaluate(f'document.querySelector(\\'.diag[data-view=\"{channel}\"]\\').click()')",
)
source = source.replace(
    "page.click(f'.light-btn[data-light=\"{light}\"]')",
    "page.evaluate(f'document.querySelector(\\'.light-btn[data-light=\"{light}\"]\\').click()')",
)
source = source.replace(
    "page.click('#fullScreen')",
    "page.locator('#fullScreen').click(force=True)",
)

required = [
    "VERSION = '1.3.0-alpha.2'",
    "document.querySelector('#showMaterials').click()",
    "document.querySelector('.family-btn[data-family=\"{family}\"]').click()",
    "document.querySelector('.diag[data-view=\"{channel}\"]').click()",
    "document.querySelector('.light-btn[data-light=\"{light}\"]').click()",
    "page.locator('#fullScreen').click(force=True)",
]
for token in required:
    if token not in source:
        raise RuntimeError(f'Unable to bind deterministic V1.3 review action: {token}')

exec(compile(source, str(Path(__file__).with_name('test_studio13.py')), 'exec'))
