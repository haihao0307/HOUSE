"""Real standalone-file smoke test; distinct from local set_content evidence."""
from pathlib import Path
import hashlib,json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out=root/'qa/file-smoke';out.mkdir(exist_ok=True)
report={'htmlSHA256':hashlib.sha256((root/'START_HERE.html').read_bytes()).hexdigest(),'protocol':'file','errors':[],'requests':[],'cases':[],'motionGateTested':False,'visualApproved':False,'productionApproved':False}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    report['browserVersion']=browser.version
    page=browser.new_page(viewport={'width':1280,'height':900},device_scale_factor=1)
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
    page.on('request',lambda q:report['requests'].append(q.url) if q.url.startswith(('http:','https:')) else None)
    try:
        page.goto((root/'START_HERE.html').as_uri(),wait_until='load',timeout=90000)
        page.wait_for_function("window.TilesField&&document.body.dataset.ready==='true'",timeout=90000)
        for name,config in [('tiles',{'scene':'tiles','year':5}),('wood',{'scene':'wood','year':5}),('assembly',{'scene':'assembly','year':0}),('roof',{'scene':'roof','year':0}),('roof7',{'scene':'roof','year':7})]:
            page.evaluate('(v)=>TilesField.set(v)',config)
            page.wait_for_function('TilesField.stats().framePending===0',timeout=90000)
            row=page.evaluate('TilesField.stats()');row['name']=name;row['integrity']=page.evaluate('TilesField.integrity()');report['cases'].append(row)
            assert row['integrity']['uvChannels']==0 and row['integrity']['materialMaps']==0 and row['textures']==0
            if name=='roof':assert row['counts']['live']==860
            if name in ['tiles','wood','roof']:page.screenshot(path=str(out/(name+'.png')))
        page.set_viewport_size({'width':390,'height':844});page.evaluate("TilesField.set({scene:'tiles',year:5})")
        page.wait_for_function('TilesField.stats().framePending===0',timeout=90000)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(out/'mobile.png'))
        before=page.evaluate('TilesField.stats().frames');page.wait_for_timeout(6000)
        report['idleFrames']=page.evaluate('TilesField.stats().frames')-before
        assert report['idleFrames']==0
        assert not report['errors'] and not report['requests']
        report['passed']=True
    except Exception as e:
        report['passed']=False;report['exception']=str(e);raise
    finally:
        (out/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        browser.close()
