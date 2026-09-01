#!/usr/bin/env python3
"""Real Chromium checks for the V0.5 workbench, including actual render changes."""
from __future__ import annotations
import argparse, functools, hashlib, http.server, json, shutil, threading, traceback, zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--site', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--url')
parser.add_argument('--fixtures', type=Path)
args = parser.parse_args()
site = args.site.resolve(); out = args.out.resolve(); out.mkdir(parents=True, exist_ok=True)
index = site / 'index.html'; manifest_path = site / 'v05' / 'build-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
report = {'schema':'tiles-mother-v05-browser-report','version':'0.5.0','tests':[],'screenshots':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'unexpectedNetworkRequests':[],'visualApproved':False,'productionApproved':False,'allPassed':False,'testedURL':args.url}
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def check(name, value, detail=None):
    record={'name':name,'passed':bool(value)}
    if detail is not None: record['detail']=detail
    report['tests'].append(record); print(name, bool(value), str(detail)[:200], flush=True)
    if not value: raise AssertionError(f'{name}: {detail}')
def shot(page, name, full_page=False):
    p=out/f'{name}.jpg'; page.screenshot(path=str(p), full_page=full_page, type='jpeg', quality=84)
    report['screenshots'].append({'path':p.name,'bytes':p.stat().st_size,'sha256':digest(p)}); return p
def canvas(page): return page.locator('#gl').screenshot(type='png')
def scene(page): return page.evaluate('() => TilesMotherV05.getDiagnostics()')
def state(page): return page.evaluate('() => TilesMotherV05.getState()')
server=None
if args.url: url=args.url
else:
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(site)))
    threading.Thread(target=server.serve_forever,daemon=True).start(); url=f'http://127.0.0.1:{server.server_port}/index.html'; report['testedURL']=url
