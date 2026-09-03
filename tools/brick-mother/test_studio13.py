"""Real-browser validation for Brick Mother Studio V1.3.
Captured PNG files are engineering evidence from the running HTML workbench.
"""
import hashlib
import json
import shutil
import statistics
import sys
import time
from pathlib import Path

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/')
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
API = 'window.__BRICK_MOTHER_WEATHERING_PBR__'
VERSION = '1.3.0-alpha.1'

report = {
    'url': BASE,
    'runtime': VERSION,
    'checks': [],
    'errors': [],
    'imageMetrics': {},
    'gpuBenchmark': False,
    'humanVisualApproved': False,
    'productionApproved': False,
}


def check(name, condition, details=None):
    report['checks'].append({'name': name, 'passed': bool(condition), 'details': details})
    (OUT / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(name, bool(condition), flush=True)
    assert condition, (name, details)


def ready(page):
    page.wait_for_function(
        "document.documentElement.dataset.workbenchReady==='true'||document.documentElement.dataset.runtimeFailure==='true'",
        timeout=90000,
    )
    ok = page.evaluate("document.documentElement.dataset.runtimeFailure!=='true'")
    check('runtime healthy', ok, None if ok else page.locator('#error').inner_text())
    page.wait_for_function("Number(document.documentElement.dataset.renderCount)>1", timeout=20000)
    page.wait_for_timeout(350)


def wake(page):
    page.keyboard.press('Tab')


def hide(page):
    wake(page)
    page.click('#hidePanels')
    page.wait_for_timeout(450)
    check('hidden presentation chrome', page.evaluate("document.body.classList.contains('immersive')"))


def image_metrics(path):
    image = Image.open(path).convert('RGB')
    width, height = image.size
    stat = ImageStat.Stat(image)
    mean_rgb = [round(v, 3) for v in stat.mean]
    mean_luma = round(sum(v * w for v, w in zip(stat.mean, (0.2126, 0.7152, 0.0722))), 3)
    corners = []
    pad = max(12, min(width, height) // 35)
    for box in (
        (0, 0, pad, pad),
        (width - pad, 0, width, pad),
        (0, height - pad, pad, height),
        (width - pad, height - pad, width, height),
    ):
        s = ImageStat.Stat(image.crop(box)).mean
        corners.append(sum(v * w for v, w in zip(s, (0.2126, 0.7152, 0.0722))))
    center = image.crop((width * 0.23, height * 0.18, width * 0.77, height * 0.82))
    center_stat = ImageStat.Stat(center)
    center_luma = round(sum(v * w for v, w in zip(center_stat.mean, (0.2126, 0.7152, 0.0722))), 3)
    thumb = center.resize((96, 96))
    luminance = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in thumb.getdata()]
    p10 = round(statistics.quantiles(luminance, n=10)[0], 3)
    p90 = round(statistics.quantiles(luminance, n=10)[8], 3)
    return {
        'size': [width, height],
        'bytes': path.stat().st_size,
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'meanRGB': mean_rgb,
        'meanLuma': mean_luma,
        'cornerLuma': [round(v, 3) for v in corners],
        'centerLuma': center_luma,
        'centerP10': p10,
        'centerP90': p90,
        'centerRange': round(p90 - p10, 3),
    }


def screenshot(page, name):
    path = OUT / f'{name}.png'
    page.screenshot(path=str(path))
    metrics = image_metrics(path)
    report['imageMetrics'][name] = metrics
    check(f'screenshot {name}', metrics['bytes'] > 40000, metrics)
    check(f'daylight background {name}', min(metrics['cornerLuma']) > 92, metrics)
    check(f'readable tonal range {name}', metrics['centerRange'] > 24, metrics)
    return metrics


def diagnostics(page):
    return page.evaluate(API + '.getRenderDiagnostics()')


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
        start = time.monotonic()
        response = page.goto(BASE + '/studio.html?view=hero&light=studio', wait_until='domcontentloaded', timeout=60000)
        check('HTTP HTML', response.status == 200 and 'text/html' in response.headers.get('content-type', ''))
        ready(page)
        report['initialReadyMs'] = round((time.monotonic() - start) * 1000)
        report['firstMeshMs'] = page.evaluate('Number(document.documentElement.dataset.firstMeshMs)')
        report['renderer'] = page.evaluate(
            "(()=>{const g=document.querySelector('canvas').getContext('webgl2');const e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()"
        )
        check('actual version', page.evaluate(API + '.version') == VERSION)
        check('six isolated material families', page.locator('.family-btn').count() == 6)
        check('sixteen diagnostic channels', page.locator('.diag').count() == 16)
        check('geometry worker completed four meshes', page.evaluate("document.documentElement.dataset.meshCount==='4'&&document.documentElement.dataset.geometryWorker==='true'"))
        check('dielectric metalness zero', page.evaluate(API + '.metalness') == 0)
        check('dielectric F0 0.04', abs(page.evaluate(API + '.dielectricF0') - 0.04) < 1e-6)
        check('base color tagged sRGB', page.evaluate(API + ".colorSpace.baseColor") == 'sRGB')
        check('data channels tagged linear', page.evaluate(API + ".colorSpace.dataChannels") == 'linear')
        check('AO limited to ambient diffuse', page.evaluate(API + ".aoScope") == 'diffuse-ambient-only')
        check('height low-frequency role', page.evaluate(API + ".heightRole") == 'low-frequency-silhouette')
        check('normal high-frequency role', page.evaluate(API + ".normalRole") == 'high-frequency-detail')
        check('GGX BRDF identity', page.evaluate(API + ".brdf") == 'GGX')
        check('default evolution paused', page.evaluate(API + '.state.playing') is False)
        check('default hero composition', page.evaluate(API + '.state.piece') == 'hero')

        family_metrics = []
        for family in range(6):
            wake(page)
            page.click('#showMaterials')
            page.click(f'.family-btn[data-family="{family}"]')
            ready(page)
            check(f'material family {family}', page.evaluate(API + '.state.family') == family)
            page.click('.light-btn[data-light="studio"]')
            hide(page)
            family_metrics.append(screenshot(page, f'family-{family}'))

        hashes = {m['sha256'] for m in family_metrics}
        check('family images are distinct', len(hashes) == 6, sorted(hashes))
        fired = family_metrics[0]
        stone = family_metrics[3]
        check('fired clay has warm chroma', fired['meanRGB'][0] > fired['meanRGB'][2] + 5, fired)
        check('stone avoids dominant chocolate red', stone['meanRGB'][0] < stone['meanRGB'][2] + 18, stone)

        wake(page)
        page.click('#showControls')
        for channel in range(16):
            page.click(f'.diag[data-view="{channel}"]')
            page.wait_for_timeout(90)
            check(f'diagnostic {channel}', page.evaluate(API + '.state.viewMode') == channel)
        page.click('.diag[data-view="0"]')

        for light in ['studio', 'neutral', 'raking', 'overcast', 'outdoor']:
            page.click(f'.light-btn[data-light="{light}"]')
            page.wait_for_timeout(220)
            check(f'light {light}', page.evaluate(API + '.state.lightMode') == light)
        page.click('.light-btn[data-light="studio"]')
        page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")

        before = page.evaluate(API + '.state.form')
        page.locator('#form').focus()
        page.keyboard.press('ArrowRight')
        ready(page)
        check('shape range rebuild', page.evaluate(API + '.state.form') > before)
        check('no replacement loading curtain', page.evaluate("document.querySelector('#loading').classList.contains('hidden')"))

        page.click('#playPause')
        report['resumeBefore'] = diagnostics(page)
        t0 = page.evaluate(API + '.state.simTime')
        page.wait_for_function(f'{API}.state.simTime>{t0}', timeout=12000)
        report['resumeAfter'] = diagnostics(page)
        check('evolution advances', page.evaluate(API + '.state.simTime') > t0, report['resumeAfter'])
        page.click('#playPause')
        page.wait_for_timeout(450)
        t0 = page.evaluate(API + '.state.simTime')
        page.wait_for_timeout(350)
        check('pause preserves time', page.evaluate(API + '.state.simTime') == t0)

        hide(page)
        old_yaw = page.evaluate(API + '.camera.goalYaw')
        page.mouse.move(540, 410)
        page.mouse.down()
        page.mouse.move(680, 445, steps=12)
        page.mouse.up()
        page.wait_for_timeout(1100)
        check('orbit drag', abs(page.evaluate(API + '.camera.goalYaw') - old_yaw) > 0.1)
        check('drag leaves immersive mode', page.evaluate("document.body.classList.contains('immersive')"))
        page.mouse.click(540, 410)
        check('tap reveals controls', page.evaluate("!document.body.classList.contains('immersive')"))

        page.click('#fullScreen')
        page.wait_for_timeout(350)
        check('fullscreen gesture', page.evaluate('!!document.fullscreenElement'))
        page.evaluate('document.exitFullscreen()')

        page.wait_for_timeout(1300)
        n0 = page.evaluate('Number(document.documentElement.dataset.renderCount)')
        page.wait_for_timeout(800)
        n1 = page.evaluate('Number(document.documentElement.dataset.renderCount)')
        check('idle rendering stops', n1 - n0 <= 2, {'before': n0, 'after': n1})
        check('no page errors', not report['errors'], report['errors'])

        mobile = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        mobile.on('pageerror', lambda error: report['errors'].append(str(error)))
        mobile.goto(BASE + '/studio.html?family=3&view=hero&light=studio', wait_until='domcontentloaded')
        ready(mobile)
        mobile.keyboard.press('Tab')
        mobile.click('#showMaterials')
        check('mobile family drawer', mobile.evaluate("document.body.classList.contains('left-open')"))
        mobile.click('.family-btn[data-family="4"]')
        ready(mobile)
        mobile.keyboard.press('Tab')
        mobile.click('#showControls')
        check('mobile parameter drawer', mobile.evaluate("document.body.classList.contains('right-open')"))
        screenshot(mobile, 'mobile-controls')
        mobile.keyboard.press('Escape')
        screenshot(mobile, 'mobile-immersive')
        check('mobile no horizontal overflow', mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        check('all errors empty', not report['errors'], report['errors'])
    except Exception as error:
        report['failure'] = str(error)
        try:
            report['lastScheduler'] = diagnostics(page)
            page.screenshot(path=str(OUT / 'failure.png'))
            (OUT / 'failure.html').write_text(page.content())
        except Exception:
            pass
        raise
    finally:
        report['passed'] = not report.get('failure') and all(item['passed'] for item in report['checks'])
        report['screenshots'] = [
            {
                'name': path.name,
                'bytes': path.stat().st_size,
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            }
            for path in sorted(OUT.glob('*.png'))
        ]
        (OUT / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()
