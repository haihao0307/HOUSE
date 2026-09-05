"""Run the unchanged offline V0.9.8 and collect fresh, scoped evidence."""
from pathlib import Path
import os, json, hashlib, time
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]; out=root/'qa/release-refresh'; out.mkdir(parents=True,exist_ok=True)
html=root/'START_HERE.html'; text=html.read_text(encoding='utf-8'); audit=(root/'qa/audit_runtime.js').read_text()
errors=[]; console_errors=[]; requests=[]; cases=[]
with sync_playwright() as p:
    opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
    if os.environ.get('CHROMIUM'):opts['executable_path']=os.environ['CHROMIUM']
    browser=p.chromium.launch(**opts)
    context=browser.new_context(viewport={'width':1500,'height':950},device_scale_factor=1)
    page=context.new_page(); page.set_default_timeout(240000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:console_errors.append(m.text) if m.type=='error' else None)
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http://','https://')) else None)
    protocol='file'; direct_error=None
    try:
        page.goto(html.resolve().as_uri(),wait_until='load',timeout=30000)
        page.wait_for_function("window.TilesMotherV098 && document.body.dataset.ready==='true'",timeout=30000)
    except Exception as exc:
        direct_error=str(exc); protocol='injected-exact-html'; page.close(); page=context.new_page(); page.set_default_timeout(240000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:console_errors.append(m.text) if m.type=='error' else None)
        page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http://','https://')) else None)
        page.set_content(text,wait_until='load')
        page.wait_for_function("window.TilesMotherV098 && document.body.dataset.ready==='true'")
    global_uv=page.evaluate('TilesMotherV098.runUVQA()'); assert global_uv['allPassed']
    config=[('trio',25,'maintained'),('forty8',0,'maintained'),('forty8',100,'abandoned'),('roof',0,'maintained'),('roof',100,'maintained'),('roof',100,'abandoned'),('uv',25,'maintained')]
    for scene,year,care in config:
        t=time.monotonic(); page.evaluate('v=>TilesMotherV098.setView(v)',{'scene':scene,'year':year,'care':care,'timberOnly':False,'showContacts':False})
        page.wait_for_timeout(350)
        stats=page.evaluate('({triangles:__tilesDebug.renderer.info.render.triangles,counts:TilesMotherV098.getCounts(),structure:TilesMotherV098.structure,contacts:TilesMotherV098.getContactQA(),timber:TilesMotherV098.getTimberQA()})')
        assert stats['triangles']>0,(scene,'empty render')
        result=page.evaluate(audit) if scene in ('forty8','roof') else None
        if result:assert not result['penetrations'] and not result['geometryFailures'],(scene,year,result)
        name=f'{scene}_{year}_{care}.jpg'; page.screenshot(path=str(out/name),type='jpeg',quality=82)
        cases.append({'scene':scene,'year':year,'care':care,'seconds':round(time.monotonic()-t,3),'stats':stats,'audit':result,'screenshot':name})
        print(scene,year,care,'rendered',flush=True)
    page.set_viewport_size({'width':390,'height':844});page.evaluate("TilesMotherV098.setView({scene:'forty8',year:25,care:'maintained'})");page.wait_for_timeout(400)
    mobile=page.evaluate('({width:innerWidth,height:innerHeight,bodyWidth:document.body.scrollWidth,canvasWidth:__tilesDebug.renderer.domElement.clientWidth,triangles:__tilesDebug.renderer.info.render.triangles})')
    assert mobile['triangles']>0 and mobile['canvasWidth']>0
    page.screenshot(path=str(out/'mobile_forty8.jpg'),type='jpeg',quality=82)
    report={'version':'0.9.8','packageRevision':'handoff.1','sourceSHA256':hashlib.sha256(html.read_bytes()).hexdigest(),'browserVersion':browser.version,'protocol':protocol,'directFileAttemptError':direct_error,'hostPlatform':os.name,'windowsUserMachineTested':False,'globalUV':global_uv,'cases':cases,'mobile':mobile,'pageErrors':errors,'consoleErrors':console_errors,'externalRequests':requests,'visualApproved':False,'productionApproved':False}
    report['allPassed']=not errors and not console_errors and not requests and global_uv['allPassed'] and len(cases)==len(config)
    (out/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); browser.close()
    assert report['allPassed'],report
    print('Release smoke PASS; no claim of Windows-device or human visual approval.')
