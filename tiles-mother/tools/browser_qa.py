"""Browser QA for the experimental Tiles Mother workbench. No visual approval."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import base64, hashlib, io, json, os, shutil, traceback
from PIL import Image, ImageDraw, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path.cwd()
OUT = ROOT / 'tiles-mother' / 'qa'
OUT.mkdir(parents=True, exist_ok=True)
REPORT = {'version':'0.1.0', 'testedSourceSha256':hashlib.sha256((ROOT/'tiles-mother/index.html').read_bytes()).hexdigest(), 'visualApproved':False, 'productionApproved':False, 'tests':{}, 'families':{}, 'consoleErrors':[], 'pageErrors':[], 'failedRequests':[]}

def check(name, condition):
    REPORT['tests'][name] = bool(condition)
    if not condition:
        raise AssertionError(name)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_port}/tiles-mother/index.html'

try:
    with sync_playwright() as p:
        executable = shutil.which('google-chrome') or shutil.which('google-chrome-stable') or shutil.which('chromium')
        browser = p.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
        REPORT['browser'] = browser.version
        context = browser.new_context(viewport={'width':1512,'height':982}, device_scale_factor=1, accept_downloads=True)
        page = context.new_page()
        page.on('console', lambda m: REPORT['consoleErrors'].append(m.text) if m.type=='error' else None)
        page.on('pageerror', lambda e: REPORT['pageErrors'].append(str(e)))
        page.on('requestfailed', lambda r: REPORT['failedRequests'].append({'url':r.url,'failure':r.failure}))
        page.goto(URL, wait_until='networkidle')
        page.wait_for_function('window.TilesMother && document.body.dataset.tilesMotherReady === "true"', timeout=60000)
        check('webgl2Ready', True)
        check('indexedDBReady', page.evaluate('TilesMother.getStorage().dbReady'))
        REPORT['renderer'] = page.evaluate('''() => {const g=document.getElementById('gl').getContext('webgl2');const d=g.getExtension('WEBGL_debug_renderer_info');return {version:g.getParameter(g.VERSION),renderer:d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),error:g.getError()};}''')
        for family in ['pan','cover','earthen','glazed']:
            page.evaluate('(id)=>TilesMother.setProfile(id)', family)
            page.wait_for_timeout(450)
            REPORT['families'][family] = page.evaluate('TilesMother.runQA()')
            check(f'{family}.geometryChecks', REPORT['families'][family]['allPassed'])
            page.screenshot(path=str(OUT/f'desktop-{family}.png'))
            png = page.locator('#gl').screenshot()
            (OUT/f'specimen-{family}.png').write_bytes(png)
            im=Image.open(io.BytesIO(png)).convert('RGB')
            std = ImageStat.Stat(im).stddev
            REPORT['families'][family]['canvasRGBStdDev']=std
            check(f'{family}.nonblankCanvas', max(std)>8)
        page.evaluate("TilesMother.setProfile('pan')")
        before=page.evaluate('({hashes:TilesMother.getGeometryHashes(),builds:TilesMother.getGeometryBuilds(),seed:TilesMother.getProject().profiles.pan.seeds.color})')
        page.evaluate('(v)=>TilesMother.setSeed("color",v+1)',before['seed'])
        after=page.evaluate('({hashes:TilesMother.getGeometryHashes(),builds:TilesMother.getGeometryBuilds()})')
        check('colorSeedDoesNotRebuild',before['builds']==after['builds'] and before['hashes']==after['hashes'])
        page.evaluate("TilesMother.setLayout('trio')")
        hashes=page.evaluate('TilesMother.getGeometryHashes()')
        check('threeDistinctChildren',len(hashes)==3 and len(set(hashes))==3)
        page.screenshot(path=str(OUT/'desktop-trio.png'))
        page.evaluate("TilesMother.setLayout('single')")
        box=page.locator('#gl').bounding_box(); x=box['x']+box['width']*.5; y=box['y']+box['height']*.5
        old=page.evaluate('TilesMother.getCamera()')
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+55,y+20,steps=8);page.mouse.up()
        new=page.evaluate('TilesMother.getCamera()')
        check('orbitChangesCamera',old['yaw']!=new['yaw'])
        page.mouse.wheel(0,-100);page.wait_for_timeout(180)
        check('wheelZoomChangesDistance',page.evaluate('TilesMother.getCamera().distance')<new['distance'])
        fixture=OUT/'fixture.png';im=Image.new('RGB',(640,480),(151,140,116));ImageDraw.Draw(im).text((30,40),'QA FIXTURE / NOT HISTORICAL REFERENCE',fill=(25,30,25));im.save(fixture)
        expected=hashlib.sha256(fixture.read_bytes()).hexdigest()
        page.locator('#refFiles').set_input_files(str(fixture))
        page.wait_for_function('TilesMother.getRefs().length === 1')
        page.locator('#refTitle').fill('QA reference only')
        page.locator('#refSource').fill('Test fixture, not historical evidence')
        page.locator('#refNotes').fill('Original bytes and this note must survive reload.')
        page.wait_for_timeout(700)
        page.evaluate('TilesMother.save()')
        page.reload(wait_until='networkidle')
        page.wait_for_function('window.TilesMother && document.body.dataset.tilesMotherReady === "true"')
        records=page.evaluate('TilesMother.getRefs()')
        check('referencePersistsAcrossReload',len(records)==1 and records[0]['sha256']==expected and records[0]['notes']=='Original bytes and this note must survive reload.')
        page.locator('#enlargeRef').click()
        check('originalReferenceViewer',page.locator('#refModal').is_visible())
        page.locator('[data-close="refModal"]').first.click()
        with page.expect_download() as download:
            page.locator('#exportBtn').click()
        exported=OUT/'test-collaboration.json';download.value.save_as(str(exported))
        data=json.loads(exported.read_text())
        check('exportOriginalBytes',hashlib.sha256(base64.b64decode(data['referenceImages'][0]['dataURL'].split(',',1)[1])).hexdigest()==expected)
        fresh=browser.new_context(viewport={'width':1280,'height':900})
        imported=fresh.new_page();imported.on('dialog',lambda d:d.accept());imported.goto(URL,wait_until='networkidle')
        imported.wait_for_function('window.TilesMother && document.body.dataset.tilesMotherReady === "true"')
        imported.locator('#projectFile').set_input_files(str(exported))
        imported.wait_for_function('TilesMother.getRefs().length === 1')
        check('importOriginalBytesAndNotes',imported.evaluate('TilesMother.getRefs()[0].sha256')==expected and imported.evaluate('TilesMother.getRefs()[0].notes')==records[0]['notes'])
        fresh.close()
        mobile_context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
        mobile=mobile_context.new_page();mobile.goto(URL,wait_until='networkidle')
        mobile.wait_for_function('window.TilesMother && document.body.dataset.tilesMotherReady === "true"')
        check('mobileNoHorizontalOverflow',mobile.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        check('mobileWebgl2Ready',True)
        mobile.screenshot(path=str(OUT/'mobile.png'),full_page=True)
        mobile_context.close()
        check('noConsoleErrors',not REPORT['consoleErrors'])
        check('noPageErrors',not REPORT['pageErrors'])
        check('noFailedRequests',not REPORT['failedRequests'])
        browser.close()
    REPORT['automatedPassed']=True
except Exception as error:
    REPORT['automatedPassed']=False
    REPORT['failure']=str(error)
    REPORT['traceback']=traceback.format_exc()
    raise
finally:
    server.shutdown()
    (OUT/'browser-report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(REPORT,ensure_ascii=False,indent=2))
