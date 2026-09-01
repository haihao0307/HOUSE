#!/usr/bin/env python3
"""UI verification is separate from the building's intentionally blocked evidence gate."""
import argparse,functools,json,os,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from PIL import Image,ImageStat,ImageChops

def main():
 p=argparse.ArgumentParser();p.add_argument('--site',type=Path);p.add_argument('--url');p.add_argument('--output',type=Path,required=True);p.add_argument('--expected-sha');a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 server=None
 if a.url:url=a.url
 else:
  server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(SimpleHTTPRequestHandler,directory=str(a.site.resolve())))
  threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/architecture-workbench/'
 report={'version':'0.2.0','url':url,'transport':'public-http' if a.url else 'local-http','scope':'first-building-preflight-ui_and_control_isolation','buildingCompleted':False,'visualApproved':False,'productionApproved':False,'tests':[],'devices':{}}
 def ck(name,v,detail=None):
  report['tests'].append({'name':name,'passed':bool(v),'detail':detail})
  if not v:raise AssertionError(name+': '+str(detail))
 try:
  with sync_playwright() as pw:
   b=pw.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   report['browser']=b.version
   for name,w,h in [('desktop',1440,1000),('mobile',390,844)]:
    ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=name=='mobile',has_touch=name=='mobile',accept_downloads=True)
    page=ctx.new_page();errors=[];failed=[];http=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
    page.on('requestfailed',lambda r:failed.append({'url':r.url,'error':r.failure}));page.on('response',lambda r:http.append({'url':r.url,'status':r.status}) if r.status>=400 else None);page.on('request',lambda r:requests.append(r.url))
    response=page.goto(url,wait_until='domcontentloaded',timeout=90000);page.wait_for_function('window.__FIRST_BUILDING__?.ready || window.__FIRST_BUILDING_ERROR__',timeout=60000)
    ck(name+'_ready',page.evaluate('window.__FIRST_BUILDING__?.ready'),page.evaluate('window.__FIRST_BUILDING_ERROR__||null'))
    ck(name+'_default_legacy_not_loaded',not any('/YunnanCourtyardProduction.js' in u for u in requests))
    ck(name+'_root_redirected_to_preflight','/first-building/' in page.url)
    build=page.evaluate('window.__FIRST_BUILDING__.build');report['sourceCommit']=build['sourceCommit']
    if a.expected_sha:ck(name+'_exact_commit',build['sourceCommit']==a.expected_sha)
    r=page.evaluate('window.__FIRST_BUILDING__.audit');ck(name+'_25_selftests',r['selfTests']['allPassed'] and r['selfTests']['passed']==25)
    ck(name+'_real_legacy_failure_exposed',r['legacyRegression']['status']=='fail' and r['legacyRegression']['maxExcessM']>5)
    ck(name+'_building_gate_not_approved',not r['release']['technicalEligible'] and not r['newBuildingCompleted'] and not r['productionApproved'])
    ck(name+'_no_invented_full_building',r['candidateStatus']=='dimensional-control-candidate_not_verified_historic_baseline')
    initial=page.evaluate('window.__FIRST_BUILDING__.fingerprint()');report['geometryFingerprint']=initial
    page.wait_for_timeout(400);ck(name+'_overview_bounds',page.evaluate('window.__FIRST_BUILDING__.snapshot().framing.fullyInView'))
    ck(name+'_no_horizontal_overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    imgs=[]
    for mode in ['neutral_inspection','studio_beauty','diagnostic']:
     page.click(f'[data-mode="{mode}"]');page.wait_for_timeout(250)
     ck(name+'_mode_'+mode,page.evaluate('window.__FIRST_BUILDING__.snapshot().presentationMode')==mode)
     ck(name+'_source_fixed_'+mode,page.evaluate('window.__FIRST_BUILDING__.fingerprint()')==initial)
     f=a.output/f'{name}-{mode}.png';page.locator('#viewport canvas').screenshot(path=str(f));imgs.append(f)
     ck(name+'_visible_'+mode,sum(ImageStat.Stat(Image.open(f).convert('RGB')).stddev)>8)
    ck(name+'_lighting_changes_actual_pixels',sum(ImageStat.Stat(ImageChops.difference(Image.open(imgs[0]).convert('RGB'),Image.open(imgs[1]).convert('RGB'))).mean)>.1)
    page.click('[data-mode="studio_beauty"]');before=page.evaluate('window.__FIRST_BUILDING__.snapshot()');page.locator('[data-light="key"]').evaluate("e=>{e.value='3.2';e.dispatchEvent(new Event('input',{bubbles:true}));}")
    after=page.evaluate('window.__FIRST_BUILDING__.snapshot()');ck(name+'_key_independent',after['lights']['key']['intensity']==3.2 and before['lights']['fill']==after['lights']['fill'] and before['lights']['rim']==after['lights']['rim'])
    for direction in ['left','right','up','down']:
     before=page.evaluate('window.__FIRST_BUILDING__.snapshot().camera');page.click(f'[data-pan="{direction}"]');after=page.evaluate('window.__FIRST_BUILDING__.snapshot().camera');ck(name+'_pan_'+direction,before['target']!=after['target'] and before['position']!=after['position'])
    ck(name+'_pan_keeps_source',page.evaluate('window.__FIRST_BUILDING__.fingerprint()')==initial)
    page.click('#reset');page.wait_for_timeout(300);ck(name+'_reset_bounds',page.evaluate('window.__FIRST_BUILDING__.snapshot().framing.fullyInView'))
    page.locator('#viewport canvas').scroll_into_view_if_needed();bb=page.locator('#viewport canvas').bounding_box();x,y=bb['x']+bb['width']*.52,bb['y']+bb['height']*.65;before=page.evaluate('window.__FIRST_BUILDING__.snapshot().camera')
    if name=='mobile':
     cdp=ctx.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
     for n in range(1,7):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+7*n,'y':y-3*n}]})
     cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    else:
     page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+60,y-35,steps=8);page.mouse.up()
    page.wait_for_timeout(500);ck(name+'_real_drag_rotates',before['position']!=page.evaluate('window.__FIRST_BUILDING__.snapshot().camera.position'))
    page.click('#plan');page.wait_for_timeout(150);ck(name+'_plan_bounds',page.evaluate('window.__FIRST_BUILDING__.snapshot().framing.fullyInView'))
    page.click('#front');page.wait_for_timeout(150);ck(name+'_front_bounds',page.evaluate('window.__FIRST_BUILDING__.snapshot().framing.fullyInView'))
    page.click('[data-scene="fault"]');page.wait_for_timeout(300);ck(name+'_explicit_fault_view',page.evaluate('window.__FIRST_BUILDING__.snapshot().activeScene')=='fault')
    page.screenshot(path=str(a.output/f'{name}-fault-page.png'),full_page=True)
    ck(name+'_scene_switch_keeps_source',page.evaluate('window.__FIRST_BUILDING__.fingerprint()')==initial)
    page.click('[data-scene="control"]');page.click('[data-mode="neutral_inspection"]');page.wait_for_timeout(200)
    with page.expect_download() as d:page.click('#export')
    dest=a.output/f'{name}-export.json';d.value.save_as(dest);record=json.loads(dest.read_text())
    ck(name+'_export_evidence_not_approval',record['packetType']=='blueprint-first-building-preflight' and record['visualApproved'] is False and record['productionApproved'] is False and record['geometryFingerprint']==initial)
    page.screenshot(path=str(a.output/f'{name}-overview.png'),full_page=True)
    ck(name+'_console_clean',not errors,errors);ck(name+'_requests_clean',not failed and not http,{'failures':failed,'http':http})
    report['devices'][name]={'viewport':[w,h],'errors':errors,'failedRequests':failed,'httpErrors':http,'snapshot':page.evaluate('window.__FIRST_BUILDING__.snapshot()')};ctx.close()
   b.close()
 except Exception as e:report['error']=str(e)
 finally:
  report['allPassed']=bool(report['tests']) and all(t['passed'] for t in report['tests']) and 'error' not in report
  report['passed']=sum(t['passed'] for t in report['tests']);report['total']=len(report['tests']);(a.output/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  if server:server.shutdown()
  print(json.dumps({k:report.get(k) for k in ['allPassed','passed','total','error']},ensure_ascii=False))
 if not report['allPassed']:raise SystemExit(2)
if __name__=='__main__':main()