try:
    check('deterministic candidate bytes', digest(index)==manifest['indexSHA256'], {'actual':digest(index),'manifest':manifest['indexSHA256']})
    check('runtime excludes raw source', manifest['rawSourceInRuntime'] is False and manifest['completeLargeTexturesInRuntime'] is False)
    with sync_playwright() as pw:
        candidates=[shutil.which(x) for x in ('google-chrome','google-chrome-stable','chromium','chromium-browser')]+[r'C:\Program Files\Google\Chrome\Application\chrome.exe',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']
        executable=next((x for x in candidates if x and Path(x).is_file()),None)
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
        if executable: launch['executable_path']=executable
        browser=pw.chromium.launch(**launch); report['browserVersion']=browser.version
        context=browser.new_context(viewport={'width':1536,'height':960},device_scale_factor=1); page=context.new_page()
        origin=url.split('/tiles-mother/')[0] if '/tiles-mother/' in url else url.rsplit('/',1)[0]
        page.on('pageerror',lambda e:report['pageErrors'].append(str(e))); page.on('console',lambda m:report['consoleErrors'].append(m.text) if m.type=='error' else None); page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure})); page.on('request',lambda r:report['unexpectedNetworkRequests'].append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith(origin) else None)
        response=page.goto(url,wait_until='networkidle',timeout=90000); check('entry HTTP 200',response is not None and response.status==200,response.status if response else None); page.wait_for_function('document.body.dataset.appInitialized === "true" && document.body.dataset.tilesMotherV05Ready === "true"',timeout=60000); page.wait_for_timeout(400)
        check('workbench and adapter versions',page.evaluate('() => TilesMother.version')=='0.5.0' and page.evaluate('() => TilesMotherV05.version')=='0.5.0'); check('real WebGL2',page.evaluate('() => !!document.getElementById("gl").getContext("webgl2")')); check('V0.5 roof default',state(page)['view']=='roof')
        page.evaluate('() => TilesMotherV05.setMode("studio_beauty")'); page.evaluate('() => TilesMotherV05.setFocus("all")'); page.wait_for_timeout(400); roof=scene(page)
        check('28 tile composition',roof['tileCount']==28 and roof['panCount']==16 and roof['coverCount']==12,roof)
        check('explicit front and back roles',set(roof['roles']) >= {'front-pan','back-pan','front-cover','back-cover'},roof['roles'])
        check('surface sampled contacts',roof['placement']['bboxOnlyContactUsed'] is False and len(roof['contacts'])==36 and all('top-surface band' in x['method'] for x in roof['contacts']))
        check('triangle and spatial closure',all(x['geometry']['degenerateTriangles']==0 and x['geometry']['closedBySpatialIncidence'] and x['geometry']['overSharedEdgesBySpatialPosition']==0 for x in roof['meshes']))
        check('separate edge normals and thickness space',all(x['geometry']['faceCounts']['edge']>0 and x['geometry']['edgeNormalSpace'].startswith('local thickness') for x in roof['meshes']))
        composition_lengths={k:len(roof['compositions'].get(k,[])) for k in ('adjacentPans','frontBackPans','frontBackCovers','adjacentPanAndCover')}
        check('local composition evidence exists',all(composition_lengths.values()),composition_lengths)
        shot(page,'roof-studio-v05'); studio_pixels=canvas(page); page.evaluate('() => TilesMotherV05.setMode("neutral_inspection")'); page.wait_for_timeout(250); neutral_pixels=canvas(page); shot(page,'roof-neutral-v05'); check('neutral disables texture path',state(page)['mode']=='neutral_inspection' and neutral_pixels!=studio_pixels)
        page.evaluate('() => TilesMotherV05.setMode("diagnostic")'); page.evaluate('() => TilesMotherV05.setFocus("side-edge")'); page.wait_for_timeout(250); shot(page,'side-edge-v05'); page.evaluate('() => TilesMotherV05.setFocus("cover-seam")'); page.wait_for_timeout(250); shot(page,'cover-seam-v05')
        page.evaluate('() => TilesMotherV05.setMode("studio_beauty")'); page.evaluate('() => TilesMotherV05.setFocus("board-micro")'); page.wait_for_timeout(250); before_micro=canvas(page); page.evaluate('() => TilesMotherV05.setLayer("micro",false)'); page.wait_for_timeout(250); after_micro=canvas(page); check('micro toggle changes actual rendered field',before_micro!=after_micro); check('micro toggle leaves generated geometry', [x['positionHash'] for x in scene(page)['meshes']]==[x['positionHash'] for x in roof['meshes']]); page.evaluate('() => TilesMotherV05.setLayer("micro",true)')
        variants=[]
        for child in (0,1,2):
            page.locator(f'[data-child="{child}"]').click(); page.wait_for_timeout(400); current=scene(page); variants.append({'child':child,'hash':current['meshes'][0]['positionHash']})
        check('pan has three actual variants',len({x['hash'] for x in variants})==3,variants); report['panVariants']=variants
        page.locator('[data-family="cover"]').click(); page.wait_for_timeout(450); cover=scene(page); check('cover family remains separate',cover['panCount']==16 and cover['coverCount']==12 and all(x['family']=='pan' for x in cover['meshes'][:16]) and all(x['family']=='cover' for x in cover['meshes'][16:])); shot(page,'cover-variants-v05')
        page.locator('[data-family="pan"]').click(); page.wait_for_timeout(350); baseline=scene(page); baseline_pixels=canvas(page); seeds=page.evaluate('() => TilesMother.getProject().profiles.pan.seeds'); page.evaluate('s => TilesMother.setSeed("color",s.color+1)',seeds); page.wait_for_timeout(300); colored=canvas(page); check('color seed changes actual pixels and not geometry',colored!=baseline_pixels and [x['positionHash'] for x in scene(page)['meshes']]==[x['positionHash'] for x in baseline['meshes']]); page.evaluate('s => TilesMother.setSeed("color",s.color)',seeds); page.wait_for_timeout(250)
        page.evaluate('() => TilesMotherV05.setTime(50*86400)'); page.wait_for_timeout(450); aged=scene(page); check('unified physical time reaches all roof entities',aged['history']['physicalTime']==50*86400 and all(x['state']['physicalTimeSeconds']==50*86400 for x in aged['meshes'])); check('history changes actual state and geometry',aged['meshes']!=baseline['meshes']); shot(page,'roof-after-history-v05')
        page.evaluate('() => TilesMotherV05.setTime(0)'); page.wait_for_timeout(450); check('history rewind deterministic',scene(page)['meshes']==baseline['meshes'])
        page.evaluate('() => { const e=document.getElementById("materialPreset"); if(e?.closest("details")) e.closest("details").open=true; }')
        preset=page.locator('#materialPreset'); preset.select_option('legacy-v02'); page.wait_for_timeout(400); check('V0.2 fallback remains selectable',preset.input_value()=='legacy-v02'); preset.select_option('jiangwutang-v05'); page.wait_for_timeout(450); page.evaluate('() => TilesMotherV05.setView("single")'); page.wait_for_timeout(400); check('single view works',state(page)['view']=='single' and scene(page)['tileCount']==1); page.evaluate('() => TilesMotherV05.setView("roof")'); page.evaluate('() => TilesMotherV05.setFocus("cover-seam")'); page.evaluate('() => TilesMother.setSeed("master",880031)'); page.wait_for_timeout(800); page.reload(wait_until='networkidle',timeout=90000); page.wait_for_function('document.body.dataset.tilesMotherV05Ready === "true"',timeout=60000); check('V0.5 state survives reload',page.evaluate('() => TilesMother.version')=='0.5.0' and state(page)['view']=='roof' and state(page)['focus']=='cover-seam'); check('seed edit survives reload',page.evaluate('() => TilesMother.getProject().profiles.pan.seeds.master')==880031)
        fixtures=args.fixtures.resolve() if args.fixtures else None
        if fixtures and (fixtures/'tile.GLB').is_file() and (fixtures/'tile-binary.fbx').is_file():
            page.locator('#refFiles').set_input_files([str(fixtures/'tile.GLB'),str(fixtures/'tile-binary.fbx')]); page.evaluate('() => TilesMother.references.whenIdle()'); page.wait_for_timeout(900); refs=page.evaluate('() => TilesMother.getRefs()'); check('GLB and FBX received',len(refs)>=2,refs); check('reference storage ready',page.evaluate('() => TilesMother.getStorage().dbReady'))
            with page.expect_download(timeout=30000) as download_info: page.locator('#exportBtn').click()
            archive=out/'collaboration-roundtrip.zip'
            download_info.value.save_as(str(archive))
            with zipfile.ZipFile(archive) as z:
                check('collaboration CRC roundtrip',z.testzip() is None)
                record=json.loads(z.read('workspace.json'))
                check('source reference bytes preserved',all(z.read(x['archivePath'])==(fixtures/x['filename']).read_bytes() for x in record['referenceFiles']))
            page.locator('#projectFile').set_input_files(str(archive)); page.wait_for_timeout(1800); check('collaboration import retains V0.5 state',page.evaluate('() => TilesMother.getProject().v05.version')=='0.5.0')
        else: report['missingEvidence']=['synthetic GLB/FBX fixtures not supplied']; print('MISSING evidence: synthetic GLB/FBX fixtures')
        mobile_context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True); mobile=mobile_context.new_page(); mobile.goto(url,wait_until='networkidle',timeout=90000); mobile.wait_for_function('document.body.dataset.tilesMotherV05Ready === "true"',timeout=60000); check('mobile WebGL2 and no horizontal overflow',mobile.evaluate('() => !!document.getElementById("gl").getContext("webgl2")') and mobile.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 1')); shot(mobile,'mobile-v05',True); mobile_context.close()
        check('no page errors',not report['pageErrors'],report['pageErrors']); check('no console errors',not report['consoleErrors'],report['consoleErrors']); check('no failed requests',not report['failedRequests'],report['failedRequests']); check('no unexpected external requests',not report['unexpectedNetworkRequests'],report['unexpectedNetworkRequests']); report['allPassed']=not report.get('missingEvidence')
        browser.close()
except Exception as error:
    report['error']=str(error); report['traceback']=traceback.format_exc()
finally:
    if server: server.shutdown()
    (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'allPassed':report['allPassed'],'tests':len(report['tests']),'screenshots':len(report['screenshots']),'error':report.get('error'),'missingEvidence':report.get('missingEvidence')},ensure_ascii=False))
if not report['allPassed']: raise SystemExit(1)
