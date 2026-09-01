#!/usr/bin/env python3
"""Real Chromium UI and preview-isolation checks. No visual approval is granted."""
from __future__ import annotations
import argparse, functools, hashlib, json, os, shutil, threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--site',type=Path);ap.add_argument('--output',type=Path,required=True);ap.add_argument('--expected-sha');args=ap.parse_args();out=args.output;out.mkdir(parents=True,exist_ok=True)
 server=None
 if args.url:url=args.url
 else:
  assert args.site and args.site.is_dir()
  handler=functools.partial(SimpleHTTPRequestHandler,directory=str(args.site.resolve()));server=ThreadingHTTPServer(('127.0.0.1',0),handler);threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/architecture-workbench/'
 tests=[];report={'schemaVersion':'1.0.0','url':url,'kind':'public-browser' if args.url else 'staged-site-real-browser','tests':tests,'screenshots':[],'desktop':{},'mobile':{},'visualApproved':False,'productionApproved':False}
 def check(name,value,detail=None):
  entry={'name':name,'passed':bool(value)}
  if detail is not None:entry['detail']=detail
  tests.append(entry)
  if not value:raise AssertionError(name+': '+str(detail))
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   report['browser']=browser.version
   ctx=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True)
   page=ctx.new_page();errors=[];bad=[];failed=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   page.on('response',lambda r:bad.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
   page.on('requestfailed',lambda r:failed.append({'url':r.url,'error':r.failure}))
   response=page.goto(url,wait_until='domcontentloaded',timeout=90000);check('desktop_html_200',response.status==200)
   page.wait_for_function('window.__BLUEPRINT_WORKBENCH__?.ready || window.__BLUEPRINT_BOOT_ERROR__',timeout=120000)
   check('desktop_boot_ready',page.evaluate('window.__BLUEPRINT_WORKBENCH__?.ready'),page.evaluate('window.__BLUEPRINT_BOOT_ERROR__||null'))
   build=page.evaluate('window.__BLUEPRINT_WORKBENCH__.build');report['build']=build
   if args.expected_sha:check('exact_source_commit',build['sourceCommit']==args.expected_sha)
   check('nine_sources',page.locator('[data-source]').count()==9);check('fourteen_topics',page.locator('[data-topic]').count()==14)
   initial=page.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.baselineFingerprint');report['sourceFingerprint']=initial
   check('actual_mesh_geometry_present',page.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.snapshot().sourceStats.triangleCount>100000'))
   for mode in ['neutral_inspection','studio_beauty','diagnostic']:
    page.click(f'[data-mode="{mode}"]');page.wait_for_timeout(800)
    check('mode_'+mode,page.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.snapshot().presentationMode')==mode)
    check('source_unchanged_'+mode,page.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.sourceFingerprint()')==initial)
    img=out/f'desktop-{mode}.png';page.screenshot(path=str(img),full_page=True);report['screenshots'].append({'file':img.name,'type':mode,'nativeViewport':[1440,1000],'upscaled':False})
    canvas=out/f'canvas-{mode}.png';page.locator('#viewport canvas').screenshot(path=str(canvas));im=Image.open(canvas).convert('RGB');std=ImageStat.Stat(im).stddev;check('nonblank_'+mode,sum(std)>10,{'size':im.size,'stddev':std})
   diff=ImageStat.Stat(ImageChops.difference(Image.open(out/'canvas-neutral_inspection.png').convert('RGB'),Image.open(out/'canvas-studio_beauty.png').convert('RGB'))).mean
   check('light_modes_actually_change_pixels',sum(diff)>1,diff)
   page.check('#cutaway');page.wait_for_timeout(300);check('cutaway_preserves_source',page.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.sourceFingerprint()')==initial);page.uncheck('#cutaway')
   page.click('[data-mode="studio_beauty"]');before=page.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.snapshot().lights')
   page.locator('[data-light="key"] input[type=range]').evaluate("el=>{el.value='3.1';el.dispatchEvent(new Event('input',{bubbles:true}))}");after=page.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.snapshot().lights');check('independent_key_light',after['key']['intensity']==3.1 and after['fill']==before['fill'] and after['rim']==before['rim'])
   check('light_edit_preserves_source',page.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.sourceFingerprint()')==initial)
   page.click('[data-view="front"]');page.wait_for_timeout(200);check('camera_preserves_source',page.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.sourceFingerprint()')==initial);page.click('#resetView')
   result=page.evaluate('''() => {const a=window.__BLUEPRINT_WORKBENCH__,caught=f=>{try{f();return false}catch{return true}};return {unknownKeys:caught(()=>a.validateResearchRecord({packetType:'blueprint-research-notes',schemaVersion:'1.0.0',notes:'x',attachments:[],visualApproved:true})),wrongVersion:caught(()=>a.validateResearchRecord({packetType:'blueprint-research-notes',schemaVersion:'2.0.0',notes:'x',attachments:[]})),wrongType:caught(()=>a.validateResearchRecord({packetType:'blueprint-research-notes',schemaVersion:'1.0.0',notes:42,attachments:[]})),invalidLight:caught(()=>a.validateLights({rotation:0,key:{enabled:true,intensity:Infinity,color:'#ffffff'},fill:{enabled:true,intensity:1,color:'#ffffff'},rim:{enabled:true,intensity:1,color:'#ffffff'}})),coreOverride:caught(()=>a.assertPolicy({...a.policy,version:'9.0.0'})),approvalReject:caught(()=>a.assertNoApproval({visualApproved:true,productionApproved:true})),approvalsFalse:!a.approvals.visualApproved&&!a.approvals.productionApproved};}''')
   for k,v in result.items():check('guard_'+k,v)
   for nav in ['knowledge','sources','mothers','method','intake']:
    page.click(f'[data-page="{nav}"]');check('navigation_'+nav,page.locator('#'+nav).is_visible());check('layout_'+nav,page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   page.click('[data-page="sources"]');page.fill('#sourceSearch','432');check('search_filter',page.locator('[data-source]').count()==1);page.fill('#sourceSearch','');page.locator('[data-source]').first.click();check('source_details',page.locator('#reader').is_visible());page.click('#closeReader')
   page.click('[data-page="knowledge"]');page.click('#readBlueprint');page.wait_for_selector('#reader[open]');check('blueprint_document_loaded',page.locator('#readerBody').inner_text().find('间数')>=0);page.click('#closeReader')
   page.click('[data-page="intake"]');page.fill('#notes','QA 独立浏览器测试笔记');page.click('#saveNotes')
   page.set_input_files('#fileInput',{'name':'qa-research-note.txt','mimeType':'text/plain','buffer':b'QA local-only attachment; no repository upload.'});page.wait_for_selector('[data-attachment]');check('attachment_receipt_only',page.locator('#intakeList').inner_text().find('已接收')>=0)
   with page.expect_download() as d:page.click('#exportButton')
   dl=d.value;target=out/'research-export.json';dl.save_as(target);packet=json.loads(target.read_text());check('research_export_valid',packet['packetType']=='blueprint-research-notes' and 'productionApproved' not in packet and len(packet['attachments'])==1)
   inspection=page.evaluate('window.__BLUEPRINT_WORKBENCH__.exportSnapshot()');check('inspection_export_no_approval',not inspection['visualApproved'] and not inspection['productionApproved'] and inspection['sourceFingerprint']==initial)
   page.reload(wait_until='domcontentloaded');page.wait_for_function('window.__BLUEPRINT_WORKBENCH__?.ready',timeout=120000);page.click('[data-page="intake"]');check('notes_persist',page.input_value('#notes')=='QA 独立浏览器测试笔记');page.wait_for_selector('[data-attachment]');check('files_persist',page.locator('[data-attachment]').count()==1)
   page.click('[data-page="overview"]');page.click('[data-mode="neutral_inspection"]');page.screenshot(path=str(out/'desktop-overview.png'),full_page=True)
   report['desktop']={'consoleAndPageErrors':errors,'httpErrors':bad,'failedRequests':failed,'snapshot':page.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.snapshot()')}
   check('desktop_console_clean',not errors,errors);check('desktop_resources_200',not bad and not failed,{'http':bad,'requests':failed})
   ctx.close()
   mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mp=mobile.new_page();me=[];mf=[]
   mp.on('pageerror',lambda e:me.append(str(e)));mp.on('console',lambda e:me.append(e.text) if e.type=='error' else None);mp.on('requestfailed',lambda r:mf.append(r.url))
   mr=mp.goto(url,wait_until='domcontentloaded',timeout=90000);mp.wait_for_function('window.__BLUEPRINT_WORKBENCH__?.ready',timeout=120000);check('mobile_html_and_boot',mr.status==200)
   check('mobile_no_horizontal_overflow',mp.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   mp.screenshot(path=str(out/'mobile-overview.png'),full_page=True);mp.click('[data-mode="studio_beauty"]');check('mobile_mode_switch',mp.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.snapshot().presentationMode')=='studio_beauty');mp.click('[data-mode="diagnostic"]');mp.screenshot(path=str(out/'mobile-diagnostic.png'),full_page=True)
   mp.click('#menuButton');mp.click('[data-page="sources"]');check('mobile_navigation',mp.locator('#sources').is_visible());check('mobile_sources_fit',mp.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   report['mobile']={'consoleAndPageErrors':me,'failedRequests':mf,'snapshot':mp.evaluate('window.__BLUEPRINT_WORKBENCH__.viewer.snapshot()'),'viewport':[390,844]};check('mobile_console_clean',not me,me);check('mobile_requests_clean',not mf,mf)
   mobile.close();browser.close()
 except Exception as e:report['error']=str(e)
 finally:
  report['allPassed']=bool(tests) and all(t['passed'] for t in tests) and 'error' not in report;report['passed']=sum(t['passed'] for t in tests);report['total']=len(tests);(out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
  if server:server.shutdown()
  print(json.dumps({'allPassed':report['allPassed'],'passed':report['passed'],'total':len(tests),'error':report.get('error')},ensure_ascii=False))
 if not report['allPassed']:raise SystemExit(2)
if __name__=='__main__':main()
