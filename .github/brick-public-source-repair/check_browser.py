"""Check a local or public R4 URL in a real Chromium process.
No visual approval is inferred from these technical checks.
"""
from pathlib import Path
import os, json, sys, threading, http.server, functools, hashlib
from playwright.sync_api import sync_playwright

root = Path(os.environ.get('RUNNER_TEMP', '/tmp'))
out = root / 'r4-evidence'
out.mkdir(exist_ok=True)
server = None
if len(sys.argv) > 1:
    url = sys.argv[1]
else:
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root/'r4-site')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = 'http://127.0.0.1:8765/'
report = {'sourceCommit':os.environ.get('GITHUB_SHA'), 'url':url, 'publicURLTest':server is None, 'tests':[], 'errors':[], 'humanVisualApproved':False, 'productionApproved':False}
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'])
        page = browser.new_page(viewport={'width':1280,'height':800}, device_scale_factor=1)
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        try:
            response = page.goto(url, wait_until='load', timeout=60000)
            assert response and response.status == 200
            report['httpStatus'] = response.status
            report['contentType'] = response.headers.get('content-type')
            assert 'text/html' in report['contentType']
            assert 'attachment' not in response.headers.get('content-disposition','')
            report['htmlSHA256'] = hashlib.sha256(response.body()).hexdigest()
            page.wait_for_function("document.querySelector('#error:not([hidden])') || (window.BrickR4 && BrickR4.audit.ready && !BrickR4.stats().busy)", timeout=90000)
            assert page.locator('#error').is_hidden(), page.locator('#error').inner_text()
            assert page.evaluate('BrickR4.audit.ready')
            report['pageSourceCommit'] = page.locator('meta[name="source-commit"]').get_attribute('content')
            for family in ['fired','kiln','adobe','dressed','rubble','stone','pebble']:
                page.locator('[data-family="'+family+'"]').click()
                page.wait_for_function('(f)=>!BrickR4.stats().busy && BrickR4.stats().geometry?.family===f', arg=family, timeout=90000)
                page.wait_for_timeout(600)
                state = page.evaluate('BrickR4.stats()')
                assert state['geometry']['vertices'] > 0
                assert page.locator('#error').is_hidden()
                page.screenshot(path=str(out/(family+'-desktop.png')))
                report['tests'].append({'test':'material '+family,'passed':True,'geometry':state['geometry'],'name':page.locator('#specimenName').inner_text()})
            page.evaluate("BrickR4.selectFamily('adobe')")
            page.wait_for_function("!BrickR4.stats().busy && BrickR4.stats().geometry.family==='adobe'", timeout=90000)
            builds = page.evaluate('BrickR4.audit.builds')
            for face in ['front','back','left','right','top','bottom']:
                page.evaluate('(f)=>BrickR4.face(f)', face)
                page.wait_for_timeout(350)
                assert page.evaluate('BrickR4.audit.builds') == builds
                report['tests'].append({'test':'adobe '+face+' without rebuild','passed':True})
            page.locator('#resetView').click()
            box = page.locator('#view').bounding_box()
            before = page.evaluate('JSON.stringify(BrickR4.renderer.camera)')
            page.mouse.move(box['x']+box['width']*.55,box['y']+box['height']*.6)
            page.mouse.down()
            page.mouse.move(box['x']+box['width']*.7,box['y']+box['height']*.65,steps=12)
            page.mouse.up()
            assert before != page.evaluate('JSON.stringify(BrickR4.renderer.camera)')
            assert page.evaluate('BrickR4.audit.builds') == builds
            report['tests'].append({'test':'real mouse rotation without rebuild','passed':True})
            page.set_viewport_size({'width':390,'height':844})
            page.wait_for_timeout(600)
            for f in ['fired','kiln','adobe','dressed','rubble','stone','pebble']:
                b = page.locator('[data-family="'+f+'"]')
                assert b.is_visible()
                box = b.bounding_box()
                assert box and box['x']>=0 and box['y']>=0 and box['x']+box['width']<=391 and box['y']+box['height']<=844
            page.screenshot(path=str(out/'mobile-390x844.png'))
            report['tests'].append({'test':'seven mobile material controls visible','passed':True})
            assert not report['errors'], report['errors']
            report['passed'] = True
        except Exception as e:
            report['passed'] = False
            report['failure'] = str(e)
            try:
                report['pageError'] = page.locator('#error').inner_text(timeout=2000)
                page.screenshot(path=str(out/'failure.png'), timeout=10000)
            except Exception:
                pass
            raise
        finally:
            browser.close()
finally:
    (out/'browser-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    if server:
        server.shutdown()
print(json.dumps({'passed':report.get('passed'), 'tests':len(report['tests']), 'url':url, 'sha256':report.get('htmlSHA256')}, ensure_ascii=False))
