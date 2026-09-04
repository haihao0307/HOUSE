"""Stable real-browser visual and runtime review for Brick Mother Studio V1.4.

Screenshots are engineering evidence captured from the running HTML workbench.
"""
import hashlib
import json
import shutil
import statistics
import sys
from pathlib import Path

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/')
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
API = 'window.__BRICK_MOTHER_WEATHERING_PBR__'
VERSION = '1.4.0-alpha.1'

report = {
    'runtime': VERSION,
    'url': BASE,
    'checks': [],
    'errors': [],
    'metrics': {},
    'humanVisualApproved': False,
    'productionApproved': False,
}


def check(name, condition, details=None):
    item = {'name': name, 'passed': bool(condition), 'details': details}
    report['checks'].append(item)
    (OUT / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(name, bool(condition), flush=True)
    assert condition, (name, details)


def js_click(page, selector):
    page.evaluate(
        "selector=>{const element=document.querySelector(selector);if(!element)throw new Error('Missing '+selector);element.click();}",
        selector,
    )


def ready(page):
    page.wait_for_function(
        "document.documentElement.dataset.workbenchReady==='true'||document.documentElement.dataset.runtimeFailure==='true'",
        timeout=120000,
    )
    failure = page.evaluate("document.documentElement.dataset.runtimeFailure==='true'")
    check('runtime healthy', not failure, page.locator('#error').inner_text() if failure else None)
    page.wait_for_function("Number(document.documentElement.dataset.renderCount)>1", timeout=30000)
    page.wait_for_timeout(350)


def metrics(path):
    image = Image.open(path).convert('RGB')
    width, height = image.size
    stat = ImageStat.Stat(image)
    mean_rgb = stat.mean
    luma_weights = (0.2126, 0.7152, 0.0722)
    mean_luma = sum(value * weight for value, weight in zip(mean_rgb, luma_weights))
    pad = max(12, min(width, height) // 32)
    corners = []
    for box in (
        (0, 0, pad, pad),
        (width - pad, 0, width, pad),
        (0, height - pad, pad, height),
        (width - pad, height - pad, width, height),
    ):
        sample = ImageStat.Stat(image.crop(box)).mean
        corners.append(sum(value * weight for value, weight in zip(sample, luma_weights)))
    center = image.crop((int(width * .18), int(height * .16), int(width * .82), int(height * .86))).resize((96, 96))
    luminance = [sum(value * weight for value, weight in zip(pixel, luma_weights)) for pixel in center.getdata()]
    quantiles = statistics.quantiles(luminance, n=10)
    return {
        'size': [width, height],
        'bytes': path.stat().st_size,
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'meanRGB': [round(value, 3) for value in mean_rgb],
        'meanLuma': round(mean_luma, 3),
        'cornerLuma': [round(value, 3) for value in corners],
        'centerP10': round(quantiles[0], 3),
        'centerP90': round(quantiles[8], 3),
        'centerRange': round(quantiles[8] - quantiles[0], 3),
    }


def capture(page, name):
    page.evaluate("document.body.classList.add('immersive');document.body.classList.remove('left-open','right-open')")
    page.wait_for_timeout(900)
    path = OUT / f'{name}.png'
    page.screenshot(path=str(path))
    data = metrics(path)
    report['metrics'][name] = data
    check(f'{name} screenshot exists', data['bytes'] > 45000, data)
    # Bottom corners may legitimately contain the matte turntable or a secondary sample.
    # Daylight is measured from the unobstructed upper cyclorama plus the whole-frame mean.
    daylight = min(data['cornerLuma'][:2]) > 105 and data['meanLuma'] > 115
    check(f'{name} daylight background', daylight, data)
    check(f'{name} readable tonal range', data['centerRange'] > 25, data)
    return data


with sync_playwright() as pw:
    executable = shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('google-chrome-stable')
    check('browser executable available', bool(executable), executable)
    browser = pw.chromium.launch(
        executable_path=executable,
        headless=True,
        args=[
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--enable-unsafe-swiftshader',
            '--use-gl=angle',
            '--use-angle=swiftshader',
        ],
    )
    page = browser.new_page(viewport={'width': 1280, 'height': 850}, device_scale_factor=1)
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    try:
        response = page.goto(BASE + '/studio-v1.4.html?view=hero&light=studio&qa=1', wait_until='domcontentloaded', timeout=60000)
        check('direct HTML response', response.status == 200 and 'text/html' in response.headers.get('content-type', ''))
        ready(page)
        check('runtime version', page.evaluate(API + '.version') == VERSION)
        check('six isolated families', page.locator('.family-btn').count() == 6)
        check('sixteen diagnostics', page.locator('.diag').count() == 16)
        check('four meshes from worker', page.evaluate("document.documentElement.dataset.meshCount==='4'&&document.documentElement.dataset.geometryWorker==='true'"))
        check('GGX material model', page.evaluate(API + '.brdf') == 'GGX')
        check('dielectric metalness zero', page.evaluate(API + '.metalness') == 0)
        check('dielectric F0', abs(page.evaluate(API + '.dielectricF0') - .04) < 1e-6)
        check('Base Color sRGB', page.evaluate(API + '.colorSpace.baseColor') == 'sRGB')
        check('data channels linear', page.evaluate(API + '.colorSpace.dataChannels') == 'linear')
        check('AO ambient diffuse only', page.evaluate(API + '.aoScope') == 'diffuse-ambient-only')
        check('height low frequency', page.evaluate(API + '.heightRole') == 'low-frequency-silhouette')
        check('normal high frequency', page.evaluate(API + '.normalRole') == 'high-frequency-detail')
        check('default simulation paused', page.evaluate(API + '.state.playing') is False)
        check('default hero view', page.evaluate(API + '.state.piece') == 'hero')

        family_data = []
        for family in range(6):
            js_click(page, f'.family-btn[data-family="{family}"]')
            ready(page)
            check(f'family state {family}', page.evaluate(API + '.state.family') == family)
            js_click(page, '.light-btn[data-light="studio"]')
            page.wait_for_timeout(200)
            family_data.append(capture(page, f'family-{family}'))

        check('all family captures distinct', len({item['sha256'] for item in family_data}) == 6)
        check('fired clay warm response', family_data[0]['meanRGB'][0] > family_data[0]['meanRGB'][2] + 5, family_data[0])
        check('rubble avoids dominant chocolate red', family_data[3]['meanRGB'][0] < family_data[3]['meanRGB'][2] + 20, family_data[3])

        for light in ('studio', 'neutral', 'raking', 'overcast', 'outdoor'):
            js_click(page, f'.light-btn[data-light="{light}"]')
            page.wait_for_timeout(180)
            check(f'light mode {light}', page.evaluate(API + '.state.lightMode') == light)

        for channel in range(16):
            js_click(page, f'.diag[data-view="{channel}"]')
            page.wait_for_timeout(60)
            check(f'diagnostic channel {channel}', page.evaluate(API + '.state.viewMode') == channel)
        js_click(page, '.diag[data-view="0"]')

        old_yaw = page.evaluate(API + '.camera.goalYaw')
        page.mouse.move(540, 410)
        page.mouse.down()
        page.mouse.move(680, 445, steps=10)
        page.mouse.up()
        page.wait_for_timeout(700)
        check('real canvas orbit drag', abs(page.evaluate(API + '.camera.goalYaw') - old_yaw) > .08)
        page.mouse.click(560, 420)
        check('tap reveals interface', page.evaluate("!document.body.classList.contains('immersive')"))

        page.wait_for_timeout(1200)
        count0 = page.evaluate('Number(document.documentElement.dataset.renderCount)')
        page.wait_for_timeout(750)
        count1 = page.evaluate('Number(document.documentElement.dataset.renderCount)')
        check('idle renderer stops', count1 - count0 <= 2, {'before': count0, 'after': count1})
        check('desktop page errors empty', not report['errors'], report['errors'])

        mobile = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        mobile.on('pageerror', lambda error: report['errors'].append(str(error)))
        mobile.goto(BASE + '/studio-v1.4.html?family=3&view=hero&light=studio&qa=1', wait_until='domcontentloaded')
        ready(mobile)
        js_click(mobile, '#showMaterials')
        check('mobile family drawer', mobile.evaluate("document.body.classList.contains('left-open')"))
        js_click(mobile, '.family-btn[data-family="4"]')
        ready(mobile)
        js_click(mobile, '#showControls')
        check('mobile control drawer', mobile.evaluate("document.body.classList.contains('right-open')"))
        capture(mobile, 'mobile-controls')
        check('mobile no horizontal overflow', mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        check('all page errors empty', not report['errors'], report['errors'])
    except Exception as error:
        report['failure'] = str(error)
        try:
            page.screenshot(path=str(OUT / 'failure.png'))
            (OUT / 'failure.html').write_text(page.content())
        except Exception:
            pass
        raise
    finally:
        report['passed'] = not report.get('failure') and all(item['passed'] for item in report['checks'])
        (OUT / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()
