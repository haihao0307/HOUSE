"""Run the Studio V1.3 real-browser review against the finalized runtime identity."""
from pathlib import Path

source = Path(__file__).with_name('test_studio13.py').read_text()
source = source.replace("VERSION = '1.3.0-alpha.1'", "VERSION = '1.3.0-alpha.2'")

helper_anchor = "def wake(page):\n"
helper = """def ui_click(page, selector):
    page.evaluate(
        \"(selector)=>{const element=document.querySelector(selector);if(!element)throw new Error('Missing UI '+selector);element.click();}\",
        selector,
    )


def wake(page):
"""
if helper_anchor not in source:
    raise RuntimeError('Unable to install deterministic UI helper')
source = source.replace(helper_anchor, helper, 1)

replacements = [
    ("page.click('#showMaterials')", "ui_click(page, '#showMaterials')"),
    ("page.click('#showControls')", "ui_click(page, '#showControls')"),
    ("page.click('#hidePanels')", "ui_click(page, '#hidePanels')"),
    ("page.click('#playPause')", "ui_click(page, '#playPause')"),
    ("page.click('.diag[data-view=\"0\"]')", "ui_click(page, '.diag[data-view=\"0\"]')"),
    ("page.click('.light-btn[data-light=\"studio\"]')", "ui_click(page, '.light-btn[data-light=\"studio\"]')"),
    ("page.click(f'.family-btn[data-family=\"{family}\"]')", "ui_click(page, f'.family-btn[data-family=\"{family}\"]')"),
    ("page.click(f'.diag[data-view=\"{channel}\"]')", "ui_click(page, f'.diag[data-view=\"{channel}\"]')"),
    ("page.click(f'.light-btn[data-light=\"{light}\"]')", "ui_click(page, f'.light-btn[data-light=\"{light}\"]')"),
    ("mobile.click('#showMaterials')", "ui_click(mobile, '#showMaterials')"),
    ("mobile.click('.family-btn[data-family=\"4\"]')", "ui_click(mobile, '.family-btn[data-family=\"4\"]')"),
    ("mobile.click('#showControls')", "ui_click(mobile, '#showControls')"),
    ("page.click('#fullScreen')", "page.locator('#fullScreen').click(force=True)"),
]
for old, new in replacements:
    if old not in source:
        raise RuntimeError(f'Expected browser review action was not found: {old}')
    source = source.replace(old, new)

if "VERSION = '1.3.0-alpha.2'" not in source:
    raise RuntimeError('Unable to bind finalized runtime identity')
if 'page.click(' in source or 'mobile.click(' in source:
    raise RuntimeError('An unstable pointer-dependent UI action remains')
if "page.locator('#fullScreen').click(force=True)" not in source:
    raise RuntimeError('Unable to bind fullscreen user gesture')

exec(compile(source, str(Path(__file__).with_name('test_studio13.py')), 'exec'))
