#!/usr/bin/env python3
"""Real browser regression for source builds or a commit-pinned public preview."""
import argparse, asyncio, hashlib, json, os, re, time
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright

P = argparse.ArgumentParser()
P.add_argument('--url', required=True)
P.add_argument('--out', type=Path, required=True)
P.add_argument('--html', type=Path, required=True)
A = P.parse_args(); A.out.mkdir(parents=True, exist_ok=True)
REPORT = {'version':'0.8.2', 'url':A.url, 'tests':[], 'physicalIPhoneTested':False,
          'webkitSafariTested':False, 'visualApproved':False, 'productionApproved':False,
          'distillationComplete':False, 'htmlSha256':hashlib.sha256(A.html.read_bytes()).hexdigest(),
          'exhaustiveTriangleCollisionVerified':False}

def check(name, ok, detail=None):
    REPORT['tests'].append({'name':name,'passed':bool(ok),'detail':detail})
    print(name, bool(ok), flush=True)
    if not ok: raise AssertionError(name)

async def ready(page):
    await page.wait_for_function('window.__tilesBoot?.state.ready && !window.TilesMotherV082Workbench.runtime.building', timeout=60000)

async def enter(page):
    response = await page.goto(A.url, wait_until='domcontentloaded', timeout=90000)
    if not await page.evaluate('Boolean(window.TilesMotherV082Workbench)'):
        body = await page.locator('body').inner_text()
        (A.out/'initial-response.txt').write_text(body)
        if urlparse(page.url).hostname in ('rawcdn.githack.com','raw.githack.com'):
            for role in ('button','link'):
                candidate = page.get_by_role(role, name=re.compile('continue|proceed|confirm|visit|open', re.I))
                if await candidate.count() == 1:
                    await page.screenshot(path=str(A.out/'preview-confirmation.png'))
                    await candidate.click()
                    REPORT['previewConfirmationClicked'] = True
                    break
    await ready(page)
    check('document_identity', await page.evaluate('TilesMotherV082Workbench.version') == '0.8.2')

async def value(page, element, val):
    await page.evaluate('([id,v])=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));}',[element,val])
    await page.wait_for_timeout(450); await ready(page)

async def main():
    async with async_playwright() as pw:
        options = {'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
        if os.environ.get('CHROMIUM_PATH'): options['executable_path']=os.environ['CHROMIUM_PATH']
        browser=await pw.chromium.launch(**options); REPORT['browser']=browser.version
        ctx=await browser.new_context(viewport={'width':393,'height':852},device_scale_factor=1,is_mobile=True,has_touch=True,
          user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1')
        page=await ctx.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        started=time.monotonic(); await enter(page)
        REPORT['mobileFirstReadyMs']=round((time.monotonic()-started)*1000)
        scene=await page.evaluate('TilesMotherV082Workbench.getSceneState()')
        diag=await page.evaluate('TilesMotherV082Workbench.getDiagnostics()')
        check('28_tiles_no_board',diag['tileCount']==28 and scene['roofBedChildren']==0 and not scene['floorVisible'])
        check('mobile_pbr_path',scene['rendererPath']=='mobile-lightweight-pbr')
        bounds=await page.evaluate('TilesMotherV082Workbench.getProjectedBounds()')
        check('portrait_fits',max(abs(v) for v in bounds.values())<1,bounds)
        check('triangle_orientation',all(m['geometry'].get('orientationChecked') and m['geometry']['flippedWindingTriangles']==0 for m in diag['meshes']))
        await page.screenshot(path=str(A.out/'mobile-ready.png'))
        f=await page.evaluate('TilesMotherV082Workbench.getMaterialFingerprint()')
        await value(page,'colorVariation',0)
        check('color_control_changes_data',f!=await page.evaluate('TilesMotherV082Workbench.getMaterialFingerprint()'))
        await value(page,'colorVariation',88)
        check('color_seed_replay',f==await page.evaluate('TilesMotherV082Workbench.getMaterialFingerprint()'))
        for age in (100,150,0):
            await value(page,'time',age); d=await page.evaluate('TilesMotherV082Workbench.getDiagnostics()')
            check('sampled_relations_age_'+str(age),d['support']['penetrations']==0 and d['drainage']['continuousCount']==3)
        await page.locator('#mobileInspect').click()
        await page.locator('[data-channel="roughness"]').click()
        check('pbr_channel_control',await page.evaluate('TilesMotherV082Workbench.state.channel')=='roughness')
        await page.locator('[data-channel="final"]').click()
        await page.locator('[data-focus="side-edge"]').click(); await ready(page)
        await page.locator('#mobileInspect').click()
        await page.screenshot(path=str(A.out/'mobile-side.png'))
        await page.locator('[data-view="roof"]').click(); await ready(page)
        await page.evaluate('TilesMotherV082Workbench.testContextLoss()')
        await page.wait_for_function('window.__tilesBoot.state.failed',timeout=10000)
        check('context_loss_visible',await page.locator('#bootRetry').is_visible())
        await page.evaluate('TilesMotherV082Workbench.testContextRestore()'); await ready(page)
        check('context_restored',await page.evaluate('TilesMotherV082Workbench.runtime.contextRestoreCount>=1'))
        check('no_unexpected_errors',not errors,errors)
        REPORT['mobileHealth']=await page.evaluate('TilesMotherV082Workbench.getHealth()')
        await ctx.close()
        dc=await browser.new_context(viewport={'width':1120,'height':800},device_scale_factor=1)
        dp=await dc.new_page(); await enter(dp)
        check('desktop_full_pbr',await dp.evaluate('TilesMotherV082Workbench.runtime.rendererPath')=='desktop-full-pbr')
        await dp.screenshot(path=str(A.out/'desktop-ready.png'),timeout=90000)
        await dc.close(); await browser.close()
        REPORT['allPassed']=True

try:
    asyncio.run(main())
except Exception as exc:
    REPORT['allPassed']=False; REPORT['failure']=str(exc)
    raise
finally:
    (A.out/'browser-report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n')
