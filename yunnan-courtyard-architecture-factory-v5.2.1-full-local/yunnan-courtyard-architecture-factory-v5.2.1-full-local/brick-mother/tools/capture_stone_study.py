#!/usr/bin/env python3
"""Native screenshots and independent public-route checks for the stone study."""
from __future__ import annotations
import base64, hashlib, json, os, re, shutil, threading, traceback
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

BASE=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('STONE_EVIDENCE_DIR','/tmp/stone-study-evidence'))
HEAD=os.environ.get('GITHUB_SHA','local')
OUT.mkdir(parents=True,exist_ok=True)
report={'head':HEAD,'sourceGeometryHead':'54f9ae9f43c078522ac6e082c4a857e57b06fae2','viewport':[1440,1000],'deviceScaleFactor':1,'imageResampling':False,'frames':[],'publicAttempts':[],'localPassed':False,'standalonePassed':False,'publicPassed':False,'passed':False,'visualApproved':False,'productionApproved':False}

def bundle():
    html=(BASE/'stone-study.html').read_text()
    def inline(match):
        name=match.group(1)
        text=(BASE/name).read_text()
        if name=='stone-response-study.js':
            data=(BASE/'data/brick-material-profiles-v2.json').read_bytes()
            uri='data:application/json;base64,'+base64.b64encode(data).decode()
            text=text.replace("fetch('./data/brick-material-profiles-v2.json')",'fetch('+json.dumps(uri)+')')
        return '<script>\n'+text.replace('</script','<\\/script')+'\n</script>'
    html=re.sub(r'<script src="\./([^"?]+)"></script>',inline,html)
    base_url=f'https://rawcdn.githack.com/haihao0307/HOUSE/{HEAD}/'+str(BASE.relative_to(Path.cwd()))+'/'
    html=html.replace('href="./brick-mother-observation-studio.html','href="'+base_url+'brick-mother-observation-studio.html')
    target=OUT/'BRICK_MOTHER_STONE_STUDY_S1.html'
    target.write_text(html)
    report['standaloneSha256']=hashlib.sha256(target.read_bytes()).hexdigest()
    return target

def observe(page):
    record={'errors':[],'consoleErrors':[],'failedRequests':[],'responses':[]}
    page.on('pageerror',lambda e:record['errors'].append(str(e)))
    page.on('console',lambda m:record['consoleErrors'].append(m.text) if m.type=='error' else None)
    page.on('requestfailed',lambda r:record['failedRequests'].append({'url':r.url,'failure':r.failure}))
    page.on('response',lambda r:record['responses'].append({'url':r.url,'status':r.status,'type':r.headers.get('content-type','')}))
    return record

def ready(page,url,record):
    response=page.goto(url,wait_until='load',timeout=60000)
    record['httpStatus']=response.status if response else None
    page.wait_for_function("document.documentElement.dataset.studyReady!==undefined",timeout=45000)
    status=page.evaluate('document.documentElement.dataset.studyReady')
    if status!='true':
        raise RuntimeError(page.locator('#busy').inner_text())
    page.wait_for_function('window.__STONE_STUDY_RENDERER__.drawCount>0',timeout=30000)
    page.evaluate('window.__STONE_STUDY_RENDERER__.draw();window.__STONE_STUDY_RENDERER__.gl.finish()')
    record['state']=page.evaluate('window.__STONE_STUDY__')
    record['glError']=page.evaluate('window.__STONE_STUDY_RENDERER__.gl.getError()')
    if record['errors'] or record['glError']:
        raise RuntimeError('Browser or WebGL error')

def capture(page,name):
    page.evaluate('window.__STONE_STUDY_RENDERER__.draw();window.__STONE_STUDY_RENDERER__.gl.finish()')
    path=OUT/name
    page.locator('#canvas').screenshot(path=str(path))
    image=Image.open(path).convert('RGB')
    pixels=[v for v in image.getdata() if max(v)>12]
    if len(pixels)<image.width*image.height*.10:raise RuntimeError('Insufficient rendered content: '+name)
    return {'file':name,'size':list(image.size),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'occupiedFraction':len(pixels)/(image.width*image.height),'meanOccupiedSRGB255':[sum(v[c] for v in pixels)/len(pixels) for c in range(3)]}

def diagnose(page,record,name):
    record['exception']=traceback.format_exc()
    try:
        record['bodyText']=page.locator('body').inner_text(timeout=4000)[:4000]
        page.screenshot(path=str(OUT/name),timeout=10000)
    except Exception:pass

server=ThreadingHTTPServer(('127.0.0.1',8875),partial(SimpleHTTPRequestHandler,directory=str(BASE)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    standalone=bundle()
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--allow-file-access-from-files'])
        page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
        local=observe(page);report['local']=local
        try:
            ready(page,'http://127.0.0.1:8875/stone-study.html',local)
            page.add_style_tag(content='.badge{visibility:hidden!important}')
            for kind in range(4):
                page.locator(f'[data-kind="{kind}"]').click()
                item=capture(page,f'stone-{kind}-final.png');item['kind']=kind
                report['frames'].append(item)
            assert len(set(i['sha256'] for i in report['frames']))==4
            page.locator('[data-kind="2"]').click()
            for channel in (1,3,4,8):
                page.locator(f'[data-debug="{channel}"]').click()
                capture(page,f'granite-channel-{channel}.png')
            page.locator('[data-debug="0"]').click()
            page.locator('#wet').evaluate("e=>{e.value='0.7';e.dispatchEvent(new Event('input',{bubbles:true}))}")
            capture(page,'granite-wet.png')
            page.locator('#wet').evaluate("e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}))}")
            page.screenshot(path=str(OUT/'workspace.png'))
            report['localPassed']=True
        except Exception:
            diagnose(page,local,'local-error.png')
        page.close()
        single=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
        sr=observe(single);report['standalone']=sr
        try:
            ready(single,standalone.as_uri(),sr)
            capture(single,'standalone-limestone.png')
            report['standalonePassed']=True
        except Exception:
            diagnose(single,sr,'standalone-error.png')
        single.close()
        rel=str(BASE.relative_to(Path.cwd()))
        for host in ['rawcdn.githack.com','raw.githack.com']:
            public=f'https://{host}/haihao0307/HOUSE/{HEAD}/{rel}/stone-study.html'
            pub=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
            pr=observe(pub);pr['url']=public;report['publicAttempts'].append(pr)
            try:
                ready(pub,public,pr)
                capture(pub,'public-limestone.png')
                pub.screenshot(path=str(OUT/'public-workspace.png'))
                report['publicPassed']=True;report['publicUrl']=public
            except Exception:
                diagnose(pub,pr,host+'-error.png')
            pub.close()
            if report['publicPassed']:break
        browser.close()
    report['passed']=report['localPassed'] and report['standalonePassed'] and report['publicPassed']
except Exception:
    report['exception']=traceback.format_exc()
finally:
    server.shutdown()
    (OUT/'qa-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    for name in ['stone-study.html','stone-response-study.js']:
        shutil.copy2(BASE/name,OUT/name)
print(json.dumps({k:report.get(k) for k in ['head','localPassed','standalonePassed','publicPassed','publicUrl','passed']},indent=2))
if not report['passed']:raise SystemExit('Inspect retained browser report')
